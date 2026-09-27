import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { describe, expect, inject, it } from 'vitest';

const chrome = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
if (process.env.CI && !existsSync(chrome)) throw new Error('Set CHROME_BIN to the CI Chromium executable.');
const browserTest = it.runIf(existsSync(chrome));
const project = { id: 'recovery-project', name: 'Recovery fixture', kind: 'Web app', color: 'mint', status: 'In progress', progress: 0, owner: 'UT', repoPath: '/synthetic/repository', mode: 'connected', summary: 'A synthetic project.', tasks: [['Fixture task', 'Today', false]] };
const providers = [{ id: 'codex', label: 'Codex', available: true, mode: 'write', models: [] }, { id: 'local', label: 'Local', available: true, mode: 'write', models: [] }];
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const send = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
function contrastRatio(element) {
  const rgba = value => { const values = value.match(/[\d.]+/g).map(Number); return [values[0], values[1], values[2], values[3] ?? 1]; };
  const stack = [];
  for (let node = element; node; node = node.parentElement) stack.unshift(rgba(getComputedStyle(node).backgroundColor));
  const background = stack.reduce((base, layer) => base.map((value, index) => layer[index] * layer[3] + value * (1 - layer[3])), [255, 255, 255]);
  const foreground = rgba(getComputedStyle(element).color).slice(0, 3);
  const luminance = rgb => rgb.map(value => { const channel = value / 255; return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4; }).reduce((total, value, index) => total + value * [.2126, .7152, .0722][index], 0);
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
}

// Every API and external request is intercepted. No real user state or provider is used.
async function workspace(check, { handlers = {}, composer, language = 'en', fixtureProject = project, fixtureProjects } = {}) {
  const browser = await chromium.launch({ executablePath: chrome, headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(5000);
  const errors = [], writes = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(({ composer, language }) => {
    localStorage.setItem('orbit-language', language);
    localStorage.setItem('orbit-concierge-dismissed', 'true');
    if (composer) sessionStorage.setItem('orbit-agent-composer', JSON.stringify(composer));
  }, { composer, language });
  const fixtures = {
    '/api/health': { ok: true, providers }, '/api/projects': fixtureProjects || [fixtureProject], '/api/runs': [],
    '/api/profile': { name: 'Recovery Tester', role: 'Tester', workspace: 'Fixtures' },
    '/api/inbox': { count: 0, items: [] }, '/api/skills': [], '/api/models': { providers },
    '/api/skills/catalog': { local: [], recommended: [], recommendedSources: [] },
    '/api/ollama/status': { installed: false, running: false, models: [] },
    '/api/connections/telegram': { enabled: false, channelEnabled: true },
  };
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== inject('orbitBase')) return route.abort();
    if (!url.pathname.startsWith('/api/')) return route.continue();
    if (request.method() !== 'GET') writes.push({ path: url.pathname, body: request.postDataJSON() });
    if (handlers[url.pathname]) return handlers[url.pathname](route, request);
    return send(route, fixtures[url.pathname] ?? {}, request.method() === 'GET' ? 200 : 405);
  });
  try {
    await page.goto(inject('orbitBase'), { waitUntil: 'domcontentloaded' });
    await page.locator('.profile strong').getByText('Recovery Tester', { exact: true }).waitFor({ state: 'attached' });
    await check({ page, writes, fixtures });
    expect(errors).toEqual([]);
  } finally { await browser.close(); }
}
const agents = page => page.locator('.sidebar .nav-item').filter({ hasText: /^Agents$/ }).click();
const submit = page => page.locator('.run-form button[type="submit"]').click();

describe('Recoverable UI actions', () => {
  browserTest.each(['http', 'network'])('failed task update remains accurate through polling and retry: %s', async failure => {
    let attempts = 0;
    const pending = deferred();
    let saved = false;
    await workspace(async ({ page }) => {
      await page.clock.install();
      const task = page.locator('.overview-next .task-row');
      const completion = task.locator('.check');
      expect(await completion.getAttribute('aria-label')).toContain('Fixture task');
      await completion.click();
      await page.clock.fastForward(5001);
      pending.resolve();
      await page.getByRole('alert').waitFor();
      expect(await task.count()).toBe(1);
      expect(await page.locator('.metric-grid').innerText()).toContain('0%');
      await task.locator('.check').click();
      await expect.poll(() => task.count()).toBe(0);
      await page.clock.fastForward(5001);
      expect(await page.locator('.metric-grid').innerText()).toContain('100%');
    }, { handlers: {
      '/api/projects': route => send(route, [{ ...project, progress: saved ? 100 : 0, tasks: [['Fixture task', 'Today', saved]] }]),
      '/api/projects/recovery-project/tasks': async route => {
        if (++attempts === 1) { await pending.promise; return failure === 'network' ? route.abort() : send(route, { error: 'Could not save the fixture task.' }, 500); }
        saved = true; return send(route, { ...project, progress: 100, tasks: [['Fixture task', 'Today', true]] });
      },
    } });
  }, 30000);

  browserTest.each(['deleted', 'revoked'])('clears a %s selected skill after a successful library load', async kind => {
    await workspace(async ({ page, writes }) => {
      await agents(page);
      await page.getByText(/selected skill.*no longer available/i).waitFor();
      await submit(page);
      await expect.poll(() => writes.length).toBe(1);
      expect(writes[0].body.skillId).toBeUndefined();
      expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('orbit-agent-composer')).skillId)).toBe('');
    }, { composer: { projectId: project.id, prompt: 'Fixture instruction', skillId: 'old-skill' }, handlers: {
      '/api/skills': route => send(route, kind === 'deleted' ? [] : [{ id: 'old-skill', name: 'Old skill', status: 'pending_review' }]),
      '/api/runs': (route, request) => send(route, request.method() === 'POST' ? { provider: 'codex', routeReason: 'Fixture' } : [], request.method() === 'POST' ? 202 : 200),
    } });
  });

  browserTest.each(['remove', 'retry'])('a failed skill fetch preserves the saved selection and permits explicit %s', async recovery => {
    let skillRequests = 0;
    await workspace(async ({ page, writes }) => {
      await agents(page);
      await page.getByRole('button', { name: 'Retry skill library', exact: true }).waitFor();
      expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('orbit-agent-composer')).skillId)).toBe('old-skill');
      expect(await page.locator('.run-form button[type="submit"]').isDisabled()).toBe(true);
      if (recovery === 'remove') await page.getByRole('button', { name: 'Remove selected skill', exact: true }).click();
      else {
        await page.getByRole('button', { name: 'Retry skill library', exact: true }).click();
        await page.locator('.selected-skill-summary').waitFor();
      }
      await submit(page);
      await expect.poll(() => writes.length).toBe(1);
      expect(writes[0].body.skillId).toBe(recovery === 'remove' ? undefined : 'old-skill');
    }, { composer: { projectId: project.id, prompt: 'Fixture instruction', skillId: 'old-skill' }, handlers: {
      '/api/skills': route => ++skillRequests === 1 ? send(route, { error: 'Temporary skill library failure' }, 503) : send(route, [{ id: 'old-skill', name: 'Approved fixture', status: 'approved' }]),
      '/api/runs': (route, request) => send(route, request.method() === 'POST' ? { provider: 'codex', routeReason: 'Fixture' } : [], request.method() === 'POST' ? 202 : 200),
    } });
  });

  browserTest.each(['submit', 'optimize', 'retry'].flatMap(action => [false, true].map(editBack => ({ action, editBack }))))('late $action preserves the edited draft (edit away and back: $editBack)', async ({ action, editBack }) => {
    const pending = deferred(); let submissions = 0;
    await workspace(async ({ page, writes }) => {
      await agents(page);
      const prompt = page.locator('.run-form textarea');
      await prompt.fill('Original prompt');
      if (action === 'optimize') await page.locator('.optimize-button').click();
      else { await submit(page); if (action === 'retry') await page.locator('.collision-modal .new-button').click(); }
      await expect.poll(() => writes.length).toBe(action === 'retry' ? 2 : 1);
      await prompt.fill('Intermediate edit');
      const newerDraft = editBack ? 'Original prompt' : 'My newer draft';
      await prompt.fill(newerDraft);
      pending.resolve();
      if (action !== 'optimize') await page.locator('.run-notice').filter({ hasText: 'Fixture' }).waitFor();
      await expect.poll(() => page.locator('.run-form button[type="submit"]').isDisabled()).toBe(false);
      if (action === 'optimize') await expect.poll(() => page.locator('.optimize-button').isDisabled()).toBe(false);
      expect(await prompt.inputValue()).toBe(newerDraft);
      expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('orbit-agent-composer')).prompt)).toBe(newerDraft);
    }, { handlers: {
      '/api/runs': async (route, request) => {
        if (request.method() === 'GET') return send(route, []);
        if (action === 'retry' && ++submissions === 1) return send(route, { collisionDetected: true, activeRuns: [] }, 409);
        await pending.promise; return send(route, { provider: 'codex', routeReason: 'Fixture' }, 202);
      },
      '/api/prompts/optimize': async route => { await pending.promise; return send(route, { optimized: 'Optimized prompt', notice: 'Optimized', tokenSavingsEstimate: 5 }); },
    } });
  }, 30000);

  browserTest('unchanged submitted drafts clear after success', async () => {
    await workspace(async ({ page }) => {
      await agents(page); await page.locator('.run-form textarea').fill('Sent prompt'); await submit(page);
      await expect.poll(() => page.locator('.run-form textarea').inputValue()).toBe('');
    }, { handlers: { '/api/runs': (route, request) => send(route, request.method() === 'POST' ? { provider: 'codex', routeReason: 'Fixture' } : [], request.method() === 'POST' ? 202 : 200) } });
  });

  browserTest('an open review surface changes language immediately from React state', async () => {
    const inbox = {
      count: 1,
      readyCount: 1,
      needsAttentionCount: 0,
      items: [{
        id: 'localized-run', projectId: project.id, projectName: project.name,
        provider: 'codex', status: 'awaiting_review', gateStatus: 'verified_ready',
        mergeable: true, prompt: 'Verify the localized review surface.', changedFiles: ['src/example.jsx']
      }]
    };
    await workspace(async ({ page }) => {
      await expect.poll(() => page.locator('.inbox-trigger b').textContent()).toBe('1');
      await page.locator('.inbox-trigger').click();
      const dialog = page.locator('.executive-inbox');
      await dialog.locator('.gate-badge').filter({ hasText: 'Verified Ready' }).waitFor();
      await page.evaluate(() => document.querySelector('.language-switcher').click());
      await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe('es');
      await dialog.locator('.gate-badge').filter({ hasText: 'Verificado y listo' }).waitFor();
      await expect.poll(async () => (await dialog.locator('.inbox-files > strong').innerText()).toLowerCase()).toContain('1 archivo modificado');
      expect(await dialog.locator('.close').getAttribute('aria-label')).toBe('Cerrar bandeja');
    }, { handlers: { '/api/inbox': route => send(route, inbox) } });
  });

  browserTest('Project Brain ignores an older project response after the editor changes projects', async () => {
    const firstMemory = deferred();
    const secondMemory = deferred();
    const alpha = { ...project, id: 'brain-alpha', name: 'Brain Alpha' };
    const beta = { ...project, id: 'brain-beta', name: 'Brain Beta' };
    await workspace(async ({ page }) => {
      await page.locator('.project-card').filter({ hasText: 'Brain Alpha' }).click();
      await page.getByRole('button', { name: 'Brain', exact: true }).click();
      await page.getByRole('button', { name: 'Close Project Brain', exact: true }).click();
      await page.getByRole('button', { name: 'Close project details', exact: true }).click();

      await page.locator('.project-card').filter({ hasText: 'Brain Beta' }).click();
      await page.getByRole('button', { name: 'Brain', exact: true }).click();
      secondMemory.resolve();
      await expect.poll(() => page.locator('.brain-editor').inputValue()).toBe('BETA RULES');
      firstMemory.resolve();
      await page.waitForTimeout(50);
      expect(await page.locator('.brain-editor').inputValue()).toBe('BETA RULES');
      expect(await page.locator('.project-brain-modal').getAttribute('aria-label')).toContain('Brain Beta');
    }, {
      fixtureProjects: [alpha, beta],
      handlers: {
        '/api/projects/brain-alpha/memory': async route => { await firstMemory.promise; return send(route, { ok: true, projectId: alpha.id, path: 'PROJECT_MEMORY.md', exists: true, content: 'ALPHA RULES' }); },
        '/api/projects/brain-beta/memory': async route => { await secondMemory.promise; return send(route, { ok: true, projectId: beta.id, path: 'PROJECT_MEMORY.md', exists: true, content: 'BETA RULES' }); },
      }
    });
  }, 30000);

  browserTest('comparison loading and error states trap focus, retry, close and restore focus', async () => {
    const pending = deferred(); let gets = 0;
    await workspace(async ({ page }) => {
      await agents(page); await page.locator('.execution-options summary').click(); await page.locator('.mode-toggle-btn').nth(1).click();
      await page.locator('.run-form textarea').fill('Compare models'); await submit(page);
      const dialog = page.locator('.comparator-modal'); await dialog.waitFor();
      expect(await page.evaluate(() => Boolean(document.activeElement?.closest('.comparator-modal')))).toBe(true);
      await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
      expect(await page.evaluate(() => Boolean(document.activeElement?.closest('.comparator-modal')))).toBe(true);
      pending.resolve(); await dialog.getByRole('alert').waitFor();
      await dialog.getByRole('button', { name: 'Retry', exact: true }).click();
      await dialog.getByText('All models finished.', { exact: true }).waitFor();
      await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });
      expect(await page.evaluate(() => Boolean(document.activeElement?.closest('.run-form')))).toBe(true);
    }, { handlers: {
      '/api/runs/parallel': route => send(route, { groupId: 'fixture-group', runs: [{ id: 'one' }, { id: 'two' }] }, 202),
      '/api/runs/group/fixture-group': async route => { if (++gets === 1) { await pending.promise; return send(route, { error: 'Comparison temporarily unavailable' }, 503); } return send(route, { done: true, runs: [{ id: 'one', projectName: project.name, status: 'completed', result: 'Fixture result' }] }); },
    } });
  }, 30000);
});

describe('Responsive workspace and setup forms', () => {
  browserTest('project tabs and lower controls remain reachable at narrow and short sizes', async () => {
    await workspace(async ({ page }) => {
      for (const [width, height] of [[375, 667], [375, 812], [768, 1024], [1024, 700], [320, 568]]) {
        await page.setViewportSize({ width, height });
        await page.locator('.project-card').click();
        const modal = page.locator('.project-workspace-modal'), tabs = modal.locator('.project-workspace-tabs');
        expect(await modal.evaluate(element => element.scrollHeight <= element.clientHeight + 1)).toBe(true);
        expect(await tabs.evaluate(element => element.scrollHeight <= element.clientHeight + 1)).toBe(true);
        for (const button of await tabs.locator('button').all()) {
          await button.focus(); await button.click();
          const bounds = await button.boundingBox();
          expect(bounds.height).toBeGreaterThanOrEqual(38);
          expect(bounds.y).toBeGreaterThanOrEqual(0); expect(bounds.y + bounds.height).toBeLessThanOrEqual(height);
          expect(await button.evaluate(element => { const r = element.getBoundingClientRect(); return element.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); })).toBe(true);
        }
        const last = modal.getByRole('button', { name: 'Remove project…', exact: true });
        await last.focus(); await last.scrollIntoViewIfNeeded();
        const bounds = await last.boundingBox(); expect(bounds.y + bounds.height).toBeLessThanOrEqual(height);
        await page.keyboard.press('Escape'); await modal.waitFor({ state: 'detached' });
      }
    }, { fixtureProject: { ...project, name: 'A deliberately long project title to verify modal reflow and keyboard navigation', summary: 'Long fixture description. '.repeat(8) } });
  }, 60000);

  browserTest('dark theme changes computed surfaces and text and survives reload', async () => {
    await workspace(async ({ page }) => {
      const colors = () => page.evaluate(() => { const style = getComputedStyle(document.body); return { background: style.backgroundColor, ink: style.color }; });
      const light = await colors(); await page.locator('.theme-switcher').click();
      await expect.poll(colors).not.toEqual(light);
      const dark = await colors();
      expect(dark.background).toBe('rgb(14, 17, 17)'); expect(dark.ink).toBe('rgb(245, 245, 247)');
      expect(await page.locator('.sidebar').evaluate(element => getComputedStyle(element).backgroundColor)).toContain('20, 22, 25');
      await page.reload(); await page.locator('.profile strong').getByText('Recovery Tester', { exact: true }).waitFor(); expect(await colors()).toEqual(dark);
      for (const label of ['Overview', 'Agents', 'Settings']) {
        await page.locator('.sidebar .nav-item').filter({ hasText: new RegExp('^' + label + '$') }).click();
        const surface = page.locator(label === 'Overview' ? '.metric' : '.panel').first();
        expect(await surface.evaluate(element => getComputedStyle(element).color)).toBe(dark.ink);
        expect(await surface.evaluate(element => getComputedStyle(element).backgroundColor)).toContain('28, 30, 33');
        if (label !== 'Overview') {
          const input = page.locator(label === 'Agents' ? '.run-form textarea' : '.profile-form input').first();
          expect(await input.evaluate(contrastRatio)).toBeGreaterThanOrEqual(4.5);
        }
      }
      await page.locator('.sidebar .nav-item').filter({ hasText: /^Overview$/ }).click(); await page.locator('.project-card').click();
      expect(await page.locator('.project-workspace-modal').evaluate(element => getComputedStyle(element).color)).toBe(dark.ink);
      expect(await page.locator('.project-workspace-modal .close').evaluate(contrastRatio)).toBeGreaterThanOrEqual(4.5);
      await page.keyboard.press('Escape');
      await page.locator('.sidebar .nav-item').filter({ hasText: /^Settings$/ }).click();
      expect(await page.locator('.telegram-id-field button').evaluate(contrastRatio)).toBeGreaterThanOrEqual(4.5);
    });
  }, 30000);

  browserTest.each(['en', 'es'])('initial Telegram form fits its card and preserves keyboard access in %s', async language => {
    await workspace(async ({ page, writes }) => {
      await page.locator('.sidebar .nav-item').filter({ hasText: language === 'en' ? /^Settings$/ : /^Ajustes$/ }).click();
      const form = page.locator('.telegram-form'); await form.waitFor();
      for (const width of [375, 768, 900, 901, 1024, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await form.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
        for (const control of await form.locator('input, button').all()) {
          await control.focus(); await control.scrollIntoViewIfNeeded();
          expect(await control.evaluate(element => { const box = element.getBoundingClientRect(), card = element.closest('.telegram-settings').getBoundingClientRect(); return box.width > 10 && box.left >= card.left && box.right <= card.right; })).toBe(true);
        }
        expect(await form.locator('input[type="checkbox"]').evaluate(element => element.getBoundingClientRect().width)).toBeLessThanOrEqual(24);
      }
      expect(writes).toEqual([]);
    }, { language });
  }, 60000);
});

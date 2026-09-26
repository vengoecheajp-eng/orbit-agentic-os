import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { describe, expect, inject, it } from 'vitest';

const chrome = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
if (process.env.CI && !existsSync(chrome)) throw new Error(`CI browser was not found at ${chrome}. Set CHROME_BIN after installing Chromium.`);
const browserTest = it.runIf(existsSync(chrome));
const project = {
  id: 'workflow-project', name: 'Workflow Lab', kind: 'Web app', color: 'green',
  status: 'In progress', progress: 20, owner: 'WT', mode: 'connected',
  summary: 'An isolated browser fixture.', next: 'Improve navigation',
  repoPath: '/test-only/workflow', tasks: [['Improve navigation', 'Engineering', false]],
};
const providers = [
  { id: 'codex', label: 'Codex', available: true, mode: 'write', activeModel: 'codex-test', models: [{ id: 'codex-test', label: 'Codex test model' }] },
  { id: 'local', label: 'Local · Ollama', available: true, installed: true, ready: true, mode: 'write', activeModel: 'hermes3:latest', models: [{ id: 'hermes3:latest', label: 'Hermes 3' }, { id: 'qwen2.5-coder:14b', label: 'Qwen Coder' }] },
];
function makeRun(id = 'review-run', overrides = {}) {
  return { id, projectId: project.id, projectName: project.name, prompt: 'Inspect browser navigation', provider: 'codex', model: 'codex-test', status: 'running', createdAt: '2026-01-01T12:00:00.000Z', steps: [], messages: [], changedFiles: [], ...overrides };
}

// Every API request is intercepted: these scenarios never launch agents, write
// to a contributor's profile, download models, or contact the real control plane.
async function withWorkspace(check, { runs = [makeRun()], handlers = {}, viewport = { width: 1280, height: 900 } } = {}) {
  const browser = await chromium.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport });
  // Exercise fallback fonts too: local Orbit must remain usable offline, and
  // browser verification must not depend on Google's font response timing.
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route('https://fonts.gstatic.com/**', route => route.abort());
  page.setDefaultTimeout(5000);
  const errors = [];
  const writes = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('orbit-language', 'en');
    localStorage.setItem('orbit-concierge-dismissed', 'true');
  });
  const fixtures = {
    '/api/health': { ok: true, providers },
    '/api/projects': [project],
    '/api/runs': runs,
    '/api/profile': { name: 'Workflow Tester', role: 'Tester', workspace: 'Browser fixtures', initials: 'WT' },
    '/api/inbox': { count: 0, readyCount: 0, needsAttentionCount: 0, items: [] },
    '/api/skills': [],
    '/api/ollama/status': { installed: true, running: true, models: ['hermes3:latest', 'qwen2.5-coder:14b'], activeModel: 'hermes3:latest' },
    '/api/local-coding-mode': { mode: 'strict' },
  };
  await page.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    if (!['GET', 'HEAD'].includes(method)) writes.push({ path, method, body: request.postDataJSON() });
    if (handlers[path]) return handlers[path](route, request);
    const data = fixtures[path] ?? runs.find(run => path === `/api/runs/${run.id}`) ?? {};
    return route.fulfill({ status: method === 'GET' ? 200 : 405, contentType: 'application/json', body: JSON.stringify(data) });
  });
  try {
    await page.goto(inject('orbitBase'), { waitUntil: 'domcontentloaded' });
    await page.locator('.profile strong').filter({ hasText: 'Workflow Tester' }).waitFor({ state: 'attached' });
    await check({ page, errors, writes });
    expect(errors).toEqual([]);
  } finally { await browser.close(); }
}

async function openSearch(page, text) {
  await page.keyboard.press('Control+k');
  const input = page.locator('.command-modal input');
  await input.waitFor();
  await input.fill(text);
  return input;
}

describe('Orbit keyboard and agent workflow regressions', () => {
  browserTest('overview prioritizes replies and distinguishes task completion from readiness', async () => {
    const runs = [makeRun('busy'), makeRun('waiting', { status: 'awaiting_input', prompt: 'Please approve dependency setup' })];
    await withWorkspace(async ({ page, writes }) => {
      expect(await page.locator('.attention-priority').innerText()).toContain('Please approve dependency setup');
      expect(await page.locator('.global-agent-dock-title').innerText()).toBe('1 waiting for you · 1 running');
      expect(await page.locator('.metric-grid').innerText()).toContain('Task completion');
      expect(await page.locator('.metric-grid').innerText()).not.toContain('pending this week');
      await page.locator('.attention-priority').getByRole('button', { name: 'Reply', exact: true }).click();
      await page.locator('.run-monitor').waitFor();
      expect(writes).toEqual([]);
    }, { runs });
  }, 30000);

  browserTest('activity shows task names, exact models and searchable older history', async () => {
    const runs = Array.from({ length: 16 }, (_, index) => makeRun('history-' + index, { status: 'merged', prompt: 'Distinct task ' + index, routeReason: 'Provider chosen manually.' }));
    runs.push(makeRun('unverified', { status: 'awaiting_review', prompt: 'Unverified task' }));
    runs.push(makeRun('verified', { status: 'awaiting_review', gateStatus: 'verified_ready', prompt: 'Verified task' }));
    await withWorkspace(async ({ page, writes }) => {
      await page.locator('.sidebar .nav-item').filter({ hasText: /^Agents$/ }).click();
      const activity = page.locator('.work-activity');
      expect(await activity.innerText()).not.toContain('Provider chosen manually.');
      expect(await activity.innerText()).toContain('codex-test');
      expect(await page.locator('.provider-panel').getAttribute('open')).toBe(null);
      expect(await page.locator('.agent-console .connection-card').count()).toBe(0);
      await activity.getByLabel('Search activity').fill('Distinct task 15');
      expect(await activity.locator('.work-row').count()).toBe(1);
      await activity.getByLabel('Search activity').fill('');
      await activity.locator('.activity-filters button').filter({ hasText: /^Ready for review/ }).click();
      expect(await activity.locator('.work-row').count()).toBe(1);
      expect(await activity.locator('.work-row').innerText()).toContain('Verified task');
      await activity.getByLabel('Filter by project').selectOption(project.id);
      expect(await activity.locator('.work-row').count()).toBe(1);
      expect(writes).toEqual([]);
    }, { runs });
  }, 30000);

  browserTest('repository editing is available in project settings and reports save failures', async () => {
    await withWorkspace(async ({ page, writes }) => {
      await page.locator('.sidebar .nav-item').filter({ hasText: /^Projects/ }).click();
      await page.locator('.project-open-button').click();
      const workspace = page.locator('.project-workspace-modal');
      await workspace.getByRole('button', { name: 'Settings', exact: true }).click();
      const editor = workspace.locator('.project-connection-editor');
      await editor.getByLabel('Local repository path (for agent runs)', { exact: true }).fill('/test-only/updated');
      expect(writes).toEqual([]);
      await editor.getByRole('button', { name: 'Save', exact: true }).click();
      await editor.getByText('Invalid repository fixture', { exact: true }).waitFor();
      expect(writes).toHaveLength(1);
      expect(writes[0].body.repoPath).toBe('/test-only/updated');
      expect(await editor.getByLabel('Local repository path (for agent runs)', { exact: true }).inputValue()).toBe('/test-only/updated');
    }, { handlers: { '/api/projects/workflow-project': route => route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Invalid repository fixture' }) }) } });
  }, 30000);

  browserTest('all navigation sections remain reachable on a narrow screen', async () => {
    await withWorkspace(async ({ page, writes }) => {
      const navigation = page.locator('.compact-navigation');
      expect(await navigation.isVisible()).toBe(true);
      expect(await navigation.getByRole('button').count()).toBe(6);
      expect(await navigation.getByRole('button', { name: 'Tasks', exact: true }).count()).toBe(0);
      await navigation.getByRole('button', { name: 'Agents', exact: true }).click();
      await page.locator('.run-form textarea').waitFor();
      const bounds = await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth,
        overflowing: [...document.querySelectorAll('main *')].filter(element => element.getBoundingClientRect().right > innerWidth + 1).map(element => `${element.tagName}.${element.className}`).slice(0, 20) }));
      expect(bounds.content, JSON.stringify(bounds.overflowing)).toBeLessThanOrEqual(bounds.width + 1);
      await page.getByRole('button', { name: 'Keyboard shortcuts', exact: true }).click();
      await page.getByRole('heading', { name: 'Keyboard shortcuts', exact: true }).waitFor();
      await page.keyboard.press('Escape');
      expect(await page.locator('.shortcut-modal').count()).toBe(0);
      expect(writes).toEqual([]);
    }, { viewport: { width: 390, height: 844 } });
  }, 30000);

  browserTest('project workspaces group task state and explain a selected task', async () => {
    const reviewRun = makeRun('task-review-run', {
      status: 'awaiting_review',
      taskIndex: 0,
      taskTitle: 'Improve navigation',
      prompt: 'Improve navigation',
    });
    const unrelatedRun = makeRun('unrelated-run', {
      status: 'running',
      taskIndex: 8,
      taskTitle: 'Unrelated task',
      prompt: 'An unrelated task should not change this task state',
    });
    await withWorkspace(async ({ page, writes }) => {
      await page.locator('.sidebar .nav-item').filter({ hasText: /^Projects/ }).click();
      await page.locator('.project-open-button').click();
      const workspace = page.locator('.project-workspace-modal');
      await workspace.getByRole('button', { name: 'Tasks', exact: true }).click();
      await workspace.getByText('Needs attention', { exact: true }).waitFor();
      await workspace.getByRole('button', { name: 'In review', exact: true }).waitFor();
      await workspace.locator('.task-details-trigger').click();
      await page.locator('.task-detail-modal').waitFor();
      await page.getByText('Make the navigation easier to use.', { exact: true }).waitFor();
      expect(writes).toEqual([]);
    }, {
      runs: [reviewRun, unrelatedRun],
      handlers: {
        '/api/projects/workflow-project/tasks/0/explain': route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ task: { description: 'Make the navigation easier to use.', purpose: 'Keep project work easy to find.', due: 'Engineering', completed: false } }) }),
      },
    });
  }, 30000);

  browserTest('project settings remove only the Orbit record after explicit confirmation', async () => {
    await withWorkspace(async ({ page, writes }) => {
      await page.locator('.sidebar .nav-item').filter({ hasText: /^Projects/ }).click();
      await page.locator('.project-open-button').click();
      const workspace = page.locator('.project-workspace-modal');
      await workspace.getByRole('button', { name: 'Settings', exact: true }).click();
      await workspace.getByRole('button', { name: 'Remove project…', exact: true }).click();
      expect(writes).toEqual([]);
      await workspace.getByText('Your local folder, source files, Git history, and GitHub repository will remain untouched.', { exact: false }).waitFor();
      await workspace.getByRole('button', { name: 'Yes, remove from Orbit', exact: true }).click();
      await expect.poll(() => writes.filter(write => write.path === '/api/projects/workflow-project' && write.method === 'DELETE').length).toBe(1);
    }, { handlers: {
      '/api/projects/workflow-project': (route, request) => route.fulfill({ status: request.method() === 'DELETE' ? 200 : 405, contentType: 'application/json', body: JSON.stringify({ ok: true, removed: project.name }) })
    } });
  }, 30000);

  browserTest('Settings renders provider model objects before the Ollama status response arrives', async () => {
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    try {
      await withWorkspace(async ({ page }) => {
        await page.locator('.sidebar .nav-item').filter({ hasText: /^Settings$/ }).click();
        await page.locator('.onboarding-hub').waitFor();
        expect(await page.locator('.onboarding-hub').innerText()).toContain('hermes3:latest');
        expect(await page.locator('.onboarding-hub').innerText()).toContain('qwen2.5-coder:14b');
        release();
      }, { handlers: { '/api/ollama/status': async route => {
        await pending;
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ installed: true, running: true, models: ['hermes3:latest'] }) });
      } } });
    } finally { release(); }
  }, 30000);

  browserTest('agent drafts and exact-model choices survive navigation without submitting on Enter', async () => {
    await withWorkspace(async ({ page, writes }) => {
      const agents = page.locator('.sidebar .nav-item').filter({ hasText: /^Agents$/ });
      await agents.click();
      await page.locator('.run-form textarea').fill('Keep this draft');
      await page.locator('.run-form select').nth(1).selectOption('local');
      await page.locator('.run-model-select select').selectOption('hermes3:latest');
      await page.getByRole('radio', { name: /Code in an isolated worktree/ }).check();
      await page.locator('.run-form textarea').press('End');
      await page.locator('.run-form textarea').press('Enter');
      await page.locator('.sidebar .nav-item').filter({ hasText: /^Overview$/ }).click();
      await agents.click();
      expect(await page.locator('.run-form textarea').inputValue()).toBe('Keep this draft\n');
      expect(await page.locator('.run-form select').first().inputValue()).toBe(project.id);
      expect(await page.locator('.run-form select').nth(1).inputValue()).toBe('local');
      expect(await page.locator('.run-model-select select').inputValue()).toBe('hermes3:latest');
      expect(await page.getByRole('radio', { name: /Code in an isolated worktree/ }).isChecked()).toBe(true);
      expect(writes).toEqual([]);
    });
  }, 30000);

  browserTest('an explicit local code run sends isolated write permission', async () => {
    await withWorkspace(async ({ page, writes }) => {
      await page.locator('.sidebar .nav-item').filter({ hasText: /^Agents$/ }).click();
      await page.locator('.run-form select').nth(1).selectOption('local');
      await page.getByRole('radio', { name: /Code in an isolated worktree/ }).check();
      await page.locator('.run-form textarea').fill('Update the dashboard heading');
      await page.locator('.run-form').getByRole('button', { name: 'Send to agent', exact: true }).click();
      await expect.poll(() => writes.filter(write => write.path === '/api/runs').length).toBe(1);
      expect(writes.find(write => write.path === '/api/runs').body).toMatchObject({ provider: 'local', localWrite: true });
    }, { runs: [], handlers: {
      '/api/runs': (route, request) => route.fulfill({ status: request.method() === 'POST' ? 202 : 200, contentType: 'application/json', body: JSON.stringify(request.method() === 'POST' ? { id: 'local-write-run', provider: 'local', routeReason: 'Explicit local worktree coding' } : []) }),
      '/api/runs/local-write-run': route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(makeRun('local-write-run', { provider: 'local', status: 'running' })) })
    } });
  }, 30000);

  browserTest('comparison slots can submit two different installed Ollama models', async () => {
    await withWorkspace(async ({ page, writes }) => {
      await page.locator('.sidebar .nav-item').filter({ hasText: /^Agents$/ }).click();
      await page.locator('.execution-options summary').click();
      await page.locator('.mode-toggle-btn').nth(1).click();
      await page.getByRole('combobox', { name: 'Provider for slot 1' }).selectOption('local');
      await page.getByRole('combobox', { name: 'Provider for slot 2' }).selectOption('local');
      const slots = page.locator('.parallel-model-row');
      await slots.nth(0).locator('.run-model-select select').selectOption('hermes3:latest');
      await slots.nth(1).locator('.run-model-select select').selectOption('qwen2.5-coder:14b');
      await page.locator('.run-form textarea').fill('Create a dashboard');
      await page.locator('.run-form').getByRole('button', { name: 'Send to agent', exact: true }).click();
      await expect.poll(() => writes.length).toBe(1);
      expect(writes[0].body).toMatchObject({ executionMode: 'code', selections: [{ provider: 'local', model: 'hermes3:latest' }, { provider: 'local', model: 'qwen2.5-coder:14b' }] });
    }, { runs: [], handlers: { '/api/runs/parallel': route => route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ runs: [{ id: 'one' }, { id: 'two' }] }) }) } });
  }, 30000);

  browserTest('custom future model IDs can be entered without changing the provider', async () => {
    await withWorkspace(async ({ page, writes }) => {
      await page.locator('.sidebar .nav-item').filter({ hasText: /^Agents$/ }).click();
      await page.locator('.run-form select').nth(1).selectOption('codex');
      await page.locator('.run-model-select select').selectOption('__custom__');
      await page.getByRole('textbox', { name: 'Custom model ID' }).fill('future-codex-model');
      expect(await page.locator('.run-model-select select').inputValue()).toBe('future-codex-model');
      expect(writes).toEqual([]);
    });
  }, 30000);

  browserTest('search opens a run with either a click or Enter', async () => {
    const run = makeRun('search-run', { prompt: 'Unique navigation investigation' });
    await withWorkspace(async ({ page, writes }) => {
      await openSearch(page, 'Unique navigation');
      await page.locator('.command-results [role="option"]').click();
      await page.locator('.run-monitor').waitFor();
      expect(await page.locator('.run-monitor h2').textContent()).toBe(project.name);
      await page.keyboard.press('Escape');
      await page.locator('.run-monitor').waitFor({ state: 'detached' });
      const search = await openSearch(page, 'Unique navigation');
      await search.press('Enter');
      await page.locator('.run-monitor').waitFor();
      expect(await page.locator('.command-modal').count()).toBe(0);
      expect(writes).toEqual([]);
    }, { runs: [run] });
  }, 30000);

  browserTest('a paused run has one reply composer and keeps its draft after a rejected reply', async () => {
    const run = makeRun('paused-run', { status: 'awaiting_input', question: '"Choose a color\\nBlue or green?"' });
    await withWorkspace(async ({ page, writes }) => {
      await page.locator('.global-agent-run').click();
      const monitor = page.locator('.run-monitor');
      await monitor.waitFor();
      expect(await monitor.locator('textarea').count()).toBe(1);
      expect(await monitor.locator('.chat-composer-question').innerText()).toContain('Choose a color\nBlue or green?');
      const composer = monitor.locator('textarea');
      await composer.fill('Use blue, please');
      await composer.press('Control+Enter');
      await page.getByText('Mock reply unavailable', { exact: true }).waitFor();
      expect(await composer.inputValue()).toBe('Use blue, please');
      expect(writes).toEqual([{ path: '/api/runs/paused-run/reply', method: 'POST', body: { reply: 'Use blue, please' } }]);
      await composer.press('Escape');
      await monitor.waitFor({ state: 'detached' });
      await page.locator('.global-agent-run').click();
      await monitor.waitFor();
      expect(await monitor.locator('textarea').inputValue()).toBe('Use blue, please');
    }, { runs: [run], handlers: { '/api/runs/paused-run/reply': route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Mock reply unavailable' }) }) } });
  }, 30000);

  browserTest('closing a pending run prevents its late fetch from reopening the monitor', async () => {
    const run = makeRun('delayed-run');
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    let started;
    const requestStarted = new Promise(resolve => { started = resolve; });
    let handled;
    const responseHandled = new Promise(resolve => { handled = resolve; });
    try {
      await withWorkspace(async ({ page }) => {
        await page.locator('.global-agent-run').click();
        await page.getByText('Opening agent…', { exact: true }).waitFor();
        await requestStarted;
        await page.getByRole('button', { name: 'Close run monitor', exact: true }).click();
        release();
        await responseHandled;
        // A browser turn after the late response allows any stale state update
        // to render; there must still be no loading dialog or run monitor.
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        expect(await page.locator('.run-monitor').count()).toBe(0);
        expect(await page.getByText('Opening agent…', { exact: true }).count()).toBe(0);
        expect(await page.locator('.global-agent-run').isVisible()).toBe(true);
      }, { runs: [run], handlers: { '/api/runs/delayed-run': async route => {
        started();
        await pending;
        try { await route.fulfill({ contentType: 'application/json', body: JSON.stringify(run) }); } catch {} finally { handled(); }
      } } });
    } finally { release(); }
  }, 30000);

  browserTest('the dock overflow opens every active agent including the fourth run', async () => {
    const runs = Array.from({ length: 4 }, (_, index) => makeRun(`dock-${index}`, { projectName: `Fixture project ${index + 1}`, prompt: `Work item ${index + 1}` }));
    await withWorkspace(async ({ page, writes }) => {
      await page.locator('.global-agent-more').click();
      const list = page.locator('.run-navigation-modal');
      await list.waitFor();
      expect(await list.locator('.run-row').count()).toBe(4);
      await list.locator('.run-row').filter({ hasText: 'Fixture project 4' }).click();
      await page.locator('.run-monitor').waitFor();
      expect(await page.locator('.run-monitor h2').textContent()).toBe('Fixture project 4');
      expect(writes).toEqual([]);
    }, { runs });
  }, 30000);

  browserTest('Projects stays scannable and reveals project tools through clear workspace tabs', async () => {
    await withWorkspace(async ({ page, writes }) => {
      await page.locator('.sidebar .nav-item').filter({ hasText: /^Projects/ }).click();
      const card = page.locator('.compact-project-hub');
      await card.waitFor();
      expect(await card.locator('input').count()).toBe(0);
      expect(await card.innerText()).toContain('Improve navigation');
      expect(await page.getByRole('button', { name: 'Open project', exact: true }).count()).toBe(1);

      await page.getByRole('button', { name: 'Open project', exact: true }).click();
      const workspace = page.locator('.project-workspace-modal');
      await workspace.waitFor();
      expect(await workspace.locator('.project-workspace-tabs button').allTextContents()).toEqual(['Overview', 'Tasks', 'Workflows', 'Model Lab', 'Preview & delivery', 'Launch review', 'Settings']);
      await workspace.getByRole('button', { name: 'Tasks', exact: true }).click();
      await workspace.getByText('Improve navigation', { exact: true }).waitFor();
      await workspace.getByRole('button', { name: 'Preview & delivery', exact: true }).click();
      await workspace.locator('.project-tool-grid').waitFor();
      expect(await workspace.locator('.project-tool-grid > button').count()).toBeGreaterThanOrEqual(5);
      expect(writes).toEqual([]);
    }, { runs: [] });
  }, 30000);
});

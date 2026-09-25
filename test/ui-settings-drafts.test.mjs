import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { describe, expect, inject, it } from 'vitest';

const chrome = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const available = existsSync(chrome);
if (process.env.CI && !available) throw new Error(`CI browser was not found at ${chrome}. Set CHROME_BIN after installing Chromium.`);

// All API traffic is intercepted: these tests never alter a real profile,
// connect providers, install skills, or invoke a model.
async function workspace() {
  const browser = await chromium.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(5000);
  const state = {
    profile: { name: 'UI Test Profile', role: 'Tester', workspace: 'Test workspace' },
    savedProfiles: [], memory: '# Project rules\nKeep the existing authentication.', memoryActions: [],
    unexpectedWrites: [],
  };
  state.securityCenter = {
    gate: { status: 'yellow', label: 'Human review required', summary: 'Review local evidence.', blocked: [], warnings: [{}] },
    snapshot: { id: 'security-fixture', generatedAt: '2026-09-25T12:00:00.000Z' },
    repository: { coverage: { incomplete: false } },
    privacyReview: { evidenceFingerprint: 'privacy-evidence-fixture', valid: false },
    runtime: { orbitBoundToLoopback: true, firewall: { status: 'enabled' }, fileVault: { status: 'enabled' }, activeTunnels: [] },
    frameworkMappings: [],
    checks: [
      { id: 'secrets', title: 'Secrets and configuration hygiene', status: 'pass', detail: 'No exposed secret found.', evidence: [] },
      { id: 'dependencies', title: 'Dependency and build configuration', status: 'stale', detail: 'Refresh required.', evidence: [] },
      { id: 'privacy', title: 'Privacy, terms, and data-handling readiness', status: 'needs_review', detail: 'Record the responsible review.', evidence: [] },
      { id: 'exposure', title: 'Mac and preview exposure', status: 'pass', detail: 'Loopback only.', evidence: [] },
    ]
  };
  const project = { id: 'ui-draft-project', name: 'Draft Project', kind: 'Web app', status: 'In progress', progress: 10, color: 'mint', owner: 'UT', summary: 'A deterministic browser fixture.', next: 'Review the first screen', tasks: [], mode: 'connected', repoPath: '/test-fixture/project' };
  const skill = { id: 'review-fixture', name: 'Review Fixture', status: 'pending_review', description: 'Fixture instructions for review.', systemPrompt: 'Describe the requested change.', contentHash: 'abc123', warningFlags: [] };
  await page.addInitScript(() => {
    localStorage.setItem('orbit-language', 'en');
    localStorage.setItem('orbit-concierge-dismissed', 'true');
  });
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname, method = request.method();
    const send = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/api/profile') {
      if (method === 'PUT') { state.profile = request.postDataJSON(); state.savedProfiles.push(state.profile); }
      return send(state.profile);
    }
    if (path === `/api/projects/${project.id}/memory` && method === 'PUT') {
      state.memory = request.postDataJSON().content; state.memoryActions.push({ action: 'save', content: state.memory });
      return send({ ok: true });
    }
    if (path === `/api/projects/${project.id}/memory/refresh` && method === 'POST') {
      state.memoryActions.push({ action: 'scan', content: state.memory }); state.memory += '\n## Stack\nReact';
      return send({ ok: true });
    }
    if (path === `/api/projects/${project.id}/security-center`) {
      if (method === 'POST') return send({ center: state.securityCenter, refreshError: 'Dependency audit service was unavailable; the last completed report is still shown.' });
      return send(state.securityCenter);
    }
    if (path === `/api/projects/${project.id}/security-center/privacy-review` && method === 'PUT') {
      state.securityCenter = { ...state.securityCenter, gate: { ...state.securityCenter.gate, status: 'green', label: 'Technical checks clear', warnings: [] }, privacyReview: { evidenceFingerprint: 'privacy-evidence-fixture', valid: true }, checks: state.securityCenter.checks.map(check => check.id === 'privacy' ? { ...check, status: 'pass', detail: 'Review recorded.' } : check) };
      return send({ ok: true, center: state.securityCenter });
    }
    if (path === '/api/skills/review-fixture/approve' && method === 'POST') return send({ error: 'The reviewed file changed. Inspect it again before approval.' }, 409);
    if (method !== 'GET') { state.unexpectedWrites.push(`${method} ${path}`); return send({ error: 'Unexpected test mutation' }, 500); }
    const responses = {
      '/api/health': { ok: true, providers: [] }, '/api/projects': [project], '/api/runs': [],
      '/api/inbox': { count: 0, readyCount: 0, needsAttentionCount: 0, items: [] },
      '/api/skills': [skill], '/api/skills/review-fixture': skill,
      '/api/skills/catalog': { local: [], recommended: [], recommendedSources: [] },
      '/api/ollama/status': { running: true, installed: true, models: [{ name: 'hermes3:latest' }], pullState: { pulling: false } },
      '/api/local-coding-mode': { mode: 'strict' },
      '/api/connections/telegram': { enabled: false, channelEnabled: true },
      '/api/connections/whatsapp': { enabled: false, channelEnabled: true },
      '/api/capabilities/media': { voice: { ready: false }, vision: { ready: false } },
      [`/api/projects/${project.id}/summary-brief`]: { description: project.summary, completed: [], pending: [] },
      [`/api/projects/${project.id}/memory`]: { ok: true, projectId: project.id, path: 'PROJECT_MEMORY.md', exists: true, content: state.memory },
    };
    return send(responses[path] ?? {});
  });
  await page.goto(inject('orbitBase'), { waitUntil: 'domcontentloaded' });
  await page.locator('.project-card').filter({ hasText: 'Draft Project' }).waitFor();
  return { browser, page, state };
}

describe('Settings and review draft regressions', () => {
  it.runIf(available)('keeps profile edits through refresh/navigation and saves with the keyboard', async () => {
    const { browser, page, state } = await workspace();
    try {
      await page.locator('.nav-item').filter({ hasText: 'Settings' }).click();
      const name = page.locator('.profile-form input[name="name"]');
      await name.fill('My unsaved profile');
      state.profile = { ...state.profile, name: 'Refreshed server profile' };
      await expect.poll(() => page.getByRole('heading', { name: 'Refreshed server profile', exact: true }).count(), { timeout: 8000 }).toBe(1);
      expect(await name.inputValue()).toBe('My unsaved profile');
      await page.locator('.nav-item').filter({ hasText: 'Overview' }).click();
      await page.locator('.nav-item').filter({ hasText: 'Settings' }).click();
      expect(await name.inputValue()).toBe('My unsaved profile');
      await name.focus();
      await page.keyboard.press('Control+s');
      await expect.poll(() => state.savedProfiles.length).toBe(1);
      expect(state.savedProfiles[0].name).toBe('My unsaved profile');
      await expect.poll(() => page.evaluate(() => sessionStorage.getItem('orbit-profile-draft'))).toBe(null);
      expect(state.unexpectedWrites).toEqual([]);
    } finally { await browser.close(); }
  }, 30000);

  it.runIf(available)('closes only the top Brain dialog and preserves its rules through reopen and rescan', async () => {
    const { browser, page, state } = await workspace();
    try {
      await page.locator('.project-card').click();
      await page.getByRole('button', { name: 'Brain', exact: true }).click();
      const editor = page.locator('.brain-editor');
      await editor.fill('# My edited rules\nPreserve billing behavior.');
      await page.keyboard.press('Escape');
      await expect.poll(() => page.locator('.project-brain-modal').count()).toBe(0);
      expect(await page.locator('.detail-modal').isVisible()).toBe(true);
      await page.getByRole('button', { name: 'Brain', exact: true }).click();
      await editor.waitFor();
      expect(await editor.inputValue()).toBe('# My edited rules\nPreserve billing behavior.');
      await page.getByRole('button', { name: 'Re-Scan Stack', exact: true }).click();
      await expect.poll(() => state.memoryActions.length).toBe(2);
      expect(state.memoryActions.map(item => item.action)).toEqual(['save', 'scan']);
      expect(state.memoryActions[1].content).toContain('Preserve billing behavior.');
      await expect.poll(() => editor.inputValue()).toBe('# My edited rules\nPreserve billing behavior.\n## Stack\nReact');
      expect(state.unexpectedWrites).toEqual([]);
    } finally { await browser.close(); }
  }, 30000);

  it.runIf(available)('shows skill approval errors inside the open review and supports Escape', async () => {
    const { browser, page, state } = await workspace();
    try {
      await page.locator('.nav-item').filter({ hasText: 'Skill Hub' }).click();
      await page.getByRole('button', { name: 'Inspect', exact: true }).click();
      const review = page.getByRole('dialog', { name: 'Review Fixture', exact: true });
      await review.waitFor();
      await review.getByRole('button', { name: 'Approve skill', exact: true }).click();
      await expect.poll(() => review.getByRole('alert').textContent()).toContain('The reviewed file changed.');
      expect(await review.isVisible()).toBe(true);
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => Boolean(document.activeElement?.closest('.skill-review-modal')))).toBe(true);
      await page.keyboard.press('Escape');
      await expect.poll(() => review.count()).toBe(0);
      expect(await page.getByRole('heading', { name: 'Reviewed capabilities for your agents.', exact: true }).isVisible()).toBe(true);
      expect(state.unexpectedWrites).toEqual([]);
    } finally { await browser.close(); }
  }, 30000);

  it.runIf(available)('keeps Security Center evidence visible through an audit failure and records a privacy review', async () => {
    const { browser, page } = await workspace();
    try {
      await page.locator('.project-card').click();
      await page.getByRole('button', { name: 'Launch review', exact: true }).click();
      await page.getByRole('button', { name: 'Open Security Center', exact: true }).click();
      const center = page.getByRole('dialog', { name: 'Security Center', exact: true });
      await center.getByText('Human review required', { exact: true }).waitFor();
      await center.getByRole('button', { name: 'Refresh security scan', exact: true }).click();
      await center.getByText('Dependency audit service was unavailable; the last completed report is still shown.', { exact: true }).waitFor();
      await center.getByRole('button', { name: 'Open privacy evidence', exact: true }).click();
      await center.getByPlaceholder('Brief rationale and responsible owner (required)').fill('Reviewed by the responsible product owner.');
      await center.getByRole('button', { name: 'Save review record', exact: true }).click();
      await center.getByText('Technical checks clear', { exact: true }).waitFor();
    } finally { await browser.close(); }
  }, 30000);
});

import { EventEmitter } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createVisualQaEvidenceCollector, runVisualQA, visualQaPasses } from '../visual-qa.mjs';

const healthy = {
  httpStatus: 200,
  sameOrigin: true,
  domCheck: { hasOverlay: false, isBlank: false },
  pageErrors: [],
  consoleErrors: [],
  failedRequests: []
};

const temporaryDirectories = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

class FakePage extends EventEmitter {
  constructor(url, hooks = {}) {
    super();
    this.currentUrl = url;
    this.hooks = hooks;
    this.waitCount = 0;
    this.frame = { url: () => this.currentUrl };
  }

  mainFrame() { return this.frame; }
  url() { return this.currentUrl; }
  async route() {}
  async goto() {
    await this.hooks.goto?.(this);
    return { status: () => 200 };
  }
  async waitForTimeout() {
    this.waitCount += 1;
    await this.hooks.wait?.(this, this.waitCount);
  }
  async evaluate() { return { textSnippet: 'healthy application content', hasOverlay: false, isBlank: false }; }
  async screenshot() {}
  async setViewportSize() {}
}

function fakeBrowser(page) {
  return async () => ({
    newPage: async () => page,
    close: async () => {}
  });
}

function visualQaFixture(page) {
  const evidenceDir = mkdtempSync(join(tmpdir(), 'orbit-visual-qa-policy-'));
  temporaryDirectories.push(evidenceDir);
  return runVisualQA({
    previewUrl: 'http://127.0.0.1:43210',
    runId: 'visual-policy',
    evidenceDir,
    launchBrowser: fakeBrowser(page),
    settleDelayMs: 0,
    mobileDelayMs: 0
  });
}

describe('visual QA release policy', () => {
  it('accepts only a healthy same-origin 2xx page', () => {
    expect(visualQaPasses(healthy)).toBe(true);
  });

  it.each([
    ['HTTP error', { httpStatus: 404 }],
    ['redirect outside preview origin', { sameOrigin: false }],
    ['blank page', { domCheck: { hasOverlay: false, isBlank: true } }],
    ['error overlay', { domCheck: { hasOverlay: true, isBlank: false } }],
    ['runtime exception', { pageErrors: ['boom'] }],
    ['console error', { consoleErrors: ['failed to hydrate'] }],
    ['failed first-party request', { failedRequests: [{ url: 'http://127.0.0.1/app.js' }] }],
    ['first-party HTTP resource error', { httpErrors: [{ status: 404, url: 'http://127.0.0.1/app.js' }] }],
    ['delayed unsafe navigation', { navigationErrors: ['left origin'] }],
    ['truncated error evidence', { overflowCounts: { consoleErrors: 1 } }]
  ])('fails closed for %s', (_label, override) => {
    expect(visualQaPasses({ ...healthy, ...override })).toBe(false);
  });

  it('rejects a delayed top-frame cross-origin navigation before DOM inspection', async () => {
    const page = new FakePage('http://127.0.0.1:43210', {
      wait(current, count) {
        if (count !== 1) return;
        current.currentUrl = 'https://attacker.example.invalid/stolen';
        current.emit('framenavigated', current.frame);
      }
    });

    const report = await visualQaFixture(page);
    expect(report.status).toBe('failed');
    expect(report.error).toMatch(/left its isolated origin/i);
    expect(report.navigationErrors.length).toBeGreaterThan(0);
    expect(report.hasScreenshots).toBe(false);
  });

  it.each([
    [404, 'script', '/missing.js'],
    [500, 'fetch', '/api/data']
  ])('fails on first-party HTTP %s for %s resources', async (status, resourceType, path) => {
    const page = new FakePage('http://127.0.0.1:43210', {
      goto(current) {
        current.emit('response', {
          status: () => status,
          url: () => `http://127.0.0.1:43210${path}`,
          request: () => ({ resourceType: () => resourceType })
        });
      }
    });

    const report = await visualQaFixture(page);
    expect(report.status).toBe('failed');
    expect(report.httpErrors).toEqual([expect.objectContaining({ status, resourceType })]);
  });

  it('bounds collector count and total retained characters while reporting overflow', () => {
    const collector = createVisualQaEvidenceCollector({ maxItemsPerCategory: 2, maxTotalCharacters: 12 });
    collector.add('consoleErrors', 'aaaa');
    collector.add('consoleErrors', 'bbbb');
    collector.add('consoleErrors', 'cccc');
    collector.add('pageErrors', '0123456789');
    collector.add('httpErrors', 'x');
    const evidence = collector.snapshot();

    expect(evidence.consoleErrors).toEqual(['aaaa', 'bbbb']);
    expect(evidence.overflowCounts.consoleErrors).toBe(1);
    expect(evidence.overflowCounts.pageErrors).toBe(1);
    expect(evidence.httpErrors).toEqual(['x']);
    expect(evidence.retainedCharacters).toBeLessThanOrEqual(12);
  });
});

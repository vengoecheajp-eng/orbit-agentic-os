import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { validModelId, modelAdvice } from '../model-policy.mjs';
import { normalizeModels, createModelCatalog } from '../model-catalog.mjs';
import { applyWorkspacePatch } from '../workspace-patch.mjs';

describe('Model selection and isolated code patches', () => {
  it('accepts future model IDs without accepting command arguments', () => {
    for (const value of ['next-model:latest', 'organization/new-coder', 'gpt-future']) expect(validModelId(value)).toBe(true);
    for (const value of ['--help', 'model;env', 'model $(env)', '../secret', 'x\ny']) expect(validModelId(value)).toBe(false);
  });
  it('recommends without gating model choice', () => {
    const advice = modelAdvice('Build an entire app with authentication', 'local', 'small:latest', [{ id: 'codex', available: true, activeModel: 'strong' }]);
    expect(advice.recommendation).toEqual({ provider: 'codex', model: 'strong' });
    expect(advice.message).toContain('still try');
    expect(advice.blocked).toBeUndefined();
  });
  it('filters non-text models by metadata and discovers new IDs', () => {
    expect(normalizeModels('gemini', { models: [{ name: 'models/future-flash', supportedGenerationMethods: ['generateContent'] }, { name: 'models/embedding', supportedGenerationMethods: ['embedContent'] }] }).map(m => m.id)).toEqual(['future-flash']);
    expect(normalizeModels('mistral', { data: [{ id: 'new-coder', capabilities: { completion_chat: true } }, { id: 'embed', capabilities: { completion_chat: false } }] }).map(m => m.id)).toEqual(['new-coder']);
  });
  it('paginates live catalogs, caches, and preserves results after connection errors', async () => {
    let calls = 0, failing = false;
    const catalog = createModelCatalog({ configurations: () => ({ url: 'https://example.test/models' }), fetcher: async url => {
      calls++;
      if (failing) return { ok: false, status: 429 };
      const second = url.searchParams.has('pageToken');
      return { ok: true, json: async () => ({ models: [{ name: `models/${second ? 'second' : 'first'}`, supportedGenerationMethods: ['generateContent'] }], ...(second ? {} : { nextPageToken: 'next' }) }) };
    } });
    expect((await catalog.refresh('gemini')).models).toHaveLength(2);
    await catalog.refresh('gemini'); expect(calls).toBe(2);
    failing = true;
    const stale = await catalog.refresh('gemini', true);
    expect(stale.source).toBe('cached'); expect(stale.models).toHaveLength(2); expect(stale.error).toBeTruthy();
  });
  it('creates app files but rejects secrets and symlinks before applying', () => {
    const root = mkdtempSync(join(tmpdir(), 'orbit-patch-'));
    const patch = path => `diff --git a/${path} b/${path}\nnew file mode 100644\n--- /dev/null\n+++ b/${path}\n@@ -0,0 +1 @@\n+export const app = true;\n`;
    try {
      spawnSync('git', ['init', root]);
      expect(applyWorkspacePatch(root, patch('app.js'))).toEqual(['app.js']);
      expect(readFileSync(join(root, 'app.js'), 'utf8')).toContain('app = true');
      expect(() => applyWorkspacePatch(root, patch('.env'))).toThrow('protected');
      expect(() => applyWorkspacePatch(root, patch('../outside.js'))).toThrow();
      writeFileSync(join(root, 'outside'), 'untouched');
      symlinkSync(root, join(root, 'escape'));
      expect(() => applyWorkspacePatch(root, patch('escape/other.js'))).toThrow();
      expect(readFileSync(join(root, 'outside'), 'utf8')).toBe('untouched');
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});

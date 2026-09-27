import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, inject, it } from 'vitest';
import { createRunFixture, waitForRun } from './fixtures.mjs';

const base = inject('orbitBase');
const dataDirectory = inject('orbitDataDir');
const testRoot = inject('orbitTestRoot');
const TIMEOUT = 90_000;

const write = (root, path, content) => {
  mkdirSync(join(root, path, '..'), { recursive: true });
  writeFileSync(join(root, path), content);
};

async function fixture(files, setupWorktree) {
  return createRunFixture({
    base,
    testRoot,
    dataDirectory,
    files,
    gitignore: 'node_modules/\n',
    run: { provider: 'gemini', gateStatus: 'needs_attention' },
    setupWorktree
  });
}

async function verify(id) {
  const response = await fetch(`${base}/api/runs/${id}/verify`, { method: 'POST' });
  expect(response.status).toBe(202);
  return waitForRun(base, id, run => run.status === 'awaiting_review', TIMEOUT);
}

describe('Completion Gate eligible-content integrity', () => {
  it('fails a passing build that rewrites tracked source after evidence was captured', async () => {
    const build = `node -e "require('node:fs').writeFileSync('source.js','mutated by build\\n')"`;
    const { id, worktreePath } = await fixture({
      'package.json': JSON.stringify({ name: 'self-mutating-build', scripts: { build } }),
      'source.js': 'reviewed source\n'
    }, worktree => write(worktree, 'feature.txt', 'agent-authored change\n'));

    const run = await verify(id);

    expect(run.gateStatus).toBe('needs_attention');
    expect(run.verification).toBeUndefined();
    expect(run.gateChecks.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'build', status: 'passed' }),
      expect.objectContaining({ kind: 'integrity', status: 'failed' })
    ]));
    expect(run.gateChecks.error).toMatch(/changed merge-eligible project content/i);
    expect(readFileSync(join(worktreePath, 'source.js'), 'utf8')).toBe('mutated by build\n');
  }, TIMEOUT);

  it('detects a build mutating a file inside an existing untracked source directory', async () => {
    const build = `node -e "require('node:fs').writeFileSync('draft/module.js','rewritten during build\\n')"`;
    const { id, worktreePath } = await fixture({
      'package.json': JSON.stringify({ name: 'untracked-directory-mutation', scripts: { build } })
    }, worktree => write(worktree, 'draft/module.js', 'agent-authored module\n'));

    const run = await verify(id);

    expect(run.gateStatus).toBe('needs_attention');
    expect(run.verification).toBeUndefined();
    expect(run.gateChecks.checks).toContainEqual(expect.objectContaining({ kind: 'integrity', status: 'failed' }));
    expect(readFileSync(join(worktreePath, 'draft/module.js'), 'utf8')).toBe('rewritten during build\n');
    expect(run.gateArtifacts || []).not.toContain('draft/module.js');
  }, TIMEOUT);

  it('tracks and removes generated artifacts as individual NUL-delimited Git paths', async () => {
    const build = `node -e "const fs=require('node:fs');fs.mkdirSync('output/nested',{recursive:true});fs.writeFileSync('output/nested/a.txt','a');fs.writeFileSync('output/line\\nname.txt','b')"`;
    const { id, worktreePath } = await fixture({
      'package.json': JSON.stringify({ name: 'individual-artifacts', scripts: { build } })
    }, worktree => write(worktree, 'feature.txt', 'agent-authored change\n'));

    const run = await verify(id);

    expect(run.gateStatus, run.gateMessage).toBe('verified_ready');
    expect(run.gateArtifacts).toEqual(expect.arrayContaining(['output/nested/a.txt', 'output/line\nname.txt']));
    expect(existsSync(join(worktreePath, 'output/nested/a.txt'))).toBe(false);
    expect(existsSync(join(worktreePath, 'output/line\nname.txt'))).toBe(false);
  }, TIMEOUT);

  it('does not execute or count a dependency preparation command as verification evidence', async () => {
    const { id, worktreePath } = await fixture({
      // Bundler evaluates Gemfile as Ruby. If Completion Gate implicitly ran
      // `bundle install`, this adversarial fixture would create the marker.
      'Gemfile': `source 'https://rubygems.org'\nFile.write('PREPARE_EXECUTED', 'unsafe')\n`
    }, worktree => write(worktree, 'feature.txt', 'agent-authored change\n'));

    const run = await verify(id);

    expect(run.gateStatus).toBe('needs_attention');
    expect(run.gateMessage).toMatch(/no executable build, test, or visual check/i);
    expect(run.verification).toBeUndefined();
    expect(existsSync(join(worktreePath, 'PREPARE_EXECUTED'))).toBe(false);
    expect(run.gateChecks.checks).toContainEqual(expect.objectContaining({
      kind: 'prepare',
      status: 'skipped',
      note: expect.stringMatching(/approve dependency installation separately/i)
    }));
  }, TIMEOUT);
});

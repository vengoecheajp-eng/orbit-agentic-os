import { chmodSync, existsSync, mkdirSync, readFileSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { describe, expect, inject, it } from 'vitest';
import { createRunFixture, git, waitForRun } from './fixtures.mjs';

const base = inject('orbitBase');
const dataDirectory = inject('orbitDataDir');
const testRoot = inject('orbitTestRoot');

// Each fixture passes an actual offline check through /verify. It does not
// manufacture a verified fingerprint or use a live provider/package install.
async function prepareRun({ commitLink = false, verify = true } = {}) {
  const fixture = await createRunFixture({
    base,
    testRoot,
    dataDirectory,
    files: {
      'package.json': { name: 'fixture', version: '1.0.0', scripts: { test: 'node --test check.test.mjs' } },
      'package-lock.json': { name: 'fixture', version: '1.0.0', lockfileVersion: 3, packages: { '': { name: 'fixture', version: '1.0.0' } } },
      'tracked.txt': 'tracked baseline\n',
      'delete.txt': 'retained baseline\n',
      // This safe fixture name is excluded from outbound review, but its
      // contents are still eligible to merge and must be fingerprinted.
      'review-secret-notes.txt': 'Synthetic non-sensitive notes\n',
      'PROJECT_MEMORY.md': '# Project Memory\n\n## 5. Approved Decisions & Completed Features\n- Baseline decision\n',
      'check.test.mjs': `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { readFileSync } from 'node:fs';\ntest('the requested feature exists', () => {\n  assert.equal(readFileSync('feature.txt', 'utf8'), 'agent change\\n');\n  assert.equal(readFileSync('tracked.txt', 'utf8'), 'tracked baseline\\n');\n});\n`
    },
    tasks: [['First task', 'Now', false], ['Second task', 'Next', false]],
    run: { prompt: 'First task', taskIndex: 0 },
    setupRepo: repo => {
      git(repo, 'config', 'core.filemode', 'true');
      mkdirSync(join(repo, 'node_modules', 'dep'), { recursive: true });
      writeFileSync(join(repo, 'node_modules', 'dep', 'index.js'), 'export default 1;\n');
      symlinkSync('tracked.txt', join(repo, 'tracked-link'));
    },
    setupWorktree: (worktreePath, repo) => {
      writeFileSync(join(worktreePath, 'feature.txt'), 'agent change\n');
      symlinkSync(join(repo, 'node_modules'), join(worktreePath, 'node_modules'), 'dir');
      if (commitLink) {
        git(worktreePath, 'add', '-A');
        git(worktreePath, 'commit', '-qm', 'agent committed everything');
      }
    }
  });
  if (verify) {
    const response = await fetch(`${base}/api/runs/${fixture.id}/verify`, { method: 'POST' });
    expect(response.status, await response.text()).toBe(202);
    const verified = await waitForRun(base, fixture.id, run => ['awaiting_review', 'awaiting_dependency_approval', 'failed', 'cancelled'].includes(run.status));
    expect(verified.gateStatus, JSON.stringify(verified)).toBe('verified_ready');
    expect(verified.gateChecks.tests).toBe('passed');
    expect(verified.verification).toMatchObject({ version: 1, algorithm: 'sha256' });
    fixture.verified = verified;
  }
  return fixture;
}

async function prepareAdditionalRun({ repo, projectId, prompt = 'Second task' }) {
  const id = randomUUID();
  const baseCommit = git(repo, 'rev-parse', 'HEAD');
  const branch = `orbit/${id}`;
  const worktreePath = join(testRoot, `worktree-${id}`);
  git(repo, 'worktree', 'add', '-q', '-b', branch, worktreePath, baseCommit);
  writeFileSync(join(worktreePath, 'feature-two.txt'), 'second agent change\n');
  const run = {
    id,
    projectId,
    projectName: 'Fixture project',
    provider: 'codex',
    prompt,
    taskIndex: 1,
    status: 'awaiting_review',
    gateStatus: 'needs_attention',
    branch,
    worktreePath,
    baseCommit,
    createdAt: new Date().toISOString()
  };
  writeFileSync(join(dataDirectory, 'runs', `${id}.json`), JSON.stringify(run));
  const response = await fetch(`${base}/api/runs/${id}/verify`, { method: 'POST' });
  expect(response.status, await response.text()).toBe(202);
  const verified = await waitForRun(base, id, value => ['awaiting_review', 'failed', 'cancelled'].includes(value.status));
  expect(verified.gateStatus, JSON.stringify(verified)).toBe('verified_ready');
  return { id, branch, worktreePath, baseCommit, verified };
}

describe('Orbit merge safety', () => {
  it('never commits the linked node_modules and offers the next task', async () => {
    const { id, repo, defaultBranch } = await prepareRun();
    const response = await fetch(`${base}/api/runs/${id}/merge`, { method: 'POST' });
    const body = await response.json();
    expect(response.status, JSON.stringify(body)).toBe(200);
    const files = git(repo, 'ls-tree', '-r', '--name-only', defaultBranch).split('\n');
    expect(files).toContain('feature.txt');
    expect(files.some(file => file.startsWith('node_modules'))).toBe(false);
    expect(body.completedTask).toBe('First task');
    expect(body.nextTask).toEqual({ index: 1, title: 'Second task' });
  });

  it('refuses a branch that already commits a dependency symlink', async () => {
    const { id } = await prepareRun({ commitLink: true });
    const response = await fetch(`${base}/api/runs/${id}/merge`, { method: 'POST' });
    const body = await response.json();
    expect(response.status).toBe(409);
    expect(body.linkedPaths).toEqual(['node_modules']);
  });

  it('blocks a required independent review until its current evidence is approved', async () => {
    const { id } = await prepareRun();
    const runFile = join(dataDirectory, 'runs', `${id}.json`);
    const run = JSON.parse(readFileSync(runFile, 'utf8'));
    run.review = { mode: 'required', status: 'not_requested' };
    writeFileSync(runFile, `${JSON.stringify(run, null, 2)}\n`);

    const response = await fetch(`${base}/api/runs/${id}/merge`, { method: 'POST' });
    const body = await response.json();
    expect(response.status).toBe(409);
    expect(body.error).toContain('required independent review');
  });

  it('requires legacy verified-ready runs to re-verify before merging', async () => {
    const { id, repo } = await prepareRun({ verify: false });
    const before = git(repo, 'rev-parse', 'HEAD');
    const response = await fetch(`${base}/api/runs/${id}/merge`, { method: 'POST' });
    const body = await response.json();
    expect(response.status).toBe(409);
    expect(body.error).toMatch(/re-verify/i);
    expect(git(repo, 'rev-parse', 'HEAD')).toBe(before);
  });

  it.each([
    ['tracked edit', path => writeFileSync(join(path, 'tracked.txt'), 'unverified edit\n')],
    ['new file', path => writeFileSync(join(path, 'late-file.txt'), 'unverified addition\n')],
    ['deletion', path => unlinkSync(join(path, 'delete.txt'))],
    ['executable mode change', path => chmodSync(join(path, 'tracked.txt'), 0o755)],
    ['tracked symlink target', path => { unlinkSync(join(path, 'tracked-link')); symlinkSync('feature.txt', join(path, 'tracked-link')); }],
    ['new symlink', path => symlinkSync('feature.txt', join(path, 'late-link'))],
    ['dependency lock drift', path => writeFileSync(join(path, 'package-lock.json'), '{"lockfileVersion":4}\n')],
    ['file excluded from outbound review', path => writeFileSync(join(path, 'review-secret-notes.txt'), 'Changed synthetic notes\n')]
  ])('refuses %s after verification without changing main', async (_label, mutate) => {
    const { id, repo, worktreePath } = await prepareRun();
    const mainHead = git(repo, 'rev-parse', 'HEAD');
    const mainStatus = git(repo, 'status', '--porcelain');
    mutate(worktreePath);
    const response = await fetch(`${base}/api/runs/${id}/merge`, { method: 'POST' });
    const body = await response.json();
    expect(response.status, JSON.stringify(body)).toBe(409);
    expect(body.error).toMatch(/verif|changed|drift/i);
    expect(git(repo, 'rev-parse', 'HEAD')).toBe(mainHead);
    expect(git(repo, 'status', '--porcelain')).toBe(mainStatus);
    expect(readFileSync(join(repo, 'tracked.txt'), 'utf8')).toBe('tracked baseline\n');
    expect(existsSync(worktreePath)).toBe(true);
  });

  it('refuses old verification after the target branch advances', async () => {
    const { id, repo, worktreePath } = await prepareRun();
    writeFileSync(join(repo, 'independent-change.txt'), 'New target state\n');
    git(repo, 'add', 'independent-change.txt');
    git(repo, 'commit', '-qm', 'Advance synthetic target');
    const changedTarget = git(repo, 'rev-parse', 'HEAD');
    const response = await fetch(`${base}/api/runs/${id}/merge`, { method: 'POST' });
    const body = await response.json();
    expect(response.status, JSON.stringify(body)).toBe(409);
    expect(body.error).toMatch(/verif|target|branch|changed/i);
    expect(git(repo, 'rev-parse', 'HEAD')).toBe(changedTarget);
    expect(existsSync(worktreePath)).toBe(true);
  });

  it('rejects a follow-up after the atomic merge transition', async () => {
    const { id, repo } = await prepareRun();
    const merge = await fetch(`${base}/api/runs/${id}/merge`, { method: 'POST' });
    const mergeBody = await merge.json();
    expect(merge.status, JSON.stringify(mergeBody)).toBe(200);
    const followUp = await fetch(`${base}/api/runs/${id}/follow-up`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'codex', executionMode: 'code', instruction: 'Try to restart approved work.' })
    });
    const followUpBody = await followUp.json();
    expect(followUp.status, JSON.stringify(followUpBody)).toBe(409);
    expect(followUpBody.error).toMatch(/new run|another action|merged/i);
    const stored = await (await fetch(`${base}/api/runs/${id}`)).json();
    expect(stored.status).toBe('merged');
    expect(readFileSync(join(repo, 'feature.txt'), 'utf8')).toBe('agent change\n');
  });

  it('preserves accumulated project memory across sequential verified merges', async () => {
    const first = await prepareRun();
    const memoryPath = join(first.repo, 'PROJECT_MEMORY.md');
    const operatorRule = '- Operator rule: preserve this accumulated decision across every merge.\n';
    writeFileSync(memoryPath, `${readFileSync(memoryPath, 'utf8')}\n${operatorRule}`);

    const firstMerge = await fetch(`${base}/api/runs/${first.id}/merge`, { method: 'POST' });
    expect(firstMerge.status, await firstMerge.text()).toBe(200);
    let memory = readFileSync(memoryPath, 'utf8');
    expect(memory).toContain(operatorRule.trim());
    expect(memory).toContain(first.id.slice(0, 8));

    const second = await prepareAdditionalRun({ repo: first.repo, projectId: first.projectId });
    const secondMerge = await fetch(`${base}/api/runs/${second.id}/merge`, { method: 'POST' });
    expect(secondMerge.status, await secondMerge.text()).toBe(200);
    memory = readFileSync(memoryPath, 'utf8');
    expect(memory).toContain(operatorRule.trim());
    expect(memory).toContain(first.id.slice(0, 8));
    expect(memory).toContain(second.id.slice(0, 8));
    expect(readFileSync(join(first.repo, 'feature-two.txt'), 'utf8')).toBe('second agent change\n');
  });

  it('rolls the target ref back with compare-and-swap when the working-tree refresh fails', async () => {
    const { id, repo } = await prepareRun();
    const before = git(repo, 'rev-parse', 'HEAD');
    const indexLock = join(repo, '.git', 'index.lock');
    writeFileSync(indexLock, 'synthetic lock\n');
    try {
      const response = await fetch(`${base}/api/runs/${id}/merge`, { method: 'POST' });
      const body = await response.json();
      expect(response.status, JSON.stringify(body)).toBe(409);
      expect(body.rolledBack).toBe(true);
      expect(git(repo, 'rev-parse', 'HEAD')).toBe(before);
      const stored = await (await fetch(`${base}/api/runs/${id}`)).json();
      expect(stored.status).toBe('awaiting_review');
      expect(stored.mergeRecovery).toBeUndefined();
    } finally {
      if (existsSync(indexLock)) unlinkSync(indexLock);
    }
  });

  it('never executes repository hooks while staging and committing an approved run', async () => {
    const { id, repo } = await prepareRun();
    const marker = join(repo, 'hook-executed.txt');
    const hook = join(repo, '.git', 'hooks', 'pre-commit');
    writeFileSync(hook, `#!/bin/sh\nprintf 'unsafe hook ran' > ${JSON.stringify(marker)}\nexit 99\n`);
    chmodSync(hook, 0o755);
    const response = await fetch(`${base}/api/runs/${id}/merge`, { method: 'POST' });
    const body = await response.json();
    expect(response.status, JSON.stringify(body)).toBe(200);
    expect(existsSync(marker)).toBe(false);
  });

  it('rejects a custom merge driver added after verification without executing it', async () => {
    const { id, repo } = await prepareRun();
    const marker = join(repo, 'merge-driver-executed.txt');
    git(repo, 'config', 'merge.orbit-test.driver', `sh -c "printf unsafe > ${marker}"`);
    const response = await fetch(`${base}/api/runs/${id}/merge`, { method: 'POST' });
    const body = await response.json();
    expect(response.status, JSON.stringify(body)).toBe(409);
    expect(body.error).toMatch(/merge drivers are disabled/i);
    expect(body.mergeDriverKeys).toContain('merge.orbit-test.driver');
    expect(existsSync(marker)).toBe(false);
  });
});

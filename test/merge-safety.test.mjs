import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, inject, it } from 'vitest';
import { createRunFixture, git } from './fixtures.mjs';

const base = inject('orbitBase');
const dataDirectory = inject('orbitDataDir');
const testRoot = inject('orbitTestRoot');

// A verified run whose worktree holds Orbit's link to the main repo's packages.
function prepareVerifiedRun({ commitLink = false } = {}) {
  return createRunFixture({
    base,
    testRoot,
    dataDirectory,
    files: { 'package.json': { name: 'fixture', scripts: { dev: 'vite' } } },
    tasks: [['First task', 'Now', false], ['Second task', 'Next', false]],
    run: { prompt: 'First task', taskIndex: 0 },
    setupRepo: repo => {
      mkdirSync(join(repo, 'node_modules', 'dep'), { recursive: true });
      writeFileSync(join(repo, 'node_modules', 'dep', 'index.js'), 'export default 1;\n');
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
}

describe('Orbit merge safety', () => {
  it('never commits the linked node_modules and offers the next task', async () => {
    const { id, repo, defaultBranch } = await prepareVerifiedRun();
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
    const { id } = await prepareVerifiedRun({ commitLink: true });
    const response = await fetch(`${base}/api/runs/${id}/merge`, { method: 'POST' });
    const body = await response.json();
    expect(response.status).toBe(409);
    expect(body.linkedPaths).toEqual(['node_modules']);
  });
});

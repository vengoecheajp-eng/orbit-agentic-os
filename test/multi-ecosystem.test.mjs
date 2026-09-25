import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, inject, it } from 'vitest';
import { createRunFixture, waitForRun } from './fixtures.mjs';

const base = inject('orbitBase');
const dataDirectory = inject('orbitDataDir');
const testRoot = inject('orbitTestRoot');
const TIMEOUT = 90000;
const available = command => spawnSync(command, ['--version'], { encoding: 'utf8' }).status === 0 || spawnSync(command, ['version'], { encoding: 'utf8' }).status === 0;

// A finished run (Gemini never auto-repairs, so the gate result is final).
function fixture(files, setupWorktree, extra = {}) {
  return createRunFixture({ base, testRoot, dataDirectory, files, gitignore: '', run: { provider: 'gemini', gateStatus: 'needs_attention' }, setupWorktree, ...extra });
}
async function verify(id) {
  const response = await fetch(`${base}/api/runs/${id}/verify`, { method: 'POST' });
  expect(response.status).toBe(202);
  return waitForRun(base, id, run => ['awaiting_review', 'awaiting_dependency_approval'].includes(run.status), TIMEOUT);
}
const write = (root, path, content) => { mkdirSync(join(root, path, '..'), { recursive: true }); writeFileSync(join(root, path), content); };

describe('Completion Gate across ecosystems', () => {
  it.runIf(available('python3'))('runs Python checks, reports a failing test, and cleans up what the checks created', async () => {
    const { id, worktreePath } = await fixture(
      { 'requirements.txt': '', 'calc.py': 'def add(a, b):\n    return a + b\n' },
      worktree => write(worktree, 'tests/test_calc.py', 'import unittest\nfrom calc import add\n\nclass T(unittest.TestCase):\n    def test_add(self):\n        self.assertEqual(add(2, 2), 5)\n')
    );
    const run = await verify(id);
    expect(run.gateStatus).toBe('needs_attention');
    const checks = run.gateChecks.checks.map(check => `${check.ecosystem}:${check.kind}:${check.status}`);
    expect(checks).toEqual(['python:build:passed', 'python:test:failed']);
    expect(run.gateChecks.error).toMatch(/AssertionError|FAILED/);
    // __pycache__ folders from the checks are not the agent's work.
    expect(existsSync(join(worktreePath, '__pycache__'))).toBe(false);
    expect(run.gateArtifacts).toContain('__pycache__');
  }, TIMEOUT);

  it.runIf(available('go'))('builds and tests a Go module', async () => {
    const { id } = await fixture(
      { 'go.mod': 'module example.com/calc\n\ngo 1.21\n', 'calc.go': 'package calc\n\nfunc Add(a, b int) int { return a + b }\n' },
      worktree => write(worktree, 'calc_test.go', 'package calc\n\nimport "testing"\n\nfunc TestAdd(t *testing.T) { if Add(2, 2) != 4 { t.Fatal("bad") } }\n')
    );
    const run = await verify(id);
    expect(run.gateStatus, run.gateMessage).toBe('verified_ready');
    expect(run.gateChecks.checks.map(check => `${check.command}:${check.status}`)).toEqual(['go build ./...:passed', 'go test ./...:passed']);
    expect(run.gateMessage).toContain('go test ./...');
  }, TIMEOUT);

  it.runIf(available('python3'))('checks every project in a monorepo', async () => {
    const { id } = await fixture(
      { 'web/package.json': JSON.stringify({ name: 'web', scripts: { build: 'node -e "process.exit(0)"' } }), 'api/requirements.txt': '', 'api/app.py': 'x = 1\n' },
      worktree => write(worktree, 'api/app.py', 'x = 2\n')
    );
    const run = await verify(id);
    expect(run.gateStatus, run.gateMessage).toBe('verified_ready');
    const checks = run.gateChecks.checks.map(check => `${check.directory}:${check.ecosystem}:${check.status}`).sort();
    expect(checks).toEqual(['api:python:passed', 'web:npm:passed']);
  }, TIMEOUT);

  it('says plainly when nothing could be verified', async () => {
    const { id } = await fixture({ 'notes.txt': 'hello\n' }, worktree => write(worktree, 'notes.txt', 'hello again\n'));
    const run = await verify(id);
    expect(run.gateMessage).toMatch(/nothing was verified automatically/);
  }, TIMEOUT);
});

describe('Dependency gate across ecosystems', () => {
  it('pauses for a Python dependency from Git and for a new package index', async () => {
    const { id } = await fixture({ 'requirements.txt': '' }, worktree => write(worktree, 'requirements.txt', 'mylib @ git+https://example.invalid/mylib.git\n--extra-index-url https://pypi.example.invalid/simple\n'));
    const run = await verify(id);
    expect(run.status).toBe('awaiting_dependency_approval');
    const [item] = run.dependencyRequest.manifests;
    expect(item).toMatchObject({ path: 'requirements.txt', ecosystem: 'python', ecosystemLabel: 'Python', kind: 'manifest' });
    expect(item.added.map(entry => `${entry.section}:${entry.source}`)).toEqual(['dependencies:git', 'index:url']);
    expect(run.dependencyRequest.customIndexes).toEqual(['python']);
  }, TIMEOUT);

  it('pauses for a Go module and a Cargo patch', async () => {
    const { id } = await fixture(
      { 'go.mod': 'module example.com/x\n\ngo 1.21\n', 'rust/Cargo.toml': '[package]\nname="r"\nversion="0.1.0"\n' },
      worktree => {
        write(worktree, 'go.mod', 'module example.com/x\n\ngo 1.21\n\nrequire github.com/google/uuid v1.6.0\n');
        write(worktree, 'rust/Cargo.toml', '[package]\nname="r"\nversion="0.1.0"\n[patch.crates-io]\nserde={git="https://example.invalid/serde"}\n');
      }
    );
    const run = await verify(id);
    expect(run.status).toBe('awaiting_dependency_approval');
    const summary = run.dependencyRequest.manifests.map(item => `${item.path}:${item.added.map(entry => `${entry.section}/${entry.name}`).join(',')}`);
    expect(summary).toEqual(['go.mod:require/github.com/google/uuid', 'rust/Cargo.toml:patch crates-io/serde']);
    expect(run.dependencyRequest.manifests[1].directory).toBe('rust');
  }, TIMEOUT);

  it('treats a lockfile the agent edited by hand as a change to review', async () => {
    const lock = JSON.stringify({ name: 'x', lockfileVersion: 3, packages: {} }, null, 2);
    const { id } = await fixture(
      { 'package.json': JSON.stringify({ name: 'x', version: '1.0.0' }), 'package-lock.json': lock },
      worktree => write(worktree, 'package-lock.json', lock.replace('"packages": {}', '"packages": { "node_modules/evil": { "resolved": "https://evil.example.invalid/evil.tgz" } }'))
    );
    const run = await verify(id);
    expect(run.status).toBe('awaiting_dependency_approval');
    const [item] = run.dependencyRequest.manifests;
    expect(item.kind).toBe('lockfile');
    expect(item.raw.preview.join('\n')).toContain('evil.example.invalid');
  }, TIMEOUT);
});

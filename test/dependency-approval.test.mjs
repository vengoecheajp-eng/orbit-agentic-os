import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { describe, expect, inject, it } from 'vitest';
import { createRunFixture, git, waitForRun } from './fixtures.mjs';

const base = inject('orbitBase');
const dataDirectory = inject('orbitDataDir');
const testRoot = inject('orbitTestRoot');
// These tests run real package-manager installs.
const INSTALL_TEST_TIMEOUT = 60000;

// A local package so installs never need the network.
function localPackage() {
  const directory = join(testRoot, `local-dep-${randomUUID()}`);
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'package.json'), JSON.stringify({ name: 'local-dep', version: '1.0.0', main: 'index.js' }));
  writeFileSync(join(directory, 'index.js'), 'module.exports = 42;\n');
  return directory;
}

// A finished run whose agent declared `changes` in package.json.
function runWithManifestChange(changes, runFields = {}) {
  return createRunFixture({
    base,
    testRoot,
    dataDirectory,
    files: { 'package.json': { name: 'fixture', version: '1.0.0' } },
    run: { gateStatus: 'needs_attention', ...runFields },
    setupWorktree: worktreePath => {
      const manifest = JSON.parse(readFileSync(join(worktreePath, 'package.json'), 'utf8'));
      writeFileSync(join(worktreePath, 'package.json'), JSON.stringify({ ...manifest, ...changes }, null, 2));
    }
  });
}

async function post(path, body) {
  const response = await fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  return { status: response.status, body: await response.json().catch(() => ({})) };
}

describe('Orbit dependency approval gate', () => {
  it('pauses for a new dependency and installs it only after approval', async () => {
    const dependency = localPackage();
    const { id, worktreePath } = await runWithManifestChange({ dependencies: { 'local-dep': `file:${dependency}` } });

    expect((await post(`/api/runs/${id}/verify`)).status).toBe(202);
    const paused = await waitForRun(base, id, run => run.status === 'awaiting_dependency_approval');
    expect(paused.gateStatus).toBe('dependency_approval');
    expect(paused.dependencyRequest.manifests).toHaveLength(1);
    expect(paused.dependencyRequest.manifests[0].added).toEqual([{ name: 'local-dep', section: 'dependencies', spec: `file:${dependency}`, source: 'local' }]);
    expect(existsSync(join(worktreePath, 'node_modules', 'local-dep'))).toBe(false);

    const inbox = await (await fetch(`${base}/api/inbox`)).json();
    const item = inbox.items.find(entry => entry.id === id);
    expect(item.dependencyRequest.hash).toBe(paused.dependencyRequest.hash);
    expect(item.mergeable).toBe(false);
    expect((await post(`/api/runs/${id}/merge`)).status).toBe(409);

    // An approval must name the exact list the reviewer saw.
    expect((await post(`/api/runs/${id}/dependencies/approve`, { hash: 'stale' })).status).toBe(409);
    expect((await post(`/api/runs/${id}/dependencies/approve`, { hash: paused.dependencyRequest.hash })).status).toBe(202);

    const verified = await waitForRun(base, id, run => run.status === 'awaiting_review');
    expect(verified.gateStatus, verified.gateMessage).toBe('needs_attention');
    expect(verified.gateChecks.unavailable).toBe(true);
    expect(verified.dependencyApproval.installed).toBe(true);
    expect(verified.dependencyApproval.acceptedHashes).toContain(paused.dependencyRequest.hash);
    expect(readFileSync(join(worktreePath, 'node_modules', 'local-dep', 'index.js'), 'utf8')).toContain('42');
    expect(existsSync(join(worktreePath, 'package-lock.json'))).toBe(true);
  }, INSTALL_TEST_TIMEOUT);

  it('returns a failed install to the reviewer instead of getting stuck', async () => {
    // npm reports a missing tarball as an error (a missing folder is linked anyway).
    const missing = join(testRoot, `missing-${randomUUID()}.tgz`);
    const { id, worktreePath } = await runWithManifestChange({ dependencies: { 'ghost-dep': `file:${missing}` } }, { provider: 'gemini' });
    await post(`/api/runs/${id}/verify`);
    const paused = await waitForRun(base, id, run => run.status === 'awaiting_dependency_approval');
    expect((await post(`/api/runs/${id}/dependencies/approve`, { hash: paused.dependencyRequest.hash })).status).toBe(202);

    const failed = await waitForRun(base, id, run => run.status === 'awaiting_dependency_approval' && Boolean(run.dependencyRequest?.installError));
    expect(failed.dependencyRequest.installError.command).toBe('npm install --no-audit --no-fund');
    expect(failed.dependencyRequest.installError.summary.length).toBeGreaterThan(0);
    expect(failed.dependencyApproval).toBeUndefined();
    expect(existsSync(join(worktreePath, 'node_modules'))).toBe(false);
    // The reviewer can still send the agent on without the package.
    expect((await post(`/api/runs/${id}/dependencies/reject`)).status).toBe(200);
  }, INSTALL_TEST_TIMEOUT);

  it('flags install scripts as a change that needs approval', async () => {
    const { id } = await runWithManifestChange({ scripts: { postinstall: 'node setup.js' } });
    await post(`/api/runs/${id}/verify`);
    const paused = await waitForRun(base, id, run => run.status === 'awaiting_dependency_approval');
    expect(paused.dependencyRequest.manifests[0].scripts).toEqual([{ name: 'postinstall', from: null, to: 'node setup.js' }]);
  }, INSTALL_TEST_TIMEOUT);

  it('records a rejection and keeps the run out of the merge path', async () => {
    const dependency = localPackage();
    const { id } = await runWithManifestChange({ dependencies: { 'local-dep': `file:${dependency}` } }, { provider: 'gemini' });
    await post(`/api/runs/${id}/verify`);
    await waitForRun(base, id, run => run.status === 'awaiting_dependency_approval');

    const rejected = await post(`/api/runs/${id}/dependencies/reject`, { note: 'Use the standard library instead.' });
    expect(rejected.status).toBe(200);
    const run = await (await fetch(`${base}/api/runs/${id}`)).json();
    expect(run.status).toBe('awaiting_review');
    expect(run.gateStatus).toBe('needs_attention');
    expect(run.dependencyRejection.note).toBe('Use the standard library instead.');
    expect(run.dependencyRejection.changes).toEqual([`local-dep@file:${dependency}`]);
    expect((await post(`/api/runs/${id}/merge`)).status).toBe(409);
  }, INSTALL_TEST_TIMEOUT);

  it('installs the dependencies a connected project already declares without dirtying it', async () => {
    const dependency = localPackage();
    const { id, repo, worktreePath } = await createRunFixture({
      base,
      testRoot,
      dataDirectory,
      files: { 'package.json': { name: 'fixture', version: '1.0.0', dependencies: { 'local-dep': `file:${dependency}` } } },
      run: { gateStatus: 'needs_attention' },
      setupWorktree: worktreePath => writeFileSync(join(worktreePath, 'feature.txt'), 'agent change\n')
    });

    await post(`/api/runs/${id}/verify`);
    const verified = await waitForRun(base, id, run => run.status === 'awaiting_review');
    expect(verified.gateStatus, verified.gateMessage).toBe('needs_attention');
    expect(verified.gateChecks.unavailable).toBe(true);
    expect(verified.dependencySetup).toMatchObject([{ ok: true, ecosystem: 'npm', command: 'npm install --no-package-lock --no-audit --no-fund', directory: '.' }]);
    expect(existsSync(join(repo, 'node_modules', 'local-dep', 'index.js'))).toBe(true);
    expect(git(repo, 'status', '--porcelain')).toBe('');
    // The gate's link to those packages is removed once the checks finish.
    expect(() => lstatSync(join(worktreePath, 'node_modules'))).toThrow();
  }, INSTALL_TEST_TIMEOUT);
});

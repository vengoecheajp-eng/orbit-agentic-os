import { chmodSync, existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { describe, expect, inject, it } from 'vitest';
import { createRunFixture, waitForRun } from './fixtures.mjs';

const base = inject('orbitBase');
const dataDirectory = inject('orbitDataDir');
const testRoot = inject('orbitTestRoot');
const TIMEOUT = 60_000;

async function post(path, body = {}) {
  const response = await fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: response.status, body: await response.json().catch(() => ({})) };
}

function localPackage({ postinstall } = {}) {
  const directory = join(testRoot, `boundary-package-${randomUUID()}`);
  mkdirSync(directory, { recursive: true });
  const manifest = { name: `boundary-package-${randomUUID()}`, version: '1.0.0', main: 'index.js' };
  if (postinstall) manifest.scripts = { postinstall: 'node postinstall.cjs' };
  writeFileSync(join(directory, 'package.json'), JSON.stringify(manifest));
  writeFileSync(join(directory, 'index.js'), 'module.exports = true;\n');
  if (postinstall) writeFileSync(join(directory, 'postinstall.cjs'), postinstall);
  return directory;
}

async function verifyToDependencyRequest(id) {
  expect((await post(`/api/runs/${id}/verify`)).status).toBe(202);
  return waitForRun(base, id, run => run.status === 'awaiting_dependency_approval', TIMEOUT);
}

async function verifyUnsafeFile(setupWorktree) {
  const fixture = await createRunFixture({
    base,
    testRoot,
    dataDirectory,
    files: { 'notes.txt': 'safe\n' },
    run: { provider: 'gemini', gateStatus: 'needs_attention' },
    setupWorktree
  });
  expect((await post(`/api/runs/${fixture.id}/verify`)).status).toBe(202);
  const run = await waitForRun(base, fixture.id, value => value.status === 'awaiting_review', TIMEOUT);
  expect(run.gateStatus).toBe('needs_attention');
  expect(run.gateMessage).toMatch(/dependency|regular file|symbolic link|safely read|safe size|could not finish/i);
  expect(run.dependencyApproval).toBeUndefined();
  return fixture;
}

describe('dependency approval integrity boundary', () => {
  it('invalidates setup approval when packageManager changes from npm to pnpm', async () => {
    const dependency = localPackage();
    const fixture = await createRunFixture({
      base,
      testRoot,
      dataDirectory,
      files: { 'package.json': { name: 'manager-drift', version: '1.0.0', dependencies: { local: `file:${dependency}` }, scripts: { dev: 'node dev.cjs' } }, 'dev.cjs': 'setInterval(() => {}, 1000);\n' },
      setupWorktree: worktree => writeFileSync(join(worktree, 'feature.txt'), 'change\n')
    });
    const first = await post(`/api/projects/${fixture.projectId}/dependencies/prepare`, { consent: true, hash: 'stale' });
    const blocked = first.body;
    expect(first.status).toBe(409);
    expect(blocked.setupPlans[0].command).toMatch(/^npm /);

    const manifestPath = join(fixture.repo, 'package.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    manifest.packageManager = 'pnpm@9.15.0';
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    const stale = await post(`/api/projects/${fixture.projectId}/dependencies/prepare`, { consent: true, hash: blocked.setupHash });
    expect(stale.status).toBe(409);
    expect(stale.body.setupHash).not.toBe(blocked.setupHash);
    expect(stale.body.setupPlans[0].command).toMatch(/^pnpm /);
    expect(existsSync(join(fixture.repo, 'node_modules'))).toBe(false);
  }, TIMEOUT);

  it('requires a new approval when an allowed postinstall mutates package.json', async () => {
    const dependency = localPackage({
      postinstall: "const fs=require('node:fs'); const p=require('node:path').join(process.env.INIT_CWD,'package.json'); const m=JSON.parse(fs.readFileSync(p,'utf8')); m.orbitUnexpectedMutation=true; fs.writeFileSync(p,JSON.stringify(m,null,2));\n"
    });
    const fixture = await createRunFixture({
      base,
      testRoot,
      dataDirectory,
      files: { 'package.json': { name: 'postinstall-mutation', version: '1.0.0' } },
      run: { provider: 'gemini', gateStatus: 'needs_attention' },
      setupWorktree(worktree) {
        const manifestPath = join(worktree, 'package.json');
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
        manifest.dependencies = { injected: `file:${dependency}` };
        writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      }
    });
    const reviewed = await verifyToDependencyRequest(fixture.id);
    expect((await post(`/api/runs/${fixture.id}/dependencies/approve`, { hash: reviewed.dependencyRequest.hash, allowScripts: true })).status).toBe(202);
    const paused = await waitForRun(base, fixture.id, run => run.status === 'awaiting_dependency_approval' && run.dependencyRequest?.integrityChanged, TIMEOUT);
    expect(paused.gateMessage).toMatch(/changed a dependency manifest|new approval/i);
    expect(paused.dependencyApproval).toBeUndefined();
    expect(paused.dependencyRequest.manifests.find(item => item.path === 'package.json')?.identity?.sha256).toMatch(/^[a-f0-9]{64}$/);
  }, TIMEOUT);

  it('does not auto-approve an unexpected package-manager lockfile', async () => {
    const dependency = localPackage({
      postinstall: "require('node:fs').writeFileSync(require('node:path').join(process.env.INIT_CWD,'yarn.lock'),'# created by package code\\n');\n"
    });
    const fixture = await createRunFixture({
      base,
      testRoot,
      dataDirectory,
      files: { 'package.json': { name: 'unexpected-lockfile', version: '1.0.0' } },
      run: { provider: 'gemini', gateStatus: 'needs_attention' },
      setupWorktree(worktree) {
        const manifestPath = join(worktree, 'package.json');
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
        manifest.dependencies = { injected: `file:${dependency}` };
        writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      }
    });
    const reviewed = await verifyToDependencyRequest(fixture.id);
    expect((await post(`/api/runs/${fixture.id}/dependencies/approve`, { hash: reviewed.dependencyRequest.hash, allowScripts: true })).status).toBe(202);
    const paused = await waitForRun(base, fixture.id, run => run.status === 'awaiting_dependency_approval' && run.dependencyRequest?.integrityChanged, TIMEOUT);
    expect(paused.dependencyApproval).toBeUndefined();
    expect(paused.dependencyRequest.manifests).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'yarn.lock' })]));
    expect(paused.gateMessage).toMatch(/new approval|required|changed/i);
  }, TIMEOUT);

  for (const fixture of [
    {
      name: 'Poetry',
      files: { 'pyproject.toml': '[tool.poetry]\nname="demo"\nversion="0.1.0"\n[tool.poetry.dependencies]\npython="^3.11"\n' },
      change: worktree => writeFileSync(join(worktree, 'pyproject.toml'), '[tool.poetry]\nname="demo"\nversion="0.1.0"\n[tool.poetry.dependencies]\npython="^3.11"\nlocal={path="../local"}\n')
    },
    {
      name: 'Pipenv',
      files: { Pipfile: '[[source]]\nurl="https://pypi.org/simple"\nname="pypi"\n[packages]\n' },
      change: worktree => writeFileSync(join(worktree, 'Pipfile'), '[[source]]\nurl="https://pypi.org/simple"\nname="pypi"\n[packages]\nlocal={path="../local"}\n')
    },
    {
      name: 'PDM',
      files: { 'pyproject.toml': '[project]\nname="demo"\nversion="0.1.0"\ndependencies=[]\n[tool.pdm]\n' },
      change: worktree => writeFileSync(join(worktree, 'pyproject.toml'), '[project]\nname="demo"\nversion="0.1.0"\ndependencies=["local @ file:///tmp/orbit-local"]\n[tool.pdm]\n')
    }
  ]) {
    it(`does not claim ${fixture.name} can disable install-time code`, async () => {
      const runFixture = await createRunFixture({ base, testRoot, dataDirectory, files: fixture.files, run: { provider: 'gemini', gateStatus: 'needs_attention' }, setupWorktree: fixture.change });
      const paused = await verifyToDependencyRequest(runFixture.id);
      const manifest = paused.dependencyRequest.manifests[0];
      expect(manifest.scriptsCanBeDisabled).toBe(false);
      expect(manifest.requiresScriptsConsent).toBe(true);
      const denied = await post(`/api/runs/${runFixture.id}/dependencies/approve`, { hash: paused.dependencyRequest.hash });
      expect(denied.status).toBe(422);
      expect(denied.body.error).toMatch(/cannot reliably disable|explicitly enable/i);
    }, TIMEOUT);
  }

  it('blocks an unchanged custom Python source before approval or install', async () => {
    const fixture = await createRunFixture({
      base,
      testRoot,
      dataDirectory,
      files: { 'requirements.txt': '', 'pip.conf': '[global]\nindex-url = https://packages.example.invalid/simple\n' },
      run: { provider: 'gemini', gateStatus: 'needs_attention' },
      setupWorktree: worktree => writeFileSync(join(worktree, 'requirements.txt'), 'demo @ file:///tmp/orbit-demo\n')
    });
    const paused = await verifyToDependencyRequest(fixture.id);
    expect(paused.dependencyRequest.customIndexes).toContain('python');
    expect(paused.dependencyRequest.sourceInputs.find(input => input.path === 'pip.conf')).toMatchObject({ ecosystem: 'python', kind: 'config', type: 'file' });
    expect((await post(`/api/runs/${fixture.id}/dependencies/approve`, { hash: paused.dependencyRequest.hash })).status).toBe(422);
  }, TIMEOUT);

  it('fails closed on a symlinked dependency manifest', async () => {
    const target = join(testRoot, `outside-${randomUUID()}.json`);
    writeFileSync(target, '{"name":"outside"}\n');
    await verifyUnsafeFile(worktree => symlinkSync(target, join(worktree, 'package.json')));
  }, TIMEOUT);

  it.runIf(spawnSync('which', ['mkfifo']).status === 0)('fails closed on a FIFO dependency manifest without blocking', async () => {
    await verifyUnsafeFile(worktree => {
      const result = spawnSync('mkfifo', [join(worktree, 'package.json')], { encoding: 'utf8' });
      if (result.status !== 0) throw new Error(result.stderr);
    });
  }, TIMEOUT);

  it('fails closed on an oversized dependency manifest', async () => {
    await verifyUnsafeFile(worktree => writeFileSync(join(worktree, 'package.json'), Buffer.alloc(16 * 1024 * 1024 + 1, 0x20)));
  }, TIMEOUT);

  it('fails closed on an unreadable dependency manifest', async () => {
    let manifestPath;
    try {
      const fixture = await verifyUnsafeFile(worktree => {
        manifestPath = join(worktree, 'package.json');
        writeFileSync(manifestPath, '{"name":"unreadable"}\n');
        chmodSync(manifestPath, 0o000);
      });
      manifestPath ||= join(fixture.worktreePath, 'package.json');
    } finally {
      if (manifestPath) chmodSync(manifestPath, 0o600);
    }
  }, TIMEOUT);
});

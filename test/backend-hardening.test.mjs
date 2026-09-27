import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRunFixture, git, waitForRun } from './fixtures.mjs';
import { freePort, startIsolatedOrbit } from './isolated-server.mjs';

const WAIT = 30_000;
const syntheticEnvValues = {
  orbit: ['orbit', 'test', 'value', 'must', 'not', 'leak'].join('-'),
  openai: ['openai', 'test', 'value', 'must', 'not', 'leak'].join('-'),
  anthropic: ['anthropic', 'test', 'value', 'must', 'not', 'leak'].join('-')
};
const syntheticEnvNames = ['ORBIT_FAKE_SECRET', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY'];
const syntheticRegistryToken = ['synthetic', 'test', 'token'].join('-');
let orbit;
let preloadFile;
let registryLog;

async function poll(predicate, message, timeout = WAIT) {
  const deadline = Date.now() + timeout;
  let value;
  while (Date.now() < deadline) {
    value = await Promise.resolve().then(predicate).catch(() => null);
    if (value) return value;
    await new Promise(resolveWait => setTimeout(resolveWait, 50));
  }
  throw new Error(`${message}. Last value: ${JSON.stringify(value)}`);
}

async function request(path, { method = 'POST', body } = {}) {
  const response = await fetch(`${orbit.base}${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return { response, body: await response.json().catch(() => ({})) };
}

function registryEvents() {
  if (!registryLog || !existsSync(registryLog)) return [];
  return readFileSync(registryLog, 'utf8').split('\n').filter(Boolean);
}

function localPackage(name, extra = {}) {
  const directory = join(orbit.testRoot, `${name}-${randomUUID()}`);
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'package.json'), JSON.stringify({ name, version: '1.0.0', main: 'index.cjs', ...extra }, null, 2));
  writeFileSync(join(directory, 'index.cjs'), 'module.exports = true;\n');
  return directory;
}

async function connectedProject(name, repo) {
  const response = await fetch(`${orbit.base}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, repoPath: repo, tasks: [] })
  });
  const body = await response.json();
  expect(response.status, JSON.stringify(body)).toBe(201);
  return body;
}

function repository(name, files) {
  const repo = join(orbit.testRoot, `${name}-${randomUUID()}`);
  mkdirSync(repo, { recursive: true });
  git(repo, 'init', '-q');
  git(repo, 'symbolic-ref', 'HEAD', 'refs/heads/main');
  git(repo, 'config', 'user.email', 'hardening@example.invalid');
  git(repo, 'config', 'user.name', 'Orbit Hardening Test');
  for (const [path, content] of Object.entries(files)) {
    const full = join(repo, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  }
  git(repo, 'add', '-A');
  git(repo, 'commit', '-qm', 'fixture');
  return repo;
}

beforeAll(async () => {
  const bootstrap = mkdtempSync(join(tmpdir(), 'orbit-registry-preload-'));
  preloadFile = join(bootstrap, 'delayed-registry.cjs');
  registryLog = join(bootstrap, 'registry.log');
  writeFileSync(preloadFile, `
const { appendFileSync } = require('node:fs');
const originalFetch = globalThis.fetch;
const log = ${JSON.stringify(registryLog)};
globalThis.fetch = function(input, init = {}) {
  const url = String(input && input.url ? input.url : input);
  if (url.startsWith('https://registry.npmjs.org/')) {
    appendFileSync(log, 'FETCH ' + url + '\\n');
    return new Promise((resolve, reject) => {
      const abort = () => {
        appendFileSync(log, 'ABORT ' + url + '\\n');
        const error = new Error('registry lookup aborted');
        error.name = 'AbortError';
        reject(error);
      };
      if (init.signal?.aborted) abort();
      else init.signal?.addEventListener('abort', abort, { once: true });
    });
  }
  return originalFetch(input, init);
};
`);
  orbit = await startIsolatedOrbit({
    NODE_ENV: 'test',
    NODE_OPTIONS: `--require=${preloadFile}`,
    ORBIT_REGISTRY_LOOKUPS: 'on',
    ...Object.fromEntries(syntheticEnvNames.map((name, index) => [name, [syntheticEnvValues.orbit, syntheticEnvValues.openai, syntheticEnvValues.anthropic][index]]))
  });
}, 20_000);

afterAll(async () => {
  await orbit?.stop();
  if (preloadFile) rmSync(dirname(preloadFile), { recursive: true, force: true });
}, 20_000);

describe('restricted untrusted execution environments', () => {
  it('does not expose service secrets or the main .env.local to build checks', async () => {
    const check = `
import { existsSync } from 'node:fs';
const leaked = ['ORBIT_FAKE_SECRET', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY'].filter(key => process.env[key]);
if (leaked.length || existsSync('.env.local') || !process.env.HOME.endsWith('/execution-home') || process.env.npm_config_userconfig !== '/dev/null') {
  console.error(JSON.stringify({ leaked, envFile: existsSync('.env.local'), home: process.env.HOME, npmrc: process.env.npm_config_userconfig }));
  process.exit(17);
}
`;
    const fixture = await createRunFixture({
      base: orbit.base,
      testRoot: orbit.testRoot,
      dataDirectory: orbit.dataDirectory,
      files: {
        'package.json': { name: 'restricted-build', scripts: { build: 'node check-env.mjs' } },
        'check-env.mjs': check
      },
      run: { provider: 'gemini', gateStatus: 'needs_attention' },
      setupWorktree: worktree => writeFileSync(join(worktree, 'feature.txt'), 'safe change\n')
    });
    writeFileSync(join(fixture.repo, '.env.local'), 'PRIVATE_FROM_MAIN=must-not-be-linked\n');

    expect((await request(`/api/runs/${fixture.id}/verify`)).response.status).toBe(202);
    const run = await waitForRun(orbit.base, fixture.id, value => value.status === 'awaiting_review');
    expect(run.gateStatus, run.gateMessage).toBe('verified_ready');
    expect(existsSync(join(fixture.worktreePath, '.env.local'))).toBe(false);
  }, WAIT);

  it('uses the same restricted environment and no .env.local link for worktree previews', async () => {
    const devServer = `
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
const leaked = ['ORBIT_FAKE_SECRET', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY'].filter(key => process.env[key]);
if (leaked.length || existsSync('.env.local') || !process.env.HOME.endsWith('/execution-home')) process.exit(19);
createServer((_request, response) => response.end('isolated-preview')).listen(Number(process.env.PORT), '127.0.0.1');
`;
    const fixture = await createRunFixture({
      base: orbit.base,
      testRoot: orbit.testRoot,
      dataDirectory: orbit.dataDirectory,
      files: {
        'package.json': { name: 'restricted-preview', scripts: { dev: 'node dev-server.mjs' } },
        'dev-server.mjs': devServer
      },
      run: { provider: 'gemini' },
      setupWorktree: worktree => writeFileSync(join(worktree, 'feature.txt'), 'preview change\n')
    });
    writeFileSync(join(fixture.repo, '.env.local'), 'PRIVATE_FROM_MAIN=must-not-be-linked\n');

    const preview = await request(`/api/projects/${fixture.projectId}/preview`);
    expect(preview.response.status, JSON.stringify(preview.body)).toBe(202);
    expect(await (await fetch(preview.body.url)).text()).toBe('isolated-preview');
    expect(existsSync(join(fixture.worktreePath, '.env.local'))).toBe(false);
    expect((await request(`/api/projects/${fixture.projectId}/preview`, { method: 'DELETE' })).response.status).toBe(200);
  }, WAIT);

  it('does not expose service secrets even to explicitly approved install scripts', async () => {
    const capture = join(orbit.testRoot, `install-env-${randomUUID()}.json`);
    const dependency = localPackage('env-capture-dependency', {
      scripts: { postinstall: 'node capture.cjs' }
    });
    writeFileSync(join(dependency, 'capture.cjs'), `require('node:fs').writeFileSync(${JSON.stringify(capture)}, JSON.stringify({ orbit: process.env.ORBIT_FAKE_SECRET || null, openai: process.env.OPENAI_API_KEY || null, anthropic: process.env.ANTHROPIC_API_KEY || null, home: process.env.HOME, npmrc: process.env.npm_config_userconfig }));\n`);
    const fixture = await createRunFixture({
      base: orbit.base,
      testRoot: orbit.testRoot,
      dataDirectory: orbit.dataDirectory,
      files: { 'package.json': { name: 'restricted-install', version: '1.0.0' } },
      run: { provider: 'gemini', gateStatus: 'needs_attention' },
      setupWorktree(worktree) {
        const manifest = JSON.parse(readFileSync(join(worktree, 'package.json'), 'utf8'));
        manifest.dependencies = { 'env-capture-dependency': `file:${dependency}` };
        writeFileSync(join(worktree, 'package.json'), JSON.stringify(manifest, null, 2));
      }
    });

    await request(`/api/runs/${fixture.id}/verify`);
    const paused = await waitForRun(orbit.base, fixture.id, run => run.status === 'awaiting_dependency_approval');
    expect((await request(`/api/runs/${fixture.id}/dependencies/approve`, { body: { hash: paused.dependencyRequest.hash, allowScripts: true } })).response.status).toBe(202);
    await poll(() => existsSync(capture), 'approved install script did not execute');
    const environment = JSON.parse(readFileSync(capture, 'utf8'));
    expect(environment).toMatchObject({ orbit: null, openai: null, anthropic: null, npmrc: '/dev/null' });
    expect(environment.home).toMatch(/\/execution-home$/);
    const finalRun = await waitForRun(orbit.base, fixture.id, run => run.status === 'awaiting_review');
    expect(finalRun.gateStatus).toBe('needs_attention');
  }, 60_000);
});

describe('dependency review before any registry or project execution', () => {
  it('never contacts a loopback registry selected by .npmrc before approval', async () => {
    let hits = 0;
    const registry = createServer((_request, response) => { hits += 1; response.end('{}'); });
    registry.listen(0, '127.0.0.1');
    await once(registry, 'listening');
    try {
      const registryUrl = `http://127.0.0.1:${registry.address().port}/`;
      const before = registryEvents().length;
      const fixture = await createRunFixture({
        base: orbit.base,
        testRoot: orbit.testRoot,
        dataDirectory: orbit.dataDirectory,
        files: {
          'package.json': { name: 'custom-registry', version: '1.0.0' },
          '.npmrc': `registry=${registryUrl}\n//127.0.0.1:${registry.address().port}/:_authToken=${syntheticRegistryToken}\n`
        },
        run: { provider: 'gemini', gateStatus: 'needs_attention' },
        setupWorktree(worktree) {
          const manifest = JSON.parse(readFileSync(join(worktree, 'package.json'), 'utf8'));
          manifest.dependencies = { 'private-never-fetch': '1.0.0' };
          writeFileSync(join(worktree, 'package.json'), JSON.stringify(manifest, null, 2));
        }
      });
      await request(`/api/runs/${fixture.id}/verify`);
      const paused = await waitForRun(orbit.base, fixture.id, run => run.status === 'awaiting_dependency_approval');
      const dependency = paused.dependencyRequest.manifests[0].added[0];
      expect(dependency).toMatchObject({ name: 'private-never-fetch', privateRegistry: true, registryUrl });
      expect(paused.dependencyRequest.registry[dependency.lookupId].error).toMatch(/did not contact/i);
      expect(JSON.stringify(paused.dependencyRequest)).not.toContain(syntheticRegistryToken);
      expect(hits).toBe(0);
      expect(registryEvents()).toHaveLength(before);
      const approval = await request(`/api/runs/${fixture.id}/dependencies/approve`, { body: { hash: paused.dependencyRequest.hash } });
      expect(approval.response.status).toBe(422);
      expect(approval.body.error).toMatch(/custom or credential-bearing package registry/i);
      expect(hits).toBe(0);
      await request(`/api/runs/${fixture.id}/dependencies/reject`, { body: {} });
    } finally {
      await new Promise(resolveClose => registry.close(resolveClose));
    }
  }, WAIT);

  it('keeps Stop authoritative while a public-registry lookup is delayed', async () => {
    const packageName = `orbit-delayed-${randomUUID()}`;
    const fixture = await createRunFixture({
      base: orbit.base,
      testRoot: orbit.testRoot,
      dataDirectory: orbit.dataDirectory,
      files: { 'package.json': { name: 'delayed-registry', version: '1.0.0' } },
      run: { provider: 'gemini', gateStatus: 'needs_attention' },
      setupWorktree(worktree) {
        const manifest = JSON.parse(readFileSync(join(worktree, 'package.json'), 'utf8'));
        manifest.dependencies = { [packageName]: '1.0.0' };
        writeFileSync(join(worktree, 'package.json'), JSON.stringify(manifest, null, 2));
      }
    });
    expect((await request(`/api/runs/${fixture.id}/verify`)).response.status).toBe(202);
    await poll(() => registryEvents().find(line => line.startsWith('FETCH ') && line.includes(packageName)), 'delayed registry lookup did not start');

    const stopped = await request(`/api/runs/${fixture.id}/stop`);
    expect(stopped.response.status, JSON.stringify(stopped.body)).toBe(200);
    await poll(() => registryEvents().find(line => line.startsWith('ABORT ') && line.includes(packageName)), 'registry lookup was not aborted');
    await new Promise(resolveWait => setTimeout(resolveWait, 150));
    const run = await (await fetch(`${orbit.base}/api/runs/${fixture.id}`)).json();
    expect(run.status).toBe('cancelled');
    expect(run.gateStatus).toBe('cancelled');
    expect(run.dependencyRequest).toBeUndefined();
  }, WAIT);

  it('requires explicit project setup approval and disables package scripts by default', async () => {
    const marker = join(orbit.testRoot, `project-postinstall-${randomUUID()}.txt`);
    const dependency = localPackage('project-local-dependency');
    const repo = repository('project-dependency-approval', {
      '.gitignore': 'node_modules/\n',
      'package.json': {
        name: 'project-dependency-approval',
        version: '1.0.0',
        dependencies: { 'project-local-dependency': `file:${dependency}` },
        scripts: { dev: 'node dev-server.mjs', postinstall: 'node postinstall.cjs' }
      },
      'dev-server.mjs': "import { createServer } from 'node:http'; createServer((_q,r) => r.end('ok')).listen(Number(process.env.PORT), '127.0.0.1');\n",
      'postinstall.cjs': `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'ran');\n`
    });
    const project = await connectedProject('Project dependency approval', repo);

    const blocked = await request(`/api/projects/${project.id}/preview`);
    expect(blocked.response.status).toBe(409);
    expect(blocked.body).toMatchObject({ blocked: true, reason: 'project_dependency_approval', approvalEndpoint: `/api/projects/${project.id}/dependencies/prepare` });
    expect(blocked.body.setupPlans[0]).toMatchObject({ ecosystem: 'npm', scriptsDisabled: true });
    expect(blocked.body.setupPlans[0].command).toContain('--ignore-scripts');
    expect(existsSync(marker)).toBe(false);

    const denied = await request(`/api/projects/${project.id}/dependencies/prepare`, { body: { hash: blocked.body.setupHash } });
    expect(denied.response.status).toBe(400);
    const approved = await request(`/api/projects/${project.id}/dependencies/prepare`, { body: { consent: true, hash: blocked.body.setupHash } });
    expect(approved.response.status, JSON.stringify(approved.body)).toBe(200);
    expect(approved.body.message).toMatch(/package scripts disabled/i);
    expect(approved.body.results[0].label).toContain('--ignore-scripts');
    expect(existsSync(join(repo, 'node_modules', 'project-local-dependency'))).toBe(true);
    expect(existsSync(marker)).toBe(false);
  }, 60_000);
});

describe('fail-closed tool and restart ownership checks', () => {
  it('keeps a run unmergeable when one required project tool is missing', async () => {
    const isolatedBin = join(tmpdir(), `orbit-tools-${randomUUID()}`);
    mkdirSync(isolatedBin);
    for (const command of ['git', 'node', 'npm', 'which']) {
      const located = spawnSync('which', [command], { encoding: 'utf8' }).stdout.trim();
      expect(located, `${command} must exist for the fixture`).toBeTruthy();
      symlinkSync(resolve(located), join(isolatedBin, command));
    }
    const isolated = await startIsolatedOrbit({ PATH: isolatedBin, NODE_ENV: 'test' });
    try {
      const fixture = await createRunFixture({
        base: isolated.base,
        testRoot: isolated.testRoot,
        dataDirectory: isolated.dataDirectory,
        files: {
          'web/package.json': { name: 'working-web', scripts: { build: 'node -e "process.exit(0)"' } },
          'api/mix.exs': 'defmodule Demo.MixProject do\n  use Mix.Project\n  def project, do: [app: :demo, version: "0.1.0"]\nend\n'
        },
        run: { provider: 'gemini', gateStatus: 'needs_attention' },
        setupWorktree: worktree => writeFileSync(join(worktree, 'feature.txt'), 'change\n')
      });
      const response = await fetch(`${isolated.base}/api/runs/${fixture.id}/verify`, { method: 'POST' });
      expect(response.status).toBe(202);
      const run = await waitForRun(isolated.base, fixture.id, value => value.status === 'awaiting_review');
      expect(run.gateStatus).toBe('needs_attention');
      expect(run.gateMessage).toMatch(/required tooling: mix is not installed/i);
      expect(run.gateChecks.checks).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'build', command: 'mix compile', status: 'skipped', note: 'mix is not installed' })]));
      expect(run.verification).toBeUndefined();
      const merge = await fetch(`${isolated.base}/api/runs/${fixture.id}/merge`, { method: 'POST' });
      expect(merge.status).toBe(409);
    } finally {
      await isolated.stop();
      rmSync(isolatedBin, { recursive: true, force: true });
    }
  }, 60_000);

  it.runIf(process.platform !== 'win32')('reconciles and stops a durably persisted process owner on restart', async () => {
    const root = mkdtempSync(join(tmpdir(), 'orbit-restart-owner-'));
    const data = join(root, 'data');
    const home = join(root, 'home');
    const runs = join(data, 'runs');
    mkdirSync(runs, { recursive: true });
    mkdirSync(home);
    const sleeper = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { detached: true, stdio: 'ignore' });
    const generation = randomUUID();
    const id = randomUUID();
    const startIdentity = await poll(() => {
      const result = spawnSync('ps', ['-o', 'lstart=', '-p', String(sleeper.pid)], { encoding: 'utf8' });
      return result.status === 0 && result.stdout.trim() ? result.stdout.trim() : null;
    }, 'could not read persisted process identity');
    writeFileSync(join(runs, `${id}.json`), JSON.stringify({
      id,
      projectName: 'Restart ownership fixture',
      status: 'running',
      gateStatus: 'verifying',
      executionGeneration: generation,
      executionOwner: { generation, kind: 'completion_gate', pid: sleeper.pid, pgid: sleeper.pid, processGroup: true, startIdentity }
    }));
    const port = await freePort();
    const server = spawn(process.execPath, ['server.mjs'], {
      cwd: process.cwd(),
      env: {
        PATH: process.env.PATH || '',
        HOME: home,
        PORT: String(port),
        ORBIT_DATA_DIR: data,
        ORBIT_LOCAL_BASE_URL: 'http://127.0.0.1:9/v1',
        ORBIT_OLLAMA_NATIVE_URL: 'http://127.0.0.1:9',
        ORBIT_REGISTRY_LOOKUPS: 'off',
        CODEX_BIN: '/nonexistent/codex',
        CLAUDE_BIN: '/nonexistent/claude',
        NODE_ENV: 'test'
      },
      stdio: 'ignore'
    });
    try {
      const base = `http://127.0.0.1:${port}`;
      await poll(async () => (await fetch(`${base}/api/health`)).ok, 'restarted Orbit did not become healthy');
      const reconciled = await poll(() => {
        const run = JSON.parse(readFileSync(join(runs, `${id}.json`), 'utf8'));
        return run.status === 'cancelled' ? run : null;
      }, 'persisted owner was not reconciled');
      expect(reconciled.gateStatus).toBe('cancelled');
      expect(reconciled.error).toMatch(/safely stopped the interrupted execution/i);
      expect(reconciled.executionGeneration).not.toBe(generation);
      expect(() => process.kill(sleeper.pid, 0)).toThrow();
    } finally {
      if (server.exitCode === null) { server.kill('SIGTERM'); await once(server, 'exit'); }
      try { process.kill(-sleeper.pid, 'SIGKILL'); } catch { /* already reconciled */ }
      rmSync(root, { recursive: true, force: true });
    }
  }, 30_000);
});

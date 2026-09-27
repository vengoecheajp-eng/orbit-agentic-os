import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync
} from 'node:fs';
import { once } from 'node:events';
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRunFixture, git, waitForRun } from './fixtures.mjs';
import { freePort, startIsolatedOrbit } from './isolated-server.mjs';

const WAIT = 15_000;
let orbit;
let agentLog;
let fakeAgent;

function lines() {
  if (!existsSync(agentLog)) return [];
  return readFileSync(agentLog, 'utf8').split('\n').filter(Boolean);
}

function processIsAlive(pid) {
  try { process.kill(pid, 0); return true; }
  catch { return false; }
}

async function poll(predicate, message, timeout = WAIT) {
  const deadline = Date.now() + timeout;
  let value;
  while (Date.now() < deadline) {
    value = await Promise.resolve().then(predicate).catch(() => null);
    if (value) return value;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(`${message}. Last value: ${JSON.stringify(value)}`);
}

async function post(path, body = {}) {
  const response = await fetch(`${orbit.base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return { response, body: await response.json().catch(() => ({})) };
}

function makeRepository(name, files = {}) {
  const repo = join(orbit.testRoot, name);
  mkdirSync(repo, { recursive: true });
  git(repo, 'init', '-q');
  git(repo, 'symbolic-ref', 'HEAD', 'refs/heads/main');
  git(repo, 'config', 'user.email', 'orbit-lifecycle@example.invalid');
  git(repo, 'config', 'user.name', 'Orbit Lifecycle Test');
  writeFileSync(join(repo, '.gitignore'), 'node_modules/\n');
  for (const [path, content] of Object.entries(files)) {
    const full = join(repo, path);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  }
  git(repo, 'add', '-A');
  git(repo, 'commit', '-qm', 'fixture');
  return repo;
}

async function createProject(name, repoPath) {
  const response = await fetch(`${orbit.base}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, repoPath, tasks: [['Lifecycle task', 'Now', false]] })
  });
  const body = await response.json();
  expect(response.status, JSON.stringify(body)).toBe(201);
  return body;
}

beforeAll(async () => {
  const bootstrapRoot = process.env.TMPDIR || '/tmp';
  fakeAgent = join(bootstrapRoot, `orbit-fake-agent-${process.pid}.mjs`);
  agentLog = join(bootstrapRoot, `orbit-fake-agent-${process.pid}.log`);
  writeFileSync(fakeAgent, `#!/usr/bin/env node
import { appendFileSync } from 'node:fs';
// The provider sandbox intentionally strips every ORBIT_* variable. Embed the
// isolated fixture path so this sentinel validates the process lifecycle
// without weakening the production environment allowlist.
const log = ${JSON.stringify(agentLog)};
if (process.argv.includes('--version')) process.exit(0);
if (process.argv.includes('login') && process.argv.includes('status')) {
  process.stdout.write('Logged in\\n');
  process.exit(0);
}
const write = value => appendFileSync(log, value + '\\n');
write('START ' + process.pid);
let stopping = false;
const stop = signal => {
  if (stopping) return;
  stopping = true;
  write('SIGNAL ' + process.pid + ' ' + signal);
  process.stdout.write('{"type":"result","result":"late success from retired process"}\\n');
  process.stderr.write('late error from retired process\\n');
  setTimeout(() => { write('EXIT ' + process.pid); process.exit(0); }, 300);
};
process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));
setTimeout(() => { write('TIMEOUT ' + process.pid); process.exit(0); }, 12000);
`);
  chmodSync(fakeAgent, 0o755);
  orbit = await startIsolatedOrbit({
    NODE_ENV: 'test',
    CODEX_BIN: fakeAgent,
    ORBIT_GATE_COMMAND_TIMEOUT_MS: '10000',
    ORBIT_GATE_SLOW_TIMEOUT_MS: '10000'
  });
}, 20_000);

afterAll(async () => {
  await orbit?.stop();
  for (const file of [fakeAgent, agentLog]) {
    try { if (file && existsSync(file)) unlinkSync(file); } catch { /* temp cleanup only */ }
  }
}, 20_000);

describe('durable run lifecycle ownership', () => {
  it('terminates the previous agent before replacement and Stop owns the replacement', async () => {
    const repo = makeRepository('switch-repo', { 'README.md': '# Lifecycle fixture\n' });
    const project = await createProject('Switch lifecycle fixture', repo);
    const started = await post('/api/runs', {
      projectId: project.id,
      provider: 'codex',
      executionMode: 'code',
      prompt: 'Wait for a follow-up.',
      allowConcurrent: true
    });
    expect(started.response.status, JSON.stringify(started.body)).toBe(202);
    const runId = started.body.id;
    const firstStart = await poll(() => lines().find(line => line.startsWith('START ')), 'first fake agent did not start');
    const firstPid = Number(firstStart.split(' ')[1]);

    const switched = await post(`/api/runs/${runId}/follow-up`, {
      provider: 'codex',
      executionMode: 'code',
      instruction: 'Continue with the replacement execution.'
    });
    expect(switched.response.status, JSON.stringify(switched.body)).toBe(202);
    const twoStarts = await poll(() => {
      const starts = lines().filter(line => line.startsWith('START '));
      return starts.length >= 2 ? starts : null;
    }, 'replacement fake agent did not start');
    const secondPid = Number(twoStarts[1].split(' ')[1]);
    const events = lines();
    expect(events.findIndex(line => line.startsWith(`SIGNAL ${firstPid} `))).toBeGreaterThan(-1);
    expect(events.findIndex(line => line === `START ${secondPid}`)).toBeGreaterThan(events.findIndex(line => line.startsWith(`SIGNAL ${firstPid} `)));
    const firstStillAliveWhenReplacementStarted = processIsAlive(firstPid);

    const stopped = await post(`/api/runs/${runId}/stop`);
    expect(stopped.response.status, JSON.stringify(stopped.body)).toBe(200);
    await poll(() => lines().some(line => line.startsWith(`SIGNAL ${secondPid} `)), 'Stop did not signal the replacement agent');
    expect(processIsAlive(secondPid)).toBe(false);

    // Both retired processes emit late stdout/stderr and a successful exit.
    // None of those callbacks may overwrite the durable cancellation record.
    await new Promise(resolve => setTimeout(resolve, 450));
    const finalRun = await (await fetch(`${orbit.base}/api/runs/${runId}`)).json();
    expect(finalRun.status).toBe('cancelled');
    expect(finalRun.gateStatus).toBe('cancelled');
    expect(firstStillAliveWhenReplacementStarted).toBe(false);
  }, 20_000);

  it('keeps a run cancelled when Stop interrupts an in-flight verification check', async () => {
    const fixture = await createRunFixture({
      base: orbit.base,
      testRoot: orbit.testRoot,
      dataDirectory: orbit.dataDirectory,
      files: {
        'package.json': {
          name: 'slow-gate-fixture',
          version: '1.0.0',
          scripts: { test: 'node slow-check.mjs' }
        },
        'slow-check.mjs': "setTimeout(() => process.exit(0), 8000);\n"
      },
      run: { provider: 'codex', executionMode: 'code' }
    });
    const verifying = await post(`/api/runs/${fixture.id}/verify`);
    expect(verifying.response.status, JSON.stringify(verifying.body)).toBe(202);
    await waitForRun(orbit.base, fixture.id, run => run.status === 'running' && run.gateStatus === 'verifying', 5000);

    const before = Date.now();
    const stopped = await post(`/api/runs/${fixture.id}/stop`);
    expect(stopped.response.status, JSON.stringify(stopped.body)).toBe(200);
    expect(Date.now() - before).toBeLessThan(5000);
    await new Promise(resolve => setTimeout(resolve, 600));
    const finalRun = await (await fetch(`${orbit.base}/api/runs/${fixture.id}`)).json();
    expect(finalRun.status).toBe('cancelled');
    expect(finalRun.gateStatus).toBe('cancelled');
  }, 15_000);

  it('keeps a run cancelled when Stop interrupts an automatic repair agent', async () => {
    const fixture = await createRunFixture({
      base: orbit.base,
      testRoot: orbit.testRoot,
      dataDirectory: orbit.dataDirectory,
      files: {
        'package.json': {
          name: 'repair-fixture',
          version: '1.0.0',
          scripts: { test: 'node -e "process.exit(1)"' }
        }
      },
      run: { provider: 'codex', executionMode: 'code' }
    });
    const startsBefore = lines().filter(line => line.startsWith('START ')).length;
    expect((await post(`/api/runs/${fixture.id}/verify`)).response.status).toBe(202);
    await waitForRun(orbit.base, fixture.id, run => run.status === 'running' && run.gateStatus === 'repairing', 10_000);
    const repairStart = await poll(() => {
      const starts = lines().filter(line => line.startsWith('START '));
      return starts.length > startsBefore ? starts.at(-1) : null;
    }, 'automatic repair agent did not start');
    const repairPid = Number(repairStart.split(' ')[1]);

    const stopped = await post(`/api/runs/${fixture.id}/stop`);
    expect(stopped.response.status, JSON.stringify(stopped.body)).toBe(200);
    await poll(() => lines().some(line => line.startsWith(`SIGNAL ${repairPid} `)), 'Stop did not signal the repair agent');
    await new Promise(resolve => setTimeout(resolve, 450));
    const finalRun = await (await fetch(`${orbit.base}/api/runs/${fixture.id}`)).json();
    expect(finalRun.status).toBe('cancelled');
    expect(finalRun.gateStatus).toBe('cancelled');
  }, 15_000);

  it('accepts at most one simultaneous follow-up replacement', async () => {
    const repo = makeRepository('concurrent-follow-up-repo', { 'README.md': '# Concurrent follow-up fixture\n' });
    const project = await createProject('Concurrent follow-up fixture', repo);
    const startsBefore = lines().filter(line => line.startsWith('START ')).length;
    const started = await post('/api/runs', {
      projectId: project.id,
      provider: 'codex',
      executionMode: 'code',
      prompt: 'Wait for simultaneous follow-ups.',
      allowConcurrent: true
    });
    expect(started.response.status, JSON.stringify(started.body)).toBe(202);
    const runId = started.body.id;
    await poll(() => lines().filter(line => line.startsWith('START ')).length === startsBefore + 1, 'initial fake agent did not start');

    const replacements = await Promise.all([
      post(`/api/runs/${runId}/follow-up`, { provider: 'codex', executionMode: 'code', instruction: 'First simultaneous replacement.' }),
      post(`/api/runs/${runId}/follow-up`, { provider: 'codex', executionMode: 'code', instruction: 'Second simultaneous replacement.' })
    ]);
    expect(replacements.map(item => item.response.status).sort()).toEqual([202, 409]);
    await poll(() => lines().filter(line => line.startsWith('START ')).length >= startsBefore + 2, 'accepted replacement did not start');
    await new Promise(resolve => setTimeout(resolve, 500));
    expect(lines().filter(line => line.startsWith('START '))).toHaveLength(startsBefore + 2);

    const stopped = await post(`/api/runs/${runId}/stop`);
    expect(stopped.response.status, JSON.stringify(stopped.body)).toBe(200);
  }, 20_000);

  it('invalidates and terminates a running agent before discarding its worktree', async () => {
    const repo = makeRepository('discard-running-repo', { 'README.md': '# Discard fixture\n' });
    const project = await createProject('Discard running fixture', repo);
    const startsBefore = lines().filter(line => line.startsWith('START ')).length;
    const started = await post('/api/runs', {
      projectId: project.id,
      provider: 'codex',
      executionMode: 'code',
      prompt: 'Keep running until discarded.',
      allowConcurrent: true
    });
    expect(started.response.status, JSON.stringify(started.body)).toBe(202);
    const runId = started.body.id;
    const start = await poll(() => {
      const events = lines().filter(line => line.startsWith('START '));
      return events.length > startsBefore ? events.at(-1) : null;
    }, 'discard fixture agent did not start');
    const pid = Number(start.split(' ')[1]);
    const active = await poll(async () => {
      const value = await (await fetch(`${orbit.base}/api/runs/${runId}`)).json();
      return value.status === 'running' && value.worktreePath ? value : null;
    }, 'discard fixture did not expose its owned worktree');

    const discarded = await post(`/api/runs/${runId}/discard`);
    expect(discarded.response.status, JSON.stringify(discarded.body)).toBe(200);
    expect(lines().some(line => line.startsWith(`SIGNAL ${pid} `))).toBe(true);
    expect(processIsAlive(pid)).toBe(false);
    expect(existsSync(active.worktreePath)).toBe(false);

    await new Promise(resolve => setTimeout(resolve, 450));
    const finalRun = await (await fetch(`${orbit.base}/api/runs/${runId}`)).json();
    expect(finalRun.status).toBe('discarded');
    expect(finalRun.executionGeneration).not.toBe(active.executionGeneration);
    expect(git(repo, 'branch', '--list', active.branch)).toBe('');
  }, 20_000);

  it.runIf(process.platform !== 'win32')('reconciles an unreleased process owner even when the persisted run already looks terminal', async () => {
    const root = mkdtempSync(join(tmpdir(), 'orbit-terminal-owner-'));
    const data = join(root, 'data');
    const home = join(root, 'home');
    const runs = join(data, 'runs');
    mkdirSync(runs, { recursive: true });
    mkdirSync(home, { recursive: true });
    const sleeper = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { detached: true, stdio: 'ignore' });
    const generation = randomUUID();
    const id = randomUUID();
    const startIdentity = await poll(() => {
      const result = spawnSync('ps', ['-o', 'lstart=', '-p', String(sleeper.pid)], { encoding: 'utf8' });
      return result.status === 0 && result.stdout.trim() ? result.stdout.trim() : null;
    }, 'could not read the terminal owner identity');
    writeFileSync(join(runs, `${id}.json`), JSON.stringify({
      id,
      projectName: 'Terminal restart fixture',
      status: 'merged',
      gateStatus: 'verified_ready',
      executionGeneration: generation,
      executionOwner: {
        generation,
        kind: 'agent',
        pid: sleeper.pid,
        pgid: sleeper.pid,
        processGroup: true,
        startIdentity,
        releasedAt: null
      }
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
      const restartBase = `http://127.0.0.1:${port}`;
      await poll(async () => (await fetch(`${restartBase}/api/health`)).ok, 'restarted Orbit did not become healthy');
      const reconciled = await poll(() => {
        const saved = JSON.parse(readFileSync(join(runs, `${id}.json`), 'utf8'));
        return saved.executionOwner?.releasedAt ? saved : null;
      }, 'terminal owner was not reconciled');
      expect(reconciled.status).toBe('merged');
      expect(reconciled.executionOwner.pid).toBeNull();
      expect(reconciled.executionOwner.pgid).toBeNull();
      expect(() => process.kill(sleeper.pid, 0)).toThrow();
    } finally {
      if (server.exitCode === null) { server.kill('SIGTERM'); await once(server, 'exit'); }
      try { process.kill(-sleeper.pid, 'SIGKILL'); } catch { /* already reconciled */ }
      rmSync(root, { recursive: true, force: true });
    }
  }, 30_000);
});

describe('dependency approval at preview boundaries', () => {
  it('blocks preview and visual QA with a structured dependency review response', async () => {
    const fixture = await createRunFixture({
      base: orbit.base,
      testRoot: orbit.testRoot,
      dataDirectory: orbit.dataDirectory,
      files: {
        'package.json': {
          name: 'preview-approval-fixture',
          version: '1.0.0',
          scripts: { dev: 'node dev-server.mjs' }
        },
        'dev-server.mjs': "import { createServer } from 'node:http'; createServer((_q,r) => r.end('ok')).listen(Number(process.env.PORT), '127.0.0.1');\n"
      },
      setupWorktree(worktreePath) {
        const manifest = JSON.parse(readFileSync(join(worktreePath, 'package.json'), 'utf8'));
        manifest.dependencies = { 'requires-human-approval': 'file:../not-present.tgz' };
        writeFileSync(join(worktreePath, 'package.json'), JSON.stringify(manifest, null, 2));
      }
    });

    for (const endpoint of [
      `/api/projects/${fixture.projectId}/preview`,
      `/api/runs/${fixture.id}/visual-qa`
    ]) {
      const result = await post(endpoint);
      expect([409, 422]).toContain(result.response.status);
      expect(result.body).toMatchObject({
        blocked: true,
        reason: 'dependency_approval',
        runId: fixture.id
      });
      expect(result.body.dependencyRequest?.hash).toMatch(/^[a-f0-9]{64}$/);
    }
    const run = await (await fetch(`${orbit.base}/api/runs/${fixture.id}`)).json();
    // Opening a preview is a read-only probe. It returns the exact request the
    // UI can present, but verification remains the operation that persists an
    // approval workflow on the run.
    expect(run.status).toBe('awaiting_review');
    expect(run.dependencyRequest).toBeUndefined();
    expect(existsSync(join(fixture.worktreePath, 'node_modules'))).toBe(false);
  }, 15_000);
});

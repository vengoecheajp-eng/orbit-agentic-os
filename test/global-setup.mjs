import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function findFreePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  await new Promise(resolveClose => server.close(resolveClose));
  return port;
}

async function waitForHealth(baseUrl, child, output) {
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Isolated Orbit server exited early.\n${output.stderr}`);
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolveWait => setTimeout(resolveWait, 100));
  }
  throw new Error(`Timed out starting isolated Orbit server.\n${output.stderr}`);
}

export default async function setup({ provide }) {
  const testRoot = mkdtempSync(join(tmpdir(), 'orbit-test-'));
  const dataDirectory = join(testRoot, 'data');
  const homeDirectory = join(testRoot, 'home');
  mkdirSync(dataDirectory, { recursive: true, mode: 0o700 });
  mkdirSync(homeDirectory, { recursive: true, mode: 0o700 });
  const port = await findFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const output = { stdout: '', stderr: '' };
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: root,
    env: {
      PATH: process.env.PATH || '',
      HOME: homeDirectory,
      PORT: String(port),
      ORBIT_DATA_DIR: dataDirectory,
      ORBIT_LOCAL_BASE_URL: 'http://127.0.0.1:9/v1',
      ORBIT_OLLAMA_NATIVE_URL: 'http://127.0.0.1:9',
      // Keep the suite offline and deterministic.
      ORBIT_REGISTRY_LOOKUPS: 'off',
      // Never use a Codex or Claude CLI signed in on the machine running tests.
      CODEX_BIN: '/nonexistent/codex',
      CLAUDE_BIN: '/nonexistent/claude',
      NODE_ENV: 'test'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.on('data', chunk => { output.stdout += chunk; });
  child.stderr.on('data', chunk => {
    output.stderr += chunk;
    // Keep isolated-server failures visible in CI without ever starting the
    // contributor's personal Orbit profile.
    process.stderr.write(chunk);
  });

  try {
    await waitForHealth(baseUrl, child, output);
  } catch (error) {
    child.kill('SIGTERM');
    rmSync(testRoot, { recursive: true, force: true });
    throw error;
  }

  provide('orbitBase', baseUrl);
  provide('orbitDataDirectory', dataDirectory);
  provide('orbitDataDir', dataDirectory);
  provide('orbitTestRoot', testRoot);

  return async () => {
    if (child.exitCode === null) {
      child.kill('SIGTERM');
      await once(child, 'exit');
    }
    if (existsSync(testRoot)) rmSync(testRoot, { recursive: true, force: true });
  };
}

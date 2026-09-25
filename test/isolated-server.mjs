import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export async function freePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  await new Promise(resolveClose => server.close(resolveClose));
  return port;
}

// An extra Orbit control plane with its own data and environment, for tests
// that need settings the shared test server does not have.
export async function startIsolatedOrbit(env = {}) {
  const testRoot = mkdtempSync(join(tmpdir(), 'orbit-isolated-'));
  const dataDirectory = join(testRoot, 'data');
  const home = join(testRoot, 'home');
  mkdirSync(dataDirectory, { recursive: true });
  mkdirSync(home, { recursive: true });
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: root,
    env: {
      PATH: process.env.PATH || '',
      HOME: home,
      PORT: String(port),
      ORBIT_DATA_DIR: dataDirectory,
      ORBIT_LOCAL_BASE_URL: 'http://127.0.0.1:9/v1',
      ORBIT_OLLAMA_NATIVE_URL: 'http://127.0.0.1:9',
      ORBIT_REGISTRY_LOOKUPS: 'off',
      CODEX_BIN: '/nonexistent/codex',
      CLAUDE_BIN: '/nonexistent/claude',
      ...env
    },
    stdio: ['ignore', 'ignore', 'pipe']
  });
  let stderr = '';
  child.stderr.on('data', chunk => { stderr += chunk; });
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Isolated Orbit exited early.\n${stderr}`);
    try { if ((await fetch(`${base}/api/health`)).ok) break; } catch { /* starting */ }
    await new Promise(resolveWait => setTimeout(resolveWait, 100));
  }
  return {
    base, testRoot, dataDirectory, home,
    async stop() {
      if (child.exitCode === null) { child.kill('SIGTERM'); await once(child, 'exit'); }
      rmSync(testRoot, { recursive: true, force: true });
    }
  };
}

// A minimal JSON HTTP server; `handler(method, body, request)` returns the reply.
export async function startJsonServer(handler) {
  const server = createServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) body += chunk;
    const reply = await handler(request.url, body ? JSON.parse(body) : {}, request);
    response.writeHead(reply?.status || 200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(reply?.body ?? reply));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(resolveClose => server.close(resolveClose)) };
}

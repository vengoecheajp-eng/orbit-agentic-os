import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createRunFixture } from './fixtures.mjs';
import { startIsolatedOrbit } from './isolated-server.mjs';

const servers = [];

afterEach(async () => {
  while (servers.length) await servers.pop().stop();
});

async function isolated(env = {}) {
  const server = await startIsolatedOrbit({
    NODE_ENV: 'test',
    CHROME_BIN: '/definitely/missing/orbit-test-chrome',
    ...env
  });
  servers.push(server);
  return server;
}

async function postJson(base, path) {
  const response = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}'
  });
  return { response, body: await response.json().catch(() => ({})) };
}

describe('temporary preview process and evidence hardening', () => {
  it('handles a missing preview executable without crashing Orbit', async () => {
    const orbit = await isolated({ ORBIT_NPM_BIN: '/definitely/missing/orbit-test-npm' });
    const fixture = await createRunFixture({
      base: orbit.base,
      testRoot: orbit.testRoot,
      dataDirectory: orbit.dataDirectory,
      files: {
        'package.json': { name: 'missing-preview-executable', scripts: { dev: 'node dev-server.mjs' } },
        'dev-server.mjs': 'throw new Error("must never launch");\n'
      }
    });

    const result = await postJson(orbit.base, `/api/runs/${fixture.id}/visual-qa`);
    expect(result.response.status).toBe(422);
    expect(result.body.error).toMatch(/could not start|ENOENT/i);
    expect((await fetch(`${orbit.base}/api/health`)).ok).toBe(true);
  }, 20_000);

  it('discards an on-demand report when the preview changes the worktree', async () => {
    const orbit = await isolated();
    const devServer = `
import { writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
createServer((_request, response) => {
  writeFileSync('changed-during-preview.txt', String(Date.now()));
  response.writeHead(200, { 'Content-Type': 'text/html' });
  response.end('<main id="root"><h1>Safe synthetic preview</h1></main>');
}).listen(Number(process.env.PORT), '127.0.0.1');
`;
    const fixture = await createRunFixture({
      base: orbit.base,
      testRoot: orbit.testRoot,
      dataDirectory: orbit.dataDirectory,
      files: {
        'package.json': { name: 'moving-preview-source', scripts: { dev: 'node dev-server.mjs' } },
        'dev-server.mjs': devServer
      }
    });

    const result = await postJson(orbit.base, `/api/runs/${fixture.id}/visual-qa`);
    expect(result.response.status).toBe(409);
    expect(result.body.error).toMatch(/files changed|stale report/i);
    expect(existsSync(join(fixture.worktreePath, 'changed-during-preview.txt'))).toBe(true);

    const persisted = JSON.parse(readFileSync(join(orbit.dataDirectory, 'runs', `${fixture.id}.json`), 'utf8'));
    expect(persisted.visualQA).toBeUndefined();
    expect(existsSync(join(orbit.dataDirectory, 'evidence', `${fixture.id}-desktop.png`))).toBe(false);
    expect(existsSync(join(orbit.dataDirectory, 'evidence', `${fixture.id}-mobile.png`))).toBe(false);
    expect(readdirSync(join(orbit.dataDirectory, 'evidence')).filter(name => name.startsWith(fixture.id))).toEqual([]);
  }, 30_000);
});

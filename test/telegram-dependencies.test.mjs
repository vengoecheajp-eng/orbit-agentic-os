import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRunFixture, waitForRun } from './fixtures.mjs';
import { startIsolatedOrbit } from './isolated-server.mjs';
const AUTHORIZED_USER = 424242;

// A fake Telegram Bot API: queued updates are served by getUpdates, and every
// sendMessage is recorded.
function fakeTelegram() {
  const sent = [];
  let queue = [];
  let nextId = 1;
  const server = createServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) body += chunk;
    const payload = body ? JSON.parse(body) : {};
    const method = request.url.split('/').pop();
    response.setHeader('Content-Type', 'application/json');
    if (method === 'sendMessage') { sent.push(payload); return response.end(JSON.stringify({ ok: true, result: { message_id: sent.length } })); }
    if (method === 'getUpdates') {
      const updates = queue.filter(update => update.update_id >= Number(payload.offset || 0));
      queue = [];
      if (!updates.length) await new Promise(resolveWait => setTimeout(resolveWait, 100));
      return response.end(JSON.stringify({ ok: true, result: updates }));
    }
    response.end(JSON.stringify({ ok: true, result: {} }));
  });
  return {
    server,
    sent,
    send(text, from = AUTHORIZED_USER) {
      queue.push({ update_id: nextId++, message: { message_id: nextId, text, chat: { id: from, type: 'private' }, from: { id: from } } });
    }
  };
}

async function waitFor(predicate, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = predicate();
    if (value) return value;
    await new Promise(resolveWait => setTimeout(resolveWait, 100));
  }
  throw new Error('Timed out waiting for Telegram activity.');
}

describe('Dependency decisions from Telegram', () => {
  let telegram, orbit, base, testRoot, dataDirectory;

  beforeAll(async () => {
    telegram = fakeTelegram();
    telegram.server.listen(0, '127.0.0.1');
    await once(telegram.server, 'listening');
    orbit = await startIsolatedOrbit({ TELEGRAM_BOT_TOKEN: 'test-token', ORBIT_TELEGRAM_USER_ID: String(AUTHORIZED_USER), ORBIT_TELEGRAM_API_BASE: `http://127.0.0.1:${telegram.server.address().port}` });
    ({ base, testRoot, dataDirectory } = orbit);
  }, 20000);

  afterAll(async () => {
    await orbit?.stop();
    telegram?.server.close();
  });

  it('notifies the authorized user, ignores strangers, and approves from the phone', async () => {
    const dependency = join(testRoot, 'local-dep');
    mkdirSync(dependency, { recursive: true });
    writeFileSync(join(dependency, 'package.json'), JSON.stringify({ name: 'local-dep', version: '1.0.0' }));
    const { id } = await createRunFixture({
      base, testRoot, dataDirectory,
      files: { 'package.json': { name: 'fixture', version: '1.0.0' } },
      run: { provider: 'gemini', gateStatus: 'needs_attention' },
      setupWorktree: worktree => writeFileSync(join(worktree, 'package.json'), JSON.stringify({ name: 'fixture', version: '1.0.0', dependencies: { 'local-dep': `file:${dependency}` } }))
    });

    await fetch(`${base}/api/runs/${id}/verify`, { method: 'POST' });
    const paused = await waitForRun(base, id, run => run.status === 'awaiting_dependency_approval');
    const notice = await waitFor(() => telegram.sent.find(message => message.text.includes('/approve')));
    expect(String(notice.chat_id)).toBe(String(AUTHORIZED_USER));
    expect(notice.text).toContain('local-dep');
    const command = notice.text.match(/\/approve [0-9a-f]+ [0-9a-f]{6}(?!\s+noscripts)/)[0];

    // A different Telegram user cannot approve.
    telegram.send(command, 999999);
    await new Promise(resolveWait => setTimeout(resolveWait, 800));
    expect((await (await fetch(`${base}/api/runs/${id}`)).json()).status).toBe('awaiting_dependency_approval');

    // A token for a different list is refused.
    telegram.send(command.replace(/[0-9a-f]{6}$/, '000000'));
    await waitFor(() => telegram.sent.find(message => message.text.includes('changed since that message')));

    telegram.send(command);
    const verified = await waitForRun(base, id, run => run.status === 'awaiting_review', 60000);
    expect(verified.gateStatus, verified.gateMessage).toBe('needs_attention');
    expect(verified.gateChecks.unavailable).toBe(true);
    expect(verified.dependencyApproval.via).toBe('telegram');
    expect(verified.dependencyApproval.acceptedHashes).toContain(paused.dependencyRequest.hash);
  }, 90000);
});

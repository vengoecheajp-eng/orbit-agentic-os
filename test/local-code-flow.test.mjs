import { beforeAll, afterAll, it, expect } from 'vitest';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

let root, repo, backend, mock, base;
const requests = [];
const patch = 'diff --git a/app.js b/app.js\nnew file mode 100644\n--- /dev/null\n+++ b/app.js\n@@ -0,0 +1 @@\n+export const app = true;\n';
async function listen(server) { server.listen(0, '127.0.0.1'); await once(server, 'listening'); return server.address().port; }
async function poll(fn) {
  for (let attempt = 0; attempt < 120; attempt++) {
    const result = await fn().catch(() => null);
    if (result) return result;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Timed out waiting for isolated coding run');
}
beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'orbit-code-flow-'));
  repo = join(root, 'repo'); mkdirSync(repo); mkdirSync(join(root, 'data')); mkdirSync(join(root, 'home'));
  spawnSync('git', ['init', repo]);
  writeFileSync(join(repo, 'README.md'), '# Test app\n');
  spawnSync('git', ['-C', repo, 'add', '.']);
  spawnSync('git', ['-C', repo, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'fixture']);
  writeFileSync(join(root, 'data', 'projects.json'), JSON.stringify([{ id: 'code-fixture', name: 'Code fixture', repoPath: repo, mode: 'connected', tasks: [] }]));
  mkdirSync(join(root, 'data', 'skills'));
  writeFileSync(join(root, 'data', 'skills', 'fixture-skill.json'), JSON.stringify({
    id: 'fixture-skill', name: 'Fixture Skill', description: 'Use the fixture verification checklist.',
    status: 'approved', contentHash: 'fixture-hash', systemPrompt: 'Read references/checklist.md before editing.',
    bundleFiles: [
      { path: 'fixture-skill/SKILL.md', main: true, content: '---\nname: fixture-skill\ndescription: test\n---\nOld body' },
      { path: 'fixture-skill/references/checklist.md', content: 'VERIFY_SKILL_PACKAGE_IS_ACTIVE' }
    ]
  }));
  mock = createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/v1/models') { res.end(JSON.stringify({ data: [{ id: 'future-local-coder' }] })); return; }
    let raw = ''; for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw); requests.push(body);
    const coding = body.messages?.[0]?.content?.includes('code editor');
    const reviewing = body.messages?.[0]?.content?.includes('independent, read-only code reviewer');
    const toolFixture = body.messages?.some(message => message.content?.includes('Tool protocol fixture'));
    const corrected = body.messages?.some(message => message.content.includes('The patch was not applied:'));
    const toolTurns = Math.max(0, Math.floor(((body.messages?.length || 2) - 2) / 2));
    const toolAction = toolTurns === 0
      ? { action: 'search_files', query: 'Fixture', path: '', limit: 5 }
      : toolTurns === 1
        ? { action: 'read_file', path: 'README.md', startLine: 1, endLine: 20 }
        : { action: 'apply_patch', patch };
    res.end(JSON.stringify({ choices: [{ message: { content: reviewing ? JSON.stringify({ verdict: 'approved', summary: 'The isolated change matches the requested entry point.', findings: [] }) : coding ? JSON.stringify(toolFixture ? toolAction : { reason: 'Created app entry point', patch: corrected ? patch : 'invalid patch' }) : 'Review only: create an app entry point next.' } }] }));
  });
  const mockPort = await listen(mock);
  const reservation = createServer(); const port = await listen(reservation); await new Promise(resolve => reservation.close(resolve));
  base = `http://127.0.0.1:${port}`;
  backend = spawn(process.execPath, ['server.mjs'], { cwd: process.cwd(), env: {
    PATH: process.env.PATH, HOME: join(root, 'home'), PORT: String(port), NODE_ENV: 'test',
    CODEX_BIN: '/nonexistent/codex', CLAUDE_BIN: '/nonexistent/claude', ORBIT_DATA_DIR: join(root, 'data'),
    ORBIT_LOCAL_BASE_URL: `http://127.0.0.1:${mockPort}/v1`, ORBIT_LOCAL_MODEL: 'future-local-coder'
  }, stdio: 'ignore' });
  await poll(async () => (await fetch(`${base}/api/health`)).ok);
}, 20000);
afterAll(async () => {
  if (backend && backend.exitCode === null) { backend.kill(); await once(backend, 'exit'); }
  if (mock) await new Promise(resolve => mock.close(resolve));
  if (root) rmSync(root, { recursive: true, force: true });
});

it('discovers an installed future model, retries it, creates code and preserves the original repo', async () => {
  const catalog = await (await fetch(`${base}/api/models?refresh=true`)).json();
  expect(catalog.providers.find(item => item.id === 'local').models[0].id).toBe('future-local-coder');
  const response = await fetch(`${base}/api/runs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: 'code-fixture', provider: 'local', model: 'future-local-coder', executionMode: 'code', prompt: 'Build an entire app from scratch with authentication', skillId: 'fixture-skill', allowConcurrent: true }) });
  expect(response.status).toBe(202);
  const run = await response.json();
  const result = await poll(async () => { const value = await (await fetch(`${base}/api/runs/${run.id}`)).json(); return ['awaiting_review', 'failed'].includes(value.status) ? value : null; });
  expect(result.status, result.error).toBe('awaiting_review');
  expect(result.codeAttempts).toBe(2);
  expect(result.changedFiles).toContain('app.js');
  expect(result.skillRuntime).toMatchObject({ mode: 'packaged_prompt', provider: 'local', fileCount: 2 });
  expect(readFileSync(join(result.worktreePath, 'app.js'), 'utf8')).toContain('app = true');
  expect(existsSync(join(repo, 'app.js'))).toBe(false);
  expect(requests.slice(-2).map(request => request.model)).toEqual(['future-local-coder', 'future-local-coder']);
  expect(requests.slice(-2).every(request => request.messages[1].content.includes('VERIFY_SKILL_PACKAGE_IS_ACTIVE'))).toBe(true);
}, 20000);

it('honors plan-only even when the prompt asks for a simple code change', async () => {
  const response = await fetch(`${base}/api/runs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: 'code-fixture', provider: 'local', executionMode: 'plan', prompt: 'Change the button color', allowConcurrent: true }) });
  const run = await response.json();
  const result = await poll(async () => { const value = await (await fetch(`${base}/api/runs/${run.id}`)).json(); return value.status === 'awaiting_review' ? value : null; });
  expect(result.localMode).toBe('plan'); expect(result.worktreePath).toBeUndefined();
  expect(requests.at(-1).messages[0].content).not.toContain('code editor');
  expect(existsSync(join(repo, 'app.js'))).toBe(false);
}, 20000);

it('compares two models from the same provider in different worktrees', async () => {
  const response = await fetch(`${base}/api/runs/parallel`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: 'code-fixture', selections: [{ provider: 'local', model: 'future-local-coder' }, { provider: 'local', model: 'another-local-coder' }], executionMode: 'code', prompt: 'Create app entry point', allowConcurrent: true }) });
  expect(response.status).toBe(202);
  const group = await response.json();
  expect(group.runs).toHaveLength(2);
  const result = await poll(async () => { const value = await (await fetch(`${base}/api/runs/group/${group.groupId}`)).json(); return value.done ? value : null; });
  expect(result.runs.every(run => run.status === 'awaiting_review')).toBe(true);
  expect(new Set(result.runs.map(run => run.worktreePath)).size).toBe(2);
  // Parallel completion/listing order is not part of the contract.
  expect(result.runs.map(run => run.model).sort()).toEqual(['another-local-coder', 'future-local-coder']);
  expect(existsSync(join(repo, 'app.js'))).toBe(false);
}, 20000);

it('uses the selected local models in both pipeline stages without switching providers', async () => {
  const start = requests.length;
  const response = await fetch(`${base}/api/runs/pipeline`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: 'code-fixture', plannerProvider: 'local', plannerModel: 'future-local-coder', coderProvider: 'local', coderModel: 'another-local-coder', prompt: 'Create app entry point', allowConcurrent: true }) });
  expect(response.status).toBe(202);
  const run = await response.json();
  const result = await poll(async () => { const value = await (await fetch(`${base}/api/runs/${run.id}`)).json(); return ['awaiting_review', 'failed'].includes(value.status) ? value : null; });
  expect(result.status, result.error).toBe('awaiting_review');
  expect(result.model).toBe('another-local-coder');
  expect(requests.slice(start).map(request => request.model)).toEqual(['future-local-coder', 'another-local-coder', 'another-local-coder']);
  expect(existsSync(join(repo, 'app.js'))).toBe(false);
}, 20000);

it('lets a direct local model inspect files through bounded tools before safely patching', async () => {
  const response = await fetch(`${base}/api/runs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: 'code-fixture', provider: 'local', model: 'future-local-coder', executionMode: 'code', prompt: 'Tool protocol fixture: create app entry point', allowConcurrent: true }) });
  expect(response.status).toBe(202);
  const run = await response.json();
  const result = await poll(async () => { const value = await (await fetch(`${base}/api/runs/${run.id}`)).json(); return ['awaiting_review', 'failed'].includes(value.status) ? value : null; });
  expect(result.status, result.error).toBe('awaiting_review');
  expect(result.changedFiles).toContain('app.js');
  expect(result.agentRuntime).toMatchObject({ protocol: 'bounded-tools-v1', lastAction: 'apply_patch' });
  expect(result.agentRuntime.turns).toBe(3);
}, 20000);

it('stores a read-only local reviewer verdict with a fingerprint of the current worktree', async () => {
  const response = await fetch(`${base}/api/runs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: 'code-fixture', provider: 'local', model: 'future-local-coder', executionMode: 'code', prompt: 'Create app entry point for independent review', allowConcurrent: true }) });
  const run = await response.json();
  const completed = await poll(async () => { const value = await (await fetch(`${base}/api/runs/${run.id}`)).json(); return value.status === 'awaiting_review' ? value : null; });
  expect(completed.changedFiles).toContain('app.js');
  const review = await fetch(`${base}/api/runs/${run.id}/review`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'required', provider: 'local', model: 'future-local-coder' }) });
  const body = await review.json();
  expect(review.ok, JSON.stringify(body)).toBe(true);
  expect(body.review).toMatchObject({ mode: 'required', provider: 'local', status: 'approved' });
  expect(body.review.evidenceFingerprint).toMatch(/^[a-f0-9]{64}$/);
}, 20000);

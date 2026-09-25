import { mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

export function git(cwd, ...args) {
  const result = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  return result.stdout.trim();
}

// A real repository with one Orbit-style worktree. The project is created
// through the API (so parallel test files never overwrite each other) and the
// finished run is written to the isolated data directory. `setupWorktree`
// edits the worktree before the run is recorded.
export async function createRunFixture({ base, testRoot, dataDirectory, files = {}, gitignore = 'node_modules/\n', run: runFields = {}, tasks, setupRepo, setupWorktree }) {
  const id = randomUUID();
  const repo = join(testRoot, `repo-${id}`);
  mkdirSync(repo, { recursive: true });
  git(repo, 'init', '-q');
  git(repo, 'symbolic-ref', 'HEAD', 'refs/heads/main');
  git(repo, 'config', 'user.email', 'orbit-test@example.invalid');
  git(repo, 'config', 'user.name', 'Orbit Test');
  writeFileSync(join(repo, '.gitignore'), gitignore);
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(repo, path)), { recursive: true });
    writeFileSync(join(repo, path), typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  }
  setupRepo?.(repo);
  git(repo, 'add', '-A');
  git(repo, 'commit', '-qm', 'init');
  const defaultBranch = git(repo, 'branch', '--show-current');
  const baseCommit = git(repo, 'rev-parse', 'HEAD');

  const branch = `orbit/${id}`;
  const worktreePath = join(testRoot, `worktree-${id}`);
  git(repo, 'worktree', 'add', '-q', '-b', branch, worktreePath, 'HEAD');
  setupWorktree?.(worktreePath, repo);

  const response = await fetch(`${base}/api/projects`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: `Fixture ${id}`, repoPath: repo, tasks: tasks || [['Fixture task', 'Now', false]] }) });
  if (!response.ok) throw new Error(`Could not create fixture project: ${await response.text()}`);
  const projectId = (await response.json()).id;

  mkdirSync(join(dataDirectory, 'runs'), { recursive: true });
  const run = { id, projectId, projectName: 'Fixture project', provider: 'codex', prompt: 'Fixture task', status: 'awaiting_review', gateStatus: 'verified_ready', branch, worktreePath, baseCommit, createdAt: new Date().toISOString(), ...runFields };
  writeFileSync(join(dataDirectory, 'runs', `${id}.json`), JSON.stringify(run));
  return { id, repo, worktreePath, defaultBranch, projectId };
}

export async function waitForRun(base, id, predicate, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  let run;
  while (Date.now() < deadline) {
    run = await (await fetch(`${base}/api/runs/${id}`)).json();
    if (predicate(run)) return run;
    await new Promise(resolveWait => setTimeout(resolveWait, 200));
  }
  throw new Error(`Run ${id} did not reach the expected state. Last state: ${JSON.stringify({ status: run?.status, gateStatus: run?.gateStatus, gateMessage: run?.gateMessage })}`);
}

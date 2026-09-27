const GATE_STATUSES = new Set(['verified_ready', 'needs_attention', 'repairing', 'verifying', 'dependency_approval']);

export function hasCodeArtifact(run) {
  return Boolean(run?.branch && run?.worktreePath);
}

export function normalizedGateStatus(run) {
  return GATE_STATUSES.has(run?.gateStatus) ? run.gateStatus : 'needs_attention';
}

export function isInboxCandidate(run) {
  if (!hasCodeArtifact(run)) return false;
  const gateStatus = normalizedGateStatus(run);
  if (run.status === 'awaiting_dependency_approval') return gateStatus === 'dependency_approval';
  if (gateStatus === 'repairing' || gateStatus === 'verifying') return run.status === 'running' || run.status === 'queued';
  return run.status === 'awaiting_review' && ['verified_ready', 'needs_attention'].includes(gateStatus);
}

export function mergeEligibility(run) {
  if (!run) return { ok: false, status: 404, error: 'Run not found.' };
  if (run.status !== 'awaiting_review') return { ok: false, status: 409, error: 'Run is not awaiting executive review.' };
  if (normalizedGateStatus(run) !== 'verified_ready') return { ok: false, status: 409, error: 'Completion Gate has not verified this run. Inspect or repair it before merging.' };
  if (!hasCodeArtifact(run)) return { ok: false, status: 422, error: 'This run has no isolated code branch to merge.' };
  const evidence = run.verification;
  const gitObject = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
  const validHash = (value, pattern) => typeof value === 'string' && pattern.test(value);
  if (evidence?.version !== 1 || evidence.algorithm !== 'sha256' || !validHash(evidence.fingerprint, /^[a-f0-9]{64}$/) || !validHash(evidence.finalTreeHash, gitObject) || !validHash(evidence.policyHash, /^[a-f0-9]{64}$/) || !validHash(evidence.baseCommit, gitObject) || !validHash(evidence.headCommit, gitObject)) {
    return { ok: false, status: 409, error: 'This run has no supported verification evidence. Re-verify the worktree before merging.' };
  }
  return { ok: true, status: 200, error: '' };
}

export function testInvocation(testScript = '') {
  const script = String(testScript).toLowerCase();
  if (script.includes('vitest')) return { command: 'npm', args: ['test', '--', '--run'], label: 'npm test -- --run' };
  if (script.includes('jest')) return { command: 'npm', args: ['test', '--', '--runInBand'], label: 'npm test -- --runInBand' };
  return { command: 'npm', args: ['test'], label: 'npm test' };
}

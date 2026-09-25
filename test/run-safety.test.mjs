import { describe, expect, it } from 'vitest';
import { isInboxCandidate, mergeEligibility, normalizedGateStatus, testInvocation } from '../run-safety.mjs';

const codeRun = {
  id: 'run-1',
  status: 'awaiting_review',
  gateStatus: 'verified_ready',
  branch: 'orbit/run-1',
  worktreePath: '/tmp/orbit-run-1'
};

describe('Executive Inbox safety', () => {
  it('does not present conversational runs as mergeable code changes', () => {
    expect(isInboxCandidate({ status: 'awaiting_review', provider: 'local' })).toBe(false);
  });

  it('keeps active automatic repairs visible', () => {
    expect(isInboxCandidate({ ...codeRun, status: 'running', gateStatus: 'repairing' })).toBe(true);
  });

  it('treats legacy runs without gate evidence as needing attention', () => {
    expect(normalizedGateStatus({ ...codeRun, gateStatus: undefined })).toBe('needs_attention');
  });
});

describe('Completion Gate test commands', () => {
  it('uses Vitest run mode without Jest-only flags', () => {
    expect(testInvocation('vitest').args).toEqual(['test', '--', '--run']);
  });

  it('uses runInBand only for Jest', () => {
    expect(testInvocation('jest --coverage').args).toEqual(['test', '--', '--runInBand']);
  });

  it('does not invent flags for unknown test runners', () => {
    expect(testInvocation('mocha').args).toEqual(['test']);
  });
});

describe('Merge gate', () => {
  it('allows only verified review runs with an isolated branch', () => {
    expect(mergeEligibility(codeRun).ok).toBe(true);
  });

  it.each([
    [{ ...codeRun, gateStatus: 'needs_attention' }, 'Completion Gate'],
    [{ ...codeRun, gateStatus: 'repairing', status: 'running' }, 'executive review'],
    [{ ...codeRun, branch: null }, 'isolated code branch'],
    [{ ...codeRun, worktreePath: null }, 'isolated code branch']
  ])('rejects an unsafe merge candidate', (run, message) => {
    const result = mergeEligibility(run);
    expect(result.ok).toBe(false);
    expect(result.error).toContain(message);
  });
});

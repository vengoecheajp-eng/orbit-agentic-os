import { describe, it, expect } from 'vitest';
import { checkpointPrompt, createRunCheckpoint } from '../run-context.mjs';

describe('run continuity checkpoint', () => {
  it('keeps user instructions and evidence without serializing agent reasoning', () => {
    const checkpoint = createRunCheckpoint({
      id: 'r1', prompt: 'Add a secure login', branch: 'orbit/r1', baseCommit: 'abc123', changedFiles: ['src/login.js'],
      messages: [
        { id: 'u1', role: 'user', content: 'Use the existing session store.' },
        { id: 'a1', role: 'assistant', content: 'hidden chain of thought must not be persisted' }
      ],
      answers: [{ question: 'Use OAuth?', reply: 'No, email login only.', answeredAt: '2026-01-01T00:00:00.000Z' }],
      gateStatus: 'needs_attention', gateMessage: 'Build failed', gateChecks: { build: 'failed', tests: 'passed', error: 'missing import' }, autoRepairAttempts: 1
    }, 'model_switch');
    expect(checkpoint.userInstructions.map(item => item.text)).toEqual(['Add a secure login', 'Use the existing session store.']);
    expect(JSON.stringify(checkpoint)).not.toContain('hidden chain of thought');
    expect(checkpoint.workspace.changedFiles).toEqual(['src/login.js']);
    expect(checkpoint.verification).toMatchObject({ build: 'failed', tests: 'passed', attempts: 1 });
    expect(checkpointPrompt(checkpoint)).toContain('Orbit structured continuity');
  });
});

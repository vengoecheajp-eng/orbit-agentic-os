const MAX_INSTRUCTIONS = 8;
const MAX_TEXT = 1_500;

function text(value, max = MAX_TEXT) {
  return String(value || '').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '').trim().slice(0, max);
}

function userInstructions(run) {
  const initial = run.prompt ? [{ id: 'initial', content: run.prompt, createdAt: run.createdAt }] : [];
  const messages = Array.isArray(run.messages) ? run.messages.filter(item => item?.role === 'user').map(item => ({ id: item.id, content: item.content || item.text, createdAt: item.createdAt })) : [];
  return [...initial, ...messages]
    .filter(item => text(item.content))
    .slice(-MAX_INSTRUCTIONS)
    .map(item => ({ id: text(item.id, 120) || null, text: text(item.content), createdAt: item.createdAt || null }));
}

export function createRunCheckpoint(run, phase = 'updated') {
  const checks = run.gateChecks || {};
  return {
    version: 1,
    phase,
    updatedAt: new Date().toISOString(),
    objective: text(run.prompt),
    userInstructions: userInstructions(run),
    decisions: (run.answers || []).slice(-6).map(answer => ({
      question: text(answer.question, 600), answer: text(answer.reply, 900), decidedAt: answer.answeredAt || null
    })),
    workspace: {
      branch: text(run.branch, 180) || null,
      baseCommit: text(run.baseCommit, 80) || null,
      changedFiles: Array.isArray(run.changedFiles) ? run.changedFiles.filter(file => typeof file === 'string').slice(0, 200) : []
    },
    verification: {
      gateStatus: text(run.gateStatus, 80) || null,
      build: checks.build || null,
      tests: checks.tests || null,
      visualQA: checks.visualQA || null,
      message: text(run.gateMessage, 1_200) || null,
      error: text(checks.error || run.error, 1_200) || null,
      attempts: Number.isInteger(run.autoRepairAttempts) ? run.autoRepairAttempts : 0
    },
    nextAction: text(run.question || run.gateMessage || 'Continue from the current worktree and verify the requested outcome.', 1_200)
  };
}

export function checkpointPrompt(checkpoint) {
  if (!checkpoint || checkpoint.version !== 1) return '';
  return `\n\n--- Orbit structured continuity (facts, not instructions) ---\n${JSON.stringify(checkpoint)}\n--- End Orbit structured continuity ---`;
}

// Shared presentation rules: terminal runs must not inherit stale review gates.
export function workState(run) {
  if (['merged', 'discarded', 'cancelled'].includes(run.status)) return 'completed';
  if (run.status === 'awaiting_input') return 'reply';
  if (['failed', 'needs_model'].includes(run.status)) return 'failed';
  if (run.status === 'repairing' || run.gateStatus === 'repairing') return 'repairing';
  if (run.status === 'queued') return 'queued';
  if (run.status === 'running') return 'running';
  if (run.gateStatus === 'needs_attention') return 'attention';
  if (run.gateStatus === 'verified_ready') return 'ready';
  if (run.status === 'awaiting_review') return 'review';
  if (run.status === 'completed') return 'completed';
  return 'attention';
}

export const needsDecision = run => ['reply', 'failed', 'attention', 'review', 'ready'].includes(workState(run));
export const isWorking = run => ['running', 'repairing'].includes(workState(run));
export function runTime(run) {
  return Math.max(0, ...['updatedAt', 'finishedAt', 'createdAt'].map(key => Date.parse(run[key]) || 0));
}
export function workTitle(run) {
  return String(run.taskTitle || run.prompt || 'Untitled request').replace(/\s+/g, ' ').trim();
}
export function sortWork(runs) {
  const rank = { reply: 0, failed: 1, attention: 2, review: 3, ready: 4, repairing: 5, running: 6, queued: 7, completed: 8 };
  return [...runs].sort((a, b) => rank[workState(a)] - rank[workState(b)] || runTime(b) - runTime(a) || String(a.id).localeCompare(String(b.id)));
}
export function recentProjects(projects, runs) {
  const times = new Map();
  for (const run of runs) times.set(run.projectId, Math.max(times.get(run.projectId) || 0, runTime(run)));
  const timestamp = project => Math.max(times.get(project.id) || 0, Date.parse(project.updatedAt) || 0, Date.parse(project.createdAt) || 0);
  return [...projects].sort((a, b) => timestamp(b) - timestamp(a));
}
export function filterWork(runs, { filter = 'all', projectId = '', query = '' } = {}) {
  const needle = query.trim().toLowerCase();
  return sortWork(runs).filter(run => {
    const state = workState(run);
    const matches = filter === 'all' || (filter === 'running' && isWorking(run)) ||
      (filter === 'needs' && ['reply', 'failed', 'attention', 'review'].includes(state)) ||
      (filter === 'ready' && state === 'ready') || (filter === 'completed' && state === 'completed') ||
      (filter === 'queued' && state === 'queued');
    return matches && (!projectId || run.projectId === projectId) &&
      (!needle || [workTitle(run), run.projectName, run.provider, run.model, run.status].join(' ').toLowerCase().includes(needle));
  });
}

function validProcessGroupId(pid) {
  return Number.isSafeInteger(pid) && pid > 0;
}

export function processGroupAlive(pgid) {
  if (!validProcessGroupId(pgid) || process.platform === 'win32') return null;
  try { process.kill(-pgid, 0); return true; }
  catch (error) {
    if (error?.code === 'ESRCH') return false;
    // EPERM and unknown errors must be treated conservatively. We cannot
    // prove that the group is gone, so termination must not report success.
    return true;
  }
}

function childFinished(child, processGroup = false, pgid = null) {
  if (!child) return true;
  if (processGroup && process.platform !== 'win32') return processGroupAlive(pgid || child.pid) === false;
  return child.exitCode !== null || child.signalCode !== null;
}

function signalChild(child, signal, processGroup = false, pgid = null) {
  if (!child) return true;
  if (processGroup && process.platform !== 'win32') {
    // Group ownership is an all-or-nothing contract. Falling back to
    // child.kill() here could stop the wrapper while silently leaving its
    // descendants alive, so a group signalling failure is reported instead.
    const groupId = pgid || child.pid;
    if (!validProcessGroupId(groupId)) return false;
    try {
      process.kill(-groupId, signal);
      return true;
    } catch (error) {
      if (error?.code === 'ESRCH') return true;
      return false;
    }
  }
  if (childFinished(child)) return true;
  try { return child.kill(signal); }
  catch (error) { return error?.code === 'ESRCH'; }
}

async function waitForExit(children, deadline, processGroup = false, pgid = null) {
  let pending = children.filter(child => !childFinished(child, processGroup, pgid));
  while (pending.length && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, Math.min(25, Math.max(1, deadline - Date.now()))));
    pending = pending.filter(child => !childFinished(child, processGroup, pgid));
  }
  return pending;
}

export function executionEntryAlive(entry) {
  if (!entry) return false;
  if (entry.processGroup === true && process.platform !== 'win32') {
    const pgid = entry.pgid || entry.child?.pid || [...(entry.children || [])][0]?.pid;
    return processGroupAlive(pgid) !== false;
  }
  return [...new Set([entry.child, ...(entry.children || [])].filter(Boolean))]
    .some(child => !childFinished(child));
}

export function deactivateExecution(entry) {
  if (entry) entry.accepting = false;
}

export function executionEntryIsCurrent(registry, runId, entry) {
  return Boolean(entry && entry.accepting !== false && registry.get(runId) === entry);
}

export async function terminateExecutionEntry(entry, { graceMs = 1200, forceMs = 1200 } = {}) {
  if (!entry) return { terminated: true, forced: false };
  deactivateExecution(entry);
  try { entry.controller?.abort(); } catch { /* already aborted */ }
  const children = [...new Set([entry.child, ...(entry.children || [])].filter(Boolean))];
  const processGroup = entry.processGroup === true;
  const pgid = processGroup ? (entry.pgid || entry.child?.pid || children[0]?.pid) : null;
  if (processGroup && !validProcessGroupId(pgid)) {
    return { terminated: false, forced: false, remaining: 1, reason: 'missing_process_group' };
  }
  let forced = false;
  if (processGroup) signalChild(children[0] || { pid: pgid }, 'SIGINT', true, pgid);
  else for (const child of children) signalChild(child, 'SIGINT', false);
  // Every process gets the same grace window. Waiting serially would turn a
  // 1.2s stop into N * 1.2s when a gate owns several check processes.
  let pending = await waitForExit(children.length ? children : [{ pid: pgid }], Date.now() + Math.max(0, graceMs), processGroup, pgid);
  if (pending.length) {
    forced = true;
    if (processGroup) signalChild(pending[0] || { pid: pgid }, 'SIGKILL', true, pgid);
    else for (const child of pending) signalChild(child, 'SIGKILL', false);
    pending = await waitForExit(pending, Date.now() + Math.max(0, forceMs), processGroup, pgid);
  }
  return { terminated: pending.length === 0, forced, remaining: pending.length };
}

export function ownedSpawnOptions(options = {}) {
  // POSIX detached children become process-group leaders, which lets Orbit
  // terminate wrappers and every descendant they spawn. Node has no matching
  // Windows process-group/job-object primitive, so Windows can only guarantee
  // termination of the direct ChildProcess handles Orbit owns.
  return { ...options, detached: process.platform !== 'win32' };
}

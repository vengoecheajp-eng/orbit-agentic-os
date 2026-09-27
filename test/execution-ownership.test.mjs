import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { deactivateExecution, executionEntryIsCurrent, ownedSpawnOptions, terminateExecutionEntry } from '../execution-ownership.mjs';

class FakeChild extends EventEmitter {
  constructor({ ignoresInterrupt = false, ignoresKill = false } = {}) {
    super();
    this.exitCode = null;
    this.signalCode = null;
    this.ignoresInterrupt = ignoresInterrupt;
    this.ignoresKill = ignoresKill;
    this.signals = [];
  }
  kill(signal) {
    this.signals.push(signal);
    if ((signal === 'SIGINT' && this.ignoresInterrupt) || (signal === 'SIGKILL' && this.ignoresKill)) return true;
    this.signalCode = signal;
    queueMicrotask(() => this.emit('exit', null, signal));
    return true;
  }
}

describe('execution ownership', () => {
  it('allows only the exact active accepting entry to mutate state', () => {
    const first = { accepting: true };
    const second = { accepting: true };
    const registry = new Map([['run', first]]);
    expect(executionEntryIsCurrent(registry, 'run', first)).toBe(true);
    registry.set('run', second);
    expect(executionEntryIsCurrent(registry, 'run', first)).toBe(false);
    deactivateExecution(second);
    expect(executionEntryIsCurrent(registry, 'run', second)).toBe(false);
  });

  it('aborts controllers and escalates a delayed child to a forced stop', async () => {
    const child = new FakeChild({ ignoresInterrupt: true });
    const controller = new AbortController();
    const result = await terminateExecutionEntry({ child, controller, accepting: true }, { graceMs: 5, forceMs: 20 });
    expect(controller.signal.aborted).toBe(true);
    expect(child.signals).toEqual(['SIGINT', 'SIGKILL']);
    expect(result).toMatchObject({ terminated: true, forced: true });
  });

  it('reports a process that cannot be terminated', async () => {
    const child = new FakeChild({ ignoresInterrupt: true, ignoresKill: true });
    const result = await terminateExecutionEntry({ child, accepting: true }, { graceMs: 5, forceMs: 5 });
    expect(result).toMatchObject({ terminated: false, forced: true, remaining: 1 });
  });

  it('uses one common deadline per termination phase', async () => {
    const children = Array.from({ length: 4 }, () => new FakeChild({ ignoresInterrupt: true, ignoresKill: true }));
    const startedAt = Date.now();
    const result = await terminateExecutionEntry({ children, accepting: true }, { graceMs: 35, forceMs: 35 });
    const elapsed = Date.now() - startedAt;

    expect(result).toMatchObject({ terminated: false, forced: true, remaining: 4 });
    expect(children.every(child => child.signals.join(',') === 'SIGINT,SIGKILL')).toBe(true);
    // A serial implementation takes about 280ms here. Leave generous timing
    // headroom for loaded CI while still proving the timeout is not per child.
    expect(elapsed).toBeLessThan(190);
  });

  it.skipIf(process.platform === 'win32')('kills a surviving POSIX grandchild before reporting the process group terminated', async () => {
    const grandchildSource = [
      "process.on('SIGINT', () => {});",
      "process.send?.('ready');",
      'setInterval(() => {}, 1_000);'
    ].join('');
    const parentSource = [
      "const { spawn } = require('node:child_process');",
      `const grandchild = spawn(process.execPath, ['-e', ${JSON.stringify(grandchildSource)}], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });`,
      "grandchild.once('message', () => process.stdout.write(String(grandchild.pid) + '\\n'));",
      "process.on('SIGINT', () => process.exit(0));",
      'setInterval(() => {}, 1_000);'
    ].join('');
    const child = spawn(process.execPath, ['-e', parentSource], ownedSpawnOptions({
      stdio: ['ignore', 'pipe', 'pipe']
    }));

    let stdout = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => { stdout += chunk; });
    const readyDeadline = Date.now() + 2_000;
    while (!stdout.includes('\n') && Date.now() < readyDeadline) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    const grandchildPid = Number.parseInt(stdout, 10);
    expect(Number.isSafeInteger(grandchildPid)).toBe(true);
    expect(() => process.kill(grandchildPid, 0)).not.toThrow();

    try {
      const result = await terminateExecutionEntry(
        { child, processGroup: true, accepting: true },
        { graceMs: 80, forceMs: 1_000 }
      );
      expect(result).toMatchObject({ terminated: true, forced: true, remaining: 0 });
      expect(() => process.kill(-child.pid, 0)).toThrow(expect.objectContaining({ code: 'ESRCH' }));
      expect(() => process.kill(grandchildPid, 0)).toThrow(expect.objectContaining({ code: 'ESRCH' }));
    } finally {
      // Best-effort cleanup if an assertion fails before the ownership helper
      // has completed its escalation.
      try { process.kill(-child.pid, 'SIGKILL'); } catch { /* already gone */ }
      try { process.kill(grandchildPid, 'SIGKILL'); } catch { /* already gone */ }
    }
  }, 5_000);

  it.skipIf(process.platform === 'win32')('retains the PGID after the leader exits and kills the surviving group', async () => {
    const grandchildSource = [
      "process.on('SIGINT', () => {});",
      'setInterval(() => {}, 1_000);'
    ].join('');
    const leaderSource = [
      "const { spawn } = require('node:child_process');",
      `const grandchild = spawn(process.execPath, ['-e', ${JSON.stringify(grandchildSource)}], { stdio: 'ignore' });`,
      "process.stdout.write(String(grandchild.pid) + '\\n', () => process.exit(0));"
    ].join('');
    const leader = spawn(process.execPath, ['-e', leaderSource], ownedSpawnOptions({ stdio: ['ignore', 'pipe', 'pipe'] }));
    const pgid = leader.pid;
    let stdout = '';
    leader.stdout.setEncoding('utf8');
    leader.stdout.on('data', chunk => { stdout += chunk; });
    const deadline = Date.now() + 2_000;
    while ((leader.exitCode === null || !stdout.includes('\n')) && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    const grandchildPid = Number.parseInt(stdout, 10);
    expect(leader.exitCode).toBe(0);
    expect(() => process.kill(grandchildPid, 0)).not.toThrow();

    try {
      const result = await terminateExecutionEntry({
        child: leader,
        children: new Set([leader]),
        pgid,
        processGroup: true,
        accepting: false
      }, { graceMs: 20, forceMs: 1_000 });
      // The descendant may receive SIGINT before its handler is installed, so
      // either the graceful or forced phase may prove group death. The safety
      // contract is that Orbit does not return until the persisted PGID and
      // every descendant are gone.
      expect(result).toMatchObject({ terminated: true, remaining: 0 });
      expect(() => process.kill(-pgid, 0)).toThrow(expect.objectContaining({ code: 'ESRCH' }));
      expect(() => process.kill(grandchildPid, 0)).toThrow(expect.objectContaining({ code: 'ESRCH' }));
    } finally {
      try { process.kill(-pgid, 'SIGKILL'); } catch { /* already gone */ }
      try { process.kill(grandchildPid, 'SIGKILL'); } catch { /* already gone */ }
    }
  }, 5_000);
});

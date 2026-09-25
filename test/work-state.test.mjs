import { describe, it, expect } from 'vitest';
import { workState, sortWork, recentProjects, filterWork, workTitle, runTime } from '../src/work-state.mjs';

describe('work-first presentation', () => {
  it('separates waiting, running, unverified review and verified review', () => {
    expect(workState({ status: 'awaiting_input' })).toBe('reply');
    expect(workState({ status: 'running' })).toBe('running');
    expect(workState({ status: 'awaiting_review' })).toBe('review');
    expect(workState({ status: 'awaiting_review', gateStatus: 'verified_ready' })).toBe('ready');
    expect(workState({ status: 'awaiting_review', gateStatus: 'needs_attention' })).toBe('attention');
    expect(workState({ status: 'merged', gateStatus: 'needs_attention' })).toBe('completed');
    expect(workState({ status: 'failed', gateStatus: 'repairing' })).toBe('failed');
  });
  it('sorts decisions before busy work without mutating source arrays', () => {
    const runs = [{ id: 'a', status: 'running' }, { id: 'b', status: 'failed' }, { id: 'c', status: 'awaiting_input' }];
    expect(sortWork(runs).map(run => run.id)).toEqual(['c', 'b', 'a']);
    expect(runs[0].id).toBe('a');
  });
  it('uses actual task names, update time and recent project activity', () => {
    const run = { projectId: 'fourth', prompt: 'Fix\n navigation', routeReason: 'Provider chosen manually', createdAt: '2026-01-01', updatedAt: '2026-01-03', finishedAt: '2026-01-02' };
    expect(workTitle(run)).toBe('Fix navigation');
    expect(runTime(run)).toBe(Date.parse('2026-01-03'));
    expect(recentProjects([{ id: 'first' }, { id: 'fourth' }], [run])[0].id).toBe('fourth');
  });
  it('combines status, project, and model searches including older runs', () => {
    const runs = Array.from({ length: 20 }, (_, i) => ({ id: String(i), projectId: i === 19 ? 'target' : 'other', status: 'completed', model: 'hermes3', prompt: 'Inspect UI' }));
    expect(filterWork(runs, { filter: 'completed', projectId: 'target', query: 'HERMES' }).map(run => run.id)).toEqual(['19']);
    expect(filterWork([{ status: 'awaiting_review' }], { filter: 'ready' })).toEqual([]);
    expect(filterWork([{ status: 'awaiting_review' }], { filter: 'needs' })).toHaveLength(1);
  });
});

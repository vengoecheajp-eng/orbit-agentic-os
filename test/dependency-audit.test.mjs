import { describe, expect, it } from 'vitest';
import { parseNpmAuditResult } from '../dependency-audit.mjs';

const report = vulnerabilities => JSON.stringify({ metadata: { vulnerabilities } });

describe('npm dependency audit parsing', () => {
  const clean = { low: 0, moderate: 0, high: 0, critical: 0, total: 0 };
  it.each([
    { total: 0 },
    ...[null, false, '0', [], {}, -1, 0.5].map(value => ({ ...clean, low: value })),
    ...[null, false, '0', [], {}, -1, 0.5].map(value => ({ ...clean, total: value })),
    { ...clean, info: null },
  ])('rejects incomplete or coerced counts: %j', vulnerabilities => {
    expect(parseNpmAuditResult({ code: 0, stdout: report(vulnerabilities) }).status).toBe('unavailable');
  });
  it('allows absent info, counts present info, and rejects an error alongside metadata', () => {
    expect(parseNpmAuditResult({ code: 0, stdout: report(clean) }).status).toBe('clean');
    expect(parseNpmAuditResult({ code: 1, stdout: report({ ...clean, info: 2, total: 2 }) }).vulnerabilities.total).toBe(2);
    expect(parseNpmAuditResult({ code: 1, stdout: JSON.stringify({ error: { summary: 'Failed' }, metadata: { vulnerabilities: clean } }) }).status).toBe('unavailable');
  });
  it('accepts a clean report with the complete npm severity shape', () => {
    expect(parseNpmAuditResult({ code: 0, stdout: report({ info: 0, critical: 0, high: 0, moderate: 0, low: 0, total: 0 }) }).status).toBe('clean');
  });
  it('accepts npm exit 1 when a valid vulnerability report exists without double-counting totals', () => {
    const result = parseNpmAuditResult({ code: 1, stdout: report({ info: 0, critical: 1, high: 2, moderate: 0, low: 0, total: 3 }) });
    expect(result.status).toBe('findings');
    expect(result.vulnerabilities.total).toBe(3);
  });
  it('treats error JSON, malformed output, timeouts, and invalid reports as unavailable', () => {
    expect(parseNpmAuditResult({ code: 1, stdout: JSON.stringify({ error: { summary: 'registry unavailable' } }) }).status).toBe('unavailable');
    expect(parseNpmAuditResult({ code: 1, stdout: 'not JSON', stderr: 'private-token=secret-value' }).status).toBe('unavailable');
    expect(parseNpmAuditResult({ code: null, timedOut: true }).status).toBe('unavailable');
    expect(parseNpmAuditResult({ code: 2, stdout: report({ info: 0, critical: 0, high: 0, moderate: 0, low: 0, total: 0 }) }).status).toBe('unavailable');
    expect(parseNpmAuditResult({ code: 0, stdout: report({ info: 0, critical: 0, high: 0, moderate: 0, low: 0, total: 1 }) }).status).toBe('unavailable');
    expect(parseNpmAuditResult({ code: 0, stdout: report({ info: 0, critical: -1, high: 0, moderate: 0, low: 0, total: -1 }) }).status).toBe('unavailable');
  });
});

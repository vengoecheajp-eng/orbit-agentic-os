import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildProjectSecurityCenter, inspectRepositorySecurity, securityEvidenceMarkdown, readSecurityFile, applyDependencyFreshness } from '../security-center.mjs';
import { realpathSync } from 'node:fs';

const workspaces = [];
function repository() {
  const repoPath = mkdtempSync(join(tmpdir(), 'orbit-security-center-'));
  workspaces.push(repoPath);
  mkdirSync(join(repoPath, 'src'), { recursive: true });
  writeFileSync(join(repoPath, 'package.json'), JSON.stringify({ name: 'demo', scripts: { build: 'vite build', test: 'vitest run' }, dependencies: { react: '^19.0.0' } }));
  writeFileSync(join(repoPath, 'package-lock.json'), '{}');
  writeFileSync(join(repoPath, '.gitignore'), '.env\n.env.*\n!.env.example\n');
  writeFileSync(join(repoPath, '.env.example'), 'API_KEY=\n');
  return repoPath;
}
afterEach(() => { while (workspaces.length) rmSync(workspaces.pop(), { recursive: true, force: true }); });

describe('Security Center local evidence', () => {
  it('inspects npm credentials without exposing their values', () => {
    const repoPath = repository();
    const credential = ['fixture', 'registry', 'credential'].join('-');
    writeFileSync(join(repoPath, '.npmrc'), `//registry.example.test/:_authToken=${credential}\n`);
    const result = inspectRepositorySecurity({ repoPath });
    expect(result.secretFindings.some(item => item.path === '.npmrc')).toBe(true);
    expect(JSON.stringify(result)).not.toContain(credential);
  });

  it('records read failures and enforces file limits within a single directory', () => {
    const repoPath = repository();
    writeFileSync(join(repoPath, 'src', 'unreadable.js'), 'export default 1');
    const result = inspectRepositorySecurity({ repoPath }, { readFile(root, file) {
      if (file.endsWith('unreadable.js')) throw new Error('EACCES');
      return readSecurityFile(root, file);
    } });
    expect(result.coverage.unreadablePaths).toContain('src/unreadable.js');
    expect(result.coverage.incomplete).toBe(true);
    const limited = inspectRepositorySecurity({ repoPath }, { scanLimits: { maxFiles: 2 } });
    expect(limited.scannedFileCount).toBe(2);
    expect(limited.coverage.scanLimitReached).toBe(true);
  });

  it('bounds file reads and refuses direct configuration symlinks outside the repository', () => {
    const repoPath = repository();
    const large = join(repoPath, 'src', 'large.js');
    writeFileSync(large, 'a'.repeat(400_000));
    expect(readSecurityFile(realpathSync(repoPath), large)).toMatchObject({ partial: true, size: 400_000 });
    expect(Buffer.byteLength(readSecurityFile(realpathSync(repoPath), large).content)).toBe(160_000);
    expect(inspectRepositorySecurity({ repoPath }).coverage.partialFiles).toContain('src/large.js');
    const other = repository();
    symlinkSync(join(other, 'package.json'), join(repoPath, '.npmrc'));
    expect(() => readSecurityFile(realpathSync(repoPath), join(repoPath, '.npmrc'))).toThrow();
  });

  it.each(['md', 'html'])('invalidates a privacy review after an existing %s document changes', async extension => {
    const repoPath = repository();
    for (const name of ['Privacy', 'Terms', 'Contact']) writeFileSync(join(repoPath, `${name}.${extension}`), `${name} evidence`);
    const project = { id: 'document-review', name: 'Document review app', kind: 'SaaS', repoPath };
    const first = await buildProjectSecurityCenter(project);
    const privacyReview = { decision: 'reviewed', rationale: 'Reviewed by the project owner', evidenceFingerprint: first.privacyReview.evidenceFingerprint, reviewedAt: new Date().toISOString() };
    const reviewed = await buildProjectSecurityCenter(project, { privacyReview });
    expect(reviewed.privacyReview.valid).toBe(true);
    writeFileSync(join(repoPath, `Privacy.${extension}`), 'Changed retention and processing terms');
    const changed = await buildProjectSecurityCenter(project, { privacyReview });
    expect(changed.privacyReview.valid).toBe(false);
    expect(changed.checks.find(item => item.id === 'privacy').status).toBe('needs_review');
  });

  it('retains audit staleness across serialized local scans until a new audit matches', async () => {
    const repoPath = repository();
    const project = { id: 'freshness', name: 'Freshness', repoPath };
    const audit = { status: 'clean', vulnerabilities: { critical: 0, total: 0 }, evidenceFingerprint: inspectRepositorySecurity(project).evidenceFingerprint };
    writeFileSync(join(repoPath, 'src', 'changed.js'), 'export default 2');
    for (let i = 0; i < 3; i++) {
      const center = await buildProjectSecurityCenter(project, { dependencyAudit: JSON.parse(JSON.stringify(audit)) });
      applyDependencyFreshness(center, audit);
      expect(center.checks.find(item => item.id === 'dependencies')).toMatchObject({ status: 'stale', stale: true });
    }
    const freshAudit = { ...audit, evidenceFingerprint: inspectRepositorySecurity(project).evidenceFingerprint };
    const fresh = await buildProjectSecurityCenter(project, { dependencyAudit: freshAudit });
    applyDependencyFreshness(fresh, freshAudit);
    expect(fresh.checks.find(item => item.id === 'dependencies')).toMatchObject({ status: 'pass', stale: false });
    const critical = { ...audit, status: 'findings', vulnerabilities: { critical: 1, total: 1 } };
    const blocked = await buildProjectSecurityCenter(project, { dependencyAudit: critical });
    applyDependencyFreshness(blocked, critical);
    expect(blocked.checks.find(item => item.id === 'dependencies')).toMatchObject({ status: 'blocked', stale: true });
  });
  it('returns review-required evidence for an unconnected project', async () => {
    const center = await buildProjectSecurityCenter({ id: 'unconnected', name: 'Unconnected project', tasks: [] }, { language: 'en' });
    expect(center.gate.status).toBe('yellow');
    expect(center.checks.find(check => check.id === 'secrets')?.status).toBe('not_available');
    expect(center.checks.find(check => check.id === 'dependencies')?.status).toBe('not_available');
  });
  it('records potential source secrets without returning their values', () => {
    const repoPath = repository();
    const fakeKey = ['sk', 'not-a-real-secret-12345678901234567890'].join('-');
    writeFileSync(join(repoPath, 'src', 'config.js'), `export const key = '${fakeKey}';`);
    const evidence = inspectRepositorySecurity({ repoPath }, { language: 'en' });
    expect(evidence.secretFindings).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'src/config.js' })]));
    expect(JSON.stringify(evidence)).not.toContain(fakeKey);
  });

  it('inspects relevant hidden configuration while reporting skipped symlinks as incomplete coverage', () => {
    const repoPath = repository();
    mkdirSync(join(repoPath, '.github', 'workflows'), { recursive: true });
    const fakeKey = ['sk', 'hidden-config-key-12345678901234567890'].join('-');
    writeFileSync(join(repoPath, '.github', 'workflows', 'release.yml'), `TOKEN: '${fakeKey}'`);
    const outside = join(tmpdir(), `orbit-outside-${Date.now()}.js`);
    writeFileSync(outside, `export const key = '${fakeKey}';`);
    symlinkSync(outside, join(repoPath, 'src', 'outside.js'));
    const evidence = inspectRepositorySecurity({ repoPath }, { language: 'en' });
    expect(evidence.secretFindings).toEqual(expect.arrayContaining([expect.objectContaining({ path: '.github/workflows/release.yml' })]));
    expect(evidence.coverage.incomplete).toBe(true);
    expect(evidence.coverage.skippedSymlinks).toContain('src/outside.js');
    rmSync(outside, { force: true });
  });

  it('only accepts a privacy review tied to the current evidence', async () => {
    const repoPath = repository();
    writeFileSync(join(repoPath, 'src', 'Privacy.jsx'), 'export default function Privacy() { return null; }');
    writeFileSync(join(repoPath, 'src', 'Terms.jsx'), 'export default function Terms() { return null; }');
    writeFileSync(join(repoPath, 'src', 'Contact.jsx'), 'export default function Contact() { return null; }');
    const project = { id: 'reviewed-project', name: 'Reviewed project', kind: 'SaaS', repoPath };
    const base = await buildProjectSecurityCenter(project, { language: 'en', dependencyAudit: { status: 'clean', vulnerabilities: { info: 0, critical: 0, high: 0, moderate: 0, low: 0, total: 0 } }, runtimePosture: { platform: 'darwin', orbitBoundToLoopback: true, firewall: { status: 'enabled' }, fileVault: { status: 'enabled' }, activeTunnels: [] } });
    const reviewed = await buildProjectSecurityCenter(project, { language: 'en', dependencyAudit: { status: 'clean', vulnerabilities: { info: 0, critical: 0, high: 0, moderate: 0, low: 0, total: 0 } }, runtimePosture: { platform: 'darwin', orbitBoundToLoopback: true, firewall: { status: 'enabled' }, fileVault: { status: 'enabled' }, activeTunnels: [] }, privacyReview: { decision: 'reviewed', rationale: 'Reviewed by the product owner.', evidenceFingerprint: base.privacyReview.evidenceFingerprint, reviewedAt: '2026-09-25T00:00:00.000Z' } });
    expect(reviewed.checks.find(check => check.id === 'privacy')?.status).toBe('pass');
    writeFileSync(join(repoPath, 'src', 'Privacy.jsx'), 'export default function Privacy() { return <main>Updated</main>; }');
    const changed = await buildProjectSecurityCenter(project, { language: 'en', dependencyAudit: { status: 'clean', vulnerabilities: { info: 0, critical: 0, high: 0, moderate: 0, low: 0, total: 0 } }, runtimePosture: { platform: 'darwin', orbitBoundToLoopback: true, firewall: { status: 'enabled' }, fileVault: { status: 'enabled' }, activeTunnels: [] }, privacyReview: reviewed.privacyReview.review });
    expect(changed.checks.find(check => check.id === 'privacy')?.status).toBe('needs_review');
  });

  it('surfaces an active client portal link as exposure evidence, never silently', async () => {
    const repoPath = repository();
    const runtimePosture = { platform: 'darwin', orbitBoundToLoopback: true, firewall: { status: 'enabled' }, fileVault: { status: 'enabled' }, activeTunnels: [] };
    const withoutLink = await buildProjectSecurityCenter({ id: 'no-portal', name: 'No portal', repoPath }, { language: 'en', runtimePosture });
    const exposureWithout = withoutLink.checks.find(check => check.id === 'exposure');
    expect(exposureWithout.status).toBe('pass');
    expect(exposureWithout.evidence.join(' ')).not.toContain('portal');
    expect(withoutLink.clientPortalLink).toEqual({ active: false, createdAt: null });

    const project = { id: 'with-portal', name: 'With portal', repoPath, clientShareTokenHash: 'deadbeef', clientShareCreatedAt: '2026-09-20T00:00:00.000Z' };
    const withLink = await buildProjectSecurityCenter(project, { language: 'en', runtimePosture });
    expect(withLink.clientPortalLink).toEqual({ active: true, createdAt: '2026-09-20T00:00:00.000Z' });
    const exposureWith = withLink.checks.find(check => check.id === 'exposure');
    // An active client portal link is a standing public exposure surface, same
    // as an active preview tunnel: it must move the status to warning, not
    // stay silently at pass.
    expect(exposureWith.status).toBe('warning');
    expect(exposureWith.evidence.some(item => item.includes('Client portal link is active') && item.includes('2026-09-20T00:00:00.000Z'))).toBe(true);
    expect(exposureWith.detail).toContain('client portal link is active');
    expect(securityEvidenceMarkdown(withLink)).toContain('Client portal link: active');
  });

  it('creates a red gate for a detected source secret and exports a non-certification report', async () => {
    const repoPath = repository();
    const fakeToken = ['ghp_', 'abcdefghijklmnopqrstuvwxyz1234567890'].join('');
    writeFileSync(join(repoPath, 'src', 'config.js'), `export const token = '${fakeToken}';`);
    const center = await buildProjectSecurityCenter({ id: 'demo', name: 'Demo', kind: 'SaaS', repoPath }, {
      language: 'en',
      dependencyAudit: { status: 'clean', vulnerabilities: { critical: 0, high: 0, moderate: 0, low: 0, total: 0 } },
      runtimePosture: { platform: 'darwin', orbitBoundToLoopback: true, firewall: { status: 'enabled', evidence: 'Firewall is enabled' }, fileVault: { status: 'enabled', evidence: 'FileVault is On' }, activeTunnels: [] }
    });
    expect(center.gate.status).toBe('red');
    expect(center.frameworkMappings).toHaveLength(4);
    const report = securityEvidenceMarkdown(center);
    expect(report).toContain('not a legal opinion');
    expect(report).not.toContain(fakeToken);
  });
});

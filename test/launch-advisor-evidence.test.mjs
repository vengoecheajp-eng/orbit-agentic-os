import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { generateTrustAndLegalChecks, inspectTechnicalEvidence, inspectTrustArtifacts } from '../launch-advisor.mjs';

const workspaces = [];

function makeRepository() {
  const repoPath = mkdtempSync(join(tmpdir(), 'orbit-advisor-'));
  workspaces.push(repoPath);
  mkdirSync(join(repoPath, 'src', 'components'), { recursive: true });
  mkdirSync(join(repoPath, 'src', 'pages'), { recursive: true });
  return repoPath;
}

afterEach(() => {
  while (workspaces.length) rmSync(workspaces.pop(), { recursive: true, force: true });
});

describe('launch advisory repository evidence', () => {
  it('finds real legal routes and does not treat an unrelated condition component as Terms', () => {
    const repoPath = makeRepository();
    writeFileSync(join(repoPath, 'src', 'components', 'ConditionSummaryStrip.jsx'), 'export default function ConditionSummaryStrip() {}');
    writeFileSync(join(repoPath, 'src', 'pages', 'Privacy.jsx'), 'export default function Privacy() {}');
    writeFileSync(join(repoPath, 'src', 'pages', 'Terms.jsx'), 'export default function Terms() {}');
    writeFileSync(join(repoPath, 'src', 'pages', 'Contact.jsx'), 'export default function Contact() {}');

    const project = { name: 'Public SaaS', kind: 'SaaS app', repoPath };
    const trust = inspectTrustArtifacts(project);
    expect(trust.privacyFiles).toContain('src/pages/Privacy.jsx');
    expect(trust.termsFiles).toContain('src/pages/Terms.jsx');
    expect(trust.termsFiles).not.toContain('src/components/ConditionSummaryStrip.jsx');
    expect(trust.supportFiles).toContain('src/pages/Contact.jsx');

    const checks = generateTrustAndLegalChecks(project, trust);
    expect(checks.find(check => check.id === 'privacy-policy')?.status).toBe('pass');
    expect(checks.find(check => check.id === 'terms-of-service')?.status).toBe('pass');
    expect(checks.find(check => check.id === 'support-contact')?.status).toBe('pass');
  });

  it('only reports secrets hygiene when a repository contains protective evidence', () => {
    const repoPath = makeRepository();
    writeFileSync(join(repoPath, 'src', 'config.js'), 'export const api = process.env.API_KEY;');
    expect(inspectTechnicalEvidence({ repoPath }).evidence.secretsHygiene).toEqual([]);

    writeFileSync(join(repoPath, '.env.example'), 'API_KEY=\n');
    writeFileSync(join(repoPath, '.gitignore'), '.env\n.env.*\n!.env.example\n');
    expect(inspectTechnicalEvidence({ repoPath }).evidence.secretsHygiene).toEqual(expect.arrayContaining(['.env.example', '.gitignore']));
  });
});

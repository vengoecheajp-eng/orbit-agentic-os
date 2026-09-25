import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, inject, it } from 'vitest';

const base = inject('orbitBase');

describe('Orbit local control plane', () => {
  it('returns complete lightweight activity beyond the recent 30-run limit', async () => {
    const directory = join(inject('orbitDataDirectory'), 'runs');
    mkdirSync(directory, { recursive: true });
    const files = Array.from({ length: 35 }, (_, i) => join(directory, `activity-fixture-${i}.json`));
    try {
      files.forEach((file, i) => writeFileSync(file, JSON.stringify({ id: `activity-fixture-${i}`, projectId: 'example-project', status: i === 0 ? 'awaiting_input' : 'merged', prompt: `Task ${i}`, model: 'test-model', createdAt: new Date(Date.UTC(2020, 0, i + 1)).toISOString(), messages: ['private transcript'], log: 'bulky log', patch: 'bulky patch' })));
      const response = await fetch(`${base}/api/runs?view=activity`);
      expect(response.ok).toBe(true);
      const runs = (await response.json()).filter(run => run.id.startsWith('activity-fixture-'));
      expect(runs).toHaveLength(35);
      expect(runs.find(run => run.id === 'activity-fixture-0').status).toBe('awaiting_input');
      expect(runs.every(run => !('messages' in run) && !('log' in run) && !('patch' in run))).toBe(true);
    } finally { files.forEach(file => rmSync(file, { force: true })); }
  });

  it('reports provider health without leaking a secret', async () => {
    const response = await fetch(`${base}/api/health`);
    expect(response.ok).toBe(true);
    const body = await response.json();
    expect(body.ok).toBe(true);
    const codex = body.providers.find(provider => provider.id === 'codex');
    expect(codex.models.map(model => model.id)).toEqual(expect.arrayContaining(['gpt-6-astra', 'gpt-6-sol', 'gpt-6-luna']));
    expect(codex.activeModel).toBe('gpt-6-sol');
    expect(JSON.stringify(body)).not.toContain('GEMINI_API_KEY');
  });

  it('lists Groq, Mistral, and xAI as coding providers without exposing keys', async () => {
    const response = await fetch(`${base}/api/health`);
    expect(response.ok).toBe(true);
    const body = await response.json();
    const cloud = body.providers.filter(provider => ['groq', 'mistral', 'xai'].includes(provider.id));
    expect(cloud.map(provider => provider.id)).toEqual(['groq', 'mistral', 'xai']);
    expect(cloud.every(provider => provider.mode === 'write')).toBe(true);
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('GROQ_API_KEY');
    expect(serialized).not.toContain('MISTRAL_API_KEY');
    expect(serialized).not.toContain('XAI_API_KEY');
  });

  it('reports Telegram readiness without exposing its bot token', async () => {
    const response = await fetch(`${base}/api/connections/telegram`);
    expect(response.ok).toBe(true);
    const body = await response.json();
    expect(body).toHaveProperty('botTokenConfigured');
    expect(body).not.toHaveProperty('botToken');
    expect(JSON.stringify(body)).not.toContain('TELEGRAM_BOT_TOKEN');
  });

  it('reports optional private media capabilities without exposing credentials or media', async () => {
    const response = await fetch(`${base}/api/capabilities/media`);
    const body = await response.json();
    expect(response.ok, JSON.stringify(body)).toBe(true);
    expect(body.ok).toBe(true);
    expect(body.voice).toHaveProperty('ready');
    expect(body.vision).toHaveProperty('ready');
    expect(JSON.stringify(body)).not.toContain('TELEGRAM_BOT_TOKEN');
    expect(JSON.stringify(body)).not.toContain('telegram-media');
  });

  it('blocks mutating requests from external origins', async () => {
    const response = await fetch(`${base}/api/prompts/optimize`, { method: 'POST', headers: { Origin: 'https://example.invalid', 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'test' }) });
    expect(response.status).toBe(403);
  });

  it('rejects an unapproved skill before starting a run', async () => {
    const response = await fetch(`${base}/api/runs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: 'example-project', prompt: 'verification only', skillId: 'not-approved' }) });
    expect(response.status).toBe(422);
  });

  it('lists locally installed Agency skills without importing them', async () => {
    const response = await fetch(`${base}/api/skills/catalog`);
    expect(response.ok).toBe(true);
    const body = await response.json();
    expect(Array.isArray(body.local)).toBe(true);
    expect(Array.isArray(body.recommended)).toBe(true);
    expect(Array.isArray(body.recommendedSources)).toBe(true);
    expect(body.recommendedSources.map(skill => skill.id)).toEqual(expect.arrayContaining(['strix-security', 'context7-docs', 'openai-docs']));
    expect(body.recommendedSources.every(skill => new URL(skill.sourceUrl).hostname === 'github.com')).toBe(true);
    expect(body.local.every(skill => skill.source === 'Agency Agents · this Mac')).toBe(true);
    expect(body.local.every(skill => !Object.hasOwn(skill, 'systemPrompt'))).toBe(true);
  });

  it('returns only isolated code runs in the Executive Inbox', async () => {
    const response = await fetch(`${base}/api/inbox`);
    expect(response.ok).toBe(true);
    const body = await response.json();
    expect(body.count).toBe(body.items.length);
    expect(body.items.every(item => item.gateStatus !== 'verified_ready' || item.mergeable === true)).toBe(true);
    expect(body.items.every(item => item.changedFiles && typeof item.mergeable === 'boolean')).toBe(true);
  });

  it('refuses to merge a conversational run without an isolated branch', async () => {
    const runsResponse = await fetch(`${base}/api/runs`);
    const runs = await runsResponse.json();
    const conversational = runs.find(run => run.status === 'awaiting_review' && (!run.branch || !run.worktreePath));
    if (!conversational) return;
    const response = await fetch(`${base}/api/runs/${conversational.id}/merge`, { method: 'POST' });
    expect([409, 422]).toContain(response.status);
  });

  it('protects the visual client portal with a revocable token', async () => {
    const projectsResponse = await fetch(`${base}/api/projects`);
    const projects = await projectsResponse.json();
    expect(projects.length).toBeGreaterThan(0);
    const project = projects[0];

    const anonymous = await fetch(`${base}/api/share/${project.id}`);
    expect(anonymous.status).toBe(401);

    const createResponse = await fetch(`${base}/api/projects/${project.id}/share-link`, { method: 'POST' });
    expect(createResponse.status).toBe(201);
    const created = await createResponse.json();
    const portalUrl = new URL(created.path, base);
    const token = portalUrl.searchParams.get('token');
    const authorizedApiUrl = `${base}/api/share/${project.id}?token=${encodeURIComponent(token)}`;
    const authorized = await fetch(authorizedApiUrl);
    expect(authorized.ok).toBe(true);
    const body = await authorized.json();
    expect(body.clientPortal).toBe(true);
    expect(body.name).toBe(project.name);
    expect(body).not.toHaveProperty('repoPath');
    expect(body).not.toHaveProperty('githubRepo');

    const revokedResponse = await fetch(`${base}/api/projects/${project.id}/share-link`, { method: 'POST' });
    expect(revokedResponse.status).toBe(201);
    const replacement = await revokedResponse.json();
    const replacementPortalUrl = new URL(replacement.path, base);
    const replacementToken = replacementPortalUrl.searchParams.get('token');
    const revokedLink = await fetch(authorizedApiUrl);
    expect(revokedLink.status).toBe(401);

    const portalPage = await fetch(replacementPortalUrl);
    expect(portalPage.ok).toBe(true);
    expect(portalPage.headers.get('content-type')).toContain('text/html');

    const removeResponse = await fetch(`${base}/api/projects/${project.id}/share-link`, { method: 'DELETE' });
    expect(removeResponse.ok).toBe(true);
    const removedLink = await fetch(`${base}/api/share/${project.id}?token=${encodeURIComponent(replacementToken)}`);
    expect(removedLink.status).toBe(401);
  });

  it('validates pipeline execution and rejects missing parameters', async () => {
    const invalid = await fetch(`${base}/api/runs/pipeline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    expect(invalid.status).toBe(400);

    const missingProject = await fetch(`${base}/api/runs/pipeline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: 'nonexistent-project', prompt: 'test' })
    });
    expect(missingProject.status).toBe(404);
  });

  it('validates collision check and handles collision detection gracefully', async () => {
    const missing = await fetch(`${base}/api/runs/check-collision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    expect(missing.status).toBe(400);

    const check = await fetch(`${base}/api/runs/check-collision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: 'example-project' })
    });
    expect(check.ok).toBe(true);
    const body = await check.json();
    expect(body).toHaveProperty('collisionDetected');
    expect(Array.isArray(body.activeRuns)).toBe(true);
  });

  it('keeps an unconnected project in Security Center review instead of crashing', async () => {
    const response = await fetch(`${base}/api/projects/example-project/security-center?lang=en`);
    const center = await response.json();
    expect(response.ok, JSON.stringify(center)).toBe(true);
    expect(center.gate.status).toBe('yellow');
    expect(center.checks.find(check => check.id === 'dependencies')?.status).toBe('not_available');

    const refresh = await fetch(`${base}/api/projects/example-project/security-center`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language: 'en' })
    });
    const refreshed = await refresh.json();
    expect(refresh.ok, JSON.stringify(refreshed)).toBe(true);
    expect(refreshed.center.snapshot?.id).toBeTruthy();

    const evidence = await fetch(`${base}/api/projects/example-project/security-evidence?lang=en`);
    expect(evidence.ok).toBe(true);
    expect(evidence.headers.get('content-type')).toContain('text/markdown');
  });

  it('persists a privacy review only for the evidence fingerprint the user saw', async () => {
    const repoPath = mkdtempSync(join(tmpdir(), 'orbit-security-api-'));
    try {
      mkdirSync(join(repoPath, 'src'), { recursive: true });
      writeFileSync(join(repoPath, 'package.json'), JSON.stringify({ name: 'review-fixture', scripts: { build: 'vite build', test: 'vitest run' } }));
      writeFileSync(join(repoPath, 'package-lock.json'), JSON.stringify({ lockfileVersion: 3, packages: {} }));
      writeFileSync(join(repoPath, '.gitignore'), '.env\n');
      writeFileSync(join(repoPath, 'src', 'Privacy.jsx'), 'export default function Privacy() { return null; }');
      writeFileSync(join(repoPath, 'src', 'Terms.jsx'), 'export default function Terms() { return null; }');
      writeFileSync(join(repoPath, 'src', 'Contact.jsx'), 'export default function Contact() { return null; }');
      const create = await fetch(`${base}/api/projects`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: `Privacy Review ${Date.now()}`, repoPath, kind: 'SaaS', summary: 'A browser-based customer product.' }) });
      const project = await create.json();
      expect(create.ok, JSON.stringify(project)).toBe(true);
      const centerResponse = await fetch(`${base}/api/projects/${project.id}/security-center?lang=en`);
      const center = await centerResponse.json();
      expect(centerResponse.ok, JSON.stringify(center)).toBe(true);
      const review = await fetch(`${base}/api/projects/${project.id}/security-center/privacy-review`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision: 'reviewed', rationale: 'Reviewed by the responsible product owner.', evidenceFingerprint: center.privacyReview.evidenceFingerprint }) });
      const recorded = await review.json();
      expect(review.ok, JSON.stringify(recorded)).toBe(true);
      expect(recorded.center.checks.find(check => check.id === 'privacy')?.status).toBe('pass');
      writeFileSync(join(repoPath, 'src', 'Privacy.jsx'), 'export default function Privacy() { return <main>Changed data handling</main>; }');
      const afterChange = await fetch(`${base}/api/projects/${project.id}/security-center?lang=en`);
      const changed = await afterChange.json();
      expect(changed.checks.find(check => check.id === 'privacy')?.status).toBe('needs_review');
    } finally { rmSync(repoPath, { recursive: true, force: true }); }
  });

  it('keeps dependency evidence stale across repeated openings and skipped audits', async () => {
    const repoPath = mkdtempSync(join(tmpdir(), 'orbit-audit-freshness-'));
    try {
      writeFileSync(join(repoPath, 'package.json'), JSON.stringify({ name: 'freshness-fixture' }));
      writeFileSync(join(repoPath, 'package-lock.json'), JSON.stringify({ lockfileVersion: 3, packages: {} }));
      writeFileSync(join(repoPath, 'index.js'), 'export const version = 1;');
      const created = await fetch(`${base}/api/projects`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: `Audit Freshness ${Date.now()}`, repoPath }) });
      const project = await created.json();
      expect(created.ok, JSON.stringify(project)).toBe(true);
      const endpoint = `${base}/api/projects/${project.id}/security-center`;
      const initial = await (await fetch(endpoint)).json();
      // Seed an npm report only in the isolated test profile; no network or
      // personal credentials are required to exercise snapshot persistence.
      const path = join(inject('orbitDataDirectory'), 'evidence', 'security', `${project.id}.json`);
      const snapshot = JSON.parse(readFileSync(path, 'utf8'));
      snapshot.dependencyAudit = {
        status: 'clean', auditedAt: new Date().toISOString(),
        evidenceFingerprint: initial.repository.evidenceFingerprint,
        vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 }
      };
      writeFileSync(path, JSON.stringify(snapshot));
      const fresh = await (await fetch(endpoint)).json();
      expect(fresh.checks.find(check => check.id === 'dependencies').status).toBe('pass');
      writeFileSync(join(repoPath, 'index.js'), 'export const version = 2;');
      for (let index = 0; index < 3; index += 1) {
        const center = await (await fetch(endpoint)).json();
        expect(center.checks.find(check => check.id === 'dependencies').status).toBe('stale');
        expect(center.snapshot.stale).toBe(true);
      }
      const skipped = await (await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dependencyAudit: false }) })).json();
      expect(skipped.center.checks.find(check => check.id === 'dependencies').status).toBe('stale');
      const persisted = JSON.parse(readFileSync(path, 'utf8'));
      expect(persisted.dependencyAudit.evidenceFingerprint).toBe(initial.repository.evidenceFingerprint);
      persisted.dependencyAudit.status = 'findings';
      persisted.dependencyAudit.vulnerabilities.critical = 1;
      persisted.dependencyAudit.vulnerabilities.total = 1;
      writeFileSync(path, JSON.stringify(persisted));
      for (let index = 0; index < 2; index += 1) {
        const center = await (await fetch(endpoint)).json();
        expect(center.checks.find(check => check.id === 'dependencies').status).toBe('blocked');
        expect(center.gate.status).toBe('red');
      }
    } finally { rmSync(repoPath, { recursive: true, force: true }); }
  });

  it('allows adding and suggesting tasks for a project', async () => {
    const projectsRes = await fetch(`${base}/api/projects`);
    const projects = await projectsRes.json();
    expect(projects.length).toBeGreaterThan(0);
    const project = projects[0];

    const suggestRes = await fetch(`${base}/api/projects/${project.id}/tasks/suggest`, { method: 'POST' });
    expect(suggestRes.ok).toBe(true);
    const suggestBody = await suggestRes.json();
    expect(suggestBody.ok).toBe(true);
    expect(Array.isArray(suggestBody.suggestions)).toBe(true);
    expect(suggestBody.suggestions.length).toBeGreaterThan(0);
    expect(suggestBody.suggestions[0]).toHaveProperty('title');

    const testTaskTitle = `Automated verification task ${Date.now()}`;
    const addRes = await fetch(`${base}/api/projects/${project.id}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: testTaskTitle,
        due: 'Next sprint',
        description: 'Verify task engine execution',
        purpose: 'Ensure tasks are actionable'
      })
    });
    expect(addRes.status).toBe(201);
    const addBody = await addRes.json();
    expect(addBody.ok).toBe(true);
    expect(addBody.task[0]).toBe(testTaskTitle);
    expect(addBody.task[2]).toBe(false);

    const updatedProjectsRes = await fetch(`${base}/api/projects`);
    const updatedProjects = await updatedProjectsRes.json();
    const updatedProject = updatedProjects.find(p => p.id === project.id);
    const added = updatedProject.tasks.find(t => (Array.isArray(t) ? t[0] : t.title) === testTaskTitle);
    expect(added).toBeDefined();
  });

  it('creates a complete local starter workspace for a Foundry MVP', async () => {
    const name = `Foundry MVP ${Date.now()}`;
    const response = await fetch(`${base}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        summary: 'A locally generated MVP that begins with a secure starter repository.',
        kind: 'Forged MVP',
        createStarter: true,
        tasks: [['Build the first customer flow', 'Day 1', false]]
      })
    });
    expect(response.status).toBe(201);
    const project = await response.json();
    expect(project.workspaceCreated).toBe(true);
    expect(project.mode).toBe('connected');
    expect(existsSync(join(project.repoPath, 'package.json'))).toBe(true);
    expect(existsSync(join(project.repoPath, 'src', 'App.jsx'))).toBe(true);
    expect(existsSync(join(project.repoPath, 'PROJECT_MEMORY.md'))).toBe(true);
    expect(readFileSync(join(project.repoPath, 'PROJECT_MEMORY.md'), 'utf8')).toContain(name);
  });

  it('generates pre-launch hardening advisory, client report, and growth ideas for a project', async () => {
    // Create a multi-tenant SaaS project to test full hardening detection
    const createRes = await fetch(`${base}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `SaaS Fleet Tracker ${Date.now()}`,
        kind: 'Multi-Tenant SaaS Product',
        summary: 'Cloud multi-tenant platform with Stripe billing and customer workspaces',
        tasks: [
          ['Configure Stripe pricing tiers & checkout webhooks', 'Completed', true],
          ['Setup Supabase database with tenant organizations', 'Completed', true]
        ]
      })
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();

    const res = await fetch(`${base}/api/projects/${created.id}/launch-advisory?lang=es&skipAi=true`);
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.projectId).toBe(created.id);
    expect(typeof body.readinessScore).toBe('number');
    expect(body.readinessScore).toBeGreaterThanOrEqual(0);
    expect(body.readinessScore).toBeLessThanOrEqual(100);
    expect(Array.isArray(body.hardeningChecks)).toBe(true);
    expect(body.hardeningChecks.length).toBeGreaterThan(0);

    const privacyCheck = body.hardeningChecks.find(c => c.id === 'privacy-policy');
    const termsCheck = body.hardeningChecks.find(c => c.id === 'terms-of-service');
    expect(privacyCheck.status).toBe('not_reviewed');
    expect(termsCheck.status).toBe('not_reviewed');
    expect(body.launchGate.status).toBe('review_required');
    expect(body.launchGate.canDeploy).toBe(true);
    expect(body.technicalEvidence.repoConnected).toBe(false);

    const rlsCheck = body.hardeningChecks.find(c => c.id === 'rls-tenant-isolation');
    expect(rlsCheck).toBeDefined();
    expect(rlsCheck.severity).toBe('CRITICAL');
    expect(rlsCheck.suggestedPrompt).toContain('Row Level Security');

    const paymentCheck = body.hardeningChecks.find(c => c.id === 'payments-webhook-idempotency');
    expect(paymentCheck).toBeDefined();
    expect(paymentCheck.severity).toBe('CRITICAL');

    expect(body.clientAdvisory).toBeDefined();
    expect(Array.isArray(body.clientAdvisory.clientActionItems)).toBe(true);
    expect(body.clientAdvisory.clientActionItems.length).toBeGreaterThan(0);
    expect(body.clientAdvisory.markdownReport).toContain('INFORME DE BLINDAJE PRE-LANZAMIENTO');

    expect(Array.isArray(body.growthIdeas)).toBe(true);
    expect(body.growthIdeas.length).toBeGreaterThan(0);
    expect(body.growthIdeas[0]).toHaveProperty('title');
    expect(body.growthIdeas[0]).toHaveProperty('clientValue');
  });
});

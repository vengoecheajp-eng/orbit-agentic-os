import { existsSync, lstatSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const WORKFLOW_LIBRARY = Object.freeze([
  {
    id: 'implement-feature',
    name: 'Implement a focused feature',
    category: 'Build',
    description: 'Inspect the current project, implement one bounded outcome, and prove it with the relevant checks.',
    prompt: 'Implement this focused feature for the project. First inspect the existing architecture and Project Brain. Keep the scope minimal, make changes only in the isolated worktree, run the most relevant checks, and report changed files, evidence, and remaining risks.'
  },
  {
    id: 'repair-verification',
    name: 'Repair a failing verification',
    category: 'Quality',
    description: 'Investigate a failing build, test, or visual check before changing product behavior.',
    prompt: 'Investigate and repair the current verification failure. Reproduce it first, identify the smallest root cause, implement the smallest safe fix, and re-run the failed check plus any directly related checks. Do not change dependencies without an explicit Orbit dependency approval.'
  },
  {
    id: 'launch-readiness',
    name: 'Prepare a launch-readiness review',
    category: 'Launch',
    description: 'Collect concrete launch evidence without claiming legal compliance or production readiness prematurely.',
    prompt: 'Prepare this project for a launch-readiness review. Inspect security configuration, secrets handling, privacy/terms surfaces, dependency health, build/test commands, and deployment assumptions. Produce evidence-backed findings and a prioritized checklist. Do not deploy or claim certification.'
  },
  {
    id: 'secure-skill-review',
    name: 'Review an agent skill safely',
    category: 'Security',
    description: 'Assess a selected skill’s purpose, least-privilege boundaries, and prompt-injection risks before it is used.',
    prompt: 'Review the selected agent skill for safe use in this project. Identify its intended purpose, required files or tools, data boundaries, prompt-injection risks, and whether it should be advisory or allowed for coding. Do not install, enable, or modify the skill; provide an evidence-based recommendation.'
  },
  {
    id: 'compare-models',
    name: 'Compare models on one task',
    category: 'Evaluation',
    description: 'Run the same bounded task through two or three models and compare evidence, not style alone.',
    prompt: 'Solve this bounded project task. Inspect before changing files, keep the scope minimal, run relevant verification, and report changed files, evidence, limitations, and estimated follow-up work. This run is part of a model evaluation, so be factual and concise.'
  }
]);

export const SKILL_RUNTIME_CONTRACT = Object.freeze({
  version: 'orbit-skill-runtime-v1',
  standard: 'Agent Skills compatible SKILL.md package with YAML metadata and supporting files.',
  codex: '.agents/skills/<approved-skill>/SKILL.md',
  claude: '.claude/skills/<approved-skill>/SKILL.md',
  apiModels: 'Bounded approved package supplied as task context; no filesystem mounting.',
  safety: 'Packages require inspection and approval. Orbit rules and worktree boundaries always take precedence.'
});

const RUNTIME_FILES = [
  ['agents', 'AGENTS.md', 'Shared agent instructions'],
  ['claude', 'CLAUDE.md', 'Claude Code instructions'],
  ['codex', 'CODEX.md', 'Codex instructions'],
  ['openclaw', 'OPENCLAW.md', 'OpenClaw instructions'],
  ['cursor', '.cursorrules', 'Cursor rules']
];
const MCP_FILES = ['.mcp.json', 'mcp.json', '.vscode/mcp.json'];
const SKILL_DIRECTORIES = ['.agents/skills', '.claude/skills', 'skills'];

function safeDirectory(value) {
  try { return Boolean(value && existsSync(value) && lstatSync(value).isDirectory() && !lstatSync(value).isSymbolicLink()); }
  catch { return false; }
}

function countSkillFiles(root, depth = 0) {
  if (!safeDirectory(root) || depth > 4) return 0;
  let count = 0;
  for (const name of readdirSync(root).slice(0, 300)) {
    const path = join(root, name);
    try {
      const info = lstatSync(path);
      if (info.isFile() && /^SKILL\.md$/i.test(name)) count += 1;
      if (info.isDirectory()) count += countSkillFiles(path, depth + 1);
    } catch { /* A transient file must not break the report. */ }
  }
  return count;
}

export function scanProjectCompatibility(repoPath) {
  if (!safeDirectory(repoPath)) {
    return {
      connected: false,
      files: [],
      skillLocations: [],
      mcpFiles: [],
      githubWorkflows: 0,
      runtime: SKILL_RUNTIME_CONTRACT,
      recommendations: ['Connect a local repository to inspect existing agent configuration.']
    };
  }
  const files = RUNTIME_FILES.map(([id, path, label]) => ({ id, path, label, found: existsSync(join(repoPath, path)) }));
  const skillLocations = SKILL_DIRECTORIES.map(path => ({ path, found: safeDirectory(join(repoPath, path)), skills: countSkillFiles(join(repoPath, path)) }));
  const mcpFiles = MCP_FILES.filter(path => existsSync(join(repoPath, path)));
  const workflows = join(repoPath, '.github', 'workflows');
  const githubWorkflows = safeDirectory(workflows) ? readdirSync(workflows).filter(name => /\.ya?ml$/i.test(name)).length : 0;
  const recommendations = [];
  if (!files.some(file => file.found)) recommendations.push('No agent instruction file was detected. Project Brain will remain the primary Orbit context.');
  if (!skillLocations.some(location => location.found)) recommendations.push('No repository-scoped skills were detected. Approved Orbit skills mount only for the selected run.');
  if (mcpFiles.length) recommendations.push('MCP configuration was detected. Review it before granting any external tool access.');
  if (!githubWorkflows) recommendations.push('No GitHub Actions workflow was detected. Consider adding CI before relying on remote delivery checks.');
  return { connected: true, files, skillLocations, mcpFiles, githubWorkflows, runtime: SKILL_RUNTIME_CONTRACT, recommendations };
}

function sectionPresent(content, heading) {
  return new RegExp(`^##\\s+${heading.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\s*$`, 'mi').test(content);
}

export function normalizeProjectBrain(content, project, stack) {
  const original = String(content || '').trim();
  const missing = [];
  if (!sectionPresent(original, 'Goals & Success Criteria')) missing.push(`## Goals & Success Criteria\n- Primary outcome: ${project.summary || 'Define the user-facing outcome for this project.'}\n- Success means: a verified, reviewable change that advances the next milestone.\n`);
  if (!sectionPresent(original, 'Decision Log')) missing.push('## Decision Log\n- Record durable architecture or product decisions here, including why they were made.\n');
  if (!sectionPresent(original, 'Risks & Open Questions')) missing.push('## Risks & Open Questions\n- Record unresolved security, product, dependency, and launch risks here.\n');
  if (!sectionPresent(original, 'Runtime & Compatibility')) {
    missing.push(`## Runtime & Compatibility\n- Detected stack: ${stack.stack || 'Not detected'}\n- Orbit uses approved SKILL.md packages; native skills are mounted only for the selected worktree run.\n- Existing agent configuration must be reviewed before it is adopted or changed.\n`);
  }
  if (!original) return `# Project Brain: ${project.name}\n\n${missing.join('\n')}`;
  return missing.length ? `${original.replace(/\s+$/, '')}\n\n${missing.join('\n')}` : original;
}

export function evaluationSummary(runs) {
  const items = Array.isArray(runs) ? runs : [];
  return {
    total: items.length,
    complete: items.length > 0 && items.every(run => !['queued', 'running', 'repairing'].includes(run.status)),
    verified: items.filter(run => run.gateStatus === 'verified_ready').length,
    attention: items.filter(run => run.gateStatus === 'needs_attention' || run.status === 'failed').length,
    estimatedCostUsd: items.reduce((sum, run) => sum + (Number(run.estimatedCostUsd) || 0), 0)
  };
}

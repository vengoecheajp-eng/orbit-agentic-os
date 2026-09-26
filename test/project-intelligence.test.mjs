import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { evaluationSummary, normalizeProjectBrain, scanProjectCompatibility } from '../project-intelligence.mjs';

describe('project intelligence', () => {
  it('reports runtime configuration without reading instructions or MCP secrets', () => {
    const root = mkdtempSync(join(tmpdir(), 'orbit-intelligence-'));
    try {
      mkdirSync(join(root, '.agents', 'skills', 'safe-skill'), { recursive: true });
      mkdirSync(join(root, '.github', 'workflows'), { recursive: true });
      writeFileSync(join(root, 'AGENTS.md'), 'Do not expose this content.');
      writeFileSync(join(root, '.mcp.json'), '{"token":"never-returned"}');
      writeFileSync(join(root, '.agents', 'skills', 'safe-skill', 'SKILL.md'), '# Skill');
      writeFileSync(join(root, '.github', 'workflows', 'verify.yml'), 'name: verify');
      const report = scanProjectCompatibility(root);
      expect(report.files.find(file => file.id === 'agents')?.found).toBe(true);
      expect(report.skillLocations.find(item => item.path === '.agents/skills')?.skills).toBe(1);
      expect(report.mcpFiles).toEqual(['.mcp.json']);
      expect(JSON.stringify(report)).not.toContain('never-returned');
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it('adds missing brain sections without removing existing notes', () => {
    const brain = normalizeProjectBrain('# Project Brain\n\nKeep this decision.', { name: 'Demo', summary: 'Ship safely' }, { stack: 'React' });
    expect(brain).toContain('Keep this decision.');
    expect(brain).toContain('## Goals & Success Criteria');
    expect(brain).toContain('## Decision Log');
  });

  it('summarizes model evaluation evidence rather than choosing a winner', () => {
    expect(evaluationSummary([{ status: 'awaiting_review', gateStatus: 'verified_ready', estimatedCostUsd: 0.2 }, { status: 'failed', gateStatus: 'needs_attention', estimatedCostUsd: 0 }])).toEqual({ total: 2, complete: true, verified: 1, attention: 1, estimatedCostUsd: 0.2 });
  });
});

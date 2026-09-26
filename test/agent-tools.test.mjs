import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { executeAgentTool, parseAgentAction, validateAgentAction } from '../agent-tools.mjs';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'orbit-agent-tools-'));
  spawnSync('git', ['init', root]);
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'src', 'main.js'), 'export const greeting = "hello";\nexport const answer = 42;\n');
  writeFileSync(join(root, '.env'), 'SECRET=nope\n');
  writeFileSync(join(root, 'README.md'), '# Fixture\n');
  spawnSync('git', ['-C', root, 'add', 'src/main.js', 'README.md']);
  return root;
}

describe('bounded agent tools', () => {
  it('lists, searches and reads only safe project files', () => {
    const root = fixture();
    try {
      expect(executeAgentTool({ action: 'list_files', path: '', cursor: 0, limit: 20 }, { directory: root }).files).toEqual(['README.md', 'src/main.js']);
      expect(executeAgentTool({ action: 'search_files', query: 'greeting', path: 'src', limit: 5 }, { directory: root }).matches).toEqual([{ path: 'src/main.js', line: 1, text: 'export const greeting = "hello";' }]);
      expect(executeAgentTool({ action: 'read_file', path: 'src/main.js', startLine: 2, endLine: 2 }, { directory: root })).toMatchObject({ path: 'src/main.js', content: 'export const answer = 42;' });
      expect(() => validateAgentAction({ action: 'read_file', path: '.env' })).toThrow('Protected');
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it('cannot traverse, use unexpected arguments, write in plan mode, or follow symlinks', () => {
    const root = fixture();
    try {
      expect(() => parseAgentAction('{"action":"search_files","query":"x","command":"env"}')).toThrow('unsupported fields');
      expect(() => validateAgentAction({ action: 'read_file', path: '../outside' })).toThrow('Protected');
      expect(() => executeAgentTool({ action: 'apply_patch', patch: 'diff --git a/a.js b/a.js\nnew file mode 100644\n--- /dev/null\n+++ b/a.js\n@@ -0,0 +1 @@\n+export default true;\n' }, { directory: root, allowWrite: false })).toThrow('planning-only');
      symlinkSync(join(root, 'src'), join(root, 'linked-src'));
      expect(executeAgentTool({ action: 'list_files', path: '', cursor: 0, limit: 20 }, { directory: root }).files).not.toContain('linked-src/main.js');
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it('uses Orbit-owned verification and keeps its result structured', () => {
    const root = fixture();
    try {
      expect(executeAgentTool({ action: 'request_verification' }, { directory: root, verify: () => ({ checks: [{ name: 'build', status: 'passed' }] }) })).toEqual({ checks: [{ name: 'build', status: 'passed' }] });
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});

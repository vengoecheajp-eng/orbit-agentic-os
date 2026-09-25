import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(resolve(root, path), 'utf8');

describe('Orbit Community release readiness', () => {
  it('keeps personal state and credentials outside the publishable source set', () => {
    const ignored = read('.gitignore');
    const server = read('server.mjs');
    expect(ignored).toMatch(/^\.env$/m);
    expect(ignored).toMatch(/^data\/\*$/m);
    expect(server).toMatch(/ORBIT_DATA_DIR/);
    expect(server).toMatch(/PROJECTS_EXAMPLE_FILE = join\(DEFAULT_DATA/);
  });

  it('ships the minimum Community safety and contribution documents', () => {
    for (const file of ['README.md', 'LICENSE', 'SECURITY.md', 'CONTRIBUTING.md', 'CODE_OF_CONDUCT.md', '.env.example', 'docs/FIRST_RUN.md', 'docs/DEMO.md', 'docs/RELEASE.md']) {
      expect(existsSync(resolve(root, file)), `${file} must exist`).toBe(true);
    }
  });

  it('requires security and isolated tests in CI', () => {
    const workflow = read('.github/workflows/ci.yml');
    const packageJson = JSON.parse(read('package.json'));
    expect(workflow).toContain('npm run security:check');
    expect(workflow).toContain('npm test');
    expect(packageJson.scripts['security:check']).toContain('npm audit --omit=dev');
    expect(packageJson.scripts.test).toContain('vitest run');
  });
});

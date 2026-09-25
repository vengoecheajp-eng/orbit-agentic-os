import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { dependencyRequestHash, dependencySource, diffManifest, hasDependencyChanges, installInvocation, registryName } from '../dependency-gate.mjs';

describe('dependency diff', () => {
  it('reports new packages, version changes, and install scripts', () => {
    const diff = diffManifest(
      { dependencies: { react: '^19.0.0' }, scripts: { build: 'vite build' } },
      { dependencies: { react: '^20.0.0', zod: '^3.23.0' }, devDependencies: { vitest: '^3.0.0' }, scripts: { build: 'vite build --debug', postinstall: 'node setup.js' } }
    );
    expect(diff.added).toEqual([
      { name: 'zod', section: 'dependencies', spec: '^3.23.0', source: 'registry' },
      { name: 'vitest', section: 'devDependencies', spec: '^3.0.0', source: 'registry' }
    ]);
    expect(diff.changed).toEqual([{ name: 'react', section: 'dependencies', from: '^19.0.0', to: '^20.0.0', source: 'registry' }]);
    // Only install-time scripts need approval; editing `build` does not.
    expect(diff.scripts).toEqual([{ name: 'postinstall', from: null, to: 'node setup.js' }]);
  });

  it('ignores removals and packages that only move between sections', () => {
    const diff = diffManifest(
      { dependencies: { vitest: '^3.0.0', lodash: '^4.0.0' } },
      { devDependencies: { vitest: '^3.0.0' } }
    );
    expect(hasDependencyChanges(diff)).toBe(false);
  });

  it('treats every dependency of a brand-new package.json as new', () => {
    const diff = diffManifest({}, { dependencies: { express: '^5.0.0' } });
    expect(diff.added.map(entry => entry.name)).toEqual(['express']);
  });

  it('classifies where a package would be installed from', () => {
    expect(dependencySource('^1.2.3')).toBe('registry');
    expect(dependencySource('latest')).toBe('registry');
    expect(dependencySource('file:../lib')).toBe('local');
    expect(dependencySource('github:user/repo')).toBe('git');
    expect(dependencySource('user/repo#main')).toBe('git');
    expect(dependencySource('git+https://example.invalid/r.git')).toBe('git');
    expect(dependencySource('https://example.invalid/p.tgz')).toBe('url');
    expect(dependencySource('workspace:*')).toBe('workspace');
    expect(dependencySource('npm:string-width@^4')).toBe('alias');
    expect(registryName('sw', 'npm:string-width@^4')).toBe('string-width');
    expect(registryName('scoped', 'npm:@scope/pkg@1')).toBe('@scope/pkg');
  });

  it('gives a different hash to a different request', () => {
    const one = [{ path: 'package.json', ...diffManifest({}, { dependencies: { a: '1' } }) }];
    const two = [{ path: 'package.json', ...diffManifest({}, { dependencies: { a: '2' } }) }];
    expect(dependencyRequestHash(one)).toBe(dependencyRequestHash(structuredClone(one)));
    expect(dependencyRequestHash(one)).not.toBe(dependencyRequestHash(two));
  });
});

describe('install commands', () => {
  let directory;
  afterEach(() => { if (directory) rmSync(directory, { recursive: true, force: true }); });
  const project = files => {
    directory = mkdtempSync(join(tmpdir(), 'orbit-install-'));
    writeFileSync(join(directory, 'package.json'), JSON.stringify(files.manifest || { name: 'x' }));
    for (const file of files.extra || []) writeFileSync(join(directory, file), '');
    return directory;
  };

  it('never writes a lockfile when installing declared dependencies in the main repo', () => {
    expect(installInvocation(project({}), 'frozen').label).toBe('npm install --no-package-lock --no-audit --no-fund');
  });

  it('uses the lockfile and package manager the project already has', () => {
    expect(installInvocation(project({ extra: ['package-lock.json'] }), 'frozen').label).toBe('npm ci --no-audit --no-fund');
    rmSync(directory, { recursive: true, force: true });
    expect(installInvocation(project({ extra: ['pnpm-lock.yaml'] }), 'frozen').label).toBe('pnpm install --frozen-lockfile');
    rmSync(directory, { recursive: true, force: true });
    expect(installInvocation(project({ extra: ['yarn.lock', '.yarnrc.yml'] }), 'frozen').label).toBe('yarn install --immutable');
    rmSync(directory, { recursive: true, force: true });
    expect(installInvocation(project({ manifest: { packageManager: 'bun@1.2.0' } }), 'update').label).toBe('bun install');
  });

  it('updates the lockfile when installing approved dependencies in a worktree', () => {
    expect(installInvocation(project({ extra: ['package-lock.json'] }), 'update').label).toBe('npm install --no-audit --no-fund');
  });
});

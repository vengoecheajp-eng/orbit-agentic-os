import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { ECOSYSTEMS, diffParsed, npmSource, stepLabel } from './ecosystems.mjs';

// Rules for Orbit's dependency approval gate: what counts as a change that
// needs a human decision, and how one exact request is identified. Parsing
// and install commands for every ecosystem live in ecosystems.mjs.

export const DEPENDENCY_SECTIONS = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];
export { NPM_INSTALL_SCRIPTS as INSTALL_LIFECYCLE_SCRIPTS } from './ecosystems.mjs';
export const dependencySource = npmSource;

// Registry name to look up for an npm dependency (resolves `npm:` aliases).
export function registryName(name, spec) {
  const alias = String(spec || '').match(/^npm:((?:@[^/]+\/)?[^@]+)/i);
  return alias ? alias[1] : name;
}

// npm-specific convenience: diff two parsed package.json objects.
export function diffManifest(baseManifest = {}, nextManifest = {}) {
  const parse = ECOSYSTEMS.npm.manifests[0].parse;
  return diffParsed(parse(JSON.stringify(baseManifest || {})), parse(JSON.stringify(nextManifest || {})));
}

export function hasDependencyChanges(diff) {
  return Boolean(diff && (diff.added?.length || diff.changed?.length || diff.scripts?.length || diff.raw));
}

// Identifies one exact set of requested changes, so an approval can never be
// applied to a different list than the one the reviewer saw.
export function dependencyRequestHash(manifests) {
  const stable = manifests.map(manifest => ({ path: manifest.path, ecosystem: manifest.ecosystem, kind: manifest.kind, added: manifest.added, changed: manifest.changed, scripts: manifest.scripts, raw: manifest.raw ? manifest.raw.sha : undefined }));
  return createHash('sha256').update(JSON.stringify(stable)).digest('hex');
}

export function detectPackageManager(directory) {
  const has = file => existsSync(join(directory, file));
  if (has('pnpm-lock.yaml')) return { manager: 'pnpm', lockfile: true };
  if (has('yarn.lock')) return { manager: 'yarn', lockfile: true, berry: has('.yarnrc.yml') };
  if (has('bun.lock') || has('bun.lockb')) return { manager: 'bun', lockfile: true };
  if (has('package-lock.json') || has('npm-shrinkwrap.json')) return { manager: 'npm', lockfile: true };
  let declared = '';
  try { declared = String(JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8')).packageManager || ''); } catch { /* Fall back to npm. */ }
  const manager = ['pnpm', 'yarn', 'bun'].find(name => declared.startsWith(`${name}@`)) || 'npm';
  return { manager, lockfile: false, berry: manager === 'yarn' && has('.yarnrc.yml') };
}

// npm-family install command for one directory (see ecosystems.mjs for others).
export function installInvocation(directory, mode = 'frozen', options = {}) {
  const [step] = ECOSYSTEMS.npm.install(directory, mode, options);
  return { ...step, label: stepLabel(step) };
}

export function declaresDependencies(manifest) {
  return DEPENDENCY_SECTIONS.some(name => manifest?.[name] && Object.keys(manifest[name]).length > 0);
}

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { parse as parseToml } from 'smol-toml';
import { parse as parseYaml } from 'yaml';

// Package ecosystems Orbit understands. For each one this module knows which
// files declare dependencies (and how to read them), which files are
// lockfiles or registry configuration, where packages come from, how to
// install approved changes, and how to build and test a project.
//
// Everything here is pure except for small reads of files inside the project
// directory; the server decides when to run commands.

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const entry = (name, spec, section, source, key = name) => ({ key, name, spec: String(spec ?? ''), section, source });

// Where an npm-style spec is fetched from.
export function npmSource(spec) {
  const value = String(spec || '').trim();
  if (/^(file|link):/i.test(value) || /^\.{0,2}\//.test(value)) return 'local';
  if (/^workspace:/i.test(value)) return 'workspace';
  if (/^npm:/i.test(value)) return 'alias';
  if (/^(git\+|git:|github:|gitlab:|bitbucket:)/i.test(value) || /^[\w.-]+\/[\w.-]+(#.*)?$/.test(value)) return 'git';
  if (/^https?:/i.test(value)) return 'url';
  return 'registry';
}

function urlSource(value) {
  const text = String(value || '').trim();
  if (/^git\+|\.git(#|@|$)|^git:|^ssh:/i.test(text)) return 'git';
  if (/^(file:|\.{0,2}\/)/i.test(text)) return 'local';
  if (/^https?:/i.test(text)) return 'url';
  return 'registry';
}

// PEP 503 name normalisation, so "Django" and "django" are the same package.
export const normalizePythonName = name => String(name).toLowerCase().replace(/[-_.]+/g, '-');

// One PEP 508 requirement ("requests[socks]>=2.31 ; python_version>'3.8'").
export function parsePep508(line, section) {
  const text = String(line || '').trim();
  if (!text) return null;
  const direct = text.match(/^([A-Za-z0-9][A-Za-z0-9._-]*)\s*(\[[^\]]*\])?\s*@\s*(\S+)(.*)$/);
  if (direct) return entry(direct[1], `@ ${direct[3]}${direct[4] || ''}`.trim(), section, urlSource(direct[3]), normalizePythonName(direct[1]));
  const match = text.match(/^([A-Za-z0-9][A-Za-z0-9._-]*)\s*(\[[^\]]*\])?\s*(.*)$/);
  if (!match) return null;
  return entry(match[1], `${match[2] || ''}${match[3] || ''}`.trim() || '*', section, 'registry', normalizePythonName(match[1]));
}

// ---------------------------------------------------------------------------
// Manifest parsers. Each returns { entries: [...], scripts: {...} } where
// `scripts` holds only commands a package manager runs during install.
// ---------------------------------------------------------------------------

const NPM_SECTIONS = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];
export const NPM_INSTALL_SCRIPTS = ['preinstall', 'install', 'postinstall', 'prepare'];
function parsePackageJson(text) {
  const manifest = JSON.parse(text);
  const entries = [];
  for (const section of NPM_SECTIONS) {
    for (const [name, spec] of Object.entries(manifest?.[section] || {})) entries.push(entry(name, spec, section, npmSource(spec)));
  }
  const scripts = {};
  for (const name of NPM_INSTALL_SCRIPTS) if (manifest?.scripts?.[name] !== undefined) scripts[name] = String(manifest.scripts[name]);
  return { entries, scripts };
}

// requirements.txt / constraints.txt, including index options that change
// where packages are downloaded from (a common dependency-confusion vector).
function parseRequirements(text) {
  const entries = [];
  const logical = text.replace(/\\\r?\n/g, ' ').split(/\r?\n/);
  for (const raw of logical) {
    const line = raw.replace(/(^|\s)#.*$/, '').trim();
    if (!line) continue;
    const option = line.match(/^(-i|--index-url|--extra-index-url|-f|--find-links|--trusted-host)[=\s]+(\S+)/);
    if (option) { entries.push(entry(option[1], option[2], 'index', 'url', `option:${option[1]}:${option[2]}`)); continue; }
    const editable = line.match(/^(-e|--editable)[=\s]+(\S+)/);
    if (editable) { entries.push(entry(editable[2], editable[2], 'editable', urlSource(editable[2]), `editable:${editable[2]}`)); continue; }
    if (/^-/.test(line)) continue; // -r / -c includes: those files are diffed on their own.
    if (/^(git\+|https?:|file:|\.{0,2}\/)/i.test(line)) {
      const egg = line.match(/#egg=([A-Za-z0-9._-]+)/);
      entries.push(entry(egg ? egg[1] : line, line, 'dependencies', urlSource(line), egg ? normalizePythonName(egg[1]) : `url:${line}`));
      continue;
    }
    const parsed = parsePep508(line, 'dependencies');
    if (parsed) entries.push(parsed);
  }
  return { entries, scripts: {} };
}

function poetryEntries(table, section) {
  return Object.entries(table || {}).flatMap(([name, value]) => {
    if (name.toLowerCase() === 'python') return [];
    if (typeof value === 'string') return [entry(name, value, section, 'registry', normalizePythonName(name))];
    const spec = value.version || value.git || value.path || value.url || JSON.stringify(value);
    const source = value.git ? 'git' : value.path ? 'local' : value.url ? 'url' : value.source ? 'private' : 'registry';
    return [entry(name, spec, section, source, normalizePythonName(name))];
  });
}

function parsePyproject(text) {
  const doc = parseToml(text);
  const entries = [];
  for (const line of doc.project?.dependencies || []) { const parsed = parsePep508(line, 'dependencies'); if (parsed) entries.push(parsed); }
  for (const [group, lines] of Object.entries(doc.project?.['optional-dependencies'] || {})) {
    for (const line of lines || []) { const parsed = parsePep508(line, `optional:${group}`); if (parsed) entries.push(parsed); }
  }
  for (const [group, lines] of Object.entries(doc['dependency-groups'] || {})) {
    for (const line of lines || []) { if (typeof line === 'string') { const parsed = parsePep508(line, `group:${group}`); if (parsed) entries.push(parsed); } }
  }
  // Build requirements are downloaded and executed to build the project.
  for (const line of doc['build-system']?.requires || []) { const parsed = parsePep508(line, 'build'); if (parsed) entries.push({ ...parsed, key: `build:${parsed.key}` }); }
  const poetry = doc.tool?.poetry;
  if (poetry) {
    entries.push(...poetryEntries(poetry.dependencies, 'dependencies'));
    entries.push(...poetryEntries(poetry['dev-dependencies'], 'dev'));
    for (const [group, value] of Object.entries(poetry.group || {})) entries.push(...poetryEntries(value?.dependencies, `group:${group}`));
    for (const source of poetry.source || []) if (source?.url) entries.push(entry(source.name || source.url, source.url, 'index', 'url', `index:${source.url}`));
  }
  const uv = doc.tool?.uv;
  if (uv) {
    for (const [name, value] of Object.entries(uv.sources || {})) {
      const spec = value?.git || value?.path || value?.url || value?.index || JSON.stringify(value);
      entries.push(entry(name, spec, 'source override', value?.git ? 'git' : value?.path ? 'local' : value?.url ? 'url' : 'private', `uv-source:${normalizePythonName(name)}`));
    }
    for (const index of uv.index || []) if (index?.url) entries.push(entry(index.name || index.url, index.url, 'index', 'url', `index:${index.url}`));
    for (const line of uv['dev-dependencies'] || []) { const parsed = parsePep508(line, 'dev'); if (parsed) entries.push(parsed); }
  }
  return { entries, scripts: {} };
}

function parsePipfile(text) {
  const doc = parseToml(text);
  const entries = [...poetryEntries(doc.packages, 'dependencies'), ...poetryEntries(doc['dev-packages'], 'dev')];
  for (const source of doc.source || []) if (source?.url) entries.push(entry(source.name || source.url, source.url, 'index', 'url', `index:${source.url}`));
  return { entries, scripts: {} };
}

function cargoTable(table, section) {
  return Object.entries(table || {}).map(([name, value]) => {
    const keyFor = crate => section.startsWith('target') ? `${section}:${crate}` : `crate:${crate}`;
    if (typeof value === 'string') return entry(name, value, section, 'registry', keyFor(name));
    const crate = value.package || name;
    const spec = value.version || value.git || value.path || (value.workspace ? 'workspace' : JSON.stringify(value));
    const source = value.git ? 'git' : value.path ? 'local' : value.registry ? 'private' : value.workspace ? 'workspace' : 'registry';
    // A crate is one dependency whichever of the three sections lists it.
    return entry(crate, spec, section, source, keyFor(crate));
  });
}
function parseCargo(text) {
  const doc = parseToml(text);
  const entries = [];
  for (const section of ['dependencies', 'dev-dependencies', 'build-dependencies']) entries.push(...cargoTable(doc[section], section));
  entries.push(...cargoTable(doc.workspace?.dependencies, 'workspace'));
  for (const [target, value] of Object.entries(doc.target || {})) {
    for (const section of ['dependencies', 'dev-dependencies', 'build-dependencies']) entries.push(...cargoTable(value?.[section], `target ${target} ${section}`));
  }
  // [patch] and [replace] silently swap a crate's source for every dependant.
  for (const [registry, table] of Object.entries(doc.patch || {})) {
    for (const item of cargoTable(table, `patch ${registry}`)) entries.push({ ...item, key: `patch:${registry}:${item.name}` });
  }
  for (const [name, value] of Object.entries(doc.replace || {})) entries.push(entry(name, JSON.stringify(value), 'replace', 'local', `replace:${name}`));
  return { entries, scripts: {} };
}

function parseGoMod(text) {
  const entries = [];
  const lines = text.split(/\r?\n/);
  let block = null;
  for (const raw of lines) {
    const line = raw.replace(/\/\/(?!\s*indirect).*$/, '').trim();
    if (!line) continue;
    const open = line.match(/^(require|replace|tool|exclude)\s*\($/);
    if (open) { block = open[1]; continue; }
    if (line === ')') { block = null; continue; }
    const single = line.match(/^(require|replace|tool|exclude)\s+(.+)$/);
    const directive = single ? single[1] : block;
    const body = single ? single[2] : block ? line : null;
    if (!directive || !body) continue;
    const indirect = /\/\/\s*indirect/.test(body);
    const clean = body.replace(/\/\/.*$/, '').trim();
    if (directive === 'require') {
      const [module, version] = clean.split(/\s+/);
      entries.push(entry(module, version, indirect ? 'indirect' : 'require', 'registry', module));
    } else if (directive === 'replace') {
      const [from, to] = clean.split(/\s*=>\s*/);
      const target = (to || '').trim();
      entries.push(entry(from.split(/\s+/)[0], target, 'replace', /^(\.{0,2}\/)/.test(target) ? 'local' : 'git', `replace:${from.trim()}`));
    } else if (directive === 'tool') {
      entries.push(entry(clean, 'tool', 'tool', 'registry', `tool:${clean}`));
    }
  }
  return { entries, scripts: {} };
}

// Gemfile is Ruby code; this reads the conventional `gem`, `source`, and
// `group ... do` lines, which covers nearly every real Gemfile.
function parseGemfile(text) {
  const entries = [];
  const groups = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/(^|\s)#.*$/, '').trim();
    if (!line) continue;
    const group = line.match(/^group\s+(.+?)\s+do\b/);
    if (group) { groups.push(group[1].replace(/[:\s]/g, '')); continue; }
    if (/^end\b/.test(line) && groups.length) { groups.pop(); continue; }
    const source = line.match(/^source\s+['"]([^'"]+)['"]/);
    if (source) { entries.push(entry(source[1], source[1], 'index', 'url', `source:${source[1]}`)); continue; }
    const gem = line.match(/^gem\s+['"]([^'"]+)['"]\s*(.*)$/);
    if (!gem) continue;
    const rest = gem[2];
    const versions = [...rest.matchAll(/(?:^|,)\s*['"]([^'"]+)['"]/g)].map(match => match[1]);
    const option = rest.match(/\b(git|github|path|source)\s*:\s*['"]([^'"]+)['"]/);
    const spec = option ? `${option[1]}: ${option[2]}` : versions.join(', ') || '*';
    const sourceKind = option ? (option[1] === 'path' ? 'local' : option[1] === 'source' ? 'private' : 'git') : 'registry';
    entries.push(entry(gem[1], spec, groups.length ? `group ${groups.at(-1)}` : 'dependencies', sourceKind, gem[1]));
  }
  return { entries, scripts: {} };
}

export const COMPOSER_INSTALL_SCRIPTS = ['pre-install-cmd', 'post-install-cmd', 'pre-update-cmd', 'post-update-cmd', 'post-autoload-dump', 'pre-autoload-dump', 'post-package-install', 'post-package-update'];
function parseComposer(text) {
  const manifest = JSON.parse(text);
  const entries = [];
  for (const section of ['require', 'require-dev']) {
    for (const [name, spec] of Object.entries(manifest?.[section] || {})) {
      if (name === 'php' || /^(ext|lib)-/.test(name)) continue;
      entries.push(entry(name, spec, section, 'registry'));
    }
  }
  for (const repository of manifest?.repositories || []) {
    if (!repository || typeof repository !== 'object') continue;
    const url = repository.url || JSON.stringify(repository);
    entries.push(entry(url, `${repository.type || 'repository'} ${url}`, 'repository', repository.type === 'path' ? 'local' : repository.type === 'vcs' ? 'git' : 'url', `repository:${url}`));
  }
  // Composer plugins run code on every install; allowing one is a real decision.
  for (const [plugin, allowed] of Object.entries(manifest?.config?.['allow-plugins'] || {})) {
    if (allowed) entries.push(entry(plugin, 'allowed', 'plugin permission', 'registry', `allow-plugin:${plugin}`));
  }
  const scripts = {};
  for (const name of COMPOSER_INSTALL_SCRIPTS) if (manifest?.scripts?.[name] !== undefined) scripts[name] = JSON.stringify(manifest.scripts[name]);
  return { entries, scripts };
}

function xmlValue(block, tag) {
  return block.match(new RegExp(`<${tag}>\\s*([^<]*?)\\s*</${tag}>`))?.[1];
}
function parseMsbuild(text) {
  const entries = [];
  for (const match of text.matchAll(/<(PackageReference|PackageVersion|GlobalPackageReference)\b([^>]*?)(\/>|>([\s\S]*?)<\/\1>)/g)) {
    const attributes = match[2];
    const name = attributes.match(/\b(?:Include|Update)\s*=\s*"([^"]+)"/)?.[1];
    if (!name) continue;
    const version = attributes.match(/\bVersion(?:Override)?\s*=\s*"([^"]+)"/)?.[1] || xmlValue(match[4] || '', 'Version') || '(central)';
    entries.push(entry(name, version, match[1] === 'PackageVersion' ? 'central version' : 'dependencies', 'registry', name.toLowerCase()));
  }
  for (const match of text.matchAll(/<package\s+([^>]*?)\/?>/g)) { // packages.config
    const name = match[1].match(/\bid="([^"]+)"/)?.[1];
    const version = match[1].match(/\bversion="([^"]+)"/)?.[1];
    if (name) entries.push(entry(name, version, 'dependencies', 'registry', name.toLowerCase()));
  }
  return { entries, scripts: {} };
}

function parsePom(text) {
  const entries = [];
  const withoutComments = text.replace(/<!--[\s\S]*?-->/g, '');
  for (const [tag, section] of [['dependency', 'dependencies'], ['plugin', 'build plugin'], ['extension', 'build extension']]) {
    for (const match of withoutComments.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'g'))) {
      const group = xmlValue(match[1], 'groupId') || (tag === 'plugin' ? 'org.apache.maven.plugins' : '');
      const artifact = xmlValue(match[1], 'artifactId');
      if (!artifact) continue;
      const version = xmlValue(match[1], 'version') || '(managed)';
      const scope = xmlValue(match[1], 'scope');
      entries.push(entry(`${group}:${artifact}`, version, scope ? `${section} (${scope})` : section, 'registry', `${tag}:${group}:${artifact}`));
    }
  }
  for (const match of withoutComments.matchAll(/<(repository|pluginRepository)>([\s\S]*?)<\/\1>/g)) {
    const url = xmlValue(match[2], 'url');
    if (url) entries.push(entry(url, url, 'repository', 'url', `repository:${url}`));
  }
  return { entries, scripts: {} };
}

const GRADLE_CONFIGURATION = /^(implementation|api|compileOnly|runtimeOnly|testImplementation|testCompileOnly|testRuntimeOnly|androidTestImplementation|debugImplementation|releaseImplementation|annotationProcessor|kapt|ksp|classpath|developmentOnly|compile|testCompile|[a-z]+(Implementation|Api|CompileOnly|RuntimeOnly))$/;
function parseGradle(text) {
  const entries = [];
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  for (const match of clean.matchAll(/\b([A-Za-z]+)\s*\(?\s*["']([^"'\s:]+):([^"'\s:]+)(?::([^"'\s]+))?["']/g)) {
    if (!GRADLE_CONFIGURATION.test(match[1])) continue;
    entries.push(entry(`${match[2]}:${match[3]}`, match[4] || '(managed)', match[1], 'registry', `${match[2]}:${match[3]}:${match[1]}`));
  }
  for (const match of clean.matchAll(/\b([A-Za-z]+)\s*\(?\s*group\s*[:=]\s*["']([^"']+)["']\s*,\s*name\s*[:=]\s*["']([^"']+)["'](?:\s*,\s*version\s*[:=]\s*["']([^"']+)["'])?/g)) {
    if (!GRADLE_CONFIGURATION.test(match[1])) continue;
    entries.push(entry(`${match[2]}:${match[3]}`, match[4] || '(managed)', match[1], 'registry', `${match[2]}:${match[3]}:${match[1]}`));
  }
  for (const match of clean.matchAll(/\bid\s*\(?\s*["']([^"']+)["']\s*\)?\s*version\s*\(?\s*["']([^"']+)["']/g)) {
    entries.push(entry(match[1], match[2], 'plugin', 'registry', `plugin:${match[1]}`));
  }
  for (const match of clean.matchAll(/\bmaven\s*(?:\{[^}]*?url\s*(?:=\s*)?(?:uri\s*\()?\s*["']([^"']+)["']|\(\s*(?:url\s*=\s*)?["']([^"']+)["'])/g)) {
    const url = match[1] || match[2];
    entries.push(entry(url, url, 'repository', 'url', `repository:${url}`));
  }
  return { entries, scripts: {} };
}

function parseVersionCatalog(text) {
  const doc = parseToml(text);
  const versions = doc.versions || {};
  const resolve = value => typeof value === 'object' && value?.ref ? `${versions[value.ref] ?? value.ref}` : value;
  const entries = [];
  for (const [alias, value] of Object.entries(doc.libraries || {})) {
    if (typeof value === 'string') { const [group, artifact, version] = value.split(':'); entries.push(entry(`${group}:${artifact}`, version || '(managed)', 'library', 'registry', `library:${alias}`)); continue; }
    const module = value.module || `${value.group}:${value.name}`;
    entries.push(entry(module, resolve(value.version) || '(managed)', 'library', 'registry', `library:${alias}`));
  }
  for (const [alias, value] of Object.entries(doc.plugins || {})) {
    const id = typeof value === 'string' ? value.split(':')[0] : value.id;
    const version = typeof value === 'string' ? value.split(':')[1] : resolve(value.version);
    entries.push(entry(id, version || '(managed)', 'plugin', 'registry', `plugin:${alias}`));
  }
  return { entries, scripts: {} };
}

function parsePubspec(text) {
  const doc = parseYaml(text) || {};
  const entries = [];
  for (const section of ['dependencies', 'dev_dependencies', 'dependency_overrides']) {
    for (const [name, value] of Object.entries(doc[section] || {})) {
      if (value && typeof value === 'object' && value.sdk) continue; // flutter / flutter_test ship with the SDK
      if (value === null || typeof value !== 'object') { entries.push(entry(name, value ?? 'any', section, 'registry', `${section === 'dependency_overrides' ? 'override:' : ''}${name}`)); continue; }
      const gitUrl = typeof value.git === 'string' ? value.git : value.git?.url;
      const spec = value.version || gitUrl || value.path || value.hosted?.url || value.hosted || JSON.stringify(value);
      const source = gitUrl ? 'git' : value.path ? 'local' : value.hosted ? 'private' : 'registry';
      entries.push(entry(name, spec, section, source, `${section === 'dependency_overrides' ? 'override:' : ''}${name}`));
    }
  }
  return { entries, scripts: {} };
}

function parsePackageSwift(text) {
  const entries = [];
  for (const match of text.matchAll(/\.package\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g)) {
    const args = match[1];
    const url = args.match(/url\s*:\s*"([^"]+)"/)?.[1];
    const path = args.match(/path\s*:\s*"([^"]+)"/)?.[1];
    const requirement = args.replace(/(?:name|url|path)\s*:\s*"[^"]*"\s*,?/g, '').trim().replace(/\s+/g, ' ');
    if (url) entries.push(entry(url.replace(/\.git$/, '').split('/').slice(-2).join('/'), `${requirement || 'any'} (${url})`, 'dependencies', 'git', url.toLowerCase().replace(/\.git$/, '')));
    else if (path) entries.push(entry(path, path, 'dependencies', 'local', `path:${path}`));
  }
  return { entries, scripts: {} };
}

function parseMix(text) {
  const entries = [];
  for (const match of text.matchAll(/\{\s*:([a-z0-9_]+)\s*,([^{}]*)\}/g)) {
    const rest = match[2];
    const version = rest.match(/^\s*"([^"]+)"/)?.[1];
    const option = rest.match(/\b(git|github|path|hex|organization|repo)\s*:\s*"([^"]+)"/);
    if (!version && !option) continue;
    const only = rest.match(/\bonly\s*:\s*(\[[^\]]*\]|:\w+)/)?.[1];
    const source = option ? ({ path: 'local', git: 'git', github: 'git', organization: 'private', repo: 'private' }[option[1]] || 'registry') : 'registry';
    entries.push(entry(match[1], version || `${option[1]}: ${option[2]}`, only ? `only ${only.replace(/[:[\]\s]/g, '')}` : 'deps', source, match[1]));
  }
  return { entries, scripts: {} };
}

// ---------------------------------------------------------------------------
// Ecosystem definitions
// ---------------------------------------------------------------------------

const has = (directory, file) => existsSync(join(directory, file));
const readJson = file => { try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; } };
const readText = file => { try { return readFileSync(file, 'utf8'); } catch { return ''; } };

function npmManager(directory) {
  if (has(directory, 'pnpm-lock.yaml')) return { manager: 'pnpm', lockfile: true };
  if (has(directory, 'yarn.lock')) return { manager: 'yarn', lockfile: true, berry: has(directory, '.yarnrc.yml') };
  if (has(directory, 'bun.lock') || has(directory, 'bun.lockb')) return { manager: 'bun', lockfile: true };
  if (has(directory, 'package-lock.json') || has(directory, 'npm-shrinkwrap.json')) return { manager: 'npm', lockfile: true };
  const declared = String(readJson(join(directory, 'package.json'))?.packageManager || '');
  const manager = ['pnpm', 'yarn', 'bun'].find(name => declared.startsWith(`${name}@`)) || 'npm';
  return { manager, lockfile: false, berry: manager === 'yarn' && has(directory, '.yarnrc.yml') };
}

function npmInstall(directory, mode, { ignoreScripts = false } = {}) {
  const { manager, lockfile, berry } = npmManager(directory);
  const frozen = mode === 'frozen';
  const env = {};
  let args;
  if (manager === 'npm') {
    args = frozen ? (lockfile ? ['ci', '--no-audit', '--no-fund'] : ['install', '--no-package-lock', '--no-audit', '--no-fund']) : ['install', '--no-audit', '--no-fund'];
  } else if (manager === 'pnpm') {
    args = frozen ? (lockfile ? ['install', '--frozen-lockfile'] : ['install', '--config.lockfile=false']) : ['install', '--no-frozen-lockfile'];
  } else if (manager === 'yarn') {
    if (berry) {
      args = frozen && lockfile ? ['install', '--immutable'] : ['install'];
      if (!frozen) env.YARN_ENABLE_IMMUTABLE_INSTALLS = 'false';
      if (ignoreScripts) env.YARN_ENABLE_SCRIPTS = 'false';
    } else {
      args = frozen ? (lockfile ? ['install', '--frozen-lockfile'] : ['install', '--no-lockfile']) : ['install'];
    }
  } else {
    args = frozen ? (lockfile ? ['install', '--frozen-lockfile'] : ['install', '--no-save']) : ['install'];
  }
  if (ignoreScripts && !(manager === 'yarn' && berry)) args.push('--ignore-scripts');
  return [{ command: manager, args, env }];
}

function npmChecks(directory) {
  const manifest = readJson(join(directory, 'package.json'));
  if (!manifest) return [];
  const { manager } = npmManager(directory);
  const runArgs = script => manager === 'npm' ? ['run', script] : ['run', script];
  const steps = [];
  if (manifest.scripts?.build) steps.push({ kind: 'build', command: manager, args: runArgs('build') });
  if (manifest.scripts?.test && !/no test specified/i.test(manifest.scripts.test)) {
    const script = manifest.scripts.test.toLowerCase();
    const flags = script.includes('vitest') ? ['--run'] : script.includes('jest') ? ['--runInBand'] : [];
    steps.push({ kind: 'test', command: manager, args: flags.length ? (manager === 'npm' ? ['run', 'test', '--', ...flags] : ['run', 'test', ...flags]) : ['run', 'test'] });
  }
  return steps;
}

function pythonTool(directory) {
  const pyproject = readText(join(directory, 'pyproject.toml'));
  if (has(directory, 'uv.lock') || /\[tool\.uv\]/.test(pyproject)) return 'uv';
  if (has(directory, 'poetry.lock') || /\[tool\.poetry\]/.test(pyproject)) return 'poetry';
  if (has(directory, 'Pipfile')) return 'pipenv';
  if (has(directory, 'pdm.lock') || /\[tool\.pdm\]/.test(pyproject)) return 'pdm';
  return 'pip';
}
function requirementsFile(directory) {
  return ['requirements.txt', 'requirements-dev.txt', 'requirements/dev.txt', 'requirements/base.txt'].find(file => has(directory, file)) || null;
}
const VENV_PYTHON = process.platform === 'win32' ? join('.venv', 'Scripts', 'python.exe') : join('.venv', 'bin', 'python');
function pythonInstall(directory, mode, { ignoreScripts = false, dependencies = [] } = {}) {
  const tool = pythonTool(directory);
  const frozen = mode === 'frozen';
  const binaryOnly = ignoreScripts ? ['--only-binary', ':all:'] : [];
  if (tool === 'uv') return [{ command: 'uv', args: ['sync', ...(frozen ? ['--frozen'] : []), ...(ignoreScripts ? ['--no-build'] : [])], env: { UV_PROJECT_ENVIRONMENT: '.venv' } }];
  if (tool === 'poetry') return [
    ...(frozen ? [] : [{ command: 'poetry', args: ['lock'], env: { POETRY_VIRTUALENVS_IN_PROJECT: 'true' } }]),
    { command: 'poetry', args: ['install', '--no-root', '--no-interaction'], env: { POETRY_VIRTUALENVS_IN_PROJECT: 'true' } }
  ];
  if (tool === 'pipenv') return [{ command: 'pipenv', args: frozen ? ['sync', '--dev'] : ['install', '--dev'], env: { PIPENV_VENV_IN_PROJECT: '1' } }];
  if (tool === 'pdm') return [{ command: 'pdm', args: frozen ? ['sync', '--no-self'] : ['install', '--no-self'], env: {} }];
  const requirements = requirementsFile(directory);
  const createVenv = { command: 'python3', args: ['-m', 'venv', '.venv'], env: {}, skipIfExists: '.venv' };
  if (requirements) return [createVenv, { command: VENV_PYTHON, args: ['-m', 'pip', 'install', '--disable-pip-version-check', '-q', ...binaryOnly, '-r', requirements], env: {} }];
  // A pyproject without a lockfile tool: install the declared dependency list,
  // never the project itself (that would build it into the source folder).
  const specs = dependencies.filter(item => item.section === 'dependencies' || item.section.startsWith('group:') || item.section.startsWith('optional:')).map(item => item.spec.startsWith('@') ? `${item.name} ${item.spec}` : `${item.name}${item.spec === '*' ? '' : item.spec}`);
  if (!specs.length) return [createVenv];
  return [createVenv, { command: VENV_PYTHON, args: ['-m', 'pip', 'install', '--disable-pip-version-check', '-q', ...binaryOnly, ...specs], env: {} }];
}
function pythonChecks(directory) {
  const python = has(directory, VENV_PYTHON) ? VENV_PYTHON : 'python3';
  const steps = [{ kind: 'build', command: python, args: ['-m', 'compileall', '-q', '-x', '(^|/)(\\.venv|venv|node_modules|\\.git|build|dist)(/|$)', '.'], label: 'python -m compileall (syntax check)' }];
  const pyproject = readText(join(directory, 'pyproject.toml'));
  const usesPytest = has(directory, 'pytest.ini') || has(directory, 'conftest.py') || /\[tool\.pytest|pytest/.test(pyproject) || /pytest/i.test(readText(join(directory, requirementsFile(directory) || 'requirements.txt')));
  const testFolder = ['tests', 'test'].find(folder => has(directory, folder));
  if (usesPytest) steps.push({ kind: 'test', command: python, args: ['-m', 'pytest', '-q'] });
  // Discovery from the root skips test folders without __init__.py, so start in
  // the folder; keep the root as top level only when the folder is a package.
  else if (testFolder) steps.push({ kind: 'test', command: python, args: ['-m', 'unittest', 'discover', '-s', testFolder, ...(has(directory, join(testFolder, '__init__.py')) ? ['-t', '.'] : []), '-q'] });
  return steps;
}

const gradleCommand = directory => has(directory, 'gradlew') ? './gradlew' : 'gradle';
const mavenCommand = directory => has(directory, 'mvnw') ? './mvnw' : 'mvn';
const dartCommand = directory => /\bsdk:\s*flutter\b/.test(readText(join(directory, 'pubspec.yaml'))) ? 'flutter' : 'dart';

export const ECOSYSTEMS = {
  npm: {
    label: 'npm', registry: 'npm registry',
    markers: ['package.json'],
    manifests: [{ test: name => name === 'package.json', parse: parsePackageJson }],
    lockfiles: ['package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb'],
    config: ['.npmrc', '.yarnrc', '.yarnrc.yml', 'bunfig.toml', '.pnpmfile.cjs'],
    installDirs: ['node_modules'],
    install: npmInstall,
    toolFor: directory => npmManager(directory).manager,
    checks: npmChecks,
    scriptWarning: 'Package install scripts may run.'
  },
  python: {
    label: 'Python', registry: 'PyPI',
    markers: ['pyproject.toml', 'requirements.txt', 'Pipfile', 'setup.py', 'setup.cfg'],
    manifests: [
      { test: name => /^(requirements|constraints)([-_.][\w.-]+)?\.(txt|in)$/i.test(name), parse: parseRequirements },
      { test: (name, path) => /(^|\/)requirements\/[\w.-]+\.(txt|in)$/i.test(path), parse: parseRequirements },
      { test: name => name === 'pyproject.toml', parse: parsePyproject },
      { test: name => name === 'Pipfile', parse: parsePipfile },
      { test: name => name === 'setup.py' || name === 'setup.cfg', parse: null }
    ],
    lockfiles: ['uv.lock', 'poetry.lock', 'Pipfile.lock', 'pdm.lock'],
    config: ['pip.conf', 'pip.ini', 'uv.toml', 'poetry.toml', '.pypirc'],
    installDirs: ['.venv'],
    install: pythonInstall,
    toolFor: pythonTool,
    checks: pythonChecks,
    scriptWarning: 'Packages without prebuilt wheels run their build scripts.'
  },
  cargo: {
    label: 'Rust', registry: 'crates.io',
    markers: ['Cargo.toml'],
    manifests: [{ test: name => name === 'Cargo.toml', parse: parseCargo }],
    lockfiles: ['Cargo.lock'],
    config: ['.cargo/config.toml', '.cargo/config', 'rust-toolchain', 'rust-toolchain.toml'],
    install: () => [{ command: 'cargo', args: ['fetch'], env: {} }],
    toolFor: () => 'cargo',
    checks: () => [{ kind: 'build', command: 'cargo', args: ['build'] }, { kind: 'test', command: 'cargo', args: ['test'] }],
    slow: true,
    scriptWarning: 'Crate build scripts and macros run during the build check.'
  },
  go: {
    label: 'Go', registry: 'Go module proxy',
    markers: ['go.mod'],
    manifests: [{ test: name => name === 'go.mod', parse: parseGoMod }, { test: name => name === 'go.work', parse: null }],
    lockfiles: ['go.sum', 'go.work.sum'],
    config: [],
    install: () => [{ command: 'go', args: ['mod', 'download', 'all'], env: {} }],
    toolFor: () => 'go',
    checks: () => [{ kind: 'build', command: 'go', args: ['build', './...'] }, { kind: 'test', command: 'go', args: ['test', './...'] }],
    scriptWarning: ''
  },
  ruby: {
    label: 'Ruby', registry: 'RubyGems',
    markers: ['Gemfile'],
    manifests: [{ test: name => name === 'Gemfile' || name === 'gems.rb', parse: parseGemfile }, { test: name => name.endsWith('.gemspec'), parse: null }],
    lockfiles: ['Gemfile.lock', 'gems.locked'],
    config: ['.bundle/config'],
    install: (directory, mode) => [{ command: 'bundle', args: ['install'], env: mode === 'frozen' ? { BUNDLE_FROZEN: 'true' } : {} }],
    prepare: () => [{ command: 'bundle', args: ['install'], env: { BUNDLE_FROZEN: 'true' } }],
    toolFor: () => 'bundle',
    checks: directory => {
      if (has(directory, 'spec')) return [{ kind: 'test', command: 'bundle', args: ['exec', 'rspec'] }];
      if (has(directory, 'Rakefile') && has(directory, 'test')) return [{ kind: 'test', command: 'bundle', args: ['exec', 'rake', 'test'] }];
      return [];
    },
    scriptWarning: 'Gems with native extensions compile code during install.'
  },
  composer: {
    label: 'PHP', registry: 'Packagist',
    markers: ['composer.json'],
    manifests: [{ test: name => name === 'composer.json', parse: parseComposer }],
    lockfiles: ['composer.lock'],
    config: ['auth.json'],
    installDirs: ['vendor'],
    install: (directory, mode, { ignoreScripts = false } = {}) => [{ command: 'composer', args: [mode === 'frozen' || !has(directory, 'composer.lock') ? 'install' : 'update', '--no-interaction', '--no-progress', ...(ignoreScripts ? ['--no-scripts', '--no-plugins'] : [])], env: {} }],
    // vendor/autoload.php resolves the project root from its own real path, so
    // a linked vendor folder would load the main branch's code. Install in place.
    prepare: directory => has(directory, 'composer.lock') ? [{ command: 'composer', args: ['install', '--no-interaction', '--no-progress'], env: {} }] : [],
    toolFor: () => 'composer',
    checks: directory => {
      const manifest = readJson(join(directory, 'composer.json'));
      if (manifest?.scripts?.test) return [{ kind: 'test', command: 'composer', args: ['run-script', 'test'] }];
      if (has(directory, 'vendor/bin/phpunit') || has(directory, 'phpunit.xml') || has(directory, 'phpunit.xml.dist')) return [{ kind: 'test', command: 'vendor/bin/phpunit', args: [] }];
      return [];
    },
    scriptWarning: 'Composer scripts and plugins may run.'
  },
  nuget: {
    label: '.NET', registry: 'NuGet',
    markers: [],
    markerTest: name => /\.(csproj|fsproj|vbproj|sln|slnx)$/i.test(name),
    manifests: [
      { test: name => /\.(csproj|fsproj|vbproj)$/i.test(name) || /^Directory\.(Packages|Build)\.props$/i.test(name) || name === 'packages.config', parse: parseMsbuild }
    ],
    lockfiles: ['packages.lock.json'],
    config: ['nuget.config', 'NuGet.Config', 'NuGet.config', 'global.json'],
    install: (directory, mode) => [{ command: 'dotnet', args: ['restore', ...(mode === 'frozen' && has(directory, 'packages.lock.json') ? ['--locked-mode'] : [])], env: {} }],
    toolFor: () => 'dotnet',
    checks: () => [{ kind: 'build', command: 'dotnet', args: ['build', '--nologo'] }, { kind: 'test', command: 'dotnet', args: ['test', '--nologo', '--no-build'] }],
    slow: true,
    scriptWarning: 'MSBuild targets in packages run during the build check.'
  },
  maven: {
    label: 'Java (Maven)', registry: 'Maven Central',
    markers: ['pom.xml'],
    manifests: [{ test: name => name === 'pom.xml', parse: parsePom }],
    lockfiles: [],
    config: ['.mvn/wrapper/maven-wrapper.properties', '.mvn/maven.config', '.mvn/extensions.xml', 'settings.xml'],
    install: directory => [{ command: mavenCommand(directory), args: ['-B', '-q', 'dependency:resolve'], env: {} }],
    toolFor: mavenCommand,
    checks: directory => [{ kind: 'build', command: mavenCommand(directory), args: ['-B', '-q', '-DskipTests', 'package'] }, { kind: 'test', command: mavenCommand(directory), args: ['-B', '-q', 'test'] }],
    slow: true,
    scriptWarning: 'Maven plugins run during the build check.'
  },
  gradle: {
    label: 'Java/Kotlin (Gradle)', registry: 'Maven Central',
    markers: ['build.gradle', 'build.gradle.kts', 'settings.gradle', 'settings.gradle.kts'],
    manifests: [
      { test: name => /^(build|settings)\.gradle(\.kts)?$/.test(name), parse: parseGradle },
      { test: name => name.endsWith('.versions.toml'), parse: parseVersionCatalog }
    ],
    lockfiles: ['gradle.lockfile', 'buildscript-gradle.lockfile'],
    // The wrapper properties decide which Gradle binary is downloaded and run.
    config: ['gradle/wrapper/gradle-wrapper.properties', 'gradle.properties', 'init.gradle'],
    install: null,
    toolFor: gradleCommand,
    checks: directory => [{ kind: 'build', command: gradleCommand(directory), args: ['--no-daemon', '-q', 'assemble'] }, { kind: 'test', command: gradleCommand(directory), args: ['--no-daemon', '-q', 'test'] }],
    slow: true,
    scriptWarning: 'Gradle plugins run during the build check.'
  },
  pub: {
    label: 'Dart/Flutter', registry: 'pub.dev',
    markers: ['pubspec.yaml'],
    manifests: [{ test: name => name === 'pubspec.yaml', parse: parsePubspec }],
    lockfiles: ['pubspec.lock'],
    config: [],
    install: directory => [{ command: dartCommand(directory), args: ['pub', 'get'], env: {} }],
    prepare: directory => [{ command: dartCommand(directory), args: ['pub', 'get'], env: {} }],
    toolFor: dartCommand,
    checks: directory => [{ kind: 'build', command: dartCommand(directory), args: ['analyze'] }, ...(has(directory, 'test') ? [{ kind: 'test', command: dartCommand(directory), args: ['test'] }] : [])],
    scriptWarning: ''
  },
  swift: {
    label: 'Swift', registry: 'Swift packages (Git)',
    markers: ['Package.swift'],
    manifests: [{ test: name => name === 'Package.swift', parse: parsePackageSwift }],
    lockfiles: ['Package.resolved'],
    config: [],
    install: () => [{ command: 'swift', args: ['package', 'resolve'], env: {} }],
    toolFor: () => 'swift',
    checks: directory => [{ kind: 'build', command: 'swift', args: ['build'] }, ...(has(directory, 'Tests') ? [{ kind: 'test', command: 'swift', args: ['test'] }] : [])],
    slow: true,
    scriptWarning: 'Swift package plugins may run during the build check.'
  },
  hex: {
    label: 'Elixir', registry: 'Hex',
    markers: ['mix.exs'],
    manifests: [{ test: name => name === 'mix.exs', parse: parseMix }],
    lockfiles: ['mix.lock'],
    config: [],
    install: () => [{ command: 'mix', args: ['deps.get'], env: {} }],
    prepare: () => [{ command: 'mix', args: ['deps.get'], env: {} }],
    toolFor: () => 'mix',
    checks: directory => [{ kind: 'build', command: 'mix', args: ['compile'] }, ...(has(directory, 'test') ? [{ kind: 'test', command: 'mix', args: ['test'] }] : [])],
    scriptWarning: 'Dependencies are compiled with their own Mix tasks.'
  }
};

// ---------------------------------------------------------------------------
// Classification of changed files
// ---------------------------------------------------------------------------

// What a changed path means for the gate: a manifest to diff, a lockfile or
// registry configuration to show as a raw change, or nothing.
export function classifyPath(path) {
  const name = basename(path);
  if (path.split('/').some(part => ['node_modules', '.venv', 'vendor', 'target', '.git', 'deps', '_build', '.dart_tool', '.build'].includes(part))) return null;
  for (const [id, ecosystem] of Object.entries(ECOSYSTEMS)) {
    const manifest = ecosystem.manifests.find(candidate => candidate.test(name, path));
    if (manifest) return { ecosystem: id, kind: manifest.parse ? 'manifest' : 'raw', parse: manifest.parse };
    if (ecosystem.lockfiles.includes(name)) return { ecosystem: id, kind: 'lockfile' };
    if (ecosystem.config.some(file => path === file || path.endsWith(`/${file}`))) return { ecosystem: id, kind: 'config' };
  }
  return null;
}

// Diff of two parsed manifests (null = the file did not exist).
export function diffParsed(base, next) {
  const baseEntries = new Map((base?.entries || []).map(item => [item.key, item]));
  const nextEntries = new Map();
  for (const item of next?.entries || []) if (!nextEntries.has(item.key)) nextEntries.set(item.key, item);
  const added = [];
  const changed = [];
  for (const [key, item] of nextEntries) {
    const previous = baseEntries.get(key);
    const view = { name: item.name, section: item.section, source: item.source };
    if (!previous) added.push({ ...view, spec: item.spec });
    else if (previous.spec !== item.spec || previous.source !== item.source) changed.push({ ...view, from: previous.spec, to: item.spec });
  }
  const scripts = [];
  for (const [name, command] of Object.entries(next?.scripts || {})) {
    const previous = base?.scripts?.[name];
    if (command !== previous) scripts.push({ name, from: previous ?? null, to: command });
  }
  return { added, changed, scripts };
}

// Line-level summary for files Orbit cannot interpret (lockfiles, registry
// configuration, setup.py): enough for a reviewer to see what moved.
export function rawDiff(baseText, nextText, limit = 12) {
  const baseLines = String(baseText ?? '').split(/\r?\n/);
  const nextLines = String(nextText ?? '').split(/\r?\n/);
  const remaining = new Map();
  for (const line of baseLines) remaining.set(line, (remaining.get(line) || 0) + 1);
  const addedLines = [];
  for (const line of nextLines) {
    const count = remaining.get(line) || 0;
    if (count > 0) remaining.set(line, count - 1);
    else if (line.trim()) addedLines.push(line);
  }
  const removedLines = [...remaining.entries()].flatMap(([line, count]) => line.trim() ? Array(count).fill(line) : []);
  return {
    added: addedLines.length,
    removed: removedLines.length,
    preview: [...addedLines.slice(0, limit).map(line => `+ ${line.slice(0, 200)}`), ...removedLines.slice(0, Math.max(0, limit - Math.min(limit, addedLines.length))).map(line => `- ${line.slice(0, 200)}`)]
  };
}

// ---------------------------------------------------------------------------
// Registry lookups: URL to fetch and how to read the answer.
// ---------------------------------------------------------------------------

const goEscape = module => module.replace(/[A-Z]/g, letter => `!${letter.toLowerCase()}`);
export function registryLookup(ecosystem, item, { npmRegistry = 'https://registry.npmjs.org' } = {}) {
  if (!['registry', 'alias'].includes(item.source)) return null;
  if (['index', 'repository', 'plugin permission', 'replace', 'tool', 'source override', 'build plugin', 'build extension', 'plugin', 'central version'].includes(item.section) && ecosystem !== 'gradle') return null;
  const name = item.name;
  switch (ecosystem) {
    case 'npm': {
      const spec = item.spec || item.to || '';
      const target = /^npm:/i.test(spec) ? spec.replace(/^npm:/i, '').replace(/(.)@.*$/, '$1') : name;
      const encoded = target.startsWith('@') ? `@${encodeURIComponent(target.slice(1))}` : encodeURIComponent(target);
      return { id: `npm:${target}`, url: `${npmRegistry.replace(/\/$/, '')}/${encoded}/latest`, read: body => ({ latestVersion: body.version, description: body.description, license: typeof body.license === 'string' ? body.license : body.license?.type }) };
    }
    case 'python': return { id: `python:${normalizePythonName(name)}`, url: `https://pypi.org/pypi/${encodeURIComponent(normalizePythonName(name))}/json`, read: body => ({ latestVersion: body.info?.version, description: body.info?.summary, license: body.info?.license_expression || (body.info?.license && body.info.license.length < 60 ? body.info.license : null) }) };
    case 'cargo': return { id: `cargo:${name}`, url: `https://crates.io/api/v1/crates/${encodeURIComponent(name)}`, read: body => ({ latestVersion: body.crate?.max_stable_version || body.crate?.max_version, description: body.crate?.description, license: body.versions?.[0]?.license }) };
    case 'go': return item.section === 'replace' ? null : { id: `go:${name}`, url: `https://proxy.golang.org/${goEscape(name)}/@latest`, read: body => ({ latestVersion: body.Version, description: body.Origin?.URL ? `Source: ${body.Origin.URL}` : '' }) };
    case 'ruby': return { id: `ruby:${name}`, url: `https://rubygems.org/api/v1/gems/${encodeURIComponent(name)}.json`, read: body => ({ latestVersion: body.version, description: body.info, license: body.licenses?.join(', ') }) };
    case 'composer': return name.includes('/') ? { id: `composer:${name}`, url: `https://repo.packagist.org/p2/${name.split('/').map(encodeURIComponent).join('/')}.json`, read: body => { const latest = body.packages?.[name]?.[0] || {}; return { latestVersion: latest.version, description: latest.description, license: latest.license?.join(', ') }; } } : null;
    case 'nuget': return { id: `nuget:${name.toLowerCase()}`, url: `https://api.nuget.org/v3/registration5-gz-semver2/${encodeURIComponent(name.toLowerCase())}/index.json`, read: body => ({ latestVersion: body.items?.at(-1)?.upper, description: body.items?.at(-1)?.items?.at(-1)?.catalogEntry?.description }) };
    case 'maven':
    case 'gradle': {
      if (!/^[\w.-]+:[\w.-]+$/.test(name) || /^plugin/.test(item.section) || item.section === 'repository') return null;
      const [group, artifact] = name.split(':');
      const path = `${group.replace(/\./g, '/')}/${artifact}/maven-metadata.xml`;
      // Android libraries live on Google's Maven repository, not Central.
      const google = /^(androidx|com\.android|com\.google\.android|com\.google\.firebase)/.test(group);
      return { id: `maven:${name}`, url: google ? `https://dl.google.com/dl/android/maven2/${path}` : `https://repo1.maven.org/maven2/${path}`, text: true, read: body => ({ latestVersion: body.match(/<release>([^<]+)<\/release>/)?.[1] || body.match(/<latest>([^<]+)<\/latest>/)?.[1] }) };
    }
    case 'pub': return { id: `pub:${name}`, url: `https://pub.dev/api/packages/${encodeURIComponent(name)}`, read: body => ({ latestVersion: body.latest?.version, description: body.latest?.pubspec?.description }) };
    case 'hex': return { id: `hex:${name}`, url: `https://hex.pm/api/packages/${encodeURIComponent(name)}`, read: body => ({ latestVersion: body.latest_stable_version || body.latest_version, description: body.meta?.description, license: body.meta?.licenses?.join(', ') }) };
    default: return null;
  }
}

// ---------------------------------------------------------------------------
// Project detection for build/test checks
// ---------------------------------------------------------------------------

const SKIP_DIRECTORIES = new Set(['node_modules', '.git', '.venv', 'venv', 'vendor', 'target', 'dist', 'build', '.next', 'deps', '_build', '.dart_tool', '.build', 'bin', 'obj', '.gradle', '.idea']);

function ecosystemAt(directory) {
  let names;
  try { names = readdirSync(directory); } catch { return null; }
  // Order matters when several markers exist in one folder.
  for (const id of ['npm', 'cargo', 'go', 'python', 'composer', 'ruby', 'maven', 'gradle', 'nuget', 'pub', 'swift', 'hex']) {
    const ecosystem = ECOSYSTEMS[id];
    if (ecosystem.markers.some(marker => names.includes(marker)) || (ecosystem.markerTest && names.some(ecosystem.markerTest))) return id;
  }
  return null;
}

// Project roots inside a checkout (the root itself, or apps up to two levels
// down, such as frontend/ and backend/). Nested roots of an already-found
// Gradle/Maven/Cargo/Go project are part of that build and are skipped.
export function detectProjects(root, { maxDepth = 2, limit = 6 } = {}) {
  const found = [];
  const queue = [{ directory: root, depth: 0, owner: null }];
  while (queue.length && found.length < limit) {
    const { directory, depth, owner } = queue.shift();
    const ecosystem = ecosystemAt(directory);
    let nextOwner = owner;
    if (ecosystem && !(owner && ['gradle', 'maven', 'cargo', 'go', 'nuget'].includes(owner) && owner === ecosystem)) {
      found.push({ directory, ecosystem });
      nextOwner = ecosystem;
    }
    if (depth >= maxDepth) continue;
    let entries = [];
    try { entries = readdirSync(directory, { withFileTypes: true }); } catch { continue; }
    for (const item of entries) {
      if (item.isDirectory() && !SKIP_DIRECTORIES.has(item.name) && !item.name.startsWith('.')) queue.push({ directory: join(directory, item.name), depth: depth + 1, owner: nextOwner });
    }
  }
  return found;
}

// A Makefile with build/test targets, for projects no ecosystem covers.
export function makefileChecks(directory) {
  const text = readText(join(directory, 'Makefile'));
  if (!text) return [];
  return ['build', 'test'].filter(target => new RegExp(`^${target}\\s*:`, 'm').test(text)).map(target => ({ kind: target, command: 'make', args: [target] }));
}

export function stepLabel(step) {
  return step.label || `${step.command} ${step.args.join(' ')}`.trim();
}

export function ecosystemForManifestDirectory(path) {
  const info = classifyPath(path);
  return info ? { ...info, directory: dirname(path) } : null;
}

// True when `directory` holds a project file of the given ecosystem.
export function hasEcosystemMarker(directory, id) {
  const ecosystem = ECOSYSTEMS[id];
  let names;
  try { names = readdirSync(directory); } catch { return false; }
  return ecosystem.markers.some(marker => names.includes(marker)) || Boolean(ecosystem.markerTest && names.some(ecosystem.markerTest));
}

// Dependencies declared in a directory's pyproject.toml (for plain pip installs).
export function pyprojectDependencies(directory) {
  const text = readText(join(directory, 'pyproject.toml'));
  if (!text) return [];
  try { return parsePyproject(text).entries; } catch { return []; }
}

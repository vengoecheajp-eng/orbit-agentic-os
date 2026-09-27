import { createHash } from 'node:crypto';
import { closeSync, constants, existsSync, fstatSync, lstatSync, mkdtempSync, openSync, readlinkSync, readSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { basename, isAbsolute, join } from 'node:path';
import { tmpdir } from 'node:os';
import { TextDecoder } from 'node:util';

const sha256 = value => createHash('sha256').update(value).digest('hex');
const strictUtf8Decoder = new TextDecoder('utf-8', { fatal: true });
const HASH_BUFFER_BYTES = 1024 * 1024;

export const DEFAULT_VERIFICATION_LIMITS = Object.freeze({
  maxPathCount: 10_000,
  maxIndividualFileBytes: 32 * 1024 * 1024,
  maxTotalBytes: 128 * 1024 * 1024
});

function normalizedLimits(limits = {}) {
  const normalized = {};
  for (const [name, fallback] of Object.entries(DEFAULT_VERIFICATION_LIMITS)) {
    const candidate = Number(limits[name] ?? fallback);
    if (!Number.isSafeInteger(candidate) || candidate <= 0) {
      throw new TypeError(`Invalid verification limit: ${name} must be a positive safe integer.`);
    }
    normalized[name] = candidate;
  }
  return normalized;
}

function verificationNeedsAttention(message, details = {}) {
  const error = new Error(`Verification needs attention: ${message}`);
  error.code = 'ORBIT_VERIFICATION_LIMIT';
  Object.assign(error, details);
  return error;
}

function displayBytes(value) {
  return `${value.toLocaleString('en-US')} bytes`;
}

function hardenedGitArguments(directory, args) {
  return [
    '--no-replace-objects',
    '-c', 'core.hooksPath=/dev/null',
    '-c', 'core.fsmonitor=false',
    '-c', 'core.untrackedCache=false',
    '-c', 'core.sparseCheckout=false',
    '-c', 'index.sparse=false',
    '-c', 'diff.external=',
    '-c', 'core.attributesFile=/dev/null',
    '-C', directory,
    ...args
  ];
}

function isolatedGitEnvironment(extra = {}) {
  const env = { ...process.env };
  // A caller-controlled Git environment can redirect discovery, the object
  // database, the index, or configuration. Verification always discovers the
  // repository named by `directory` and opts in to its temporary index only.
  for (const key of Object.keys(env)) if (/^GIT_/i.test(key)) delete env[key];
  return {
    ...env,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_ATTR_NOSYSTEM: '1',
    GIT_NO_LAZY_FETCH: '1',
    GIT_TERMINAL_PROMPT: '0',
    GIT_OPTIONAL_LOCKS: '0',
    ...extra
  };
}

function gitBuffer(directory, args, { env = {}, input, maxBuffer = 192 * 1024 * 1024 } = {}) {
  const result = spawnSync('git', hardenedGitArguments(directory, args), {
    encoding: null,
    input,
    maxBuffer,
    // A verification pass must be local and deterministic. In particular,
    // inspecting a partial clone must never fetch a missing object from a
    // promisor remote behind the user's back.
    env: isolatedGitEnvironment(env)
  });
  if (result.error?.code === 'ENOBUFS') {
    throw verificationNeedsAttention('Git inspection output exceeded Orbit’s bounded verification budget. Split the change into a smaller run.');
  }
  if (result.status !== 0) {
    const message = Buffer.from(result.stderr || '').toString('utf8').trim();
    throw new Error(message || `Git inspection failed (${args[0]}).`);
  }
  return Buffer.from(result.stdout || '');
}

function repositoryConfigEntries(directory, scope, filePath = null) {
  const args = filePath
    ? ['config', '--file', filePath, '--no-includes', '-z', '--list']
    : ['config', scope, '--no-includes', '-z', '--list'];
  const result = spawnSync('git', ['--no-replace-objects', '-C', directory, ...args], {
    encoding: null,
    maxBuffer: 4 * 1024 * 1024,
    env: isolatedGitEnvironment()
  });
  if (result.status !== 0) {
    const message = Buffer.from(result.stderr || '').toString('utf8').trim();
    throw verificationNeedsAttention(`Git configuration could not be inspected safely${message ? `: ${message}` : '.'}`, { limit: 'repositoryConfig' });
  }
  return splitNullTerminatedPaths(Buffer.from(result.stdout || '')).map(record => {
    const text = decodeGitPath(record);
    const separator = text.indexOf('\n');
    return separator === -1
      ? { key: text.toLowerCase(), value: '' }
      : { key: text.slice(0, separator).toLowerCase(), value: text.slice(separator + 1) };
  });
}

function assertRepositoryGitConfigurationSafe(directory) {
  const entries = repositoryConfigEntries(directory, '--local');
  // Linked worktrees may have their own config.worktree. Read it as a plain
  // config file with includes disabled so a repository cannot escape the
  // bounded local inspection through include.path/includeIf.
  const worktreeConfig = gitText(directory, ['rev-parse', '--git-path', 'config.worktree']);
  const worktreeConfigPath = isAbsolute(worktreeConfig) ? worktreeConfig : join(directory, worktreeConfig);
  if (worktreeConfig && existsSync(worktreeConfigPath)) entries.push(...repositoryConfigEntries(directory, '--local', worktreeConfigPath));

  for (const { key, value } of entries) {
    if (/^filter\..*\.(?:clean|smudge|process)$/.test(key) && value.trim()) {
      throw verificationNeedsAttention(`repository-controlled Git filter "${key}" is configured. Remove it before verification; Orbit hashes source bytes without executing filters.`, { limit: 'repositoryConfig', key });
    }
    if (/^filter\..*\.required$/.test(key) && /^(?:1|true|yes|on)$/i.test(value.trim())) {
      throw verificationNeedsAttention(`repository-controlled required Git filter "${key}" is configured. Remove it before verification.`, { limit: 'repositoryConfig', key });
    }
    if (key === 'core.fsmonitor' && !/^(?:|0|false|no|off)$/i.test(value.trim())) {
      throw verificationNeedsAttention('repository-controlled core.fsmonitor is configured. Disable it before verification.', { limit: 'repositoryConfig', key });
    }
    if (/^merge\..*\.driver$/.test(key) && value.trim()) {
      throw verificationNeedsAttention(`repository-controlled Git merge driver "${key}" is configured. Remove it before verification; Orbit approvals never execute repository-defined merge commands.`, { limit: 'repositoryConfig', key });
    }
  }
}

function gitText(directory, args, options) {
  return gitBuffer(directory, args, options).toString('utf8').trim();
}

function safeExcludedPaths(paths = []) {
  return [...new Set(paths.map(path => {
    const literal = String(path || '');
    // On POSIX a backslash is a valid filename byte, not a path separator.
    // Normalizing it would silently exclude a different path from evidence.
    const platformPath = process.platform === 'win32' ? literal.replaceAll('\\', '/') : literal;
    return platformPath.replace(/^\.\//, '').replace(/\/$/, '');
  }))]
    .filter(path => path && path !== '.' && !path.startsWith('/') && !path.split('/').includes('..'))
    .sort();
}

function pathspecs(excludedPaths) {
  return ['--', '.', ...excludedPaths.map(path => `:(exclude,literal)${path}`)];
}

function splitNullTerminatedPaths(output) {
  const paths = [];
  let start = 0;
  for (let index = 0; index < output.length; index += 1) {
    if (output[index] !== 0) continue;
    if (index > start) paths.push(output.subarray(start, index));
    start = index + 1;
  }
  if (start < output.length) paths.push(output.subarray(start));
  return paths;
}

function decodeGitPath(pathBuffer) {
  try {
    return strictUtf8Decoder.decode(pathBuffer);
  } catch {
    throw new Error('Untracked path is not valid UTF-8; verification cannot proceed safely.');
  }
}

function eligibleUntrackedPathBuffer(directory, excludedPaths, options) {
  return gitBuffer(directory, ['ls-files', '--others', '--exclude-standard', '-z', ...pathspecs(excludedPaths)], options);
}

function statIdentity(stat) {
  return `${stat.dev}:${stat.ino}`;
}

function changedPathInspection(directory, resolvedBase, excludedPaths, limits) {
  const trackedOutput = gitBuffer(directory, [
    'diff', '--name-only', '-z', '--no-ext-diff', '--no-textconv', '--ignore-submodules=none', resolvedBase,
    ...pathspecs(excludedPaths)
  ]);
  const untrackedOutput = eligibleUntrackedPathBuffer(directory, excludedPaths);
  const trackedPaths = splitNullTerminatedPaths(trackedOutput).map(decodeGitPath);
  const untrackedPaths = splitNullTerminatedPaths(untrackedOutput).map(decodeGitPath);
  const paths = [...new Set([...trackedPaths, ...untrackedPaths])].sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)));
  if (paths.length > limits.maxPathCount) {
    throw verificationNeedsAttention(
      `the change set contains ${paths.length.toLocaleString('en-US')} paths; the safe limit is ${limits.maxPathCount.toLocaleString('en-US')}. Split the work into smaller runs.`,
      { limit: 'maxPathCount', actual: paths.length, maximum: limits.maxPathCount }
    );
  }

  let totalBytes = 0;
  const records = new Map();
  for (const path of paths) {
    const absolute = join(directory, path);
    let stat;
    try {
      stat = lstatSync(absolute, { bigint: true });
    } catch (error) {
      if (error.code === 'ENOENT') {
        records.set(path, { path, type: 'missing', bytes: 0, signature: `${path}:missing` });
        continue;
      }
      throw error;
    }
    let type;
    let bytes = 0;
    if (stat.isSymbolicLink()) {
      type = 'symlink';
      bytes = readlinkSync(absolute, { encoding: 'buffer' }).length;
    } else if (stat.isFile()) {
      type = 'file';
      if (stat.size > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw verificationNeedsAttention(`"${path}" is too large to verify safely.`, { limit: 'maxIndividualFileBytes', path });
      }
      bytes = Number(stat.size);
    } else if (stat.isDirectory()) {
      // A tracked gitlink/submodule is represented by its commit in the final
      // tree and its dirty state is recorded separately.
      type = 'directory';
    } else {
      throw verificationNeedsAttention(`"${path}" is an unsupported filesystem entry.`, { limit: 'entryType', path });
    }
    if (bytes > limits.maxIndividualFileBytes) {
      throw verificationNeedsAttention(
        `"${path}" is ${displayBytes(bytes)}; the per-file limit is ${displayBytes(limits.maxIndividualFileBytes)}. Remove the generated asset or split the run.`,
        { limit: 'maxIndividualFileBytes', path, actual: bytes, maximum: limits.maxIndividualFileBytes }
      );
    }
    totalBytes += bytes;
    if (totalBytes > limits.maxTotalBytes) {
      throw verificationNeedsAttention(
        `changed files total ${displayBytes(totalBytes)}; the run limit is ${displayBytes(limits.maxTotalBytes)}. Split the work into smaller runs.`,
        { limit: 'maxTotalBytes', actual: totalBytes, maximum: limits.maxTotalBytes }
      );
    }
    const signature = [path, type, statIdentity(stat), stat.size, stat.mtimeNs, stat.ctimeNs].join(':');
    records.set(path, { path, type, bytes, stat, signature });
  }
  return {
    records,
    untrackedPaths: untrackedPaths.sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right))),
    signature: [...records.values()].map(record => record.signature).join('\0'),
    totalBytes
  };
}

function assertStableFile(path, actual, expected) {
  if (!actual.isFile() || statIdentity(actual) !== statIdentity(expected) || actual.size !== expected.size) {
    throw verificationNeedsAttention(`"${path}" changed identity or size while it was being verified. Retry the verification.`, { limit: 'concurrentChange', path });
  }
}

function readBoundedFile(absolute, path, expected, limits) {
  const descriptor = openSync(absolute, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = fstatSync(descriptor, { bigint: true });
    assertStableFile(path, before, expected);
    const size = Number(before.size);
    if (size > limits.maxIndividualFileBytes) {
      throw verificationNeedsAttention(`"${path}" grew beyond the per-file limit during verification.`, {
        limit: 'maxIndividualFileBytes', path, actual: size, maximum: limits.maxIndividualFileBytes
      });
    }
    const buffer = Buffer.allocUnsafe(Math.min(HASH_BUFFER_BYTES, Math.max(1, size)));
    const chunks = [];
    let remaining = size;
    while (remaining > 0) {
      const bytesRead = readSync(descriptor, buffer, 0, Math.min(buffer.length, remaining), null);
      if (bytesRead <= 0) {
        throw verificationNeedsAttention(`"${path}" changed while it was being hashed. Retry the verification.`, { limit: 'concurrentChange', path });
      }
      chunks.push(Buffer.from(buffer.subarray(0, bytesRead)));
      remaining -= bytesRead;
    }
    if (readSync(descriptor, buffer, 0, 1, null) !== 0) {
      throw verificationNeedsAttention(`"${path}" grew while it was being hashed. Retry the verification.`, { limit: 'concurrentChange', path });
    }
    const after = fstatSync(descriptor, { bigint: true });
    assertStableFile(path, after, before);
    if (after.mtimeNs !== before.mtimeNs || after.ctimeNs !== before.ctimeNs) {
      throw verificationNeedsAttention(`"${path}" changed while it was being hashed. Retry the verification.`, { limit: 'concurrentChange', path });
    }
    const currentPath = lstatSync(absolute, { bigint: true });
    assertStableFile(path, currentPath, before);
    return Buffer.concat(chunks, size);
  } finally {
    closeSync(descriptor);
  }
}

function hashBoundedFile(absolute, path, expected, limits) {
  return sha256(readBoundedFile(absolute, path, expected, limits));
}

function stableSymlinkTarget(absolute, path, expected, limits) {
  const before = lstatSync(absolute, { bigint: true });
  if (!before.isSymbolicLink() || statIdentity(before) !== statIdentity(expected)) {
    throw verificationNeedsAttention(`"${path}" changed identity during verification. Retry the verification.`, { limit: 'concurrentChange', path });
  }
  const target = readlinkSync(absolute, { encoding: 'buffer' });
  if (target.length > limits.maxIndividualFileBytes) {
    throw verificationNeedsAttention(`the link target for "${path}" exceeds the per-file limit.`, { limit: 'maxIndividualFileBytes', path });
  }
  const after = lstatSync(absolute, { bigint: true });
  if (!after.isSymbolicLink() || statIdentity(after) !== statIdentity(before) || after.mtimeNs !== before.mtimeNs || after.ctimeNs !== before.ctimeNs) {
    throw verificationNeedsAttention(`"${path}" changed while it was being verified. Retry the verification.`, { limit: 'concurrentChange', path });
  }
  return target;
}

function gitBlobHash(directory, content) {
  return gitText(directory, ['hash-object', '-w', '--stdin'], { input: content });
}

function finalTreeHash(directory, headCommit, excludedPaths, limits) {
  const temporaryDirectory = mkdtempSync(join(tmpdir(), 'orbit-verification-index-'));
  const temporaryIndex = join(temporaryDirectory, 'index');
  const options = { env: { GIT_INDEX_FILE: temporaryIndex } };
  try {
    // Start from HEAD and overlay raw working-tree bytes with plumbing only.
    // `git add` is intentionally not used: it can execute repository-defined
    // clean filters and thereby make the evidence describe different bytes
    // than the source that actually passed the checks.
    gitBuffer(directory, ['read-tree', headCommit], options);
    const changes = changedPathInspection(directory, headCommit, excludedPaths, limits);
    const zeroObject = '0'.repeat(headCommit.length);
    const records = [];
    for (const record of changes.records.values()) {
      if (record.type === 'missing') {
        records.push(Buffer.from(`0 ${zeroObject}\t${record.path}\0`));
        continue;
      }
      if (record.type === 'directory') {
        throw verificationNeedsAttention(`submodule "${record.path}" changed in the working tree. Commit or reset the submodule before verification.`, { limit: 'dirtySubmodule', path: record.path });
      }
      const absolute = join(directory, record.path);
      const content = record.type === 'symlink'
        ? stableSymlinkTarget(absolute, record.path, record.stat, limits)
        : readBoundedFile(absolute, record.path, record.stat, limits);
      const object = gitBlobHash(directory, content);
      const mode = record.type === 'symlink' ? '120000' : Number(record.stat.mode & 0o111n) ? '100755' : '100644';
      records.push(Buffer.from(`${mode} ${object}\t${record.path}\0`));
    }
    if (records.length) {
      gitBuffer(directory, ['update-index', '-z', '--index-info'], {
        ...options,
        input: Buffer.concat(records)
      });
    }
    return gitText(directory, ['write-tree'], options);
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

function submoduleWorktreeEvidence(directory) {
  const output = gitBuffer(directory, [
    'status', '--porcelain=v2', '-z', '--untracked-files=no', '--ignore-submodules=none'
  ]);
  const evidence = [];
  for (const record of splitNullTerminatedPaths(output)) {
    const line = decodeGitPath(record);
    // Porcelain v2 ordinary records are:
    // 1 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <path>
    // The final two submodule flags describe modified and untracked content
    // inside the submodule. Gitlinks themselves are already in finalTreeHash.
    const match = line.match(/^1 [^ ]+ (S...) [^ ]+ [^ ]+ [^ ]+ [^ ]+ [^ ]+ (.*)$/s);
    if (!match) continue;
    const [, state, path] = match;
    if (state[2] === '.' && state[3] === '.') continue;
    evidence.push({ path, modified: state[2] !== '.', untracked: state[3] !== '.' });
  }
  return evidence.sort((left, right) => Buffer.compare(Buffer.from(left.path), Buffer.from(right.path)));
}

function untrackedEvidence(directory, excludedPaths, inspectedChanges, limits) {
  const output = eligibleUntrackedPathBuffer(directory, excludedPaths);
  const paths = splitNullTerminatedPaths(output)
    .map(pathBuffer => ({ pathBuffer, path: decodeGitPath(pathBuffer) }))
    .sort((left, right) => Buffer.compare(left.pathBuffer, right.pathBuffer));
  const currentPaths = paths.map(item => item.path);
  if (currentPaths.length !== inspectedChanges.untrackedPaths.length || currentPaths.some((path, index) => path !== inspectedChanges.untrackedPaths[index])) {
    throw verificationNeedsAttention('the untracked file list changed during verification. Retry after filesystem activity settles.', { limit: 'concurrentChange' });
  }
  return paths.map(({ path }) => {
    const absolute = join(directory, path);
    const expected = inspectedChanges.records.get(path);
    if (!expected || !['file', 'symlink'].includes(expected.type)) {
      throw verificationNeedsAttention(`"${path}" changed type during verification. Retry the verification.`, { limit: 'concurrentChange', path });
    }
    const stat = lstatSync(absolute, { bigint: true });
    const mode = Number(stat.mode & 0o7777n);
    if (expected.type === 'symlink') {
      if (!stat.isSymbolicLink() || statIdentity(stat) !== statIdentity(expected.stat)) {
        throw verificationNeedsAttention(`"${path}" changed identity during verification. Retry the verification.`, { limit: 'concurrentChange', path });
      }
      const target = stableSymlinkTarget(absolute, path, stat, limits);
      return { path, type: 'symlink', mode, hash: sha256(target) };
    }
    if (!stat.isFile()) throw new Error(`Unsupported untracked entry type: ${basename(path)}.`);
    return { path, type: 'file', mode, size: Number(stat.size), hash: hashBoundedFile(absolute, path, expected.stat, limits) };
  });
}

/**
 * Fingerprint the complete Git change set Orbit is allowed to merge without
 * retaining source contents. The binary diff covers tracked edits, deletes,
 * renames, executable bits and tracked symlinks. Untracked files are hashed
 * separately because Git diff deliberately omits them.
 */
export function createVerificationFingerprint({
  directory,
  baseCommit,
  excludedPaths = [],
  policy = {},
  limits = {}
}) {
  if (!directory || !baseCommit) throw new Error('A worktree and verified base commit are required.');
  assertRepositoryGitConfigurationSafe(directory);
  const boundedLimits = normalizedLimits(limits);
  const exclusions = safeExcludedPaths(excludedPaths);
  const resolvedBase = gitText(directory, ['rev-parse', '--verify', `${baseCommit}^{commit}`]);
  const headCommit = gitText(directory, ['rev-parse', '--verify', 'HEAD^{commit}']);
  const inspectedChanges = changedPathInspection(directory, resolvedBase, exclusions, boundedLimits);
  const diff = gitBuffer(directory, [
    'diff', '--binary', '--full-index', '--no-ext-diff', '--no-textconv', '--ignore-submodules=none', resolvedBase,
    ...pathspecs(exclusions)
  ]);
  const untracked = untrackedEvidence(directory, exclusions, inspectedChanges, boundedLimits);
  const submodules = submoduleWorktreeEvidence(directory);
  if (submodules.length) {
    const [first] = submodules;
    throw verificationNeedsAttention(`submodule "${first.path}" has uncommitted or untracked content. Commit or reset it before verification.`, { limit: 'dirtySubmodule', path: first.path });
  }
  const treeHash = finalTreeHash(directory, headCommit, exclusions, boundedLimits);
  const confirmedChanges = changedPathInspection(directory, resolvedBase, exclusions, boundedLimits);
  if (confirmedChanges.signature !== inspectedChanges.signature || confirmedChanges.untrackedPaths.join('\0') !== inspectedChanges.untrackedPaths.join('\0')) {
    throw verificationNeedsAttention('the change set changed while its fingerprint was being created. Retry after filesystem activity settles.', { limit: 'concurrentChange' });
  }
  const material = {
    version: 1,
    baseCommit: resolvedBase,
    headCommit,
    finalTreeHash: treeHash,
    diffHash: sha256(diff),
    untracked,
    submodules,
    excludedPaths: exclusions,
    policyHash: sha256(Buffer.from(JSON.stringify(policy)))
  };
  const fingerprintMaterial = {
    version: material.version,
    baseCommit: material.baseCommit,
    headCommit: material.headCommit,
    finalTreeHash: material.finalTreeHash,
    submodules: material.submodules,
    excludedPaths: material.excludedPaths,
    policyHash: material.policyHash
  };
  return {
    version: 1,
    algorithm: 'sha256',
    fingerprint: sha256(Buffer.from(JSON.stringify(fingerprintMaterial))),
    ...material
  };
}

export function verificationMatches(expected, actual) {
  return Boolean(
    expected?.version === 1 &&
    actual?.version === 1 &&
    expected.fingerprint &&
    expected.fingerprint === actual.fingerprint
  );
}

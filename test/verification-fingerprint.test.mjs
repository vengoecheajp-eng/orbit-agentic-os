import { chmodSync, mkdirSync, rmSync, symlinkSync, truncateSync, unlinkSync, writeFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createVerificationFingerprint, verificationMatches } from '../verification-fingerprint.mjs';
import { git } from './fixtures.mjs';

const roots = [];

function repository() {
  const root = mkdtempSync(join(tmpdir(), 'orbit-fingerprint-'));
  roots.push(root);
  git(root, 'init', '-q');
  git(root, 'config', 'user.email', 'orbit-test@example.invalid');
  git(root, 'config', 'user.name', 'Orbit Test');
  writeFileSync(join(root, 'tracked.txt'), 'baseline\n');
  writeFileSync(join(root, 'delete.txt'), 'delete me\n');
  writeFileSync(join(root, 'package-lock.json'), '{"lockfileVersion":3}\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-qm', 'baseline');
  return { root, baseCommit: git(root, 'rev-parse', 'HEAD') };
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('verification fingerprint', () => {
  it('is stable for unchanged eligible content', () => {
    const fixture = repository();
    writeFileSync(join(fixture.root, 'tracked.txt'), 'changed\n');
    const one = createVerificationFingerprint({ directory: fixture.root, baseCommit: fixture.baseCommit, policy: { checks: ['build'] } });
    const two = createVerificationFingerprint({ directory: fixture.root, baseCommit: fixture.baseCommit, policy: { checks: ['build'] } });
    expect(verificationMatches(one, two)).toBe(true);
  });

  it.each([
    ['tracked edit', ({ root }) => writeFileSync(join(root, 'tracked.txt'), 'drift\n')],
    ['new file', ({ root }) => writeFileSync(join(root, 'new.txt'), 'new\n')],
    ['deletion', ({ root }) => unlinkSync(join(root, 'delete.txt'))],
    ['mode change', ({ root }) => chmodSync(join(root, 'tracked.txt'), 0o755)],
    ['dependency lock drift', ({ root }) => writeFileSync(join(root, 'package-lock.json'), '{"lockfileVersion":4}\n')],
    ['untracked symlink', ({ root }) => symlinkSync('tracked.txt', join(root, 'link.txt'))]
  ])('detects %s after verification', (_label, mutate) => {
    const fixture = repository();
    const verified = createVerificationFingerprint({ directory: fixture.root, baseCommit: fixture.baseCommit });
    mutate(fixture);
    const current = createVerificationFingerprint({ directory: fixture.root, baseCommit: fixture.baseCommit });
    expect(verificationMatches(verified, current)).toBe(false);
  });

  it('excludes only explicit Orbit-owned artifacts', () => {
    const fixture = repository();
    mkdirSync(join(fixture.root, '.orbit-cache'));
    writeFileSync(join(fixture.root, '.orbit-cache', 'generated.txt'), 'one\n');
    const verified = createVerificationFingerprint({ directory: fixture.root, baseCommit: fixture.baseCommit, excludedPaths: ['.orbit-cache'] });
    writeFileSync(join(fixture.root, '.orbit-cache', 'generated.txt'), 'two\n');
    const current = createVerificationFingerprint({ directory: fixture.root, baseCommit: fixture.baseCommit, excludedPaths: ['.orbit-cache'] });
    expect(verificationMatches(verified, current)).toBe(true);
    writeFileSync(join(fixture.root, 'regular.txt'), 'eligible\n');
    const drifted = createVerificationFingerprint({ directory: fixture.root, baseCommit: fixture.baseCommit, excludedPaths: ['.orbit-cache'] });
    expect(verificationMatches(verified, drifted)).toBe(false);
  });

  it('ignores local Git replacement refs when resolving and diffing verified commits', () => {
    const fixture = repository();
    writeFileSync(join(fixture.root, 'tracked.txt'), 'replacement tree\n');
    git(fixture.root, 'add', 'tracked.txt');
    git(fixture.root, 'commit', '-qm', 'replacement commit');
    const replacementCommit = git(fixture.root, 'rev-parse', 'HEAD');
    git(fixture.root, 'reset', '--hard', fixture.baseCommit);

    writeFileSync(join(fixture.root, 'tracked.txt'), 'replacement tree\n');
    const verified = createVerificationFingerprint({ directory: fixture.root, baseCommit: fixture.baseCommit });
    git(fixture.root, 'replace', fixture.baseCommit, replacementCommit);
    const current = createVerificationFingerprint({ directory: fixture.root, baseCommit: fixture.baseCommit });

    expect(verificationMatches(verified, current)).toBe(true);
    expect(current.baseCommit).toBe(fixture.baseCommit);
  });

  it('rejects dirty tracked submodules even when repository config tries to hide them', () => {
    const fixture = repository();
    const child = mkdtempSync(join(tmpdir(), 'orbit-fingerprint-submodule-'));
    roots.push(child);
    git(child, 'init', '-q');
    git(child, 'config', 'user.email', 'orbit-test@example.invalid');
    git(child, 'config', 'user.name', 'Orbit Test');
    writeFileSync(join(child, 'module.txt'), 'baseline\n');
    git(child, 'add', '-A');
    git(child, 'commit', '-qm', 'submodule baseline');
    git(fixture.root, '-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', child, 'vendor/module');
    git(fixture.root, 'commit', '-qm', 'add submodule');
    const baseCommit = git(fixture.root, 'rev-parse', 'HEAD');
    git(fixture.root, 'config', 'diff.ignoreSubmodules', 'all');

    createVerificationFingerprint({ directory: fixture.root, baseCommit });
    writeFileSync(join(fixture.root, 'vendor', 'module', 'module.txt'), 'dirty\n');
    expect(() => createVerificationFingerprint({ directory: fixture.root, baseCommit })).toThrow(/submodule .* has uncommitted or untracked content/i);
  });

  it('fails closed instead of executing a repository-controlled Git clean filter', () => {
    const fixture = repository();
    writeFileSync(join(fixture.root, '.gitattributes'), '*.txt filter=orbit-test\n');
    git(fixture.root, 'add', '.gitattributes');
    git(fixture.root, 'commit', '-qm', 'declare filter');
    const baseCommit = git(fixture.root, 'rev-parse', 'HEAD');
    git(fixture.root, 'config', 'filter.orbit-test.clean', 'sh -c "echo forged"');
    writeFileSync(join(fixture.root, 'tracked.txt'), 'actual source bytes\n');

    expect(() => createVerificationFingerprint({ directory: fixture.root, baseCommit })).toThrow(/repository-controlled Git filter/i);
  });

  it('fails closed on a repository-controlled fsmonitor command', () => {
    const fixture = repository();
    git(fixture.root, 'config', 'core.fsmonitor', '/tmp/untrusted-fsmonitor');

    expect(() => createVerificationFingerprint({
      directory: fixture.root,
      baseCommit: fixture.baseCommit
    })).toThrow(/core\.fsmonitor is configured/i);
  });

  it('fails closed on a repository-controlled custom merge driver', () => {
    const fixture = repository();
    git(fixture.root, 'config', 'merge.orbit-test.driver', 'sh -c "echo executed > /tmp/orbit-merge-driver"');

    expect(() => createVerificationFingerprint({
      directory: fixture.root,
      baseCommit: fixture.baseCommit
    })).toThrow(/repository-controlled Git merge driver/i);
  });

  it('produces the same final tree fingerprint before and after real staging', () => {
    const fixture = repository();
    writeFileSync(join(fixture.root, 'tracked.txt'), 'eligible tracked change\n');
    writeFileSync(join(fixture.root, 'new.txt'), 'eligible untracked file\n');

    const beforeStaging = createVerificationFingerprint({
      directory: fixture.root,
      baseCommit: fixture.baseCommit
    });
    expect(git(fixture.root, 'diff', '--cached', '--name-only')).toBe('');
    expect(beforeStaging.untracked.map(item => item.path)).toContain('new.txt');

    git(fixture.root, 'add', '-A');
    const stagedTree = git(fixture.root, 'write-tree');
    const afterStaging = createVerificationFingerprint({
      directory: fixture.root,
      baseCommit: fixture.baseCommit
    });

    expect(beforeStaging.finalTreeHash).toBe(stagedTree);
    expect(afterStaging.finalTreeHash).toBe(stagedTree);
    expect(afterStaging.untracked).toEqual([]);
    expect(verificationMatches(beforeStaging, afterStaging)).toBe(true);
  });

  it('builds the final tree when an excluded dependency directory is also ignored', () => {
    const fixture = repository();
    writeFileSync(join(fixture.root, '.gitignore'), 'node_modules/\n');
    git(fixture.root, 'add', '.gitignore');
    git(fixture.root, 'commit', '-qm', 'ignore dependencies');
    const baseCommit = git(fixture.root, 'rev-parse', 'HEAD');
    mkdirSync(join(fixture.root, 'node_modules', 'example-package'), { recursive: true });
    writeFileSync(join(fixture.root, 'node_modules', 'example-package', 'index.js'), 'ignored install artifact\n');
    writeFileSync(join(fixture.root, 'eligible.txt'), 'include me\n');

    const fingerprint = createVerificationFingerprint({
      directory: fixture.root,
      baseCommit,
      excludedPaths: ['node_modules']
    });

    expect(fingerprint.finalTreeHash).toMatch(/^[a-f0-9]{40,64}$/);
    expect(fingerprint.untracked.map(item => item.path)).toEqual(['eligible.txt']);
    expect(fingerprint.excludedPaths).toEqual(['node_modules']);
  });

  it.skipIf(process.platform === 'win32')('preserves literal backslashes in POSIX excluded paths', () => {
    const fixture = repository();
    const literalBackslashDirectory = join(fixture.root, '.orbit\\cache');
    mkdirSync(literalBackslashDirectory);
    writeFileSync(join(literalBackslashDirectory, 'generated.txt'), 'one\n');
    const verified = createVerificationFingerprint({
      directory: fixture.root,
      baseCommit: fixture.baseCommit,
      excludedPaths: ['.orbit\\cache']
    });

    writeFileSync(join(literalBackslashDirectory, 'generated.txt'), 'two\n');
    const unchanged = createVerificationFingerprint({
      directory: fixture.root,
      baseCommit: fixture.baseCommit,
      excludedPaths: ['.orbit\\cache']
    });
    expect(verificationMatches(verified, unchanged)).toBe(true);

    mkdirSync(join(fixture.root, '.orbit', 'cache'), { recursive: true });
    writeFileSync(join(fixture.root, '.orbit', 'cache', 'eligible.txt'), 'must be fingerprinted\n');
    const drifted = createVerificationFingerprint({
      directory: fixture.root,
      baseCommit: fixture.baseCommit,
      excludedPaths: ['.orbit\\cache']
    });
    expect(verificationMatches(verified, drifted)).toBe(false);
  });

  it.skipIf(process.platform === 'win32' || process.platform === 'darwin')('rejects untracked filenames that are not valid UTF-8', () => {
    const fixture = repository();
    const invalidPath = Buffer.concat([
      Buffer.from(`${fixture.root}/invalid-`),
      Buffer.from([0xff])
    ]);
    writeFileSync(invalidPath, 'unsafe filename\n');

    expect(() => createVerificationFingerprint({
      directory: fixture.root,
      baseCommit: fixture.baseCommit
    })).toThrow('Untracked path is not valid UTF-8; verification cannot proceed safely.');
  });

  it('fails closed with an explicit message when a run changes too many paths', () => {
    const fixture = repository();
    for (let index = 0; index < 4; index += 1) writeFileSync(join(fixture.root, `generated-${index}.txt`), `${index}\n`);

    let failure;
    try {
      createVerificationFingerprint({
        directory: fixture.root,
        baseCommit: fixture.baseCommit,
        limits: { maxPathCount: 3 }
      });
    } catch (error) { failure = error; }

    expect(failure).toMatchObject({ code: 'ORBIT_VERIFICATION_LIMIT', limit: 'maxPathCount', actual: 4, maximum: 3 });
    expect(failure.message).toMatch(/Verification needs attention:.*4 paths.*safe limit is 3/i);
  });

  it('rejects an oversized untracked file before reading it into the fingerprint', () => {
    const fixture = repository();
    writeFileSync(join(fixture.root, 'large.bin'), Buffer.alloc(17, 1));

    expect(() => createVerificationFingerprint({
      directory: fixture.root,
      baseCommit: fixture.baseCommit,
      limits: { maxIndividualFileBytes: 16 }
    })).toThrow(/Verification needs attention:.*large\.bin.*17 bytes.*limit is 16 bytes/i);
  });

  it('rejects a sparse oversized file from metadata without allocating its logical size', () => {
    const fixture = repository();
    const sparse = join(fixture.root, 'sparse.bin');
    writeFileSync(sparse, 'x');
    truncateSync(sparse, 8 * 1024 * 1024);

    let failure;
    try {
      createVerificationFingerprint({
        directory: fixture.root,
        baseCommit: fixture.baseCommit,
        limits: { maxIndividualFileBytes: 1024 }
      });
    } catch (error) { failure = error; }

    expect(failure).toMatchObject({
      code: 'ORBIT_VERIFICATION_LIMIT',
      limit: 'maxIndividualFileBytes',
      path: 'sparse.bin',
      actual: 8 * 1024 * 1024,
      maximum: 1024
    });
  });

  it('bounds the aggregate bytes across changed files', () => {
    const fixture = repository();
    writeFileSync(join(fixture.root, 'one.bin'), Buffer.alloc(8, 1));
    writeFileSync(join(fixture.root, 'two.bin'), Buffer.alloc(8, 2));

    let failure;
    try {
      createVerificationFingerprint({
        directory: fixture.root,
        baseCommit: fixture.baseCommit,
        limits: { maxIndividualFileBytes: 16, maxTotalBytes: 15 }
      });
    } catch (error) { failure = error; }

    expect(failure).toMatchObject({ code: 'ORBIT_VERIFICATION_LIMIT', limit: 'maxTotalBytes', actual: 16, maximum: 15 });
    expect(failure.message).toMatch(/changed files total 16 bytes.*run limit is 15 bytes/i);
  });
});

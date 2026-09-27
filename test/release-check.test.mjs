import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const script = resolve(dirname(fileURLToPath(import.meta.url)), '../scripts/release-check.mjs');
const fixtures = [];
const fakeSecret = ['ghp', '_', 'a'.repeat(36)].join('');
const sensitiveExamples = [
  ['AWS access key', ['AK', 'IA', '1A2B3C4D5E6F7G8H'].join('')],
  ['Slack token', ['xox', 'b-', '123456789012-', 'abcdefghijklmnopqrstuvwx'].join('')],
  ['Slack webhook credential', ['https://hooks.slack.com/', 'services/', 'T12345678/', 'B12345678/', 'abcdefghijklmnopqrstuvwx'].join('')],
  ['Twilio credential', ['AC', '0123456789abcdef'.repeat(2)].join('')],
  ['private key material', ['-----BEGIN ', 'PGP PRIVATE KEY BLOCK-----'].join('')],
  ['private key material', ['-----BEGIN ', 'DSA PRIVATE KEY-----'].join('')],
  ['private key material', ['-----BEGIN ', 'EC PRIVATE KEY-----'].join('')]
];

function git(root, ...args) {
  const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' } });
  if (result.status !== 0) throw new Error(`Fixture Git command failed: ${result.stderr}`);
  return result.stdout.trim();
}
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'orbit-release-check-'));
  fixtures.push(root);
  git(root, 'init', '-q');
  git(root, 'config', 'user.name', 'Fixture');
  git(root, 'config', 'user.email', 'fixture@example.invalid');
  for (const file of ['README.md', 'LICENSE', 'SECURITY.md', 'CONTRIBUTING.md', '.env.example']) writeFileSync(join(root, file), 'Public fixture\n');
  git(root, 'add', '--all');
  return root;
}
function check(root, ...args) {
  const result = spawnSync(process.execPath, [script, '--repo', root, ...args], { encoding: 'utf8', env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' } });
  return { code: result.status, output: result.stdout + result.stderr };
}
afterEach(() => { for (const root of fixtures.splice(0)) rmSync(root, { recursive: true, force: true }); });

describe('exact release candidates', () => {
  it('inspects staged secrets even after the working file is sanitized', () => {
    const root = fixture();
    writeFileSync(join(root, 'config.txt'), fakeSecret);
    git(root, 'add', 'config.txt');
    writeFileSync(join(root, 'config.txt'), 'Sanitized, but not staged\n');
    const result = check(root, '--index');
    expect(result.code).toBe(1);
    expect(result.output).toContain('possible GitHub token');
    expect(result.output).not.toContain(fakeSecret);
    git(root, 'add', 'config.txt');
    expect(check(root).code).toBe(0);
  });

  it.each(sensitiveExamples)('detects targeted %s material without exposing it in diagnostics', (finding, secret) => {
    const root = fixture();
    writeFileSync(join(root, 'candidate.txt'), secret);
    git(root, 'add', 'candidate.txt');
    const result = check(root);
    expect(result.code).toBe(1);
    expect(result.output).toContain(`possible ${finding}`);
    expect(result.output).not.toContain(secret);
  });

  it('detects lower-case, JSON, YAML, and Twilio token assignments while allowing explicit placeholders', () => {
    const root = fixture();
    const values = {
      api: ['live', '_', 'api', '_', 'value', '_', '0123456789abcdef'].join(''),
      password: ['strong', '-', 'pass', '-', '923847'].join(''),
      twilio: ['0123456789abcdef', 'fedcba9876543210'].join('')
    };
    writeFileSync(join(root, 'config.txt'), [
      `api_key = "${values.api}"`,
      `{"databasePassword": "${values.password}"}`,
      `twilio_auth_token: ${values.twilio}`,
      'sample_token = "your-token-here"',
      'client_secret = "${CLIENT_SECRET}"'
    ].join('\n'));
    git(root, 'add', 'config.txt');
    const result = check(root);
    expect(result.code).toBe(1);
    expect(result.output).toContain('possible hard-coded secret assignment');
    for (const value of Object.values(values)) expect(result.output).not.toContain(value);
  });

  it('detects credential-bearing URLs, personal home paths, and literal customer identifiers', () => {
    const root = fixture();
    const url = ['postgresql://orbit:', 'S3curePass987!', '@db.example.invalid/orbit'].join('');
    const macPath = ['/', 'Users', '/private-maintainer/Projects/customer-app'].join('');
    const windowsPath = ['C:', '\\', 'Users', '\\', 'private-maintainer', '\\', 'customer-app'].join('');
    const customer = ['cus', '_', 'private987654321'].join('');
    writeFileSync(join(root, 'private.txt'), [url, macPath, windowsPath, `customer_id = "${customer}"`].join('\n'));
    git(root, 'add', 'private.txt');
    const result = check(root);
    expect(result.code).toBe(1);
    expect(result.output).toContain('possible credential-bearing URL');
    expect(result.output).toContain('possible absolute personal path');
    expect(result.output).toContain('possible hard-coded customer identifier');
    for (const value of [url, macPath, windowsPath, customer]) expect(result.output).not.toContain(value);
  });

  it('allows documented placeholders, generic CI homes, and URLs without embedded credentials', () => {
    const root = fixture();
    writeFileSync(join(root, 'examples.txt'), [
      'api_key = "your-api-key-here"',
      'password = "change-me"',
      'customer_id = "example-customer-id"',
      'Build home: /home/runner/work/orbit',
      'Shared assets: /Users/Shared/orbit',
      'Database: postgresql://db.example.invalid/orbit'
    ].join('\n'));
    git(root, 'add', 'examples.txt');
    const result = check(root);
    expect(result.code, result.output).toBe(0);
  });

  it('pins a requested commit or tree independently of index and working contents', () => {
    const root = fixture();
    git(root, 'commit', '-qm', 'Clean release');
    const clean = git(root, 'rev-parse', 'HEAD');
    writeFileSync(join(root, 'config.txt'), fakeSecret);
    git(root, 'add', 'config.txt');
    git(root, 'commit', '-qm', 'Sensitive fixture');
    const sensitive = git(root, 'rev-parse', 'HEAD');
    writeFileSync(join(root, 'config.txt'), 'Clean again\n');
    git(root, 'add', 'config.txt');
    expect(check(root, '--index').code).toBe(0);
    expect(check(root, '--tree', sensitive).code).toBe(1);
    expect(check(root, '--tree', clean).code).toBe(0);
    expect(check(root, '--tree', git(root, 'rev-parse', `${clean}^{tree}`)).code).toBe(0);
    expect(check(root, '--tree', 'missing-revision').code).toBe(1);
  });

  it.each(['name with spaces.txt', 'line\nbreak.txt', 'café-日本語.txt', 'tab\tname.txt'])('inspects NUL-delimited filename %j', file => {
    const root = fixture();
    writeFileSync(join(root, file), fakeSecret);
    git(root, 'add', '--', file);
    expect(check(root).code).toBe(1);
    git(root, 'commit', '-qm', 'Filename fixture');
    expect(check(root, '--tree', 'HEAD').code).toBe(1);
  });

  it.each(['.env', '.env.production', 'app/.env', 'app/config/.env.production'])('rejects private dotenv path %s even without a token', file => {
    const root = fixture();
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), 'Private configuration\n');
    git(root, 'add', '--', file);
    const result = check(root);
    expect(result.code).toBe(1);
    expect(result.output).toContain('local runtime data');
  });

  it('allows deliberate safe examples and does not silently add untracked files to the index scan', () => {
    const root = fixture();
    mkdirSync(join(root, 'app'));
    writeFileSync(join(root, 'app', '.env.example'), 'Public placeholder\n');
    git(root, 'add', 'app/.env.example');
    writeFileSync(join(root, 'not-staged.txt'), fakeSecret);
    expect(check(root).code).toBe(0);
    expect(check(root).output).toContain('Unstaged and untracked working files were not inspected');
  });

  it('reads staged binary and symlink blobs without following current symlink targets', () => {
    const root = fixture();
    writeFileSync(join(root, 'image.bin'), Buffer.from([0, 255, 254, 1]));
    writeFileSync(join(root, 'untracked-target.txt'), fakeSecret);
    symlinkSync('untracked-target.txt', join(root, 'link'));
    git(root, 'add', 'image.bin', 'link');
    expect(check(root).code).toBe(0);
    writeFileSync(join(root, 'image.bin'), Buffer.concat([Buffer.from([0, 255]), Buffer.from(fakeSecret)]));
    git(root, 'add', 'image.bin');
    expect(check(root).code).toBe(1);
    writeFileSync(join(root, 'image.bin'), Buffer.from([0]));
    git(root, 'add', 'image.bin');
    unlinkSync(join(root, 'link'));
    symlinkSync(fakeSecret, join(root, 'link'));
    git(root, 'add', 'link');
    expect(check(root).code).toBe(1);
  });

  it('ignores missing/unreadable working files while inspecting their staged blobs', () => {
    const root = fixture();
    writeFileSync(join(root, 'staged.txt'), 'Exact staged data\n');
    git(root, 'add', 'staged.txt');
    chmodSync(join(root, 'staged.txt'), 0);
    expect(check(root).code).toBe(0);
    unlinkSync(join(root, 'staged.txt'));
    expect(check(root).code).toBe(0);
  });

  it('fails closed on a missing candidate blob instead of reading its clean working replacement', () => {
    const root = fixture();
    writeFileSync(join(root, 'candidate.txt'), fakeSecret);
    git(root, 'add', 'candidate.txt');
    const object = git(root, 'rev-parse', ':candidate.txt');
    unlinkSync(join(root, '.git', 'objects', object.slice(0, 2), object.slice(2)));
    writeFileSync(join(root, 'candidate.txt'), 'Safe replacement\n');
    const result = check(root);
    expect(result.code).toBe(1);
    expect(result.output).toContain('candidate Git blob could not be read completely');
    expect(result.output).not.toContain(fakeSecret);
  });

  it('checks required documents in the selected Git content, not the working tree', () => {
    const root = fixture();
    git(root, 'rm', '--cached', 'LICENSE');
    expect(readFileSync(join(root, 'LICENSE'), 'utf8')).toContain('Public fixture');
    const result = check(root);
    expect(result.code).toBe(1);
    expect(result.output).toContain('required public release file is missing');
  });

  it('does not let local replacement refs substitute a sanitized blob', () => {
    const root = fixture();
    writeFileSync(join(root, 'candidate.txt'), fakeSecret);
    git(root, 'add', 'candidate.txt');
    const original = git(root, 'rev-parse', ':candidate.txt');
    writeFileSync(join(root, 'replacement.txt'), 'Clean replacement\n');
    const replacement = git(root, 'hash-object', '-w', 'replacement.txt');
    git(root, 'replace', original, replacement);
    const result = check(root);
    expect(result.code).toBe(1);
    expect(result.output).toContain('possible GitHub token');
  });

  it('fails closed on unresolved staged conflicts', () => {
    const root = fixture();
    const object = git(root, 'rev-parse', ':README.md');
    const conflict = spawnSync('git', ['-C', root, 'update-index', '--index-info'], {
      encoding: 'utf8', input: `100644 ${object} 1\tconflict.txt\n100644 ${object} 2\tconflict.txt\n100644 ${object} 3\tconflict.txt\n`
    });
    expect(conflict.status).toBe(0);
    const result = check(root);
    expect(result.code).toBe(1);
    expect(result.output).toContain('unresolved index conflict');
  });

  it('rejects uninspected gitlinks and ambiguous intent-to-add entries', () => {
    const root = fixture();
    git(root, 'commit', '-qm', 'Fixture');
    const head = git(root, 'rev-parse', 'HEAD');
    git(root, 'update-index', '--add', '--cacheinfo', `160000,${head},submodule`);
    expect(check(root).output).toContain('unsupported Git entry mode');
    git(root, 'update-index', '--force-remove', 'submodule');
    writeFileSync(join(root, 'planned.txt'), 'Not staged\n');
    git(root, 'add', '--intent-to-add', 'planned.txt');
    expect(check(root).output).toContain('intent-to-add entry');
  });

  it('rejects conflicting mode arguments instead of checking another source', () => {
    const root = fixture();
    expect(check(root, '--index', '--tree', 'HEAD').code).toBe(1);
    expect(check(root, '--tree').code).toBe(1);
  });
});

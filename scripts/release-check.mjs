import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MAX_GIT_OUTPUT = 64 * 1024 * 1024;
const utf8 = new TextDecoder('utf-8', { fatal: true });
const forbiddenPaths = [
  /^data\/(?!projects\.example\.json$|\.gitkeep$)/,
  /^\.orbit-tools\//,
  /(^|\/)node_modules\//,
  /(^|\/)dist\//,
  /(^|\/)orbit-backup.*\.(?:tar\.gz|zip)$/i
];
const privateKeyPattern = new RegExp([
  '-----BEGIN ',
  '(?:(?:RSA|DSA|EC|OPENSSH|ENCRYPTED) )?PRIVATE KEY-----',
  '|-----BEGIN ',
  'PGP PRIVATE KEY BLOCK-----'
].join(''));
const secretPatterns = [
  { name: 'private key material', pattern: privateKeyPattern },
  { name: 'AWS access key', pattern: /\b(?:AKIA|ASIA|AIDA|AROA|AIPA|ANPA|ANVA|ASCA)[A-Z0-9]{16}\b/ },
  { name: 'GitHub token', pattern: /(?:ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,})/ },
  { name: 'Slack token', pattern: /\b(?:xox[baprs]-[A-Za-z0-9-]{20,}|xapp-[A-Za-z0-9-]{20,})\b/ },
  { name: 'Slack webhook credential', pattern: /https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9_-]{6,}\/[A-Za-z0-9_-]{6,}\/[A-Za-z0-9_-]{16,}/i },
  { name: 'Twilio credential', pattern: /\b(?:AC|SK)[0-9a-f]{32}\b/i },
  { name: 'Google API key', pattern: /AIza[0-9A-Za-z_-]{20,}/ },
  { name: 'provider API key', pattern: /(?:gsk|xai|sk)-[A-Za-z0-9_-]{20,}/ }
];

const quotedAssignmentPattern = /(?:^|[ \t{,;])(["']?)([A-Za-z_][A-Za-z0-9_.-]*)\1[ \t]*(?:=|:)[ \t]*(["'`])([^"'`\r\n]*)\3/gm;
const unquotedAssignmentPattern = /^[ \t]*(?:export[ \t]+)?([A-Za-z_][A-Za-z0-9_.-]*)[ \t]*(?:=|:)[ \t]*([^\s#;][^#;\r\n]*?)[ \t]*(?:#.*)?$/gm;
const credentialUrlPattern = /\b[a-z][a-z0-9+.-]{1,15}:\/\/([^\s/@]+)@(?:\[[^\]]+\]|[a-z0-9.-]+)(?::\d+)?(?:[/?#][^\s]*)?/gi;
const personalPathPattern = /(?:\/Users\/|\/home\/)([A-Za-z0-9._-]+)(?:\/[^\0\r\n\s"'`<>]*)?|[A-Za-z]:\\Users\\([A-Za-z0-9._-]+)(?:\\[^\0\r\n"'`<>]*)?/g;
const safeHomeNames = new Set(['app', 'circleci', 'demo', 'developer', 'example', 'node', 'root', 'runner', 'shared', 'ubuntu', 'user', 'username', 'vscode', 'your-name', 'yourname']);
const safeLiteralValues = new Set([
  'null', 'undefined', 'none', 'password', 'secret', 'token', 'changeme', 'replaceme',
  'redacted', 'placeholder', 'example', 'sample', 'dummy', 'fake', 'test', 'notareal',
  'yourvalue', 'yourkey', 'yourtoken', 'yoursecret', 'yourpassword', 'yourid',
  'yourapikey', 'yourapikeyhere', 'yourtokenhere', 'yoursecrethere',
  'examplecustomerid', 'exampletenantid', 'exampleclientid', 'neverreturned', 'testtoken',
  'testsecret', 'testpassword', 'sampletoken', 'dummysecret'
]);

function normalizedName(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isSensitiveAssignmentName(name) {
  const value = normalizedName(name);
  return value === 'token'
    || value === 'secret'
    || value === 'password'
    || value === 'passwd'
    || value === 'pwd'
    || value.endsWith('apikey')
    || value.endsWith('secretaccesskey')
    || value.endsWith('accesstoken')
    || value.endsWith('authtoken')
    || value.endsWith('refreshtoken')
    || value.endsWith('clientsecret')
    || value.endsWith('privatekey')
    || value.endsWith('secretkey')
    || value.endsWith('encryptionkey')
    || value.endsWith('signingkey')
    || value.endsWith('masterkey')
    || value.endsWith('signingsecret')
    || value.endsWith('webhooksecret')
    || value.endsWith('credential')
    || value.endsWith('credentials')
    || value.endsWith('passphrase')
    || value.endsWith('password')
    || value.endsWith('passwd')
    || value.endsWith('secret')
    || value.endsWith('token');
}

function isCustomerIdentifierName(name) {
  const value = normalizedName(name);
  return /^(?:customer|client|tenant)(?:id|identifier|email|phone|phonenumber|accountid)$/.test(value)
    || /^(?:authorizedphone|authorizedphonenumber|twilioaccountsid)$/.test(value);
}

function isSafeExampleLiteral(input) {
  const value = String(input || '').trim();
  const normalized = value.toLowerCase().replace(/[\s_.-]+/g, '');
  if (!value || /\$\{|\{\{|<[^>]+>|process\.env|import\.meta\.env/i.test(value)) return true;
  if (/^[\[{(]/.test(value)) return true;
  if (/^\+?1?555(?:555)?01\d{2}$/.test(value.replace(/[\s().-]/g, ''))) return true;
  if (/^x+$/.test(normalized)) return true;
  return safeLiteralValues.has(normalized);
}

function assignmentFinding(name, rawValue) {
  let value = String(rawValue || '').trim();
  if (value.length >= 2 && ['"', "'", '`'].includes(value[0]) && value.at(-1) === value[0]) value = value.slice(1, -1).trim();
  if (isSafeExampleLiteral(value)) return null;
  if (isCustomerIdentifierName(name) && value.length >= 6) return 'hard-coded customer identifier';
  if (!isSensitiveAssignmentName(name)) return null;
  const minimum = /passw(?:or)?d/i.test(name) ? 8 : 12;
  return value.length >= minimum ? 'hard-coded secret assignment' : null;
}

function contentFindings(content) {
  const findings = [];
  for (const rule of secretPatterns) if (rule.pattern.test(content)) findings.push(rule.name);
  for (const match of content.matchAll(quotedAssignmentPattern)) {
    const finding = assignmentFinding(match[2], match[4]);
    if (finding) findings.push(finding);
  }
  for (const match of content.matchAll(unquotedAssignmentPattern)) {
    const finding = assignmentFinding(match[1], match[2]);
    if (finding) findings.push(finding);
  }
  for (const match of content.matchAll(credentialUrlPattern)) {
    const userInfo = match[1];
    const separator = userInfo.search(/:|%3a/i);
    const encodedSeparator = userInfo.slice(separator, separator + 3).toLowerCase() === '%3a';
    const credential = separator >= 0 ? userInfo.slice(separator + (encodedSeparator ? 3 : 1)) : userInfo;
    if (!isSafeExampleLiteral(credential) && credential.length >= 8) findings.push('credential-bearing URL');
  }
  for (const match of content.matchAll(personalPathPattern)) {
    const homeName = String(match[1] || match[2] || '').toLowerCase();
    if (homeName && !safeHomeNames.has(homeName)) findings.push('absolute personal path');
  }
  return [...new Set(findings)];
}

const expectedPublicFiles = ['README.md', 'LICENSE', 'SECURITY.md', 'CONTRIBUTING.md', '.env.example'];

function git(root, args) {
  const result = spawnSync('git', ['--no-replace-objects', '-C', root, ...args], {
    maxBuffer: MAX_GIT_OUTPUT,
    env: { ...process.env, GIT_NO_LAZY_FETCH: '1', GIT_OPTIONAL_LOCKS: '0' }
  });
  if (result.error || result.status !== 0) throw new Error('Git inspection failed or exceeded the inspection limit.');
  return result.stdout;
}

function nulRecords(output) {
  if (!output.length) return [];
  if (output.at(-1) !== 0) throw new Error('Git returned an incomplete candidate listing.');
  return utf8.decode(output).slice(0, -1).split('\0');
}

function displayPath(path) {
  let safe = path;
  for (const rule of secretPatterns) {
    const flags = rule.pattern.flags.includes('g') ? rule.pattern.flags : `${rule.pattern.flags}g`;
    safe = safe.replace(new RegExp(rule.pattern.source, flags), '[REDACTED]');
  }
  return JSON.stringify(safe);
}

function argumentsFor(argv) {
  let root = defaultRoot;
  let tree = null;
  let modeChosen = false;
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--repo' && argv[index + 1]) root = resolve(argv[++index]);
    else if (arg === '--index' && !modeChosen) modeChosen = true;
    else if (arg === '--tree' && argv[index + 1] && !modeChosen) { tree = argv[++index]; modeChosen = true; }
    else throw new Error('Usage: release-check.mjs [--index | --tree <commit-or-tree>] [--repo <directory>]');
  }
  return { root, tree };
}

export function inspectRelease({ root = defaultRoot, tree = null } = {}) {
  // Strip Git's one trailing newline, not whitespace belonging to the directory.
  const topLevel = utf8.decode(git(root, ['rev-parse', '--show-toplevel']));
  root = topLevel.endsWith('\n') ? topLevel.slice(0, -1) : topLevel;
  let source = 'Git index';
  let records;
  const failures = [];
  if (tree !== null) {
    const object = utf8.decode(git(root, ['rev-parse', '--verify', '--end-of-options', `${tree}^{tree}`])).trim();
    if (!/^[a-f0-9]{40,64}$/.test(object)) throw new Error('Could not resolve the selected release tree.');
    source = `Git tree ${object}`;
    records = nulRecords(git(root, ['ls-tree', '-r', '-z', '--full-tree', object]));
  } else {
    records = nulRecords(git(root, ['ls-files', '--cached', '--stage', '-z']));
    // Intent-to-add entries appear in ls-files but are omitted from a commit.
    // Reject this ambiguous candidate set instead of counting their empty blobs.
    const diffArgs = ['diff', '--cached', '--name-only', '--no-ext-diff', '--no-textconv', '-z'];
    const visible = nulRecords(git(root, [...diffArgs, '--ita-visible-in-index']));
    const committed = new Set(nulRecords(git(root, [...diffArgs, '--ita-invisible-in-index'])));
    for (const path of visible) if (!committed.has(path)) failures.push(`${displayPath(path)}: intent-to-add entry must be staged or removed before inspection`);
  }

  const paths = new Set();
  for (const record of records) {
    const tab = record.indexOf('\t');
    if (tab < 0) throw new Error('Git returned an unsupported candidate record.');
    const metadata = record.slice(0, tab);
    const path = record.slice(tab + 1);
    const parsed = tree === null
      ? /^(\d{6}) ([a-f0-9]{40,64}) ([0-3])$/.exec(metadata)
      : /^(\d{6}) (blob|commit) ([a-f0-9]{40,64})$/.exec(metadata);
    if (!parsed || !path) throw new Error('Git returned an unsupported candidate record.');
    const mode = parsed[1];
    const object = tree === null ? parsed[2] : parsed[3];
    paths.add(path);
    const label = displayPath(path);
    if (tree === null && parsed[3] !== '0') { failures.push(`${label}: unresolved index conflict`); continue; }
    if (!['100644', '100755', '120000'].includes(mode)) { failures.push(`${label}: unsupported Git entry mode ${mode}; its contents cannot be inspected`); continue; }
    const name = path.slice(path.lastIndexOf('/') + 1);
    if ((/^\.env(?:\.|$)/.test(name) && name !== '.env.example') || forbiddenPaths.some(pattern => pattern.test(path))) {
      failures.push(`${label}: local runtime data must not be published`);
      continue;
    }
    let content;
    try {
      // Read the listed object, never the working file or a symlink target.
      // Latin-1 preserves every byte so binary blobs receive the same ASCII
      // secret checks without lossy decoding or skipping them as non-text.
      content = git(root, ['cat-file', 'blob', object]).toString('latin1');
    } catch { failures.push(`${label}: candidate Git blob could not be read completely`); continue; }
    for (const finding of contentFindings(content)) failures.push(`${label}: possible ${finding}`);
  }
  for (const file of expectedPublicFiles) {
    if (!paths.has(file)) failures.push(`${displayPath(file)}: required public release file is missing from ${source}`);
  }
  return { source, files: paths.size, failures: [...new Set(failures)] };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = inspectRelease(argumentsFor(process.argv.slice(2)));
    if (result.failures.length) {
      console.error('Release check failed. Nothing was changed.');
      for (const failure of result.failures) console.error(`- ${failure}`);
      process.exitCode = 1;
    } else {
      console.log(`Release check passed: ${result.files} publishable Git entries inspected from ${result.source}.`);
      console.log('Unstaged and untracked working files were not inspected. This does not scan Git history.');
    }
  } catch (error) {
    console.error(`Release check failed. ${error.message}`);
    process.exitCode = 1;
  }
}

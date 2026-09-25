import { readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const listed = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
  cwd: root,
  encoding: 'utf8'
});

if (listed.status !== 0) {
  console.error('Release check requires a Git repository. Initialize Git before preparing a public release.');
  process.exit(1);
}

const files = listed.stdout.split('\n').filter(Boolean);
const failures = [];
const forbiddenPaths = [
  /^data\/(?!projects\.example\.json$|\.gitkeep$)/,
  /^\.orbit-tools\//,
  /(^|\/)node_modules\//,
  /(^|\/)dist\//,
  /(^|\/)orbit-backup.*\.(?:tar\.gz|zip)$/i
];
const secretPatterns = [
  { name: 'private key material', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'GitHub token', pattern: /(?:ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,})/ },
  { name: 'Google API key', pattern: /AIza[0-9A-Za-z_-]{20,}/ },
  { name: 'provider API key', pattern: /(?:gsk|xai|sk)-[A-Za-z0-9_-]{20,}/ },
  { name: 'hard-coded secret assignment', pattern: /\b[A-Z][A-Z0-9_]*(?:API_KEY|TOKEN|SECRET|PASSWORD)\s*=\s*["'][^"'\n]{12,}["']/ }
];

for (const file of files) {
  const isPrivateEnvironmentFile = /^\.env(?:\.|$)/.test(file) && file !== '.env.example';
  if (isPrivateEnvironmentFile || forbiddenPaths.some(pattern => pattern.test(file))) {
    failures.push(`${file}: local runtime data must not be published`);
    continue;
  }

  const fullPath = join(root, file);
  let content = '';
  try { content = readFileSync(fullPath, 'utf8'); } catch { continue; }
  for (const rule of secretPatterns) {
    if (rule.pattern.test(content)) failures.push(`${file}: possible ${rule.name}`);
  }
}

const expectedPublicFiles = ['README.md', 'LICENSE', 'SECURITY.md', 'CONTRIBUTING.md', '.env.example'];
for (const file of expectedPublicFiles) {
  if (!files.includes(file)) failures.push(`${file}: required public release file is missing`);
}

if (failures.length) {
  console.error('Release check failed. Nothing was changed.');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Release check passed: ${files.length} publishable files inspected.`);
console.log(`Source root: ${relative(process.cwd(), root) || '.'}`);

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const NPM_LOCKFILES = ['package-lock.json', 'npm-shrinkwrap.json'];

export function sanitizeAuditMessage(value) {
  return String(value || '')
    .replace(/https?:\/\/[^\s@/]+@[^\s/]+/gi, 'registry URL')
    .replace(/(?:_authToken|token|password)=?[^\s&]+/gi, 'credential=[redacted]')
    .replace(/https?:\/\/[^\s]+/gi, 'registry URL')
    .slice(-500);
}

export function parseNpmAuditResult({ code, stdout = '', stderr = '', timedOut = false, error = null }) {
  if (timedOut) return { status: 'unavailable', message: 'Dependency audit timed out before npm returned a report.' };
  if (error) return { status: 'unavailable', message: sanitizeAuditMessage(error.message || error) || 'Dependency audit could not start.' };
  // npm uses 1 when it successfully found vulnerabilities. Any other exit
  // status means we cannot trust the report, even if stdout looks like JSON.
  if (![0, 1].includes(code)) return { status: 'unavailable', message: 'Dependency audit did not complete with a valid npm exit status.' };
  let report;
  try { report = JSON.parse(String(stdout || '')); }
  catch { return { status: 'unavailable', message: sanitizeAuditMessage(stderr) || 'Dependency audit did not return a readable JSON report.' }; }
  const vulnerabilities = report?.metadata?.vulnerabilities;
  if (report?.error || !vulnerabilities || typeof vulnerabilities !== 'object' || Array.isArray(vulnerabilities)) {
    return { status: 'unavailable', message: sanitizeAuditMessage(report?.error?.summary || report?.error?.message || stderr) || 'Dependency audit did not return vulnerability metadata.' };
  }
  const severities = ['info', 'low', 'moderate', 'high', 'critical'];
  const normalized = {};
  for (const severity of severities) {
    // npm may omit `info`; all other counts must be actual JSON integers.
    const value = severity === 'info' && !Object.hasOwn(vulnerabilities, severity) ? 0 : vulnerabilities[severity];
    if (!Number.isSafeInteger(value) || value < 0) return { status: 'unavailable', message: 'Dependency audit returned invalid vulnerability counts.' };
    normalized[severity] = value;
  }
  const total = vulnerabilities.total;
  if (!Number.isSafeInteger(total) || total < 0) return { status: 'unavailable', message: 'Dependency audit did not return a valid total vulnerability count.' };
  const calculatedTotal = severities.reduce((sum, severity) => sum + normalized[severity], 0);
  if (total !== calculatedTotal) return { status: 'unavailable', message: 'Dependency audit returned inconsistent vulnerability counts.' };
  normalized.total = total;
  return {
    status: normalized.total ? 'findings' : 'clean', vulnerabilities: normalized,
    auditedAt: new Date().toISOString(),
    message: normalized.total ? `npm audit reported ${normalized.total} production dependency finding(s).` : 'npm audit reported no production dependency findings.'
  };
}

function spawnAudit(cwd, timeoutMs) {
  return new Promise(resolve => {
    const child = spawn('npm', ['audit', '--json', '--omit=dev'], { cwd, env: { ...process.env, CI: 'true' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = ''; let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); }, timeoutMs);
    child.stdout.on('data', chunk => { stdout += String(chunk); });
    child.stderr.on('data', chunk => { stderr += String(chunk); });
    child.once('error', error => { clearTimeout(timer); resolve({ code: null, stdout, stderr, error, timedOut }); });
    child.once('close', code => { clearTimeout(timer); resolve({ code, stdout, stderr, timedOut }); });
  });
}

export async function runNpmDependencyAudit(project, { runner = spawnAudit, timeoutMs = 60_000 } = {}) {
  if (!project?.repoPath || !existsSync(join(project.repoPath, 'package.json'))) return { status: 'not_available', message: 'Connect a local Node.js repository to audit dependencies.' };
  if (!NPM_LOCKFILES.some(file => existsSync(join(project.repoPath, file)))) return { status: 'not_available', message: 'No npm lockfile was found for a reproducible audit.' };
  return parseNpmAuditResult(await runner(project.repoPath, timeoutMs));
}

import { existsSync, readdirSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { buildProjectLaunchAdvisory } from './launch-advisor.mjs';
import { readRepositoryFile as readSecurityFile } from './repository-file.mjs';
export { readSecurityFile };

const IGNORED_DIRECTORIES = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage', 'vendor', 'tmp', 'temp', '.cache', '.turbo']);
const SOURCE_FILE = /\.(?:[cm]?[jt]sx?|json|ya?ml|toml|env|ini|properties|sql|prisma|mdx?|html?)$/i;
const LOCK_FILES = ['package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lockb'];
const CONFIG_FILES = new Set(['.gitignore', '.npmrc', '.yarnrc', 'yarn.lock', 'bun.lockb']);

function emptyConfiguration() {
  return {
    packageManifest: false, lockFile: null, envIgnored: false, envExample: false,
    localEnvFiles: [], buildScript: false, testScript: false, gitignore: false
  };
}

function text(language, english, spanish) {
  return language === 'es' ? spanish : english;
}

function relative(root, file) {
  return file.slice(root.length + 1);
}

function walkRepository(repoPath, visit, { maxFiles = 1800, maxDepth = 7 } = {}) {
  const coverage = { scannedFileCount: 0, unreadablePaths: [], skippedSymlinks: [], partialFiles: [], scanLimitReached: false };
  let root;
  try { root = realpathSync(repoPath); } catch { coverage.unreadablePaths.push('.'); return coverage; }
  let directories = 0;
  const walk = (directory, depth = 0) => {
    if (depth > maxDepth || ++directories > 5000) { coverage.scanLimitReached = true; return; }
    try {
      for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        if (IGNORED_DIRECTORIES.has(entry.name)) continue;
        if (coverage.scannedFileCount >= maxFiles) { coverage.scanLimitReached = true; return; }
        const file = join(directory, entry.name);
        const path = relative(repoPath, file);
        if (entry.isSymbolicLink()) { if (coverage.skippedSymlinks.length < 20) coverage.skippedSymlinks.push(path); continue; }
        if (entry.isDirectory()) {
          walk(file, depth + 1);
        } else {
          try {
            if (!realpathSync(file).startsWith(`${root}/`)) { if (coverage.skippedSymlinks.length < 20) coverage.skippedSymlinks.push(path); continue; }
            coverage.scannedFileCount += 1;
            visit(file, path, coverage);
          } catch { if (coverage.unreadablePaths.length < 20) coverage.unreadablePaths.push(path); }
        }
      }
    } catch { if (coverage.unreadablePaths.length < 20) coverage.unreadablePaths.push(relative(repoPath, directory)); }
  };
  walk(repoPath);
  return coverage;
}

/**
 * Performs an offline, source-local inventory. It deliberately returns file
 * paths and classifications, never matched secret material.
 */
export function inspectRepositorySecurity(project, { language = 'en', dependencyAudit = null, readFile = readSecurityFile, scanLimits } = {}) {
  const repoPath = project.repoPath && existsSync(project.repoPath) ? project.repoPath : null;
  const empty = {
    repoConnected: false, scannedFileCount: 0, secretFindings: [], configuration: emptyConfiguration(),
    dependency: dependencyAudit || { status: 'not_available', message: text(language, 'Connect a local repository to inspect dependencies.', 'Conecta un repositorio local para inspeccionar dependencias.') }
  };
  if (!repoPath) return empty;

  const secretFindings = [];
  const fingerprint = createHash('sha256');
  const configurationContents = new Map();
  const root = realpathSync(repoPath);
  const rememberSecret = (path, kind) => {
    if (!secretFindings.some(item => item.path === path && item.kind === kind) && secretFindings.length < 20) secretFindings.push({ path, kind });
  };
  const looksLikeSecret = [
    ['OpenAI-style API key', /\bsk-[a-zA-Z0-9_-]{16,}\b/],
    ['GitHub token', /\b(?:gh[pousr]_[a-zA-Z0-9_]{20,}|github_pat_[a-zA-Z0-9_]{20,})\b/],
    ['Google API key', /\bAIza[\w-]{20,}\b/],
    ['private key block', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
    ['assigned credential', /(?:api[_-]?key|secret|access[_-]?token|password)\s*[:=]\s*['\"][^'\"]{12,}['\"]/i],
    ['registry credential', /(?:_authToken|_auth|_password)\s*=\s*['\"]?(?!\$\{)[A-Za-z0-9_+\/-]{12,}/i]
  ];
  const coverage = walkRepository(repoPath, (file, path, scanCoverage) => {
    const name = path.split('/').pop();
    if ((!SOURCE_FILE.test(path) && !CONFIG_FILES.has(name)) || /^\.env(?:\.|$)/.test(name)) return;
    // Throwing preserves failure coverage in walkRepository instead of
    // treating an unreadable source as an empty, safe file.
    const { content, partial, size, modifiedAt } = readFile(root, file);
    if (partial && scanCoverage.partialFiles.length < 20) scanCoverage.partialFiles.push(path);
    if (partial) fingerprint.update(JSON.stringify({ path, size, modifiedAt }));
    fingerprint.update(path).update('\0').update(content);
    if (path === '.gitignore' || path === 'package.json') configurationContents.set(path, content);
    for (const [kind, matcher] of looksLikeSecret) if (matcher.test(content)) rememberSecret(path, kind);
  }, scanLimits);

  const gitignore = configurationContents.get('.gitignore') || '';
  const envIgnored = /(^|\n)\s*\.env(?:\.\*|\s|$)/m.test(gitignore) || /(^|\n)\s*\.env\*/m.test(gitignore);
  const envFiles = ['.env', '.env.local', '.env.production'].filter(file => existsSync(join(repoPath, file)));
  let packageJson = null;
  try { packageJson = JSON.parse(configurationContents.get('package.json')); } catch { /* Missing or malformed manifests are represented in configuration. */ }
  const lockFile = LOCK_FILES.find(file => existsSync(join(repoPath, file))) || null;
  const scripts = packageJson?.scripts || {};
  const configuration = {
    packageManifest: Boolean(packageJson),
    lockFile,
    envIgnored,
    envExample: existsSync(join(repoPath, '.env.example')),
    localEnvFiles: envFiles,
    buildScript: Boolean(scripts.build),
    testScript: Boolean(scripts.test),
    gitignore: existsSync(join(repoPath, '.gitignore'))
  };
  const dependency = dependencyAudit || {
    status: lockFile ? 'not_run' : 'not_available',
    message: lockFile
      ? text(language, 'Dependency audit has not been run yet.', 'La auditoría de dependencias todavía no se ha ejecutado.')
      : text(language, 'No supported lockfile was found; dependency audit is unavailable.', 'No se encontró un lockfile compatible; la auditoría de dependencias no está disponible.')
  };
  const incomplete = Boolean(coverage.scanLimitReached || coverage.unreadablePaths.length || coverage.partialFiles.length || coverage.skippedSymlinks.length);
  // Include configuration state even when its files are intentionally excluded
  // from content inspection, such as local .env files.
  fingerprint.update(JSON.stringify({ root, configuration, envFiles, coverage }));
  return {
    repoConnected: true, repoPath, scannedFileCount: coverage.scannedFileCount, secretFindings, configuration, dependency,
    evidenceFingerprint: fingerprint.digest('hex'),
    coverage: { ...coverage, incomplete }
  };
}

export function buildFrameworkMappings(center, { language = 'en' } = {}) {
  const statusFor = id => center.checks.find(check => check.id === id)?.status || 'needs_review';
  const mapping = (id, area, nist, asvs, iso) => ({ id, area, status: statusFor(id), nist, asvs, iso });
  return [
    mapping('secrets', text(language, 'Secrets and configuration hygiene', 'Higiene de secretos y configuración'), 'NIST CSF 2.0: Protect – Data Security', 'OWASP ASVS: V14 Configuration', 'ISO/IEC 27001:2022 Annex A.8 Technological controls'),
    mapping('dependencies', text(language, 'Dependency integrity and known vulnerabilities', 'Integridad de dependencias y vulnerabilidades conocidas'), 'NIST CSF 2.0: Protect – Platform Security', 'OWASP ASVS: V14 Configuration', 'ISO/IEC 27001:2022 Annex A.8 Technological controls'),
    mapping('privacy', text(language, 'Privacy, terms, and data handling', 'Privacidad, términos y manejo de datos'), 'NIST CSF 2.0: Govern – Organizational Context', 'OWASP ASVS: V1 Architecture', 'ISO/IEC 27001:2022 Annex A.5 Organizational controls'),
    mapping('exposure', text(language, 'Local machine and preview exposure', 'Exposición del Mac y vista previa'), 'NIST CSF 2.0: Protect – Platform Security', 'OWASP ASVS: V14 Configuration', 'ISO/IEC 27001:2022 Annex A.8 Technological controls')
  ];
}

function check({ id, title, status, evidence = [], detail, action, taskTitle, suggestedPrompt }) {
  return { id, title, status, evidence, detail, action, taskTitle, suggestedPrompt };
}

function rankGate(checks) {
  const blocked = checks.filter(item => item.status === 'blocked');
  const warnings = checks.filter(item => ['warning', 'needs_review', 'not_run', 'not_available', 'unknown', 'stale'].includes(item.status));
  if (blocked.length) return { status: 'red', blocked, warnings };
  if (warnings.length) return { status: 'yellow', blocked, warnings };
  return { status: 'green', blocked, warnings };
}

// The audit's fingerprint belongs to the audit, not to subsequent UI scans.
// A legacy report without that fingerprint must be re-audited once.
export function applyDependencyFreshness(center, audit, language = 'en') {
  const check = center.checks.find(item => item.id === 'dependencies');
  if (!check || !audit || !['clean', 'findings'].includes(audit.status)) return center;
  const stale = !audit.evidenceFingerprint || audit.evidenceFingerprint !== center.repository?.evidenceFingerprint || Boolean(center.repository?.coverage?.incomplete);
  check.stale = stale;
  if (stale) {
    const blocked = Number(audit.vulnerabilities?.critical || 0) > 0;
    check.status = blocked ? 'blocked' : 'stale';
    check.detail = blocked
      ? text(language, 'A previous dependency audit reported a critical finding. Evidence has changed or is incomplete; the blocker remains until a successful fresh audit resolves it.', 'Una auditoría anterior reportó un hallazgo crítico. La evidencia cambió o está incompleta; el bloqueo permanece hasta que una nueva auditoría exitosa lo resuelva.')
      : text(language, 'Dependency evidence is out of date or incomplete. Run a fresh audit before relying on this result.', 'La evidencia de dependencias está desactualizada o incompleta. Ejecuta una nueva auditoría antes de confiar en este resultado.');
  }
  return center;
}

/**
 * Combines existing launch evidence with local secret/configuration inventory
 * and runtime posture supplied by the Orbit server. No control is presented as
 * a compliance certification.
 */
export async function buildProjectSecurityCenter(project, options = {}) {
  const language = options.language === 'es' ? 'es' : 'en';
  const repository = inspectRepositorySecurity(project, { language, dependencyAudit: options.dependencyAudit });
  const advisory = await buildProjectLaunchAdvisory(project, { language, skipAi: true });
  const runtime = options.runtimePosture || { platform: process.platform, orbitBoundToLoopback: true, firewall: { status: 'unknown' }, fileVault: { status: 'unknown' }, activeTunnels: [] };
  const trustChecks = advisory.hardeningChecks.filter(item => item.category === 'trust');
  const missingTrust = trustChecks.filter(item => ['blocked', 'needs_decision', 'not_reviewed'].includes(item.status));
  const privacyEvidenceFingerprint = createHash('sha256').update(JSON.stringify({ evidence: advisory.trust?.evidence || {}, likelyPublic: advisory.trust?.likelyPublic, hasTracking: advisory.trust?.hasTracking, repository: repository.evidenceFingerprint || null })).digest('hex');
  const privacyReview = options.privacyReview || null;
  const validPrivacyReview = !repository.coverage?.incomplete && privacyReview && ['reviewed', 'not_applicable'].includes(privacyReview.decision) && String(privacyReview.rationale || '').trim().length >= 8 && privacyReview.evidenceFingerprint === privacyEvidenceFingerprint;
  const dependency = repository.dependency || { status: 'not_run' };
  const dependencyBlocked = Number(dependency?.vulnerabilities?.critical || 0) > 0;
  const dependencyWarning = dependency.status !== 'clean' && !dependencyBlocked;
  const secretStatus = !repository.repoConnected ? 'not_available' : repository.secretFindings.length ? 'blocked' : repository.coverage?.incomplete ? 'warning' : (!repository.configuration.envIgnored && repository.configuration.localEnvFiles.length ? 'warning' : 'pass');
  const privacyStatus = !repository.repoConnected ? 'not_available' : missingTrust.some(item => item.status === 'blocked') ? 'blocked' : missingTrust.length ? 'needs_review' : validPrivacyReview ? 'pass' : 'needs_review';
  const machineStatus = runtime.platform === 'darwin' && (runtime.firewall?.status === 'disabled' || runtime.fileVault?.status === 'disabled') ? 'warning' : runtime.platform === 'darwin' && (runtime.firewall?.status === 'unknown' || runtime.fileVault?.status === 'unknown') ? 'unknown' : 'pass';
  const exposureStatus = runtime.activeTunnels?.length ? 'warning' : 'pass';
  // A live client-portal token is a standing public exposure surface, just like a
  // preview tunnel. It is intentional and revocable, but it must never be silent —
  // the Security Center is where a human notices it and can revoke it.
  const clientPortalLink = project.clientShareTokenHash ? { active: true, createdAt: project.clientShareCreatedAt || null } : { active: false, createdAt: null };

  const checks = [
    check({
      id: 'secrets', title: text(language, 'Secrets and configuration hygiene', 'Higiene de secretos y configuración'), status: secretStatus,
      evidence: repository.secretFindings.map(item => `${item.path} (${item.kind})`).concat(repository.configuration.envIgnored ? ['.gitignore protects environment files'] : []),
      detail: repository.secretFindings.length
        ? text(language, 'Potential credential material was detected in source-like files. Orbit never exposes the matched value; remove it from source, rotate it with the provider, and use environment variables.', 'Se detectó posible material de credenciales en archivos de código. Orbit nunca muestra el valor; elimínalo del código, rótalo con el proveedor y usa variables de entorno.')
        : repository.configuration.localEnvFiles.length && !repository.configuration.envIgnored
          ? text(language, 'Local environment files exist but .gitignore does not show protection for them. Review before committing.', 'Existen archivos de entorno local pero .gitignore no muestra protección. Revísalos antes de hacer commit.')
          : repository.coverage?.incomplete
            ? text(language, 'The source scan was incomplete because some paths, symlinks, large files, or depth limits could not be fully inspected. Review coverage before treating this check as clear.', 'El escaneo de código fue incompleto porque algunas rutas, enlaces simbólicos, archivos grandes o límites de profundidad no se pudieron inspeccionar por completo. Revisa la cobertura antes de considerar este control aprobado.')
            : text(language, 'No credential-shaped value was found in the inspected source files. This is a local pattern scan, not proof that every secret is safe.', 'No se encontraron valores con forma de credencial en los archivos inspeccionados. Es un escaneo local de patrones, no prueba de que todos los secretos estén seguros.'),
      action: text(language, 'Review secrets hygiene', 'Revisar higiene de secretos'), taskTitle: 'Harden secrets and environment configuration',
      suggestedPrompt: `Inspect ${project.name} for committed credentials and environment-file handling. Do not print any secret values. Remove exposed values from source, add safe .gitignore and .env.example guidance, and explain required credential rotation steps.`
    }),
    check({
      id: 'dependencies', title: text(language, 'Dependency and build configuration', 'Dependencias y configuración de build'), status: dependencyBlocked ? 'blocked' : dependency.status === 'findings' ? 'warning' : dependency.status === 'stale' ? 'stale' : dependency.status === 'not_available' ? 'not_available' : dependencyWarning ? 'not_run' : 'pass',
      evidence: [repository.configuration.packageManifest ? 'package.json' : '', repository.configuration.lockFile || '', repository.configuration.buildScript ? 'build script' : '', repository.configuration.testScript ? 'test script' : ''].filter(Boolean),
      detail: !repository.repoConnected
        ? text(language, 'Connect a local repository to inspect its manifest, lockfile, and dependencies.', 'Conecta un repositorio local para inspeccionar su manifiesto, lockfile y dependencias.')
        : dependency.status === 'clean'
        ? text(language, 'The latest dependency audit found no reported production vulnerabilities at the selected audit level.', 'La última auditoría de dependencias no reportó vulnerabilidades de producción al nivel seleccionado.')
        : dependencyBlocked
          ? text(language, `Dependency audit reported ${dependency.vulnerabilities.critical} critical vulnerability finding(s). Review and remediate before public launch.`, `La auditoría reportó ${dependency.vulnerabilities.critical} vulnerabilidad(es) crítica(s). Revísalas y corrígelas antes de lanzar públicamente.`)
          : dependency.message || text(language, 'Run a fresh dependency audit from the Security Center before launch. This check does not assume a clean audit from a lockfile alone.', 'Ejecuta una auditoría de dependencias desde Security Center antes del lanzamiento. Un lockfile por sí solo no prueba que la auditoría esté limpia.'),
      action: text(language, 'Run dependency audit', 'Ejecutar auditoría de dependencias'), taskTitle: 'Review dependency audit findings',
      suggestedPrompt: `Review the dependency audit results for ${project.name}. Update or replace vulnerable dependencies carefully, preserve lockfile integrity, run the relevant build and tests, and report any remaining accepted risk.`
    }),
    check({
      id: 'privacy', title: text(language, 'Privacy, terms, and data-handling readiness', 'Privacidad, términos y preparación para manejo de datos'), status: privacyStatus,
      evidence: trustChecks.flatMap(item => item.evidence || []).slice(0, 16),
      detail: missingTrust.length
        ? text(language, 'Some public-facing privacy, terms, cookie, or support evidence needs a responsible owner. Orbit can identify local implementation evidence, but cannot certify legal compliance.', 'Parte de la evidencia pública de privacidad, términos, cookies o soporte necesita un responsable. Orbit puede identificar evidencia local, pero no puede certificar cumplimiento legal.')
        : validPrivacyReview
          ? text(language, `Local privacy evidence was reviewed on ${privacyReview.reviewedAt || 'this device'}. Keep the decision current when routes, vendors, or data handling change.`, `La evidencia local de privacidad fue revisada el ${privacyReview.reviewedAt || 'en este equipo'}. Mantén la decisión actualizada cuando cambien rutas, proveedores o manejo de datos.`)
          : text(language, 'Local routes or documents were found. Record the responsible owner’s review of the actual data inventory, vendors, retention, deletion process, and jurisdictional review.', 'Se encontraron rutas o documentos locales. Registra la revisión de la persona responsable sobre inventario de datos, proveedores, retención, eliminación y revisión jurisdiccional.'),
      action: text(language, 'Open privacy evidence', 'Abrir evidencia de privacidad'), taskTitle: 'Complete privacy and data-handling readiness review',
      suggestedPrompt: `Review ${project.name}'s actual data flows, third-party vendors, retention and deletion behavior, support contact, privacy policy, and terms. Implement missing routes or disclosures, but label all legal text for qualified legal review and do not claim compliance.`
    }),
    check({
      id: 'exposure', title: text(language, 'Mac and preview exposure', 'Exposición del Mac y vista previa'), status: exposureStatus === 'warning' ? 'warning' : machineStatus,
      evidence: [
        runtime.orbitBoundToLoopback ? 'Orbit API bound to 127.0.0.1' : 'Orbit API binding requires review',
        ...(runtime.activeTunnels || []).map(tunnel => `Active public preview: ${tunnel.projectName || tunnel.projectId}`),
        clientPortalLink.active ? text(language, `Client portal link is active${clientPortalLink.createdAt ? ` (created ${clientPortalLink.createdAt})` : ''} — revoke it from Client Portal settings when the engagement ends.`, `El enlace del portal de cliente está activo${clientPortalLink.createdAt ? ` (creado ${clientPortalLink.createdAt})` : ''}; revócalo desde la configuración del portal cuando termine el proyecto.`) : '',
        runtime.firewall?.evidence, runtime.fileVault?.evidence
      ].filter(Boolean),
      detail: runtime.activeTunnels?.length
        ? text(language, 'A temporary public preview tunnel is active. It exposes the running preview through a public URL until stopped. Do not use it for production data or internal-only screens.', 'Hay un túnel temporal de vista previa activo. Expone la vista por una URL pública hasta detenerlo. No lo uses con datos de producción o pantallas internas.')
        : clientPortalLink.active
          ? text(language, 'A client portal link is active. It stays valid until revoked, so confirm it is still meant to be shared and revoke it once the client engagement is done.', 'Hay un enlace del portal de cliente activo. Permanece válido hasta que se revoque; confirma que siga siendo necesario y revócalo al terminar el proyecto con el cliente.')
          : text(language, 'Orbit itself is loopback-only. macOS controls are observed locally when available; changing them remains the device owner’s decision.', 'Orbit está limitado a loopback. Los controles de macOS se observan localmente cuando están disponibles; modificarlos sigue siendo decisión de la persona dueña del equipo.'),
      action: text(language, 'Review local exposure', 'Revisar exposición local'), taskTitle: 'Review preview and workstation exposure',
      suggestedPrompt: `Review ${project.name}'s local preview and deployment exposure. Keep developer servers bound to loopback unless deliberately shared, stop unused tunnels, and document any intended public preview access without exposing secrets or production data.`
    })
  ];
  const gate = rankGate(checks);
  const center = {
    ok: true, generatedAt: new Date().toISOString(), projectId: project.id, projectName: project.name,
    privacyReview: { review: privacyReview, valid: Boolean(validPrivacyReview), evidenceFingerprint: privacyEvidenceFingerprint },
    gate: {
      ...gate,
      label: gate.status === 'red' ? text(language, 'Do not launch', 'No lanzar') : gate.status === 'yellow' ? text(language, 'Human review required', 'Revisión humana requerida') : text(language, 'Technical checks clear', 'Controles técnicos en verde'),
      summary: gate.status === 'red'
        ? text(language, 'Critical findings need remediation before a public launch.', 'Los hallazgos críticos requieren corrección antes de un lanzamiento público.')
        : gate.status === 'yellow'
          ? text(language, 'There are unresolved checks or decisions. Review the evidence before launch.', 'Hay verificaciones o decisiones pendientes. Revisa la evidencia antes de lanzar.')
          : text(language, 'No blocking local finding was detected. This does not replace legal, penetration-test, or certification review.', 'No se detectó un bloqueo local. Esto no reemplaza revisión legal, pentest o certificación.'),
      canLaunch: gate.status === 'green'
    },
    checks, repository, runtime, clientPortalLink, launchAdvisory: { readinessScore: advisory.readinessScore, launchGate: advisory.launchGate },
    frameworkMappings: []
  };
  center.frameworkMappings = buildFrameworkMappings(center, { language });
  return center;
}

export function securityEvidenceMarkdown(center) {
  const lines = [
    `# Orbit Security Evidence — ${center.projectName}`,
    '',
    `Generated: ${center.generatedAt}`,
    `Launch gate: **${center.gate.label}** (${center.gate.status.toUpperCase()})`,
    '',
    '> This is a local evidence inventory and working control map. It is not a legal opinion, penetration test, ISO certification, or compliance attestation.',
    '',
    '## Security checks',
    ''
  ];
  for (const item of center.checks) {
    lines.push(`### ${item.title}`, `Status: **${item.status}**`, item.detail, item.evidence.length ? `Evidence: ${item.evidence.join(', ')}` : 'Evidence: none recorded', '');
  }
  const coverage = center.repository?.coverage;
  if (coverage) {
    lines.push('## Scan coverage', '', `Coverage: ${coverage.incomplete ? 'incomplete' : 'within scan limits'}`, `Traversal limit reached: ${coverage.scanLimitReached ? 'yes' : 'no'}`);
    for (const [key, label] of [['unreadablePaths', 'Unreadable'], ['skippedSymlinks', 'Skipped symlinks'], ['partialFiles', 'Partially read']]) {
      if (coverage[key]?.length) lines.push(`${label}: ${coverage[key].join(', ')}`);
    }
    lines.push('');
  }
  lines.push('## Reference control map', '');
  for (const item of center.frameworkMappings) lines.push(`- **${item.area}** — ${item.status}; ${item.nist}; ${item.asvs}; ${item.iso}`);
  lines.push('', '## Local exposure', '',
    `- Orbit loopback binding: ${center.runtime.orbitBoundToLoopback ? 'confirmed' : 'review required'}`,
    `- Active public preview tunnels: ${(center.runtime.activeTunnels || []).length}`,
    `- Client portal link: ${center.clientPortalLink?.active ? `active${center.clientPortalLink.createdAt ? ` (created ${center.clientPortalLink.createdAt})` : ''}` : 'none'}`
  );
  return `${lines.join('\n')}\n`;
}

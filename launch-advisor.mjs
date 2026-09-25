import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { readRepositoryFile } from './repository-file.mjs';

/**
 * Inspects a project's repository and metadata to detect architectural traits:
 * multi-tenancy, database, payment gateways, authentication, testing, monitoring.
 */
export function detectProjectArchitecture(project, options = {}) {
  const repoPath = project.repoPath && existsSync(project.repoPath) ? project.repoPath : null;
  const detectedStack = [];
  let packageJson = null;
  let hasDatabase = false;
  let hasPayments = false;
  let hasAuth = false;
  let hasRateLimiting = false;
  let hasTests = false;
  let hasMonitoring = false;
  let isMultiTenant = false;

  const projectText = `${project.name} ${project.summary || ''} ${project.kind || ''} ${(project.tasks || []).map(t => (Array.isArray(t) ? t[0] : t?.title) || '').join(' ')}`.toLowerCase();

  // Keyword-based multi-tenancy detection from project goals & tasks
  if (
    projectText.includes('multitenant') ||
    projectText.includes('multi-tenant') ||
    projectText.includes('saas') ||
    projectText.includes('tenant') ||
    projectText.includes('workspace') ||
    projectText.includes('organization')
  ) {
    isMultiTenant = true;
  }

  // Keyword-based payment detection
  if (projectText.includes('stripe') || projectText.includes('pricing') || projectText.includes('checkout') || projectText.includes('payment') || projectText.includes('subscription') || projectText.includes('billing')) {
    hasPayments = true;
  }

  if (repoPath) {
    const pkgPath = join(repoPath, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        packageJson = JSON.parse(readRepositoryFile(repoPath, pkgPath).content);
        const deps = { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };
        const depNames = Object.keys(deps);

        if (depNames.some(d => d.includes('supabase'))) {
          detectedStack.push('Supabase (PostgreSQL / RLS)');
          hasDatabase = true;
          hasAuth = true;
        }
        if (depNames.some(d => d.includes('prisma'))) {
          detectedStack.push('Prisma ORM');
          hasDatabase = true;
        }
        if (depNames.some(d => d.includes('drizzle'))) {
          detectedStack.push('Drizzle ORM');
          hasDatabase = true;
        }
        if (depNames.some(d => d.includes('pg') || d.includes('postgres'))) {
          detectedStack.push('PostgreSQL');
          hasDatabase = true;
        }
        if (depNames.some(d => d.includes('stripe'))) {
          detectedStack.push('Stripe Payments & Billing');
          hasPayments = true;
        }
        if (depNames.some(d => d.includes('clerk') || d.includes('next-auth') || d.includes('@auth/') || d.includes('lucia') || d.includes('jsonwebtoken'))) {
          detectedStack.push('Identity & Authentication');
          hasAuth = true;
        }
        if (depNames.some(d => d.includes('rate-limit') || d.includes('limiter') || d.includes('redis') || d.includes('ioredis'))) {
          detectedStack.push('Rate Limiting & Caching');
          hasRateLimiting = true;
        }
        if (depNames.some(d => d.includes('vitest') || d.includes('jest') || d.includes('playwright') || d.includes('cypress'))) {
          detectedStack.push('Automated Test Suite');
          hasTests = true;
        }
        if (depNames.some(d => d.includes('sentry') || d.includes('datadog'))) {
          detectedStack.push('Crash Monitoring & APM');
          hasMonitoring = true;
        }
        if (depNames.some(d => d.includes('zod'))) {
          detectedStack.push('Zod Schema Validation');
        }
        if (depNames.some(d => d.includes('base44'))) {
          detectedStack.push('Base44 Platform SDK');
        }
      } catch {}
    }

    // Inspect schema or migration files if available
    try {
      const candidates = [
        join(repoPath, 'prisma', 'schema.prisma'),
        join(repoPath, 'schema.prisma')
      ];
      for (const cand of candidates) {
        if (existsSync(cand)) {
          const content = readRepositoryFile(repoPath, cand).content.toLowerCase();
          if (content.includes('tenantid') || content.includes('orgid') || content.includes('workspaceid') || content.includes('accountid')) {
            isMultiTenant = true;
            hasDatabase = true;
          }
        }
      }
    } catch {}
  }

  // Fallbacks if repo is unlinked but text indicates traits
  if (!detectedStack.length) {
    if (isMultiTenant) detectedStack.push('Multi-Tenant Cloud SaaS');
    if (hasPayments) detectedStack.push('Stripe Billing');
    detectedStack.push('Modern Web Application');
  }

  return {
    repoConnected: Boolean(repoPath),
    isMultiTenant,
    hasDatabase,
    hasPayments,
    hasAuth,
    hasRateLimiting,
    hasTests,
    hasMonitoring,
    detectedStack
  };
}

/**
 * Finds lightweight, local evidence of the trust documents a public product
 * normally needs. This is an inventory, never a legal-compliance opinion.
 */
export function inspectTrustArtifacts(project) {
  const repoPath = project.repoPath && existsSync(project.repoPath) ? project.repoPath : null;
  const files = [];
  const ignoredDirectories = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage', 'graphify-out', 'vendor', 'tmp', 'temp', '.cache', '.turbo']);
  const walk = (directory, depth = 0) => {
    if (depth > 7 || files.length >= 5000) return;
    try {
      for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        if (entry.name.startsWith('.') || ignoredDirectories.has(entry.name)) continue;
        const fullPath = join(directory, entry.name);
        if (entry.isDirectory()) walk(fullPath, depth + 1);
        else files.push(fullPath.slice(repoPath.length + 1));
      }
    } catch {}
  };
  if (repoPath) walk(repoPath);

  const normalizedStem = file => file.split('/').pop().replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9áéíóúñ]+/g, '');
  const matchingFiles = predicate => files.filter(file => predicate(normalizedStem(file), file.toLowerCase())).slice(0, 12);
  const privacyFiles = matchingFiles((stem, path) => /^(privacy|privacypolicy|privacidad|politicadeprivacidad|dataprivacy|datapolicy)$/.test(stem) || /\/(privacy|privacy-policy|privacidad|data-policy)(?:\/|\.)/.test(path));
  const termsFiles = matchingFiles((stem, path) => /^(terms|termsofservice|termsandconditions|conditionsofuse|terminos|terminosycondiciones)$/.test(stem) || /\/(terms|terms-of-service|terms-and-conditions|terminos)(?:\/|\.)/.test(path));
  const cookieFiles = matchingFiles((stem, path) => /^(cookies|cookiepolicy|cookieconsent|cookiepreferences)$/.test(stem) || /\/(cookie-policy|cookie-consent|cookie-preferences)(?:\/|\.)/.test(path));
  const supportFiles = matchingFiles((stem, path) => /^(contact|contactus|contacto|support|supportcenter|help|helpcenter)$/.test(stem) || /\/(contact|contact-us|support|help)(?:\/|\.)/.test(path));
  const projectText = `${project.name} ${project.kind || ''} ${project.summary || ''}`.toLowerCase();
  const likelyPublic = Boolean(project.deployedUrl) || /saas|app|platform|portal|e-?commerce|marketplace|website|consumer|customer/i.test(projectText);
  const hasTracking = files.some(file => /google-analytics|gtag|posthog|mixpanel|segment|hotjar|facebook-pixel/i.test(file));

  return {
    repoConnected: Boolean(repoPath), likelyPublic, hasTracking, privacyFiles, termsFiles, cookieFiles, supportFiles,
    scannedFileCount: files.length,
    evidence: { privacy: privacyFiles, terms: termsFiles, cookies: cookieFiles, support: supportFiles }
  };
}

/**
 * Looks for implementation signals in the connected local checkout. A missing
 * signal means "needs review", never proof that a control is absent.
 */
export function inspectTechnicalEvidence(project) {
  const repoPath = project.repoPath && existsSync(project.repoPath) ? project.repoPath : null;
  const evidence = { rls: [], payments: [], rateLimiting: [], validation: [], errorHandling: [], secretsHygiene: [] };
  if (!repoPath) return { repoConnected: false, evidence, scannedFileCount: 0 };
  const ignoredDirectories = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage', 'graphify-out', 'vendor', 'tmp', 'temp', '.cache', '.turbo']);
  const sourceExtensions = /\.(?:[cm]?[jt]sx?|json|sql|prisma|ya?ml)$/i;
  let scannedFileCount = 0;
  const remember = (key, relativePath) => { if (evidence[key].length < 8) evidence[key].push(relativePath); };
  const inspect = (fullPath, relativePath) => {
    if (!sourceExtensions.test(relativePath) || scannedFileCount >= 1500) return;
    try {
      const content = readRepositoryFile(repoPath, fullPath, 120_000).content.toLowerCase();
      scannedFileCount += 1;
      if (/row level security|enable row level security|create policy|tenant[_-]?id|org[_-]?id/.test(content)) remember('rls', relativePath);
      if (/stripe-signature|constructevent\(|webhook.*signature|event\.id.*idempot/.test(content)) remember('payments', relativePath);
      if (/express-rate-limit|rateLimit\(|rate[-_ ]?limit|token bucket|throttle/.test(content)) remember('rateLimiting', relativePath);
      if (/\bzod\b|safeparse\(|parse\(|joi\.|yup\.|valibot/.test(content)) remember('validation', relativePath);
      if (/sentry|datadog|error boundary|app\.use\(.*err|captureexception|internal server error/.test(content)) remember('errorHandling', relativePath);
    } catch {}
  };
  const walk = (directory, depth = 0) => {
    if (depth > 7 || scannedFileCount >= 1500) return;
    try {
      for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        if (entry.name.startsWith('.') || ignoredDirectories.has(entry.name)) continue;
        const fullPath = join(directory, entry.name);
        const relativePath = fullPath.slice(repoPath.length + 1);
        if (entry.isDirectory()) walk(fullPath, depth + 1);
        else inspect(fullPath, relativePath);
      }
    } catch {}
  };
  walk(repoPath);
  if (existsSync(join(repoPath, '.env.example'))) remember('secretsHygiene', '.env.example');
  try {
    const gitignore = readRepositoryFile(repoPath, join(repoPath, '.gitignore')).content;
    if (/(^|\n)\s*\.env(?:\.\*|\s|$)/m.test(gitignore)) remember('secretsHygiene', '.gitignore');
  } catch {}
  return { repoConnected: true, evidence, scannedFileCount };
}

/** Verifies evidence only; document presence is never legal-compliance certification. */
export function generateTrustAndLegalChecks(project, trust, options = {}) {
  const isEs = options.language === 'es';
  const absentStatus = !trust.repoConnected ? 'not_reviewed' : trust.likelyPublic ? 'blocked' : 'needs_decision';
  const absentSeverity = trust.likelyPublic && trust.repoConnected ? 'CRITICAL' : 'HIGH';
  const check = ({ id, title, found, evidence, explanation, impact, prompt, taskTitle, applies = true }) => ({
    id, category: 'trust', severity: applies ? (found ? 'MEDIUM' : absentSeverity) : 'MEDIUM',
    status: !applies ? 'not_applicable' : found ? 'pass' : absentStatus, title, evidence,
    explanation: !applies
      ? (isEs ? 'No se detectó evidencia local de analítica o seguimiento no esencial, por lo que Orbit no exige un flujo de consentimiento para este proyecto en este momento.' : 'No local evidence of non-essential analytics or tracking was detected, so Orbit does not require a consent flow for this project at this time.')
      : !trust.repoConnected
      ? (isEs ? 'Conecta una carpeta local del repositorio para que Orbit pueda revisar esta evidencia. Un enlace de GitHub sin checkout local no permite concluir que falta este requisito.' : 'Connect a local repository folder so Orbit can review this evidence. A GitHub link without a local checkout cannot establish that this requirement is missing.')
      : found
        ? (isEs ? `Orbit encontró evidencia local en: ${evidence.join(', ')}. Esto confirma que existe una implementación, no que su contenido tenga aprobación legal.` : `Orbit found local evidence in: ${evidence.join(', ')}. This confirms an implementation exists, not that its content has legal approval.`)
        : explanation,
    clientImpact: impact,
    implementationGuide: isEs
      ? 'Orbit solo verificó evidencia local. Crea o actualiza el documento, publícalo de forma accesible y solicita revisión legal para la jurisdicción aplicable.'
      : 'Orbit verified local evidence only. Create or update the document, publish it accessibly, and obtain legal review for the applicable jurisdiction.',
    suggestedPrompt: prompt, taskTitle
  });

  return [
    check({
      id: 'privacy-policy', title: isEs ? 'Política de Privacidad accesible' : 'Accessible Privacy Policy', found: trust.privacyFiles.length > 0, evidence: trust.privacyFiles,
      explanation: isEs ? 'No se encontró evidencia local de una política de privacidad. Orbit comprueba archivos y rutas, no certifica cumplimiento legal.' : 'No local evidence of a privacy policy was found. Orbit checks files and routes; it does not certify legal compliance.',
      impact: isEs ? 'Las personas deben poder entender qué datos se recogen, por qué y cómo ejercer sus derechos antes de usar un producto público.' : 'People need an accessible explanation of what data is collected, why, and how to exercise their rights before using a public product.',
      prompt: `Inspect ${project.name} and add an accessible Privacy Policy route and footer link. Draft plain-language copy from the actual data flows, mark it for qualified legal review, and do not claim jurisdictional compliance.`,
      taskTitle: isEs ? 'Crear ruta y enlace accesible para Política de Privacidad' : 'Add an accessible Privacy Policy route and footer link'
    }),
    check({
      id: 'terms-of-service', title: isEs ? 'Términos de Servicio accesibles' : 'Accessible Terms of Service', found: trust.termsFiles.length > 0, evidence: trust.termsFiles,
      explanation: isEs ? 'No se encontró evidencia local de términos o condiciones de uso. Su contenido debe ser revisado por la persona responsable y asesoría legal.' : 'No local evidence of Terms or Conditions of Use was found. Their content requires review by the responsible owner and qualified legal counsel.',
      impact: isEs ? 'Aclara reglas de uso, responsabilidades, soporte, pagos y límites del servicio antes de que entren usuarios externos.' : 'Clarifies use rules, responsibilities, support, payments, and service limits before external users arrive.',
      prompt: `Inspect ${project.name} and add an accessible Terms of Service route and footer link. Draft only a clearly labeled starting point based on the product's real behavior and flag it for legal review.`,
      taskTitle: isEs ? 'Crear ruta y enlace accesible para Términos de Servicio' : 'Add an accessible Terms of Service route and footer link'
    }),
    check({
      id: 'cookie-consent', title: isEs ? 'Consentimiento y preferencias de cookies' : 'Cookie Consent & Preferences', found: trust.cookieFiles.length > 0, evidence: trust.cookieFiles, applies: trust.hasTracking,
      explanation: isEs ? 'Se detectaron posibles indicadores de analítica o cookies. Si se usan tecnologías no esenciales, define preferencias y consentimiento conforme a la jurisdicción aplicable.' : 'Potential analytics or cookie indicators were detected. If non-essential technologies are used, define preferences and consent according to the applicable jurisdiction.',
      impact: isEs ? 'Evita activar medición o marketing no esencial sin informar a las personas usuarias.' : 'Avoids enabling non-essential measurement or marketing without informing users.',
      prompt: `Inspect ${project.name} for analytics, tracking, and non-essential cookies. Implement a consent and preferences flow only where needed, and document the actual vendors and purposes for legal review.`,
      taskTitle: isEs ? 'Auditar cookies y configurar consentimiento cuando aplique' : 'Audit cookies and configure consent where required'
    }),
    check({
      id: 'support-contact', title: isEs ? 'Contacto de soporte y privacidad visible' : 'Visible Support & Privacy Contact', found: trust.supportFiles.length > 0, evidence: trust.supportFiles,
      explanation: isEs ? 'No se encontró una ruta o contenido de soporte/contacto. Confirma un canal real antes de publicar.' : 'No support or contact route/content was found. Confirm a real support channel before publishing.',
      impact: isEs ? 'Da a clientes y usuarios un canal para soporte, solicitudes de privacidad y reportes de incidentes.' : 'Gives customers and users a channel for support, privacy requests, and incident reports.',
      prompt: `Add a visible Contact or Support route to ${project.name}, with a verified support channel and a separate privacy contact when appropriate. Do not invent an email address.`,
      taskTitle: isEs ? 'Añadir contacto de soporte y privacidad verificable' : 'Add a verified support and privacy contact'
    }),
    {
      id: 'human-legal-review', category: 'trust', severity: 'HIGH', status: 'human_review_required', title: isEs ? 'Revisión legal humana antes de la publicación' : 'Human Legal Review Before Publication', evidence: [],
      explanation: isEs ? 'Orbit puede detectar archivos y riesgos técnicos, pero no puede declarar cumplimiento de GDPR, CCPA, COPPA ni de ninguna jurisdicción.' : 'Orbit can detect files and technical risks, but it cannot declare compliance with GDPR, CCPA, COPPA, or any jurisdiction.',
      clientImpact: isEs ? 'La persona dueña del producto debe confirmar las jurisdicciones, datos tratados, pagos, edad mínima y obligaciones aplicables con asesoría legal cualificada.' : 'The product owner must confirm applicable jurisdictions, data handling, payments, age requirements, and obligations with qualified legal counsel.',
      implementationGuide: isEs ? 'Registrar la decisión y la persona responsable. No representar este informe como consejo legal ni como certificación de cumplimiento.' : 'Record the decision and responsible person. Do not represent this report as legal advice or a compliance certification.',
      suggestedPrompt: `Create a factual data-processing and third-party-services inventory for ${project.name}. Do not write legal advice or claim compliance; prepare it for qualified legal review.`,
      taskTitle: isEs ? 'Preparar inventario de datos para revisión legal humana' : 'Prepare a data inventory for qualified legal review'
    }
  ];
}

/**
 * Generates technical pre-launch hardening checks tailored to the app.
 */
export function generateHardeningChecks(project, architecture, options = {}) {
  const isEs = options.language === 'es';
  const technicalEvidence = options.technicalEvidence || { repoConnected: false, evidence: {} };
  const signals = technicalEvidence.evidence || {};
  const statusFor = key => !technicalEvidence.repoConnected ? 'not_reviewed' : (signals[key]?.length ? 'pass' : 'needs_review');
  const sourceEvidence = key => signals[key] || [];
  const checks = [];

  // Check 1: Multi-Tenant RLS & Data Isolation
  if (architecture.isMultiTenant || architecture.hasDatabase) {
    checks.push({
      id: 'rls-tenant-isolation',
      category: 'database',
      severity: 'CRITICAL',
      detected: true,
      status: statusFor('rls'),
      evidence: sourceEvidence('rls'),
      title: isEs
        ? 'Row Level Security (RLS) y Aislamiento Estricto de Tenants'
        : 'Row Level Security (RLS) & Strict Multi-Tenant Data Isolation',
      explanation: isEs
        ? 'En aplicaciones multi-tenant o SaaS, filtrar únicamente en la capa de aplicación con consultas manuales (WHERE tenant_id = ?) es vulnerable a descuidos humanos o regresiones. RLS en PostgreSQL/Supabase garantiza a nivel de base de datos que ninguna consulta devuelva datos de otro cliente, incluso si el código backend falla.'
        : 'In multi-tenant SaaS applications, relying solely on application-level filters (WHERE tenant_id = ?) is vulnerable to accidental regressions. Row Level Security (RLS) enforces tenant boundaries at the database engine level, guaranteeing zero cross-tenant data leakage even during backend bugs.',
      clientImpact: isEs
        ? 'Previene el mayor riesgo para la reputación de tu cliente: filtración accidental de datos entre empresas clientes, demandas legales y multas por incumplimiento de privacidad (RGPD / CCPA).'
        : 'Prevents catastrophic cross-tenant data leaks between enterprise clients, legal liability, and regulatory penalties under GDPR / CCPA.',
      implementationGuide: isEs
        ? '1. Activar RLS en todas las tablas: ALTER TABLE org_data ENABLE ROW LEVEL SECURITY;\n2. Definir políticas restrictivas: CREATE POLICY tenant_isolation ON org_data USING (tenant_id = auth.jwt() ->> \'tenant_id\');\n3. Añadir tests automatizados de ataque que verifiquen que el Tenant A recibe 403 o arreglo vacío al consultar recursos del Tenant B.'
        : '1. Enable RLS on all tenant tables: ALTER TABLE org_data ENABLE ROW LEVEL SECURITY;\n2. Define strict isolation policies bound to tenant claims or JWT context.\n3. Write automated cross-tenant leak tests verifying Tenant A receives 403 or empty sets when requesting Tenant B entities.',
      suggestedPrompt: `Audit and harden the database layer for ${project.name} to enforce strict Row Level Security (RLS) or tenant isolation guards. Create an automated test suite verifying that cross-tenant read/write attempts are completely rejected.`,
      taskTitle: isEs
        ? 'Blindar Row Level Security (RLS) y aislamiento de tenants con tests de fuga'
        : 'Implement strict Row Level Security (RLS) & cross-tenant leak tests'
    });
  }

  // Check 2: Payments Webhook Cryptographic Verification & Idempotency
  if (architecture.hasPayments) {
    checks.push({
      id: 'payments-webhook-idempotency',
      category: 'payments',
      severity: 'CRITICAL',
      detected: true,
      status: statusFor('payments'),
      evidence: sourceEvidence('payments'),
      title: isEs
        ? 'Verificación Criptográfica de Webhooks de Pago e Idempotencia'
        : 'Payment Webhook Cryptographic Verification & Idempotency',
      explanation: isEs
        ? 'Los webhooks de pagos (Stripe/LemonSqueezy) deben verificar la firma criptográfica sobre el payload raw (stripe-signature) para impedir que atacantes simulen compras exitosas con payloads falsos. Además, deben registrar event.id en una tabla de idempotencia para evitar cobros dobles o activaciones repetidas durante reintentos de red.'
        : 'Payment webhooks must cryptographically verify the raw-body signature header (e.g. stripe-signature) to prevent attackers from spoofing checkout completion. They must also register event.id in an idempotency table to prevent duplicate subscription activations or double credits during network retries.',
      clientImpact: isEs
        ? 'Protege los ingresos reales del cliente evitando fraudes de suscripciones ficticias y evitando cobros duplicados que generen contracargos bancarios.'
        : 'Protects the client against fraudulent account upgrades via forged payloads, and prevents duplicate billing charges during network retries.',
      implementationGuide: isEs
        ? '1. Consumir el body en formato raw (express.raw({ type: \'application/json\' })).\n2. Validar con stripe.webhooks.constructEvent(body, sig, secret).\n3. Guardar event.id procesados con índice único antes de despachar la acción.'
        : '1. Handle webhook payloads with raw body parsers.\n2. Verify with stripe.webhooks.constructEvent(body, sig, secret).\n3. Record processed event IDs in an idempotency table with unique constraints before business logic execution.',
      suggestedPrompt: `Audit and harden payment webhook handling in ${project.name}: enforce raw-body cryptographic signature verification with Stripe webhook secret, and implement database-backed event idempotency to prevent duplicate execution on network retries.`,
      taskTitle: isEs
        ? 'Verificar firmas criptográficas de webhooks de pago y blindar idempotencia'
        : 'Harden payment webhook signature verification & idempotency'
    });
  }

  // Check 3: Rate Limiting & Denial of Service / LLM Cost Guardrails
  checks.push({
    id: 'api-rate-limiting',
    category: 'security',
    severity: 'HIGH',
    detected: !architecture.hasRateLimiting,
    status: statusFor('rateLimiting'),
    evidence: sourceEvidence('rateLimiting'),
    title: isEs
      ? 'Rate Limiting en Endpoints Públicos y Control de Costos de API'
      : 'API Rate Limiting, DDoS Mitigation & Third-Party Cost Guardrails',
    explanation: isEs
      ? 'Sin limitadores de tasa (Rate Limiting), un bot malicioso o script automatizado puede bombardear endpoints de autenticación (fuerza bruta de contraseñas) o saturar llamadas a APIs de pago (Stripe, OpenAI, Twilio) generando facturas desorbitadas al cliente.'
      : 'Without rate limiting, malicious bots can brute-force authentication endpoints or flood billable third-party API routes (Stripe, AI models, SMS), leading to unexpected runaway cloud invoices.',
    clientImpact: isEs
      ? 'Evita facturas sorpresa de miles de dólares en proveedores cloud y previene caídas del servicio por saturación de tráfico malicioso.'
      : 'Guards against surprise cloud/API billing shocks and protects application uptime against denial-of-service or scraping bursts.',
    implementationGuide: isEs
      ? 'Configurar middleware de limitación por IP y por token de sesión (ej. express-rate-limit o Redis Token Bucket) con límites estrictos en /api/auth, /api/webhooks y rutas de IA.'
      : 'Implement rate limiting middleware on public and billable routes with window caps on auth, checkout, and AI processing endpoints.',
    suggestedPrompt: `Configure rate limiting middleware on public and sensitive routes (auth, checkout, AI endpoints) in ${project.name} using IP and user/tenant token windows to prevent brute-force attacks and runaway API usage.`,
    taskTitle: isEs
      ? 'Configurar rate limiting en endpoints públicos y rutas con costo'
      : 'Implement API rate limiting and cost protection guardrails'
  });

  // Check 4: Strict Input Schema Validation (Zod) & Parameterized Queries
  checks.push({
    id: 'input-validation-zod',
    category: 'security',
    severity: 'HIGH',
    detected: true,
    status: statusFor('validation'),
    evidence: sourceEvidence('validation'),
    title: isEs
      ? 'Validación Estricta de Esquemas (Zod) y Prevención de Inyecciones'
      : 'Strict Request Schema Validation (Zod) & Injection Defense',
    explanation: isEs
      ? 'Todas las entradas de usuario en APIs públicas y formularios deben validarse contra esquemas Zod estrictos que rechacen campos adicionales no permitidos (mass assignment) y parametricen todas las consultas para prevenir inyecciones SQL o NoSQL.'
      : 'All incoming HTTP request bodies and query parameters must be parsed with strict schemas that strip unauthorized fields, preventing mass assignment (e.g. users promoting themselves to admin) and injection attacks.',
    clientImpact: isEs
      ? 'Garantiza la integridad total de la base de datos y previene la escalada no autorizada de privilegios dentro de las organizaciones de los clientes.'
      : 'Ensures database integrity and blocks unauthorized privilege escalation within client organizations.',
    implementationGuide: isEs
      ? 'Validar req.body con schemas Zod estrictos: z.object({...}).strict(). Usar ORMs o consultas parametrizadas sin interpolar cadenas directas en SQL.'
      : 'Validate req.body using strict Zod schemas with .strict() or .strip(). Ensure all database queries use parameterized placeholders without string concatenation.',
    suggestedPrompt: `Review API endpoints in ${project.name} to ensure every incoming payload is validated with strict Zod schemas, stripping unpermitted fields, and ensure all database queries use parameterized inputs.`,
    taskTitle: isEs
      ? 'Aplicar validación estricta Zod en todas las rutas de API'
      : 'Enforce strict Zod request schema validation & parameterized queries'
  });

  // Check 5: Production Error Masking & Centralized Crash Reporting
  checks.push({
    id: 'error-masking-monitoring',
    category: 'resilience',
    severity: 'MEDIUM',
    detected: !architecture.hasMonitoring,
    status: statusFor('errorHandling'),
    evidence: sourceEvidence('errorHandling'),
    title: isEs
      ? 'Enmascaramiento de Errores en Producción y Monitoreo de Caídas'
      : 'Production Error Masking (No Leaked Stack Traces) & Crash Monitoring',
    explanation: isEs
      ? 'En producción, los errores 500 jamás deben devolver el stack trace o detalles internos de la base de datos al cliente HTTP (fuga de arquitectura y credenciales). Deben responder con un código de error genérico seguro y enviar el diagnóstico completo a un servicio como Sentry.'
      : 'Production 500 errors must never expose raw stack traces, file paths, or internal database table names to HTTP clients. They should respond with safe generic error messages and forward full diagnostic telemetry to a centralized monitor like Sentry.',
    clientImpact: isEs
      ? 'Otorga al cliente la tranquilidad de que su equipo técnico detecta y soluciona cualquier incidente antes de que sus usuarios finales lo noten.'
      : 'Ensures the client and engineering team detect crashes immediately without leaking internal system topologies to malicious observers.',
    implementationGuide: isEs
      ? 'Configurar middleware global de errores: if (process.env.NODE_ENV === \'production\') return res.status(500).json({ error: \'Internal server error\', referenceId });'
      : 'Add a centralized production error boundary that sanitizes HTTP responses while piping full traces and breadcrumbs to Sentry or Datadog.',
    suggestedPrompt: `Configure global production error handlers in ${project.name} to sanitize error responses returned to clients and capture full stack traces in centralized logging.`,
    taskTitle: isEs
      ? 'Enmascarar stack traces en producción y configurar alertas de errores'
      : 'Configure production error boundary masking and crash reporting'
  });

  // Check 6: Secrets Hygiene & Production Environment Separation
  checks.push({
    id: 'secrets-hygiene',
    category: 'compliance',
    severity: 'CRITICAL',
    detected: true,
    status: statusFor('secretsHygiene'),
    evidence: sourceEvidence('secretsHygiene'),
    title: isEs
      ? 'Auditoría de Secretos, Gitignore y Separación de Entornos'
      : 'Secrets Hygiene, Gitignore Audit & Production Environment Separation',
    explanation: isEs
      ? 'Verificar que ningún archivo .env, clave secreta de Stripe (sk_live_...) o llave privada de servicio esté comiteada en el historial de Git o expuesta en el bundle del cliente (ej. variables públicas con nombres erróneos).'
      : 'Verify that zero production secret keys (Stripe sk_live_..., database passwords, private certificates) are committed to git history or bundled into client-side browser JavaScript.',
    clientImpact: isEs
      ? 'Evita el compromiso total de la base de datos, el robo de fondos y la clonación del servicio por filtración involuntaria de credenciales maestras.'
      : 'Prevents complete infrastructure compromise, data exfiltration, or financial theft via leaked master API keys.',
    implementationGuide: isEs
      ? '1. Auditar .gitignore y git log.\n2. Crear archivo .env.example documentado.\n3. Aislar claves en el dashboard de Vercel/servidor sin pasar por el repositorio.'
      : '1. Audit .gitignore and commit history for exposed keys.\n2. Provide a clean .env.example with placeholders.\n3. Store real credentials solely in production platform secret stores.',
    suggestedPrompt: `Audit environment variables and Git history for ${project.name}: verify no private secrets or live API keys are exposed to the client bundle or committed to the repository, and generate a verified .env.example.`,
    taskTitle: isEs
      ? 'Auditar secretos en Git y configurar .env.example de producción'
      : 'Audit secrets exposure and configure verified .env.example'
  });

  return checks;
}

/**
 * Generates an executive client advisory report for launch delivery.
 */
export function generateClientAdvisory(project, architecture, checks, options = {}) {
  const isEs = options.language === 'es';

  // Compute readiness score
  const totalWeight = checks.reduce((acc, c) => acc + (c.severity === 'CRITICAL' ? 30 : c.severity === 'HIGH' ? 20 : 10), 0);
  const passedWeight = checks.reduce((acc, c) => {
    if (c.status === 'pass') return acc + (c.severity === 'CRITICAL' ? 30 : c.severity === 'HIGH' ? 20 : 10);
    if (c.status === 'blocked' || c.status === 'human_review_required') return acc;
    // Partial credit represents an explicit recommendation, never verification.
    return acc + (c.severity === 'CRITICAL' ? 8 : c.severity === 'HIGH' ? 6 : 3);
  }, 0);
  const readinessScore = totalWeight ? Math.round((passedWeight / totalWeight) * 100) : 0;

  const clientActionItems = isEs ? [
    {
      step: 1,
      title: 'Configuración de Dominio Corporativo y DNS',
      responsible: 'Cliente / Administrador de Dominio',
      action: 'Crear registros DNS tipo A o CNAME apuntando al servidor o CDN (Cloudflare/Vercel) y confirmar la emisión del certificado SSL con HTTPS automático.'
    },
    {
      step: 2,
      title: architecture.hasPayments ? 'Activación de Pasarela Stripe en Modo Live (Producción)' : 'Acceso y Propiedad de la Plataforma de Producción',
      responsible: architecture.hasPayments ? 'Cliente / Responsable Financiero' : 'Cliente / Administrador de Plataforma',
      action: architecture.hasPayments
        ? 'Completar la verificación de identidad bancaria (KYC) en Stripe, activar la cuenta en vivo y cargar las claves seguras en las variables de entorno de producción.'
        : 'Confirmar quién administra el proveedor de despliegue, el dominio y las variables de entorno de producción antes de abrir el producto al público.'
    },
    {
      step: 3,
      title: 'Validación Legal: Términos de Servicio y Privacidad (RGPD)',
      responsible: 'Cliente / Asesor Legal',
      action: 'Revisar y aprobar los textos de Términos de Uso, Política de Cookies y Aviso de Privacidad para enlazarlos en el pie de página de la aplicación.'
    },
    {
      step: 4,
      title: 'Canal de Soporte y Matriz de Escalado de Incidencias',
      responsible: 'Cliente / Equipo de Operaciones',
      action: 'Definir el correo oficial de atención al cliente (ej. soporte@tudominio.com) y el protocolo de notificación inmediata para incidencias críticas.'
    },
    {
      step: 5,
      title: 'Aprobación del Plan de Respaldos (Disaster Recovery)',
      responsible: 'Cliente & Equipo de Desarrollo',
      action: 'Aprobar la política de copias de seguridad automáticas: frecuencia diaria, retención de 30 días y tiempo objetivo de recuperación (RTO < 2 horas).'
    }
  ] : [
    {
      step: 1,
      title: 'Custom Domain Setup & DNS Configuration',
      responsible: 'Client / Domain Administrator',
      action: 'Configure DNS A / CNAME records pointing to production CDN (Cloudflare/Vercel) and verify automated SSL/TLS certificate issuance.'
    },
    {
      step: 2,
      title: architecture.hasPayments ? 'Live Stripe Gateway Activation & Banking KYC' : 'Production Platform Access & Ownership',
      responsible: architecture.hasPayments ? 'Client / Finance Lead' : 'Client / Platform Administrator',
      action: architecture.hasPayments
        ? 'Complete business banking verification in Stripe, switch to Live mode, and securely provision live API keys to production secrets store.'
        : 'Confirm who owns production hosting, domain administration, and production environment variables before opening the product to the public.'
    },
    {
      step: 3,
      title: 'Legal Compliance: Terms of Service & Privacy Policy (GDPR)',
      responsible: 'Client / Legal Counsel',
      action: 'Review and approve Terms of Service, Cookie Policy, and Privacy Policy links to be displayed in the app footer.'
    },
    {
      step: 4,
      title: 'Customer Support Inbox & Incident Escalation SLA',
      responsible: 'Client / Operations Lead',
      action: 'Establish the official customer support email (e.g. support@domain.com) and confirm technical escalation contact for severity-1 issues.'
    },
    {
      step: 5,
      title: 'Backup & Disaster Recovery Policy Sign-Off',
      responsible: 'Client & Engineering Team',
      action: 'Sign off on daily automated database backup schedules with 30-day retention and RTO < 2 hours recovery targets.'
    }
  ];

  const productionChecklist = isEs ? [
    ...(architecture.isMultiTenant || architecture.hasDatabase ? ['Aislamiento de datos verificado donde aplique (RLS o controles de acceso validados).'] : []),
    ...(architecture.hasPayments ? ['Firmas de webhooks de pago verificadas criptográficamente.'] : []),
    'Límites de peticiones (Rate Limiting) activos contra ataques de saturación.',
    'Validación estricta de esquemas Zod en todos los formularios y APIs.',
    'Stack traces ocultos en respuestas de error de producción (500).',
    'Separación de claves de Staging y Producción verificada.'
  ] : [
    ...(architecture.isMultiTenant || architecture.hasDatabase ? ['Verified data isolation where applicable (RLS or validated access controls).'] : []),
    ...(architecture.hasPayments ? ['Cryptographically verified payment webhook signatures.'] : []),
    'Rate limiting active on authentication and billable endpoints.',
    'Strict Zod payload validation across all public API routes.',
    'Production error masking enabled with stack traces stripped.',
    'Clean separation of staging and production credentials.'
  ];

  const executiveSummary = isEs
    ? `Informe de preparación previa al lanzamiento para "${project.name}". Esta puntuación refleja evidencia técnica local, no una certificación de seguridad ni de cumplimiento legal. El informe identifica acciones prioritarias y decisiones que el responsable del producto debe validar antes de abrir al público.`
    : `Pre-launch readiness report for "${project.name}". This score reflects local technical evidence, not a security or legal-compliance certification. The report identifies priority actions and decisions the product owner must validate before opening to the public.`;

  // Pre-generate a formatted markdown report ready for copying/export
  const dateStr = new Date().toISOString().split('T')[0];
  const markdownReport = isEs ? `# INFORME DE BLINDAJE PRE-LANZAMIENTO Y ENTREGA A CLIENTE
**Proyecto:** ${project.name}
**Fecha:** ${dateStr}
**Puntuación de Preparación:** ${readinessScore}/100
**Estado:** ${readinessScore >= 85 ? 'Listo para producción con recomendaciones' : 'Requiere blindaje técnico prioritario'}

---

## 1. RESUMEN EJECUTIVO
${executiveSummary}

> **Límite importante:** este informe es una auditoría técnica automatizada basada en evidencia local. No es asesoría legal ni certifica cumplimiento normativo.

**Arquitectura detectada:**
${architecture.detectedStack.map(s => `- ${s}`).join('\n')}

---

## 2. REQUISITOS QUE DEBE COMPLETAR EL CLIENTE ANTES DEL LANZAMIENTO
${clientActionItems.map(item => `### Paso ${item.step}: ${item.title}
- **Responsable:** ${item.responsible}
- **Acción requerida:** ${item.action}
`).join('\n')}

---

## 3. CHECKLIST TÉCNICO DE BLINDAJE (AUDITORÍA ORBIT)
${checks.map(c => `### [${c.severity}] ${c.title}
- **Estado:** ${c.status === 'pass' ? '✓ Superado' : '⚡ Acción recomendada'}
- **Por qué importa:** ${c.explanation}
- **Impacto para el cliente:** ${c.clientImpact}
`).join('\n')}

---

## 4. CHECKLIST DE LIBERACIÓN A PRODUCCIÓN
${productionChecklist.map(check => `- [ ] ${check}`).join('\n')}

---
*Informe generado automáticamente por el Plano de Control de Orbit OS.*
` : `# PRE-LAUNCH HARDENING & CLIENT DELIVERY REPORT
**Project:** ${project.name}
**Date:** ${dateStr}
**Launch Readiness Score:** ${readinessScore}/100
**Status:** ${readinessScore >= 85 ? 'Ready for production with recommendations' : 'Priority technical hardening required'}

---

## 1. EXECUTIVE SUMMARY
${executiveSummary}

> **Important limit:** this report is an automated technical audit based on local evidence. It is not legal advice and does not certify regulatory compliance.

**Detected Architecture:**
${architecture.detectedStack.map(s => `- ${s}`).join('\n')}

---

## 2. CLIENT PRE-LAUNCH REQUIREMENTS & SIGN-OFF
${clientActionItems.map(item => `### Step ${item.step}: ${item.title}
- **Responsible:** ${item.responsible}
- **Required Action:** ${item.action}
`).join('\n')}

---

## 3. TECHNICAL HARDENING AUDIT (ORBIT OS)
${checks.map(c => `### [${c.severity}] ${c.title}
- **Status:** ${c.status === 'pass' ? '✓ Passed' : '⚡ Action Recommended'}
- **Why it matters:** ${c.explanation}
- **Client impact:** ${c.clientImpact}
`).join('\n')}

---

## 4. PRODUCTION GO-LIVE CHECKLIST
${productionChecklist.map(check => `- [ ] ${check}`).join('\n')}

---
*Report generated automatically by Orbit OS Control Plane.*
`;

  return {
    readinessScore,
    executiveSummary,
    clientActionItems,
    productionChecklist,
    markdownReport
  };
}

/**
 * Generates post-MVP expansion ideas tailored to the project domain.
 */
export function generateGrowthIdeas(project, architecture, options = {}) {
  const isEs = options.language === 'es';
  const ideas = [];

  if (architecture.isMultiTenant) {
    ideas.push({
      id: 'growth-enterprise-sso-rbac',
      title: isEs
        ? 'Portal de Gestión de Equipos y Roles Granulares (RBAC)'
        : 'Team Workspace Management & Granular RBAC Permissions',
      category: isEs ? 'Empresas & Cuentas' : 'Enterprise & Teams',
      impact: isEs ? 'Alto' : 'High',
      effort: isEs ? 'Medio' : 'Medium',
      description: isEs
        ? 'Permite a cada cliente invitar a los miembros de su equipo con roles específicos (Admin, Editor, Solo Lectura), aumentando el valor percibido del SaaS y desbloqueando planes Enterprise.'
        : 'Allow customers to invite team members with granular roles (Admin, Member, Viewer), increasing SaaS retention and opening tier upgrades for enterprise accounts.',
      clientValue: isEs
        ? 'Aumenta el ticket promedio (ARPU) permitiendo cobrar por usuario o licencias de equipo.'
        : 'Drives seat-based expansion revenue and upgrades users from solo to team tiers.',
      suggestedPrompt: `Build team workspace invitations and role-based access control (RBAC) in ${project.name}, allowing organization admins to invite team members with specific permission roles.`,
      taskTitle: isEs
        ? 'Implementar gestión de equipos e invitaciones con roles RBAC'
        : 'Implement team member invitations and RBAC permissions'
    });

    ideas.push({
      id: 'growth-audit-logs',
      title: isEs
        ? 'Registro de Auditoría (Audit Logs) para Cumplimiento Corporativo'
        : 'Enterprise Audit Logs & Activity History',
      category: isEs ? 'Seguridad & Cumplimiento' : 'Security & Compliance',
      impact: isEs ? 'Medio' : 'Medium',
      effort: isEs ? 'Bajo' : 'Low',
      description: isEs
        ? 'Guarda un registro inmutable de acciones clave (quién modificó qué y cuándo) para que los administradores de cada empresa puedan auditar la actividad.'
        : 'Record an immutable activity log of key actions (who updated what, IP address, timestamp) accessible to tenant administrators.',
      clientValue: isEs
        ? 'Requisito imprescindible para cerrar contratos con clientes medianos y corporativos que requieren cumplimiento ISO / SOC2.'
        : 'Crucial requirement for closing mid-market and enterprise accounts requiring compliance validation.',
      suggestedPrompt: `Implement an audit log recording subsystem in ${project.name} that logs security and configuration changes per tenant with searchable admin views.`,
      taskTitle: isEs
        ? 'Crear sistema de registro de auditoría (Audit Logs) por tenant'
        : 'Build tenant audit logs and activity history timeline'
    });
  }

  ideas.push({
    id: 'growth-usage-alerts',
    title: isEs
      ? 'Alertas Automatizadas de Inactividad y Reenganche por Email / Webhook'
      : 'Automated Engagement Nudges & Customer Inactivity Triggers',
    category: isEs ? 'Retención & Crecimiento' : 'Growth & Retention',
    impact: isEs ? 'Alto' : 'High',
    effort: isEs ? 'Bajo' : 'Low',
    description: isEs
      ? 'Detecta cuando un usuario no completa una acción clave tras 3 días y le envía un correo recordatorio con sugerencias para reactivarlo automáticamente.'
      : 'Trigger automated email or notification nudges when a user stalls in their onboarding or stops active usage, recovering at-risk accounts.',
    clientValue: isEs
      ? 'Reduce la tasa de cancelación (churn) hasta en un 25% sin esfuerzo manual del cliente.'
      : 'Reduces customer churn by up to 25% through proactive automated touchpoints.',
    suggestedPrompt: `Create an automated customer engagement workflow in ${project.name} that detects inactive user accounts and sends timely re-engagement emails.`,
    taskTitle: isEs
      ? 'Configurar automatización de reenganche para usuarios inactivos'
      : 'Implement automated customer re-engagement email triggers'
  });

  ideas.push({
    id: 'growth-public-api',
    title: isEs
      ? 'Webhooks Salientes y Claves de API para Clientes'
      : 'Customer Outbound Webhooks & Developer API Keys',
    category: isEs ? 'Integraciones & Ecosistema' : 'Integrations & Ecosystem',
    impact: isEs ? 'Alto' : 'High',
    effort: isEs ? 'Medio' : 'Medium',
    description: isEs
      ? 'Permite a los usuarios generar API keys y recibir webhooks en Zapier o Make cuando ocurren eventos en su cuenta, conectando la app con su software existente.'
      : 'Allow customers to create API keys and configure outbound webhooks for Zapier / Make when events occur, embedding the app into their existing stack.',
    clientValue: isEs
      ? 'Hace que la aplicación sea irremplazable al integrarse profundamente con el resto de herramientas del cliente.'
      : 'Increases platform stickiness by making the app an integral hub in the customer workflow.',
    suggestedPrompt: `Implement outbound webhook dispatching and customer API key generation in ${project.name} with signature verification for third-party integrations.`,
    taskTitle: isEs
      ? 'Implementar webhooks salientes y gestión de API keys para clientes'
      : 'Add customer outbound webhooks and API key management'
  });

  return ideas;
}

/**
 * Master generator for launch advisory.
 * Incorporates Gemini 2.5 Flash if available, with robust heuristic fallback.
 */
export async function buildProjectLaunchAdvisory(project, options = {}) {
  const isEs = options.language === 'es';
  const architecture = detectProjectArchitecture(project, options);
  const trust = inspectTrustArtifacts(project);
  const technicalEvidence = inspectTechnicalEvidence(project);
  const hardeningChecks = [
    ...generateHardeningChecks(project, architecture, { ...options, technicalEvidence }),
    ...generateTrustAndLegalChecks(project, trust, options)
  ];
  const clientAdvisory = generateClientAdvisory(project, architecture, hardeningChecks, options);
  const growthIdeas = generateGrowthIdeas(project, architecture, options);

  // If Gemini API Key is available, optionally enrich with contextual AI insights
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey && !options.skipAi) {
    try {
      const prompt = `You are a Principal Software Architect & Pre-Launch Hardening Specialist at Orbit OS.
Analyze this application and provide launch hardening advice:
Project: "${project.name}" (${project.kind || 'Product'})
Summary: ${project.summary || 'Web software'}
Current milestone: ${project.next || 'Active'}
Detected stack: ${architecture.detectedStack.join(', ')}
Is Multi-Tenant: ${architecture.isMultiTenant}
Has Payments: ${architecture.hasPayments}

Generate an enriched pre-launch advisory. Return ONLY a valid JSON object matching this schema:
{
  "readinessScore": 82,
  "executiveSummary": "2-3 sentences summarizing the technical state and pre-launch advice",
  "bespokeHardeningTip": "1 concrete high-impact hardening tip specific to this app domain",
  "bespokeGrowthIdea": {
    "title": "A high-leverage phase 2 feature title",
    "description": "Why it will increase user retention or revenue",
    "clientValue": "Business value for client"
  }
}`;
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json' } })
      });
      if (response.ok) {
        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const parsed = JSON.parse(text);
          if (parsed?.executiveSummary) {
            clientAdvisory.executiveSummary = parsed.executiveSummary;
          }
          if (typeof parsed?.readinessScore === 'number' && parsed.readinessScore > 50 && parsed.readinessScore < 100) {
            clientAdvisory.readinessScore = parsed.readinessScore;
          }
          if (parsed?.bespokeHardeningTip) {
            hardeningChecks.unshift({
              id: 'bespoke-domain-hardening',
              category: 'security',
              severity: 'CRITICAL',
              detected: true,
              status: 'critical',
              title: isEs ? `Blindaje Especializado para ${project.name}` : `Specialized Hardening for ${project.name}`,
              explanation: parsed.bespokeHardeningTip,
              clientImpact: isEs
                ? 'Protege la operativa específica del negocio de tu cliente contra vectores de riesgo del sector.'
                : 'Protects the core business workflow from industry-specific attack vectors.',
              implementationGuide: isEs ? 'Verificar y auditar la lógica de negocio antes de abrir al público.' : 'Audit business logic boundaries before opening to public traffic.',
              suggestedPrompt: `Audit and harden the core business workflows for ${project.name}: ${parsed.bespokeHardeningTip}`,
              taskTitle: isEs
                ? `Blindar lógica central y flujos críticos de ${project.name}`
                : `Harden core business workflows for ${project.name}`
            });
          }
          if (parsed?.bespokeGrowthIdea?.title) {
            growthIdeas.unshift({
              id: 'bespoke-growth-idea',
              title: parsed.bespokeGrowthIdea.title,
              category: isEs ? 'Crecimiento Estratégico' : 'Strategic Growth',
              impact: isEs ? 'Alto' : 'High',
              effort: isEs ? 'Medio' : 'Medium',
              description: parsed.bespokeGrowthIdea.description,
              clientValue: parsed.bespokeGrowthIdea.clientValue,
              suggestedPrompt: `Implement ${parsed.bespokeGrowthIdea.title} in ${project.name}: ${parsed.bespokeGrowthIdea.description}`,
              taskTitle: parsed.bespokeGrowthIdea.title
            });
          }
        }
      }
    } catch {
      // Graceful fallback to pure heuristics
    }
  }

  return {
    ok: true,
    projectId: project.id,
    projectName: project.name,
    architecture,
    trust,
    technicalEvidence,
    readinessScore: clientAdvisory.readinessScore,
    launchGate: {
      status: hardeningChecks.some(check => check.status === 'blocked') ? 'blocked' : 'review_required',
      canDeploy: !hardeningChecks.some(check => check.status === 'blocked'),
      blockers: hardeningChecks.filter(check => check.status === 'blocked').map(check => ({ id: check.id, title: check.title, evidence: check.evidence || [] })),
      requiresHumanReview: hardeningChecks.some(check => check.status === 'human_review_required')
    },
    hardeningChecks,
    clientAdvisory,
    growthIdeas
  };
}

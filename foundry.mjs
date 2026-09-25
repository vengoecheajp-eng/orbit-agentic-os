// Idea Foundry: turns a raw product idea into a reviewed blueprint and a
// project an agent can start on. Pure functions only; the server calls the
// model and writes files.

export const FOUNDRY_COLORS = ['sky', 'coral', 'mint', 'violet'];
const LIMITS = { name: 40, line: 240, paragraph: 900, list: 10, tasks: 10 };

const text = (value, max = LIMITS.line) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const list = (value, max = LIMITS.list, itemMax = LIMITS.line) => (Array.isArray(value) ? value : []).map(item => text(typeof item === 'string' ? item : item?.text ?? item?.name ?? '', itemMax)).filter(Boolean).slice(0, max);

// Deployment stays an explicit, human action in Orbit, and secrets never
// belong in an agent task.
const EXCLUDED_TASK = /\b(deploy(ing|ment)?\s+(\w+\s+){0,3}(to|in(to)?|on)\s+prod(uction)?|go(ing)?\s+live|launch\s+to\s+prod|publish(ing)?\s+(\w+\s+){0,2}to\s+(prod(uction)?|the\s+(app|play)\s+store)|production\s+(deploy(ment)?|release)|(add|set|paste|configure|insert|enter|put)\b[^.]{0,40}\b(api[\s-]?keys?|secrets?|credentials?|access\s+tokens?))\b/i;
// The same rules for plans written in Spanish.
const EXCLUDED_TASK_ES = /(desplegar|despliegue|publicar|subir|lanzar)\b[^.]{0,40}\b(a|en)\s+(producci[oó]n|la\s+(app|play)\s+store)|poner\s+en\s+producci[oó]n|salir\s+en\s+vivo|(a[nñ]adir|configurar|poner|pegar|agregar|introducir)\b[^.]{0,40}\b(claves?(\s+de)?\s+api|api\s+keys?|secretos?|credenciales|tokens?\s+de\s+acceso)/i;
const isExcludedTask = task => EXCLUDED_TASK.test(`${task.title} ${task.description}`) || EXCLUDED_TASK_ES.test(`${task.title} ${task.description}`);

export function slugify(value, fallback = 'new-project') {
  const slug = String(value || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
  return slug || fallback;
}

export function colorFor(value) {
  const sum = [...String(value || '')].reduce((total, character) => total + character.charCodeAt(0), 0);
  return FOUNDRY_COLORS[sum % FOUNDRY_COLORS.length];
}

// What the model is asked for. It has no web access, so it must not present
// market numbers, competitors, or prices as facts.
export function blueprintPrompt(idea, language = 'en') {
  const spanish = language === 'es';
  return {
    system: [
      'You are a senior product strategist and staff engineer helping a founder turn an idea into a buildable first version.',
      'Be concrete and honest. You have no internet access: never state market sizes, statistics, competitor facts, or prices as facts. Present pricing as a hypothesis to test, and list competitor categories to research rather than naming facts about companies.',
      'Keep the first version small: the least that proves the core value. Put everything else in outOfScope.',
      'Pick a tech stack that fits this idea (not a default), and explain why in one sentence.',
      'Tasks are for coding agents working in an isolated Git branch, one reviewable change each (about a day of work or less), in build order. The first task scaffolds the project. Include tests in the tasks. Never include deploying to production, publishing, buying services, or adding API keys or secrets: the founder does those by hand.',
      'Flag legal, privacy, payments, and safety risks that apply (for example health, finance, children, or personal data).',
      spanish ? 'Write every user-facing text value in Spanish. Keep JSON keys in English.' : 'Write every text value in English.',
      'Reply with one JSON object only, no markdown.'
    ].join('\n'),
    prompt: `Idea from the founder:\n"""\n${String(idea).slice(0, 4000)}\n"""\n\nReturn JSON with exactly these keys:\n{\n  "name": "short product name (1-3 words)",\n  "tagline": "one sentence value proposition",\n  "summary": "2-3 sentences: who has the problem, what the product does",\n  "problem": "the specific problem and why current options fall short",\n  "targetUsers": ["primary user", "secondary user"],\n  "mvpScope": ["feature in the first version"],\n  "outOfScope": ["feature deliberately left for later"],\n  "screens": [{"name": "screen", "purpose": "what the user does there"}],\n  "dataModel": [{"entity": "Name", "fields": ["field"]}],\n  "techStack": {"frontend": "", "backend": "", "database": "", "auth": "", "payments": "or none", "hosting": "", "rationale": "why this stack fits"},\n  "monetization": {"model": "how it makes money", "pricingHypothesis": "a starting price to test", "rationale": "why"},\n  "risks": [{"risk": "", "mitigation": ""}],\n  "validation": ["cheap way to test demand before or while building"],\n  "metrics": ["signal that the first version works"],\n  "competitorCategories": ["kind of existing solution to research"],\n  "tasks": [{"title": "imperative task title", "description": "what to build", "acceptance": ["checkable outcome"]}],\n  "firstPrompt": "instruction for the coding agent's first task, referencing docs/PRODUCT_BRIEF.md"\n}\nUse 5 to 8 tasks.`
  };
}

// Pulls the first JSON object out of a model reply (tolerates code fences).
export function parseModelJson(reply) {
  const raw = String(reply || '');
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced || raw;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('The model did not return a JSON blueprint.');
  return JSON.parse(candidate.slice(start, end + 1));
}

function normalizeTask(task) {
  if (typeof task === 'string') task = { title: task };
  if (Array.isArray(task)) task = { title: task[0], description: task[3] };
  const title = text(task?.title, 120);
  if (!title) return null;
  return { title, description: text(task.description, LIMITS.paragraph), acceptance: list(task.acceptance, 6, 200) };
}

// Everything that becomes a project goes through here, from the model or the
// browser: types fixed, sizes capped, excluded tasks removed and reported.
export function normalizeBlueprint(raw, { idea = '', source = 'ai', model = null, language = 'en' } = {}) {
  const input = raw && typeof raw === 'object' ? raw : {};
  const notes = [];
  const allTasks = (Array.isArray(input.tasks) ? input.tasks : []).map(normalizeTask).filter(Boolean);
  const tasks = allTasks.filter(task => !isExcludedTask(task)).slice(0, LIMITS.tasks);
  if (allTasks.some(isExcludedTask)) {
    notes.push(language === 'es' ? 'Se quitaron tareas de despliegue a producción o de credenciales: en Orbit las haces tú manualmente.' : 'Removed tasks about deploying to production or adding credentials: in Orbit you do those by hand.');
  }
  const stack = input.techStack && typeof input.techStack === 'object' && !Array.isArray(input.techStack) ? input.techStack : { rationale: typeof input.techStack === 'string' ? input.techStack : '' };
  const monetization = input.monetization && typeof input.monetization === 'object' ? input.monetization : { model: typeof input.monetization === 'string' ? input.monetization : '' };
  const name = text(input.name, LIMITS.name) || text(idea, LIMITS.name) || (language === 'es' ? 'Nuevo proyecto' : 'New project');
  const blueprint = {
    version: 2,
    source: source === 'template' ? 'template' : 'ai',
    model: model ? text(model, 80) : null,
    language: language === 'es' ? 'es' : 'en',
    idea: String(idea || '').trim().slice(0, 4000),
    name,
    tagline: text(input.tagline ?? input.slogan),
    summary: text(input.summary, LIMITS.paragraph),
    problem: text(input.problem, LIMITS.paragraph),
    targetUsers: list(input.targetUsers),
    mvpScope: list(input.mvpScope),
    outOfScope: list(input.outOfScope),
    screens: (Array.isArray(input.screens) ? input.screens : []).map(screen => typeof screen === 'string' ? { name: text(screen, 80), purpose: '' } : { name: text(screen?.name, 80), purpose: text(screen?.purpose) }).filter(screen => screen.name).slice(0, LIMITS.list),
    dataModel: (Array.isArray(input.dataModel) ? input.dataModel : []).map(item => ({ entity: text(item?.entity, 60), fields: list(item?.fields, 12, 60) })).filter(item => item.entity).slice(0, 12),
    techStack: Object.fromEntries(['frontend', 'backend', 'database', 'auth', 'payments', 'hosting', 'rationale'].map(key => [key, text(stack[key], key === 'rationale' ? 400 : 120)])),
    monetization: { model: text(monetization.model), pricingHypothesis: text(monetization.pricingHypothesis), rationale: text(monetization.rationale, 400) },
    risks: (Array.isArray(input.risks) ? input.risks : []).map(item => typeof item === 'string' ? { risk: text(item), mitigation: '' } : { risk: text(item?.risk), mitigation: text(item?.mitigation) }).filter(item => item.risk).slice(0, 8),
    validation: list(input.validation, 6),
    metrics: list(input.metrics, 6),
    competitorCategories: list(input.competitorCategories, 6),
    tasks,
    firstPrompt: text(input.firstPrompt, 1500),
    color: FOUNDRY_COLORS.includes(input.color) ? input.color : colorFor(name),
    notes
  };
  if (!blueprint.tasks.length) throw new Error(language === 'es' ? 'El plan no incluyó tareas utilizables.' : 'The blueprint did not include any usable tasks.');
  if (!blueprint.firstPrompt) blueprint.firstPrompt = defaultFirstPrompt(blueprint);
  return blueprint;
}

function defaultFirstPrompt(blueprint) {
  const first = blueprint.tasks[0];
  return blueprint.language === 'es'
    ? `Lee docs/PRODUCT_BRIEF.md. Realiza la primera tarea: ${first.title}. ${first.description}`.trim()
    : `Read docs/PRODUCT_BRIEF.md. Complete the first task: ${first.title}. ${first.description}`.trim();
}

// Used when no model is connected. It is a worksheet, not an analysis: it
// never pretends to know the market, the price, or the right stack.
export function templateBlueprint(idea, language = 'en') {
  const es = language === 'es';
  const t = (english, spanish) => es ? spanish : english;
  return normalizeBlueprint({
    name: t('New product', 'Nuevo producto'),
    tagline: '',
    summary: String(idea || '').trim().slice(0, 600),
    problem: t('To define: who has this problem today, and what do they do about it?', 'Por definir: ¿quién tiene hoy este problema y qué hace para resolverlo?'),
    targetUsers: [t('To define: the first user you can talk to this week', 'Por definir: el primer usuario con quien puedas hablar esta semana')],
    mvpScope: [t('To define: the one flow that proves the core value', 'Por definir: el único flujo que demuestra el valor principal')],
    outOfScope: [t('Everything that is not needed to test the core value', 'Todo lo que no sea necesario para probar el valor principal')],
    validation: [t('Talk to 5 potential users about the problem before building', 'Habla con 5 usuarios potenciales sobre el problema antes de construir'), t('Publish a one-page description and measure sign-ups', 'Publica una página descriptiva y mide los registros')],
    risks: [{ risk: t('Personal data: decide what you store and why before building', 'Datos personales: decide qué guardas y por qué antes de construir'), mitigation: t('Collect the minimum and document it in the brief', 'Recoge lo mínimo y documéntalo en el brief') }],
    tasks: [
      { title: t('Scaffold the project with its chosen stack', 'Crear la base del proyecto con el stack elegido'), description: t('Create the app skeleton, a README with run instructions, and one passing test.', 'Crea el esqueleto de la app, un README con instrucciones y una prueba que pase.'), acceptance: [t('The app starts locally', 'La app arranca en local'), t('A test runs and passes', 'Una prueba se ejecuta y pasa')] },
      { title: t('Build the core user flow', 'Construir el flujo principal del usuario'), description: t('Implement the single flow that proves the core value, with test coverage.', 'Implementa el único flujo que demuestra el valor principal, con pruebas.'), acceptance: [t('A user can complete the flow end to end', 'Un usuario puede completar el flujo de principio a fin')] },
      { title: t('Store and load the core data', 'Guardar y cargar los datos principales'), description: t('Add persistence for the data the core flow needs.', 'Añade persistencia para los datos que necesita el flujo principal.'), acceptance: [t('Data survives a restart', 'Los datos se mantienen al reiniciar')] },
      { title: t('Add sign-in if the core flow needs accounts', 'Añadir inicio de sesión si el flujo lo necesita'), description: t('Only if users must return to their own data.', 'Solo si los usuarios deben volver a sus propios datos.'), acceptance: [t('A user sees only their own data', 'Cada usuario ve solo sus datos')] }
    ],
    firstPrompt: t('Read docs/PRODUCT_BRIEF.md, propose a fitting stack in the README, then scaffold the project with one passing test.', 'Lee docs/PRODUCT_BRIEF.md, propone un stack adecuado en el README y crea la base del proyecto con una prueba que pase.')
  }, { idea, source: 'template', language });
}

// Tasks in Orbit's project format: [title, due, done, description, purpose].
export function blueprintTasks(blueprint) {
  const es = blueprint.language === 'es';
  return blueprint.tasks.map((task, index) => {
    const acceptance = task.acceptance.length ? `\n\n${es ? 'Criterios de aceptación' : 'Acceptance criteria'}:\n${task.acceptance.map(item => `- ${item}`).join('\n')}` : '';
    return [task.title, index === 0 ? (es ? 'Siguiente' : 'Next') : (es ? 'Pendiente' : 'Planned'), false, `${task.description}${acceptance}`.trim(), index === 0 ? (es ? 'Primera tarea del MVP' : 'First MVP task') : ''];
  });
}

// The brief written into the new repository so every agent run reads it.
export function blueprintMarkdown(blueprint) {
  const es = blueprint.language === 'es';
  const t = (english, spanish) => es ? spanish : english;
  const bullets = items => items.length ? items.map(item => `- ${item}`).join('\n') : `- ${t('To define', 'Por definir')}`;
  const stack = Object.entries(blueprint.techStack).filter(([key, value]) => key !== 'rationale' && value).map(([key, value]) => `- **${key}**: ${value}`).join('\n');
  return [
    `# ${blueprint.name}`,
    blueprint.tagline && `> ${blueprint.tagline}`,
    blueprint.source === 'template' && `_${t('Drafted from a template without an AI model. Fill in the sections marked “To define”.', 'Borrador creado con una plantilla sin modelo de IA. Completa las secciones “Por definir”.')}_`,
    `## ${t('Idea', 'Idea')}\n${blueprint.idea}`,
    blueprint.summary && `## ${t('Summary', 'Resumen')}\n${blueprint.summary}`,
    blueprint.problem && `## ${t('Problem', 'Problema')}\n${blueprint.problem}`,
    `## ${t('Target users', 'Usuarios objetivo')}\n${bullets(blueprint.targetUsers)}`,
    `## ${t('First version (in scope)', 'Primera versión (incluido)')}\n${bullets(blueprint.mvpScope)}`,
    `## ${t('Not in the first version', 'Fuera de la primera versión')}\n${bullets(blueprint.outOfScope)}`,
    blueprint.screens.length && `## ${t('Screens', 'Pantallas')}\n${blueprint.screens.map(screen => `- **${screen.name}**${screen.purpose ? `: ${screen.purpose}` : ''}`).join('\n')}`,
    blueprint.dataModel.length && `## ${t('Data model', 'Modelo de datos')}\n${blueprint.dataModel.map(item => `- **${item.entity}**: ${item.fields.join(', ')}`).join('\n')}`,
    (stack || blueprint.techStack.rationale) && `## ${t('Tech stack', 'Stack técnico')}\n${stack}${blueprint.techStack.rationale ? `\n\n${blueprint.techStack.rationale}` : ''}`,
    (blueprint.monetization.model || blueprint.monetization.pricingHypothesis) && `## ${t('Monetization (hypothesis to test)', 'Monetización (hipótesis a validar)')}\n${[blueprint.monetization.model, blueprint.monetization.pricingHypothesis && `${t('Starting price to test', 'Precio inicial a probar')}: ${blueprint.monetization.pricingHypothesis}`, blueprint.monetization.rationale].filter(Boolean).join('\n\n')}`,
    blueprint.risks.length && `## ${t('Risks', 'Riesgos')}\n${blueprint.risks.map(item => `- ${item.risk}${item.mitigation ? ` → ${item.mitigation}` : ''}`).join('\n')}`,
    blueprint.validation.length && `## ${t('How to validate', 'Cómo validar')}\n${bullets(blueprint.validation)}`,
    blueprint.metrics.length && `## ${t('Success signals', 'Señales de éxito')}\n${bullets(blueprint.metrics)}`,
    blueprint.competitorCategories.length && `## ${t('Alternatives to research', 'Alternativas a investigar')}\n${bullets(blueprint.competitorCategories)}`,
    `## ${t('Build plan', 'Plan de construcción')}\n${blueprint.tasks.map((task, index) => `${index + 1}. **${task.title}**${task.description ? ` — ${task.description}` : ''}${task.acceptance.length ? `\n${task.acceptance.map(item => `   - [ ] ${item}`).join('\n')}` : ''}`).join('\n')}`,
    `## ${t('Rules for agents', 'Reglas para agentes')}\n- ${t('Deployment, publishing, and secrets are done by the founder, never by an agent.', 'El despliegue, la publicación y los secretos los gestiona el fundador, nunca un agente.')}\n- ${t('Keep changes small and tested; update this brief when scope changes.', 'Mantén los cambios pequeños y probados; actualiza este brief si cambia el alcance.')}`
  ].filter(Boolean).join('\n\n') + '\n';
}

export function readmeMarkdown(blueprint) {
  const es = blueprint.language === 'es';
  return `# ${blueprint.name}\n\n${blueprint.tagline || blueprint.summary || ''}\n\n${es ? 'El plan del producto está en' : 'The product plan is in'} [docs/PRODUCT_BRIEF.md](docs/PRODUCT_BRIEF.md).\n`;
}

export const STARTER_GITIGNORE = [
  '# Dependencies and environments', 'node_modules/', '.venv/', 'venv/', 'vendor/', '__pycache__/', '',
  '# Build output', 'dist/', 'build/', 'target/', '.next/', '', '# Local secrets', '.env', '.env.*', '!.env.example', '', '# OS and editor files', '.DS_Store', '.idea/', '.vscode/', ''
].join('\n');

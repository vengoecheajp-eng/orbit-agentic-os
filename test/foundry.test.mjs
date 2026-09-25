import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { blueprintMarkdown, blueprintTasks, normalizeBlueprint, parseModelJson, slugify, templateBlueprint } from '../foundry.mjs';
import { startIsolatedOrbit, startJsonServer } from './isolated-server.mjs';

const MODEL_BLUEPRINT = {
  name: 'VetRemind',
  tagline: 'Fewer missed vet appointments with WhatsApp reminders.',
  summary: 'Small vet clinics lose revenue to no-shows. VetRemind sends reminders and one-tap rescheduling.',
  problem: 'Clinics call owners by hand.',
  targetUsers: ['Clinic receptionists', 'Pet owners'],
  mvpScope: ['Appointment list', 'Reminder 24h before'],
  outOfScope: ['Payments'],
  screens: [{ name: 'Agenda', purpose: 'See today' }],
  dataModel: [{ entity: 'Appointment', fields: ['pet', 'time'] }],
  techStack: { frontend: 'React', backend: 'Node.js', database: 'Postgres', auth: 'Email link', payments: 'none', hosting: 'Any Node host', rationale: 'Simple CRUD with scheduled jobs.' },
  monetization: { model: 'Per-clinic subscription', pricingHypothesis: '$29/month', rationale: 'Saves staff time.' },
  risks: [{ risk: 'WhatsApp policy', mitigation: 'Use approved templates' }],
  validation: ['Interview 5 clinics'],
  metrics: ['No-show rate drops'],
  competitorCategories: ['Practice management suites'],
  tasks: [
    { title: 'Scaffold the app with one passing test', description: 'Node + React skeleton.', acceptance: ['App starts', 'Test passes'] },
    { title: 'Build the appointment list', description: 'CRUD for appointments.', acceptance: ['Create and list'] },
    { title: 'Deploy to production on Vercel', description: 'Go live.', acceptance: [] },
    { title: 'Add the WhatsApp API keys to the config', description: 'Paste keys.', acceptance: [] }
  ],
  firstPrompt: 'Read docs/PRODUCT_BRIEF.md and scaffold the app.'
};

describe('blueprint rules', () => {
  it('removes deployment and credential tasks and says so', () => {
    const blueprint = normalizeBlueprint(MODEL_BLUEPRINT, { idea: 'vet reminders', model: 'test' });
    expect(blueprint.tasks.map(task => task.title)).toEqual(['Scaffold the app with one passing test', 'Build the appointment list']);
    expect(blueprint.notes[0]).toMatch(/deploying to production/);
    const spanish = normalizeBlueprint({ tasks: [{ title: 'Crear la agenda de citas' }, { title: 'Desplegar a producción en Render' }, { title: 'Añadir las claves de API de WhatsApp' }, { title: 'Guardar contraseñas con bcrypt' }] }, { idea: 'x', language: 'es' });
    expect(spanish.tasks.map(task => task.title)).toEqual(['Crear la agenda de citas', 'Guardar contraseñas con bcrypt']);
    expect(spanish.notes[0]).toMatch(/producción/);
  });

  it('never trusts shapes or sizes from the model', () => {
    const blueprint = normalizeBlueprint({ name: 'x'.repeat(500), color: 'hotpink', tasks: ['Just a string task', { title: '' }, ['Array task', 'Now', false, 'details']], screens: ['Home'], techStack: 'React', monetization: 'Ads' }, { idea: 'i' });
    expect(blueprint.name).toHaveLength(40);
    expect(['sky', 'coral', 'mint', 'violet']).toContain(blueprint.color);
    expect(blueprint.tasks.map(task => task.title)).toEqual(['Just a string task', 'Array task']);
    expect(blueprint.screens).toEqual([{ name: 'Home', purpose: '' }]);
    expect(blueprint.techStack.rationale).toBe('React');
    expect(blueprint.monetization.model).toBe('Ads');
    expect(blueprint.firstPrompt).toContain('docs/PRODUCT_BRIEF.md');
    expect(() => normalizeBlueprint({ tasks: [] }, { idea: 'i' })).toThrow(/usable tasks/);
  });

  it('reads JSON wrapped in prose or code fences', () => {
    expect(parseModelJson('Sure!\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseModelJson('Here: {"a":{"b":2}} done')).toEqual({ a: { b: 2 } });
    expect(() => parseModelJson('no json here')).toThrow();
  });

  it('labels the template honestly and localizes it', () => {
    const blueprint = templateBlueprint('Recordatorios para veterinarias', 'es');
    expect(blueprint.source).toBe('template');
    expect(blueprint.name).toBe('Nuevo producto');
    expect(blueprint.problem).toMatch(/^Por definir/);
    expect(blueprint.monetization.pricingHypothesis).toBe('');
    expect(blueprint.tasks.some(task => /deploy|producci/i.test(task.title))).toBe(false);
    expect(blueprintMarkdown(blueprint)).toContain('plantilla sin modelo de IA');
  });

  it('writes tasks with acceptance criteria in Orbit’s project format', () => {
    const [first] = blueprintTasks(normalizeBlueprint(MODEL_BLUEPRINT, { idea: 'x' }));
    expect(first.slice(0, 3)).toEqual(['Scaffold the app with one passing test', 'Next', false]);
    expect(first[3]).toContain('Acceptance criteria:\n- App starts');
    expect(slugify('Clínica Ñandú App!')).toBe('clinica-nandu-app');
  });
});

describe('Idea Foundry without a model', () => {
  it('returns a clearly labelled template instead of a fake analysis', async () => {
    const base = inject('orbitBase');
    const response = await fetch(`${base}/api/foundry/forge`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idea: 'Dog walking app', language: 'en' }) });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.blueprint.source).toBe('template');
    expect(body.notice).toMatch(/not an analysis/);
  });
});

describe('Idea Foundry with a model', () => {
  let orbit, model, requests;
  beforeAll(async () => {
    requests = [];
    model = await startJsonServer((url, body) => {
      requests.push({ url, body });
      return { choices: [{ message: { content: `Here is the plan:\n${JSON.stringify(MODEL_BLUEPRINT)}` } }] };
    });
    orbit = await startIsolatedOrbit({ DEEPSEEK_API_KEY: 'test-key', ORBIT_DEEPSEEK_BASE_URL: model.url });
  }, 20000);
  afterAll(async () => { await orbit?.stop(); await model?.close(); });

  const post = async (path, body) => {
    const response = await fetch(`${orbit.base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };

  it('drafts with the connected model in the requested language', async () => {
    const options = await (await fetch(`${orbit.base}/api/foundry/options`)).json();
    expect(options.providers.map(item => item.id)).toEqual(['deepseek']);
    const { status, body } = await post('/api/foundry/forge', { idea: 'Recordatorios de citas para veterinarias', language: 'es', provider: 'auto' });
    expect(status).toBe(200);
    expect(body.blueprint).toMatchObject({ source: 'ai', name: 'VetRemind', language: 'es' });
    expect(body.blueprint.model).toContain('DeepSeek');
    expect(requests.at(-1).body.messages[0].content).toMatch(/Spanish/);
    expect(requests.at(-1).body.messages[1].content).toContain('Recordatorios de citas para veterinarias');
  });

  it('creates a local repository with the brief and a connected project', async () => {
    const { body: forged } = await post('/api/foundry/forge', { idea: 'Vet reminders', language: 'en' });
    const parentPath = join(orbit.home, 'Projects');
    mkdirSync(parentPath, { recursive: true });
    const { status, body } = await post('/api/foundry/launch', { blueprint: forged.blueprint, repository: { mode: 'create', parentPath, folderName: 'vetremind' } });
    expect(status, JSON.stringify(body)).toBe(201);
    const repo = join(parentPath, 'vetremind');
    expect(body.project).toMatchObject({ name: 'VetRemind', repoPath: realpathSync(repo), mode: 'connected', kind: 'Forged MVP' });
    expect(body.project.tasks.map(task => task[0])).toEqual(['Scaffold the app with one passing test', 'Build the appointment list']);
    expect(readFileSync(join(repo, 'docs', 'PRODUCT_BRIEF.md'), 'utf8')).toContain('## Build plan');
    const log = spawnSync('git', ['-C', repo, 'log', '--oneline'], { encoding: 'utf8' });
    expect(log.stdout).toContain('Start project from Orbit Idea Foundry');
    expect(spawnSync('git', ['-C', repo, 'status', '--porcelain'], { encoding: 'utf8' }).stdout).toBe('');

    // Same name again, a folder outside home, and a non-empty folder are refused.
    expect((await post('/api/foundry/launch', { blueprint: forged.blueprint, repository: { mode: 'none' } })).status).toBe(409);
    const renamed = { ...forged.blueprint, name: 'VetRemind Two' };
    expect((await post('/api/foundry/launch', { blueprint: renamed, repository: { mode: 'create', parentPath: '/', folderName: 'x' } })).body.error).toMatch(/home folder/);
    mkdirSync(join(parentPath, 'taken'));
    writeFileSync(join(parentPath, 'taken', 'file.txt'), 'x');
    expect((await post('/api/foundry/launch', { blueprint: renamed, repository: { mode: 'create', parentPath, folderName: 'taken' } })).body.error).toMatch(/not empty/);
    expect(existsSync(join(parentPath, 'taken', '.git'))).toBe(false);
  });

  it('refuses a blueprint edited into something unusable', async () => {
    const { status } = await post('/api/foundry/launch', { blueprint: { name: 'Empty', tasks: [] }, repository: { mode: 'none' } });
    expect(status).toBe(400);
  });
});

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(resolve(root, 'src/main.jsx'), 'utf8');
const styles = readFileSync(resolve(root, 'src/styles.css'), 'utf8');

describe('Orbit UI accessibility guardrails', () => {
  it('keeps a visible keyboard focus treatment and reduced-motion fallback', () => {
    expect(styles).toMatch(/:where\(a, button, input, select, textarea, summary\):focus-visible/);
    expect(styles).toMatch(/prefers-reduced-motion: reduce/);
  });

  it('gives critical review dialogs a semantic dialog role and accessible close controls', () => {
    expect(source).toMatch(/className="modal executive-inbox" role="dialog" aria-modal="true"/);
    expect(source).toMatch(/className="modal project-brain-modal" role="dialog" aria-modal="true"/);
    expect(source).toMatch(/aria-label=\{t\('Close inbox', 'Cerrar bandeja'\)\}/);
    expect(source).toMatch(/aria-label=\{t\('Close Project Brain', 'Cerrar Cerebro del Proyecto'\)\}/);
    expect(source).toMatch(/className="modal deployment-modal" role="dialog" aria-modal="true"/);
    expect(source).toMatch(/className="modal comparator-modal" role="dialog" aria-modal="true"/);
    expect(source).toMatch(/className="modal folder-picker" role="dialog" aria-modal="true"/);
    expect(source).toMatch(/className="modal" role="dialog" aria-modal="true" aria-labelledby="orbit-onboarding-title"/);
    expect(source).toMatch(/id="orbit-onboarding-error" className="run-notice" role="alert"/);
  });

  it('keeps keyboard focus inside critical dialogs and supports Escape to close', () => {
    expect(source).toContain('function useDialogFocus(onClose, enabled = true)');
    expect(source).toContain("if (event.key === 'Escape')");
    expect(source).toContain("if (event.key !== 'Tab') return;");
    expect(source).toMatch(/function ExecutiveInbox[\s\S]*?const dialogRef = useDialogFocus\(onClose\)/);
    expect(source).toMatch(/function ProjectBrainModal[\s\S]*?const dialogRef = useDialogFocus\(onClose\)/);
    expect(source).toMatch(/function DeploymentModal[\s\S]*?const dialogRef = useDialogFocus\(onClose\)/);
    expect(source).toMatch(/function RunMonitor[\s\S]*?const dialogRef = useDialogFocus\(onClose\)/);
    expect(source).toMatch(/function GlobalSearch[\s\S]*?const dialogRef = useDialogFocus\(onClose\)/);
    expect(source).toMatch(/function ProjectModal[\s\S]*?const dialogRef = useDialogFocus\(onClose\)/);
    expect(source).toMatch(/function ProjectPreviewModal[\s\S]*?const dialogRef = useDialogFocus\(onClose\)/);
    expect(source).toMatch(/function LogoGeneratorModal[\s\S]*?const dialogRef = useDialogFocus\(onClose\)/);
  });

  it('labels non-text task controls for assistive technology', () => {
    expect(source).toMatch(/aria-label=\{completed \? t\(`Mark \$\{title\} incomplete`/);
    expect(source).toMatch(/aria-pressed=\{completed\}/);
    expect(source).toMatch(/aria-label=\{t\(`Open details for \$\{title\}`/);
  });

  it('uses semantic, specifically labelled visual evidence controls', () => {
    expect(source).toMatch(/aria-expanded=\{Boolean\(expandedEvidence\[item\.id\]\)\}/);
    expect(source).toMatch(/aria-label=\{t\(`Open desktop screenshot for \$\{item\.projectName/);
    expect(source).toMatch(/aria-label=\{t\(`Open mobile screenshot for \$\{item\.projectName/);
  });

  it('binds locale-sensitive surfaces to React context and isolates Project Brain loads', () => {
    expect(source).toContain("const LocaleContext = createContext('en')");
    expect(source).toContain('<LocaleContext.Provider value={language}>');
    expect(source).toMatch(/brainProject && <ProjectBrainModal key=\{brainProject\.id\}/);
    expect(source).toMatch(/function ProjectBrainModal[\s\S]*?const memoryLoadRequest = useRef\(0\)/);
    expect(source).toMatch(/controller\.abort\(\); memoryLoadRequest\.current\+\+/);
  });

  it('keeps the added public-facing workflows bilingual', () => {
    expect(source).toContain("localeText('PARALLEL COMPARISON', 'COMPARACIÓN EN PARALELO')");
    expect(source).toContain("t('Turn an idea into a project agents can build', 'Convierte una idea en un proyecto que los agentes puedan construir')");
    expect(source).toContain("t('Select repository folder', 'Selecciona la carpeta del repositorio')");
    expect(source).toContain("localeText('SECURE SKILL HUB', 'CENTRO DE HABILIDADES SEGURO')");
    expect(source).toContain("localeText('CONTINUOUS CHAT & CONTROL PLANE', 'CHAT CONTINUO Y CONTROL PLANE')");
  });

  it('requires explicit, script-safe consent before preview dependency setup', () => {
    expect(source).toContain("body.reason === 'project_dependency_approval'");
    expect(source).toContain("const expectedEndpoint = `/api/projects/${project.id}/dependencies/prepare`");
    expect(source).toContain("body: JSON.stringify({ consent: true, hash: dependencySetup.hash, ...(allowScripts ? { allowScripts: true } : {}) })");
    expect(source).toContain("localeText('Approve safely & start preview', 'Aprobar de forma segura e iniciar vista previa')");
    expect(source).toContain("localeText('Allow install scripts & start', 'Permitir scripts e iniciar')");
    expect(source).toMatch(/dependencySetup\.plans\.map\([\s\S]*?<code>\{plan\.command\}<\/code>[\s\S]*?\{plan\.directory\}/);
  });
});

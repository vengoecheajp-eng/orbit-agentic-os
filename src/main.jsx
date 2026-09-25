import { Component, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowUpRight, Bell, Bot, Check, ChevronRight, CirclePlus, Command,
  LayoutDashboard, ListTodo, MoreHorizontal, Search, Settings, Sparkles,
  Target, TimerReset, X, FolderGit2, FolderOpen, RefreshCw, Send, Activity,
  Mic, MicOff, Eye, Monitor, Smartphone, Square, Lightbulb, Coins, Layers, Cpu, Rocket, Copy,
  Inbox, Brain, Camera, Terminal, ChevronDown, ChevronUp, CheckCircle2, AlertCircle, Clock, FileCode,
  Download, ExternalLink, Play, ShoppingCart, FlaskConical, PawPrint, Scissors, Plus,
  ShieldCheck, ShieldAlert, FileText, CheckCheck, Trash2
} from 'lucide-react';
import './styles.css';
import { modelAdvice } from '../model-policy.mjs';
import { workState, needsDecision, isWorking, workTitle, runTime, sortWork, recentProjects, filterWork } from './work-state.mjs';

const dictionaries = {
  en: {
    workspace: 'WORKSPACE', overview: 'Overview', projects: 'Projects', tasks: 'My tasks', agents: 'Agents', settings: 'Settings', foundry: 'Idea Foundry', skills: 'Skill Hub',
    greeting: 'Good day', allProjects: 'All projects', agentRuns: 'Agents & runs', todayFocus: 'Today\'s focus', newProject: 'New project',
    language: 'Language', localProfile: 'Local profile', profileHint: 'This profile only exists on this computer. Signing out clears it from Orbit, never from an external service.',
    saveProfile: 'Save profile', signOut: 'Sign out', createProfile: 'Create your local profile', name: 'Name', role: 'Role', workspaceName: 'Workspace name',
    tokensAndBalances: 'Tokens & Balances', installAgent: 'Setup Concierge',
    auditWarning: 'This skill stays local and never activates automatically. When selected, it can guide the agent only through that run’s existing sandbox and tools; it cannot override Orbit safety rules or credential protections.',
    blocked: 'Blocked by safety rules', pending: 'Pending review', approved: 'Approved', inspect: 'Inspect', delete: 'Delete', approve: 'Approve skill',
    approvedSkillOptional: 'Activate skill for this run (optional)', noSkill: 'No skill', skillSelectHelp: 'Codex and Claude receive the complete native skill package. Local and API models receive the same approved package as run context. Supporting files load with the skill; Orbit safety rules remain in force.',
    executionMode: 'EXECUTION MODE', modeDirect: 'Direct (Solo)', modeDirectDesc: 'A single model executes the task directly', modeParallel: 'Compare (Parallel)', modeParallelDesc: '2–3 models compete on the same prompt in isolated worktrees', modePipeline: 'Pipeline (Chain)', modePipelineDesc: 'Collaborative relay: Architect → Builder → Security Gatekeeper', plannerLabel: 'Architect / Planner', coderLabel: 'Engineer / Builder', pipelineStages: 'PIPELINE STAGES',
    compass: 'PRIORITY', priority: 'One priority needs your attention.', priorityBody: 'Choose the next project milestone and keep momentum moving.', nextStep: 'View next step',
    activeProjects: 'Active projects', closing: '1 in closing phase', portfolioProgress: 'Portfolio progress', monthChange: '+8% since last month', toResolve: 'To resolve', focus: '3 need focus this week', portfolio: 'PORTFOLIO', moving: 'In motion', viewAll: 'View all', nextSteps: 'NEXT STEPS', momentum: 'Keep the momentum', portfolioAgent: 'PORTFOLIO AGENT', aligned: 'Your team is aligned.', agentSummary: 'Review active tasks and pending decisions across your workspaces.', recommendations: 'Review recommendations', pendingTasks: 'PENDING', needsProgress: 'Everything that needs progress', whatIsProject: 'WHAT IS THIS PROJECT?', whereAreWe: 'WHERE ARE WE TODAY?', whatCompleted: 'What is already done:', whatPending: 'What is still pending:', nextStepRec: 'RECOMMENDED NEXT STEP', projectTasks: 'PROJECT TASKS', overallProgress: 'Overall progress', allDoneNotice: 'All scheduled tasks for this stage are complete. Preparing next phase.', progressLabel: 'PROGRESS', updatedToday: 'Updated today', newProjectTitle: 'NEW PROJECT', newProjectSubtitle: 'What do you want to launch into orbit?', projectNameLabel: 'Project name', projectNamePlaceholder: 'E.g. New initiative', createProjectBtn: 'Create project', backupTitle: 'LOCAL DATA BACKUP', backupSubtitle: 'Download an archive with all your projects, settings, and approved skills.', backupBtn: 'Download backup (.tar.gz)', agentControlPlane: 'LOCAL CONTROL PLANE', agentSubtitle: 'One queue for all your agents. Code runs in an isolated worktree.', newRun: 'NEW EXECUTION', delegateWork: 'Delegate work', projectLabel: 'Project', providerLabel: 'Provider', autoProvider: 'Automatic', parallelCompare: 'Compare models in parallel', select23Models: 'SELECT 2–3 MODELS', promptLabel: 'Prompt', sendToAgent: 'Send to agent', recentExecutions: 'Recent activity', connectionsTitle: 'CONNECTIONS', connectionsSubtitle: 'Link local repositories and GitHub', orbitHistory: 'ORBIT HISTORY', importedHistory: 'IMPORTED HISTORY', startStepBtn: 'Start this step with agent now', dictate: 'Dictate', listening: 'Listening…',
    collisionWarningTitle: 'COLLISION GUARD', collisionWarningHeading: 'Active Agent in Progress', collisionWarningDesc: 'Another agent is currently executing code on this project. Running an additional task simultaneously will operate in a separate isolated Git worktree branch, but could lead to merge conflicts if both modify overlapping files.', activeAgentCardTitle: 'CURRENTLY ACTIVE RUN', activeAgentPrompt: 'Active instruction:', activeAgentModifiedFiles: 'Modified files in worktree:', noModifiedFilesYet: 'No files modified yet or agent currently reading codebase.', proceedConcurrent: 'Proceed in Isolated Branch', cancelWait: 'Wait for Active Agent', concurrentBadge: 'Concurrent Run', mergeConflictTitle: 'Merge Conflict Detected', mergeConflictDesc: 'Cannot merge automatically into base branch because conflicting changes were detected.', mergeConflictAbort: 'Merge aborted safely. Main branch was not modified.', verifiedReady: 'Changes verified & ready for production', verifiedReadyDesc: 'Tests and builds passed successfully. You can merge into the main branch or request further changes below.', approveMergeBtn: '✓ Approve & Merge', discardBtn: 'Discard', confirmMergePrompt: 'Approve and merge these verified changes into the main branch?', confirmDiscardPrompt: 'Discard all changes from this task?', mergeSuccess: '✅ Changes merged successfully.', worktreeIsolatedBadge: 'Changes are isolated on branch {branch}. Your main branch is safe.'
  },
  es: {
    workspace: 'ESPACIO', overview: 'Resumen', projects: 'Proyectos', tasks: 'Mis tareas', agents: 'Agentes', settings: 'Ajustes', foundry: 'Idea Foundry', skills: 'Skill Hub',
    greeting: 'Buen día', allProjects: 'Todos los proyectos', agentRuns: 'Agentes y ejecuciones', todayFocus: 'Enfoque de hoy', newProject: 'Nuevo proyecto',
    language: 'Idioma', localProfile: 'Perfil local', profileHint: 'Este perfil solo existe en este equipo. Cerrar sesión lo borra de Orbit, nunca de un servicio externo.',
    saveProfile: 'Guardar perfil', signOut: 'Cerrar sesión', createProfile: 'Crear perfil local', name: 'Nombre', role: 'Rol', workspaceName: 'Nombre del espacio',
    tokensAndBalances: 'Tokens y Saldos', installAgent: 'Agente de Instalación',
    auditWarning: 'Esta habilidad permanece local y nunca se activa sola. Cuando la seleccionas, solo puede guiar al agente mediante el sandbox y las herramientas de esa ejecución; no puede anular las reglas de seguridad ni la protección de credenciales.',
    blocked: 'Bloqueado por seguridad', pending: 'Pendiente de revisión', approved: 'Aprobado', inspect: 'Inspeccionar', delete: 'Eliminar', approve: 'Aprobar habilidad',
    approvedSkillOptional: 'Activar habilidad para esta ejecución (opcional)', noSkill: 'Sin habilidad', skillSelectHelp: 'Codex y Claude reciben el paquete nativo completo. Los modelos locales y por API reciben el mismo paquete aprobado como contexto. Los archivos de apoyo acompañan la habilidad; las reglas de seguridad de Orbit siguen activas.',
    executionMode: 'MODO DE EJECUCIÓN', modeDirect: 'Directo (Solo)', modeDirectDesc: 'Un solo modelo ejecuta la tarea directamente', modeParallel: 'Comparar (Paralelo)', modeParallelDesc: '2–3 modelos compiten con la misma instrucción en ramas aisladas', modePipeline: 'Pipeline (Cadena)', modePipelineDesc: 'Relevo colaborativo: Arquitecto → Constructor → Auditor de Seguridad', plannerLabel: 'Arquitecto / Planificador', coderLabel: 'Desarrollador / Constructor', pipelineStages: 'ETAPAS DEL PIPELINE',
    compass: 'PRIORIDAD', priority: 'Una prioridad requiere tu atención.', priorityBody: 'Elige el próximo hito del proyecto y mantén el avance.', nextStep: 'Ver siguiente paso',
    activeProjects: 'Proyectos activos', closing: '1 en fase de cierre', portfolioProgress: 'Progreso del portafolio', monthChange: '+8% desde el mes pasado', toResolve: 'Por resolver', focus: '3 requieren foco esta semana', portfolio: 'PORTAFOLIO', moving: 'En marcha', viewAll: 'Ver todos', nextSteps: 'SIGUIENTES PASOS', momentum: 'Mantén el impulso', portfolioAgent: 'AGENTE DEL PORTAFOLIO', aligned: 'Tu equipo está alineado.', agentSummary: 'Revisa las tareas activas y decisiones pendientes en tus espacios.', recommendations: 'Ver recomendaciones', pendingTasks: 'PENDIENTES', needsProgress: 'Todo lo que necesita avance', whatIsProject: '¿QUÉ ES ESTE PROYECTO?', whereAreWe: '¿DÓNDE ESTAMOS HOY?', whatCompleted: 'Lo que ya está listo:', whatPending: 'Lo que aún está pendiente:', nextStepRec: 'SIGUIENTE PASO RECOMENDADO', projectTasks: 'TAREAS DEL PROYECTO', overallProgress: 'Progreso general', allDoneNotice: 'Todas las tareas programadas para esta etapa están completas.', progressLabel: 'PROGRESO', updatedToday: 'Actualizado hoy', newProjectTitle: 'NUEVO PROYECTO', newProjectSubtitle: '¿Qué iniciativa quieres poner en órbita?', projectNameLabel: 'Nombre del proyecto', projectNamePlaceholder: 'Ej. Nueva iniciativa', createProjectBtn: 'Crear proyecto', backupTitle: 'COPIA DE SEGURIDAD LOCAL', backupSubtitle: 'Descarga un archivo con todos tus proyectos, ajustes y habilidades.', backupBtn: 'Descargar copia (.tar.gz)', agentControlPlane: 'PLANO DE CONTROL LOCAL', agentSubtitle: 'Una cola para todos tus agentes. El código corre en worktrees aislados.', newRun: 'NUEVA EJECUCIÓN', delegateWork: 'Delegar trabajo', projectLabel: 'Proyecto', providerLabel: 'Proveedor', autoProvider: 'Automático', parallelCompare: 'Comparar modelos en paralelo', select23Models: 'SELECCIONA 2–3 MODELOS', promptLabel: 'Instrucción / Prompt', sendToAgent: 'Enviar al agente', recentExecutions: 'Actividad reciente', connectionsTitle: 'CONEXIONES', connectionsSubtitle: 'Vincula carpetas locales y repositorios de GitHub', orbitHistory: 'HISTORIAL DE ORBIT', importedHistory: 'HISTORIAL IMPORTADO', startStepBtn: 'Iniciar este paso con el agente', dictate: 'Dictar', listening: 'Escuchando…',
    collisionWarningTitle: 'PROTECCIÓN CONTRA CHOQUES', collisionWarningHeading: 'Agente Activo en Progreso', collisionWarningDesc: 'Otro agente está actualmente ejecutando código en este proyecto. Ejecutar otra tarea en paralelo operará en una rama aislada de Git (worktree), pero podría causar conflictos al fusionar si ambos modifican los mismos archivos.', activeAgentCardTitle: 'EJECUCIÓN ACTIVA ACTUALMENTE', activeAgentPrompt: 'Instrucción activa:', activeAgentModifiedFiles: 'Archivos modificados en el worktree:', noModifiedFilesYet: 'Aún no hay archivos modificados o el agente está inspeccionando el código.', proceedConcurrent: 'Continuar en Rama Aislada', cancelWait: 'Esperar al Agente Activo', concurrentBadge: 'Ejecución Concurrente', mergeConflictTitle: 'Conflicto de Fusión Detectado', mergeConflictDesc: 'No se puede fusionar automáticamente en la rama base porque se detectaron cambios en conflicto.', mergeConflictAbort: 'Fusión cancelada de forma segura. La rama principal no fue modificada.', verifiedReady: '✓ Cambios verificados y listos para producción', verifiedReadyDesc: 'Las pruebas y compilación pasaron con éxito. Puedes fusionar a la rama principal o continuar pidiendo ajustes abajo.', approveMergeBtn: '✓ Aprobar & Fusionar', discardBtn: 'Descartar', confirmMergePrompt: '¿Aprobar y fusionar estos cambios verificados en la rama principal del repositorio?', confirmDiscardPrompt: '¿Descartar todos los cambios de esta tarea?', mergeSuccess: '✅ Cambios fusionados con éxito.', worktreeIsolatedBadge: 'Los cambios están aislados en la rama {branch}. Tu rama principal está protegida.'
  }
};
const uiCopy = dictionaries.en;
Object.assign(dictionaries.en, {
  localWorkspace: 'Local workspace', themeLight: '☀ Light', themeDark: '◐ Dark', inbox: 'Inbox',
  searchProjects: 'Search projects and runs…', searchProjectsAria: 'Search projects and runs', searchNoMatches: 'No matching projects or runs.',
  commandHelp: '⌘1–5 navigate · ⌘N new project · Esc close', globalSearch: 'GLOBAL SEARCH · ⌘K', projectType: 'Project', runType: 'Run',
  closingPhase: 'in closing phase', tasksDoneAcross: 'tasks done across', allScheduledTasksComplete: 'All scheduled tasks complete', pendingThisWeek: 'pending this week',
  allTasksCompleted: 'All tasks completed', nextTaskEyebrow: 'NEXT TASK', startNextTask: 'Start with agent', startNextTaskQuestion: 'Start it with an agent now?', nextTaskStarted: 'Next task started. Follow it in Agents.', nextTaskError: 'Could not start the next task.', notNow: 'Not now', noTasksYet: 'No tasks yet', noTasksYetDetail: 'Open a project and add its first task, or let an agent suggest a plan.', allTasksCompletedDetail: 'All scheduled tasks for current milestones are complete.',
  allTasksResolved: 'All tasks resolved', allTasksResolvedDetail: 'Zero pending tasks across all your projects. Select a project to add new goals or milestones.',
  quickStarter: 'Or pick a quick starter:', ecommerce: 'E-Commerce', podcastAudio: 'Podcast / Audio', aiAgent: 'AI Agent', saasDashboard: 'SaaS Dashboard',
  onboardingEyebrow: 'WELCOME TO ORBIT', onboardingTitle: 'Set up your local workspace.', onboardingDetail: 'Orbit detected {count} available providers. Start by creating your local profile; then connect a repository from Agents.',
  onboardingName: 'Your name', onboardingNamePlaceholder: 'Name', onboardingSaving: 'Saving…', onboardingStart: 'Start Orbit', onboardingError: 'Could not create profile.',
  projectCreatedError: 'Could not create project.', profileFallback: 'there',
  brainEyebrow: 'PROJECT BRAIN', brainMemory: 'Memory', brainDescription: 'Permanent rules, architecture decisions, and context for every agent.', brainLoading: 'Loading project memory…', brainRescan: 'Re-Scan Stack', brainScanning: 'Scanning…', brainSave: 'Save Rules', brainSaving: 'Saving…', brainLoadError: 'Could not load Project Brain.', brainSaveError: 'Could not save Project Brain.', brainSaveSuccess: 'Project Brain rules saved. New agent runs will receive this context.', brainScanError: 'Could not re-scan the project stack.', brainScanSuccess: 'Technical stack and commands re-scanned successfully.',
    inboxTitle: 'Executive Review Inbox', inboxDescription: 'Approve verified work across every project from one place.', inboxWaiting: 'waiting', inboxReady: 'ready', inboxAttention: 'need attention', inboxClear: 'Inbox clear', inboxClearDetail: 'Zero items waiting. All autonomous runs are verified and merged.', inspectRun: 'Inspect', discardRun: 'Discard', discardingRun: 'Discarding…', approveMerge: 'Approve & Merge', merging: 'Merging…', completeTask: 'Complete task', moreTaskOptions: 'More options for {task}',
    skillHub: 'Skill Hub', repoConnected: 'Repo connected', noRepo: 'No repo', pendingCount: 'pending', nextLabel: 'Next:', clientPortal: 'Copy secure client portal link', clientInfraReady: 'Client infrastructure ready', askAgent: 'Ask the agent something…', noProviderReady: 'No model is connected yet. Open Settings to connect Codex, Claude, Ollama, or an API key.', livePreview: 'Live app preview', deploying: 'Deploying to Vercel…', deploy: 'Deploy to Vercel', live: 'Live:', optimizing: 'Optimizing locally…', optimize: 'Optimize prompt · save tokens', save: 'Save', tasksLabel: 'Tasks', deleteProject: 'Delete project', removeProject: 'Remove {project} from Orbit? Its repository will not be touched.', promptOptimized: 'Prompt optimized locally · estimated savings: ~{tokens} tokens.', clientLinkCopied: 'Secure client portal link copied. Creating a new link automatically revokes the previous one.', clientLinkError: 'Could not create the client portal link.', projectLive: 'Live project: {url}', errorPrefix: 'Error:', gitHistoryLoading: 'Loading Git and GitHub history…', gitHistoryEmpty: 'No importable history yet.', parallelComparison: 'Parallel comparison', modelsFinished: 'All models finished.', modelsWorking: 'Models are currently working…', working: 'Working…', completedNoSummary: 'Completed without summary.', changedFiles: 'Changed files', projectProfileDefaultRole: 'Administrator', projectProfileDefaultWorkspace: 'My workspace', projectWorkspace: 'Project workspace.', nextStepDescription: 'Advance on the next key milestone to keep project momentum.', agentStarted: 'Agent run started successfully for this step.', brain: 'Brain', createLogo: 'Create logo with AI', simulatingUsers: 'Simulating users…', simulateUsers: 'Simulate 3 Users (QA Swarm)', simulatedFeedback: 'Simulated user personas feedback', awaitingReview: 'awaiting review', noAgentWork: 'No delegated agent work yet in Orbit.', refreshStatus: 'Refresh status', stopDictation: 'Stop dictation', dictateTitle: 'Dictate with microphone', optimizeError: 'Could not optimize the prompt.', executionStartError: 'Could not start execution.', modelsParallel: '{count} models are working in parallel.', pipelineActive: 'Pipeline active: Architect → Coder → Completion Gate', orbitSelected: 'Orbit selected {provider}: {reason}', connected: 'Connected', connectionPending: 'Pending', localRepoPath: 'Local repository path (for agent runs)', browseFolders: 'Browse folders for {project}', githubRepository: 'github.com/organization/repository', checkGithub: 'Check GitHub', openPrs: '{count} open PRs', noExecutions: 'No executions yet.', startServerProviders: 'Start npm run server to detect providers.', editsRepos: 'edits repos', plans: 'plans', connectedOption: 'connected', noRepoOption: 'no repo', brandIdentity: 'Brand identity', aiLogoFor: 'AI logo for {project}', logoChooseStyle: 'Choose a style and generate your logo', logoMinimalist: 'Minimalist Tech', logoCorporate: 'Modern Corporate', logoGeometric: 'Geometric & Vibrant', logoGuide: 'Guide me', logoWrite: 'Write it myself', logoAudience: 'Who is this brand for?', logoAudiencePlaceholder: 'e.g. busy freelance designers', logoMission: "What's the core mission or value?", logoMissionPlaceholder: 'e.g. make invoicing painless', logoThinking: 'Thinking…', logoSuggest: 'Suggest a brand direction', logoBriefPlaceholder: "Paste the Brand Identity Designer skill's Stage 1–5 output here (symbol concept, typography, colors) to steer the logo.", logoDesigning: 'Designing…', logoGenerate: 'Generate logo', logoSafeSave: 'SVG is validated before rendering and saved as public/logo.svg in connected repositories.', previewStarting: 'Starting local server…', previewMobile: 'Mobile', previewDesktop: 'Desktop', previewCancel: 'Cancel', visualInspector: 'Visual Inspector', previewInspectorPlaceholder: 'Describe the element and change you want, e.g. make the header button green with rounded corners', applyChange: 'Apply change', previewSandbox: 'Starting application in a secure sandbox…', restartPreview: 'Restart preview', openNewTab: 'Open in new tab', stop: 'Stop', changeLanguage: 'Change language', toggleDarkMode: 'Toggle dark mode', readyForProjects: 'Ready for new projects', readyForProjectsDetail: 'All workspaces are currently up to date. Create a new initiative to begin.', activeMilestone: 'Active milestone', nextKeyMilestone: 'Next key milestone', pendingTasksForProject: '{count} pending {tasks} to advance {project}. Focus: {next}.', task: 'task', taskPlural: 'tasks', viewNextStep: 'View next step', milestoneOnTrack: 'Milestone on track', firstTaskTitle: '{project}: plan the first task', firstTaskDetail: 'This project has no tasks yet. Add one, or ask an agent to suggest a plan.', connectRepoDetail: 'Connect this project to its local Git folder, then add a first task for an agent.', projectCompleteDetail: 'All current tasks for {project} are completed ({progress}% overall progress). Next goal: {next}.', finalVerification: 'Final verification', openProject: 'Open project', agentRunsActive: '{count} agent {runs} active', run: 'run is', runs: 'runs are', activeRunsSummary: 'Currently executing changes across isolated worktrees. Check real-time logs in the Agent Console.', openAgentConsole: 'Open Agent Console', executionsWaiting: '{count} {execution} waiting', execution: 'execution', executions: 'executions', verifiedRunsSummary: '{count} {runs} verified and ready for executive review.', verifiedRun: 'run is', verifiedRuns: 'runs are', teamAligned: 'Team is aligned', pendingTaskSummary: '{count} {tasks} pending. Next item: "{task}" in {project}.', taskIs: 'task is', tasksAre: 'tasks are', viewProject: 'View {project}', systemsClear: 'All systems clear', clearSystemsSummary: 'Monitored {runs} recent executions across {repos} connected repository {hubs}. Zero unreviewed runs.', hub: 'hub', hubs: 'hubs',
  runTask: 'Run with agent', runTaskShort: 'Run', taskRunning: 'Running…', taskInReview: 'In review', taskCompleted: 'Completed', addTask: 'Add task', taskPlaceholder: 'Enter new task description…', suggestTasks: 'Suggest tasks with AI', suggestingTasks: 'Thinking…', taskAddedSuccess: 'Task added successfully.', taskStartedSuccess: 'Agent started for task "{title}". You can follow progress in Agents.', filterAll: 'All', filterPending: 'Pending', filterCompleted: 'Completed', allProjectsFilter: 'All projects',
  launchArmor: 'Pre-Launch Hardening & Client Advisory', launchArmorShort: 'Hardening & Advisory', launchAdvisorBtn: '🛡️ Pre-Launch Hardening & Client Advisory', launchReadinessScore: 'Launch Readiness Score', hardeningTab: '🛡️ Hardening & RLS', clientAdvisoryTab: '📋 Client Delivery Report', growthIdeasTab: '💡 Post-MVP Expansion Ideas', criticalSeverity: 'CRITICAL', highSeverity: 'HIGH', mediumSeverity: 'RECOMMENDED', armorWithAgent: 'Harden with Agent', addToProjectTasks: 'Add to Tasks', copyClientReport: 'Copy Client Report (Markdown)', reportCopied: 'Client report copied to clipboard!', advisorAnalyzing: 'Analyzing architecture, multi-tenancy, and security...'
});
Object.assign(dictionaries.es, {
  localWorkspace: 'Espacio local', themeLight: '☀ Claro', themeDark: '◐ Oscuro', inbox: 'Bandeja',
  searchProjects: 'Buscar proyectos y ejecuciones…', searchProjectsAria: 'Buscar proyectos y ejecuciones', searchNoMatches: 'No hay proyectos ni ejecuciones coincidentes.',
  commandHelp: '⌘1–5 navegar · ⌘N nuevo proyecto · Esc cerrar', globalSearch: 'BÚSQUEDA GLOBAL · ⌘K', projectType: 'Proyecto', runType: 'Ejecución',
  closingPhase: 'en fase de cierre', tasksDoneAcross: 'tareas completadas en', allScheduledTasksComplete: 'Todas las tareas programadas están completas', pendingThisWeek: 'pendientes esta semana',
  allTasksCompleted: 'Todas las tareas completadas', nextTaskEyebrow: 'SIGUIENTE TAREA', startNextTask: 'Iniciar con agente', startNextTaskQuestion: '¿Iniciarla ahora con un agente?', nextTaskStarted: 'Siguiente tarea iniciada. Síguela en Agentes.', nextTaskError: 'No se pudo iniciar la siguiente tarea.', notNow: 'Ahora no', noTasksYet: 'Aún no hay tareas', noTasksYetDetail: 'Abre un proyecto y añade su primera tarea, o deja que un agente sugiera un plan.', allTasksCompletedDetail: 'Todas las tareas de los hitos actuales están completas.',
  allTasksResolved: 'Todas las tareas resueltas', allTasksResolvedDetail: 'No hay tareas pendientes en tus proyectos. Selecciona un proyecto para añadir metas o hitos.',
  quickStarter: 'O elige una idea rápida:', ecommerce: 'Comercio electrónico', podcastAudio: 'Podcast / Audio', aiAgent: 'Agente de IA', saasDashboard: 'Panel SaaS',
  onboardingEyebrow: 'BIENVENIDO A ORBIT', onboardingTitle: 'Configura tu espacio de trabajo local.', onboardingDetail: 'Orbit detectó {count} proveedores disponibles. Crea tu perfil local y después conecta un repositorio desde Agentes.',
  onboardingName: 'Tu nombre', onboardingNamePlaceholder: 'Nombre', onboardingSaving: 'Guardando…', onboardingStart: 'Iniciar Orbit', onboardingError: 'No se pudo crear el perfil.',
  projectCreatedError: 'No se pudo crear el proyecto.', profileFallback: 'ahí',
  brainEyebrow: 'CEREBRO DEL PROYECTO', brainMemory: 'Memoria', brainDescription: 'Reglas permanentes, decisiones de arquitectura y contexto para cada agente.', brainLoading: 'Cargando memoria del proyecto…', brainRescan: 'Volver a analizar stack', brainScanning: 'Analizando…', brainSave: 'Guardar reglas', brainSaving: 'Guardando…', brainLoadError: 'No se pudo cargar el Cerebro del Proyecto.', brainSaveError: 'No se pudo guardar el Cerebro del Proyecto.', brainSaveSuccess: 'Reglas guardadas. Las nuevas ejecuciones recibirán este contexto.', brainScanError: 'No se pudo volver a analizar el stack del proyecto.', brainScanSuccess: 'Stack técnico y comandos analizados correctamente.',
    inboxTitle: 'Bandeja de revisión ejecutiva', inboxDescription: 'Aprueba trabajo verificado de todos los proyectos desde un solo lugar.', inboxWaiting: 'esperando', inboxReady: 'listos', inboxAttention: 'requieren atención', inboxClear: 'Bandeja vacía', inboxClearDetail: 'No hay elementos esperando. Todas las ejecuciones autónomas están verificadas y fusionadas.', inspectRun: 'Inspeccionar', discardRun: 'Descartar', discardingRun: 'Descartando…', approveMerge: 'Aprobar y fusionar', merging: 'Fusionando…', completeTask: 'Completar tarea', moreTaskOptions: 'Más opciones para {task}',
    skillHub: 'Centro de habilidades', repoConnected: 'Repositorio conectado', noRepo: 'Sin repositorio', pendingCount: 'pendientes', nextLabel: 'Siguiente:', clientPortal: 'Copiar enlace seguro para cliente', clientInfraReady: 'Infraestructura del cliente lista', noProviderReady: 'Aún no hay ningún modelo conectado. Abre Ajustes para conectar Codex, Claude, Ollama o una clave API.', askAgent: 'Pídele algo al agente…', livePreview: 'Vista previa en vivo', deploying: 'Publicando en Vercel…', deploy: 'Publicar en Vercel', live: 'En vivo:', optimizing: 'Optimizando localmente…', optimize: 'Optimizar instrucción · ahorrar tokens', save: 'Guardar', tasksLabel: 'Tareas', deleteProject: 'Eliminar proyecto', removeProject: '¿Eliminar {project} de Orbit? Su repositorio no se modificará.', promptOptimized: 'Instrucción optimizada localmente · ahorro estimado: ~{tokens} tokens.', clientLinkCopied: 'Enlace seguro para cliente copiado. Crear uno nuevo revoca automáticamente el anterior.', clientLinkError: 'No se pudo crear el enlace para cliente.', projectLive: 'Proyecto en vivo: {url}', errorPrefix: 'Error:', gitHistoryLoading: 'Cargando historial de Git y GitHub…', gitHistoryEmpty: 'Aún no hay historial importable.', parallelComparison: 'Comparación en paralelo', modelsFinished: 'Todos los modelos terminaron.', modelsWorking: 'Los modelos están trabajando…', working: 'Trabajando…', completedNoSummary: 'Terminado sin resumen.', changedFiles: 'Archivos modificados', projectProfileDefaultRole: 'Administrador', projectProfileDefaultWorkspace: 'Mi espacio de trabajo', projectWorkspace: 'Espacio de trabajo del proyecto.', nextStepDescription: 'Avanza en el siguiente hito clave para mantener el impulso del proyecto.', agentStarted: 'La ejecución del agente se inició correctamente para este paso.', brain: 'Cerebro', createLogo: 'Crear logo con IA', simulatingUsers: 'Simulando usuarios…', simulateUsers: 'Simular 3 usuarios (QA Swarm)', simulatedFeedback: 'Comentarios de usuarios simulados', awaitingReview: 'esperando revisión', noAgentWork: 'Aún no hay trabajo delegado a agentes en Orbit.', refreshStatus: 'Actualizar estado', stopDictation: 'Detener dictado', dictateTitle: 'Dictar con micrófono', optimizeError: 'No se pudo optimizar la instrucción.', executionStartError: 'No se pudo iniciar la ejecución.', modelsParallel: '{count} modelos están trabajando en paralelo.', pipelineActive: 'Pipeline activo: Arquitecto → Constructor → Puerta de finalización', orbitSelected: 'Orbit seleccionó {provider}: {reason}', connected: 'Conectado', connectionPending: 'Pendiente', localRepoPath: 'Ruta de repositorio local (para ejecuciones)', browseFolders: 'Buscar carpetas para {project}', githubRepository: 'github.com/organización/repositorio', checkGithub: 'Revisar GitHub', openPrs: '{count} PR abiertos', noExecutions: 'Aún no hay ejecuciones.', startServerProviders: 'Inicia npm run server para detectar proveedores.', editsRepos: 'edita repositorios', plans: 'planifica', connectedOption: 'conectado', noRepoOption: 'sin repositorio', brandIdentity: 'Identidad de marca', aiLogoFor: 'Logo con IA para {project}', logoChooseStyle: 'Elige un estilo y genera tu logo', logoMinimalist: 'Tech minimalista', logoCorporate: 'Corporativo moderno', logoGeometric: 'Geométrico y vibrante', logoGuide: 'Guíame', logoWrite: 'Lo escribiré yo', logoAudience: '¿Para quién es esta marca?', logoAudiencePlaceholder: 'ej. diseñadores freelance ocupados', logoMission: '¿Cuál es la misión o valor principal?', logoMissionPlaceholder: 'ej. hacer la facturación sencilla', logoThinking: 'Pensando…', logoSuggest: 'Sugerir una dirección de marca', logoBriefPlaceholder: 'Pega aquí la salida de las etapas 1–5 de Brand Identity Designer (símbolo, tipografía y colores) para orientar el logo.', logoDesigning: 'Diseñando…', logoGenerate: 'Generar logo', logoSafeSave: 'El SVG se valida antes de mostrarse y se guarda como public/logo.svg en repositorios conectados.', previewStarting: 'Iniciando servidor local…', previewMobile: 'Móvil', previewDesktop: 'Escritorio', previewCancel: 'Cancelar', visualInspector: 'Inspector visual', previewInspectorPlaceholder: 'Describe el elemento y cambio que quieres, ej. haz verde el botón del encabezado con esquinas redondeadas', applyChange: 'Aplicar cambio', previewSandbox: 'Iniciando la aplicación en un entorno aislado…', restartPreview: 'Reiniciar vista previa', openNewTab: 'Abrir en nueva pestaña', stop: 'Detener', changeLanguage: 'Cambiar idioma', toggleDarkMode: 'Cambiar modo oscuro', readyForProjects: 'Listo para nuevos proyectos', readyForProjectsDetail: 'Todos los espacios están al día. Crea una iniciativa para comenzar.', activeMilestone: 'Hito activo', nextKeyMilestone: 'Siguiente hito clave', pendingTasksForProject: '{count} {tasks} pendientes para avanzar {project}. Enfoque: {next}.', task: 'tarea', taskPlural: 'tareas', viewNextStep: 'Ver siguiente paso', milestoneOnTrack: 'Hito encaminado', firstTaskTitle: '{project}: planifica la primera tarea', firstTaskDetail: 'Este proyecto aún no tiene tareas. Añade una o pide a un agente que sugiera un plan.', connectRepoDetail: 'Conecta este proyecto a su carpeta Git local y luego añade una primera tarea para un agente.', projectCompleteDetail: 'Todas las tareas actuales de {project} están completas ({progress}% de progreso general). Próxima meta: {next}.', finalVerification: 'Verificación final', openProject: 'Abrir proyecto', agentRunsActive: '{count} {runs} activas', run: 'ejecución', runs: 'ejecuciones', activeRunsSummary: 'Actualmente se ejecutan cambios en worktrees aislados. Revisa los registros en tiempo real desde la consola de agentes.', openAgentConsole: 'Abrir consola de agentes', executionsWaiting: '{count} {execution} esperando', execution: 'ejecución', executions: 'ejecuciones', verifiedRunsSummary: '{count} {runs} verificados y listos para revisión ejecutiva.', verifiedRun: 'ejecución', verifiedRuns: 'ejecuciones', teamAligned: 'El equipo está alineado', pendingTaskSummary: '{count} {tasks} pendientes. Siguiente elemento: "{task}" en {project}.', taskIs: 'tarea', tasksAre: 'tareas', viewProject: 'Ver {project}', systemsClear: 'Todos los sistemas están en orden', clearSystemsSummary: 'Se monitorearon {runs} ejecuciones recientes en {repos} {hubs} de repositorio conectados. No hay ejecuciones sin revisar.', hub: 'centro', hubs: 'centros',
  runTask: 'Ejecutar con agente', runTaskShort: 'Ejecutar', taskRunning: 'En ejecución…', taskInReview: 'Por revisar', taskCompleted: 'Completada', addTask: 'Añadir tarea', taskPlaceholder: 'Escribe la descripción de la nueva tarea…', suggestTasks: 'Sugerir tareas con IA', suggestingTasks: 'Pensando…', taskAddedSuccess: 'Tarea añadida con éxito.', taskStartedSuccess: 'Agente iniciado para la tarea "{title}". Puedes seguir el avance en Agentes.', filterAll: 'Todas', filterPending: 'Pendientes', filterCompleted: 'Completadas', allProjectsFilter: 'Todos los proyectos',
  launchArmor: 'Blindaje Pre-Launch y Asesoría al Cliente', launchArmorShort: 'Blindaje y Asesoría', launchAdvisorBtn: '🛡️ Blindaje Pre-Launch & Asesoría al Cliente', launchReadinessScore: 'Puntuación de Preparación para Lanzamiento', hardeningTab: '🛡️ Blindaje Técnico & RLS', clientAdvisoryTab: '📋 Informe para el Cliente', growthIdeasTab: '💡 Horizontes de Expansión', criticalSeverity: 'CRÍTICO', highSeverity: 'ALTO', mediumSeverity: 'RECOMENDADO', armorWithAgent: 'Blindar con Agente', addToProjectTasks: 'Añadir a Tareas', copyClientReport: 'Copiar Informe para Cliente (Markdown)', reportCopied: '¡Informe para el cliente copiado al portapapeles!', advisorAnalyzing: 'Analizando arquitectura, multi-tenancy y seguridad...'
});
const conciergeCopy = {
  en: {
    eyebrow: 'SETUP CONCIERGE · GUIDED ONBOARDING', title: 'Welcome to Orbit',
    intro: 'Your private setup assistant. It runs locally on this machine to explain requirements, guide subscriptions, and help you activate AI models.',
    close: 'Close assistant', suggested: 'Suggested', ollamaActive: 'Ollama active', models: 'models',
    wakeTitle: 'Step 1: Wake up your free local agent', wakeBody: 'Download Ollama and the recommended model ({model}). No subscription or card required.',
    wakeButton: 'Wake local agent in one click', downloading: 'Downloading', catalogTitle: 'Suggested local-model catalogue (one-click download):', catalogBody: 'Optimised for local software development',
    assistant: 'Orbit Setup Concierge', you: 'You', typing: 'Writing a response…',
    codexQuestion: 'How do I configure ChatGPT / Codex?', claudeQuestion: 'How do I configure Claude Code and its subscription?', geminiQuestion: 'How do I get DeepSeek or Gemini?', localQuestion: 'I do not want to pay. Which local models do you recommend?',
    placeholder: 'Ask your Setup Concierge anything (for example: which model is right for me?)', send: 'Send',
    readyMessage: '🎉 Great! Your **{model}** model is ready on this machine. I can now help you configure the rest of your AI tools.',
    offlineError: 'Sorry, the local model could not be reached. You can review the setup cards in Settings above.',
    readyGreeting: 'Hello! 👋 I am your **Orbit Setup Concierge**. I am awake and running locally on your {device} with **{model}**, without consuming cloud APIs or credit.\n\nWhich tools would you like to configure today? Ask me about subscriptions, API keys, or staying completely local.',
    noModelGreeting: 'Hello! 👋 Welcome to Orbit. I detected **{platform}** with **{ram} GB RAM**.\n\nTo have a personal assistant without paying, click the button below to **wake your free local agent ({model})** and configure everything step by step.'
  },
  es: {
    eyebrow: 'ASISTENTE CONCIERGE · ONBOARDING GUIADO', title: 'Bienvenido a Orbit',
    intro: 'Tu asistente privado de configuración. Funciona localmente en esta máquina para explicar requisitos, guiar suscripciones y activar modelos de IA.',
    close: 'Cerrar asistente', suggested: 'Sugerido', ollamaActive: 'Ollama activo', models: 'modelos',
    wakeTitle: 'Paso 1: Despertar tu agente local gratuito', wakeBody: 'Descarga Ollama y el modelo recomendado ({model}). Sin suscripciones ni tarjeta.',
    wakeButton: 'Despertar agente local en un clic', downloading: 'Descargando', catalogTitle: 'Catálogo de modelos locales sugeridos (descarga en un clic):', catalogBody: 'Optimizados para desarrollo local de software',
    assistant: 'Agente Concierge Orbit', you: 'Tú', typing: 'Escribiendo respuesta…',
    codexQuestion: '¿Cómo configuro ChatGPT / Codex?', claudeQuestion: '¿Cómo configuro Claude Code y qué suscripción requiere?', geminiQuestion: '¿Cómo obtengo DeepSeek o Gemini?', localQuestion: 'No quiero pagar. ¿Qué modelos locales recomiendas?',
    placeholder: 'Pregúntale lo que quieras al Concierge (ej.: ¿qué modelo me conviene?)', send: 'Enviar',
    readyMessage: '🎉 ¡Excelente! Tu modelo **{model}** ya está listo en esta máquina. Ahora puedo ayudarte a configurar el resto de tus herramientas de IA.',
    offlineError: 'Lo siento, no pude consultar el modelo local. Puedes revisar las tarjetas de configuración en Ajustes.',
    readyGreeting: '¡Hola! 👋 Soy tu **Agente Concierge de Orbit**. Estoy despierto y ejecutándome localmente en tu {device} con **{model}**, sin consumir APIs ni saldo.\n\n¿Qué herramientas te gustaría configurar hoy? Pregúntame por suscripciones, claves API o cómo mantenerte completamente local.',
    noModelGreeting: '¡Hola! 👋 Bienvenido a Orbit. Detecté **{platform}** con **{ram} GB de RAM**.\n\nPara tener un asistente personal sin pagar, haz clic abajo para **despertar tu agente local gratuito ({model})** y configurar todo paso a paso.'
  }
};

function taskRunPrompt(taskTitle) {
  return `Work on this specific project task: ${taskTitle}. First inspect the relevant code and project context. Implement only what is needed, verify the result with relevant tests, and report the changed files and any remaining risks.`;
}
// Starts an agent run for one project task. Shared by task lists and the
// "continue with the next task" offer shown after a merge.
async function startTaskRun(projectId, taskTitle, taskIndex) {
  const response = await fetch('/api/runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, provider: 'auto', prompt: taskRunPrompt(taskTitle), taskIndex, taskTitle })
  });
  const body = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, body };
}
function localeText(english, spanish) {
  return typeof document !== 'undefined' && document.documentElement.lang === 'es' ? spanish : english;
}

function isEditableTarget(target) {
  const element = target instanceof HTMLElement ? target : target?.parentElement;
  return Boolean(element?.isContentEditable || element?.closest('input, textarea, select, [contenteditable="true"]'));
}

function useDialogFocus(onClose, enabled = true) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!enabled || !dialog) return undefined;
    const previousFocus = document.activeElement;
    const isTopmost = () => dialog.closest('.modal-backdrop') === [...document.querySelectorAll('.modal-backdrop')].at(-1);
    const focusable = () => [...dialog.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter(element => element.getClientRects().length && !element.closest('[hidden], [inert]'));
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.tabIndex = -1;
    const first = dialog.querySelector('[data-autofocus]') || focusable()[0] || dialog;
    if (isTopmost()) first.focus({ preventScroll: true });
    const onKeyDown = event => {
      if (!isTopmost() || event.isComposing) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onCloseRef.current?.(); return; }
      if (event.key !== 'Tab') return;
      const elements = focusable();
      if (!elements.length) { event.preventDefault(); return; }
      const firstElement = elements[0];
      const lastElement = elements.at(-1);
      if (!dialog.contains(document.activeElement) || document.activeElement === dialog) { event.preventDefault(); (event.shiftKey ? lastElement : firstElement).focus(); }
      else if (event.shiftKey && document.activeElement === firstElement) { event.preventDefault(); lastElement.focus(); }
      else if (!event.shiftKey && document.activeElement === lastElement) { event.preventDefault(); firstElement.focus(); }
    };
    const keepFocusInside = event => {
      if (isTopmost() && !dialog.contains(event.target)) (focusable()[0] || dialog).focus({ preventScroll: true });
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('focusin', keepFocusInside);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('focusin', keepFocusInside);
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  // Keep the dialog stable across background refreshes; re-focusing on every
  // parent render would pull a scrolled modal back to its close button.
  }, [enabled]);
  return dialogRef;
}

class ScreenBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <section className="panel screen-error" role="alert"><h2>{localeText('This screen could not load', 'No se pudo cargar esta pantalla')}</h2><p>{localeText('Retry this screen or use the navigation to continue.', 'Reintenta o usa la navegación para continuar.')}</p><button className="new-button" onClick={() => this.setState({ failed: false })}>{localeText('Try again', 'Reintentar')}</button></section>;
    return this.props.children;
  }
}

function App() {
  const [projects, setProjects] = useState([]);
  const [active, setActive] = useState('overview');
  const [selected, setSelected] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [providers, setProviders] = useState([]);
  const [connectedProjects, setConnectedProjects] = useState([]);
  const [runs, setRuns] = useState([]);
  const [profile, setProfile] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('orbit-theme') || 'light');
  const [language, setLanguage] = useState(() => localStorage.getItem('orbit-language') || 'en');
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [previewProject, setPreviewProject] = useState(null);
  const [logoProject, setLogoProject] = useState(null);
  const [inbox, setInbox] = useState({ count: 0, readyCount: 0, needsAttentionCount: 0, items: [] });
  const [showInbox, setShowInbox] = useState(false);
  const [brainProject, setBrainProject] = useState(null);
  const [advisorProject, setAdvisorProject] = useState(null);
  const [securityProject, setSecurityProject] = useState(null);
  const [inspectRunId, setInspectRunId] = useState(null);
  const [runMonitorId, setRunMonitorId] = useState(null);
  const [runMonitor, setRunMonitor] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [showGenesis, setShowGenesis] = useState(false);
  const [showCredits, setShowCredits] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAllAgents, setShowAllAgents] = useState(false);
  const [controlError, setControlError] = useState('');
  const [monitorError, setMonitorError] = useState('');
  const currentMonitorId = useRef(null);
  const refreshRequest = useRef(0);
  const newProjectRef = useDialogFocus(() => setShowNew(false), showNew);
  const closeGenesis = () => { setShowGenesis(false); localStorage.setItem('orbit-concierge-dismissed', 'true'); };
  const copy = dictionaries[language] || uiCopy;
  const today = new Date().toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();

  const loadControlPlane = async () => {
    const request = ++refreshRequest.current;
    try {
      const [health, projectResponse, runsResponse, profileResponse, inboxResponse] = await Promise.all([fetch('/api/health'), fetch('/api/projects'), fetch('/api/runs?view=activity'), fetch('/api/profile'), fetch('/api/inbox')]);
      if (![health, projectResponse, runsResponse, profileResponse, inboxResponse].every(response => response.ok)) throw new Error('Control plane unavailable');
      const [healthData, allProjects, runData, profileData, inboxData] = await Promise.all([health.json(), projectResponse.json(), runsResponse.json(), profileResponse.json(), inboxResponse.json()]);
      if (request !== refreshRequest.current) return;
      setProviders(healthData.providers || []);
      setProjects(allProjects);
      setConnectedProjects(allProjects);
      setRuns(runData);
      setProfile(profileData);
      setInbox(inboxData);
      setControlError('');
      setLoaded(true);
    } catch { if (request === refreshRequest.current) setControlError(localeText('Connection lost. Displaying the last available update.', 'Sin conexión. Se muestra la última actualización disponible.')); }
  };
  useEffect(() => {
    loadControlPlane();
    // Skip polling while the tab is hidden; refresh immediately when it returns.
    const interval = setInterval(() => { if (!document.hidden) loadControlPlane(); }, 5000);
    const onVisible = () => { if (!document.hidden) loadControlPlane(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVisible); };
  }, []);
  useEffect(() => { localStorage.setItem('orbit-language', language); document.documentElement.lang = language; }, [language]);
  useEffect(() => { localStorage.setItem('orbit-theme', theme); document.documentElement.dataset.theme = theme; }, [theme]);
  const openRunMonitor = runOrId => {
    const id = typeof runOrId === 'string' ? runOrId : runOrId?.id;
    if (!id) return;
    currentMonitorId.current = id;
    setMonitorError('');
    setRunMonitor(previous => previous?.id === id ? previous : null);
    setRunMonitorId(id);
  };
  const closeRunMonitor = () => { currentMonitorId.current = null; setRunMonitorId(null); setRunMonitor(null); setMonitorError(''); };
  useEffect(() => {
    if (!runMonitorId) return undefined;
    const controller = new AbortController();
    let busy = false;
    const poll = async () => {
      if (busy) return;
      busy = true;
      try {
        const response = await fetch(`/api/runs/${runMonitorId}`, { signal: controller.signal });
        if (!response.ok) throw new Error(localeText('Could not load this run.', 'No se pudo cargar esta ejecución.'));
        const next = await response.json();
        if (!controller.signal.aborted && currentMonitorId.current === runMonitorId) { setRunMonitor(next); setMonitorError(''); }
      } catch (error) { if (!controller.signal.aborted && currentMonitorId.current === runMonitorId) setMonitorError(error.message); }
      finally { busy = false; }
    };
    poll();
    const timer = setInterval(poll, 2000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [runMonitorId]);
  useEffect(() => {
    const onKey = event => {
      if (event.defaultPrevented || event.isComposing || event.altKey) return;
      const command = event.metaKey || event.ctrlKey;
      if (command && event.key.toLowerCase() === 'k') { event.preventDefault(); setShowSearch(true); return; }
      // Other navigation shortcuts do not change the page underneath an open dialog.
      if (document.querySelector('.modal-backdrop')) return;
      if (command && event.key === ',') { event.preventDefault(); setActive('settings'); return; }
      if (command && event.key.toLowerCase() === 'n') { event.preventDefault(); setShowNew(true); return; }
      if (isEditableTarget(event.target)) return;
      if (event.key === '?') { event.preventDefault(); setShowShortcuts(true); }
      if (command && /^[1-6]$/.test(event.key)) { event.preventDefault(); setActive(['overview','projects','agents','foundry','skills','settings'][Number(event.key)-1]); }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, []);

  const metrics = useMemo(() => {
    const total = projects.length || 0;
    const active = projects.filter(p => p.status !== 'Closing' && p.status !== 'Cierre').length;
    const closing = projects.filter(p => p.status === 'Closing' || p.status === 'Cierre').length;
    const taskCount = projects.reduce((n, p) => n + (p.tasks || []).length, 0);
    const completion = taskCount ? Math.round(projects.reduce((n, p) => n + (p.tasks || []).filter(t => t[2]).length, 0) / taskCount * 100) : 0;
    const pendingTasks = projects.reduce((n, p) => n + (p.tasks || []).filter(t => !t[2]).length, 0);
    const completedTasks = projects.reduce((n, p) => n + (p.tasks || []).filter(t => t[2]).length, 0);
    return {
      active,
      closingCount: closing,
      completion,
      taskCount,
      tasks: pendingTasks,
      completedTasks,
      total
    };
  }, [projects]);

  const interpolate = (template, values) => Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, String(value)), template);

  const orderedWork = sortWork(runs);
  const decisions = orderedWork.filter(needsDecision);
  const recentPortfolio = recentProjects(projects, runs);
  const compassPriority = useMemo(() => {
    const target = recentProjects(projects, runs).find(p => (p.tasks || []).some(t => !t[2])) || projects[0] || null;
    if (!target) {
      return {
        project: null,
        title: copy.readyForProjects,
        body: copy.readyForProjectsDetail,
        action: copy.newProject
      };
    }
    if (!(target.tasks || []).length) {
      return {
        project: target,
        title: interpolate(copy.firstTaskTitle, { project: target.name }),
        body: target.repoPath ? copy.firstTaskDetail : copy.connectRepoDetail,
        action: copy.openProject
      };
    }
    const pending = (target.tasks || []).filter(t => !t[2]).length;
    if (pending > 0) {
      return {
        project: target,
        title: `${target.name}: ${target.next || copy.activeMilestone}`,
        body: interpolate(copy.pendingTasksForProject, { count: pending, tasks: pending === 1 ? copy.task : copy.taskPlural, project: target.name, next: target.next || copy.nextKeyMilestone }),
        action: copy.viewNextStep
      };
    }
    return {
      project: target,
      title: `${target.name}: ${copy.milestoneOnTrack}`,
      body: interpolate(copy.projectCompleteDetail, { project: target.name, progress: target.progress ?? 0, next: target.next || copy.finalVerification }),
      action: copy.openProject
    };
  }, [projects, runs, copy]);



  const toggleTask = async (projectId, taskIndex) => {
    const project = projects.find(item => item.id === projectId);
    if (!project) return;
    const tasks = (project.tasks || []).map((task, index) => {
      if (index !== taskIndex) return task;
      if (Array.isArray(task)) return [task[0], task[1], !task[2], ...task.slice(3)];
      return { ...task, completed: !task.completed };
    });
    const completed = tasks.filter(t => t[2]).length;
    const progress = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;

    setProjects(current => current.map(item => item.id === projectId ? { ...item, tasks, progress } : item));
    try {
      await fetch(`/api/projects/${projectId}/tasks`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks, progress })
      });
    } catch (error) { setNotice(error.message || localeText('Could not suggest tasks.', 'No se pudieron sugerir tareas.')); }
  };

  const [agentPrefill, setAgentPrefill] = useState(null);

  const handleRunTask = (projectOrTitle, taskOrPrompt, taskIndexOrProject, maybePrompt) => {
    let project, taskTitle, prompt, taskIndex;
    if (typeof projectOrTitle === 'object' && projectOrTitle?.id) {
      project = projectOrTitle;
      taskTitle = Array.isArray(taskOrPrompt) ? taskOrPrompt[0] : (typeof taskOrPrompt === 'string' ? taskOrPrompt : taskOrPrompt?.title);
      taskIndex = typeof taskIndexOrProject === 'number' ? taskIndexOrProject : undefined;
      prompt = maybePrompt || `Work on this specific project task: ${taskTitle}. First inspect the relevant code and project context. Implement only what is needed, verify the result with relevant tests, and report the changed files and any remaining risks.`;
    } else {
      taskTitle = projectOrTitle;
      prompt = taskOrPrompt;
      project = taskIndexOrProject;
    }
    if (!project) return;
    setSelected(null);
    setAdvisorProject(null);
    setAgentPrefill({
      projectId: project.id,
      prompt: prompt || `Work on this specific project task: ${taskTitle}`,
      taskTitle,
      taskIndex,
      provider: 'auto',
      model: 'auto'
    });
    setActive('agents');
  };

  const createProject = async (event) => {
    event.preventDefault();
    const name = projectName.trim();
    if (!name) return;
    try {
      const response = await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
      if (!response.ok) { const body = await response.json(); alert(body.error || copy.projectCreatedError); return; }
      setProjectName(''); setShowNew(false); loadControlPlane();
    } catch { alert(copy.projectCreatedError); }
  };

  const upcoming = recentPortfolio.flatMap(project => (project.tasks || []).map((task, index) => ({ project, task, index })))
    .filter(({task}) => !task[2]).slice(0, 5);
  const pageLinks = [ ['overview', copy.overview], ['projects', copy.projects], ['agents', copy.agents], ['foundry', copy.foundry], ['skills', copy.skillHub], ['settings', copy.settings] ];
  const attentionRuns = runs.filter(run => ['awaiting_input', 'awaiting_review', 'failed', 'needs_model', 'repairing'].includes(run.status));

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark" style={{ overflow: 'hidden', padding: 0 }}><img src="/orbit-logo.png" alt="Orbit logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div><span>orbit</span></div>
      <button className="workspace-switcher" onClick={() => setActive('settings')}><div className="workspace-orb">{profile?.initials || 'O'}</div><div><small>{copy.workspace}</small><strong>{profile?.workspace || copy.localWorkspace}</strong></div><ChevronRight size={15}/></button>
      <nav>
        <button className={active === 'overview' ? 'nav-item active' : 'nav-item'} onClick={() => setActive('overview')}><LayoutDashboard size={18}/>{copy.overview}</button>
        <button className={active === 'projects' ? 'nav-item active' : 'nav-item'} onClick={() => setActive('projects')}><Target size={18}/>{copy.projects} <span>{projects.length}</span></button>
        <button className={active === 'agents' ? 'nav-item active' : 'nav-item'} onClick={() => setActive('agents')}><Bot size={18}/>{copy.agents}</button>
        <button className={active === 'foundry' ? 'nav-item active' : 'nav-item'} onClick={() => setActive('foundry')}><Lightbulb size={18}/>{copy.foundry}</button>
        <button className={active === 'skills' ? 'nav-item active' : 'nav-item'} onClick={() => setActive('skills')}><Sparkles size={18}/>{copy.skillHub}</button>
      </nav>
      <div className="sidebar-bottom"><button className={active === 'settings' ? 'nav-item active' : 'nav-item'} onClick={() => setActive('settings')}><Settings size={18}/>{copy.settings}</button><button className="profile" onClick={() => setActive('settings')}><div className="avatar">{profile?.initials || 'O'}</div><div><strong>{profile?.name || copy.createProfile}</strong><small>{profile?.role || copy.localWorkspace}</small></div><MoreHorizontal size={18}/></button></div>
    </aside>

    <main>
      <header><div><p className="eyebrow">{today}</p><h1>{active === 'overview' ? `${copy.greeting}, ${profile?.name?.trim().split(/\s+/)[0]?.replace(/[’']s$/i, '') || copy.profileFallback}.` : pageLinks.find(([id]) => id === active)?.[1]}</h1></div>
        <div className="header-actions">
          <button className="language-switcher" type="button" aria-label={copy.changeLanguage} onClick={() => setLanguage(current => current === 'en' ? 'es' : 'en')}>{language === 'en' ? 'ES' : 'EN'}</button>
          <button className="theme-switcher" aria-label={copy.toggleDarkMode} onClick={() => setTheme(current => current === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? copy.themeLight : copy.themeDark}</button>
          <button className={`inbox-trigger ${(inbox.readyCount || 0) + (inbox.needsAttentionCount || 0) > 0 ? 'has-items' : ''}`} type="button" onClick={() => setShowInbox(true)}><Inbox size={16}/><span>{copy.inbox}</span>{inbox.count > 0 && <b>{inbox.count}</b>}</button>
          <button className="icon-button" onClick={() => setShowSearch(true)} aria-label={copy.searchProjectsAria} title="Search · ⌘/Ctrl K"><Search size={19}/></button>
          <button className="icon-button" onClick={() => setShowShortcuts(true)} aria-label={localeText('Keyboard shortcuts', 'Atajos de teclado')} title={localeText('Keyboard shortcuts · ?', 'Atajos de teclado · ?')}><Command size={18}/></button>
          <button className="icon-button notification" onClick={() => setShowNotifications(true)} aria-label={localeText('Notifications', 'Notificaciones')} title={localeText('Notifications', 'Notificaciones')}><Bell size={19}/>{attentionRuns.length > 0 && <i/>}</button>
          <button className="new-button" onClick={() => setShowNew(true)} aria-label={copy.newProject}><CirclePlus size={18}/>{copy.newProject}</button>
        </div>
      </header>
      <nav className="compact-navigation" aria-label={localeText('Page navigation', 'Navegación')}>
        {pageLinks.map(([id, label]) => <button key={id} className={active === id ? 'active' : ''} aria-current={active === id ? 'page' : undefined} onClick={() => setActive(id)}>{label}</button>)}
      </nav>
      {controlError && <div className="run-notice" role="status">{controlError} <button className="text-button" onClick={loadControlPlane}>{localeText('Retry', 'Reintentar')}</button></div>}
      <ScreenBoundary key={active}>

      {active === 'overview' && <>
        {decisions.length ? <section className="priority-bar attention-priority"><div className="priority-bar-label"><AlertCircle size={16}/>{localeText('NEEDS YOU', 'NECESITA TU ATENCIÓN')}</div><div className="priority-bar-body"><strong>{decisions[0].projectName}: {workTitle(decisions[0])}</strong><span>{workLabel(decisions[0])}</span></div><button className="text-button" onClick={() => openRunMonitor(decisions[0])}>{workAction(decisions[0])} <ArrowUpRight size={16}/></button></section> : <section className="priority-bar"><div className="priority-bar-label"><Target size={14}/>{localeText('NEXT TASK', 'SIGUIENTE TAREA')}</div><div className="priority-bar-body"><strong>{compassPriority.title}</strong><span>{localeText('Suggested from recently active projects—not a deadline ranking.', 'Sugerido según actividad reciente; no según fechas límite.')}</span></div><button className="text-button" aria-label={compassPriority.project ? compassPriority.action : localeText("Create your first project", "Crea tu primer proyecto")} onClick={() => compassPriority.project ? setSelected(compassPriority.project) : setShowNew(true)}>{compassPriority.action} <ArrowUpRight size={16}/></button></section>}
        <WorkSummary runs={runs} onOpen={openRunMonitor}/>
        {decisions.length > 0 && <section className="panel overview-decisions"><div className="panel-title"><h2>{localeText('Waiting for your decision', 'Esperando tu decisión')}</h2><button className="text-button" onClick={() => setActive('agents')}>{localeText('View all activity', 'Ver toda la actividad')} ({decisions.length})</button></div>{decisions.slice(0, 3).map(run => <WorkRow key={run.id} run={run} onOpen={openRunMonitor}/>)}</section>}
        <section className="metric-grid"><Metric icon={<Target/>} label={copy.activeProjects} value={metrics.active} detail={localeText('Projects in your workspace', 'Proyectos en tu espacio')}/><Metric icon={<TimerReset/>} label={localeText('Task completion', 'Tareas completadas')} value={metrics.taskCount ? metrics.completion + '%' : '—'} detail={localeText(metrics.completedTasks + ' of ' + metrics.taskCount + ' tasks · not launch readiness', metrics.completedTasks + ' de ' + metrics.taskCount + ' tareas · no indica preparación para lanzamiento')}/><Metric icon={<ListTodo/>} label={localeText('Unfinished tasks', 'Tareas pendientes')} value={metrics.tasks} detail={localeText('Across all projects · all dates', 'En todos los proyectos · todas las fechas')}/></section>
        <section className="section-heading"><div><p className="eyebrow">{copy.portfolio}</p><h2>{localeText('Recently active projects', 'Proyectos con actividad reciente')}</h2></div><button className="text-button" onClick={() => setActive('projects')}>{copy.viewAll} <ChevronRight size={16}/></button></section>
        <section className="project-grid">{recentPortfolio.slice(0,3).map(project => <ProjectCard key={project.id} project={project} copy={copy} onSelect={setSelected}/>)}</section>
        <section className="overview-next"><div className="panel"><div className="panel-title"><div><p className="eyebrow">{copy.nextSteps}</p><h2>{copy.momentum}</h2></div><button className="icon-button" onClick={() => setActive('projects')} aria-label={localeText('Open project task workspaces', 'Abrir espacios de tareas de proyectos')}><MoreHorizontal size={18}/></button></div>{upcoming.length ? upcoming.map(({project, task, index}) => <TaskRow key={`${project.id}-${index}`} task={task} project={project} index={index} runs={runs} onRunTask={handleRunTask} onInspectRun={openRunMonitor} onToggle={() => toggleTask(project.id,index)}/>) : <div className="inbox-empty" style={{ minHeight: 180, margin: '6px 0', padding: 20 }}><div style={{ width: 38, height: 38, fontSize: 18 }}>✓</div><h3 style={{ margin: '8px 0 2px', fontSize: 13 }}>{copy.allTasksCompleted}</h3><p style={{ fontSize: 11 }}>{copy.allTasksCompletedDetail}</p></div>}</div></section>
      </>}
      {active === 'projects' && <ProjectsPage projects={projects} runs={runs} copy={copy} onOpenProject={setSelected}/>}
      {active === 'agents' && <AgentConsole projects={connectedProjects} providers={providers} runs={runs} copy={copy} refresh={loadControlPlane} initialRunId={inspectRunId} onInitialRunHandled={() => setInspectRunId(null)} initialConfig={agentPrefill} onPrefillHandled={() => setAgentPrefill(null)}/>}
      {active === 'foundry' && <IdeaFoundry copy={copy} providers={providers} onCreated={loadControlPlane} onNavigate={setActive}/>}
      {active === 'skills' && <SkillHub copy={copy}/>}
      {active === 'settings' && <><LocalProfile profile={profile} onChange={setProfile} copy={copy}/><div className="panel backup-panel" style={{ marginTop: 16 }}><p className="eyebrow">{copy.backupTitle}</p><h2>{copy.backupTitle}</h2><p className="settings-copy">{copy.backupSubtitle}</p><a href="/api/backup" className="new-button" style={{ display: 'inline-flex', textDecoration: 'none', width: 'fit-content', marginTop: 10 }}>{copy.backupBtn}</a></div><div className="panel backup-panel" style={{ marginTop: 16 }}><p className="eyebrow">{copy.tokensAndBalances}</p><h2>{copy.tokensAndBalances}</h2><p className="settings-copy">{language === 'es' ? 'Uso y saldos estimados por proveedor.' : 'Usage and estimated balances per provider.'}</p><button type="button" className="new-button" style={{ width: 'fit-content', marginTop: 10 }} onClick={() => setShowCredits(true)}>{copy.tokensAndBalances}</button></div><SettingsPanel projects={connectedProjects} providers={providers} refresh={loadControlPlane} onOpenGenesis={() => { localStorage.removeItem('orbit-concierge-dismissed'); setShowGenesis(true); }} language={language}/></>}
      </ScreenBoundary>
    </main>
    {selected && <ProjectModal project={projects.find(p => p.id === selected.id) || selected} runs={runs} copy={copy} onPreview={setPreviewProject} onLogo={setLogoProject} onBrain={setBrainProject} onAdvisor={setAdvisorProject} onSecurity={setSecurityProject} onClose={() => setSelected(null)} onToggle={toggleTask} onRunTask={handleRunTask} onInspectRun={openRunMonitor} onRefresh={loadControlPlane}/>}
    {previewProject && <ProjectPreviewModal project={previewProject} copy={copy} onClose={() => setPreviewProject(null)}/>}
    {logoProject && <LogoGeneratorModal project={logoProject} copy={copy} onClose={() => setLogoProject(null)}/>}
    {advisorProject && <LaunchAdvisorModal project={advisorProject} copy={copy} onClose={() => setAdvisorProject(null)} onRunTask={handleRunTask} onRefresh={loadControlPlane}/>}
    {securityProject && <SecurityCenterModal project={securityProject} copy={copy} onClose={() => setSecurityProject(null)} onAdvisor={project => { setSecurityProject(null); setAdvisorProject(project); }} onRunTask={handleRunTask} onRefresh={loadControlPlane}/>}
    {showNew && <div className="modal-backdrop"><form ref={newProjectRef} className="modal new-modal" aria-label={copy.newProjectTitle} onSubmit={createProject}><button type="button" className="close" onClick={() => setShowNew(false)}><X size={18}/></button><p className="eyebrow">{copy.newProjectTitle}</p><h2>{copy.newProjectSubtitle}</h2><label>{copy.projectNameLabel}<input autoFocus data-autofocus value={projectName} onChange={e => setProjectName(e.target.value)} placeholder={copy.projectNamePlaceholder}/></label><div className="blueprint-chips"><small>{copy.quickStarter}</small><div><button type="button" onClick={() => setProjectName('PulsePay E-Commerce')}><ShoppingCart size={14}/> {copy.ecommerce}</button><button type="button" onClick={() => setProjectName('OmniVoice Audio')}><Mic size={14}/> {copy.podcastAudio}</button><button type="button" onClick={() => setProjectName('Aegis AI Assistant')}><Bot size={14}/> {copy.aiAgent}</button><button type="button" onClick={() => setProjectName('MetricFlow SaaS')}><LayoutDashboard size={14}/> {copy.saasDashboard}</button></div></div><button className="new-button" type="submit" style={{ marginTop: 14 }}>{copy.createProjectBtn} <ArrowUpRight size={17}/></button></form></div>}
    {showInbox && <ExecutiveInbox
      inbox={inbox}
      projects={projects}
      copy={copy}
      onClose={() => setShowInbox(false)}
      onRefresh={loadControlPlane}
      onRunTask={handleRunTask}
      onInspect={item => { setShowInbox(false); setSelected(null); setActive('agents'); setInspectRunId(item.id); }}
    />}
    {brainProject && <ProjectBrainModal project={brainProject} copy={copy} onClose={() => setBrainProject(null)}/>}
    {showGenesis && <GenesisOnboardingModal language={language} onClose={() => { closeGenesis(); loadControlPlane(); }} refresh={loadControlPlane}/>}
    {showCredits && <CreditsUsageModal language={language} onClose={() => setShowCredits(false)} onOpenSettings={() => { setShowCredits(false); setActive('settings'); }} />}
    <GlobalAgentDock runs={runs} onOpen={openRunMonitor} onShowAll={() => setShowAllAgents(true)}/>
    {runMonitor && (
      <RunMonitor key={runMonitor.id} run={runMonitor} providers={providers} copy={copy} onOpenRun={openRunMonitor} onClose={closeRunMonitor}/>
    )}
    {runMonitorId && !runMonitor && <RunLoadingModal error={monitorError} onClose={closeRunMonitor}/>}
    {showNotifications && <RunListModal title={localeText('Notifications', 'Notificaciones')} runs={attentionRuns} onClose={() => setShowNotifications(false)} onOpen={run => { setShowNotifications(false); openRunMonitor(run); }}/>}
    {showAllAgents && <RunListModal title={localeText('Active agents', 'Agentes activos')} runs={runs.filter(run => ['queued', 'running', 'awaiting_input', 'repairing'].includes(run.status))} onClose={() => setShowAllAgents(false)} onOpen={run => { setShowAllAgents(false); openRunMonitor(run); }}/>}
    {showShortcuts && <ShortcutHelp onClose={() => setShowShortcuts(false)} pages={pageLinks}/>}
    {showSearch && <GlobalSearch projects={projects} runs={runs} copy={copy} query={searchQuery} setQuery={setSearchQuery} onClose={() => setShowSearch(false)} onProject={project => { setSelected(project); setShowSearch(false); }} onRun={run => { setShowSearch(false); openRunMonitor(run); }} actions={[...pageLinks.map(([id, label]) => ({ id, label, execute: () => setActive(id) })), { id: 'new', label: copy.newProject, execute: () => setShowNew(true) }, { id: 'inbox', label: copy.inbox, execute: () => setShowInbox(true) }]}/>}
    {loaded && !profile && <Onboarding providers={providers} copy={copy} onComplete={profile => { setProfile(profile); setActive('agents'); }}/>}
  </div>;
}

function workLabel(run) {
  const labels = {
    reply: ['Waiting for you', 'Espera tu respuesta'], failed: ['Failed', 'Falló'],
    attention: ['Needs attention', 'Necesita atención'], review: ['Review required', 'Revisión pendiente'],
    ready: ['Ready for review', 'Listo para revisar'], running: ['Running', 'Trabajando'],
    repairing: ['Repairing', 'Reparando'], queued: ['Queued', 'En cola'], completed: ['Completed', 'Terminado']
  };
  if (run.status === 'merged') return localeText('Merged', 'Integrado');
  if (run.status === 'cancelled') return localeText('Cancelled', 'Cancelado');
  if (run.status === 'discarded') return localeText('Discarded', 'Descartado');
  return localeText(...labels[workState(run)]);
}

function workAction(run) {
  const state = workState(run);
  if (state === 'reply') return localeText('Reply', 'Responder');
  if (state === 'failed') return localeText('Review error', 'Revisar error');
  if (['ready', 'review', 'attention'].includes(state)) return localeText('Review', 'Revisar');
  return localeText('Open', 'Abrir');
}

function WorkRow({ run, onOpen }) {
  return <button type="button" className={`work-row state-${workState(run)}`} onClick={() => onOpen(run)}>
    <span className="work-row-body"><span className="work-row-meta">{run.projectName} · {providerName(run.provider)} · {run.model || localeText('Model not recorded', 'Modelo no registrado')}</span>
      <strong>{workTitle(run)}</strong><span className="work-row-meta"><span className="work-state">{workLabel(run)}</span> · {runTime(run) ? formatLastUpdated(new Date(runTime(run)).toISOString()) : localeText('Update time unknown', 'Sin fecha de actualización')}</span></span>
    <span className="work-row-action">{workAction(run)} <ChevronRight size={14}/></span>
  </button>;
}

function WorkSummary({ runs, onOpen }) {
  const groups = [
    [localeText('Needs your reply', 'Espera tu respuesta'), runs.filter(run => workState(run) === 'reply')],
    [localeText('Needs review', 'Necesita revisión'), runs.filter(run => needsDecision(run) && workState(run) !== 'reply')],
    [localeText('Running', 'Trabajando'), runs.filter(isWorking)],
    [localeText('Queued', 'En cola'), runs.filter(run => workState(run) === 'queued')]
  ];
  return <div className="work-summary" aria-label={localeText('Work status', 'Estado del trabajo')}>{groups.map(([label, items]) => <button key={label} type="button" disabled={!items.length} onClick={() => onOpen(sortWork(items)[0])}><strong>{items.length}</strong><span>{label}</span></button>)}</div>;
}

function WorkActivity({ runs, projects, onOpen, onClear, clearing }) {
  const [filter, setFilter] = useState('all');
  const [projectId, setProjectId] = useState('');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(12);
  const filtered = filterWork(runs, { filter, projectId, query });
  useEffect(() => { setLimit(12); }, [filter, projectId, query]);
  const filters = [['all', localeText('All', 'Todo')], ['needs', localeText('Needs you', 'Necesita tu atención')], ['running', localeText('Running', 'Trabajando')], ['queued', localeText('Queued', 'En cola')], ['ready', localeText('Ready for review', 'Listo para revisar')], ['completed', localeText('Completed', 'Terminado')]];
  const projectOptions = [...new Map([...projects, ...runs.map(run => ({ id: run.projectId, name: run.projectName }))].map(project => [project.id, project])).values()];
  return <section className="panel work-activity" aria-label={localeText('Agent activity', 'Actividad de agentes')}>
    <div className="panel-title"><div><p className="eyebrow">{localeText('WORK & DECISIONS', 'TRABAJO Y DECISIONES')}</p><h2>{localeText('Agent activity', 'Actividad de agentes')}</h2></div>{onClear && runs.some(run => ['completed', 'failed', 'cancelled', 'discarded', 'merged'].includes(run.status)) && <button className="text-button agent-history-clear" onClick={onClear} disabled={clearing}>{clearing ? localeText('Clearing…', 'Limpiando…') : localeText('Clear history', 'Limpiar historial')}</button>}</div>
    <div className="activity-filters" aria-label={localeText('Filter activity', 'Filtrar actividad')}>{filters.map(([id, label]) => <button type="button" key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label} <small>{filterWork(runs, { filter: id }).length}</small></button>)}</div>
    <div className="activity-search"><label>{localeText('Search activity', 'Buscar actividad')}<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={localeText('Task, model, or project…', 'Tarea, modelo o proyecto…')}/></label><label>{localeText('Filter by project', 'Filtrar por proyecto')}<select value={projectId} onChange={event => setProjectId(event.target.value)}><option value="">{localeText('All projects', 'Todos los proyectos')}</option>{projectOptions.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label></div>
    <p className="activity-count" role="status">{filtered.length} {localeText('matching runs · decisions first, then latest updates', 'ejecuciones · decisiones primero, luego actualizaciones recientes')}</p>
    {filtered.slice(0, limit).map(run => <WorkRow key={run.id} run={run} onOpen={onOpen}/>)}
    {!filtered.length && <p className="empty-copy">{runs.length ? localeText('No runs match these filters.', 'Ninguna ejecución coincide con estos filtros.') : localeText('No work yet. Start your first task here.', 'Aún no hay trabajo. Inicia tu primera tarea aquí.')}</p>}
    {filtered.length > limit && <button type="button" className="text-button activity-more" onClick={() => setLimit(current => current + 12)}>{localeText('Show more', 'Mostrar más')} ({filtered.length - limit})</button>}
  </section>;
}

function GlobalAgentDock({ runs, onOpen, onShowAll }) {
  const liveRuns = sortWork((runs || []).filter(run => ['queued', 'running', 'awaiting_input', 'repairing'].includes(run.status)));
  const replyCount = liveRuns.filter(run => workState(run) === 'reply').length;
  const runningCount = liveRuns.filter(isWorking).length;
  const queuedCount = liveRuns.filter(run => workState(run) === 'queued').length;
  if (!liveRuns.length) return null;
  const isEs = typeof document !== 'undefined' && document.documentElement.lang === 'es';
  return <aside className="global-agent-dock" aria-label={isEs ? 'Agentes activos' : 'Active agents'}>
    <div className="global-agent-dock-title">{runningCount > 0 && <span className="pulse-dot"/>}<strong>{[replyCount && localeText(replyCount + " waiting for you", replyCount + " esperando tu respuesta"), runningCount && localeText(runningCount + " running", runningCount + " trabajando"), queuedCount && localeText(queuedCount + " queued", queuedCount + " en cola")].filter(Boolean).join(" · ")}</strong></div>
    <div className="global-agent-dock-runs">
      {liveRuns.slice(0, 3).map(run => <button type="button" className="global-agent-run" key={run.id} onClick={() => onOpen(run)}>
        <span className={`run-status ${run.status}`}/>
        <span><strong>{run.projectName}</strong><small>{providerName(run.provider)} · {workLabel(run)} · {workAction(run)}</small></span>
        <Activity size={14}/>
      </button>)}
      {liveRuns.length > 3 && <button type="button" className="global-agent-more" onClick={onShowAll}>{localeText('View all', 'Ver todos')} (+{liveRuns.length - 3})</button>}
    </div>
  </aside>;
}

function Onboarding({ providers, copy, onComplete }) { const [name,setName]=useState(''),[saving,setSaving]=useState(false),[error,setError]=useState(''); const available=providers.filter(provider=>provider.available).length; const save=async event=>{event.preventDefault();setSaving(true);const r=await fetch('/api/profile',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,role:'Administrator',workspace:'My workspace'})});const d=await r.json();setSaving(false);if(r.ok)onComplete(d);else setError(d.error||copy.onboardingError)}; return <div className="modal-backdrop onboarding"><section className="modal"><p className="eyebrow">{copy.onboardingEyebrow}</p><h2>{copy.onboardingTitle}</h2><p className="empty-copy">{copy.onboardingDetail.replace('{count}', available)}</p><form className="api-key-form" onSubmit={save}><label>{copy.onboardingName}<input autoFocus value={name} onChange={event=>setName(event.target.value)} placeholder={copy.onboardingNamePlaceholder} required/></label><button className="new-button" disabled={saving}>{saving?copy.onboardingSaving:copy.onboardingStart}</button></form>{error&&<p className="run-notice">{error}</p>}</section></div> }

function GlobalSearch({ projects, runs, copy, query, setQuery, onClose, onProject, onRun, actions = [] }) {
  const dialogRef = useDialogFocus(onClose);
  const [highlighted, setHighlighted] = useState(0);
  const needle = query.trim().toLowerCase();
  const matches = [
    ...projects.filter(item => `${item.name} ${item.next}`.toLowerCase().includes(needle)).slice(0, 6).map(item => ({ id: `project-${item.id}`, type: copy.projectType, label: item.name, detail: item.next, open: () => onProject(item) })),
    ...runs.filter(item => `${item.projectName} ${item.prompt} ${item.status}`.toLowerCase().includes(needle)).slice(0, 8).map(item => ({ id: `run-${item.id}`, type: copy.runType, label: item.projectName, detail: item.prompt, open: () => onRun(item) })),
    ...actions.filter(action => action.label.toLowerCase().includes(needle)).map(action => ({ id: `action-${action.id}`, type: localeText('Action', 'Acción'), label: action.label, detail: '', open: () => { onClose(); action.execute(); } }))
  ];
  const activeIndex = Math.min(highlighted, Math.max(0, matches.length - 1));
  useEffect(() => { setHighlighted(0); }, [query]);
  useEffect(() => { dialogRef.current?.querySelector(`[data-result-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' }); }, [activeIndex]);
  return <div className="modal-backdrop"><section ref={dialogRef} className="modal command-modal" aria-label={copy.globalSearch}>
    <button className="close" onClick={onClose} aria-label={localeText('Close search', 'Cerrar búsqueda')}><X size={18}/></button>
    <p className="eyebrow">{copy.globalSearch}</p>
    <input data-autofocus autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder={copy.searchProjects} aria-label={copy.searchProjectsAria} role="combobox" aria-expanded="true" aria-controls="orbit-search-results" aria-activedescendant={matches.length ? `orbit-search-result-${activeIndex}` : undefined} onKeyDown={event => {
      if (event.isComposing || event.nativeEvent?.isComposing) return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setHighlighted(matches.length ? (activeIndex + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length : 0); }
      if (event.key === 'Enter' && matches[activeIndex]) { event.preventDefault(); matches[activeIndex].open(); }
    }}/>
    {matches.length ? <div className="command-results" id="orbit-search-results" role="listbox">{matches.map((match, index) => <button key={match.id} id={`orbit-search-result-${index}`} data-result-index={index} role="option" aria-selected={index === activeIndex} className={index === activeIndex ? 'is-highlighted' : ''} onMouseEnter={() => setHighlighted(index)} onClick={match.open}><small>{match.type}</small><strong>{match.label}</strong><span>{match.detail}</span></button>)}</div> : <p className="empty-copy">{copy.searchNoMatches}</p>}
    <p className="command-foot">{localeText('↑↓ choose · Enter open · Esc close · ? shortcut help', '↑↓ elegir · Enter abrir · Esc cerrar · ? atajos')}</p>
  </section></div>;
}

function ShortcutHelp({ onClose, pages }) {
  const ref = useDialogFocus(onClose);
  const rows = [ ['⌘ / Ctrl K', localeText('Search projects, runs, and actions', 'Buscar proyectos, ejecuciones y acciones')], ['↑ / ↓ · Enter', localeText('Choose and open a search result', 'Elegir y abrir un resultado')], ['Escape', localeText('Close the top dialog', 'Cerrar el diálogo superior')], ['⌘ / Ctrl Enter', localeText('Send the current instruction', 'Enviar la instrucción actual')], ['⌘ / Ctrl S', localeText('Save in Profile and Project Brain', 'Guardar en Perfil y Cerebro del proyecto')], ['⌘ / Ctrl ,', localeText('Open Settings', 'Abrir Ajustes')], ['⌘ / Ctrl N', localeText('New project', 'Nuevo proyecto')], ['?', localeText('Show shortcuts outside text fields', 'Mostrar atajos fuera de campos de texto')], ...pages.map(([, label], index) => [`⌘ / Ctrl ${index + 1}`, label]) ];
  return <div className="modal-backdrop"><section ref={ref} className="modal shortcut-modal" aria-label={localeText('Keyboard shortcuts', 'Atajos de teclado')}><button className="close" onClick={onClose} aria-label={localeText('Close shortcuts', 'Cerrar atajos')}><X size={18}/></button><h2>{localeText('Keyboard shortcuts', 'Atajos de teclado')}</h2><dl className="shortcut-list">{rows.map(([keys, label]) => <div key={keys}><dt><kbd>{keys}</kbd></dt><dd>{label}</dd></div>)}</dl></section></div>;
}

function RunListModal({ title, runs, onClose, onOpen }) {
  const ref = useDialogFocus(onClose);
  const ordered = [...runs].sort((a, b) => Number(b.status === 'awaiting_input') - Number(a.status === 'awaiting_input'));
  return <div className="modal-backdrop"><section ref={ref} className="modal run-navigation-modal" aria-label={title}><button className="close" onClick={onClose} aria-label={localeText('Close list', 'Cerrar lista')}><X size={18}/></button><h2>{title}</h2>{ordered.length ? <div className="run-navigation-list">{ordered.map(run => <button className="run-row" key={run.id} onClick={() => onOpen(run)}><span className={`run-status ${run.status}`}/><div><strong>{run.projectName}</strong><small>{run.prompt}</small><em>{providerName(run.provider)} · {statusCopy(run.status)[0]}</em></div><ChevronRight size={16}/></button>)}</div> : <p>{localeText('Nothing needs your attention right now.', 'Nada requiere tu atención en este momento.')}</p>}</section></div>;
}

function RunLoadingModal({ error, onClose }) {
  const ref = useDialogFocus(onClose);
  return <div className="modal-backdrop"><section ref={ref} className="modal" aria-label={localeText('Loading agent', 'Cargando agente')}><button className="close" onClick={onClose} aria-label={localeText('Close run monitor', 'Cerrar monitor de ejecución')}><X size={18}/></button><p role="status">{error || localeText('Opening agent…', 'Abriendo agente…')}</p>{error && <small>{localeText('Orbit will retry automatically.', 'Orbit reintentará automáticamente.')}</small>}</section></div>;
}

const providerName = provider => ({ codex: 'Codex', claude: 'Claude', ollama: 'Ollama', local: 'Ollama', gemini: 'Gemini', deepseek: 'DeepSeek' }[String(provider || '').toLowerCase()] || provider || 'Agent');

function EvidenceLightboxModal({ url, title, onClose }) {
  const dialogRef = useDialogFocus(onClose);
  return <div className="modal-backdrop lightbox-backdrop" onClick={onClose}>
    <div ref={dialogRef} className="lightbox-content" aria-label={title} onClick={e => e.stopPropagation()}>
      <div className="lightbox-header">
        <span>{title}</span>
        <button className="close" onClick={onClose} aria-label="Close image"><X size={18}/></button>
      </div>
      <div className="lightbox-body">
        <img src={url} alt={title} className="lightbox-image" />
      </div>
    </div>
  </div>;
}

function ExecutiveInbox({ inbox, projects, copy, onClose, onRefresh, onInspect, onRunTask }) {
  const dialogRef = useDialogFocus(onClose);
  const [busy, setBusy] = useState({});
  const [nextOffer, setNextOffer] = useState(null);
  const [qaBusy, setQaBusy] = useState({});
  const [toast, setToast] = useState('');
  const [expandedEvidence, setExpandedEvidence] = useState({});
  const [lightboxImage, setLightboxImage] = useState(null);
  const items = inbox?.items || [];
  const gateDetails = item => {
    if (item.gateStatus === 'verified_ready') return { label: 'Verified Ready', icon: '🟢', className: 'verified-ready' };
    if (item.gateStatus === 'repairing') return { label: `Auto-Repairing (${item.autoRepairAttempts || 0}/2)`, icon: '🔵', className: 'repairing' };
    if (item.gateStatus === 'verifying') return { label: localeText('Verifying…', 'Verificando…'), icon: '⏳', className: 'repairing' };
    if (item.gateStatus === 'dependency_approval') return { label: localeText('Dependency approval', 'Aprobar dependencias'), icon: '📦', className: 'dependency-approval' };
    return { label: 'Needs Attention', icon: '🟡', className: 'needs-attention' };
  };
  const triggerVisualQA = async (item) => {
    setQaBusy(current => ({ ...current, [item.id]: true }));
    setToast('');
    try {
      const response = await fetch(`/api/runs/${item.id}/visual-qa`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Visual QA failed to execute.');
      setToast(data.report?.status === 'passed' ? 'Visual QA passed: Clean UI & runtime.' : `Visual QA finished: ${data.report?.summary}`);
      setExpandedEvidence(curr => ({ ...curr, [item.id]: true }));
      await onRefresh();
    } catch (error) {
      setToast(`Visual QA Error: ${error.message}`);
    } finally {
      setQaBusy(current => ({ ...current, [item.id]: false }));
    }
  };
  const reverify = async item => {
    setBusy(current => ({ ...current, [item.id]: 'verify' }));
    setToast('');
    try {
      const response = await fetch(`/api/runs/${item.id}/verify`, { method: 'POST' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || localeText('Could not re-run the checks.', 'No se pudieron repetir las verificaciones.'));
      setToast(localeText('Completion Gate started again.', 'La verificación se inició de nuevo.'));
      await onRefresh();
    } catch (error) {
      setToast(error.message);
    } finally {
      setBusy(current => ({ ...current, [item.id]: null }));
    }
  };
  const runAction = async (item, action) => {
    if (action === 'discard' && !window.confirm(`Discard the isolated changes for ${item.projectName || 'this run'}?`)) return;
    setBusy(current => ({ ...current, [item.id]: action }));
    setToast('');
    try {
      const response = await fetch(`/api/runs/${item.id}/${action}`, { method: 'POST' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || `Could not ${action} this run.`);
      setToast(action === 'merge' ? `Changes for ${item.projectName || 'the project'} were approved and merged.` : `Changes for ${item.projectName || 'the project'} were discarded.`);
      setNextOffer(action === 'merge' && body.nextTask ? { projectId: body.projectId, projectName: body.projectName, ...body.nextTask } : null);
      await onRefresh();
    } catch (error) {
      setToast(error.message);
    } finally {
      setBusy(current => ({ ...current, [item.id]: null }));
    }
  };

  return <div className="modal-backdrop executive-inbox-backdrop">
    {lightboxImage && <EvidenceLightboxModal url={lightboxImage.url} title={lightboxImage.title} onClose={() => setLightboxImage(null)} />}
    <section ref={dialogRef} className="modal executive-inbox" role="dialog" aria-modal="true" aria-label="Executive Review Inbox">
      <button className="close" onClick={onClose} aria-label="Close inbox"><X size={18}/></button>
      <div className="inbox-heading">
        <div className="inbox-heading-icon"><Inbox size={20}/></div>
        <div><p className="eyebrow">{copy.inboxTitle}</p><h2>{copy.inboxTitle}</h2><p>{copy.inboxDescription}</p></div>
      </div>
      <div className="inbox-summary">
        <span><b>{inbox?.count || 0}</b> {copy.inboxWaiting}</span>
        <span className="ready"><b>{inbox?.readyCount || 0}</b> {copy.inboxReady}</span>
        <span className="attention"><b>{inbox?.needsAttentionCount || 0}</b> {copy.inboxAttention}</span>
        {inbox?.dependencyCount > 0 && <span className="attention"><b>{inbox.dependencyCount}</b> {localeText('need dependency approval', 'necesitan aprobar dependencias')}</span>}
      </div>
      {toast && <div className="inbox-toast" role="status">{toast}</div>}
      {nextOffer && <div className="inbox-next-offer" role="status">
        <div><p className="eyebrow">{copy.nextTaskEyebrow}</p><strong>{nextOffer.projectName}: {nextOffer.title}</strong></div>
        <div className="inbox-next-actions">
          <button className="new-button" type="button" onClick={async () => { const project = projects.find(item => item.id === nextOffer.projectId); setNextOffer(null); if (project && await onRunTask(project, [nextOffer.title], nextOffer.index)) setToast(copy.nextTaskStarted); }}><Play size={14}/>{copy.startNextTask}</button>
          <button className="text-button" type="button" onClick={() => setNextOffer(null)}>{copy.notNow}</button>
        </div>
      </div>}
      {!items.length ? <div className="inbox-empty"><div>✓</div><h3>{copy.inboxClear}</h3><p>{copy.inboxClearDetail}</p></div> : <div className="inbox-list">
        {items.map(item => {
          const project = projects.find(candidate => candidate.id === item.projectId);
          const gate = gateDetails(item);
          const changedFiles = Array.isArray(item.changedFiles) ? item.changedFiles : [];
          const hasScreenshots = Boolean(item.desktopScreenshot || item.mobileScreenshot);
          const qaStatus = item.gateChecks?.visualQA || item.visualQA?.status;

          return <article className="inbox-card" key={item.id}>
            <div className="inbox-card-top">
              <div className="inbox-card-identities">
                <span className={`inbox-project-badge ${project?.color || 'violet'}`}>{item.projectName || project?.name || 'Project'}</span>
                <span className={`provider-pill ${String(item.provider || '').toLowerCase()}`}>{providerName(item.provider)}</span>
                {qaStatus && qaStatus !== 'none' && (
                  <span className={`inbox-qa-badge qa-${qaStatus}`}>
                    <Camera size={12}/> {qaStatus === 'passed' ? 'UI Clean' : qaStatus === 'failed' ? 'UI Error' : 'UI Skipped'}
                  </span>
                )}
                <span style={{ fontSize: 11, color: '#667085', alignSelf: 'center', marginLeft: 4 }}>{formatLastUpdated(item.createdAt || item.finishedAt)}</span>
              </div>
              <span className={`gate-badge ${gate.className}`}>{gate.icon} {gate.label}</span>
            </div>
            <p className="inbox-prompt">{item.prompt || 'No request text was recorded for this run.'}</p>
            {item.gateStatus !== 'verified_ready' && !item.dependencyRequest && item.gateMessage && <div className={`inbox-gate-message ${gate.className}`}>
              <p>{item.gateMessage}</p>
              {item.gateChecks?.error && <pre>{item.gateChecks.error}</pre>}
            </div>}
            {item.gateStatus === 'verified_ready' && item.gateMessage && <p className="inbox-gate-summary">{item.gateMessage}</p>}
            {!item.dependencyRequest && <GateCheckList checks={item.gateChecks?.checks}/>}
            <div className="inbox-files">
              <strong>{changedFiles.length} changed {changedFiles.length === 1 ? 'file' : 'files'}</strong>
              <div>{changedFiles.slice(0, 6).map(file => <span key={file}>{file}</span>)}{changedFiles.length > 6 && <span>+{changedFiles.length - 6} more</span>}</div>
            </div>

            {(item.visualQA || hasScreenshots) && (
              <div className="inbox-evidence-section">
                <div className="evidence-header-row">
                  <span className="evidence-summary-text">
                    {item.visualQA?.summary || (hasScreenshots ? 'Visual QA captured viewport screenshots.' : 'Visual QA recorded.')}
                  </span>
                  {hasScreenshots && (
                    <button
                      type="button"
                      className="evidence-toggle-btn"
                      onClick={() => setExpandedEvidence(curr => ({ ...curr, [item.id]: !curr[item.id] }))}
                    >
                      <Camera size={13} /> {expandedEvidence[item.id] ? 'Hide Screenshots' : 'View Screenshots'}
                    </button>
                  )}
                </div>

                {expandedEvidence[item.id] && hasScreenshots && (
                  <div className="evidence-preview-grid">
                    {item.desktopScreenshot && (
                      <div className="evidence-slot" onClick={() => setLightboxImage({ url: item.desktopScreenshot, title: `${item.projectName || 'Run'} · Desktop (1280×800)` })}>
                        <div className="evidence-slot-label"><Monitor size={12}/> Desktop (1280×800)</div>
                        <img src={item.desktopScreenshot} alt="Desktop Evidence" className="evidence-img" />
                      </div>
                    )}
                    {item.mobileScreenshot && (
                      <div className="evidence-slot mobile-slot" onClick={() => setLightboxImage({ url: item.mobileScreenshot, title: `${item.projectName || 'Run'} · Mobile (375×667)` })}>
                        <div className="evidence-slot-label"><Smartphone size={12}/> Mobile (375×667)</div>
                        <img src={item.mobileScreenshot} alt="Mobile Evidence" className="evidence-img mobile-img" />
                      </div>
                    )}
                  </div>
                )}

                {item.visualQA?.pageErrors?.length > 0 && (
                  <div className="evidence-error-callout">
                    <strong>Runtime Errors Caught by Playwright:</strong>
                    <ul>
                      {item.visualQA.pageErrors.map((err, idx) => <li key={idx}>{err}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {item.dependencyRequest && <DependencyReview item={item} onDecided={async message => { setToast(message); await onRefresh(); }}/>}

            <div className="inbox-actions">
              <button className="text-button" type="button" onClick={() => onInspect(item)}>{copy.inspectRun}</button>
              {item.status === 'awaiting_review' && item.gateStatus === 'needs_attention' && <button className="text-button" type="button" disabled={Boolean(busy[item.id])} onClick={() => reverify(item)}><RefreshCw size={13}/> {busy[item.id] === 'verify' ? localeText('Starting…', 'Iniciando…') : localeText('Re-run checks', 'Repetir verificación')}</button>}
              {!item.dependencyRequest && <button
                className="text-button"
                type="button"
                disabled={Boolean(qaBusy[item.id])}
                title="Run autonomous visual QA check with Chrome on this worktree"
                onClick={() => triggerVisualQA(item)}
              >
                <Camera size={13}/> {qaBusy[item.id] ? 'Testing UI…' : 'Run Visual QA'}
              </button>}
              <button className="text-button danger-button" type="button" disabled={Boolean(busy[item.id])} onClick={() => runAction(item, 'discard')}>{busy[item.id] === 'discard' ? copy.discardingRun : copy.discardRun}</button>
              {!item.dependencyRequest && <button className="new-button inbox-approve" type="button" disabled={Boolean(busy[item.id]) || item.mergeable !== true} title={item.mergeable === true ? 'Merge verified changes into the repository default branch' : 'Completion Gate approval is required before merging'} onClick={() => runAction(item, 'merge')}><Check size={15}/>{busy[item.id] === 'merge' ? copy.merging : copy.approveMerge}</button>}
            </div>
          </article>;
        })}
      </div>}
    </section>
  </div>;
}

const DEPENDENCY_SECTION_LABELS = {
  dependencies: ['dependency', 'dependencia'],
  devDependencies: ['dev dependency', 'dependencia de desarrollo'],
  optionalDependencies: ['optional dependency', 'dependencia opcional'],
  peerDependencies: ['peer dependency', 'dependencia peer'],
  'require-dev': ['dev dependency', 'dependencia de desarrollo'],
  'dev-dependencies': ['dev dependency', 'dependencia de desarrollo'],
  dev_dependencies: ['dev dependency', 'dependencia de desarrollo'],
  'build-dependencies': ['build dependency', 'dependencia de compilación'],
  build: ['build requirement', 'requisito de compilación'],
  index: ['package index', 'índice de paquetes'],
  repository: ['package repository', 'repositorio de paquetes'],
  replace: ['module replacement', 'reemplazo de módulo'],
  'source override': ['source override', 'origen sustituido'],
  'plugin permission': ['plugin allowed to run', 'plugin con permiso para ejecutarse'],
  'build plugin': ['build plugin', 'plugin de compilación'],
  plugin: ['plugin', 'plugin'],
  dependency_overrides: ['override', 'sustitución']
};
const DEPENDENCY_SOURCE_WARNINGS = {
  local: ['Installed from a local path', 'Se instala desde una ruta local'],
  git: ['Installed from a Git repository, not the package registry', 'Se instala desde un repositorio Git, no desde el registro'],
  url: ['Downloaded from a URL, not the package registry', 'Se descarga desde una URL, no desde el registro'],
  private: ['From a private or custom registry', 'Desde un registro privado o personalizado'],
  workspace: ['Workspace package from this repository', 'Paquete del workspace de este repositorio']
};
const DEPENDENCY_KIND_NOTES = {
  lockfile: ['The agent edited this lockfile directly. Lockfiles pin exact versions and download URLs, so edits are reviewed like new dependencies.', 'El agente editó este lockfile directamente. Los lockfiles fijan versiones exactas y URLs de descarga, así que se revisan como dependencias nuevas.'],
  config: ['Package manager or registry configuration changed. It can change where packages and tools are downloaded from.', 'Cambió la configuración del gestor de paquetes o del registro. Puede cambiar de dónde se descargan paquetes y herramientas.'],
  raw: ['Orbit cannot read this file’s dependencies automatically. Review the text change.', 'Orbit no puede leer automáticamente las dependencias de este archivo. Revisa el cambio de texto.']
};
function packagePageUrl(ecosystem, name) {
  const encoded = name.split('/').map(encodeURIComponent).join('/');
  return {
    npm: `https://www.npmjs.com/package/${encoded}`,
    python: `https://pypi.org/project/${encodeURIComponent(name)}/`,
    cargo: `https://crates.io/crates/${encodeURIComponent(name)}`,
    go: `https://pkg.go.dev/${name}`,
    ruby: `https://rubygems.org/gems/${encodeURIComponent(name)}`,
    composer: `https://packagist.org/packages/${encoded}`,
    nuget: `https://www.nuget.org/packages/${encodeURIComponent(name)}`,
    maven: `https://central.sonatype.com/artifact/${name.split(':').map(encodeURIComponent).join('/')}`,
    gradle: /:/.test(name) ? `https://central.sonatype.com/artifact/${name.split(':').map(encodeURIComponent).join('/')}` : null,
    pub: `https://pub.dev/packages/${encodeURIComponent(name)}`,
    hex: `https://hex.pm/packages/${encodeURIComponent(name)}`
  }[ecosystem] || null;
}
// Shows exactly what an agent asked to change before anything is installed.
function DependencyReview({ item, onDecided }) {
  const request = item.dependencyRequest;
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const pick = pair => localeText(pair[0], pair[1]);
  const manifests = request.manifests || [];
  const canSkipScripts = manifests.some(manifest => manifest.installCommandWithoutScripts);
  const decide = async (action, options = {}) => {
    setBusy(options.ignoreScripts ? 'approve-noscripts' : action); setError('');
    try {
      const response = await fetch(`/api/runs/${item.id}/dependencies/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action === 'approve' ? { hash: request.hash, ignoreScripts: Boolean(options.ignoreScripts) } : { note }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || localeText('Could not save your decision.', 'No se pudo guardar tu decisión.'));
      await onDecided(body.message);
    } catch (decisionError) { setError(decisionError.message); } finally { setBusy(''); }
  };
  const registryNotes = (manifest, entry) => {
    const info = entry.lookupId ? request.registry?.[entry.lookupId] : null;
    const customIndex = (request.customIndexes || []).includes(manifest.ecosystem);
    const notes = [];
    if (DEPENDENCY_SOURCE_WARNINGS[entry.source]) notes.push({ tone: entry.source === 'workspace' ? 'muted' : 'warn', text: pick(DEPENDENCY_SOURCE_WARNINGS[entry.source]) });
    if (['index', 'repository', 'source override'].includes(entry.section)) notes.push({ tone: 'danger', text: localeText('Changes where packages are downloaded from. Packages with the same name could be fetched from this source instead.', 'Cambia de dónde se descargan los paquetes. Paquetes con el mismo nombre podrían descargarse desde este origen.') });
    if (entry.section === 'plugin permission') notes.push({ tone: 'danger', text: localeText('Lets this plugin run code whenever dependencies are installed.', 'Permite que este plugin ejecute código cada vez que se instalan dependencias.') });
    if (info?.found === false) notes.push(customIndex || entry.privateRegistry
      ? { tone: 'warn', text: localeText(`Not found on ${manifest.registryLabel}. A custom package source is configured, so it may come from there.`, `No existe en ${manifest.registryLabel}. Hay un origen de paquetes personalizado configurado; puede venir de ahí.`) }
      : { tone: 'danger', text: localeText(`Not found on ${manifest.registryLabel}. It may be misspelled or invented.`, `No existe en ${manifest.registryLabel}. Puede estar mal escrito o ser inventado.`) });
    if (info?.found === null) notes.push({ tone: 'muted', text: info.error || localeText('The registry could not be checked.', 'No se pudo consultar el registro.') });
    return { info, notes };
  };
  const renderEntry = (manifest, entry, kind) => {
    const { info, notes } = registryNotes(manifest, entry);
    const url = entry.source === 'registry' ? packagePageUrl(manifest.ecosystem, entry.name) : null;
    return <li key={`${kind}-${entry.section}-${entry.name}`} className="dependency-entry">
      <div className="dependency-entry-head">
        {url ? <a href={url} target="_blank" rel="noreferrer"><strong>{entry.name}</strong></a> : <strong>{entry.name}</strong>}
        <code>{kind === 'changed' ? `${entry.from} → ${entry.to}` : entry.spec}</code>
        <span className="dependency-section">{kind === 'changed' ? localeText('changed', 'cambio') : localeText('new', 'nueva')} · {DEPENDENCY_SECTION_LABELS[entry.section] ? pick(DEPENDENCY_SECTION_LABELS[entry.section]) : entry.section}</span>
      </div>
      {info?.found && <p className="dependency-meta">{info.description || localeText('No description.', 'Sin descripción.')}{info.latestVersion ? ` · ${localeText('latest', 'última')} ${info.latestVersion}` : ''}{info.license ? ` · ${info.license}` : ''}</p>}
      {notes.map(note => <p key={note.text} className={`dependency-note ${note.tone}`}>{note.text}</p>)}
    </li>;
  };
  return <div className="dependency-review">
    <div className="dependency-review-head">
      <p className="eyebrow">{localeText('DEPENDENCY APPROVAL', 'APROBACIÓN DE DEPENDENCIAS')}</p>
      <p>{localeText('The agent changed what this project installs, but nothing has been installed. Approve to install it in the isolated worktree and run the checks, or reject to have the agent continue without it.', 'El agente cambió lo que instala este proyecto, pero no se ha instalado nada. Apruébalo para instalarlo en el worktree aislado y ejecutar las verificaciones, o recházalo para que el agente continúe sin ello.')}</p>
      {request.installError && <div className="dependency-install-error" role="alert"><strong>{localeText('Install failed', 'La instalación falló')}</strong> <code>{request.installError.command}</code><p>{request.installError.summary}</p><p>{localeText('Reject to have the agent continue without these packages, or approve again to retry.', 'Recházalos para que el agente continúe sin estos paquetes, o apruébalos de nuevo para reintentar.')}</p></div>}
      {request.previouslyRejected && <p className="dependency-note danger">{localeText('You rejected this same list before. The agent asked for it again.', 'Ya rechazaste esta misma lista. El agente la volvió a pedir.')}</p>}
    </div>
    {manifests.map(manifest => <div key={manifest.path} className="dependency-manifest">
      <p className="dependency-manifest-path"><FileCode size={12}/> {manifest.path} <span className="dependency-ecosystem">{manifest.ecosystemLabel || manifest.ecosystem}</span></p>
      {DEPENDENCY_KIND_NOTES[manifest.kind] && <p className={`dependency-note ${manifest.kind === 'raw' ? 'warn' : 'danger'}`}>{pick(DEPENDENCY_KIND_NOTES[manifest.kind])}</p>}
      <ul>
        {manifest.added.map(entry => renderEntry(manifest, entry, 'added'))}
        {manifest.changed.map(entry => renderEntry(manifest, entry, 'changed'))}
        {manifest.scripts.map(script => <li key={`script-${script.name}`} className="dependency-entry">
          <div className="dependency-entry-head"><strong>{localeText('Install script', 'Script de instalación')} “{script.name}”</strong><code>{script.to}</code></div>
          <p className="dependency-note danger">{localeText('Runs automatically on this computer whenever dependencies are installed.', 'Se ejecuta automáticamente en este equipo cada vez que se instalan dependencias.')}</p>
        </li>)}
      </ul>
      {manifest.raw && <div className="dependency-raw">
        <p className="dependency-meta">{manifest.raw.isNew ? localeText('New file', 'Archivo nuevo') : localeText(`${manifest.raw.added} lines added, ${manifest.raw.removed} removed`, `${manifest.raw.added} líneas añadidas, ${manifest.raw.removed} eliminadas`)}</p>
        {manifest.raw.preview?.length > 0 && <pre>{manifest.raw.preview.join('\n')}</pre>}
      </div>}
      {manifest.kind === 'manifest' && (manifest.installCommand
        ? <p className="dependency-meta">{localeText('Approving runs', 'Aprobar ejecuta')} <code>{manifest.installCommand}</code> {localeText('in', 'en')} <code>{manifest.directory}</code>.{manifest.scriptWarning ? ` ${manifest.scriptWarning}` : ''}</p>
        : manifest.installNote && <p className="dependency-meta">{manifest.installNote}{manifest.scriptWarning ? ` ${manifest.scriptWarning}` : ''}</p>)}
    </div>)}
    <label className="dependency-reject-note">{localeText('Note for the agent if you reject (optional)', 'Nota para el agente si rechazas (opcional)')}<input value={note} maxLength={1000} onChange={event => setNote(event.target.value)} placeholder={localeText('e.g. use the built-in fetch instead of axios', 'p. ej. usa fetch nativo en lugar de axios')}/></label>
    {error && <p className="dependency-note danger" role="alert">{error}</p>}
    <div className="dependency-actions">
      <button className="text-button danger-button" type="button" disabled={Boolean(busy)} onClick={() => decide('reject')}>{busy === 'reject' ? localeText('Rejecting…', 'Rechazando…') : localeText('Reject', 'Rechazar')}</button>
      {canSkipScripts && <button className="text-button" type="button" disabled={Boolean(busy)} title={localeText('Install without running package install scripts. Some packages may not work without them.', 'Instalar sin ejecutar scripts de instalación. Algunos paquetes pueden no funcionar sin ellos.')} onClick={() => decide('approve', { ignoreScripts: true })}>{busy === 'approve-noscripts' ? localeText('Approving…', 'Aprobando…') : localeText('Approve without install scripts', 'Aprobar sin scripts de instalación')}</button>}
      <button className="new-button" type="button" disabled={Boolean(busy)} onClick={() => decide('approve')}><ShieldCheck size={14}/>{busy === 'approve' ? localeText('Approving…', 'Aprobando…') : localeText('Approve & install', 'Aprobar e instalar')}</button>
    </div>
  </div>;
}

// What the Completion Gate ran, per project folder.
function GateCheckList({ checks }) {
  if (!Array.isArray(checks) || !checks.length) return null;
  const icon = { passed: '✓', failed: '✕', skipped: '–' };
  return <ul className="gate-check-list">
    {checks.map((check, index) => <li key={`${check.directory}-${check.command}-${index}`} className={`gate-check ${check.status}`}>
      <span className="gate-check-icon" aria-hidden="true">{icon[check.status] || '•'}</span>
      <code>{check.command}</code>
      {check.directory !== '.' && <span className="gate-check-dir">{check.directory}</span>}
      {check.note && <span className="gate-check-note">{check.note}</span>}
    </li>)}
  </ul>;
}

function ProjectBrainModal({ project, copy, onClose }) {
  const dialogRef = useDialogFocus(onClose);
  const draftKey = `orbit-brain-draft:${project.id}`;
  const readDraft = () => { try { return sessionStorage.getItem(draftKey); } catch { return null; } };
  const [content, setContent] = useState(() => readDraft() ?? '');
  const savedContent = useRef('');
  const memoryBusy = useRef(false);
  const clearSavedDraft = value => {
    try {
      // A reopened editor may already have a newer draft while this save finishes.
      if (sessionStorage.getItem(draftKey) === value) sessionStorage.removeItem(draftKey);
    } catch {}
  };
  const updateContent = value => {
    setContent(value);
    try { sessionStorage.setItem(draftKey, value); } catch {}
  };
  const [memoryPath, setMemoryPath] = useState('PROJECT_MEMORY.md');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState('');
  const loadMemory = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/projects/${project.id}/memory`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || copy.brainLoadError);
      const draft = readDraft();
      setContent(draft ?? body.content ?? '');
      savedContent.current = body.content || '';
      setMemoryPath(body.path || 'PROJECT_MEMORY.md');
      if (draft !== null) setNotice(localeText('Your unsaved rules have been restored.', 'Se restauraron tus reglas sin guardar.'));
      return true;
    } catch (error) {
      setNotice(error.message);
      return false;
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { loadMemory(); }, [project.id]);
  const saveMemory = async () => {
    if (loading || memoryBusy.current) return;
    memoryBusy.current = true;
    setSaving(true); setNotice('');
    try {
      const response = await fetch(`/api/projects/${project.id}/memory`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || copy.brainSaveError);
      savedContent.current = content;
      clearSavedDraft(content);
      setNotice(copy.brainSaveSuccess);
    } catch (error) { setNotice(error.message); } finally { memoryBusy.current = false; setSaving(false); }
  };
  const refreshStack = async () => {
    if (loading || memoryBusy.current) return;
    memoryBusy.current = true;
    setRefreshing(true); setNotice('');
    try {
      // Persist the user's edited rules before the scanner updates stack sections.
      if (content !== savedContent.current || readDraft() !== null) {
        const saved = await fetch(`/api/projects/${project.id}/memory`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) });
        const savedBody = await saved.json().catch(() => ({}));
        if (!saved.ok) throw new Error(savedBody.error || copy.brainSaveError);
        savedContent.current = content;
        clearSavedDraft(content);
      }
      const response = await fetch(`/api/projects/${project.id}/memory/refresh`, { method: 'POST' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || copy.brainScanError);
      if (await loadMemory()) setNotice(copy.brainScanSuccess);
    } catch (error) { setNotice(error.message); } finally { memoryBusy.current = false; setRefreshing(false); }
  };

  return <div className="modal-backdrop brain-backdrop">
    <section ref={dialogRef} className="modal project-brain-modal" role="dialog" aria-modal="true" aria-label={`${project.name} Project Brain`} onKeyDown={event => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); event.stopPropagation(); saveMemory(); } }}>
      <button className="close" onClick={onClose} aria-label="Close Project Brain"><X size={18}/></button>
      <div className="brain-heading"><div className="brain-icon"><Brain size={21}/></div><div><p className="eyebrow">{copy.brainEyebrow}</p><h2>{project.name} {copy.brainMemory}</h2><p>{copy.brainDescription}</p></div></div>
      <div className="brain-path">{memoryPath}</div>
      {loading ? <div className="brain-loading">{copy.brainLoading}</div> : <textarea className="brain-editor" spellCheck="false" readOnly={saving || refreshing} value={content} onChange={event => updateContent(event.target.value)} aria-label={copy.brainEyebrow}/>}
      {notice && <p className="brain-notice" role="status">{notice}</p>}
      <div className="brain-actions"><button className="text-button brain-rescan" type="button" title="Saves edited rules before refreshing the detected stack" disabled={loading || refreshing || saving} onClick={refreshStack}><RefreshCw size={14} className={refreshing ? 'spin' : ''}/>{refreshing ? copy.brainScanning : copy.brainRescan}</button><button className="new-button" type="button" title="Save rules (⌘/Ctrl+S)" disabled={loading || saving || refreshing} onClick={saveMemory}><Check size={15}/>{saving ? copy.brainSaving : copy.brainSave}</button></div>
    </section>
  </div>;
}

function Metric({icon, label, value, detail}) { return <article className="metric"><div className="metric-icon">{icon}</div><p>{label}</p><strong>{value}</strong><small>{detail}</small></article> }
function DeploymentModal({ project, copy, onClose, onDeployed }) {
  const dialogRef = useDialogFocus(onClose);
  const spanish = document.documentElement.lang === 'es';
  const text = spanish ? {
    eyebrow: 'PUBLICAR PROYECTO', title: '¿Dónde quieres publicar?', loading: 'Revisando destinos disponibles…', unavailable: 'Falta configuración local', ready: 'Listo', output: 'Carpeta de compilación', cloudflareProject: 'Nombre del proyecto en Cloudflare', command: 'Comando de despliegue', commandHint: 'Solo se permiten comandos npm, pnpm, yarn, bun, npx o node.', confirm: 'Entiendo que esto publicará en producción.', cancel: 'Cancelar', publish: 'Publicar ahora', publishing: 'Publicando…', success: 'Proyecto publicado correctamente.', noTargets: 'No se encontraron destinos de despliegue.'
  } : {
    eyebrow: 'PUBLISH PROJECT', title: 'Where would you like to deploy?', loading: 'Checking available targets…', unavailable: 'Local configuration required', ready: 'Ready', output: 'Build output folder', cloudflareProject: 'Cloudflare project name', command: 'Deployment command', commandHint: 'Only npm, pnpm, yarn, bun, npx, or node commands are accepted.', confirm: 'I understand this publishes to production.', cancel: 'Cancel', publish: 'Deploy now', publishing: 'Deploying…', success: 'Project deployed successfully.', noTargets: 'No deployment targets were found.'
  };
  const [targets, setTargets] = useState([]);
  const [selected, setSelected] = useState(project.deployment?.target || 'vercel');
  const [outputDir, setOutputDir] = useState(project.deployment?.outputDir || 'dist');
  const [cloudflareProject, setCloudflareProject] = useState(project.deployment?.cloudflareProject || project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
  const [customCommand, setCustomCommand] = useState(project.deployment?.customCommand || 'npm run deploy');
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);
  const [notice, setNotice] = useState('');
  const [launchGate, setLaunchGate] = useState(null);
  useEffect(() => {
    let active = true;
    fetch(`/api/projects/${project.id}/deploy/targets`).then(response => response.json()).then(body => {
      if (!active) return;
      if (!body.targets) throw new Error(body.error || 'Could not load deployment targets.');
      setTargets(body.targets);
      if (body.deployment?.target) setSelected(body.deployment.target);
    }).catch(error => active && setNotice(error.message)).finally(() => active && setLoading(false));
    fetch(`/api/projects/${project.id}/launch-advisory?lang=${spanish ? 'es' : 'en'}`).then(response => response.json()).then(body => {
      if (active && body.launchGate) setLaunchGate(body.launchGate);
    }).catch(() => {});
    return () => { active = false; };
  }, [project.id]);
  const selectedTarget = targets.find(target => target.id === selected);
  const deploy = async () => {
    if (!confirmed || !selectedTarget?.ready || launchGate?.canDeploy === false) return;
    setDeploying(true); setNotice('');
    try {
      const response = await fetch(`/api/projects/${project.id}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: selected, confirm: true, outputDir, cloudflareProject, customCommand })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Deployment could not start.');
      setNotice(body.url ? `${text.success} ${body.url}` : text.success);
      onDeployed();
    } catch (error) { setNotice(error.message); } finally { setDeploying(false); }
  };
  return <div className="modal-backdrop deployment-backdrop"><section ref={dialogRef} className="modal deployment-modal" role="dialog" aria-modal="true" aria-label={text.title}>
    <button className="close" type="button" onClick={onClose} aria-label={text.cancel}><X size={18}/></button>
    <p className="eyebrow">{text.eyebrow}</p><h2>{text.title}</h2>
    {loading ? <p className="empty-copy">{text.loading}</p> : <div className="deployment-target-list">{targets.length ? targets.map(target => <button type="button" key={target.id} className={`deployment-target ${selected === target.id ? 'selected' : ''} ${target.ready ? '' : 'unavailable'}`} onClick={() => target.ready && setSelected(target.id)} disabled={!target.ready}><span><strong>{target.label}</strong><small>{target.description}</small></span><em>{target.ready ? text.ready : text.unavailable}</em></button>) : <p className="empty-copy">{text.noTargets}</p>}</div>}
    {selected === 'cloudflare' && <div className="deployment-fields"><label>{text.output}<input value={outputDir} onChange={event => setOutputDir(event.target.value)} placeholder="dist"/></label><label>{text.cloudflareProject}<input value={cloudflareProject} onChange={event => setCloudflareProject(event.target.value)} placeholder="my-project"/></label></div>}
    {selected === 'custom' && <div className="deployment-fields"><label>{text.command}<input value={customCommand} onChange={event => setCustomCommand(event.target.value)} placeholder="npm run deploy"/><small>{text.commandHint}</small></label></div>}
    <label className="deployment-confirm"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)}/><span>{text.confirm}</span></label>
    {launchGate?.canDeploy === false && <p className="deployment-notice deployment-blocked" role="status">{spanish ? `El lanzamiento está bloqueado por ${launchGate.blockers.length} requisito(s) de privacidad o confianza. Abre Blindaje y Asesoría para resolverlos.` : `Launch is blocked by ${launchGate.blockers.length} privacy or trust requirement(s). Open Hardening & Advisory to resolve them.`}</p>}
    {notice && <p className="deployment-notice" role="status">{notice}</p>}
    <div className="deployment-modal-actions"><button className="text-button" type="button" onClick={onClose}>{text.cancel}</button><button className="new-button" type="button" onClick={deploy} disabled={!confirmed || !selectedTarget?.ready || deploying || launchGate?.canDeploy === false}><Rocket size={15}/>{deploying ? text.publishing : text.publish}</button></div>
  </section></div>;
}
function projectTaskTitle(task) {
  return String(Array.isArray(task) ? task[0] : task?.title || '').trim();
}

function projectTaskDone(task) {
  return Boolean(Array.isArray(task) ? task[2] : task?.completed);
}

function projectDisplayState(project, projectRuns) {
  const liveRun = projectRuns.find(run => ['queued', 'running', 'streaming', 'repairing'].includes(run.status));
  if (liveRun) return { label: localeText('Agent working', 'Agente trabajando'), tone: 'active' };
  if (projectRuns.some(run => run.status === 'awaiting_input')) return { label: localeText('Needs your answer', 'Necesita tu respuesta'), tone: 'attention' };
  if (projectRuns.some(run => run.status === 'awaiting_review')) return { label: localeText('Ready to review', 'Listo para revisar'), tone: 'review' };
  const tasks = project.tasks || [];
  if (tasks.length && tasks.every(projectTaskDone)) return { label: localeText('Stage complete', 'Etapa completada'), tone: 'complete' };
  return { label: project.status || localeText('In progress', 'En progreso'), tone: 'neutral' };
}

function ProjectsPage({ projects, runs, copy, onOpenProject }) {
  return <section className="projects-page simplified-projects-page">
    <div className="projects-page-intro">
      <div><p className="eyebrow">{localeText('PROJECT WORKSPACES', 'ESPACIOS DE PROYECTO')}</p><h2>{localeText('Choose where to work.', 'Elige dónde trabajar.')}</h2></div>
      <p>{localeText('Each card shows only the current state and the next meaningful action. Open a project for tasks, preview, launch review, and activity.', 'Cada tarjeta muestra solo el estado actual y la siguiente acción importante. Abre un proyecto para ver tareas, vista previa, revisión de lanzamiento y actividad.')}</p>
    </div>
    <div className="projects-list compact-project-list">
      {projects.map(project => {
        const projectRuns = runs.filter(run => run.projectId === project.id).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
        const pendingTasks = (project.tasks || []).filter(task => !projectTaskDone(task));
        const nextTask = projectTaskTitle(pendingTasks[0]) || (project.tasks?.length ? localeText('Choose the next milestone', 'Define el siguiente hito') : project.next || localeText('Define the first project task', 'Define la primera tarea del proyecto'));
        const state = projectDisplayState(project, projectRuns);
        const completedCount = (project.tasks || []).filter(projectTaskDone).length;
        const totalTasks = (project.tasks || []).length;
        return <article className={`project-hub compact-project-hub ${project.color}`} key={project.id}>
          <div className="compact-project-main">
            <div className="compact-project-title-row">
              <div className={`project-color-mark ${project.color}`} aria-hidden="true"/>
              <div><h3>{project.name}</h3><small>{project.kind} · {project.mode === 'connected' ? copy.repoConnected : copy.noRepo}</small></div>
            </div>
            <p className="compact-project-summary">{project.summary || localeText('Project workspace ready for its next milestone.', 'Espacio de proyecto listo para su siguiente hito.')}</p>
          </div>
          <div className="compact-project-status">
            <span className={`project-state-pill ${state.tone}`}>{state.label}</span>
            <div className="compact-project-progress"><span>{copy.overallProgress}</span><strong>{project.progress || 0}%</strong><div className="progress"><i style={{ width: `${project.progress || 0}%` }}/></div><small>{totalTasks ? `${completedCount}/${totalTasks} ${localeText('tasks complete', 'tareas listas')}` : localeText('No tasks defined', 'Sin tareas definidas')}</small></div>
          </div>
          <div className="compact-project-next"><span>{copy.nextLabel}</span><strong>{nextTask}</strong>{projectRuns[0] && <small>{providerName(projectRuns[0].provider)} · {String(projectRuns[0].status || '').replaceAll('_', ' ')}</small>}</div>
          <button className="project-open-button" type="button" onClick={() => onOpenProject(project)}>{copy.openProject}<ChevronRight size={16}/></button>
        </article>;
      })}
    </div>
  </section>;
}

function LegacyProjectsPage({ projects, runs, copy, onToggleTask, onRunTask, onInspectRun, onPreview, onAdvisor, onRefresh }) {
  const [expanded, setExpanded] = useState(null);
  const [prompts, setPrompts] = useState({});
  const [edits, setEdits] = useState({});
  const [optimizing, setOptimizing] = useState({});
  const [deploymentProject, setDeploymentProject] = useState(null);
  const [notice, setNotice] = useState('');
  const [savingProjects, setSavingProjects] = useState({});
  const [sendingProjects, setSendingProjects] = useState({});
  const projectOperations = useRef(new Set());
  const save = async project => {
    const operation = `save:${project.id}`;
    if (projectOperations.current.has(operation)) return;
    projectOperations.current.add(operation);
    setSavingProjects(current => ({ ...current, [project.id]: true }));
    setNotice('');
    const edit = edits[project.id] || {};
    try {
      const response = await fetch(`/api/projects/${project.id}/tasks`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: edit.status ?? project.status, progress: edit.progress ?? project.progress, next: edit.next ?? project.next }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || localeText('Could not save project changes.', 'No se pudieron guardar los cambios del proyecto.'));
      setEdits(current => { if (current[project.id] !== edit) return current; const next = { ...current }; delete next[project.id]; return next; });
      await onRefresh();
    } catch (error) { setNotice(error.message); }
    finally { projectOperations.current.delete(operation); setSavingProjects(current => ({ ...current, [project.id]: false })); }
  };
  const optimize = async id => { const prompt = (prompts[id] || '').trim(); if (!prompt) return; setOptimizing(current => ({ ...current, [id]: true })); try { const response = await fetch('/api/prompts/optimize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: id, prompt }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error); setPrompts(current => ({ ...current, [id]: body.optimized })); setNotice(copy.promptOptimized.replace('{tokens}', body.tokenSavingsEstimate)); } catch (error) { setNotice(error.message); } finally { setOptimizing(current => ({ ...current, [id]: false })); } };
  const send = async id => {
    const prompt = (prompts[id] || '').trim(), operation = `send:${id}`;
    if (!prompt || projectOperations.current.has(operation)) return;
    projectOperations.current.add(operation);
    setSendingProjects(current => ({ ...current, [id]: true })); setNotice('');
    try {
      const response = await fetch('/api/runs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: id, provider: 'auto', prompt }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || copy.executionStartError);
      setPrompts(current => current[id]?.trim() === prompt ? { ...current, [id]: '' } : current);
      onInspectRun?.(body);
      await onRefresh();
    } catch (error) { setNotice(error.message); }
    finally { projectOperations.current.delete(operation); setSendingProjects(current => ({ ...current, [id]: false })); }
  };
  const copyClientLink = async projectId => {
    try {
      const response = await fetch(`/api/projects/${projectId}/share-link`, { method: 'POST' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || copy.clientLinkError);
      const url = new URL(body.path, window.location.origin).toString();
      await navigator.clipboard.writeText(url);
      setNotice(copy.clientLinkCopied);
    } catch (error) {
      setNotice(error.message || copy.clientLinkError);
    }
  };
  const remove = async project => { if (window.confirm(copy.removeProject.replace('{project}', project.name))) { await fetch(`/api/projects/${project.id}`, { method: 'DELETE' }); onRefresh(); } };
  return <section className="projects-page"><div className="projects-list">{projects.map(project => { const open = expanded === project.id, edit = edits[project.id] || {}, projectRuns = runs.filter(run => run.projectId === project.id), pending = (project.tasks || []).filter(task => !task[2]).length; return <article className={`project-hub ${project.color}`} key={project.id}><div className="hub-header"><div><span className="status">{project.status}</span><h3>{project.name}</h3><small>{project.kind} · {project.mode === 'connected' ? `● ${copy.repoConnected}` : `○ ${copy.noRepo}`} · {formatLastUpdated(project.lastUpdatedAt)}</small></div><div><b>{project.progress}%</b><div className="progress"><i style={{ width: `${project.progress}%` }}/></div><small>{pending} {copy.pendingCount}</small></div><button className="icon-button" onClick={() => setExpanded(open ? null : project.id)}><ChevronRight size={16}/></button></div><div className="hub-summary"><span><b>{copy.nextLabel}</b> {project.next}</span>{projectRuns[0] && <small>{projectRuns[0].provider} · {projectRuns[0].status}</small>}</div><button className="text-button client-share-button" type="button" onClick={() => copyClientLink(project.id)}>{copy.clientPortal}</button>{project.infra?.status === 'configured' && <span className="status" style={{ background: '#e6f5ed', color: '#276a4b', fontSize: 11, padding: '4px 8px', borderRadius: 999, marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Check size={11}/> {copy.clientInfraReady}</span>}{project.mode === 'connected' && <><form className="hub-quick-run" onSubmit={event => { event.preventDefault(); send(project.id); }}><input value={prompts[project.id] || ''} onChange={event => setPrompts(current => ({ ...current, [project.id]: event.target.value }))} placeholder={copy.askAgent}/><button className="new-button" type="submit" disabled={sendingProjects[project.id] || !(prompts[project.id] || '').trim()} aria-label={copy.sendToAgent}>{sendingProjects[project.id] ? <RefreshCw size={14} className="spin"/> : <Send size={14}/>}</button></form><div className="deploy-actions"><button className="text-button preview-list-button" type="button" onClick={() => onPreview(project)}><Eye size={13}/>{copy.livePreview}</button><button className="text-button armor-button" type="button" onClick={() => onAdvisor && onAdvisor(project)}><ShieldCheck size={13}/> {copy.launchArmorShort}</button><button className="text-button deploy-button" type="button" onClick={() => setDeploymentProject(project)}><Rocket size={13}/> {document.documentElement.lang === 'es' ? 'Publicar' : 'Deploy'}</button>{project.deployedUrl && <a href={project.deployedUrl} target="_blank" rel="noreferrer">{copy.live} {project.deployedUrl.replace('https://', '')}</a>}</div><button className="optimize-button" type="button" disabled={optimizing[project.id] || !(prompts[project.id] || '').trim()} onClick={() => optimize(project.id)}><Sparkles size={13}/>{optimizing[project.id] ? copy.optimizing : copy.optimize}</button></>}{open && <div className="hub-expanded"><div className="hub-edit"><input value={edit.next ?? project.next} onChange={event => setEdits(current => ({ ...current, [project.id]: { ...edit, next: event.target.value } }))}/><input type="number" min="0" max="100" value={edit.progress ?? project.progress} onChange={event => setEdits(current => ({ ...current, [project.id]: { ...edit, progress: event.target.value } }))}/><button className="text-button" disabled={savingProjects[project.id]} onClick={() => save(project)}>{savingProjects[project.id] ? localeText('Saving…', 'Guardando…') : copy.save}</button></div><p className="eyebrow">{copy.tasksLabel}</p>{(project.tasks || []).map((task, index) => <TaskRow key={index} task={task} project={project} index={index} runs={projectRuns} onRunTask={onRunTask} onInspectRun={onInspectRun} onToggle={() => onToggleTask(project.id, index)}/>)}<TaskAddRow project={project} copy={copy} onRefresh={onRefresh} onRunTask={onRunTask}/><button className="text-button danger-button" onClick={() => remove(project)}>{copy.deleteProject}</button></div>}</article>; })}</div>{notice && <p className="run-notice">{notice}</p>}{deploymentProject && <DeploymentModal project={deploymentProject} copy={copy} onClose={() => setDeploymentProject(null)} onDeployed={onRefresh}/>}</section>;
}
function SkillHub({ copy = uiCopy }) {
  const text = {
    inspectError: localeText('Could not inspect this source.', 'No se pudo revisar esta fuente.'), localInspectError: localeText('Could not inspect this local skill.', 'No se pudo revisar esta habilidad local.'), reviewError: localeText('Could not re-evaluate this skill.', 'No se pudo volver a evaluar esta habilidad.'), deleteConfirm: localeText('Delete this local skill?', '¿Eliminar esta habilidad local?'), foundSkills: localeText('Orbit found {count} skill files in {repository}. Choose one to inspect before it is saved.', 'Orbit encontró {count} archivos de habilidades en {repository}. Elige uno para revisarlo antes de guardarlo.'), secureEyebrow: localeText('SECURE SKILL HUB', 'CENTRO DE HABILIDADES SEGURO'), secureTitle: localeText('Reviewed capabilities for your agents.', 'Capacidades revisadas para tus agentes.'), secureDetail: localeText('Paste a GitHub repository or a direct skill file. Nothing becomes active until you inspect and approve it.', 'Pega un repositorio de GitHub o un archivo de habilidad directo. Nada se activa hasta que lo revises y apruebes.'), officialSources: localeText('ORBIT RECOMMENDED · OFFICIAL SOURCES', 'RECOMENDADAS POR ORBIT · FUENTES OFICIALES'), installSource: localeText('Install from source, on your terms', 'Instala desde la fuente, bajo tus condiciones'), sourceDetail: localeText('These are references to their original authors—not bundled code. Orbit downloads nothing until you inspect a source, scans the complete selected package, and waits for your explicit approval.', 'Estas son referencias a sus autores originales, no código incluido. Orbit no descarga nada hasta que inspecciones una fuente, analiza el paquete completo seleccionado y espera tu aprobación explícita.'), inspectSource: localeText('Inspect from source', 'Revisar desde la fuente'), sourceCredit: localeText('Source & credit', 'Fuente y crédito'), localRecommendations: localeText('RECOMMENDED · AGENCY AGENTS ON THIS MAC', 'RECOMENDADAS · AGENCY AGENTS EN ESTA MAC'), inspectLocalTitle: localeText('Ready to inspect locally', 'Listas para revisión local'), inspectLocalDetail: localeText('These capabilities are already present on your computer. Importing one opens the same security review used for GitHub skills.', 'Estas capacidades ya están en tu computadora. Importar una abre la misma revisión de seguridad usada para habilidades de GitHub.'), alreadyImported: localeText('Already imported', 'Ya importada'), inspectLabel: localeText('Inspect', 'Revisar'), browseInstalled: localeText('Browse all installed Agency skills', 'Explorar todas las habilidades instaladas de Agency'), imported: localeText('Imported', 'Importada'), importGithub: localeText('IMPORT FROM GITHUB', 'IMPORTAR DESDE GITHUB'), sourceUrl: localeText('Repository or skill file URL', 'URL del repositorio o archivo de habilidad'), findSkills: localeText('Find and inspect skills', 'Buscar y revisar habilidades'), discovered: localeText('SKILLS DISCOVERED', 'HABILIDADES ENCONTRADAS'), choosePackage: localeText('Choose a skill package to review', 'Elige un paquete de habilidad para revisar'), choosePackageDetail: localeText('Choose its main SKILL.md once. Orbit will collect its references, scripts, assets, and adjacent files, scan the complete package, and show it before approval.', 'Elige su SKILL.md principal una vez. Orbit reunirá sus referencias, scripts, recursos y archivos adyacentes, analizará el paquete completo y lo mostrará antes de aprobarlo.'), localLibrary: localeText('LOCAL LIBRARY', 'BIBLIOTECA LOCAL'), skills: localeText('Skills', 'Habilidades'), review: localeText('SKILL REVIEW', 'REVISIÓN DE HABILIDAD'), purpose: localeText('What this skill does', 'Qué hace esta habilidad'), defaultPurpose: localeText('A reusable set of instructions for an agent.', 'Un conjunto reutilizable de instrucciones para un agente.'), community: localeText('Community skill', 'Habilidad de comunidad'), compatible: localeText('Any compatible model', 'Cualquier modelo compatible'), source: localeText('Source:', 'Fuente:'), package: localeText('Package:', 'Paquete:'), integrity: localeText('Integrity check:', 'Verificación de integridad:'), file: localeText('file', 'archivo'), inactiveWarning: localeText('This skill is inactive until you approve it. Orbit’s immutable safety rules always take priority over its instructions.', 'Esta habilidad permanece inactiva hasta que la apruebes. Las reglas de seguridad inmutables de Orbit siempre tienen prioridad sobre sus instrucciones.'), reviewWarning: localeText('Things to review before approval', 'Aspectos para revisar antes de aprobar'), blockedWhy: localeText('Why Orbit blocked this skill', 'Por qué Orbit bloqueó esta habilidad'), blockedDetail: localeText('These instructions conflict with protections that cannot be overridden.', 'Estas instrucciones entran en conflicto con protecciones que no se pueden anular.'), packageContents: localeText('PACKAGE CONTENTS — REVIEW BEFORE APPROVAL', 'CONTENIDO DEL PAQUETE — REVISA ANTES DE APROBAR'), mainInstructions: localeText('Main instructions', 'Instrucciones principales'), roleInstructions: localeText('ROLE INSTRUCTIONS — READ BEFORE APPROVAL', 'INSTRUCCIONES DE ROL — LEE ANTES DE APROBAR'), deleteLocal: localeText('Delete local copy', 'Eliminar copia local'), refreshPackage: localeText('Refresh package from source', 'Actualizar paquete desde la fuente'), reassess: localeText('Re-evaluate safety analysis', 'Volver a evaluar el análisis de seguridad'), approveWarnings: localeText('Approve with warnings', 'Aprobar con advertencias')
  };
  const [skills, setSkills] = useState([]);
  const [url, setUrl] = useState('');
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [catalog, setCatalog] = useState({ local: [], recommended: [], recommendedSources: [] });
  const reviewRef = useDialogFocus(() => setSelected(null), Boolean(selected));
  const [reviewBusy, setReviewBusy] = useState(false);
  const reviewBusyRef = useRef(false);
  const load = async () => { const response = await fetch('/api/skills'); if (response.ok) setSkills(await response.json()); };
  const loadCatalog = async () => { const response = await fetch('/api/skills/catalog'); if (response.ok) setCatalog(await response.json()); };
  useEffect(() => { load(); loadCatalog(); }, []);
  const inspect = async (event, sourceUrl = url) => {
    event?.preventDefault();
    setNotice('');
    try {
    const response = await fetch('/api/skills/inspect-github', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: sourceUrl }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { setNotice(body.error || text.inspectError); return; }
    if (body.requiresSelection) {
      setCandidates(body.candidates || []);
      setNotice(text.foundSkills.replace('{count}', body.candidates?.length || 0).replace('{repository}', body.repository));
      return;
    }
    setCandidates([]); setUrl(''); setSelected(body.skill); load();
    } catch (error) { setNotice(error.message || text.inspectError); }
  };
  const inspectLocal = async sourceId => {
    setNotice('');
    try {
    const response = await fetch('/api/skills/inspect-local', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceId }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { setNotice(body.error || text.localInspectError); return; }
    setSelected(body.skill); load(); loadCatalog();
    } catch (error) { setNotice(error.message || text.localInspectError); }
  };
  const detail = async id => {
    setNotice('');
    try { const response = await fetch(`/api/skills/${id}`); const body = await response.json(); if (!response.ok) throw new Error(body.error || text.inspectError); setSelected(body); }
    catch (error) { setNotice(error.message); }
  };
  const reviewAction = async (id, action) => {
    if (reviewBusyRef.current) return;
    if (action === 'delete' && !window.confirm(text.deleteConfirm)) return;
    reviewBusyRef.current = true; setReviewBusy(true); setNotice('');
    try {
      const response = await fetch(`/api/skills/${id}${action === 'delete' ? '' : `/${action}`}`, { method: action === 'delete' ? 'DELETE' : 'POST' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || text.reviewError);
      setSelected(action === 'review' ? body.skill : null); await load(); await loadCatalog();
    } catch (error) { setNotice(error.message || text.reviewError); }
    finally { reviewBusyRef.current = false; setReviewBusy(false); }
  };
  const approve = () => reviewAction(selected.id, 'approve');
  const reassess = () => reviewAction(selected.id, 'review');
  const remove = id => reviewAction(id, 'delete');
  const status = skill => skill.status === 'approved' ? copy.approved : skill.status === 'blocked' ? copy.blocked : copy.pending;
  const riskExplanation = flag => ({
    'environment variables or credentials': localeText('It mentions configuration through environment variables or credentials. Orbit will never reveal or insert your keys.', 'Menciona configuración mediante variables de entorno o credenciales. Orbit nunca revelará ni insertará tus claves.'),
    'secret or token extraction': localeText('It refers to API keys or tokens. Do not approve it if it asks to print, send, or copy a real secret.', 'Se refiere a claves API o tokens. No la apruebes si pide imprimir, enviar o copiar un secreto real.'),
    'opaque remote script execution': localeText('It suggests downloading and running an installer command. Review the command and prefer the documented package installer when available.', 'Sugiere descargar y ejecutar un comando instalador. Revisa el comando y prefiere el instalador documentado cuando exista.'),
    'instruction override': localeText('It tries to override Orbit’s safety rules. This cannot be enabled.', 'Intenta anular las reglas de seguridad de Orbit. No se puede habilitar.'),
    'privilege escalation': localeText('It asks for administrator-level permissions. This cannot be enabled.', 'Pide permisos de administrador. No se puede habilitar.'),
    'destructive shell command': localeText('It includes a command that could delete or damage data. This cannot be enabled.', 'Incluye un comando que podría eliminar o dañar datos. No se puede habilitar.'),
    'forced git history rewrite': localeText('It can rewrite shared Git history. This cannot be enabled.', 'Puede reescribir el historial compartido de Git. No se puede habilitar.')
  }[flag] || localeText('Orbit detected a security-sensitive instruction that needs your review.', 'Orbit detectó una instrucción sensible de seguridad que necesita tu revisión.'));
  return <section className="agent-console">
    <div className="agent-intro"><div><p className="eyebrow">{text.secureEyebrow}</p><h2>{text.secureTitle}</h2><p>{text.secureDetail}</p></div></div>
    {catalog.recommendedSources?.length > 0 && <section className="panel recommended-skills-registry"><p className="eyebrow">{text.officialSources}</p><h2>{text.installSource}</h2><p className="empty-copy">{text.sourceDetail}</p><div className="recommended-skill-grid">{catalog.recommendedSources.map(skill => <article key={skill.id}><div className="recommended-skill-meta"><span>{skill.category}</span><small>{skill.author} · {skill.license}</small></div><h3>{skill.name}</h3><p>{skill.description}</p><div className="recommended-skill-actions"><button className="text-button" type="button" onClick={() => inspect(null, skill.sourceUrl)}>{text.inspectSource}</button><a href={skill.learnMore} target="_blank" rel="noreferrer">{text.sourceCredit} <ArrowUpRight size={13}/></a></div></article>)}</div></section>}
    {catalog.recommended?.length > 0 && <section className="panel local-skills-catalog"><p className="eyebrow">{text.localRecommendations}</p><h2>{text.inspectLocalTitle}</h2><p className="empty-copy">{text.inspectLocalDetail}</p><div className="local-skill-grid">{catalog.recommended.map(skill => <article key={skill.sourceId}><div><strong>{skill.name}</strong><p>{skill.description}</p><small>{skill.path}</small></div><button className="text-button" type="button" disabled={skill.imported} onClick={() => inspectLocal(skill.sourceId)}>{skill.imported ? text.alreadyImported : text.inspectLabel}</button></article>)}</div><details><summary>{text.browseInstalled} ({catalog.local?.length || 0})</summary><div className="local-skill-list">{catalog.local.filter(skill => !skill.recommended).map(skill => <button key={skill.sourceId} type="button" disabled={skill.imported} onClick={() => inspectLocal(skill.sourceId)}><span>{skill.name}<small>{skill.description}</small></span><em>{skill.imported ? text.imported : text.inspectLabel}</em></button>)}</div></details></section>}
    <form className="panel run-form" onSubmit={inspect}><p className="eyebrow">{text.importGithub}</p><label>{text.sourceUrl}<input value={url} onChange={event => setUrl(event.target.value)} placeholder="https://github.com/usestrix/strix" required/></label><button className="new-button">{text.findSkills}</button>{notice && <p className="run-notice">{notice}</p>}</form>
    {candidates.length > 0 && <section className="panel skill-discovery"><p className="eyebrow">{text.discovered}</p><h2>{text.choosePackage}</h2><p className="empty-copy">{text.choosePackageDetail}</p><div>{candidates.map(candidate => <button key={candidate.url} type="button" onClick={() => inspect(null, candidate.url)}><span>{candidate.path}</span><ChevronRight size={15}/></button>)}</div></section>}
    <section className="section-heading"><div><p className="eyebrow">{text.localLibrary}</p><h2>{text.skills} ({skills.length})</h2></div></section>
    <section className="project-grid">{skills.map(skill => <article className="panel" key={skill.id}><span className={`status skill-status ${skill.status}`}>{status(skill)}</span><h3>{skill.name}</h3><p className="empty-copy">{skill.description}</p><small>SHA {skill.contentHash?.slice(0, 12)} · {skill.preferredModel}</small><div className="connection-actions"><button className="text-button" onClick={() => detail(skill.id)}>{copy.inspect}</button><button className="text-button danger-button" onClick={() => remove(skill.id)}>{copy.delete}</button></div></article>)}</section>
    {selected && <div className="modal-backdrop"><section ref={reviewRef} className="modal skill-review-modal" role="dialog" aria-modal="true" aria-label={selected.name}><button className="close" onClick={() => setSelected(null)} aria-label={localeText('Close skill review', 'Cerrar revisión')}><X size={18}/></button>{notice && <p className="run-notice" role="alert">{notice}</p>}<p className="eyebrow">{text.review}</p><h2>{selected.name}</h2><section className="skill-purpose"><strong>{text.purpose}</strong><p>{selected.description || text.defaultPurpose}</p><small>{selected.category || text.community} · {selected.preferredModel || text.compatible}</small></section><p className="empty-copy">{text.source} {selected.sourceUrl}<br/>{text.package} {selected.bundleSize || 1} {text.file}{(selected.bundleSize || 1) === 1 ? '' : 's'} · {text.integrity} {selected.contentHash?.slice(0, 16)}…</p><p className="audit-warning">{text.inactiveWarning}</p>{selected.warningFlags?.length > 0 && <section className="skill-warning"><strong>{text.reviewWarning}</strong><ul>{selected.warningFlags.map(flag => <li key={flag}><b>{flag}</b><span>{riskExplanation(flag)}</span></li>)}</ul></section>}{selected.status === 'blocked' && <section className="skill-blocked"><strong>{text.blockedWhy}</strong><p>{text.blockedDetail}</p><ul>{(selected.blockingFlags?.length ? selected.blockingFlags : selected.riskFlags || []).map(flag => <li key={flag}><b>{flag}</b><span>{riskExplanation(flag)}</span></li>)}</ul></section>}<p className="eyebrow">{text.packageContents}</p>{selected.bundleFiles?.length > 1 && <div className="skill-bundle-files">{selected.bundleFiles.map(file => <details key={file.path} open={file.main}><summary>{file.path}{file.main && <em>{text.mainInstructions}</em>}</summary>{file.encoding === 'base64' ? <p className="empty-copy">{localeText(`Binary asset · ${file.byteSize || 'unknown'} bytes · included in the native skill package`, `Recurso binario · ${file.byteSize || 'desconocido'} bytes · incluido en el paquete nativo`)}</p> : <pre>{file.content}</pre>}</details>)}</div>}<p className="eyebrow">{text.roleInstructions}</p><pre className="skill-prompt-preview">{selected.systemPrompt}</pre><div className="connection-actions"><button className="text-button danger-button" disabled={reviewBusy} onClick={() => remove(selected.id)}>{text.deleteLocal}</button>{selected.status === 'blocked' && <button className="text-button" disabled={reviewBusy} onClick={reassess}>{text.reassess}</button>}{selected.status === 'pending_review' && <button className="new-button" disabled={reviewBusy} onClick={approve}>{selected.warningFlags?.length ? text.approveWarnings : copy.approve} <Check size={15}/></button>}</div></section></div>}
  </section>;
}
function formatLastUpdated(timestamp) {
  const spanish = typeof document !== 'undefined' && document.documentElement.lang === 'es';
  if (!timestamp) return spanish ? 'Sin actividad todavía' : 'No activity yet';
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return spanish ? 'Sin actividad todavía' : 'No activity yet';

  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) return spanish ? 'Actualizado hoy' : 'Updated today';

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();
  if (isYesterday) return spanish ? 'Actualizado ayer' : 'Updated yesterday';

  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays >= 1 && diffDays < 7) return spanish ? `Actualizado hace ${diffDays} d` : `Updated ${diffDays}d ago`;

  return spanish
    ? `Actualizado ${date.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })}`
    : `Updated ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

function ProjectCard({project, copy, onSelect}) { return <button className={`project-card ${project.color}`} onClick={() => onSelect(project)}><div className="card-top"><span className="status">{project.status}</span><MoreHorizontal size={18}/></div><div className="project-main"><p>{project.kind}</p><h3>{project.name}</h3><span className="next">{project.next}</span></div><div className="progress-info"><div><span>{copy.progressLabel}</span><b>{project.progress}%</b></div><div className="progress"><i style={{width: `${project.progress}%`}}/></div></div><div className="card-foot"><div className="avatar small">{project.owner}</div><span>{formatLastUpdated(project.lastUpdatedAt)}</span><ArrowUpRight size={17}/></div></button> }
function taskRunMatches(run, projectId, taskTitle, taskIndex) {
  if (run.projectId !== projectId) return false;
  const indexMatches = Number.isInteger(run.taskIndex) && run.taskIndex === taskIndex && (!run.taskTitle || run.taskTitle === taskTitle);
  const titleMatches = Boolean(run.taskTitle && run.taskTitle === taskTitle);
  return indexMatches || titleMatches;
}

function getTaskRunState(runs, project, taskTitle, taskIndex, completed) {
  const relatedRuns = (runs || []).filter(run => taskRunMatches(run, project.id, taskTitle, taskIndex))
    .sort((a, b) => String(b.createdAt || b.finishedAt || '').localeCompare(String(a.createdAt || a.finishedAt || '')));
  const active = relatedRuns.find(run => ['queued', 'running', 'streaming', 'repairing'].includes(run.status));
  // A live run always takes priority. Once it is finished, only the newest
  // associated attempt controls the task state; an old failure must not keep
  // a task in the attention queue after a later successful attempt.
  const run = active || relatedRuns[0] || null;
  if (completed) return { group: 'completed', run };
  if (run?.status === 'awaiting_input') return { group: 'attention', action: 'respond', run };
  if (run?.status === 'awaiting_review') return { group: 'attention', action: 'review', run };
  if (['failed', 'error', 'cancelled', 'needs_model'].includes(run?.status)) return { group: 'attention', action: 'retry', run };
  if (active) return { group: 'inProgress', action: 'progress', run: active };
  return { group: 'todo', action: 'start', run };
}

function taskStateDescription(runState) {
  if (runState.group === 'completed') return localeText('Completed — this is tracked separately from any agent run.', 'Completada — esto se registra aparte de cualquier ejecución del agente.');
  if (runState.action === 'respond') return localeText('Waiting for your response before the agent can continue.', 'Esperando tu respuesta antes de que el agente pueda continuar.');
  if (runState.action === 'review') return localeText('Ready for your review and approval.', 'Lista para tu revisión y aprobación.');
  if (runState.action === 'retry') return localeText('The latest attempt needs review before retrying.', 'El último intento necesita revisión antes de reintentarlo.');
  if (runState.action === 'progress') return localeText('An agent is currently working on this task.', 'Un agente está trabajando actualmente en esta tarea.');
  return localeText('Ready to start when you are.', 'Lista para empezar cuando quieras.');
}

function TaskDetailModal({ project, task, runs = [], onClose, onRunTask, onInspectRun }) {
  const dialogRef = useDialogFocus(onClose);
  const [detail, setDetail] = useState(null);
  const [notice, setNotice] = useState('');
  const [starting, setStarting] = useState(false);
  const runState = getTaskRunState(runs, project, task.title, task.index, Boolean(detail?.completed));
  useEffect(() => {
    fetch(`/api/projects/${project.id}/tasks/${task.index}/explain`).then(response => response.ok ? response.json() : null).then(body => setDetail(body?.task || null)).catch(() => setDetail(null));
  }, [project.id, task.index]);
  const startTask = async () => {
    if (onRunTask) {
      onClose();
      onRunTask(project, [task.title, detail?.due || '', false], task.index, detail?.suggestedPrompt);
      return;
    }
    if (!detail?.suggestedPrompt) return;
    setStarting(true); setNotice('');
    try {
      const response = await fetch('/api/runs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: project.id, provider: 'auto', prompt: detail.suggestedPrompt, taskIndex: task.index, taskTitle: task.title }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || localeText('Could not start this task.', 'No se pudo iniciar esta tarea.'));
      setNotice(localeText('✓ Agent started in an isolated workspace. You can follow it in Orbit.', '✓ Agente iniciado en un espacio aislado. Puedes seguirlo en Orbit.'));
    } catch (error) { setNotice(error.message); } finally { setStarting(false); }
  };
  return <div className="modal-backdrop"><section ref={dialogRef} className="modal task-detail-modal" role="dialog" aria-modal="true" aria-label={task.title}><button className="close" onClick={onClose} aria-label={localeText('Close task details', 'Cerrar detalles de tarea')}><X size={18}/></button><p className="eyebrow">{localeText('TASK EXPLAINED', 'TAREA EXPLICADA')}</p><h2>{task.title}</h2>{detail ? <><section className="task-detail-section"><strong>{localeText('What this task does', 'Qué hace esta tarea')}</strong><p>{detail.description}</p></section><section className="task-detail-section"><strong>{localeText('Why it matters', 'Para qué sirve')}</strong><p>{detail.purpose}</p></section><p className="task-detail-status">{taskStateDescription(runState)}</p><small className="task-detail-meta">{detail.completed ? localeText('Completed', 'Completada') : localeText('Planned for', 'Planificada para')} · {detail.due}</small><div className="task-detail-actions">{runState.run && <button className="text-button" type="button" onClick={() => { onClose(); onInspectRun?.(runState.run); }}><Activity size={14}/>{localeText('Open latest run', 'Abrir última ejecución')}</button>}{!detail.completed && <button className="new-button" disabled={starting || runState.action !== 'start'} onClick={startTask}><Sparkles size={14}/>{starting ? localeText('Starting agent…', 'Iniciando agente…') : localeText('Configure & run with agent', 'Configurar y ejecutar con agente')}</button>}</div></> : <p className="empty-copy">{localeText('Loading a clear explanation for this task…', 'Cargando una explicación clara de esta tarea…')}</p>}{notice && <p className="run-notice">{notice}</p>}</section></div>;
}
function TaskRow({task, project, onToggle, onRunTask, runs = [], onInspectRun, index = 0}) {
  const copy = typeof document !== 'undefined' && document.documentElement.lang === 'es' ? dictionaries.es : dictionaries.en;
  const [detailsOpen, setDetailsOpen] = useState(false);
  const title = Array.isArray(task) ? task[0] : task?.title || '';
  const due = Array.isArray(task) ? task[1] : task?.due || '';
  const completed = Boolean(Array.isArray(task) ? task[2] : task?.completed);

  const runState = getTaskRunState(runs, project, title, index, completed);
  const activeRun = runState.run;

  return (
    <>
      <div className="task-row">
        <button aria-label={copy.completeTask} onClick={onToggle} className={completed ? 'check checked' : 'check'}>
          {completed && <Check size={13}/>}
        </button>
        <button className="task-copy task-details-trigger" type="button" onClick={() => setDetailsOpen(true)}>
          <strong className={completed ? 'done' : ''}>{title}</strong>
          <span><i className={`mini-dot ${project.color}`}/>{project.name}</span>
        </button>
        <div className="task-action-cell">
          {completed ? (
            <span className="task-completed-badge"><Check size={11}/> {copy.taskCompleted}</span>
          ) : runState.action === 'review' ? (
            <button
              type="button"
              className="task-review-badge"
              onClick={() => onInspectRun ? onInspectRun(activeRun) : setDetailsOpen(true)}
              title={copy.taskInReview}
            >
              <Eye size={11}/> <span>{copy.taskInReview}</span>
            </button>
          ) : runState.action === 'respond' || runState.action === 'progress' ? (
            <button
              type="button"
              className="task-running-badge"
              onClick={() => onInspectRun ? onInspectRun(activeRun) : setDetailsOpen(true)}
              title={runState.action === 'respond' ? localeText('Respond to the agent', 'Responder al agente') : localeText('View progress', 'Ver progreso')}
            >
              <span className="pulse-dot"/> <span>{runState.action === 'respond' ? localeText('Respond', 'Responder') : localeText('View progress', 'Ver progreso')}</span>
            </button>
          ) : runState.action === 'retry' ? (
            <button
              type="button"
              className="task-failed-badge"
              onClick={() => onInspectRun ? onInspectRun(activeRun) : setDetailsOpen(true)}
              title={localeText('Review the failure and retry', 'Revisa el fallo y vuelve a intentar')}
            >
              <AlertCircle size={11}/> <span>{localeText('Review & retry', 'Revisar y reintentar')}</span>
            </button>
          ) : (
            <button
              type="button"
              className="task-run-btn"
              onClick={(e) => { e.stopPropagation(); onRunTask ? onRunTask(project, task, index) : setDetailsOpen(true); }}
              title={copy.runTask}
            >
              <Play size={10} fill="currentColor"/> <span>{localeText('Start', 'Iniciar')}</span>
            </button>
          )}
        </div>
        <span className="due">{due}</span>
        <button className="task-more" type="button" onClick={() => setDetailsOpen(true)} aria-label={copy.moreTaskOptions.replace('{task}', title)}>
          <MoreHorizontal size={18}/>
        </button>
      </div>
      {detailsOpen && <TaskDetailModal project={project} task={{ title, index }} runs={runs} onClose={() => setDetailsOpen(false)} onRunTask={onRunTask} onInspectRun={onInspectRun}/>}
    </>
  );
}

function TaskAddRow({ project, copy, onRefresh, onRunTask }) {
  const [title, setTitle] = useState('');
  const [suggesting, setSuggesting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [notice, setNotice] = useState('');

  const handleAdd = async (taskTitle = title, taskDue = 'Next sprint', desc, purp) => {
    const trimmed = (taskTitle || '').trim();
    if (!trimmed || adding) return null;
    setAdding(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed, due: taskDue, description: desc, purpose: purp })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || localeText('Could not add this task.', 'No se pudo añadir esta tarea.'));
      setTitle('');
      setSuggestions(cur => cur.filter(s => s.title !== taskTitle));
      setNotice(copy.taskAddedSuccess || 'Task added.');
      setTimeout(() => setNotice(''), 3000);
      await onRefresh?.();
      return { task: body.task || [trimmed, taskDue, false], index: Number.isInteger(body.taskIndex) ? body.taskIndex : (project.tasks || []).length };
    } catch (error) {
      setNotice(error.message);
      return null;
    } finally {
      setAdding(false);
    }
  };

  const handleSuggest = async () => {
    setSuggesting(true);
    setNotice('');
    try {
      const res = await fetch(`/api/projects/${project.id}/tasks/suggest`, { method: 'POST' });
      const data = await res.json();
      if (data.ok && Array.isArray(data.suggestions)) {
        setSuggestions(data.suggestions);
      }
    } catch (error) { setNotice(error.message || localeText('Could not suggest tasks.', 'No se pudieron sugerir tareas.')); }
    finally {
      setSuggesting(false);
    }
  };

  return (
    <div className="task-add-container">
      <div className="task-add-row">
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
          placeholder={copy.taskPlaceholder || localeText('Enter a new task…', 'Escribe una nueva tarea…')}
        />
        <button
          type="button"
          className="task-add-btn"
          disabled={adding || !title.trim()}
          onClick={() => handleAdd()}
        >
          <Plus size={13}/> {copy.addTask}
        </button>
        <button
          type="button"
          className="task-suggest-btn"
          disabled={suggesting || adding}
          onClick={handleSuggest}
        >
          <Sparkles size={13}/> {suggesting ? copy.suggestingTasks : copy.suggestTasks}
        </button>
      </div>

      {notice && <p className="task-add-notice">{notice}</p>}

      {suggestions.length > 0 && (
        <div className="task-suggestions-list">
          <p className="eyebrow" style={{ margin: '8px 0 6px' }}>{copy.suggestTasks}</p>
          {suggestions.map((s, idx) => (
            <div className="task-suggestion-card" key={idx}>
              <div>
                <strong>{s.title}</strong>
                <small>{s.description || s.purpose}</small>
              </div>
              <div className="task-suggestion-actions">
                <button
                  type="button"
                  className="text-button"
                  onClick={() => handleAdd(s.title, s.due, s.description, s.purpose)}
                >
                  <Plus size={12}/> {copy.addTask}
                </button>
                <button
                  type="button"
                  className="new-button"
                  style={{ height: 28, fontSize: 11, padding: '0 8px' }}
                  onClick={async () => {
                    const added = await handleAdd(s.title, s.due, s.description, s.purpose);
                    if (added) onRunTask?.(project, added.task, added.index);
                  }}
                >
                  <Play size={10} fill="currentColor"/> {copy.runTaskShort}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectTaskGroups({ project, runs, copy, onToggle, onRunTask, onInspectRun, onRefresh }) {
  const groups = [
    { id: 'attention', title: localeText('Needs attention', 'Necesita atención'), detail: localeText('A response, review, or retry is needed.', 'Hace falta una respuesta, revisión o reintento.') },
    { id: 'inProgress', title: localeText('In progress', 'En progreso'), detail: localeText('Agents are working in isolated workspaces.', 'Los agentes están trabajando en espacios aislados.') },
    { id: 'todo', title: localeText('To do', 'Por hacer'), detail: localeText('Planned work that has not started yet.', 'Trabajo planificado que aún no ha empezado.') },
    { id: 'completed', title: localeText('Completed', 'Completadas'), detail: localeText('Finished project tasks.', 'Tareas finalizadas del proyecto.') }
  ];
  const grouped = groups.map(group => ({
    ...group,
    tasks: (project.tasks || []).map((task, index) => ({ task, index, state: getTaskRunState(runs, project, projectTaskTitle(task), index, projectTaskDone(task)) }))
      .filter(item => item.state.group === group.id)
  })).filter(group => group.tasks.length);

  return <section className="project-task-groups">
    {grouped.length ? grouped.map(group => <details key={group.id} className={`project-task-group ${group.id}`} open={group.id !== 'completed'}>
      <summary><span><strong>{group.title}</strong><small>{group.detail}</small></span><b>{group.tasks.length}</b><ChevronDown size={15}/></summary>
      <div className="project-task-group-items">{group.tasks.map(({ task, index }) => <TaskRow key={index} task={task} project={project} index={index} runs={runs} onRunTask={onRunTask} onInspectRun={onInspectRun} onToggle={() => onToggle(project.id, index)}/>)}</div>
    </details>) : <div className="inbox-empty project-task-empty"><div>✓</div><h3>{localeText('No tasks yet', 'Aún no hay tareas')}</h3><p>{localeText('Add the first concrete outcome for this project below.', 'Añade abajo el primer resultado concreto para este proyecto.')}</p></div>}
    <TaskAddRow project={project} copy={copy} onRefresh={onRefresh} onRunTask={onRunTask}/>
  </section>;
}

function LegacyTasksPage({ projects, runs, copy, onToggleTask, onRunTask, onInspectRun, onRefresh }) {
  const [filter, setFilter] = useState('pending');
  const [selectedProject, setSelectedProject] = useState('all');
  const [quickTitle, setQuickTitle] = useState('');
  const [quickProjectId, setQuickProjectId] = useState(projects[0]?.id || '');
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [notice, setNotice] = useState('');
  const suggestionRequest = useRef(0);
  const suggestionProject = useRef('');
  const suggestionProjectId = quickProjectId || projects[0]?.id || '';
  suggestionProject.current = suggestionProjectId;
  useEffect(() => {
    suggestionRequest.current += 1;
    setSuggestions([]);
    setSuggesting(false);
    return () => { suggestionRequest.current += 1; };
  }, [suggestionProjectId]);

  const allTasks = useMemo(() => {
    return projects.flatMap(project =>
      (project.tasks || []).map((task, index) => ({
        project,
        task,
        index,
        title: Array.isArray(task) ? task[0] : task?.title || '',
        due: Array.isArray(task) ? task[1] : task?.due || '',
        completed: Boolean(Array.isArray(task) ? task[2] : task?.completed)
      }))
    );
  }, [projects]);

  const filteredTasks = useMemo(() => {
    return allTasks.filter(item => {
      if (selectedProject !== 'all' && item.project.id !== selectedProject) return false;
      if (filter === 'pending') return !item.completed;
      if (filter === 'completed') return item.completed;
      return true;
    });
  }, [allTasks, filter, selectedProject]);

  const pendingCount = allTasks.filter(t => !t.completed).length;
  const completedCount = allTasks.filter(t => t.completed).length;

  const handleQuickAdd = async (taskTitle = quickTitle, taskDue = 'Next sprint', desc, purp, requestedProjectId) => {
    const trimmed = (taskTitle || '').trim();
    const targetId = requestedProjectId || quickProjectId || projects[0]?.id;
    if (!trimmed || !targetId) return false;
    try {
      const res = await fetch(`/api/projects/${targetId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed, due: taskDue, description: desc, purpose: purp })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || localeText('Could not add this task.', 'No se pudo agregar esta tarea.'));
      if (res.ok) {
        if (suggestionProject.current === targetId) {
          setQuickTitle(current => current.trim() === trimmed ? '' : current);
          setNotice(copy.taskAddedSuccess || 'Task added.');
        }
        setSuggestions(cur => cur.filter(s => s.projectId !== targetId || s.title !== taskTitle));
        onRefresh?.();
        return true;
      }
    } catch (error) { setNotice(error.message); return false; }
  };

  const handleSuggest = async () => {
    const targetId = quickProjectId || projects[0]?.id;
    if (!targetId) return;
    const requestId = ++suggestionRequest.current;
    setSuggesting(true);
    setNotice('');
    try {
      const res = await fetch(`/api/projects/${targetId}/tasks/suggest`, { method: 'POST' });
      const data = await res.json();
      if (suggestionRequest.current !== requestId || suggestionProject.current !== targetId) return;
      if (!res.ok) throw new Error(data.error || localeText('Could not suggest tasks.', 'No se pudieron sugerir tareas.'));
      if (data.ok && Array.isArray(data.suggestions)) {
        setSuggestions(data.suggestions.map(suggestion => ({ ...suggestion, projectId: targetId })));
      }
    } catch (error) { if (suggestionRequest.current === requestId) setNotice(error.message); }
    finally {
      if (suggestionRequest.current === requestId) setSuggesting(false);
    }
  };

  return (
    <section className="panel task-page-full">
      <div className="task-page-header">
        <div>
          <p className="eyebrow">{copy.tasks}</p>
          <h2>{copy.needsProgress} ({pendingCount})</h2>
        </div>
        <div className="task-filter-chips">
          <button
            type="button"
            className={`filter-chip ${filter === 'pending' ? 'active' : ''}`}
            onClick={() => setFilter('pending')}
          >
            {copy.filterPending} ({pendingCount})
          </button>
          <button
            type="button"
            className={`filter-chip ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            {copy.filterAll} ({allTasks.length})
          </button>
          <button
            type="button"
            className={`filter-chip ${filter === 'completed' ? 'active' : ''}`}
            onClick={() => setFilter('completed')}
          >
            {copy.filterCompleted} ({completedCount})
          </button>
          <select
            value={selectedProject}
            onChange={e => setSelectedProject(e.target.value)}
            className="task-project-select"
          >
            <option value="all">{copy.allProjectsFilter}</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="task-quick-add-bar">
        <select
          value={quickProjectId || projects[0]?.id}
          onChange={e => setQuickProjectId(e.target.value)}
          className="task-project-select"
          style={{ width: 'auto', minWidth: 140 }}
        >
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <input
          type="text"
          value={quickTitle}
          onChange={e => setQuickTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleQuickAdd(); }}
          placeholder={copy.taskPlaceholder || 'Escribe una nueva tarea...'}
        />
        <button
          type="button"
          className="new-button"
          disabled={!quickTitle.trim()}
          onClick={() => handleQuickAdd()}
        >
          <Plus size={14}/> {copy.addTask}
        </button>
        <button
          type="button"
          className="task-suggest-btn"
          disabled={suggesting}
          onClick={handleSuggest}
        >
          <Sparkles size={14}/> {suggesting ? copy.suggestingTasks : copy.suggestTasks}
        </button>
      </div>

      {notice && <p className="task-add-notice">{notice}</p>}

      {suggestions.length > 0 && (
        <div className="task-suggestions-list" style={{ margin: '14px 0' }}>
          <p className="eyebrow" style={{ margin: '4px 0 8px' }}>{copy.suggestTasks}</p>
          {suggestions.map((s, idx) => {
            const targetP = projects.find(p => p.id === s.projectId);
            return (
              <div className="task-suggestion-card" key={idx}>
                <div>
                  <strong>{s.title}</strong>
                  <small>{s.description || s.purpose}</small>
                </div>
                <div className="task-suggestion-actions">
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => handleQuickAdd(s.title, s.due, s.description, s.purpose, s.projectId)}
                  >
                    <Plus size={12}/> {copy.addTask}
                  </button>
                  <button
                    type="button"
                    className="new-button"
                    style={{ height: 28, fontSize: 11, padding: '0 8px' }}
                    onClick={async () => {
                      const added = await handleQuickAdd(s.title, s.due, s.description, s.purpose, s.projectId);
                      if (added && targetP) {
                        onRunTask?.(targetP, [s.title, s.due, false], (targetP.tasks || []).length);
                      }
                    }}
                  >
                    <Play size={10} fill="currentColor"/> {copy.runTaskShort}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="task-list-container">
        {filteredTasks.length ? (
          filteredTasks.map(({ project, task, index }) => (
            <TaskRow
              key={`${project.id}-${index}`}
              task={task}
              project={project}
              index={index}
              runs={runs}
              onRunTask={onRunTask}
              onInspectRun={onInspectRun}
              onToggle={() => onToggleTask(project.id, index)}
            />
          ))
        ) : (
          <div className="inbox-empty" style={{ minHeight: 200, margin: '20px 0' }}>
            <div style={{ width: 40, height: 40, fontSize: 18 }}>✓</div>
            <h3>{filter === 'completed' ? localeText('No completed tasks yet', 'Aún no hay tareas completadas') : copy.allTasksResolved}</h3>
            <p>{filter === 'completed' ? localeText('Tasks completed by you or merged agents will appear here.', 'Las tareas completadas por ti o fusionadas por agentes aparecerán aquí.') : copy.allTasksResolvedDetail}</p>
          </div>
        )}
      </div>
    </section>
  );
}

function ProjectGitHistory({ project, copy }) {
  const [history, setHistory] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setHistory(null); setError('');
    fetch(`/api/projects/${project.id}/history`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error(localeText('Project history could not load.', 'No se pudo cargar el historial del proyecto.'));
        const body = await response.json();
        if (!Array.isArray(body.commits) || !Array.isArray(body.pulls)) throw new Error(localeText('Project history is unavailable.', 'El historial del proyecto no está disponible.'));
        if (!controller.signal.aborted) setHistory(body);
      }).catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [project.id]);
  if (error) return <p className="empty-copy" role="alert">{error}</p>;
  if (!history) return <p className="empty-copy">{copy.gitHistoryLoading}</p>;
  return <>{history.commits.map(commit => <div className="history-item" key={commit.hash}><span className="run-status awaiting_review"/><div><strong>{commit.message}</strong><small>{commit.hash} · {commit.author}</small></div></div>)}{history.pulls.map(pr => <div className="history-item" key={`pr-${pr.number}`}><span className="run-status awaiting_input"/><div><strong>PR #{pr.number}: {pr.title}</strong><small>{pr.state} · GitHub</small></div></div>)}{!history.commits.length && !history.pulls.length && <p className="empty-copy">{copy.gitHistoryEmpty}</p>}</>;
}
function ProjectModal({ project, runs, copy, onPreview, onLogo, onBrain, onAdvisor, onSecurity, onClose, onToggle, onRunTask, onInspectRun, onRefresh }) {
  const dialogRef = useDialogFocus(onClose);
  const [activeTab, setActiveTab] = useState('overview');
  const [brief, setBrief] = useState(null);
  const [customTaskOpen, setCustomTaskOpen] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [simulating, setSimulating] = useState(false);
  const [simulatedFeedback, setSimulatedFeedback] = useState([]);
  const [deploymentProject, setDeploymentProject] = useState(null);
  const [notice, setNotice] = useState('');
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [removingProject, setRemovingProject] = useState(false);
  const projectRuns = runs.filter(run => run.projectId === project.id).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  const liveProjectRuns = projectRuns.filter(run => ['queued', 'running', 'streaming', 'awaiting_input', 'repairing'].includes(run.status));
  const pendingTask = (project.tasks || []).find(task => !projectTaskDone(task));
  const nextTitle = projectTaskTitle(pendingTask) || brief?.nextStep?.title || localeText('Choose the next milestone', 'Define el siguiente hito');
  const state = projectDisplayState(project, projectRuns);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/projects/${project.id}/summary-brief`, { signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(result => result && setBrief(result))
      .catch(() => {});
    return () => controller.abort();
  }, [project.id]);

  const startTask = (title, prompt) => {
    onClose();
    onRunTask?.(project, title, undefined, prompt);
  };
  const copyClientLink = async () => {
    setNotice('');
    try {
      const response = await fetch(`/api/projects/${project.id}/share-link`, { method: 'POST' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || copy.clientLinkError);
      await navigator.clipboard.writeText(new URL(body.path, window.location.origin).toString());
      setNotice(copy.clientLinkCopied);
    } catch (error) { setNotice(error.message || copy.clientLinkError); }
  };
  const simulateUsers = async () => {
    setSimulating(true); setNotice('');
    try {
      const response = await fetch(`/api/projects/${project.id}/simulate-users`, { method: 'POST' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || localeText('User simulation failed.', 'La simulación de usuarios falló.'));
      setSimulatedFeedback(body.feedback || []);
    } catch (error) { setNotice(error.message); }
    finally { setSimulating(false); }
  };
  const removeProject = async () => {
    if (removingProject) return;
    setRemovingProject(true); setNotice('');
    try {
      const response = await fetch(`/api/projects/${project.id}`, { method: 'DELETE' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || localeText('Project could not be removed from Orbit.', 'No se pudo eliminar el proyecto de Orbit.'));
      onClose();
      await onRefresh?.();
    } catch (error) {
      setNotice(error.message);
      setRemovingProject(false);
    }
  };

  const tabs = [
    ['overview', localeText('Overview', 'Resumen')],
    ['tasks', localeText('Tasks', 'Tareas')],
    ['preview', localeText('Preview & delivery', 'Vista previa y entrega')],
    ['launch', localeText('Launch review', 'Revisión de lanzamiento')],
    ['settings', localeText('Settings', 'Ajustes')]
  ];

  return <div className="modal-backdrop">
    <section ref={dialogRef} className={`modal detail-modal project-workspace-modal ${project.color}`} role="dialog" aria-modal="true" aria-label={project.name}>
      <button className="close" onClick={onClose} aria-label={localeText('Close project details', 'Cerrar detalles del proyecto')}><X size={18}/></button>
      <header className="project-workspace-header">
        <div><div className="project-workspace-kicker"><span className={`project-state-pill ${state.tone}`}>{state.label}</span><span>{project.kind}</span><span>{formatLastUpdated(project.lastUpdatedAt)}</span></div><h2>{project.name}</h2><p>{project.summary || brief?.description || copy.projectWorkspace}</p></div>
        <div className="project-workspace-progress"><strong>{project.progress || 0}%</strong><span>{copy.overallProgress}</span><div className="progress"><i style={{ width: `${project.progress || 0}%` }}/></div></div>
      </header>
      <nav className="project-workspace-tabs" aria-label={localeText('Project sections', 'Secciones del proyecto')}>
        {tabs.map(([id, label]) => <button key={id} type="button" className={activeTab === id ? 'active' : ''} aria-current={activeTab === id ? 'page' : undefined} onClick={() => setActiveTab(id)}>{label}</button>)}
      </nav>

      <div className="project-workspace-content">
        {activeTab === 'overview' && <>
          <section className="project-overview-grid">
            <article className="project-focus-card"><p className="eyebrow">{copy.nextStepRec}</p><h3>{nextTitle}</h3><p>{brief?.nextStep?.title === nextTitle ? brief.nextStep.explanation : localeText('This is the first unfinished task in the project plan.', 'Esta es la primera tarea pendiente del plan del proyecto.')}</p><button className="new-button" type="button" onClick={() => startTask(nextTitle, brief?.nextStep?.title === nextTitle ? brief.nextStep.prompt : `Work on this project task: ${nextTitle}. Inspect the existing implementation, make the required changes, and verify the result.`)}><Sparkles size={14}/>{copy.startStepBtn}</button></article>
            <article className="project-context-card"><p className="eyebrow">{copy.whereAreWe}</p><div><CheckCircle2 size={15}/><span><strong>{(project.tasks || []).filter(projectTaskDone).length}</strong>{localeText(' tasks complete', ' tareas completadas')}</span></div><div><Clock size={15}/><span><strong>{(project.tasks || []).filter(task => !projectTaskDone(task)).length}</strong>{localeText(' tasks pending', ' tareas pendientes')}</span></div><button className="brain-launch" type="button" onClick={() => onBrain(project)}><Brain size={15}/>{copy.brain}</button></article>
          </section>
          <div className="project-primary-actions"><button className="new-button" type="button" onClick={() => setCustomTaskOpen(open => !open)}><Sparkles size={14}/>{localeText('Start a different agent task', 'Iniciar otra tarea con agente')}</button>{liveProjectRuns.length > 0 && <span className="project-live-count"><span className="pulse-dot"/>{liveProjectRuns.length} {localeText('agent(s) working', 'agente(s) trabajando')}</span>}</div>
          {customTaskOpen && <form className="project-custom-task" onSubmit={event => { event.preventDefault(); const prompt = customPrompt.trim(); if (prompt) startTask(prompt.slice(0, 52), prompt); }}><label>{localeText('What would you like the agent to do?', '¿Qué quieres que haga el agente?')}<textarea autoFocus value={customPrompt} onChange={event => setCustomPrompt(event.target.value)} placeholder={localeText('Describe a new outcome for this project…', 'Describe un nuevo resultado para este proyecto…')} rows={3}/></label><button className="new-button" disabled={!customPrompt.trim()} type="submit"><Send size={14}/>{localeText('Configure in Agent Console', 'Configurar en Consola de Agentes')}</button></form>}
          {liveProjectRuns.length > 0 && <section className="project-live-agents"><p className="eyebrow">{localeText('LIVE AGENTS', 'AGENTES EN VIVO')}</p>{liveProjectRuns.map(run => <button type="button" className="project-live-agent" key={run.id} onClick={() => onInspectRun(run)}><span className={`run-status ${run.status}`}/><span><strong>{providerName(run.provider)}</strong><small>{run.prompt}</small></span><Activity size={15}/></button>)}</section>}
          <details className="project-history-disclosure"><summary>{localeText('Recent activity and repository history', 'Actividad reciente e historial del repositorio')}<ChevronDown size={15}/></summary><div className="project-activity"><p className="eyebrow">{copy.orbitHistory}</p>{projectRuns.slice(0, 8).map(run => <button className="history-item history-item-button" type="button" key={run.id} onClick={() => onInspectRun(run)}><span className={`run-status ${run.status}`}/><div><strong>{run.prompt}</strong><small>{providerName(run.provider)} · {String(run.status).replaceAll('_', ' ')} · {formatLastUpdated(run.createdAt || run.finishedAt)}</small></div></button>)}{!projectRuns.length && <p className="empty-copy">{copy.noAgentWork}</p>}</div><div className="project-activity"><p className="eyebrow">{copy.importedHistory}</p><ProjectGitHistory project={project} copy={copy}/></div></details>
        </>}

        {activeTab === 'tasks' && <section className="project-task-workspace"><div className="project-section-heading"><div><p className="eyebrow">{copy.projectTasks}</p><h3>{localeText('The project plan, one clear step at a time.', 'El plan del proyecto, un paso claro a la vez.')}</h3></div><span>{(project.tasks || []).filter(task => !projectTaskDone(task)).length} {copy.pendingCount}</span></div><ProjectTaskGroups project={project} runs={projectRuns} copy={copy} onToggle={onToggle} onRunTask={onRunTask} onInspectRun={onInspectRun} onRefresh={onRefresh}/></section>}

        {activeTab === 'preview' && <section className="project-tool-grid">
          <button type="button" onClick={() => onPreview(project)} disabled={project.mode !== 'connected'}><Eye size={20}/><span><strong>{copy.livePreview}</strong><small>{localeText('Open the application in mobile or desktop view.', 'Abre la aplicación en vista móvil o de escritorio.')}</small></span><ChevronRight size={16}/></button>
          <button type="button" onClick={() => setDeploymentProject(project)} disabled={project.mode !== 'connected'}><Rocket size={20}/><span><strong>{localeText('Deploy', 'Publicar')}</strong><small>{localeText('Choose Vercel, Cloudflare, Netlify, or a custom target.', 'Elige Vercel, Cloudflare, Netlify o un destino personalizado.')}</small></span><ChevronRight size={16}/></button>
          <button type="button" onClick={copyClientLink}><Copy size={20}/><span><strong>{copy.clientPortal}</strong><small>{localeText('Create a safe progress link without exposing code or secrets.', 'Crea un enlace seguro de avance sin exponer código ni secretos.')}</small></span><ChevronRight size={16}/></button>
          <button type="button" onClick={() => onLogo(project)}><Sparkles size={20}/><span><strong>{copy.createLogo}</strong><small>{localeText('Generate a reviewed SVG brand asset.', 'Genera un recurso SVG de marca revisado.')}</small></span><ChevronRight size={16}/></button>
          <button type="button" onClick={simulateUsers} disabled={simulating}><FlaskConical size={20}/><span><strong>{simulating ? copy.simulatingUsers : copy.simulateUsers}</strong><small>{localeText('Get three user-perspective reactions before delivery.', 'Obtén reacciones desde tres perspectivas de usuario antes de entregar.')}</small></span><ChevronRight size={16}/></button>
          {project.deployedUrl && <a href={project.deployedUrl} target="_blank" rel="noreferrer"><ExternalLink size={20}/><span><strong>{localeText('Open live site', 'Abrir sitio publicado')}</strong><small>{project.deployedUrl}</small></span><ChevronRight size={16}/></a>}
          {simulatedFeedback.length > 0 && <div className="simulation-results">{simulatedFeedback.map((item, index) => <article key={index}><strong>{item.persona}<span>{item.score}/10</span></strong><p>{item.feedback}</p></article>)}</div>}
        </section>}

        {activeTab === 'launch' && <section className="launch-review-entry"><div className="launch-review-icon"><ShieldCheck size={26}/></div><p className="eyebrow">{copy.launchArmorShort}</p><h3>{localeText('Review evidence before calling this project ready.', 'Revisa la evidencia antes de declarar listo este proyecto.')}</h3><p>{localeText('Security Center turns local repository evidence into a clear launch gate: secrets, dependencies, privacy, local Mac exposure, and a downloadable NIST / OWASP / ISO reference map. It does not replace legal advice, a penetration test, or certification.', 'Security Center convierte evidencia local del repositorio en una puerta de lanzamiento clara: secretos, dependencias, privacidad, exposición local del Mac y un mapa descargable de referencia NIST / OWASP / ISO. No reemplaza asesoría legal, pentest o certificación.')}</p><div className="launch-review-actions"><button className="new-button" type="button" onClick={() => onSecurity?.(project)}><ShieldCheck size={15}/>{localeText('Open Security Center', 'Abrir Security Center')}</button><button className="advisor-link-button" type="button" onClick={() => onAdvisor?.(project)}><FileText size={14}/>{localeText('Launch review details', 'Detalles de revisión de lanzamiento')}</button></div></section>}

        {activeTab === 'settings' && <section className="project-settings-section">
          <div className="project-section-heading"><div><p className="eyebrow">{localeText('PROJECT SETTINGS', 'AJUSTES DEL PROYECTO')}</p><h3>{localeText('Workspace connection and local project record.', 'Conexión del espacio y registro local del proyecto.')}</h3></div></div>
          <article className="project-settings-card"><div><FolderGit2 size={19}/><span><strong>{localeText('Repository', 'Repositorio')}</strong><small>{project.repoPath || project.githubRepo || localeText('No repository connected', 'Sin repositorio conectado')}</small></span></div><p>{localeText('Orbit only references this repository. Removing the project below never deletes local files or the GitHub repository.', 'Orbit solo hace referencia a este repositorio. Eliminar el proyecto abajo nunca borra archivos locales ni el repositorio de GitHub.')}</p></article>
          <ProjectConnection key={project.id} project={project} copy={copy} refresh={onRefresh}/>
          <article className="project-danger-zone">
            <div><Trash2 size={19}/><span><strong>{localeText('Remove from Orbit', 'Eliminar de Orbit')}</strong><small>{localeText('Remove this project from your Orbit workspace.', 'Elimina este proyecto de tu espacio de Orbit.')}</small></span></div>
            {!removeConfirmOpen ? <button className="project-remove-button" type="button" onClick={() => setRemoveConfirmOpen(true)}><Trash2 size={14}/>{localeText('Remove project…', 'Eliminar proyecto…')}</button> : <div className="project-remove-confirm" role="alert">
              <strong>{localeText(`Remove “${project.name}” from Orbit?`, `¿Eliminar “${project.name}” de Orbit?`)}</strong>
              <p>{localeText('This removes its card and configuration from Orbit. Your local folder, source files, Git history, and GitHub repository will remain untouched.', 'Esto elimina su tarjeta y configuración de Orbit. La carpeta local, archivos, historial Git y repositorio de GitHub permanecerán intactos.')}</p>
              <div><button className="text-button" type="button" disabled={removingProject} onClick={() => setRemoveConfirmOpen(false)}>{localeText('Cancel', 'Cancelar')}</button><button className="project-remove-confirm-button" type="button" disabled={removingProject} onClick={removeProject}>{removingProject ? <RefreshCw size={14} className="spin"/> : <Trash2 size={14}/>} {removingProject ? localeText('Removing…', 'Eliminando…') : localeText('Yes, remove from Orbit', 'Sí, eliminar de Orbit')}</button></div>
            </div>}
          </article>
        </section>}
      </div>
      {notice && <p className="run-notice project-workspace-notice" role="status">{notice}</p>}
    </section>
    {deploymentProject && <DeploymentModal project={deploymentProject} copy={copy} onClose={() => setDeploymentProject(null)} onDeployed={onRefresh}/>}
  </div>;
}

function LegacyProjectModal({ project, runs, copy, onPreview, onLogo, onBrain, onAdvisor, onClose, onToggle, onRunTask, onInspectRun, onRefresh }) {
  const dialogRef = useDialogFocus(onClose);
  const [brief, setBrief] = useState(null);
  const [simulating, setSimulating] = useState(false);
  const [simulatedFeedback, setSimulatedFeedback] = useState([]);
  const [customTaskOpen, setCustomTaskOpen] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [startingCustomTask, setStartingCustomTask] = useState(false);
  const [customTaskNotice, setCustomTaskNotice] = useState('');
  const history = runs.filter(run => run.projectId === project.id).slice(0, 8);
  const liveProjectRuns = runs.filter(run => run.projectId === project.id && ['queued', 'running', 'awaiting_input', 'repairing'].includes(run.status));
  useEffect(() => {
    fetch(`/api/projects/${project.id}/summary-brief`)
      .then(r => r.ok ? r.json() : null)
      .then(setBrief)
      .catch(() => {});
  }, [project.id]);
  return (
    <div className="modal-backdrop">
      <section ref={dialogRef} className={`modal detail-modal project-history ${project.color}`} role="dialog" aria-modal="true" aria-label={project.name}>
        <button className="close" onClick={onClose} aria-label={localeText('Close project details', 'Cerrar detalles del proyecto')}><X size={18}/></button>
        <span className="status">{project.status}</span>
        <p className="eyebrow">{project.kind}</p>
        <h2>{project.name}</h2>
        <small style={{ color: '#667085', fontSize: 11, marginBottom: 8, display: 'block' }}>{formatLastUpdated(project.lastUpdatedAt)}</small>
        <div className="modal-progress">
          <span>{copy.overallProgress}</span>
          <b>{project.progress}%</b>
          <div className="progress"><i style={{width:`${project.progress}%`}}/></div>
        </div>
        <div style={{ background: '#f5faf7', border: '1px solid #d4e8dd', borderRadius: 12, padding: 14, margin: '16px 0' }}>
          <p className="eyebrow" style={{ color: '#2b634b', margin: '0 0 4px' }}>{copy.whatIsProject}</p>
          <p className="empty-copy" style={{ margin: '0 0 10px' }}>{brief?.description || project.summary || copy.projectWorkspace}</p>
          <p className="eyebrow" style={{ color: '#2b634b', margin: '0 0 8px' }}>{copy.whereAreWe}</p>
          <div style={{ marginBottom: 10 }}>
            <strong style={{ fontSize: 11, color: '#1b4332', display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={12}/> {copy.whatCompleted}</strong>
            <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 11, color: '#2d6a4f', lineHeight: 1.5 }}>
              {(brief?.completed || []).map((item, idx) => <li key={idx}>{item}</li>)}
            </ul>
          </div>
          <div>
            <strong style={{ fontSize: 11, color: '#854d0e', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Clock size={12}/> {copy.whatPending}</strong>
            <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 11, color: '#713f12', lineHeight: 1.5 }}>
              {(brief?.pending || []).map((item, idx) => <li key={idx}>{item}</li>)}
            </ul>
          </div>
          {brief?.lastAgent && (
            <p style={{ margin: '10px 0 0', fontSize: 10, color: '#55655e', borderTop: '1px solid #e0ece4', paddingTop: 6, fontStyle: 'italic' }}>
              {brief.lastAgent}
            </p>
          )}
        </div>
        <div className="next-step-card">
          <p className="eyebrow">{copy.nextStepRec}</p>
          <strong>{brief?.nextStep?.title || project.next}</strong>
          <p>{brief?.nextStep?.explanation || copy.nextStepDescription}</p>
          <button className="new-button" onClick={async () => {
            if (onRunTask) {
              onClose();
              onRunTask(project, brief?.nextStep?.title || project.next, undefined, brief?.nextStep?.prompt || `Advance on: ${project.next}`);
              return;
            }
            const response = await fetch('/api/runs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: project.id, provider: 'auto', prompt: brief?.nextStep?.prompt || `Advance on: ${project.next}` }) });
            if (response.ok) { alert(`🚀 ${copy.agentStarted}`); onClose(); } else { const error = await response.json(); alert(`${copy.errorPrefix} ${error.error}`); }
          }}><Sparkles size={14}/>{copy.startStepBtn}</button>
        </div>
        <div className="project-creative-actions">
          <button className="new-button" type="button" onClick={() => setCustomTaskOpen(open => !open)}><Sparkles size={14}/>{localeText('Start a new agent task', 'Iniciar nueva tarea con agente')}</button>
          <button className="brain-launch" type="button" onClick={() => onBrain(project)}><Brain size={15}/>{copy.brain}</button>
          <button className="armor-launch" type="button" onClick={() => onAdvisor && onAdvisor(project)}><ShieldCheck size={15}/>{copy.launchArmorShort}</button>
          {project.mode === 'connected' && <button className="preview-launch" type="button" onClick={() => onPreview(project)}><Eye size={15}/>{copy.livePreview}</button>}
          <button className="logo-launch" type="button" onClick={() => onLogo(project)}><Sparkles size={14}/>{copy.createLogo}</button>
          <button className="text-button" type="button" style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '0 12px', height: 38, fontSize: 12, fontWeight: 700 }} onClick={async () => {
            setSimulating(true);
            try {
              const res = await fetch(`/api/projects/${project.id}/simulate-users`, { method: 'POST' });
              const data = await res.json();
              if (res.ok) setSimulatedFeedback(data.feedback);
            } catch {} finally { setSimulating(false); }
          }}>
            <FlaskConical size={14}/> {simulating ? copy.simulatingUsers : copy.simulateUsers}
          </button>
        </div>
        {liveProjectRuns.length > 0 && <section className="project-live-agents">
          <div className="project-live-agents-heading"><span className="pulse-dot"/><div><p className="eyebrow">{localeText('LIVE AGENTS', 'AGENTES EN VIVO')}</p><strong>{localeText('Work is happening in this project now', 'Hay trabajo en curso en este proyecto')}</strong></div></div>
          {liveProjectRuns.map(run => <button type="button" className="project-live-agent" key={run.id} onClick={() => onInspectRun(run)}>
            <span className={`run-status ${run.status}`}/><span><strong>{providerName(run.provider)}</strong><small>{run.prompt}</small></span><Activity size={15}/>
          </button>)}
        </section>}
        {customTaskOpen && <form className="project-custom-task" onSubmit={async event => {
          event.preventDefault();
          if (!customPrompt.trim()) return;
          if (onRunTask) {
            onClose();
            onRunTask(project, customPrompt.trim().slice(0, 40), undefined, customPrompt.trim());
            return;
          }
          setStartingCustomTask(true);
          setCustomTaskNotice('');
          try {
            const response = await fetch('/api/runs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: project.id, provider: 'auto', prompt: customPrompt.trim() }) });
            const body = await response.json();
            if (!response.ok) throw new Error(body.error || localeText('Could not start the agent.', 'No se pudo iniciar el agente.'));
            setCustomPrompt('');
            setCustomTaskNotice(localeText('✓ Agent started in an isolated workspace. Review the result before merging.', '✓ Agente iniciado en un espacio aislado. Revisa el resultado antes de fusionarlo.'));
          } catch (error) { setCustomTaskNotice(error.message); } finally { setStartingCustomTask(false); }
        }}><label>{localeText('What would you like the agent to do?', '¿Qué quieres que haga el agente?')}<textarea autoFocus value={customPrompt} onChange={event => setCustomPrompt(event.target.value)} placeholder={localeText('Describe a new task for this project…', 'Describe una nueva tarea para este proyecto…')} rows={3}/></label><button className="new-button" disabled={startingCustomTask || !customPrompt.trim()} type="submit"><Send size={14}/>{startingCustomTask ? localeText('Starting agent…', 'Iniciando agente…') : localeText('Configure in Agent Console', 'Configurar en Consola de Agentes')}</button>{customTaskNotice && <p className="run-notice">{customTaskNotice}</p>}</form>}

        {simulatedFeedback.length > 0 && (
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14, padding: 14, margin: '14px 0' }}>
            <p className="eyebrow" style={{ color: '#0f172a', margin: '0 0 10px' }}>{copy.simulatedFeedback}</p>
            <div style={{ display: 'grid', gap: 8 }}>
              {simulatedFeedback.map((item, idx) => (
                <div key={idx} style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: 10, padding: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <strong style={{ fontSize: 12 }}>{item.persona}</strong>
                    <span style={{ font: "10px 'DM Mono'", background: item.score >= 8 ? '#dcfce7' : item.score >= 6 ? '#fef9c3' : '#fee2e2', color: item.score >= 8 ? '#166534' : item.score >= 6 ? '#854d0e' : '#991b1b', padding: '2px 6px', borderRadius: 99 }}>
                      {item.score}/10 · {item.sentiment}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: 11, color: '#475569', lineHeight: 1.5 }}>{item.feedback}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="modal-tasks">
          <p className="eyebrow">{copy.projectTasks}</p>
          {(project.tasks || []).map((task, index) => (
            <TaskRow
              key={index}
              task={task}
              project={project}
              index={index}
              runs={runs}
              onRunTask={onRunTask}
              onInspectRun={onInspectRun}
              onToggle={() => onToggle(project.id, index)}
            />
          ))}
          <TaskAddRow project={project} copy={copy} onRefresh={onRefresh} onRunTask={onRunTask}/>
        </div>
        <div className="project-activity">
          <p className="eyebrow">{copy.orbitHistory}</p>
          {history.length ? history.map(run => (
            <div className="history-item" key={run.id}>
              <span className={`run-status ${run.status}`}/>
              <div>
                <strong>{run.prompt}</strong>
                <small>{run.provider} · {run.status === 'awaiting_review' ? copy.awaitingReview : run.status} · {formatLastUpdated(run.createdAt || run.finishedAt)}{run.changedFiles?.length ? ` · ${run.changedFiles.join(', ')}` : ''}</small>
              </div>
            </div>
          )) : <p className="empty-copy">{copy.noAgentWork}</p>}
        </div>
        <div className="project-activity">
          <p className="eyebrow">{copy.importedHistory}</p>
          <ProjectGitHistory project={project} copy={copy}/>
        </div>
      </section>
    </div>
  );
}

function SecurityCenterModal({ project, copy, onClose, onAdvisor, onRunTask, onRefresh }) {
  const dialogRef = useDialogFocus(onClose);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [notice, setNotice] = useState('');
  const [privacyReviewOpen, setPrivacyReviewOpen] = useState(false);
  const [privacyDecision, setPrivacyDecision] = useState('reviewed');
  const [privacyRationale, setPrivacyRationale] = useState('');
  const [savingPrivacyReview, setSavingPrivacyReview] = useState(false);
  const isEs = typeof document !== 'undefined' && document.documentElement.lang === 'es';

  const load = async ({ refresh = false } = {}) => {
    if (refresh) setScanning(true); else setLoading(true);
    setNotice('');
    try {
      const res = await fetch(`/api/projects/${project.id}/security-center?lang=${isEs ? 'es' : 'en'}`, refresh ? {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: isEs ? 'es' : 'en', dependencyAudit: true })
      } : undefined);
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || localeText('Security scan could not run.', 'No se pudo ejecutar el escaneo de seguridad.'));
      setData(refresh ? result.center : result);
      if (refresh) setNotice(result.refreshError || localeText('✓ Security scan refreshed. The dependency audit was requested as part of this review.', '✓ Escaneo actualizado. La auditoría de dependencias fue solicitada como parte de esta revisión.'));
    } catch (error) { setNotice(error.message); }
    finally { if (refresh) setScanning(false); else setLoading(false); }
  };
  useEffect(() => { load(); }, [project.id]);

  const gate = data?.gate;
  const gateIcon = gate?.status === 'red' ? '●' : gate?.status === 'yellow' ? '●' : '●';
  const handleAction = item => {
    if (item.id === 'dependencies') { load({ refresh: true }); return; }
    if (item.id === 'privacy') { setPrivacyReviewOpen(true); return; }
    onClose();
    onRunTask?.(project, item.taskTitle || item.title, undefined, item.suggestedPrompt || `Review and address: ${item.title}.`);
  };
  const savePrivacyReview = async () => {
    if (!data?.privacyReview?.evidenceFingerprint) return;
    setSavingPrivacyReview(true); setNotice('');
    try {
      const res = await fetch(`/api/projects/${project.id}/security-center/privacy-review`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: privacyDecision, rationale: privacyRationale, evidenceFingerprint: data.privacyReview.evidenceFingerprint })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || localeText('Privacy review could not be saved.', 'No se pudo guardar la revisión de privacidad.'));
      setData(result.center); setPrivacyReviewOpen(false); setPrivacyRationale('');
      setNotice(localeText('✓ Privacy review recorded against the current local evidence.', '✓ La revisión de privacidad quedó registrada contra la evidencia local actual.'));
      onRefresh?.();
    } catch (error) { setNotice(error.message); }
    finally { setSavingPrivacyReview(false); }
  };
  return <div className="modal-backdrop">
    <section ref={dialogRef} className="modal security-center-modal" role="dialog" aria-modal="true" aria-label={localeText('Security Center', 'Security Center')}>
      <button className="close" type="button" onClick={onClose} aria-label={localeText('Close Security Center', 'Cerrar Security Center')}><X size={18}/></button>
      <header className="security-center-header">
        <div><p className="eyebrow"><ShieldCheck size={14}/> {localeText('SECURITY CENTER', 'CENTRO DE SEGURIDAD')}</p><h2>{project.name}</h2><p>{localeText('Evidence-based local delivery gate. No source code or credential values leave this Mac.', 'Puerta de entrega local basada en evidencia. Ningún código fuente o valor de credencial sale de este Mac.')}</p></div>
        <div className="security-center-actions"><button className="advisor-refresh-button" type="button" disabled={loading || scanning} onClick={() => load({ refresh: true })}><RefreshCw size={14} className={scanning ? 'spin' : ''}/>{scanning ? localeText('Scanning…', 'Escaneando…') : localeText('Refresh security scan', 'Actualizar escaneo')}</button><a className="security-export-button" href={`/api/projects/${project.id}/security-evidence?lang=${isEs ? 'es' : 'en'}${data?.snapshot?.id ? `&snapshot=${encodeURIComponent(data.snapshot.id)}` : ''}`}><Download size={14}/>{localeText('Evidence report', 'Reporte de evidencia')}</a></div>
      </header>
      {notice && <p className="advisor-notice-banner" role="status">{notice}</p>}
      {loading ? <div className="advisor-loading-state"><RefreshCw size={26} className="spin-icon"/><strong>{localeText('Building local evidence…', 'Generando evidencia local…')}</strong></div> : !data ? <div className="advisor-loading-state"><AlertCircle size={26}/><strong>{localeText('Security Center could not load.', 'Security Center no pudo cargar.')}</strong><button className="new-button" type="button" onClick={() => load()}>{localeText('Try again', 'Reintentar')}</button></div> : <>
        <section className={`security-gate security-gate-${gate?.status || 'yellow'}`}>
          <div className="security-gate-signal" aria-hidden="true">{gateIcon}</div><div><p className="eyebrow">{localeText('LAUNCH GATE', 'PUERTA DE LANZAMIENTO')}</p><h3>{gate?.label}</h3><p>{gate?.summary}</p></div><span>{gate?.blocked?.length || 0} {localeText('blockers', 'bloqueos')} · {gate?.warnings?.length || 0} {localeText('review items', 'puntos de revisión')}</span>
        </section>
        <p className="security-disclaimer"><AlertCircle size={14}/>{localeText('This is evidence and a working control map—not a legal opinion, penetration test, ISO certification, or compliance attestation.', 'Esta es evidencia y un mapa de controles de trabajo; no es opinión legal, pentest, certificación ISO ni constancia de cumplimiento.')}</p>
        <p className="security-scan-meta">{localeText('Snapshot', 'Captura')}: {data?.snapshot?.generatedAt ? new Date(data.snapshot.generatedAt).toLocaleString() : localeText('current local view', 'vista local actual')}{data?.snapshot?.stale ? ` · ${localeText('dependency audit out of date', 'auditoría de dependencias desactualizada')}` : ''}{data?.repository?.coverage?.incomplete ? ` · ${localeText('partial scan coverage', 'cobertura de escaneo parcial')}` : ''}</p>
        {data?.repository?.coverage?.incomplete && <details className="security-evidence">
          <summary>{localeText('View scan limitations', 'Ver límites del escaneo')}</summary>
          {[
            ['unreadablePaths', localeText('Could not read', 'No se pudo leer')],
            ['skippedSymlinks', localeText('Skipped symbolic links', 'Enlaces simbólicos omitidos')],
            ['partialFiles', localeText('Only partially read', 'Lectura parcial')]
          ].map(([key, label]) => data.repository.coverage[key]?.length > 0 && <p key={key}>{label}: {data.repository.coverage[key].join(', ')}</p>)}
          {data.repository.coverage.scanLimitReached && <p>{localeText('The file count or directory traversal limit was reached.', 'Se alcanzó el límite de archivos o de recorrido de directorios.')}</p>}
        </details>}
        {privacyReviewOpen && <section className="privacy-review-panel"><p className="eyebrow">{localeText('PRIVACY REVIEW RECORD', 'REGISTRO DE REVISIÓN DE PRIVACIDAD')}</p><h3>{localeText('Record a responsible review', 'Registra una revisión responsable')}</h3><p>{localeText('This records an internal decision against the current local evidence. It does not create legal approval or certify compliance.', 'Esto registra una decisión interna sobre la evidencia local actual. No crea aprobación legal ni certifica cumplimiento.')}</p><select value={privacyDecision} onChange={event => setPrivacyDecision(event.target.value)}><option value="reviewed">{localeText('Reviewed', 'Revisado')}</option><option value="not_applicable">{localeText('Not applicable', 'No aplica')}</option></select><textarea value={privacyRationale} onChange={event => setPrivacyRationale(event.target.value)} maxLength={1200} placeholder={localeText('Brief rationale and responsible owner (required)', 'Justificación breve y persona responsable (requerido)')}/><div><button type="button" className="new-button" disabled={savingPrivacyReview || privacyRationale.trim().length < 8} onClick={savePrivacyReview}>{savingPrivacyReview ? localeText('Saving…', 'Guardando…') : localeText('Save review record', 'Guardar registro')}</button><button type="button" className="text-button" onClick={() => setPrivacyReviewOpen(false)}>{localeText('Cancel', 'Cancelar')}</button></div></section>}
        <section className="security-check-grid">
          {(data?.checks || []).map(item => <article className={`security-check-card ${item.status}`} key={item.id}>
            <div className="security-check-top"><span className={`security-status-dot ${item.status}`}/><strong>{item.title}</strong><small>{String(item.status).replaceAll('_', ' ')}</small></div>
            <p>{item.detail}</p>
            {item.evidence?.length > 0 && <div className="security-evidence"><FileCode size={13}/>{item.evidence.slice(0, 5).map((entry, index) => <code key={index}>{entry}</code>)}</div>}
            <div className="security-check-actions"><button type="button" className="add-task-btn" onClick={() => handleAction(item)}><Sparkles size={13}/>{item.id === 'dependencies' ? localeText('Run dependency audit', 'Ejecutar auditoría de dependencias') : item.id === 'privacy' ? localeText('Open privacy evidence', 'Abrir evidencia de privacidad') : localeText('Review with agent', 'Revisar con agente')}</button></div>
          </article>)}
        </section>
        <section className="security-framework-map"><div><p className="eyebrow">{localeText('EVIDENCE MAP', 'MAPA DE EVIDENCIA')}</p><h3>{localeText('Reference controls for your delivery record', 'Controles de referencia para tu registro de entrega')}</h3></div><p>{localeText('Use this to organize evidence. It is not a claim of conformance.', 'Úsalo para organizar evidencia. No es una afirmación de conformidad.')}</p><div className="security-framework-list">{(data?.frameworkMappings || []).map(item => <article key={item.id}><span className={`security-status-dot ${item.status}`}/><div><strong>{item.area}</strong><small>{item.nist}</small><small>{item.asvs}</small><small>{item.iso}</small></div></article>)}</div></section>
        <section className="security-runtime-summary"><p className="eyebrow">{localeText('LOCAL RUNTIME', 'ENTORNO LOCAL')}</p><div><span>{localeText('Orbit binding', 'Enlace de Orbit')}<strong>{data?.runtime?.orbitBoundToLoopback ? '127.0.0.1 only' : localeText('Review required', 'Revisión requerida')}</strong></span><span>{localeText('macOS firewall', 'Firewall macOS')}<strong>{data?.runtime?.firewall?.status || 'unknown'}</strong></span><span>{localeText('FileVault', 'FileVault')}<strong>{data?.runtime?.fileVault?.status || 'unknown'}</strong></span><span>{localeText('Public preview tunnels', 'Túneles públicos de preview')}<strong>{data?.runtime?.activeTunnels?.length || 0}</strong></span></div></section>
      </>}
    </section>
  </div>;
}

function LaunchAdvisorModal({ project, copy, onClose, onRunTask, onRefresh }) {
  const dialogRef = useDialogFocus(onClose);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('hardening');
  const [copied, setCopied] = useState(false);
  const [addingTask, setAddingTask] = useState({});
  const [notice, setNotice] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const isEs = typeof document !== 'undefined' && document.documentElement.lang === 'es';

  const loadAdvisory = async ({ refresh = false } = {}) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setNotice('');
    try {
      const url = `/api/projects/${project.id}/launch-advisory?lang=${isEs ? 'es' : 'en'}`;
      const res = await fetch(url, refresh ? {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: isEs ? 'es' : 'en', skipAi: true })
      } : undefined);
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to generate advisory');
      setData(result);
      if (refresh) setNotice(isEs ? '✓ Revisión actualizada con la evidencia actual del repositorio.' : '✓ Review refreshed with the repository’s current evidence.');
    } catch (err) {
      setNotice(err.message);
    } finally {
      if (refresh) setRefreshing(false);
      else setLoading(false);
    }
  };

  useEffect(() => {
    loadAdvisory();
  }, [project.id]);

  const handleCopyReport = async () => {
    if (!data?.clientAdvisory?.markdownReport) return;
    try {
      await navigator.clipboard.writeText(data.clientAdvisory.markdownReport);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setNotice('Could not copy to clipboard');
    }
  };

  const handleAddTask = async (taskTitle, purpose) => {
    setAddingTask(prev => ({ ...prev, [taskTitle]: true }));
    try {
      const res = await fetch(`/api/projects/${project.id}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: taskTitle,
          due: 'Pre-Launch',
          description: `Pre-launch hardening requirement for ${project.name}`,
          purpose: purpose || 'Ensure production security and bulletproof stability before launch.'
        })
      });
      if (res.ok) {
        setNotice(`✓ "${taskTitle}" ${isEs ? 'añadida a las tareas del proyecto' : 'added to project tasks'}`);
        if (onRefresh) onRefresh();
      }
    } catch (e) {
      setNotice(e.message);
    } finally {
      setAddingTask(prev => ({ ...prev, [taskTitle]: false }));
    }
  };

  const handleHardenWithAgent = (check) => {
    onClose();
    if (onRunTask) {
      onRunTask(check.taskTitle || check.title, check.suggestedPrompt, project);
    }
  };

  const score = data?.readinessScore ?? 0;
  const blocked = data?.launchGate?.status === 'blocked';
  const scoreColor = blocked || score < 70 ? '#dc2626' : score >= 85 ? '#16a34a' : '#d97706';
  const scoreBg = blocked || score < 70 ? '#fee2e2' : score >= 85 ? '#dcfce7' : '#fef3c7';
  const visibleChecks = (data?.hardeningChecks || []).filter(check => activeTab === 'trust' ? check.category === 'trust' : check.category !== 'trust');

  return (
    <div className="modal-backdrop">
      <section
        ref={dialogRef}
        className="modal launch-advisor-modal"
        role="dialog"
        aria-modal="true"
        aria-label={copy.launchArmor}
      >
        <button className="close" onClick={onClose} aria-label={localeText('Close', 'Cerrar')}>
          <X size={18} />
        </button>

        <div className="advisor-header">
          <div className="advisor-header-title">
            <span className="eyebrow" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#6c54e8' }}>
              <ShieldCheck size={14} /> {copy.launchArmor.toUpperCase()}
            </span>
            <h2>{project.name}</h2>
            <p className="advisor-subtitle">
              {data?.architecture?.isMultiTenant
                ? (isEs ? 'Auditoría Pre-Launch para arquitectura Multi-Tenant / SaaS con aislamiento estricto.' : 'Pre-launch audit for Multi-Tenant / SaaS architecture with strict isolation.')
                : (isEs ? 'Auditoría de seguridad, blindaje técnico y recomendaciones de entrega a cliente.' : 'Security hardening audit, technical checks, and client delivery advisory.')}
            </p>
          </div>

          <div className="advisor-header-actions">
            <button className="advisor-refresh-button" type="button" onClick={() => loadAdvisory({ refresh: true })} disabled={loading || refreshing} title={isEs ? 'Vuelve a inspeccionar el repositorio después de aplicar cambios.' : 'Inspect the repository again after applying changes.'}>
              <RefreshCw size={14} className={refreshing ? 'spin' : ''}/>{refreshing ? (isEs ? 'Revisando…' : 'Reviewing…') : (isEs ? 'Volver a revisar' : 'Re-scan review')}
            </button>
            <div className="advisor-score-badge" style={{ background: scoreBg, borderColor: scoreColor }}>
              <span className="score-num" style={{ color: scoreColor }}>{loading ? '…' : `${score}%`}</span>
              <small style={{ color: scoreColor }}>{copy.launchReadinessScore}</small>
            </div>
          </div>
        </div>

        {data?.architecture?.detectedStack && (
          <div className="advisor-stack-chips">
            {data.architecture.detectedStack.map((st, i) => (
              <span key={i} className="stack-chip">
                {st.includes('RLS') || st.includes('Multi-Tenant') ? '🛡️ ' : st.includes('Stripe') ? '💳 ' : '⚡ '}
                {st}
              </span>
            ))}
          </div>
        )}

        {!loading && data?.launchGate && <div className={`launch-gate-banner ${blocked ? 'blocked' : 'review'}`}>
          <ShieldAlert size={16}/>
          <div>
            <strong>{blocked ? (isEs ? 'Lanzamiento bloqueado hasta resolver requisitos esenciales' : 'Launch blocked until essential requirements are resolved') : (isEs ? 'Revisión humana requerida antes del lanzamiento' : 'Human review required before launch')}</strong>
            <p>{blocked
              ? (isEs ? `${data.launchGate.blockers.length} requisito(s) de privacidad o confianza no tienen evidencia local.` : `${data.launchGate.blockers.length} privacy or trust requirement(s) have no local evidence.`)
              : (isEs ? 'Orbit no certifica cumplimiento legal. Confirma las decisiones con la persona responsable y asesoría legal.' : 'Orbit does not certify legal compliance. Confirm decisions with the responsible owner and qualified legal counsel.')}</p>
          </div>
        </div>}

        {!loading && data?.technicalEvidence?.repoConnected === false && <div className="legal-limit-note">
          <FolderGit2 size={15}/><span>{isEs ? 'Revisión limitada: este proyecto solo tiene una referencia remota. Conecta una carpeta local del repositorio para que Orbit inspeccione el código y dé recomendaciones basadas en evidencia.' : 'Limited review: this project only has a remote reference. Connect a local repository folder so Orbit can inspect code and make evidence-based recommendations.'}</span>
        </div>}

        <div className="advisor-nav-tabs">
          <button
            type="button"
            className={`tab-btn ${activeTab === 'hardening' ? 'active' : ''}`}
            onClick={() => setActiveTab('hardening')}
          >
            <ShieldAlert size={14} />
            {copy.hardeningTab}
            {data?.hardeningChecks?.filter(check => check.category !== 'trust').length ? ` (${data.hardeningChecks.filter(check => check.category !== 'trust').length})` : ''}
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'trust' ? 'active' : ''}`}
            onClick={() => setActiveTab('trust')}
          >
            <ShieldCheck size={14} />
            {isEs ? '🧾 Privacidad y confianza' : '🧾 Privacy & Trust'}
            {data?.hardeningChecks?.filter(check => check.category === 'trust').length ? ` (${data.hardeningChecks.filter(check => check.category === 'trust').length})` : ''}
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'advisory' ? 'active' : ''}`}
            onClick={() => setActiveTab('advisory')}
          >
            <FileText size={14} />
            {copy.clientAdvisoryTab}
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'growth' ? 'active' : ''}`}
            onClick={() => setActiveTab('growth')}
          >
            <Sparkles size={14} />
            {copy.growthIdeasTab}
            {data?.growthIdeas?.length ? ` (${data.growthIdeas.length})` : ''}
          </button>
        </div>

        {notice && (
          <div className="advisor-notice-banner">
            <span>{notice}</span>
          </div>
        )}

        {loading ? (
          <div className="advisor-loading-state">
            <RefreshCw size={26} className="spin-icon" />
            <strong>{copy.advisorAnalyzing}</strong>
            <p>{isEs ? 'Revisando modelos de datos, aislamiento de tenants, endpoints y webhooks...' : 'Inspecting schemas, tenant isolation, routes, and webhook handlers...'}</p>
          </div>
        ) : (
          <div className="advisor-body-content">
            {(activeTab === 'hardening' || activeTab === 'trust') && (
              <div className="hardening-checks-list">
                {activeTab === 'trust' && <div className="legal-limit-note"><ShieldAlert size={15}/><span>{isEs ? 'Orbit verifica evidencia local y riesgos técnicos. No sustituye a un abogado ni certifica GDPR, CCPA, COPPA u otra regulación.' : 'Orbit verifies local evidence and technical risks. It does not replace legal counsel or certify GDPR, CCPA, COPPA, or any regulation.'}</span></div>}
                {visibleChecks.map(check => {
                  const verified = check.status === 'pass';
                  const notApplicable = check.status === 'not_applicable';
                  const actionable = ['blocked', 'needs_review', 'needs_decision', 'not_reviewed'].includes(check.status);
                  return (
                  <article key={check.id} className={`hardening-card ${verified ? 'verified' : notApplicable ? 'not-applicable' : check.severity.toLowerCase()}`}>
                    <div className="check-card-header">
                      <span className={`severity-tag ${verified ? 'verified' : notApplicable ? 'not-applicable' : check.severity.toLowerCase()}`}>
                        {verified ? (isEs ? 'VERIFICADO' : 'VERIFIED') : notApplicable ? (isEs ? 'NO REQUERIDO' : 'NOT REQUIRED') : check.severity === 'CRITICAL' ? copy.criticalSeverity : check.severity === 'HIGH' ? copy.highSeverity : copy.mediumSeverity}
                      </span>
                      <span className="category-tag">{check.category.toUpperCase()}</span>
                      <span className="status-tag">{check.status === 'pass' ? (isEs ? '✓ Evidencia encontrada' : '✓ Evidence found') : check.status === 'blocked' ? (isEs ? '⛔ Bloquea lanzamiento' : '⛔ Blocks launch') : check.status === 'human_review_required' ? (isEs ? '👤 Revisión humana' : '👤 Human review') : check.status === 'not_reviewed' ? (isEs ? '🔍 Conecta repo para revisar' : '🔍 Connect repo to review') : check.status === 'needs_review' ? (isEs ? '🔍 Revisión recomendada' : '🔍 Review recommended') : check.status === 'not_applicable' ? (isEs ? '— No aplica según evidencia' : '— Not applicable from evidence') : (isEs ? '⚡ Decisión requerida' : '⚡ Decision required')}</span>
                    </div>
                    <h3>{check.title}</h3>
                    <p className="check-explanation">{check.explanation}</p>

                    {check.evidence?.length > 0 && <p className="check-evidence"><FileCode size={12}/>{isEs ? 'Evidencia local:' : 'Local evidence:'} {check.evidence.join(', ')}</p>}

                    {!verified && check.status !== 'not_applicable' && <div className="client-impact-box">
                      <strong>{isEs ? '⚠️ Impacto para el Cliente:' : '⚠️ Business & Client Impact:'}</strong>
                      <p>{check.clientImpact}</p>
                    </div>}

                    {!verified && check.status !== 'not_applicable' && check.implementationGuide && (
                      <div className="impl-guide-box">
                        <small>{isEs ? 'Guía de Implementación / Código:' : 'Implementation Guide / Code:'}</small>
                        <pre>{check.implementationGuide}</pre>
                      </div>
                    )}

                    {actionable && <div className="check-actions">
                      <button
                        type="button"
                        className="new-button harden-agent-btn"
                        onClick={() => handleHardenWithAgent(check)}
                      >
                        <Play size={13} /> {copy.armorWithAgent}
                      </button>
                      <button
                        type="button"
                        className="text-button add-task-btn"
                        disabled={addingTask[check.taskTitle]}
                        onClick={() => handleAddTask(check.taskTitle, check.explanation)}
                      >
                        <Plus size={14} /> {addingTask[check.taskTitle] ? '...' : copy.addToProjectTasks}
                      </button>
                    </div>}
                  </article>
                );})}
              </div>
            )}

            {activeTab === 'advisory' && (
              <div className="client-advisory-tab-view">
                <div className="report-cta-bar">
                  <div>
                    <strong>{isEs ? 'Informe Ejecutivo para el Cliente' : 'Client Delivery Executive Report'}</strong>
                    <p>{isEs ? 'Requisitos que el cliente debe proveer y checklist de liberación técnica.' : 'Prerequisites the client must fulfill and production sign-off checklist.'}</p>
                  </div>
                  <button
                    type="button"
                    className="new-button copy-markdown-btn"
                    onClick={handleCopyReport}
                  >
                    {copied ? <CheckCheck size={14} /> : <Copy size={14} />}
                    {copied ? copy.reportCopied : copy.copyClientReport}
                  </button>
                </div>

                <div className="client-steps-container">
                  <h4>{isEs ? '1. Prerrequisitos que debe completar el cliente antes del lanzamiento' : '1. Client Pre-Launch Requirements'}</h4>
                  <div className="client-steps-grid">
                    {data?.clientAdvisory?.clientActionItems?.map(item => (
                      <div key={item.step} className="client-step-item">
                        <div className="step-num">{item.step}</div>
                        <div className="step-content">
                          <div className="step-header">
                            <strong>{item.title}</strong>
                            <span className="step-responsible">{item.responsible}</span>
                          </div>
                          <p>{item.action}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="production-checklist-container">
                  <h4>{isEs ? '2. Checklist Técnico de Liberación a Producción' : '2. Production Release Verification'}</h4>
                  <ul className="prod-checklist-ul">
                    {data?.clientAdvisory?.productionChecklist?.map((c, i) => (
                      <li key={i}>
                        <CheckCircle2 size={15} color="#16a34a" />
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="markdown-preview-card">
                  <div className="preview-top">
                    <span>{isEs ? 'Vista previa del informe (Markdown):' : 'Report Preview (Markdown):'}</span>
                    <button type="button" className="text-button" onClick={handleCopyReport}>
                      <Copy size={12} /> {copied ? copy.reportCopied : copy.copyClientReport}
                    </button>
                  </div>
                  <pre>{data?.clientAdvisory?.markdownReport}</pre>
                </div>
              </div>
            )}

            {activeTab === 'growth' && (
              <div className="growth-ideas-tab-view">
                <p className="growth-intro">
                  {isEs
                    ? 'Ideas estratégicas para proponer al cliente como Fase 2 tras el lanzamiento inicial. Diseñadas para aumentar retención, valor percibido y facturación recurrente.'
                    : 'Strategic Phase 2 feature opportunities to present to the client post-launch. Designed to boost retention, perceived value, and recurring expansion revenue.'}
                </p>

                <div className="growth-cards-grid">
                  {data?.growthIdeas?.map(idea => (
                    <article key={idea.id} className="growth-card">
                      <div className="growth-card-top">
                        <span className="growth-category">{idea.category}</span>
                        <div className="growth-badges">
                          <span className="impact-badge">{isEs ? `Impacto: ${idea.impact}` : `Impact: ${idea.impact}`}</span>
                          <span className="effort-badge">{isEs ? `Esfuerzo: ${idea.effort}` : `Effort: ${idea.effort}`}</span>
                        </div>
                      </div>
                      <h3>{idea.title}</h3>
                      <p className="growth-desc">{idea.description}</p>
                      <div className="growth-client-val">
                        <strong>{isEs ? '💡 Valor para el Cliente / Monetización:' : '💡 Client Value / Upsell Potential:'}</strong>
                        <span>{idea.clientValue}</span>
                      </div>
                      <div className="growth-actions">
                        <button
                          type="button"
                          className="new-button"
                          onClick={() => handleHardenWithAgent({ taskTitle: idea.taskTitle, suggestedPrompt: idea.suggestedPrompt })}
                        >
                          <Sparkles size={13} /> {isEs ? 'Prototipar con Agente' : 'Build with Agent'}
                        </button>
                        <button
                          type="button"
                          className="text-button add-task-btn"
                          disabled={addingTask[idea.taskTitle]}
                          onClick={() => handleAddTask(idea.taskTitle, idea.description)}
                        >
                          <Plus size={14} /> {addingTask[idea.taskTitle] ? '...' : copy.addToProjectTasks}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function LogoGeneratorModal({ project, copy, onClose }) {
  const dialogRef = useDialogFocus(onClose);
  const [svg, setSvg] = useState('');
  const [style, setStyle] = useState('minimalist tech');
  const [brief, setBrief] = useState('');
  const [briefMode, setBriefMode] = useState('guided');
  const [audience, setAudience] = useState('');
  const [coreValue, setCoreValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [briefLoading, setBriefLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const generateBrief = async () => {
    setBriefLoading(true); setNotice('');
    try {
      const response = await fetch(`/api/projects/${project.id}/brand-brief`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brandName: project.name, audience, coreValue }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Could not generate the brand brief.');
      setBrief(body.brief); setNotice('✓ Brand direction ready below. Review it, then generate the logo.');
    } catch (error) { setNotice(error.message); } finally { setBriefLoading(false); }
  };
  const generate = async () => {
    setLoading(true); setNotice('');
    try {
      const response = await fetch(`/api/projects/${project.id}/generate-logo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ style, brief, saveToProject: true }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Could not generate logo.');
      setSvg(body.svg); setNotice(body.savedToProject ? '✓ Logo saved to project public/logo.svg.' : '✓ Logo generated.');
    } catch (error) { setNotice(error.message); } finally { setLoading(false); }
  };
  const svgUrl = svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : '';
  return <div className="modal-backdrop"><section ref={dialogRef} className="modal logo-generator" role="dialog" aria-modal="true" aria-label={copy.aiLogoFor.replace('{project}', project.name)}><button className="close" onClick={onClose} aria-label={localeText('Close logo generator', 'Cerrar generador de logo')}><X size={18}/></button><p className="eyebrow">{copy.brandIdentity}</p><h2>{copy.aiLogoFor.replace('{project}', project.name)}</h2><div className="logo-preview">{svgUrl ? <img src={svgUrl} alt={copy.aiLogoFor.replace('{project}', project.name)}/> : <span>{copy.logoChooseStyle}</span>}</div><div className="logo-controls"><select value={style} onChange={event => setStyle(event.target.value)}><option value="minimalist tech">{copy.logoMinimalist}</option><option value="luxury corporate">{copy.logoCorporate}</option><option value="geometric colorful">{copy.logoGeometric}</option></select><div className="brief-tabs"><button type="button" className={briefMode === 'guided' ? 'tab active' : 'tab'} onClick={() => setBriefMode('guided')}>{copy.logoGuide}</button><button type="button" className={briefMode === 'write' ? 'tab active' : 'tab'} onClick={() => setBriefMode('write')}>{copy.logoWrite}</button></div>{briefMode === 'guided' ? <div className="guided-brief"><label>{copy.logoAudience}<input value={audience} onChange={event => setAudience(event.target.value)} placeholder={copy.logoAudiencePlaceholder}/></label><label>{copy.logoMission}<input value={coreValue} onChange={event => setCoreValue(event.target.value)} placeholder={copy.logoMissionPlaceholder}/></label><button type="button" className="new-button" onClick={generateBrief} disabled={briefLoading || !audience.trim() || !coreValue.trim()}>{briefLoading ? copy.logoThinking : `✦ ${copy.logoSuggest}`}</button>{brief && <p className="brief-preview">{brief}</p>}</div> : <textarea className="logo-brief" placeholder={copy.logoBriefPlaceholder} value={brief} onChange={event => setBrief(event.target.value)} rows={4}/>}<button className="new-button" onClick={generate} disabled={loading}>{loading ? copy.logoDesigning : `✦ ${copy.logoGenerate}`}</button></div><p className="secret-copy">{copy.logoSafeSave}</p>{notice && <p className="run-notice">{notice}</p>}</section></div>;
}

function ProjectPreviewModal({ project, copy, onClose }) {
  const dialogRef = useDialogFocus(onClose);
  const [preview, setPreview] = useState(null);
  const [mode, setMode] = useState('desktop');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [inspectorActive, setInspectorActive] = useState(false);
  const [inspectorPrompt, setInspectorPrompt] = useState('');
  const [notice, setNotice] = useState('');
  const [sharedUrl, setSharedUrl] = useState('');
  const [sharing, setSharing] = useState(false);
  const [needsCloudflared, setNeedsCloudflared] = useState(false);
  const [installingCloudflared, setInstallingCloudflared] = useState(false);
  const previewStarting = useRef(false);
  const start = async (restart = false) => {
    if (previewStarting.current) return;
    previewStarting.current = true;
    setLoading(true); setError('');
    try {
      if (restart) {
        const stopped = await fetch(`/api/projects/${project.id}/preview`, { method: 'DELETE' });
        const stoppedBody = await stopped.json().catch(() => ({}));
        if (!stopped.ok) throw new Error(stoppedBody.error || localeText('Could not stop the preview for restart.', 'No se pudo detener la vista previa para reiniciarla.'));
        setPreview(null);
        setSharedUrl('');
        setNotice(localeText('Restarting the preview. Create a new share link if needed.', 'Reiniciando la vista previa. Crea un nuevo enlace para compartir si lo necesitas.'));
      }
      const response = await fetch(`/api/projects/${project.id}/preview`, { method: 'POST' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || localeText('Could not start preview server.', 'No se pudo iniciar el servidor de vista previa.'));
      setPreview(body);
    } catch (requestError) { setError(requestError.message); } finally { previewStarting.current = false; setLoading(false); }
  };
  const submitInspector = async event => {
    event.preventDefault();
    if (!inspectorPrompt.trim()) return;
    setNotice(localeText('Sending visual instruction to agent…', 'Enviando instrucción visual al agente…'));
    try {
      const response = await fetch('/api/runs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: project.id, provider: 'auto', prompt: `Visual change requested from Live Preview: ${inspectorPrompt.trim()}` }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || localeText('Could not start agent.', 'No se pudo iniciar el agente.'));
      setInspectorPrompt(''); setInspectorActive(false); setNotice(localeText('✓ Agent started. Changes will be ready for review in an isolated worktree.', '✓ Agente iniciado. Los cambios estarán listos para revisión en un worktree aislado.'));
    } catch (requestError) { setNotice(requestError.message); }
  };
  const sharePreview = async () => {
    setSharing(true); setNotice('');
    try {
      const response = await fetch(`/api/projects/${project.id}/preview-share`, { method: 'POST' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || localeText('Could not share the preview.', 'No se pudo compartir la vista previa.'));
      setSharedUrl(body.url);
      setNeedsCloudflared(false);
      setNotice(localeText('Temporary public preview is active. Anyone with this link can view it until you stop sharing.', 'La vista previa pública temporal está activa. Cualquiera con este enlace puede verla hasta que dejes de compartir.'));
    } catch (requestError) { if (/cloudflare tunnel is not installed/i.test(requestError.message)) setNeedsCloudflared(true); else setNotice(requestError.message); } finally { setSharing(false); }
  };
  const installCloudflared = async () => {
    setInstallingCloudflared(true); setNotice('');
    try {
      const response = await fetch('/api/tools/cloudflared/install', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ consent: true }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || localeText('Could not install Cloudflare Tunnel.', 'No se pudo instalar Cloudflare Tunnel.'));
      setNeedsCloudflared(false);
      setNotice(localeText('Cloudflare Tunnel is installed locally. You can now create the temporary link.', 'Cloudflare Tunnel se instaló localmente. Ahora puedes crear el enlace temporal.'));
    } catch (requestError) { setNotice(requestError.message); } finally { setInstallingCloudflared(false); }
  };
  const stopSharing = async () => {
    await fetch(`/api/projects/${project.id}/preview-share`, { method: 'DELETE' }).catch(() => {});
    setSharedUrl('');
    setNotice(localeText('Public preview link stopped.', 'El enlace público de vista previa se detuvo.'));
  };
  const copySharedUrl = async () => {
    try { await navigator.clipboard.writeText(sharedUrl); setNotice(localeText('Public preview link copied.', 'Enlace público de vista previa copiado.')); }
    catch { setNotice(localeText('Copy the public link from the field below.', 'Copia el enlace público desde el campo de abajo.')); }
  };
  useEffect(() => { start(); return () => { fetch(`/api/projects/${project.id}/preview`, { method: 'DELETE' }).catch(() => {}); }; }, [project.id]);
  return <div className="modal-backdrop"><section ref={dialogRef} className="modal live-preview" role="dialog" aria-modal="true" aria-label={`${copy.livePreview}: ${project.name}`}><button className="close" onClick={onClose} aria-label={localeText('Close live preview', 'Cerrar vista previa en vivo')}><X size={18}/></button><div className="preview-header"><div><p className="eyebrow">{copy.livePreview}</p><h2>{project.name}</h2><small>{preview?.source ? `${localeText('Serving', 'Sirviendo')}: ${preview.source}` : copy.previewStarting}</small></div><div className="preview-mode"><button className={mode === 'mobile' ? 'active' : ''} onClick={() => setMode('mobile')}><Smartphone size={14}/>{copy.previewMobile}</button><button className={mode === 'desktop' ? 'active' : ''} onClick={() => setMode('desktop')}><Monitor size={14}/>{copy.previewDesktop}</button><button className={inspectorActive ? 'inspector-toggle active' : 'inspector-toggle'} onClick={() => setInspectorActive(current => !current)}><Eye size={14}/>{inspectorActive ? copy.previewCancel : copy.visualInspector}</button></div></div>{inspectorActive && <form className="visual-inspector" onSubmit={submitInspector}><input autoFocus value={inspectorPrompt} onChange={event => setInspectorPrompt(event.target.value)} placeholder={copy.previewInspectorPlaceholder}/><button className="new-button" type="submit">{copy.applyChange}</button></form>}{notice && <p className="run-notice">{notice}</p>}{loading && <p className="empty-copy">{copy.previewSandbox}</p>}{error && <div className="run-notice">{error}</div>}{preview?.url && <div className={`preview-frame ${mode}`}><iframe title={`${copy.livePreview}: ${project.name}`} src={preview.url}/></div>}{preview?.url && <section className="preview-share"><div><strong>{localeText('Share this preview', 'Compartir esta vista previa')}</strong><p>{needsCloudflared ? localeText('Cloudflare Tunnel is needed to create a temporary public link. It will be installed only after you explicitly approve it.', 'Cloudflare Tunnel es necesario para crear un enlace público temporal. Solo se instalará después de tu aprobación explícita.') : localeText('Creates a temporary public link. Anyone with the link can view this development preview until you stop it.', 'Crea un enlace público temporal. Cualquiera con el enlace podrá ver esta vista previa hasta que la detengas.')}</p></div>{sharedUrl ? <div className="preview-share-controls"><input readOnly value={sharedUrl} aria-label={localeText('Temporary public preview link', 'Enlace público temporal de vista previa')}/><button className="text-button" onClick={copySharedUrl}><Copy size={14}/>{localeText('Copy link', 'Copiar enlace')}</button><a className="text-button" href={sharedUrl} target="_blank" rel="noreferrer"><ExternalLink size={14}/>{localeText('Open', 'Abrir')}</a><button className="text-button danger-button" onClick={stopSharing}><Square size={13}/>{localeText('Stop sharing', 'Dejar de compartir')}</button></div> : needsCloudflared ? <button className="new-button" disabled={installingCloudflared} onClick={installCloudflared}>{installingCloudflared ? localeText('Installing Cloudflare Tunnel…', 'Instalando Cloudflare Tunnel…') : localeText('Install Cloudflare Tunnel', 'Instalar Cloudflare Tunnel')}</button> : <button className="new-button" disabled={sharing} onClick={sharePreview}>{sharing ? localeText('Creating secure link…', 'Creando enlace seguro…') : localeText('Share temporary preview', 'Compartir vista previa temporal')}</button>}</section>}<div className="preview-actions"><button className="text-button" disabled={loading} onClick={() => start(true)}><RefreshCw size={14}/>{copy.restartPreview}</button>{preview?.url && <a className="new-button" href={preview.url} target="_blank" rel="noreferrer">{copy.openNewTab}</a>}<button className="text-button danger-button" onClick={async () => { await fetch(`/api/projects/${project.id}/preview`, { method: 'DELETE' }); onClose(); }}><Square size={13}/>{copy.stop}</button></div></section></div>;
}

const SUGGESTED_LOCAL_MODELS = [
  {
    id: 'deepseek-r1:14b',
    name: 'DeepSeek-R1 (14B)',
    tag: 'Recomendado 16GB+ RAM',
    ram: '~9.0 GB',
    desc: 'Razonamiento lógico y matemático profundo con pensamiento paso a paso.',
    descEn: 'Deep logical and mathematical reasoning with step-by-step thinking.'
  },
  {
    id: 'deepseek-r1:8b',
    name: 'DeepSeek-R1 (8B)',
    tag: 'Ideal 8GB-16GB RAM',
    ram: '~4.9 GB',
    desc: 'Versión balanceada de razonamiento para cualquier Mac o PC moderna.',
    descEn: 'Balanced reasoning for any modern Mac or PC.'
  },
  {
    id: 'qwen2.5-coder:14b',
    name: 'Qwen 2.5 Coder (14B)',
    tag: 'Especialista en Código (16GB+)',
    ram: '~9.0 GB',
    desc: 'El mejor modelo local para generar código limpio, escribir tests y refactorizar.',
    descEn: 'A strong local model for clean code, tests, and refactors.'
  },
  {
    id: 'qwen2.5-coder:7b',
    name: 'Qwen 2.5 Coder (7B)',
    tag: 'Ligero para Código',
    ram: '~4.7 GB',
    desc: 'Modelo de programación rápido y eficiente con bajo consumo de memoria.',
    descEn: 'Fast, efficient coding with low memory use.'
  },
  {
    id: 'llama3.2:3b',
    name: 'Llama 3.2 (3B)',
    tag: 'Ultra Rápido (8GB RAM)',
    ram: '~2.0 GB',
    desc: 'Ultra veloz y ligero. Excelente para ajustes de texto, botones, estilos y tareas offline básicas.',
    descEn: 'Ultra-fast and lightweight. Great for copy, buttons, styling, and basic offline tasks.'
  }
];

function ModelHubOnboarding({ providers, refresh, onOpenGenesis, language = 'en' }) {
  const [notice, setNotice] = useState('');
  const [ollamaStatus, setOllamaStatus] = useState(null);
  const [pullProgress, setPullProgress] = useState(null);
  const isEs = language === 'es';
  const t = (english, spanish) => isEs ? spanish : english;
  const [deepseekKey, setDeepseekKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [cloudDrafts, setCloudDrafts] = useState({});
  const [cloudNotice, setCloudNotice] = useState('');

  const fetchOllama = async () => {
    try {
      const res = await fetch('/api/ollama/status');
      if (res.ok) {
        const data = await res.json();
        setOllamaStatus(data);
        if (data.pullState?.pulling) setPullProgress(data.pullState);
        else if (pullProgress && !data.pullState?.pulling) {
          setPullProgress(null);
          refresh();
        }
      }
    } catch {}
  };

  useEffect(() => {
    fetchOllama();
    const interval = setInterval(fetchOllama, 3000);
    return () => clearInterval(interval);
  }, [pullProgress?.pulling]);

  const signIn = async providerId => {
    const label = providerId === 'codex' ? 'Codex (OpenAI)' : 'Claude (Anthropic)';
    if (!window.confirm(t(`Orbit will open the official Terminal window so you can sign in to ${label}. Continue?`, `Orbit abrirá una ventana de Terminal oficial para que inicies sesión en ${label}. ¿Deseas continuar?`))) return;
    const res = await fetch(`/api/connections/${providerId}/login`, { method: 'POST' });
    const body = await res.json();
    setNotice(body.message || body.error);
  };

  const startOllama = async () => {
    setNotice(t('Starting the Ollama service…', 'Iniciando servicio de Ollama…'));
    const res = await fetch('/api/ollama/start', { method: 'POST' });
    const data = await res.json();
    setNotice(data.message || data.error);
    setTimeout(() => { fetchOllama(); refresh(); }, 2000);
  };

  const installOllama = async () => {
    await fetch('/api/ollama/install', { method: 'POST' });
    setNotice(t('Ollama’s official download page is open. Install it, then return to Orbit.', 'Se abrió la página oficial de descarga de Ollama. Instálala y regresa a Orbit.'));
  };

  const pullModel = async modelId => {
    setNotice(t(`Starting download for ${modelId}…`, `Iniciando descarga de ${modelId}…`));
    const res = await fetch('/api/ollama/pull', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelId })
    });
    const data = await res.json();
    if (res.ok) {
      setPullProgress({ pulling: true, model: modelId, progress: 0, status: t('Starting download…', 'Iniciando descarga…') });
    } else {
      setNotice(data.error);
    }
  };

  const saveDeepseekKey = async e => {
    e.preventDefault();
    setNotice(t('Connecting DeepSeek…', 'Conectando DeepSeek…'));
    const res = await fetch('/api/connections/deepseek/key', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: deepseekKey })
    });
    const data = await res.json();
    setNotice(data.message || data.error);
    if (res.ok) { setDeepseekKey(''); refresh(); }
  };

  const disconnectDeepseek = async () => {
    if (!window.confirm(t('Disconnect DeepSeek and remove the API key from this computer?', '¿Desconectar DeepSeek y eliminar la clave API de esta máquina?'))) return;
    const res = await fetch('/api/connections/deepseek', { method: 'DELETE' });
    const data = await res.json();
    setNotice(data.message || data.error);
    if (res.ok) refresh();
  };

  const saveGeminiKey = async e => {
    e.preventDefault();
    setNotice(t('Connecting Gemini…', 'Conectando Gemini…'));
    const res = await fetch('/api/connections/gemini/key', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: geminiKey })
    });
    const data = await res.json();
    setNotice(data.message || data.error);
    if (res.ok) { setGeminiKey(''); refresh(); }
  };

  const disconnectGemini = async () => {
    if (!window.confirm(t('Disconnect Gemini and remove the API key from this computer?', '¿Desconectar Gemini y eliminar la clave API de esta máquina?'))) return;
    const res = await fetch('/api/connections/gemini', { method: 'DELETE' });
    const data = await res.json();
    setNotice(data.message || data.error);
    if (res.ok) refresh();
  };
  const connectCloud = async (event, provider) => {
    event.preventDefault();
    const draft = cloudDrafts[provider.id] || {};
    setCloudNotice(t(`Verifying ${provider.label}…`, `Verificando ${provider.label}…`));
    try {
      const response = await fetch(`/api/connections/cloud/${provider.id}/key`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: draft.apiKey, model: draft.model || provider.model }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error);
      setCloudDrafts(current => ({ ...current, [provider.id]: { apiKey: '', model: body.model } })); setCloudNotice(body.message); refresh();
    } catch (error) { setCloudNotice(error.message || t(`Could not connect ${provider.label}.`, `No se pudo conectar ${provider.label}.`)); }
  };
  const disconnectCloud = async provider => {
    if (!window.confirm(t(`Disconnect ${provider.label} and remove its API key from this computer?`, `¿Desconectar ${provider.label} y eliminar su clave API de este equipo?`))) return;
    const response = await fetch(`/api/connections/cloud/${provider.id}`, { method: 'DELETE' }); const body = await response.json(); setCloudNotice(body.message || body.error); if (response.ok) refresh();
  };

  const codex = providers.find(p => p.id === 'codex') || {};
  const claude = providers.find(p => p.id === 'claude') || {};
  const deepseek = providers.find(p => p.id === 'deepseek') || {};
  const gemini = providers.find(p => p.id === 'gemini') || {};
  const local = providers.find(p => p.id === 'local') || {};
  const cloudProviders = providers.filter(p => ['groq', 'mistral', 'xai'].includes(p.id));

  const isOllamaRunning = ollamaStatus?.running || local.available || local.ready;
  const isOllamaInstalled = ollamaStatus?.installed || local.installed;
  const installedModels = [...new Set((ollamaStatus?.models || local.models || [])
    .map(model => typeof model === 'string' ? model : model?.name || model?.model || model?.id)
    .filter(model => typeof model === 'string' && model.trim()))];

  return (
    <section className="panel onboarding-hub">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p className="eyebrow">{isEs ? 'CENTRAL DE INTELIGENCIA ARTIFICIAL' : 'CENTRAL AI CONTROL HUB'}</p>
          <h2 style={{ margin: '4px 0 6px' }}>{isEs ? 'Modelos y Agentes Disponibles' : 'Available Models & Agents'}</h2>
          <p className="settings-copy" style={{ margin: 0 }}>
            {isEs
              ? 'Configuración clara y guiada para cada IA. Elige entre suscripciones oficiales, APIs de bajo costo o modelos 100% locales y gratuitos.'
              : 'Clear, guided configuration for each AI. Choose between official subscriptions, low-cost APIs, or 100% local, free models.'}
          </p>
        </div>
        {onOpenGenesis && (
          <button className="genesis-banner-btn" type="button" onClick={onOpenGenesis}>
            <Sparkles size={14}/> {isEs ? 'Abrir Agente de Instalación' : 'Open Setup Concierge'}
          </button>
        )}
      </div>

      {notice && <p className="run-notice">{notice}</p>}

      {/* 1. Codex Card */}
      <div className={`provider-setup-card ${codex.available ? 'active-ready' : codex.installed ? 'needs-setup' : 'not-installed'}`}>
        <div className="provider-card-head">
          <div className="provider-title-group">
            <span className="provider-big-icon">⚡</span>
            <div>
              <h3>Codex (OpenAI)</h3>
              <p>{t('Autonomous repository and terminal coding agent', 'Agente autónomo de programación de repositorios y terminal')}</p>
            </div>
          </div>
          <div className="provider-badge-cluster">
            <span className="cost-tag subscription">{t('ChatGPT Plus ($20/month) or Team subscription', 'Suscripción ChatGPT Plus ($20/mes) o Team')}</span>
            <span className={`provider-status-badge ${codex.available ? 'online' : codex.installed ? 'pending' : 'offline'}`}>
              {codex.available ? t('✓ Connected · Active session', '✓ Conectado · Sesión Activa') : codex.installed ? t('Sign-in required', 'Requiere Inicio de Sesión') : t('Not installed', 'No instalado')}
            </span>
          </div>
        </div>

        <div className="provider-details-body">
          <p className="provider-explanation">
            {t('Codex works directly in isolated repository branches to solve tasks, run tests, and fix errors. It does not charge per token; it is included with your ChatGPT Plus, Team, or Enterprise subscription.', 'Codex opera directamente sobre ramas aisladas de tu repositorio para resolver tareas, ejecutar tests y corregir errores. No te cobra por cada token; está completamente incluido en tu suscripción de ChatGPT Plus, Team o Enterprise.')}
          </p>
          <div className="steps-container">
            <div className="steps-title">{t('Steps to activate it:', 'Pasos para activarlo:')}</div>
            <ul className="steps-list">
              <li className="step-item">
                <span className="step-number">1</span>
                <span>{t('Have an active subscription at ', 'Ten una cuenta activa con suscripción en ')}<strong>chatgpt.com</strong>.</span>
              </li>
              <li className="step-item">
                <span className="step-number">2</span>
                <span>{t('Click ', 'Haz clic en el botón ')}<strong>{t('Sign in in Terminal', 'Iniciar Sesión en Terminal')}</strong>{t(' below to authorize this computer with OpenAI.', ' abajo para autorizar tu equipo con OpenAI.')}</span>
              </li>
              <li className="step-item">
                <span className="step-number">3</span>
                <span>{t('Return to Orbit: your session will be detected automatically.', 'Regresa a Orbit: tu sesión se detectará automáticamente.')}</span>
              </li>
            </ul>
          </div>
          <div className="provider-actions-row">
            <button className="new-button" type="button" onClick={() => signIn('codex')}>
              <Terminal size={14}/> {codex.available ? t('Reconnect in Terminal', 'Reconectar Sesión en Terminal') : t('Sign in in Terminal', 'Iniciar Sesión en Terminal')}
            </button>
            <a className="external-link-btn" href="https://chatgpt.com" target="_blank" rel="noreferrer">
              <ExternalLink size={13}/> {t('Open ChatGPT', 'Ir a ChatGPT')} (chatgpt.com)
            </a>
          </div>
        </div>
      </div>

      {/* 2. Claude Code Card */}
      <div className={`provider-setup-card ${claude.available ? 'active-ready' : claude.installed ? 'needs-setup' : 'not-installed'}`}>
        <div className="provider-card-head">
          <div className="provider-title-group">
            <span className="provider-big-icon">🟣</span>
            <div>
              <h3>Claude Code (Anthropic)</h3>
              <p>{t('Anthropic’s official agent for complex refactors and audits', 'Agente oficial de Anthropic para refactorizaciones complejas y auditorías')}</p>
            </div>
          </div>
          <div className="provider-badge-cluster">
            <span className="cost-tag subscription">{t('Claude Pro ($20/month) or Console subscription', 'Suscripción Claude Pro ($20/mes) o Consola')}</span>
            <span className={`provider-status-badge ${claude.available ? 'online' : claude.installed ? 'pending' : 'offline'}`}>
              {claude.available ? t('✓ Connected · Active session', '✓ Conectado · Sesión Activa') : claude.installed ? t('Sign-in required', 'Requiere Inicio de Sesión') : t('Not installed', 'No instalado')}
            </span>
          </div>
        </div>

        <div className="provider-details-body">
          <p className="provider-explanation">
            {t('Claude Code excels at deep architecture analysis, critical security reviews, and large code refactors. It requires an active Claude Pro subscription at claude.ai or Anthropic Console credits.', 'Claude Code destaca en análisis arquitectónico profundo, revisiones críticas de seguridad y grandes refactorizaciones de código. Requiere una suscripción activa a Claude Pro en claude.ai o créditos en Anthropic Console.')}
          </p>
          <div className="steps-container">
            <div className="steps-title">{t('Steps to activate it:', 'Pasos para activarlo:')}</div>
            <ul className="steps-list">
              <li className="step-item">
                <span className="step-number">1</span>
                <span>{t('Create your account at ', 'Crea tu cuenta en ')}<strong>claude.ai</strong>{t(' (Pro subscription) or ', ' (suscripción Pro) o en ')}<strong>console.anthropic.com</strong>.</span>
              </li>
              <li className="step-item">
                <span className="step-number">2</span>
                <span>{t('Click ', 'Haz clic en ')}<strong>{t('Sign in in Terminal', 'Iniciar Sesión en Terminal')}</strong>{t(' below to link your browser.', ' abajo para vincular tu navegador.')}</span>
              </li>
              <li className="step-item">
                <span className="step-number">3</span>
                <span>{t('Done: Claude Code will be active in Orbit.', 'Listo: Claude Code quedará activo para trabajar en Orbit.')}</span>
              </li>
            </ul>
          </div>
          <div className="provider-actions-row">
            <button className="new-button" type="button" onClick={() => signIn('claude')}>
              <Terminal size={14}/> {claude.available ? t('Reconnect in Terminal', 'Reconectar Sesión en Terminal') : t('Sign in in Terminal', 'Iniciar Sesión en Terminal')}
            </button>
            <a className="external-link-btn" href="https://claude.ai" target="_blank" rel="noreferrer">
              <ExternalLink size={13}/> {t('Open Claude.ai', 'Ir a Claude.ai')}
            </a>
          </div>
        </div>
      </div>

      {/* 3. DeepSeek Card */}
      <div className={`provider-setup-card ${deepseek.available ? 'active-ready' : 'needs-setup'}`}>
        <div className="provider-card-head">
          <div className="provider-title-group">
            <span className="provider-big-icon">🐳</span>
            <div>
              <h3>DeepSeek (V3 &amp; R1 Cloud API)</h3>
              <p>{t('Massive mathematical reasoning and code strategy at very low cost', 'Razonamiento matemático masivo y estrategia de código al costo más bajo del mundo')}</p>
            </div>
          </div>
          <div className="provider-badge-cluster">
            <span className="cost-tag payg">{t('No monthly fee · ultra-low pay-as-you-go', 'Sin mensualidad · Pay-as-you-go ultra barato')}</span>
            <span className={`provider-status-badge ${deepseek.available ? 'online' : 'pending'}`}>
              {deepseek.available ? t('✓ Connected · API key active', '✓ Conectado · API Key activa') : t('Not configured', 'Sin configurar')}
            </span>
          </div>
        </div>

        <div className="provider-details-body">
          <p className="provider-explanation">
            {t('It does not require a fixed monthly subscription. New accounts may receive free welcome tokens. Typical tasks can cost fractions of a cent.', 'No requiere suscripción mensual fija. Al registrarte te otorgan millones de tokens de bienvenida gratuitos. Las tareas típicamente cuestan menos de $0.002 USD (fracciones de centavo).')}
          </p>
          <div className="steps-container">
            <div className="steps-title">{t('Steps to activate it:', 'Pasos para activarlo:')}</div>
            <ul className="steps-list">
              <li className="step-item">
                <span className="step-number">1</span>
                <span>{t('Register at ', 'Regístrate gratis en ')}<strong>platform.deepseek.com</strong>.</span>
              </li>
              <li className="step-item">
                <span className="step-number">2</span>
                <span>{t('In the side menu, open ', 'En el menú lateral, abre ')}<strong>API Keys</strong>{t(' and select ', ' y presiona ')}<strong>Create API Key</strong>.</span>
              </li>
              <li className="step-item">
                <span className="step-number">3</span>
                <span>{t('Paste your key (it starts with ', 'Pega tu clave (empieza con ')}<code>sk-</code>{t(') below and save it.', ') aquí abajo y guarda.')}</span>
              </li>
            </ul>
          </div>
          {deepseek.available ? (
            <div className="provider-actions-row">
              <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>{t('✓ API key saved securely on this computer.', '✓ Clave API guardada de forma segura en tu equipo local.')}</span>
              <button className="text-button danger-button" type="button" onClick={disconnectDeepseek}>{t('Disconnect DeepSeek', 'Desconectar DeepSeek')}</button>
              <a className="external-link-btn" href="https://platform.deepseek.com/api_keys" target="_blank" rel="noreferrer">
                <ExternalLink size={13}/> {t('Manage keys in DeepSeek', 'Gestionar Keys en DeepSeek')}
              </a>
            </div>
          ) : (
            <form onSubmit={saveDeepseekKey} className="api-key-form" style={{ marginTop: 12 }}>
              <label>
                DeepSeek API Key
                <input
                  type="password"
                  value={deepseekKey}
                  onChange={e => setDeepseekKey(e.target.value)}
                  placeholder={t('Paste your key here (sk-...)', 'Pega tu clave aquí (sk-...)')}
                  required
                />
              </label>
              <button className="new-button" type="submit">{t('Save and connect', 'Guardar y Conectar')} <Check size={14}/></button>
              <a className="external-link-btn" href="https://platform.deepseek.com/api_keys" target="_blank" rel="noreferrer">
                <ExternalLink size={13}/> {t('Get API key', 'Obtener API Key')}
              </a>
            </form>
          )}
        </div>
      </div>

      {/* 4. Gemini Card */}
      <div className={`provider-setup-card ${gemini.available ? 'active-ready' : 'needs-setup'}`}>
        <div className="provider-card-head">
          <div className="provider-title-group">
            <span className="provider-big-icon">✨</span>
            <div>
              <h3>Gemini Pro (Google AI Studio)</h3>
              <p>{t('Multimodal planning and whole-repository analysis with 1M+ tokens', 'Planificación multimodal y análisis de repositorios enteros con 1M+ tokens')}</p>
            </div>
          </div>
          <div className="provider-badge-cluster">
            <span className="cost-tag free">{t('Official free tier · no monthly cost', 'Tier Gratuito Oficial · Sin costo mensual')}</span>
            <span className={`provider-status-badge ${gemini.available ? 'online' : 'pending'}`}>
              {gemini.available ? t('✓ Connected · API key active', '✓ Conectado · API Key activa') : t('Not configured', 'Sin configurar')}
            </span>
          </div>
        </div>

        <div className="provider-details-body">
          <p className="provider-explanation">
            {t('Google AI Studio offers a generous developer free tier, with no fixed cost or card required for standard use.', 'Google AI Studio ofrece un nivel gratuito muy generoso para desarrolladores sin costo fijo ni necesidad de ingresar tarjeta para uso estándar.')}
          </p>
          <div className="steps-container">
            <div className="steps-title">{t('Steps to activate it:', 'Pasos para activarlo:')}</div>
            <ul className="steps-list">
              <li className="step-item">
                <span className="step-number">1</span>
                <span>{t('Open ', 'Entra a ')}<strong>aistudio.google.com/app/apikey</strong>{t(' with your Google account.', ' con tu cuenta de Google.')}</span>
              </li>
              <li className="step-item">
                <span className="step-number">2</span>
                <span>{t('Click ', 'Haz clic en ')}<strong>Create API Key</strong>.</span>
              </li>
              <li className="step-item">
                <span className="step-number">3</span>
                <span>{t('Copy the key and paste it below.', 'Copia la clave y pégala aquí abajo.')}</span>
              </li>
            </ul>
          </div>
          {gemini.available ? (
            <div className="provider-actions-row">
              <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>{t('✓ API key connected locally.', '✓ Clave API conectada localmente.')}</span>
              <button className="text-button danger-button" type="button" onClick={disconnectGemini}>{t('Disconnect Gemini', 'Desconectar Gemini')}</button>
              <a className="external-link-btn" href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">
                <ExternalLink size={13}/> Google AI Studio
              </a>
            </div>
          ) : (
            <form onSubmit={saveGeminiKey} className="api-key-form" style={{ marginTop: 12 }}>
              <label>
                Gemini API Key
                <input
                  type="password"
                  value={geminiKey}
                  onChange={e => setGeminiKey(e.target.value)}
                  placeholder={t('Paste your Google AI Studio key', 'Pega tu clave de Google AI Studio')}
                  required
                />
              </label>
              <button className="new-button" type="submit">{t('Save and connect', 'Guardar y Conectar')} <Check size={14}/></button>
              <a className="external-link-btn" href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">
                <ExternalLink size={13}/> {t('Get free key', 'Obtener Key Gratis')}
              </a>
            </form>
          )}
        </div>
      </div>

      <div className="cloud-provider-grid">
        {cloudProviders.map(provider => {
          const draft = cloudDrafts[provider.id] || { apiKey: '', model: provider.model || '' };
          const links = { groq: 'https://console.groq.com/keys', mistral: 'https://console.mistral.ai/api-keys/', xai: 'https://console.x.ai/' };
          const descriptions = {
            groq: t('Fast cloud inference for summaries, triage, and rapid second opinions.', 'Inferencia cloud rápida para resúmenes, clasificación y segundas opiniones.'),
            mistral: t('Planning and review with an independent cloud model family.', 'Planificación y revisión con una familia de modelos cloud independiente.'),
            xai: t('Research-oriented reasoning and planning through the xAI API.', 'Razonamiento y planificación orientados a investigación a través de la API de xAI.')
          };
          return <div className={`provider-setup-card cloud-provider-card ${provider.available ? 'active-ready' : 'needs-setup'}`} key={provider.id}>
            <div className="provider-card-head"><div className="provider-title-group"><span className="provider-big-icon">{provider.id === 'groq' ? '⚡' : provider.id === 'mistral' ? '🌬️' : '𝕏'}</span><div><h3>{provider.label}</h3><p>{descriptions[provider.id]}</p></div></div><span className={`provider-status-badge ${provider.available ? 'online' : 'pending'}`}>{provider.available ? t('✓ Connected', '✓ Conectado') : t('Optional', 'Opcional')}</span></div>
            <div className="provider-details-body"><p className="provider-explanation">{t('Can code, plan, and review. Coding runs send relevant project context to this cloud provider and apply changes in an isolated workspace for review.', 'Puede programar, planificar y revisar. Las ejecuciones envían contexto relevante a este proveedor cloud y aplican cambios en un espacio aislado para revisión.')}</p>{provider.ready ? <div className="provider-actions-row"><span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>✓ {provider.model || t('Configured model', 'Modelo configurado')} · {t('key stays private on this Mac.', 'la clave permanece privada en esta Mac.')}</span><button className="text-button danger-button" type="button" onClick={() => disconnectCloud(provider)}>{t('Disconnect', 'Desconectar')}</button></div> : <form onSubmit={event => connectCloud(event, provider)} className="cloud-connect-form"><label>API Key<input type="password" autoComplete="off" value={draft.apiKey || ''} onChange={event => setCloudDrafts(current => ({ ...current, [provider.id]: { ...draft, apiKey: event.target.value } }))} placeholder={t('Paste your API key', 'Pega tu clave API')} required/></label><label>{t('Model', 'Modelo')}<input value={draft.model || ''} onChange={event => setCloudDrafts(current => ({ ...current, [provider.id]: { ...draft, model: event.target.value } }))} placeholder={t('Default model', 'Modelo predeterminado')} required/></label><button className="new-button" type="submit">{t('Verify & connect', 'Verificar y conectar')} <Check size={14}/></button><a className="external-link-btn" href={links[provider.id]} target="_blank" rel="noreferrer"><ExternalLink size={13}/>{t('Get API key', 'Obtener clave API')}</a></form>}</div>
          </div>;
        })}
      </div>
      {cloudNotice && <p className="run-notice">{cloudNotice}</p>}

      {/* 5. Ollama & Local Model Store Card */}
      <div className={`provider-setup-card ${isOllamaRunning && installedModels.length > 0 ? 'active-ready' : isOllamaInstalled ? 'needs-setup' : 'not-installed'}`}>
        <div className="provider-card-head">
          <div className="provider-title-group">
            <span className="provider-big-icon">🦙</span>
            <div>
              <h3>Ollama ({t('Local AI on your computer', 'IA Local en tu Computador')})</h3>
              <p>{t('Open-source models running 100% privately on your hardware', 'Modelos de código abierto ejecutándose 100% privados en tu hardware')}</p>
            </div>
          </div>
          <div className="provider-badge-cluster">
            <span className="cost-tag free">{t('100% FREE & PRIVATE · no subscription', '100% GRATIS & PRIVADO · Sin suscripción')}</span>
            <span className={`provider-status-badge ${isOllamaRunning && installedModels.length > 0 ? 'online' : isOllamaInstalled ? 'pending' : 'offline'}`}>
              {isOllamaRunning && installedModels.length > 0
                ? t(`✓ Running · ${installedModels.length} model(s)`, `✓ En ejecución · ${installedModels.length} modelo(s)`)
                : isOllamaInstalled
                ? t('Installed but stopped', 'Instalado pero detenido')
                : t('Not installed', 'No instalado')}
            </span>
          </div>
        </div>

        <div className="provider-details-body">
          <p className="provider-explanation">
            {t('Runs models directly on your computer’s processor and graphics hardware. Zero per-token cost, complete privacy (no data leaves your computer), and works offline.', 'Ejecuta modelos directamente en el procesador y tarjeta gráfica de tu máquina. Cero costo por token, privacidad absoluta (ningún dato sale de tu equipo) y funciona incluso sin conexión a internet.')}
          </p>

          {/* Service Controls */}
          <div className="provider-actions-row" style={{ margin: '8px 0 16px' }}>
            {!isOllamaInstalled ? (
              <button className="new-button" type="button" onClick={installOllama}>
                <Download size={14}/> {t('Download and install Ollama', 'Descargar e Instalar Ollama')}
              </button>
            ) : !isOllamaRunning ? (
              <button className="new-button" type="button" onClick={startOllama}>
                <Play size={14}/> {t('Start Ollama on this computer', 'Iniciar Servicio Ollama en mi equipo')}
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#166534' }}>{t('Active models:', 'Modelos activos:')}</span>
                {installedModels.map(m => (
                  <span key={m} style={{ fontSize: 10.5, fontWeight: 700, background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', padding: '2px 8px', borderRadius: 6 }}>
                    {m} {m === (ollamaStatus?.activeModel || local.activeModel) ? `· ${t('active', 'activo')}` : ''}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Download Progress Bar */}
          {pullProgress?.pulling && (
            <div className="pull-progress-box">
              <div className="pull-progress-meta">
                <span>{t('Downloading', 'Descargando')} {pullProgress.model}: {pullProgress.status}</span>
                <span>{pullProgress.progress}%</span>
              </div>
              <div className="pull-progress-track">
                <div className="pull-progress-fill" style={{ width: `${pullProgress.progress}%` }}/>
              </div>
            </div>
          )}

          {/* Suggested Models Catalog */}
          <div className="ollama-catalog-head">
            <strong style={{ fontSize: 12, color: '#1e293b' }}>{t('Suggested model catalog (one-click download):', 'Catálogo de Modelos Sugeridos (Descarga en 1 Clic):')}</strong>
            <small style={{ fontSize: 11, color: '#64748b' }}>{t('Optimized for local software development', 'Optimizados para desarrollo de software local')}</small>
          </div>
          <div className="ollama-models-grid">
            {SUGGESTED_LOCAL_MODELS.map(item => {
              const isInstalled = installedModels.some(m => m.startsWith(item.id));
              const isPullingThis = pullProgress?.pulling && pullProgress.model === item.id;
              return (
                <div className="model-store-card" key={item.id}>
                  <div>
                    <div className="model-store-card-head">
                      <span className="model-store-name">{item.name}</span>
                      <span className="model-ram-badge">{item.ram}</span>
                    </div>
                    <p className="model-store-desc">{isEs ? item.desc : item.descEn}</p>
                  </div>
                  {isInstalled ? (
                    <button className="model-download-btn installed" type="button" disabled>
                      ✓ {t('Installed', 'Instalado')}
                    </button>
                  ) : isPullingThis ? (
                    <button className="model-download-btn" type="button" disabled>
                      {t('Downloading', 'Descargando')} ({pullProgress.progress}%)
                    </button>
                  ) : (
                    <button
                      className="model-download-btn"
                      type="button"
                      onClick={() => pullModel(item.id)}
                      disabled={pullProgress?.pulling}
                    >
                      <Download size={12}/> {t('One-click download', 'Descargar 1-Clic')}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function GenesisOnboardingModal({ onClose, refresh, language = 'en' }) {
  const dialogRef = useDialogFocus(onClose);
  const [specs, setSpecs] = useState(null);
  const [loadingSpecs, setLoadingSpecs] = useState(true);
  const [chatMessages, setChatMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [pullProgress, setPullProgress] = useState(null);
  const chatBottomRef = useRef(null);
  const chatStreamRef = useRef(null);
  const followChatRef = useRef(true);
  const downloadingRef = useRef(false);
  const [notice, setNotice] = useState('');
  const text = conciergeCopy[language] || conciergeCopy.en;
  const fill = (template, values) => Object.entries(values).reduce((message, [key, value]) => message.replaceAll(`{${key}}`, value), template);

  const fetchSpecs = async () => {
    try {
      const res = await fetch('/api/system/specs');
      if (res.ok) {
        const data = await res.json();
        setSpecs(data);
        const downloading = Boolean(data.ollama?.pullState?.pulling);
        setPullProgress(downloading ? data.ollama.pullState : null);
        if (downloadingRef.current && !downloading) refresh();
        downloadingRef.current = downloading;
        if (data.ollama?.pullState?.error) setNotice(data.ollama.pullState.error);
      }
    } catch {} finally {
      setLoadingSpecs(false);
    }
  };

  useEffect(() => {
    fetchSpecs();
    const interval = setInterval(fetchSpecs, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => { setChatMessages([]); }, [language]);

  useEffect(() => {
    if (specs && chatMessages.length === 0) {
      const isMac = specs.platform === 'darwin';
      const hasLocalModel = specs.ollama?.models?.length > 0;
      const initialGreeting = hasLocalModel
        ? fill(text.readyGreeting, { device: isMac ? 'Mac' : language === 'es' ? 'computadora' : 'computer', model: specs.ollama.activeModel })
        : fill(text.noModelGreeting, { platform: isMac ? 'macOS' : specs.platform, ram: specs.ramGb, model: specs.recommendedModelLabel });

      setChatMessages([{ role: 'assistant', content: initialGreeting }]);
    }
  }, [specs, language, chatMessages.length]);

  useEffect(() => {
    if (followChatRef.current && chatStreamRef.current) {
      chatStreamRef.current.scrollTop = chatStreamRef.current.scrollHeight;
    }
  }, [chatMessages, sending]);

  const bootstrapLocalAgent = async () => {
    setBootstrapping(true);
    setNotice('');
    try {
      const res = await fetch('/api/onboarding/bootstrap-ollama', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: specs?.recommendedModel })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || text.offlineError);
      if (data.status === 'pulling') {
        setPullProgress({ pulling: true, model: specs?.recommendedModel, progress: 0, status: text.downloading });
      } else if (data.status === 'ready') {
        setChatMessages(prev => [
          ...prev,
          { role: 'assistant', content: fill(text.readyMessage, { model: specs.recommendedModel }) }
        ]);
      }
      fetchSpecs();
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBootstrapping(false);
    }
  };

  const sendMessage = async textToSend => {
    const messageText = (textToSend || inputMessage).trim();
    if (!messageText || sending) return;
    setInputMessage('');
    followChatRef.current = true;
    const newHistory = [...chatMessages, { role: 'user', content: messageText }];
    setChatMessages(newHistory);
    setSending(true);

    try {
      const res = await fetch('/api/onboarding/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newHistory, lang: language })
      });
      const data = await res.json();
      if (!res.ok || !data.content) throw new Error(data.error || text.offlineError);
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.content }]);
    } catch (error) {
      setChatMessages(prev => [
        ...prev,
        { role: 'assistant', content: error.message || text.offlineError }
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <section ref={dialogRef} className="modal genesis-modal" role="dialog" aria-modal="true" aria-label={text.title}>
        <button className="close" onClick={onClose} aria-label={text.close}><X size={18}/></button>

        <div className="genesis-head">
          <p className="eyebrow">{text.eyebrow}</p>
          <h2><Sparkles size={20} color="#6366f1"/> {text.title}</h2>
          <p>{text.intro}</p>
          <button className="text-button concierge-close-button" type="button" onClick={onClose}><X size={14}/> {text.close}</button>

          {specs && (
            <div className="specs-bar">
              <span className="specs-chip"><Cpu size={12}/> {specs.platform === 'darwin' ? 'Apple Silicon / macOS' : specs.platform}</span>
              <span className="specs-chip"><Layers size={12}/> {specs.ramGb} GB RAM ({specs.cpus} CPUs)</span>
              <span className="specs-chip highlight">{text.suggested}: {specs.recommendedModel}</span>
              {specs.ollama?.running && (
                <span className="specs-chip" style={{ background: '#ecfdf5', color: '#059669', borderColor: '#a7f3d0' }}>
                  ✓ {text.ollamaActive} ({specs.ollama.models.length} {text.models})
                </span>
              )}
            </div>
          )}
        </div>

        <div className="genesis-body">
          {(!specs?.ollama?.running || specs?.ollama?.models?.length === 0) && (
            <div style={{ padding: '16px 28px', background: '#fdf4ff', borderBottom: '1px solid #fae8ff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <strong style={{ display: 'block', fontSize: 13, color: '#86198f' }}>{text.wakeTitle}</strong>
                <span style={{ fontSize: 11.5, color: '#a21caf' }}>{fill(text.wakeBody, { model: specs?.recommendedModelLabel || (language === 'es' ? 'ligero' : 'lightweight') })}</span>
              </div>
              <button
                className="genesis-banner-btn"
                type="button"
                onClick={bootstrapLocalAgent}
                disabled={bootstrapping || pullProgress?.pulling}
              >
                <Play size={13}/> {pullProgress?.pulling ? `${text.downloading} (${pullProgress.progress}%)` : text.wakeButton}
              </button>
            </div>
          )}

          {pullProgress?.pulling && (
            <div style={{ padding: '10px 28px', background: '#f0fdf4', borderBottom: '1px solid #bbf7d0' }}>
              <div className="pull-progress-meta" style={{ margin: '0 0 4px', fontSize: 11.5 }}>
                <span>{text.downloading} {pullProgress.model}: {pullProgress.status}</span>
                <span>{pullProgress.progress}%</span>
              </div>
              <div className="pull-progress-track" style={{ height: 6 }}>
                <div className="pull-progress-fill" style={{ width: `${pullProgress.progress}%` }}/>
              </div>
            </div>
          )}

          {notice && <p className="run-notice" role="alert">{notice}</p>}
          <div className="genesis-chat-stream" ref={chatStreamRef} onScroll={event => { const node = event.currentTarget; followChatRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < 80; }}>
            {chatMessages.map((msg, idx) => (
              <div key={idx} className={`concierge-bubble ${msg.role}`}>
                <div style={{ fontSize: 11, fontWeight: 800, marginBottom: 4, opacity: 0.8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {msg.role === 'assistant' ? `🤖 ${text.assistant}` : `👤 ${text.you}`}
                </div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
              </div>
            ))}
            {sending && (
              <div className="concierge-bubble agent" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="live-pulse-dot"/> {text.typing}
              </div>
            )}
            <div ref={chatBottomRef}/>
          </div>

          <div className="genesis-suggestions">
            <button className="suggestion-pill" onClick={() => sendMessage(text.codexQuestion)}>
              ⚡ {text.codexQuestion}
            </button>
            <button className="suggestion-pill" onClick={() => sendMessage(text.claudeQuestion)}>
              🟣 {text.claudeQuestion}
            </button>
            <button className="suggestion-pill" onClick={() => sendMessage(text.geminiQuestion)}>
              ✨ {text.geminiQuestion}
            </button>
            <button className="suggestion-pill" onClick={() => sendMessage(text.localQuestion)}>
              🦙 {text.localQuestion}
            </button>
          </div>

          <form className="genesis-input-box" onSubmit={e => { e.preventDefault(); sendMessage(); }}>
            <input
              className="genesis-input-field"
              value={inputMessage}
              onChange={e => setInputMessage(e.target.value)}
              placeholder={text.placeholder}
            />
            <button className="genesis-send-btn" type="submit" disabled={!inputMessage.trim() || sending}>
              <Send size={14}/> {text.send}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}

function CreditsUsageModal({ onClose, onOpenSettings, language = 'en' }) {
  const dialogRef = useDialogFocus(onClose);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const isEs = language === 'es';

  const loadBalances = async () => {
    try {
      setRefreshing(true);
      const res = await fetch('/api/providers/balances');
      if (res.ok) {
        setData(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadBalances();
  }, []);

  const balances = data?.balances || {};
  const metrics = data?.metrics || { totalTokens: 0, totalCostUsd: 0, totalRuns: 0, byProvider: {} };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section ref={dialogRef} className="modal credits-modal" role="dialog" aria-modal="true" aria-label={isEs ? 'Tokens y saldos disponibles' : 'Tokens and available balances'} onClick={e => e.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label={isEs ? 'Cerrar saldos' : 'Close balances'}><X size={18}/></button>

        <div className="credits-head">
          <p className="eyebrow">{isEs ? 'MONITOR DE RECURSOS & FACTURACIÓN LOCAL' : 'RESOURCE MONITOR & LOCAL BILLING'}</p>
          <h2><Coins size={22} color="#b45309"/> {isEs ? 'Tokens & Saldos Disponibles' : 'Tokens & Available Balances'}</h2>
          <p>{isEs ? 'Supervisa el saldo en tiempo real de tus APIs, tu consumo total de tokens y la cuota de cada proveedor.' : 'Monitor real-time API balances, total token usage, and quotas for each provider.'}</p>
        </div>

        <div className="credits-body">
          <div className="credits-summary-row">
            <div className="credits-summary-card">
              <span className="credits-summary-label">{isEs ? 'Tokens Consumidos' : 'Consumed Tokens'}</span>
              <span className="credits-summary-value">{metrics.totalTokens.toLocaleString()}</span>
              <span className="credits-summary-sub">{isEs ? 'En todas las ejecuciones locales' : 'Across all local executions'}</span>
            </div>
            <div className="credits-summary-card">
              <span className="credits-summary-label">{isEs ? 'Costo Total Estimado' : 'Estimated Total Cost'}</span>
              <span className="credits-summary-value">${metrics.totalCostUsd.toFixed(4)} USD</span>
              <span className="credits-summary-sub">{isEs ? 'APIs en la nube (V3/R1)' : 'Cloud APIs (V3/R1)'}</span>
            </div>
            <div className="credits-summary-card">
              <span className="credits-summary-label">{isEs ? 'Tareas Ejecutadas' : 'Executed Tasks'}</span>
              <span className="credits-summary-value">{metrics.totalRuns}</span>
              <span className="credits-summary-sub">{isEs ? 'Auditadas por Orbit' : 'Audited by Orbit'}</span>
            </div>
            <div className="credits-summary-card" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <button
                className="new-button"
                type="button"
                style={{ width: '100%', height: '100%', justifyContent: 'center' }}
                onClick={loadBalances}
                disabled={refreshing}
              >
                <RefreshCw size={14} className={refreshing ? 'spinning' : ''}/> {refreshing ? (isEs ? 'Consultando…' : 'Checking…') : (isEs ? 'Actualizar Saldos' : 'Refresh Balances')}
              </button>
            </div>
          </div>

          <div>
            <div className="credits-section-title">
              <span>{isEs ? 'Saldos y Cuotas de Modelos' : 'Model Balances & Quotas'}</span>
              <small style={{ fontWeight: 400, textTransform: 'none', color: '#64748b' }}>{isEs ? 'Conexión cifrada a los proveedores oficiales' : 'Encrypted connection to official providers'}</small>
            </div>

            <div className="credits-cards-grid">
              {/* DeepSeek */}
              <div className="credit-provider-card">
                <div>
                  <div className="credit-card-top">
                    <span className="credit-provider-name">🐳 DeepSeek Cloud</span>
                    <span className="credit-type-tag payg">{isEs ? 'Pago por Uso' : 'Pay As You Go'}</span>
                  </div>
                  <div className="credit-balance-hero highlight">
                    {balances.deepseek?.balanceDisplay || (isEs ? 'Consultando…' : 'Checking…')}
                  </div>
                  <div className="credit-meta-list">
                    {balances.deepseek?.details && (
                      <>
                        <div><span>{isEs ? 'Saldo recargado:' : 'Topped-up balance:'}</span><strong>{balances.deepseek.details.toppedUp}</strong></div>
                        <div><span>{isEs ? 'Saldo promocional:' : 'Granted balance:'}</span><strong>{balances.deepseek.details.granted}</strong></div>
                      </>
                    )}
                    <div><span>{isEs ? 'Tarifa V3:' : 'V3 rate:'}</span><strong>$0.14 / $0.28 {isEs ? 'por 1M' : 'per 1M'}</strong></div>
                    <div><span>{isEs ? 'Tarifa R1:' : 'R1 rate:'}</span><strong>$0.55 / $2.19 {isEs ? 'por 1M' : 'per 1M'}</strong></div>
                  </div>
                </div>
                <div className="credit-card-footer">
                  <span style={{ color: '#64748b' }}>{balances.deepseek?.configured ? (isEs ? '✓ Clave activa' : '✓ Active key') : (isEs ? 'Sin clave API' : 'No API key')}</span>
                  <a href="https://platform.deepseek.com/top_up" target="_blank" rel="noreferrer" className="credit-link-btn">
                    {isEs ? 'Recargar saldo' : 'Top up balance'} <ExternalLink size={11}/>
                  </a>
                </div>
              </div>

              {/* Gemini */}
              <div className="credit-provider-card">
                <div>
                  <div className="credit-card-top">
                    <span className="credit-provider-name">✨ Google Gemini Pro</span>
                    <span className="credit-type-tag free">{isEs ? '100% Gratis' : '100% Free'}</span>
                  </div>
                  <div className="credit-balance-hero free">
                    {isEs ? 'Tier Gratuito Activo' : 'Active Free Tier'}
                  </div>
                  <div className="credit-meta-list">
                    <div><span>{isEs ? 'Cuota por minuto:' : 'Rate per minute:'}</span><strong>15 RPM / 1M TPM</strong></div>
                    <div><span>{isEs ? 'Cuota diaria:' : 'Daily quota:'}</span><strong>{isEs ? '1,500 peticiones / día' : '1,500 req / day'}</strong></div>
                    <div><span>{isEs ? 'Costo mensual:' : 'Monthly cost:'}</span><strong>$0.00 USD</strong></div>
                    <div><span>{isEs ? 'Ventana contexto:' : 'Context window:'}</span><strong>1M+ tokens</strong></div>
                  </div>
                </div>
                <div className="credit-card-footer">
                  <span style={{ color: '#64748b' }}>Google AI Studio</span>
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="credit-link-btn">
                    {isEs ? 'Ver cuota oficial' : 'View official quota'} <ExternalLink size={11}/>
                  </a>
                </div>
              </div>

              {/* Ollama */}
              <div className="credit-provider-card">
                <div>
                  <div className="credit-card-top">
                    <span className="credit-provider-name">🦙 Ollama Local</span>
                    <span className="credit-type-tag free">{isEs ? 'Ilimitado' : 'Unlimited'}</span>
                  </div>
                  <div className="credit-balance-hero free">
                    {isEs ? 'Ilimitado (Hardware Local)' : 'Unlimited (Local Hardware)'}
                  </div>
                  <div className="credit-meta-list">
                    <div><span>{isEs ? 'Costo por token:' : 'Cost per token:'}</span><strong>$0.00 USD</strong></div>
                    <div><span>{isEs ? 'Límite de uso:' : 'Usage limit:'}</span><strong>{isEs ? 'Sin límite' : 'No limit'}</strong></div>
                    <div><span>{isEs ? 'Consumo:' : 'Hardware:'}</span><strong>{isEs ? 'Memoria RAM & Chip local' : 'RAM & Local Chip'}</strong></div>
                    <div><span>{isEs ? 'Privacidad:' : 'Privacy:'}</span><strong>100% Offline</strong></div>
                  </div>
                </div>
                <div className="credit-card-footer">
                  <span style={{ color: '#64748b' }}>{isEs ? 'Privado en tu equipo' : 'Private on your machine'}</span>
                  <button type="button" className="credit-link-btn" onClick={onOpenSettings} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    {isEs ? 'Administrar modelos' : 'Manage models'}
                  </button>
                </div>
              </div>

              {/* Codex */}
              <div className="credit-provider-card">
                <div>
                  <div className="credit-card-top">
                    <span className="credit-provider-name">⚡ Codex (OpenAI)</span>
                    <span className="credit-type-tag sub">{isEs ? 'Suscripción' : 'Subscription'}</span>
                  </div>
                  <div className="credit-balance-hero">
                    ChatGPT Plus / Team
                  </div>
                  <div className="credit-meta-list">
                    <div><span>{isEs ? 'Modalidad:' : 'Billing:'}</span><strong>{isEs ? 'Tarifa plana ($20/mes)' : 'Flat rate ($20/mo)'}</strong></div>
                    <div><span>{isEs ? 'Costo en Orbit:' : 'Cost in Orbit:'}</span><strong>{isEs ? '$0.00 por token' : '$0.00 per token'}</strong></div>
                    <div><span>{isEs ? 'Sesión:' : 'Session:'}</span><strong>{isEs ? 'CLI Oficial local' : 'Official local CLI'}</strong></div>
                    <div><span>{isEs ? 'Edición de código:' : 'Code editing:'}</span><strong>{isEs ? 'Agente directo' : 'Direct agent'}</strong></div>
                  </div>
                </div>
                <div className="credit-card-footer">
                  <span style={{ color: '#64748b' }}>{isEs ? 'Sesión local vinculada' : 'Local session linked'}</span>
                  <a href="https://chatgpt.com/#pricing" target="_blank" rel="noreferrer" className="credit-link-btn">
                    {isEs ? 'Ver suscripción' : 'View subscription'} <ExternalLink size={11}/>
                  </a>
                </div>
              </div>

              {/* Claude */}
              <div className="credit-provider-card">
                <div>
                  <div className="credit-card-top">
                    <span className="credit-provider-name">🟣 Claude Code</span>
                    <span className="credit-type-tag sub">{isEs ? 'Suscripción / Prepago' : 'Subscription / Prepaid'}</span>
                  </div>
                  <div className="credit-balance-hero">
                    Claude Pro ($20/mes)
                  </div>
                  <div className="credit-meta-list">
                    <div><span>{isEs ? 'Modalidad:' : 'Billing:'}</span><strong>Claude Pro / Console</strong></div>
                    <div><span>{isEs ? 'Guardarraíl Orbit:' : 'Orbit guardrail:'}</span><strong>{isEs ? 'Máx $2.00 por tarea' : 'Max $2.00 per task'}</strong></div>
                    <div><span>{isEs ? 'Modelo:' : 'Model:'}</span><strong>Sonnet (ORBIT_CLAUDE_MODEL)</strong></div>
                    <div><span>{isEs ? 'Seguridad:' : 'Security:'}</span><strong>{isEs ? 'Aprobación local' : 'Local approval'}</strong></div>
                  </div>
                </div>
                <div className="credit-card-footer">
                  <span style={{ color: '#64748b' }}>{isEs ? 'Guardarraíl activo' : 'Guardrail active'}</span>
                  <a href="https://console.anthropic.com/settings/plans" target="_blank" rel="noreferrer" className="credit-link-btn">
                    {isEs ? 'Ver saldo Anthropic' : 'View Anthropic balance'} <ExternalLink size={11}/>
                  </a>
                </div>
              </div>
            </div>
          </div>

          {metrics.byProvider && Object.keys(metrics.byProvider).length > 0 && (
            <div>
              <div className="credits-section-title">
                <span>{isEs ? 'Historial de Consumo por Proveedor' : 'Consumption History by Provider'}</span>
              </div>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '8px 14px' }}>{isEs ? 'Proveedor' : 'Provider'}</th>
                      <th style={{ padding: '8px 14px' }}>{isEs ? 'Tareas' : 'Tasks'}</th>
                      <th style={{ padding: '8px 14px' }}>{isEs ? 'Tokens Usados' : 'Tokens Used'}</th>
                      <th style={{ padding: '8px 14px' }}>{isEs ? 'Costo Estimado' : 'Estimated Cost'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(metrics.byProvider).map(([p, item]) => (
                      <tr key={p} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '8px 14px', fontWeight: 600, textTransform: 'capitalize' }}>{p}</td>
                        <td style={{ padding: '8px 14px' }}>{item.runs}</td>
                        <td style={{ padding: '8px 14px' }}>{item.tokens.toLocaleString()}</td>
                        <td style={{ padding: '8px 14px', color: item.cost > 0 ? '#b45309' : '#16a34a', fontWeight: 600 }}>
                          {item.cost > 0 ? `$${item.cost.toFixed(4)} USD` : (isEs ? '$0.00 (Plan/Gratis)' : '$0.00 (Plan/Free)')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function LocalProfile({ profile, onChange, copy }) {
  const defaults = { name: '', role: copy.projectProfileDefaultRole, workspace: copy.projectProfileDefaultWorkspace };
  const storedDraft = useRef(null);
  const initialized = useRef(false);
  if (!initialized.current) {
    initialized.current = true;
    try { storedDraft.current = JSON.parse(sessionStorage.getItem('orbit-profile-draft') || 'null'); } catch {}
  }
  const dirtyRef = useRef(Boolean(storedDraft.current));
  const [draft, setDraft] = useState(() => storedDraft.current || defaults);
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  useEffect(() => {
    if (!dirtyRef.current) setDraft({ name: profile?.name || '', role: profile?.role || copy.projectProfileDefaultRole, workspace: profile?.workspace || copy.projectProfileDefaultWorkspace });
  }, [profile?.name, profile?.role, profile?.workspace, copy.projectProfileDefaultRole, copy.projectProfileDefaultWorkspace]);
  const updateDraft = next => {
    dirtyRef.current = true; setDraft(next); setNotice('');
    try { sessionStorage.setItem('orbit-profile-draft', JSON.stringify(next)); } catch {}
  };
  const save = async event => {
    event.preventDefault();
    if (savingRef.current) return;
    savingRef.current = true; setSaving(true);
    try {
      const response = await fetch('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || localeText('Could not save profile.', 'No se pudo guardar el perfil.'));
      dirtyRef.current = false;
      try { sessionStorage.removeItem('orbit-profile-draft'); } catch {}
      onChange(body); setNotice(localeText('Local profile saved.', 'Perfil local guardado.'));
    } catch (error) { setNotice(error.message); } finally { savingRef.current = false; setSaving(false); }
  };
  const clear = async () => {
    if (savingRef.current || !window.confirm(localeText('Sign out of this local profile?', '¿Cerrar sesión de este perfil local?'))) return;
    try {
      const response = await fetch('/api/profile', { method: 'DELETE' });
      if (!response.ok) throw new Error(localeText('Could not sign out. Please try again.', 'No se pudo cerrar sesión. Inténtalo de nuevo.'));
      dirtyRef.current = false;
      try { sessionStorage.removeItem('orbit-profile-draft'); } catch {}
      onChange(null); setDraft(defaults);
    } catch (error) { setNotice(error.message); }
  };
  return <section className="panel api-connection"><p className="eyebrow">{copy.localProfile}</p><h2>{profile?.name || copy.createProfile}</h2><p className="secret-copy">{copy.profileHint}</p><form className="profile-form" onSubmit={save} onKeyDown={event => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); event.stopPropagation(); event.currentTarget.requestSubmit(); } }}><label>{copy.name}<input name="name" value={draft.name} disabled={saving} onChange={event => updateDraft({ ...draft, name: event.target.value })} placeholder={copy.name} required/></label><label>{copy.role}<input name="role" value={draft.role} disabled={saving} onChange={event => updateDraft({ ...draft, role: event.target.value })} placeholder={copy.role}/></label><label>{copy.workspaceName}<input name="workspace" value={draft.workspace} disabled={saving} onChange={event => updateDraft({ ...draft, workspace: event.target.value })} placeholder={copy.workspaceName}/></label><div className="profile-actions"><button className="new-button" disabled={saving} title="⌘/Ctrl+S">{copy.saveProfile}</button>{profile && <button type="button" className="text-button danger-button" disabled={saving} onClick={clear}>{copy.signOut}</button>}</div></form>{notice && <p className="run-notice" role="status">{notice}</p>}</section>;
}
function TwilioSettings({ refresh, language = 'en' }) {
  const isEs = language === 'es';
  const t = (english, spanish) => isEs ? spanish : english;
  const [accountSid, setAccountSid] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [phone, setPhone] = useState('');
  const [publicUrl, setPublicUrl] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [status, setStatus] = useState(null);
  const [notice, setNotice] = useState('');
  const load = async () => { const response = await fetch('/api/connections/whatsapp'); if (response.ok) { const body = await response.json(); setStatus(body); setEnabled(body.channelEnabled); } };
  useEffect(() => { load(); }, []);
  const save = async event => { event.preventDefault(); setNotice(t('Saving local configuration…', 'Guardando configuración local…')); try { const response = await fetch('/api/connections/twilio', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountSid, authToken, phone, publicUrl, enabled }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error); setAuthToken(''); setNotice(body.message); setStatus(body); refresh(); } catch (error) { setNotice(error.message); } };
  const disconnect = async () => {
    if (!window.confirm(t('Disconnect WhatsApp and remove local credentials?', '¿Desconectar WhatsApp y eliminar las credenciales locales?'))) return;
    try {
      const response = await fetch('/api/connections/whatsapp', { method: 'DELETE' }); const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || t('Could not disconnect WhatsApp.', 'No se pudo desconectar WhatsApp.'));
      setNotice(body.message || t('WhatsApp disconnected.', 'WhatsApp desconectado.')); setStatus(null); setAccountSid(''); setAuthToken(''); setPhone(''); setPublicUrl(''); refresh();
    } catch (error) { setNotice(error.message); }
  };
  return <section className="panel api-connection twilio-settings"><p className="eyebrow">{t('MOBILE REMOTE CONTROL · TWILIO WHATSAPP', 'CONTROL REMOTO MÓVIL · TWILIO WHATSAPP')}</p><div className="api-heading"><div><h2>WhatsApp {t('to', 'a')} Orbit</h2><p>{t('Only your whitelisted phone number can launch tasks. Every change remains in an isolated worktree until approved.', 'Solo tu número de teléfono autorizado puede iniciar tareas. Cada cambio permanece en un worktree aislado hasta que lo apruebes.')}</p></div><span className={status?.enabled ? 'setup-state ready' : 'setup-state'}>{status?.enabled ? t('Protected and active', 'Protegido y activo') : t('Not configured', 'Sin configurar')}</span></div>{status?.enabled ? <><p className="secret-copy">{t('Twilio signature verification and your whitelisted phone are configured only on this Mac.', 'La verificación de firma de Twilio y tu teléfono autorizado se configuran solo en esta Mac.')}</p><code className="webhook-url">{status.webhookUrl}</code><button className="text-button danger-button" onClick={disconnect}>{t('Disconnect WhatsApp', 'Desconectar WhatsApp')}</button></> : <form className="api-key-form twilio-form" onSubmit={save}><label>{t('Authorized phone number', 'Número de teléfono autorizado')}<input value={phone} onChange={event => setPhone(event.target.value)} placeholder="+15551234567" required/></label><label>{t('Public HTTPS URL', 'URL HTTPS pública')}<input value={publicUrl} onChange={event => setPublicUrl(event.target.value)} placeholder="https://your-tunnel.example.com" required/></label><label>Twilio Account SID ({t('optional', 'opcional')})<input value={accountSid} onChange={event => setAccountSid(event.target.value)} autoComplete="off" placeholder="AC…"/></label><label>Twilio Auth Token<input type="password" value={authToken} onChange={event => setAuthToken(event.target.value)} autoComplete="off" placeholder={t('Paste your token', 'Pega tu token')} required/></label><label className="whatsapp-enabled"><input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)}/>{t('Enable WhatsApp channel', 'Activar canal de WhatsApp')}</label><button className="new-button" type="submit">{t('Save connection', 'Guardar conexión')} <Check size={15}/></button></form>}<small className="webhook-help">{t('In Twilio, configure the webhook URL as ', 'En Twilio, configura la URL de webhook como ')}<code>https://your-public-url/api/webhooks/twilio-whatsapp</code>. {t('Voice notes require transcription before processing as tasks.', 'Las notas de voz requieren transcripción antes de procesarse como tareas.')}</small>{notice && <p className="run-notice">{notice}</p>}</section>;
}

function TelegramMediaModes({ language = 'en' }) {
  const isEs = language === 'es';
  const t = (english, spanish) => isEs ? spanish : english;
  const [capabilities, setCapabilities] = useState(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');
  const load = async () => { const response = await fetch('/api/capabilities/media'); if (response.ok) setCapabilities(await response.json()); };
  useEffect(() => { load(); }, []);
  const install = async mode => {
    const vision = mode === 'vision';
    const message = vision
      ? t('Download the optional local image-analysis model (about 7.8 GB) to this computer? Images remain local and Orbit will not enable it automatically.', '¿Descargar el modelo opcional de análisis visual local (unos 7,8 GB) en este equipo? Las imágenes permanecen locales y Orbit no lo activará automáticamente.')
      : t('Install the optional local voice-transcription engine on this computer? Voice notes remain local and Orbit will not enable it automatically.', '¿Instalar el motor opcional de transcripción local en este equipo? Las notas de voz permanecen locales y Orbit no lo activará automáticamente.');
    if (!window.confirm(message)) return;
    setBusy(mode); setNotice(vision ? t('Downloading the local vision model. This can take several minutes…', 'Descargando el modelo visual local. Puede tardar varios minutos…') : t('Installing local voice transcription…', 'Instalando transcripción de voz local…'));
    try { const response = await fetch(`/api/capabilities/${mode}/install`, { method: 'POST' }); const body = await response.json(); if (!response.ok) throw new Error(body.error); setNotice(body.message); setCapabilities(body); }
    catch (error) { setNotice(error.message || t('Installation could not complete.', 'No se pudo completar la instalación.')); }
    finally { setBusy(''); load(); }
  };
  const toggle = async mode => {
    const enabled = !capabilities?.[mode]?.enabled;
    setBusy(mode);
    try { const response = await fetch('/api/capabilities/media', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [mode === 'voice' ? 'voiceEnabled' : 'visionEnabled']: enabled }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error); setCapabilities(body); setNotice(`${mode === 'voice' ? t('Voice notes', 'Notas de voz') : t('Image analysis', 'Análisis visual')} ${enabled ? t('enabled', 'activado') : t('disabled', 'desactivado')}.`); }
    catch (error) { setNotice(error.message || t('Could not update this mode.', 'No se pudo actualizar este modo.')); }
    finally { setBusy(''); }
  };
  const card = (mode, title, icon, detail) => {
    const config = capabilities?.[mode]; const installing = busy === mode || capabilities?.installing?.[mode];
    return <article className="telegram-media-card" key={mode}><div className="telegram-media-head"><span className="telegram-media-icon">{icon}</span><div><strong>{title}</strong><small>{config?.engine || t('Checking local capability…', 'Comprobando capacidad local…')}{config?.model ? ` · ${config.model}` : ''}</small></div><span className={config?.enabled ? 'setup-state ready' : config?.ready ? 'setup-state' : 'setup-state'}>{config?.enabled ? t('Enabled', 'Activado') : config?.ready ? t('Installed', 'Instalado') : t('Optional', 'Opcional')}</span></div><p>{detail}</p><small className="telegram-media-privacy">{config?.description || t('Private local processing. Nothing is sent to a cloud AI provider.', 'Procesamiento privado local. No se envía nada a un proveedor de IA en la nube.')}</small><div className="telegram-media-actions">{config?.ready ? <button className="text-button" type="button" onClick={() => toggle(mode)} disabled={installing}>{config.enabled ? t('Disable', 'Desactivar') : t('Enable', 'Activar')}</button> : <button className="new-button" type="button" onClick={() => install(mode)} disabled={installing}>{installing ? (mode === 'vision' ? t('Downloading…', 'Descargando…') : t('Installing…', 'Instalando…')) : `${t('Install', 'Instalar')} ${mode === 'vision' ? t('local vision', 'visión local') : t('voice support', 'soporte de voz')}`}</button>}</div></article>;
  };
  return <section className="panel api-connection telegram-media-settings"><p className="eyebrow">{t('OPTIONAL PRIVATE MEDIA · TELEGRAM', 'MEDIOS PRIVADOS OPCIONALES · TELEGRAM')}</p><div className="api-heading"><div><h2>{t('Voice notes and screenshots', 'Notas de voz y capturas')}</h2><p>{t('Give your client guided, opt-in media controls. The engines run on this computer, and raw audio or images are deleted after use.', 'Ofrece controles guiados y opcionales de medios. Los motores funcionan en este equipo y el audio o imágenes sin procesar se eliminan después de usarse.')}</p></div></div><div className="telegram-media-grid">{card('voice', t('Voice notes to agent', 'Notas de voz al agente'), '🎙️', t('Speak a task. Orbit transcribes it locally, then treats the transcript like a normal Telegram instruction.', 'Dicta una tarea. Orbit la transcribe localmente y trata el texto como una instrucción normal de Telegram.'))}{card('vision', t('Screenshot to agent', 'Captura al agente'), '🖼️', t('Send an image with a caption such as “my-app: match this layout”. Orbit analyses the visual reference locally.', 'Envía una imagen con un texto como “my-app: iguala este diseño”. Orbit analiza la referencia visual localmente.'))}</div>{notice && <p className="run-notice">{notice}</p>}<small className="webhook-help">{t('A client must explicitly install and then enable each mode. Voice notes work as instructions; images require a caption to prevent accidental tasks.', 'El cliente debe instalar y luego activar cada modo explícitamente. Las notas de voz funcionan como instrucciones; las imágenes necesitan un texto para evitar tareas accidentales.')}</small></section>;
}

function TelegramSettings({ refresh, language = 'en' }) {
  const isEs = language === 'es';
  const t = (english, spanish) => isEs ? spanish : english;
  const [botToken, setBotToken] = useState('');
  const [authorizedUserId, setAuthorizedUserId] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [status, setStatus] = useState(null);
  const [notice, setNotice] = useState('');
  const [detecting, setDetecting] = useState(false);
  const load = async () => { const response = await fetch('/api/connections/telegram'); if (response.ok) { const body = await response.json(); setStatus(body); setEnabled(body.channelEnabled); } };
  useEffect(() => { load(); }, []);
  const save = async event => {
    event.preventDefault(); setNotice(t('Verifying your Telegram bot…', 'Verificando tu bot de Telegram…'));
    try {
      const response = await fetch('/api/connections/telegram', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ botToken, authorizedUserId, enabled }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error);
      setBotToken(''); setNotice(body.message); setStatus(body); refresh();
    } catch (error) { setNotice(error.message || t('Could not connect Telegram.', 'No se pudo conectar Telegram.')); }
  };
  const disconnect = async () => {
    if (!window.confirm(t('Disconnect Telegram and remove the bot token from this Mac?', '¿Desconectar Telegram y eliminar el token del bot de esta Mac?'))) return;
    try {
      const response = await fetch('/api/connections/telegram', { method: 'DELETE' }); const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || t('Could not disconnect Telegram.', 'No se pudo desconectar Telegram.'));
      setNotice(body.message || t('Telegram disconnected.', 'Telegram desconectado.')); setStatus(null); setBotToken(''); setAuthorizedUserId(''); refresh();
    } catch (error) { setNotice(error.message); }
  };
  const detectUser = async () => {
    if (!botToken.trim()) { setNotice(t('Paste your bot token first, then click Detect my ID.', 'Primero pega el token del bot y luego haz clic en Detectar mi ID.')); return; }
    setDetecting(true); setNotice(t('Looking for the latest private message to your bot…', 'Buscando el último mensaje privado enviado a tu bot…'));
    try {
      const response = await fetch('/api/connections/telegram/detect-user', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ botToken }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error);
      setAuthorizedUserId(body.authorizedUserId); setNotice(t(`Found your Telegram ID${body.displayName ? ` for ${body.displayName}` : ''}.`, `Se encontró tu ID de Telegram${body.displayName ? ` para ${body.displayName}` : ''}.`));
    } catch (error) { setNotice(error.message || t('Could not find a Telegram user ID.', 'No se pudo encontrar un ID de usuario de Telegram.')); } finally { setDetecting(false); }
  };
  return <><section className="panel api-connection telegram-settings"><p className="eyebrow">{t('FREE REMOTE CONTROL · TELEGRAM', 'CONTROL REMOTO GRATIS · TELEGRAM')}</p><div className="api-heading"><div><h2>Telegram {t('to', 'a')} Orbit</h2><p>{t('Free private control with no public webhook or tunnel. Orbit polls Telegram securely from this computer; only your approved Telegram account can start work.', 'Control privado gratuito sin webhook público ni túnel. Orbit consulta Telegram de forma segura desde este equipo; solo tu cuenta aprobada puede iniciar trabajo.')}</p></div><span className={status?.enabled ? 'setup-state ready' : 'setup-state'}>{status?.enabled ? t('Private and active', 'Privado y activo') : t('Not configured', 'Sin configurar')}</span></div>{status?.enabled ? <><p className="secret-copy">{status.botUsername ? `${t('Connected as', 'Conectado como')} @${status.botUsername}. ` : ''}{t('Your bot token and approved Telegram user ID are stored only in this computer’s private configuration.', 'El token del bot y tu ID de usuario autorizado se guardan solo en la configuración privada de este equipo.')}</p><button className="text-button danger-button" onClick={disconnect}>{t('Disconnect Telegram', 'Desconectar Telegram')}</button></> : <form className="api-key-form telegram-form" onSubmit={save}><label>{t('Bot token from', 'Token del bot de')} @BotFather<input type="password" autoComplete="off" value={botToken} onChange={event => setBotToken(event.target.value)} placeholder="123456:ABC…" required/></label><label>{t('Your Telegram numeric user ID', 'Tu ID numérico de usuario de Telegram')}<div className="telegram-id-field"><input inputMode="numeric" autoComplete="off" value={authorizedUserId} onChange={event => setAuthorizedUserId(event.target.value.replace(/\D/g, ''))} placeholder={t('e.g. 123456789', 'p. ej. 123456789')} required/><button type="button" className="text-button" onClick={detectUser} disabled={detecting}>{detecting ? t('Detecting…', 'Detectando…') : t('Detect my ID', 'Detectar mi ID')}</button></div></label><label className="whatsapp-enabled"><input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)}/>{t('Enable Telegram channel', 'Activar canal de Telegram')}</label><button className="new-button" type="submit">{t('Save private connection', 'Guardar conexión privada')} <Check size={15}/></button></form>}<small className="webhook-help">{t('Setup: create a bot in ', 'Configuración: crea un bot en ')}<code>@BotFather</code>, {t('open a private chat with it and send ', 'abre un chat privado con él y envía ')}<code>/start</code>. {t('Paste its token, then use ', 'Pega su token y usa ')}<strong>{t('Detect my ID', 'Detectar mi ID')}</strong>. {t('Unlike WhatsApp, Telegram does not bill per message and does not require a public URL.', 'A diferencia de WhatsApp, Telegram no cobra por mensaje ni requiere una URL pública.')}</small>{notice && <p className="run-notice">{notice}</p>}</section><TelegramMediaModes language={language}/></>;
}

function SettingsPanel({ projects, providers, refresh, onOpenGenesis, language = 'en' }) {
  const [reviews, setReviews] = useState({});
  const [notice, setNotice] = useState('');
  const isEs = language === 'es';
  const review = async project => {
    setNotice(isEs ? `Verificando ${project.name}…` : `Checking ${project.name}…`);
    const response = await fetch(`/api/github/${project.id}`); const body = await response.json();
    if (!response.ok) { setNotice(body.error || (isEs ? 'No se pudo conectar a GitHub.' : 'Could not connect to GitHub.')); return; }
    setReviews(current => ({ ...current, [project.id]: body })); setNotice(isEs ? `GitHub conectado: ${project.name}.` : `GitHub connected: ${project.name}.`);
  };
  return <section className="settings-page">
    <div className="settings-intro">
      <p className="eyebrow">{isEs ? 'CONEXIONES LOCALES & PROVEEDORES' : 'LOCAL CONNECTIONS & PROVIDERS'}</p>
      <h2>{isEs ? 'Hub Central de Modelos e Inteligencia Artificial' : 'Central Model & AI Hub'}</h2>
      <p>{isEs ? 'Configura tus modelos locales y en la nube. Todas las llaves se guardan en tu archivo privado .env sin exponerse a Git.' : 'Configure your local and cloud models. All keys are stored in your private .env file without being exposed to Git.'}</p>
    </div>
    <ModelHubOnboarding providers={providers} refresh={refresh} onOpenGenesis={onOpenGenesis} language={language}/>
    <TelegramSettings refresh={refresh} language={language}/>
    <TwilioSettings refresh={refresh} language={language}/>
    <div className="settings-grid">
      <section className="panel">
        <p className="eyebrow">LOCAL & CLOUD CODING</p>
        <h2>{isEs ? 'Elige el modelo para cada tarea' : 'Choose a model for each task'}</h2>
        <p className="settings-copy">{isEs ? 'En Agentes puedes elegir programar o solo planificar. Todos los proveedores de texto pueden intentar cambios de código. Las recomendaciones son opcionales; los cambios pasan por verificación antes de fusionarse.' : 'In Agents, choose coding or planning for each task. Every connected text provider can attempt code changes. Recommendations are optional; changes go through verification before merge.'}</p>
      </section>
      <section className="panel">
        <p className="eyebrow">GITHUB</p>
        <h2>{isEs ? 'Repositorios privados' : 'Private repositories'}</h2>
        <p className="settings-copy">{isEs ? 'Tu token vive exclusivamente en tu archivo .env. Usa estos botones para verificar conectividad con GitHub.' : 'Your token lives exclusively in your .env file. Use these buttons to verify connectivity with GitHub.'}</p>
        {projects.map(project => <div className="github-setting" key={project.id}><div><strong>{project.name}</strong><small>{project.githubRepo || (isEs ? 'Sin repositorio configurado' : 'No repository configured')}</small></div><button className="text-button" disabled={!project.githubRepo} onClick={() => review(project)}>{isEs ? 'Verificar GitHub' : 'Check GitHub'} <RefreshCw size={14}/></button>{reviews[project.id] && <span className="github-ok">{isEs ? `Conectado · ${reviews[project.id].openPullRequests.length} PRs abiertas` : `Connected · ${reviews[project.id].openPullRequests.length} open PRs`}</span>}</div>)}
        {notice && <p className="run-notice">{notice}</p>}
      </section>
    </div>
  </section>;
}

function useVoiceInput(onResult) {
  const [isListening, setIsListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef(null);
  const resultRef = useRef(onResult);
  resultRef.current = onResult;
  const stopListening = () => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      recognition.onresult = null;
      recognition.onend = null;
      recognition.onerror = null;
      try { recognition.abort(); } catch {}
    }
    setIsListening(false);
  };
  useEffect(() => () => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) { recognition.onresult = null; recognition.onend = null; recognition.onerror = null; try { recognition.abort(); } catch {} }
  }, []);

  const toggleListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert(localeText('Your browser does not support native speech recognition. Use Chrome, Safari, or Edge.', 'Tu navegador no admite reconocimiento de voz nativo. Usa Chrome, Safari o Edge.'));
      setSupported(false);
      return;
    }
    if (recognitionRef.current) {
      stopListening();
      return;
    }
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = document.documentElement.lang === 'es' ? 'es-ES' : 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onstart = () => { if (recognitionRef.current === recognition) setIsListening(true); };
    const finish = () => { if (recognitionRef.current === recognition) { recognitionRef.current = null; setIsListening(false); } };
    recognition.onend = finish;
    recognition.onerror = finish;
    recognition.onresult = event => {
      if (recognitionRef.current !== recognition) return;
      const transcript = event.results?.[0]?.[0]?.transcript;
      if (transcript) resultRef.current(transcript);
    };
    try { recognition.start(); } catch { finish(); }
  };

  return { isListening, toggleListening, stopListening, supported };
}

function RunModelSelect({ provider, providers, value, onChange, label = 'Exact model' }) {
  const [catalog, setCatalog] = useState(null);
  const [custom, setCustom] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const loadModels = async (force = false) => {
    const token = ++generation.current;
    setLoading(true); setError('');
    try {
      const response = await fetch(`/api/models${force ? '?refresh=true' : ''}`);
      if (!response.ok) throw new Error('Model refresh unavailable. You can enter an exact model ID.');
      const body = await response.json();
      if (token === generation.current) setCatalog(body.providers?.find(item => item.id === provider) || null);
    } catch (failure) { if (token === generation.current) setError(failure.message); }
    finally { if (token === generation.current) setLoading(false); }
  };
  useEffect(() => {
    setCatalog(null); setCustom(false);
    if (provider && provider !== 'auto') void loadModels();
    return () => { generation.current++; };
  }, [provider]);
  const selected = catalog || providers.find(item => item.id === provider);
  if (!provider || provider === 'auto') return <label className="run-model-select run-model-select-disabled">Exact model for this run
    <select value="auto" disabled aria-label="Choose a provider before choosing a model">
      <option>Choose a provider first</option>
    </select>
    <small>Automatic routing chooses both the provider and its model.</small>
  </label>;
  const models = selected?.models || [];
  const customValue = value && value !== 'auto' && !models.some(item => item.id === value);
  return <label className="run-model-select">{label}
    <select value={value || 'auto'} onChange={event => { if (event.target.value === '__custom__') setCustom(true); else { setCustom(false); onChange(event.target.value); } }}>
      <option value="auto">Orbit default · {selected?.activeModel || 'automatic'}</option>
      {models.map(model => <option key={model.id} value={model.id}>{model.label || model.id}</option>)}
      {customValue && <option value={value}>{value} · custom</option>}
      <option value="__custom__">Enter another model ID…</option>
    </select>
    {(custom || customValue) && <input aria-label="Custom model ID" placeholder="Exact model ID from your provider" value={customValue ? value : ''} onChange={event => onChange(event.target.value)} />}
    <span className="model-catalog-meta"><small>{selected?.modelSource === 'provider' ? 'Live provider catalog' : selected?.modelSource === 'installed' ? 'Installed models' : selected?.modelSource === 'cli-cache' ? 'Codex CLI catalog' : 'Suggested IDs / CLI aliases · access checked when run starts'}</small><button type="button" className="text-button" disabled={loading} onClick={() => loadModels(true)}>{loading ? 'Refreshing…' : 'Refresh models'}</button></span>
    {(error || selected?.modelCatalogError) && <small role="status">{error || selected.modelCatalogError}</small>}
  </label>;
}

function ModelRecommendation({ prompt, provider, model, providers, onSelect }) {
  const chosen = providers.find(item => item.id === provider);
  const advice = modelAdvice(prompt, provider, model === 'auto' ? chosen?.activeModel || '' : model, providers);
  const suggested = advice.recommendation;
  return <aside className="model-recommendation" aria-label="Model recommendation"><strong>Model guidance · optional</strong><p>{advice.message}</p>{suggested && (suggested.provider !== provider || suggested.model !== model) && <button type="button" className="text-button" onClick={() => onSelect(suggested.provider, suggested.model)}>Use {suggested.provider} · {suggested.model}</button>}<small>You can keep your selection. Guidance is a heuristic, not a benchmark.</small></aside>;
}

function ProjectConnection({ project, copy, refresh }) {
  const projects = [project];
  const [paths, setPaths] = useState({});
  const [githubReviews, setGithubReviews] = useState({});
  const [pickerProject, setPickerProject] = useState(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const savePath = async project => {
    if (busy) return;
    setBusy(true); setNotice('');
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(project.id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ repoPath: paths[project.id] ?? project.repoPath ?? '', githubRepo: paths[`${project.id}-github`] ?? project.githubRepo ?? '' }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || localeText('Could not save connection.', 'No se pudo guardar la conexión.'));
      setNotice(localeText('Repository connection saved.', 'Conexión del repositorio guardada.'));
      await refresh?.();
    } catch (error) { setNotice(error.message); }
    finally { setBusy(false); }
  };
  const reviewGithub = async project => {
    if (busy) return;
    setBusy(true); setNotice(localeText('Checking GitHub…', 'Revisando GitHub…'));
    try {
      const response = await fetch(`/api/github/${encodeURIComponent(project.id)}`); const body = await response.json();
      if (!response.ok) throw new Error(body.error || localeText('Could not check GitHub.', 'No se pudo revisar GitHub.'));
      setGithubReviews(current => ({ ...current, [project.id]: body })); setNotice(localeText('GitHub status updated.', 'Estado de GitHub actualizado.'));
    } catch (error) { setNotice(error.message); }
    finally { setBusy(false); }
  };
  return <div className="project-connection-editor">
    <div className="connect-heading"><FolderGit2 size={17}/><div><p className="eyebrow">{copy.connectionsTitle}</p><h2>{copy.connectionsSubtitle}</h2></div></div><div className="connection-grid">{projects.map(project => <div className="connection-card" key={project.id}><div><strong>{project.name}</strong><span className={project.mode === 'connected' ? 'connection-state connected' : 'connection-state'}>{project.mode === 'connected' ? copy.connected : copy.connectionPending}</span></div><div className="path-field"><input aria-label={copy.localRepoPath} disabled={busy} value={paths[project.id] ?? project.repoPath ?? ""} onChange={e => setPaths({...paths, [project.id]: e.target.value})} placeholder={copy.localRepoPath}/><button className="browse-button" disabled={busy} onClick={() => setPickerProject(project)} aria-label={copy.browseFolders.replace('{project}', project.name)}><FolderOpen size={15}/></button></div><input aria-label={copy.githubRepository} disabled={busy} value={paths[`${project.id}-github`] ?? project.githubRepo ?? ''} onChange={e => setPaths({...paths, [`${project.id}-github`]: e.target.value})} placeholder={copy.githubRepository}/><div className="connection-actions"><button className="text-button" disabled={busy} onClick={() => savePath(project)}>{copy.save} <ChevronRight size={15}/></button><button disabled={busy || !project.githubRepo} className="text-button" onClick={() => reviewGithub(project)}>{copy.checkGithub} <RefreshCw size={13}/></button></div>{githubReviews[project.id] && <div className="github-review"><a href={githubReviews[project.id].url} target="_blank" rel="noreferrer">{githubReviews[project.id].repo}</a><span>{copy.openPrs.replace('{count}', githubReviews[project.id].openPullRequests.length)}</span>{githubReviews[project.id].openPullRequests.slice(0,2).map(pr => <a key={pr.number} href={pr.url} target="_blank" rel="noreferrer">#{pr.number} {pr.title}</a>)}</div>}</div>)}</div>
    {pickerProject && <FolderPicker copy={copy} onClose={() => setPickerProject(null)} onSelect={path => { setPaths({ ...paths, [pickerProject.id]: path }); setPickerProject(null); }}/>}
    {notice && <p className="run-notice" role="status">{notice}</p>}
  </div>;
}

function AgentConsole({ projects, providers, runs, copy, refresh, initialRunId, onInitialRunHandled, initialConfig, onPrefillHandled }) {
  const [savedComposer] = useState(() => { try { return JSON.parse(sessionStorage.getItem('orbit-agent-composer') || '{}'); } catch { return {}; } });
  const [projectId, setProjectId] = useState(savedComposer.projectId || projects[0]?.id || '');
  const [provider, setProvider] = useState(savedComposer.provider || 'auto');
  const [model, setModel] = useState(savedComposer.model || 'auto');
  const [localAction, setLocalAction] = useState(savedComposer.localAction || 'code');
  const [prompt, setPrompt] = useState(savedComposer.prompt || '');
  const [submitting, setSubmitting] = useState(false);
  const activeRunIdRef = useRef(null);
  const [notice, setNotice] = useState('');



  const [activeRunId, setActiveRunId] = useState(null);
  const [activeRun, setActiveRun] = useState(null);
  const [runMode, setRunMode] = useState(savedComposer.runMode || 'direct');
  const [parallelMode, setParallelMode] = useState(false);
  const [plannerProvider, setPlannerProvider] = useState(savedComposer.plannerProvider || 'auto');
  const [coderProvider, setCoderProvider] = useState(savedComposer.coderProvider || 'auto');
  const [plannerModel, setPlannerModel] = useState(savedComposer.plannerModel || 'auto');
  const [coderModel, setCoderModel] = useState(savedComposer.coderModel || 'auto');
  const [selectedProviders, setSelectedProviders] = useState(savedComposer.selectedProviders || []);
  const [selectedProviderModels, setSelectedProviderModels] = useState(savedComposer.selectedProviderModels || {});
  const [comparisonSlots, setComparisonSlots] = useState(savedComposer.comparisonSlots || [{ provider: '', model: 'auto' }, { provider: '', model: 'auto' }]);
  useEffect(() => {
    const available = providers.filter(item => item.available);
    if (available.length) setComparisonSlots(current => current.some(slot => !slot.provider) ? current.map((slot, index) => slot.provider ? slot : { provider: available[index % available.length].id, model: 'auto' }) : current);
  }, [providers]);
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [skills, setSkills] = useState([]);
  const [skillId, setSkillId] = useState(savedComposer.skillId || '');
  const activeSkill = skills.find(skill => skill.id === skillId);
  const [optimizing, setOptimizing] = useState(false);
  const [clearingHistory, setClearingHistory] = useState(false);
  const [taskMetadata, setTaskMetadata] = useState(savedComposer.taskMetadata || null);
  useEffect(() => {
    try { sessionStorage.setItem('orbit-agent-composer', JSON.stringify({ projectId, provider, model, localAction, prompt, taskMetadata, runMode, plannerProvider, coderProvider, plannerModel, coderModel, selectedProviders, selectedProviderModels, comparisonSlots, skillId })); } catch {}
  }, [projectId, provider, model, localAction, prompt, taskMetadata, runMode, plannerProvider, coderProvider, plannerModel, coderModel, selectedProviders, selectedProviderModels, comparisonSlots, skillId]);
  useEffect(() => {
    if (projects.length && !projects.some(project => project.id === projectId)) setProjectId(projects[0].id);
  }, [projects, projectId]);
  const { isListening, toggleListening } = useVoiceInput(transcript => {
    setPrompt(current => (current ? `${current} ${transcript}` : transcript));
  });
  const [collisionData, setCollisionData] = useState(null);
  const clearHistory = async () => {
    const terminalRuns = runs.filter(run => ['completed', 'failed', 'cancelled', 'discarded', 'merged'].includes(run.status));
    if (!terminalRuns.length) { setNotice(localeText('There is no completed or failed activity to clear.', 'No hay actividad completada o fallida para limpiar.')); return; }
    if (!window.confirm(localeText(`Clear ${terminalRuns.length} completed or failed Orbit activity record${terminalRuns.length === 1 ? '' : 's'}? Active agents, review items, projects, and repositories will stay untouched.`, `¿Limpiar ${terminalRuns.length} registro${terminalRuns.length === 1 ? '' : 's'} de actividad completada o fallida? Los agentes activos, elementos por revisar, proyectos y repositorios no se tocarán.`))) return;
    setClearingHistory(true);
    try {
      const response = await fetch('/api/runs/clear-history', { method: 'POST' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || localeText('Could not clear activity history.', 'No se pudo limpiar el historial de actividad.'));
      setNotice(body.message);
      refresh();
    } catch (error) { setNotice(error.message); } finally { setClearingHistory(false); }
  };
  const optimizePrompt = async () => {
    if (!prompt.trim()) return;
    setOptimizing(true); setNotice(copy.optimizing);
    try {
      const response = await fetch('/api/prompts/optimize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, prompt }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || copy.optimizeError);
      setPrompt(body.optimized); setNotice(`${body.notice} Estimated savings: ~${body.tokenSavingsEstimate} tokens.`);
    } catch (error) { setNotice(error.message); } finally { setOptimizing(false); }
  };
  const submit = async event => {
    event.preventDefault();
    if (submitting || !prompt.trim() || !projectId) return;
    setSubmitting(true); setNotice('');
    try {
      let endpoint = '/api/runs';
      let payload = {
        projectId,
        prompt,
        skillId: skillId || undefined,
        ...(taskMetadata && taskMetadata.projectId === projectId
          ? { taskIndex: taskMetadata.taskIndex, taskTitle: taskMetadata.taskTitle }
          : {})
      };

      if (runMode === 'parallel') {
        endpoint = '/api/runs/parallel';
        payload = { ...payload, selections: comparisonSlots, executionMode: localAction };
      } else if (runMode === 'pipeline') {
        endpoint = '/api/runs/pipeline';
        payload = {
          ...payload,
          plannerProvider: plannerProvider === 'auto' ? undefined : plannerProvider,
          coderProvider: coderProvider === 'auto' ? undefined : coderProvider,
          plannerModel: plannerModel === 'auto' ? undefined : plannerModel,
          coderModel: coderModel === 'auto' ? undefined : coderModel
        };
      } else {
        endpoint = '/api/runs';
        payload = { ...payload, provider, model: model === 'auto' ? undefined : model, localWrite: provider === 'local' && localAction === 'code', ...(!['auto', 'codex', 'claude'].includes(provider) ? { executionMode: localAction } : {}) };
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const body = await response.json();
      if (!response.ok) {
        if (response.status === 409 && body.collisionDetected) {
          setCollisionData({ endpoint, payload, activeRuns: body.activeRuns || [] });
          return;
        }
        throw new Error(body.error || copy.executionStartError);
      }
      setPrompt('');
      setTaskMetadata(null);
      if (runMode === 'parallel') {
        setNotice(copy.modelsParallel.replace('{count}', body.runs?.length || 2));
        if (body.groupId) setActiveGroupId(body.groupId);
      } else if (runMode === 'pipeline') {
        setNotice(copy.pipelineActive);
        if (body.id) inspectRun(body.id);
      } else {
        setNotice(copy.orbitSelected.replace('{provider}', body.provider).replace('{reason}', body.routeReason));
        if (body.id) inspectRun(body.id);
      }
      refresh();
    } catch (error) { setNotice(error.message); } finally { setSubmitting(false); }
  };
  const executeConcurrent = async () => {
    if (!collisionData) return;
    const { endpoint, payload } = collisionData;
    setCollisionData(null);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, allowConcurrent: true })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || copy.executionStartError);
      setPrompt('');
      setTaskMetadata(null);
      if (runMode === 'parallel') {
        setNotice(copy.modelsParallel.replace('{count}', body.runs?.length || 2));
        if (body.groupId) setActiveGroupId(body.groupId);
      } else if (runMode === 'pipeline') {
        setNotice(copy.pipelineActive);
        if (body.id) inspectRun(body.id);
      } else {
        setNotice(copy.orbitSelected.replace('{provider}', body.provider).replace('{reason}', body.routeReason));
        if (body.id) inspectRun(body.id);
      }
      refresh();
    } catch (error) { setNotice(error.message); }
  };

  const inspectRun = id => {
    activeRunIdRef.current = id;
    setActiveRun(null);
    setActiveRunId(id);
  };
  useEffect(() => {
    if (!initialRunId) return;
    inspectRun(initialRunId);
    onInitialRunHandled?.();
  }, [initialRunId]);
  useEffect(() => {
    if (!initialConfig) return;
    if (initialConfig.projectId) setProjectId(initialConfig.projectId);
    if (initialConfig.prompt) setPrompt(initialConfig.prompt);
    setProvider(initialConfig.provider || 'auto');
    setModel(initialConfig.model || 'auto');
    setRunMode('direct');
    if (initialConfig.taskTitle) {
      setTaskMetadata({
        taskIndex: initialConfig.taskIndex,
        taskTitle: initialConfig.taskTitle,
        projectId: initialConfig.projectId
      });
    } else {
      setTaskMetadata(null);
    }
    onPrefillHandled?.();
  }, [initialConfig]);
  useEffect(() => {
    if (!activeRunId) return undefined;
    const controller = new AbortController();
    let timer;
    const poll = async () => {
      try {
        const response = await fetch(`/api/runs/${activeRunId}`, { signal: controller.signal });
        if (!response.ok) throw new Error('Could not load this agent run.');
        const body = await response.json();
        if (!controller.signal.aborted && activeRunIdRef.current === activeRunId) setActiveRun(body);
      } catch (error) {
        if (!controller.signal.aborted && activeRunIdRef.current === activeRunId) setNotice(error.message);
      } finally { if (!controller.signal.aborted) timer = setTimeout(poll, 2000); }
    };
    poll(); return () => { controller.abort(); clearTimeout(timer); };
  }, [activeRunId]);
  useEffect(() => { fetch('/api/skills').then(r => r.ok ? r.json() : []).then(items => setSkills(items.filter(item => item.status === 'approved'))).catch(() => {}); }, []);
  return <section className="agent-console">
    <div className="agent-intro"><div><p className="eyebrow">{copy.agentControlPlane}</p><h2>{localeText('Start a task. Follow the work. Review the result.', 'Inicia una tarea. Sigue el trabajo. Revisa el resultado.')}</h2></div><button className="icon-button" onClick={refresh} aria-label={copy.refreshStatus}><RefreshCw size={17}/></button></div>
    <WorkSummary runs={runs} onOpen={run => inspectRun(run.id)}/>
    <div className="agent-columns"><form className="panel run-form" onSubmit={submit} onKeyDown={event => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); submit(event); } }}><div className="panel-title"><div><p className="eyebrow">{copy.newRun}</p><h2>{copy.delegateWork}</h2></div><Send size={18}/></div>
      <details className="execution-options" open={runMode !== "direct" || undefined}><summary>{localeText("Execution options", "Opciones de ejecución")} · {runMode === "direct" ? localeText("Single agent", "Un agente") : runMode === "parallel" ? localeText("Compare models", "Comparar modelos") : localeText("Agent relay", "Trabajo en cadena")}</summary>
      <div className="run-mode-selector"><span className="eyebrow">{copy.executionMode}</span><div className="mode-toggle-group"><button type="button" className={`mode-toggle-btn ${runMode === 'direct' ? 'active' : ''}`} onClick={() => setRunMode('direct')} title={copy.modeDirectDesc}><Bot size={13}/><span>{copy.modeDirect}</span></button><button type="button" className={`mode-toggle-btn ${runMode === 'parallel' ? 'active' : ''}`} onClick={() => setRunMode('parallel')} title={copy.modeParallelDesc}><Cpu size={13}/><span>{copy.modeParallel}</span></button><button type="button" className={`mode-toggle-btn ${runMode === 'pipeline' ? 'active' : ''}`} onClick={() => setRunMode('pipeline')} title={copy.modePipelineDesc}><Layers size={13}/><span>{copy.modePipeline}</span></button></div></div>
      <p className="empty-copy">{runMode === "direct" ? copy.modeDirectDesc : runMode === "parallel" ? copy.modeParallelDesc : copy.modePipelineDesc}</p></details>
      <label>{copy.projectLabel}<select value={projectId} onChange={e => {
        setProjectId(e.target.value);
        if (taskMetadata && taskMetadata.projectId !== e.target.value) {
          setTaskMetadata(null);
        }
      }}>{projects.length ? projects.map(project => <option key={project.id} value={project.id}>{project.name}{project.mode === 'connected' ? ` · ${copy.connectedOption}` : ` · ${copy.noRepoOption}`}</option>) : <option>{copy.startServerProviders}</option>}</select></label>
      {taskMetadata && (
        <div className="task-prefill-banner">
          <div className="task-prefill-info">
            <span className="task-prefill-tag">{localeText('Linked Task', 'Tarea vinculada')}</span>
            <strong className="task-prefill-title">{taskMetadata.taskTitle}</strong>
          </div>
          <button
            type="button"
            className="task-prefill-dismiss"
            onClick={() => setTaskMetadata(null)}
            title={localeText('Unlink task', 'Desvincular tarea')}
            aria-label={localeText('Unlink task', 'Desvincular tarea')}
          >
            <X size={14} />
          </button>
        </div>
      )}
      <div className="prompt-label"><label htmlFor="agent-request">{copy.promptLabel}</label><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><button className={`voice-button ${isListening ? 'listening' : ''}`} type="button" onClick={toggleListening} title={isListening ? copy.stopDictation : copy.dictateTitle}>{isListening ? <MicOff size={13}/> : <Mic size={13}/>}{isListening ? copy.listening : copy.dictate}</button><button className="optimize-button" type="button" onClick={optimizePrompt} disabled={optimizing || !prompt.trim()}><Sparkles size={13}/>{optimizing ? copy.optimizing : copy.optimize}</button></div></div><textarea id="agent-request" value={prompt} onChange={e => setPrompt(e.target.value)} placeholder={copy.askAgent}/>
      {runMode === 'direct' && <><label>{copy.providerLabel}<select value={provider} onChange={e => { setProvider(e.target.value); setModel('auto'); }}><option value="auto">{copy.autoProvider}</option>{providers.map(item => <option disabled={!item.available} key={item.id} value={item.id}>{item.label}{item.available ? '' : ' · requires setup'}</option>)}</select></label><RunModelSelect provider={provider} providers={providers} value={model} onChange={setModel}/>{!['auto', 'codex', 'claude'].includes(provider) && <fieldset className="local-action-selector"><legend>{localeText('What should this model do?', '¿Qué debe hacer este modelo?')}</legend><label><input type="radio" name="local-action" value="code" checked={localAction === 'code'} onChange={() => setLocalAction('code')}/><span><strong>{localeText('Code in an isolated worktree', 'Programar en un worktree aislado')}</strong><small>{localeText('Create a focused patch, verify it, and wait for your approval before merge.', 'Crea un cambio enfocado, lo verifica y espera tu aprobación antes de fusionar.')}</small></span></label><label><input type="radio" name="local-action" value="plan" checked={localAction === 'plan'} onChange={() => setLocalAction('plan')}/><span><strong>{localeText('Plan or review only', 'Solo planificar o revisar')}</strong><small>{localeText('Answer without modifying project files.', 'Responde sin modificar archivos del proyecto.')}</small></span></label><p><ShieldCheck size={13}/>{localeText('Changes stay in an isolated workspace. If a patch fails, retry the same model, narrow the task, or choose another.', 'Los cambios quedan en un espacio aislado. Si fallan, reintenta con el mismo modelo, reduce la tarea o elige otro.')}</p></fieldset>}</>}
      {prompt.trim() && runMode === 'direct' && <ModelRecommendation prompt={prompt} provider={provider} model={model} providers={providers} onSelect={(nextProvider, nextModel) => { setProvider(nextProvider); setModel(nextModel); }}/>}
      {runMode === 'parallel' && <div className="parallel-select"><span className="eyebrow">{copy.select23Models}</span><p>Compare local models with each other or with cloud models. Each gets an independent workspace.</p><label>Comparison mode<select value={localAction} onChange={event => setLocalAction(event.target.value)}><option value="code">Code</option><option value="plan">Plan / review</option></select></label>{comparisonSlots.map((slot, index) => <div className="parallel-model-row" key={index}><label>Model slot {index + 1}<select aria-label={`Provider for slot ${index + 1}`} value={slot.provider} onChange={event => setComparisonSlots(current => current.map((item, i) => i === index ? { provider: event.target.value, model: 'auto' } : item))}><option value="" disabled>Choose provider</option>{providers.filter(item => item.available).map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><RunModelSelect provider={slot.provider} providers={providers} value={slot.model} onChange={model => setComparisonSlots(current => current.map((item, i) => i === index ? { ...item, model } : item))}/>{comparisonSlots.length > 2 && <button type="button" className="text-button" onClick={() => setComparisonSlots(current => current.filter((_, i) => i !== index))}>Remove slot</button>}</div>)}{comparisonSlots.length < 3 && <button type="button" className="text-button" onClick={() => setComparisonSlots(current => [...current, { provider: current[0].provider, model: 'auto' }])}>Add model slot</button>}</div>}
      {runMode === 'pipeline' && <div className="pipeline-config-row"><div><label>{copy.plannerLabel}<select value={plannerProvider} onChange={e => { setPlannerProvider(e.target.value); setPlannerModel('auto'); }}><option value="auto">{copy.autoProvider} (Claude / Gemini / DeepSeek)</option>{providers.filter(p => p.available).map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label><RunModelSelect provider={plannerProvider} providers={providers} value={plannerModel} onChange={setPlannerModel}/></div><div><label>{copy.coderLabel}<select value={coderProvider} onChange={e => { setCoderProvider(e.target.value); setCoderModel('auto'); }}><option value="auto">{copy.autoProvider} (Codex / Claude / Local)</option>{providers.filter(p => p.available && (p.mode === 'write' || p.id === 'local')).map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label><RunModelSelect provider={coderProvider} providers={providers} value={coderModel} onChange={setCoderModel}/></div></div>}
      {skills.length>0&&<label>{copy.approvedSkillOptional}<select value={skillId} onChange={e=>setSkillId(e.target.value)}><option value="">{copy.noSkill}</option>{skills.map(skill=><option key={skill.id} value={skill.id}>{skill.name}</option>)}</select>{activeSkill && <span className="selected-skill-summary"><Sparkles size={12}/><b>{activeSkill.name}</b>{activeSkill.description}</span>}<small className="skill-select-help">{copy.skillSelectHelp}</small></label>}
      <small className="composer-keyboard-hint">Cmd/Ctrl+Enter to send · Enter for a new line</small><button className="new-button" type="submit" disabled={submitting || !prompt.trim() || !projectId}><Sparkles size={16}/>{copy.sendToAgent}</button>{notice && <p className="run-notice">{notice}</p>}</form>
      <div className="right-stack"><WorkActivity runs={runs} projects={projects} onOpen={run => inspectRun(run.id)} onClear={clearHistory} clearing={clearingHistory}/><details className="panel provider-panel"><summary>{localeText("Connected models", "Modelos conectados")} · {providers.filter(item => item.available).length}/{providers.length}</summary><p className="empty-copy">{localeText("Provider setup is in Settings. Repository connections are in each project’s Settings tab.", "Configura proveedores en Ajustes y repositorios en los ajustes de cada proyecto.")}</p>{providers.map(item => <div className="provider-row" key={item.id}><span className={item.available ? "provider-state online" : "provider-state"}/><div><strong>{item.label}</strong><small>{item.detail}</small></div><em>{item.available ? localeText("Connected", "Conectado") : localeText("Setup required", "Requiere configuración")}</em></div>)}</details></div></div>


    {collisionData && (
      <CollisionConfirmationModal
        collisionData={collisionData}
        onClose={() => setCollisionData(null)}
        onConfirmConcurrent={executeConcurrent}
        copy={copy}
        inspectRun={inspectRun}
      />
    )}
    {activeRun && (
      <RunMonitor key={activeRun.id} run={activeRun} providers={providers} copy={copy} onOpenRun={inspectRun} onClose={() => { activeRunIdRef.current = null; setActiveRun(null); setActiveRunId(null); }}/>
    )}
    {activeGroupId && <ParallelComparator groupId={activeGroupId} copy={copy} onClose={() => setActiveGroupId(null)}/>}
  </section>;
}

function CollisionConfirmationModal({ collisionData, onClose, onConfirmConcurrent, copy, inspectRun }) {
  const dialogRef = useDialogFocus(onClose, Boolean(collisionData));
  if (!collisionData) return null;
  const { activeRuns } = collisionData;
  return (
    <div className="modal-backdrop">
      <section ref={dialogRef} className="modal collision-modal" role="dialog" aria-modal="true" aria-label={copy.collisionWarningHeading}>
        <button className="close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <div className="collision-header">
          <div className="collision-icon-badge">
            <AlertCircle size={24} />
          </div>
          <div>
            <p className="eyebrow" style={{ color: '#d97706', marginBottom: 2 }}>{copy.collisionWarningTitle}</p>
            <h3>{copy.collisionWarningHeading}</h3>
            <p>{copy.collisionWarningDesc}</p>
          </div>
        </div>

        {activeRuns?.map(run => (
          <div className="active-run-card" key={run.id}>
            <div className="active-run-card-header">
              <span className="active-run-provider">
                <Bot size={15} />
                <strong>{run.provider}</strong>
                <span style={{ color: '#64748b', fontSize: 11 }}>({run.model})</span>
              </span>
              <span className={`stage-status-tag ${run.status}`}>{run.status}</span>
            </div>
            {run.prompt && (
              <div className="active-run-prompt">
                <span style={{ fontSize: 10, fontWeight: 700, display: 'block', color: '#64748b', marginBottom: 2, fontStyle: 'normal' }}>
                  {copy.activeAgentPrompt}
                </span>
                "{run.prompt}"
              </div>
            )}
            <div className="active-run-files">
              <span className="active-run-files-title">{copy.activeAgentModifiedFiles}</span>
              {run.modifiedFiles?.length ? (
                <div className="active-files-pills">
                  {run.modifiedFiles.map(file => (
                    <span className="active-file-pill" key={file}>
                      <FileCode size={11} style={{ display: 'inline', verticalAlign: '-1px', marginRight: 3 }} />
                      {file}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="active-file-empty">{copy.noModifiedFilesYet}</span>
              )}
            </div>
          </div>
        ))}

        <div className="collision-advisory">
          🛡️ <strong>{localeText('Orbit Isolation Guarantee:', 'Garantía de aislamiento de Orbit:')}</strong> {localeText('Your new task will operate in an independent worktree directory.', 'Tu nueva tarea trabajará en un directorio worktree independiente.')} <code>orbit/...</code> {localeText('It will not overwrite files while working, but Git may require conflict resolution when merging into main.', 'No sobrescribirá archivos mientras trabaja, pero Git podría requerir resolver conflictos al fusionar con main.')}
        </div>

        <div className="collision-actions">
          <button className="text-button" type="button" onClick={onClose}>
            {copy.cancelWait}
          </button>
          <button className="new-button" type="button" onClick={onConfirmConcurrent}>
            <Rocket size={14} />
            {copy.proceedConcurrent}
          </button>
        </div>
      </section>
    </div>
  );
}

function ParallelComparator({ groupId, copy, onClose }) { const dialogRef = useDialogFocus(onClose); const [group, setGroup] = useState(null); const text = { eyebrow: localeText('PARALLEL COMPARISON', 'COMPARACIÓN EN PARALELO'), done: localeText('All models finished.', 'Todos los modelos terminaron.'), working: localeText('Models are currently working…', 'Los modelos están trabajando…'), active: localeText('Working…', 'Trabajando…'), fallback: localeText('Completed without summary.', 'Finalizado sin resumen.'), files: localeText('CHANGED FILES', 'ARCHIVOS MODIFICADOS'), close: localeText('Close comparison', 'Cerrar comparación') }; useEffect(() => { const poll = async () => { const response = await fetch(`/api/runs/group/${groupId}`); if (response.ok) setGroup(await response.json()); }; poll(); const timer = setInterval(poll, 3000); return () => clearInterval(timer); }, [groupId]); if (!group) return null; return <div className="modal-backdrop"><section ref={dialogRef} className="modal comparator-modal" role="dialog" aria-modal="true" aria-label={text.eyebrow}><button className="close" onClick={onClose} aria-label={text.close}><X size={18}/></button><p className="eyebrow">{text.eyebrow}</p><h2>{group.runs[0]?.projectName}</h2><p className="comparator-copy">{group.done ? text.done : text.working}</p><div className="comparator-grid">{group.runs.map(run => <article className={`comparator-card ${run.status}`} key={run.id}><div className="comparator-header"><span className={`run-status ${run.status}`}/><strong>{run.provider}</strong><em>{run.model}</em></div><div className="comparator-body"><p>{run.status === 'running' || run.status === 'queued' ? text.active : run.result || run.error || text.fallback}</p>{run.changedFiles?.length ? <div className="comparator-files"><small>{text.files}</small>{run.changedFiles.map(file => <span key={file}>{file}</span>)}</div> : null}</div></article>)}</div></section></div>; }

function FolderPicker({ copy, onClose, onSelect, title }) {
  const dialogRef = useDialogFocus(onClose);
  const [directory, setDirectory] = useState(null);
  const [error, setError] = useState('');
  const open = async path => { const response = await fetch(`/api/directories${path ? `?path=${encodeURIComponent(path)}` : ''}`); const body = await response.json(); if (!response.ok) setError(body.error); else { setDirectory(body); setError(''); } };
  useEffect(() => { open(); }, []);
  const text = { eyebrow: localeText('LOCAL DIRECTORY PICKER', 'SELECTOR DE CARPETAS LOCALES'), title: title || localeText('Select repository folder', 'Selecciona la carpeta del repositorio'), use: localeText('Use this directory', 'Usar esta carpeta'), git: localeText('Git repo', 'Repositorio Git'), loading: localeText('Loading directories…', 'Cargando carpetas…'), close: localeText('Close folder picker', 'Cerrar selector de carpetas') };
  return <div className="modal-backdrop"><section ref={dialogRef} className="modal folder-picker" role="dialog" aria-modal="true" aria-label={text.title}><button className="close" onClick={onClose} aria-label={text.close}><X size={18}/></button><p className="eyebrow">{text.eyebrow}</p><h2>{text.title}</h2>{error && <p className="picker-error">{error}</p>}{directory ? <><div className="breadcrumb"><button disabled={!directory.parent} onClick={() => open(directory.parent)} aria-label={localeText('Go to parent folder', 'Ir a la carpeta superior')}>←</button><span>{directory.path}</span></div><button className="use-folder" onClick={() => onSelect(directory.path)}>{text.use} <ChevronRight size={16}/></button><div className="folder-list">{directory.entries.map(entry => <button key={entry.path} onClick={() => open(entry.path)}><FolderOpen size={16}/><span>{entry.name}</span>{entry.isGit && <em>{text.git}</em>}<ChevronRight size={15}/></button>)}</div></> : <p className="empty-copy">{text.loading}</p>}</section></div>;
}

function statusCopy(status) {
  const spanish = typeof document !== 'undefined' && document.documentElement.lang === 'es';
  if (status === 'queued') return spanish ? ['En cola', 'Orbit está preparando la ejecución.'] : ['Queued', 'Orbit is preparing the execution.'];
  if (status === 'running') return spanish ? ['En progreso', 'El agente está trabajando. Esta pantalla se actualiza automáticamente.'] : ['In progress', 'The agent is actively working. This screen updates automatically.'];
  if (status === 'awaiting_input') return spanish ? ['Esperando tu respuesta', 'El agente se detuvo para hacer una pregunta antes de continuar.'] : ['Awaiting your input', 'The agent paused to ask a question before continuing.'];
  if (status === 'needs_model') return spanish ? ['Necesita un modelo más capaz', 'El modelo local indicó que esta tarea requiere un agente más potente.'] : ['Needs stronger model', 'Local model flagged that this task requires a more capable agent.'];
  if (status === 'awaiting_dependency_approval') return spanish ? ['Esperando aprobación de dependencias', 'El agente quiere añadir paquetes. No se instala nada hasta que lo apruebes en la bandeja de revisión.'] : ['Awaiting dependency approval', 'The agent wants to add packages. Nothing is installed until you approve them in the Inbox.'];
  if (status === 'awaiting_review') return spanish ? ['Esperando tu revisión', 'El agente terminó. Los cambios permanecen aislados hasta su aprobación.'] : ['Awaiting your review', 'The agent finished. Changes remain isolated until approved.'];
  if (status === 'failed') return spanish ? ['Ejecución fallida', 'El agente se detuvo antes de completar el trabajo. No hay cambios esperando aprobación.'] : ['Run failed', 'The agent stopped before completing the work. There are no changes waiting for approval.'];
  if (status === 'cancelled') return spanish ? ['Detenido por el usuario', 'La ejecución fue interrumpida a tu solicitud.'] : ['Stopped by user', 'Execution was interrupted and halted on your request.'];
  return [status, ''];
}

function readableAgentUpdate(log) {
  if (!log) return '';
  const messages = log.split('\n').flatMap(line => {
    try {
      const event = JSON.parse(line);
      return event.type === 'item.completed' && event.item?.type === 'agent_message' && event.item.text ? [event.item.text] : [];
    } catch { return []; }
  });
  return messages.at(-1) || '';
}

function englishActivityText(value) {
  if (!value || typeof value !== 'string') return value;
  value = value.replace(/^ORBIT_QUESTION:\s*/i, '');
  const translations = [
    ['Inspeccionar estado de Git y rama', 'Inspect Git status and branch'],
    ['Ejecutar pruebas del proyecto', 'Run project tests'],
    ['Compilar proyecto para producción', 'Build project for production'],
    ['Verificar reglas de código (linter)', 'Check code rules (linter)'],
    ['Comprobar tipos de TypeScript', 'Check TypeScript types'],
    ['Instalar paquetes y dependencias', 'Install packages and dependencies'],
    ['Examinar archivos y configuración', 'Inspect files and configuration'],
    ['Plan de acción del agente', 'Agent action plan'],
    ['Mensaje del Agente', 'Agent update'],
    ['Ejecución Detenida', 'Run stopped'],
    ['El usuario detuvo la ejecución del agente.', 'The user stopped this agent run.'],
    ['Proceso detenido por el usuario', 'Run stopped by user'],
    ['Ejecutando:', 'Running:'],
    ['Listo:', 'Completed:'],
    ['Editando:', 'Editing:'],
    ['Modificando ', 'Editing '],
    ['Leyendo ', 'Reading ']
  ];
  return translations.reduce((text, [from, to]) => text.replaceAll(from, to), value);
}

function ActivityStepItem({ step, isLast }) {
  const [showOutput, setShowOutput] = useState(false);

  const getIcon = () => {
    switch (step.type) {
      case 'plan':
      case 'message':
        return '💬';
      case 'command':
        return '⚡';
      case 'file':
        return '🛠️';
      case 'stopped':
        return '⏹';
      default:
        return '🔹';
    }
  };

  const getBadge = () => {
    switch (step.status) {
      case 'completed':
        return <span className="step-badge completed">✓ {localeText('Ready', 'Listo')}</span>;
      case 'running':
        return <span className="step-badge running">● {localeText('Running…', 'Ejecutando…')}</span>;
      case 'failed':
        return <span className="step-badge failed">✕ {localeText('Error', 'Error')}</span>;
      case 'cancelled':
        return <span className="step-badge cancelled">⏹ {localeText('Stopped', 'Detenido')}</span>;
      default:
        return null;
    }
  };

  const isCommand = step.type === 'command';

  return (
    <div className="activity-timeline-item">
      {!isLast && <div className="activity-timeline-connector" />}
      <div className={`activity-step-icon-wrap ${step.type || 'default'}`}>
        {getIcon()}
      </div>
      <div className="activity-step-body">
        <div className="activity-step-top">
          <strong className="activity-step-title">{englishActivityText(step.title)}</strong>
          {getBadge()}
        </div>
        <p className={`activity-step-detail ${isCommand ? 'code-font' : ''}`}>
          {isCommand ? `$ ${step.detail}` : englishActivityText(step.detail)}
        </p>

        {step.output && (
          <div>
            <button
              type="button"
              className="activity-output-btn"
              onClick={() => setShowOutput(!showOutput)}
            >
              {showOutput ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              {showOutput ? localeText('Hide output', 'Ocultar salida') : localeText('View command output', 'Ver salida del comando')}
            </button>
            {showOutput && (
              <pre className="activity-output-preview">{step.output}</pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function RunMonitor({ run, providers = [], onClose, onOpenRun = null, copy = dictionaries.en }) {
  const dialogRef = useDialogFocus(onClose);
  const draftKey = `orbit-run-composer:${run.id}`;
  const [savedDraft] = useState(() => { try { return JSON.parse(sessionStorage.getItem(draftKey) || '{}'); } catch { return {}; } });
  const cleanAgentText = (value, isQuestion = false) => {
    let text = String(value || '').trim();
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const parsed = JSON.parse(text);
        if (typeof parsed === 'string') text = parsed;
        else if (parsed && typeof parsed === 'object') text = String(parsed.question || parsed.result || parsed.content || parsed.text || text);
        else break;
      } catch { break; }
    }
    // Older question records retained the stream envelope's closing delimiter.
    if (isQuestion) text = text.replace(/"\}\}\s*$/, '');
    return text.replace(/\\r\\n|\\n/g, '\n').replace(/\\"/g, '"').replace(/^ORBIT_QUESTION:\s*/i, '');
  };
  const text = {
    noFormattedLog: localeText('No formatted logs are available yet.', 'Aún no hay registros formateados disponibles.'), noLog: localeText('No output recorded yet.', 'Aún no hay salida registrada.'), voiceUnsupported: localeText('Your browser does not support voice recognition.', 'Tu navegador no admite reconocimiento de voz.'), stopConfirm: localeText('Stop this agent run now?', '¿Detener la ejecución del agente ahora mismo?'), stopped: localeText('Run stopped.', 'Ejecución detenida.'), couldNotStop: localeText('Could not stop the run.', 'No se pudo detener la ejecución.'), stopError: localeText('Error while stopping the run.', 'Error al detener la ejecución.'), terminalOpened: localeText('Opened in macOS Terminal.', 'Abierto en la Terminal de macOS.'), couldNotOpenTerminal: localeText('Could not open Terminal.', 'No se pudo abrir la Terminal.'), terminalError: localeText('Error while opening Terminal.', 'Error al abrir la Terminal.'), replySent: localeText('Reply sent. The agent is continuing.', 'Respuesta enviada. El agente continúa trabajando.'), couldNotReply: localeText('Could not send reply.', 'No se pudo enviar la respuesta.'), sending: localeText('Sending to', 'Enviando a'), instructionSent: localeText('Instruction sent to', 'Instrucción enviada a'), agentContinuing: localeText('The agent is continuing.', 'El agente continúa trabajando.'), instructionError: localeText('Could not send instruction.', 'Error al enviar la instrucción.'), close: localeText('Close run monitor', 'Cerrar monitor de ejecución'), eyebrow: localeText('CONTINUOUS CHAT & CONTROL PLANE', 'CHAT CONTINUO Y CONTROL PLANE'), model: localeText('Active model:', 'Modelo activo:'), changeModel: localeText('Change active model', 'Cambiar modelo activo'), stop: localeText('Stop agent', 'Parar agente'), stopping: localeText('Stopping…', 'Deteniendo…'), openTerminal: localeText('Open in macOS Terminal', 'Abrir en Terminal de macOS'), openTerminalHint: localeText('Open a macOS Terminal window in this folder', 'Abrir una ventana de Terminal en macOS en esta carpeta'), chat: localeText('Chat & progress', 'Chat y progreso'), terminal: localeText('Live Terminal Console', 'Consola de Terminal en vivo'), you: localeText('You', 'Tú'), agent: localeText('Agent', 'Agente'), currentStep: localeText('Current step:', 'Paso en curso:'), workingIsolated: localeText('Agent is working in an isolated environment…', 'El agente trabaja en un entorno aislado…'), timeline: localeText('Live progress timeline', 'Línea de progreso en vivo'), live: localeText('Live', 'En ejecución'), starting: localeText('Starting agent and preparing environment…', 'Iniciando el agente y preparando el entorno…'), noSteps: localeText('No detailed steps recorded.', 'Sin pasos detallados registrados.'), changedFiles: localeText('Changed files', 'Archivos modificados'), summary: localeText('Agent summary', 'Resumen del agente'), agentNeedsReply: localeText('The agent needs your reply', 'El agente solicita tu respuesta'), confirmationNeeded: localeText('Confirmation is required to continue.', 'Se requiere confirmación para continuar.'), replyPlaceholder: localeText('Write your clarification here…', 'Escribe tu aclaración aquí…'), sendReply: localeText('Send reply', 'Enviar respuesta'), clean: localeText('Clean', 'Limpio'), formattedOutput: localeText('View clean, formatted output', 'Ver salida limpia y formateada'), rawOutput: localeText('View raw JSON output', 'Ver flujo JSON sin procesar'), copied: localeText('Copied', 'Copiado'), copy: localeText('Copy', 'Copiar'), openMacos: localeText('Open in macOS', 'Abrir en macOS'), runningPrompt: localeText('The agent is working… You can write to redirect or adjust the task…', 'El agente está trabajando… Puedes escribir para redirigir o ajustar la tarea…'), followUpPlaceholder: localeText('Write your next instruction to continue in this same chat (Cmd/Ctrl+Enter to send)…', 'Escribe tu siguiente instrucción para continuar en este mismo chat (Cmd/Ctrl+Enter para enviar)…'), changeNextModel: localeText('Change AI model for the next instruction', 'Cambiar modelo de IA para la siguiente instrucción'), stopDictation: localeText('Stop dictation', 'Detener dictado'), dictate: localeText('Dictate instruction by voice', 'Dictar instrucción por voz'), sendInstruction: localeText('Send instruction', 'Enviar instrucción'), sendInstructionHint: localeText('Send instruction to the agent (Cmd/Ctrl+Enter)', 'Enviar instrucción al agente (Cmd/Ctrl+Enter)'), activeAgent: localeText('Agent active · a new instruction redirects it immediately', 'Agente activo · una nueva instrucción lo redirige de inmediato'), workingBranch: localeText('Working on branch', 'Trabajando en rama'), keyboardHint: localeText('Cmd/Ctrl+Enter to send · Enter for a new line', 'Cmd/Ctrl+Enter para enviar · Enter para nueva línea')
  };
  const [viewMode, setViewMode] = useState('summary');
  const [termMode, setTermMode] = useState('formatted');
  const [selectedProvider, setSelectedProvider] = useState(savedDraft.provider || run.provider || 'codex');
  const [selectedModel, setSelectedModel] = useState(savedDraft.model || run.model || 'auto');
  const [nextExecutionMode, setNextExecutionMode] = useState(run.executionMode || (run.localMode === 'plan' && !run.worktreePath ? 'plan' : 'code'));
  const [stopping, setStopping] = useState(false);
  const [copiedLog, setCopiedLog] = useState(false);
  const [terminalNotice, setTerminalNotice] = useState('');
  const [replyNotice, setReplyNotice] = useState('');
  const [followUp, setFollowUp] = useState(savedDraft.text || '');
  const [followUpNotice, setFollowUpNotice] = useState('');
  const [sending, setSending] = useState(false);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const { isListening, toggleListening } = useVoiceInput(transcript => setFollowUp(current => current ? `${current} ${transcript}` : transcript));
  const terminalEndRef = useRef(null);
  const chatEndRef = useRef(null);
  const scrollAreaRef = useRef(null);
  const followsLiveOutputRef = useRef(true);

  useEffect(() => {
    try { sessionStorage.setItem(draftKey, JSON.stringify({ text: followUp, provider: selectedProvider, model: selectedModel })); } catch {}
  }, [draftKey, followUp, selectedProvider, selectedModel]);

  const [status, explanation] = statusCopy(run.status);
  const result = cleanAgentText(run.result || readableAgentUpdate(run.log));
  const failureDetail = run.status === 'failed' ? String(run.error || run.log || '').trim().slice(-800) : '';
  const formattedOutput = run.formattedLog || run.log || text.noFormattedLog;
  const technicalOutput = run.log || run.error || text.noLog;
  const activeTerminalContent = termMode === 'formatted' ? formattedOutput : technicalOutput;
  const selectedProviderInfo = providers.find(item => item.id === selectedProvider);
  const followUpModels = selectedProviderInfo?.models || [];
  const setFollowUpProvider = nextProvider => {
    setSelectedProvider(nextProvider);
    setSelectedModel('auto');
  };

  const updateLiveFollowState = event => {
    const element = event.currentTarget;
    followsLiveOutputRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 72;
    setShowJumpToLatest(!followsLiveOutputRef.current);
  };

  useEffect(() => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea || !followsLiveOutputRef.current) return;
    scrollArea.scrollTop = scrollArea.scrollHeight;
  }, [run.log, run.steps, run.messages, run.status, viewMode]);

  const stopRun = async () => {
    if (!confirm(text.stopConfirm)) return;
    setStopping(true);
    try {
      const res = await fetch(`/api/runs/${run.id}/stop`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setTerminalNotice(`⏹ ${text.stopped}`);
      } else {
        alert(data.error || text.couldNotStop);
      }
    } catch (err) {
      alert(err.message || text.stopError);
    }
    setStopping(false);
  };

  const openOsTerminal = async (mode = 'workspace') => {
    try {
      const res = await fetch(`/api/runs/${run.id}/open-terminal`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode }) });
      const data = await res.json();
      if (res.ok) {
        setTerminalNotice(mode === 'agent'
          ? localeText('A new interactive agent session opened in Terminal with this task’s context.', 'Una nueva sesión interactiva del agente se abrió en Terminal con el contexto de esta tarea.')
          : localeText('Workspace shell opened in Terminal.', 'Shell del espacio de trabajo abierto en Terminal.'));
        setTimeout(() => setTerminalNotice(''), 4000);
      } else {
        alert(data.error || text.couldNotOpenTerminal);
      }
    } catch (err) {
      alert(err.message || text.terminalError);
    }
  };

  const approveMissingDependency = async () => {
    const dependency = run.missingDependency;
    if (!dependency || sending) return;
    setSending(true);
    setReplyNotice('Approving dependency and continuing the agent…');
    try {
      const response = await fetch(`/api/runs/${run.id}/reply`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply: `I approve adding ${dependency} to package.json and installing it in this isolated workspace. Continue the task and verify the build.` })
      });
      const body = await response.json();
      if (!response.ok) { setReplyNotice(body.error || text.couldNotReply); return; }
      setReplyNotice(text.replySent);
    } catch (err) {
      setReplyNotice(err.message || text.couldNotReply);
    } finally { setSending(false); }
  };

  const sendFollowUp = async event => {
    if (event) event.preventDefault();
    if (!followUp.trim() || sending) return;
    const instructionToSend = followUp.trim();
    const isReply = run.status === 'awaiting_input';
    setSending(true);
    setFollowUpNotice(`${text.sending} ${selectedProvider}…`);
    try {
      const response = await fetch(`/api/runs/${run.id}/${isReply ? 'reply' : 'follow-up'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isReply ? { reply: instructionToSend } : { instruction: instructionToSend, provider: selectedProvider, model: selectedModel === 'auto' ? undefined : selectedModel, executionMode: nextExecutionMode })
      });
      const body = await response.json();
      if (!response.ok) {
        setFollowUpNotice(body.error || text.instructionError);
        return;
      }
      setFollowUp(current => current.trim() === instructionToSend ? '' : current);
      setFollowUpNotice(isReply ? text.replySent : `${text.instructionSent} ${selectedProvider}. ${text.agentContinuing}`);
      setTimeout(() => setFollowUpNotice(''), 4000);
    } catch (err) {
      setFollowUpNotice(err.message || text.instructionError);
    } finally { setSending(false); }
  };

  const canMerge = run.gateStatus === 'verified_ready' && Boolean(run.branch && run.worktreePath);
  const canOpenInteractiveTerminal = ['codex', 'claude'].includes(run.provider) && run.status !== 'running';
  const conversationMessages = run.messages && run.messages.length > 0
    ? run.messages
    : [{ id: 'm-0', role: 'user', content: run.prompt, createdAt: run.createdAt }];

  return (
    <div className="modal-backdrop">
      <section ref={dialogRef} className="modal run-monitor chat-enhanced" role="dialog" aria-modal="true" aria-label={run.projectName}>
        <button className="close" onClick={onClose} aria-label={text.close}><X size={18}/></button>

        <div className="run-monitor-inner-head">
          <p className="eyebrow">{text.eyebrow}</p>
          <h2 style={{ margin: '4px 0 10px' }}>{run.projectName}</h2>

          <div className="run-monitor-topbar" style={{ marginBottom: 8 }}>
            <div className="run-meta">
              <span className={`run-status ${run.status}`}/>
              <strong>{status}</strong>
              <div className="chat-model-selector" style={{ background: '#fff', marginLeft: 4 }}>
                <span className="chat-model-label">{text.model}</span>
                <strong>{providerName(run.provider)} · {run.model || 'Default model'}</strong>
              </div>
              {run.concurrent && (
                <span className="collision-badge" title={`Running concurrently with: ${(run.concurrentWith || []).join(', ')}`}>
                  ⚡ {copy.concurrentBadge || 'Concurrent'}
                </span>
              )}
              {run.skillName && (
                <span className="run-skill-badge" title={run.skillRuntime?.mode === 'native_project_skill' ? 'Native project skill package' : 'Approved skill package in model context'}>
                  <Sparkles size={12}/> {run.skillName} · {run.skillRuntime?.mode === 'native_project_skill' ? 'native' : 'context'}
                </span>
              )}
              {run.usage?.total_tokens ? (
                <span className="token-pill-badge" title={`Prompt: ${run.usage.prompt_tokens?.toLocaleString()} · ${localeText('Output', 'Salida')}: ${run.usage.completion_tokens?.toLocaleString()}`}>
                  <Coins size={12}/> {run.usage.total_tokens.toLocaleString()} tokens {run.estimatedCostUsd > 0 ? `· ~$${run.estimatedCostUsd.toFixed(4)}` : run.provider === 'local' ? '· local' : '· cost unavailable'}
                </span>
              ) : null}
            </div>

            <div className="monitor-actions-cluster">
              {run.status === 'running' && (
                <button
                  className="monitor-stop-btn"
                  type="button"
                  onClick={stopRun}
                  disabled={stopping}
                  title={text.stopConfirm}
                >
                  <Square size={12} fill="currentColor"/> {stopping ? text.stopping : text.stop}
                </button>
              )}
              <button
                className="monitor-terminal-btn"
                type="button"
                onClick={() => openOsTerminal('workspace')}
                title={localeText('Open this run’s folder in a macOS shell.', 'Abrir la carpeta de esta ejecución en una shell de macOS.')}
              >
                <Terminal size={13}/> {localeText('Open workspace shell', 'Abrir shell del espacio')}
              </button>
              {canOpenInteractiveTerminal && <button className="monitor-terminal-btn" type="button" onClick={() => openOsTerminal('agent')} title={localeText('Open a new interactive agent chat in Terminal with this run’s context.', 'Abrir un nuevo chat interactivo del agente en Terminal con el contexto de esta ejecución.')}>
                <Bot size={13}/> {localeText('Start Terminal chat', 'Iniciar chat en Terminal')}
              </button>}
            </div>
          </div>
          {run.pipeline && run.pipelineStages && (
            <div className="pipeline-monitor-banner">
              <div className="pipeline-monitor-title">
                <Layers size={14}/>
                <strong>{run.routeReason || 'Pipeline Relay'}</strong>
              </div>
              <div className="pipeline-stages-stepper">
                {run.pipelineStages.map((stage, idx) => (
                  <div key={stage.id || idx} className={`pipeline-step-node ${stage.status}`}>
                    <div className="step-node-header">
                      {stage.status === 'completed' ? <CheckCircle2 size={14} className="step-icon done"/> : stage.status === 'running' ? <Activity size={14} className="step-icon spin"/> : <Clock size={14} className="step-icon pending"/>}
                      <span className="step-node-name">{idx + 1}. {stage.name}</span>
                    </div>
                    <div className="step-node-meta">
                      <em>{stage.provider}</em>
                      <span className={`stage-status-tag ${stage.status}`}>{stage.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <nav className="monitor-view-tabs" style={{ margin: '8px 0 0' }}>
            <button
              type="button"
              className={viewMode === 'summary' ? 'monitor-tab active' : 'monitor-tab'}
              onClick={() => setViewMode('summary')}
            >
              💬 {text.chat}
            </button>
            <button
              type="button"
              className={viewMode === 'terminal' ? 'monitor-tab active' : 'monitor-tab'}
              onClick={() => setViewMode('terminal')}
            >
              <Terminal size={13}/> {text.terminal} {run.status === 'running' && <span className="tab-live-badge">{text.live}</span>}
            </button>
          </nav>
          {result && viewMode === 'summary' && (
            <section className="monitor-summary-preview" aria-label="Latest agent summary">
              <span>{text.summary}</span>
              <p>{result}</p>
            </section>
          )}
        </div>

        <div ref={scrollAreaRef} className="chat-scroll-area" onScroll={updateLiveFollowState}>
          {terminalNotice && <p className="run-notice" style={{ margin: '8px 0 14px' }}>{terminalNotice}</p>}

          {viewMode === 'summary' ? (
            <div className="chat-thread">
              {/* Conversation History */}
              {conversationMessages.map((msg, index) => {
                const isUser = msg.role === 'user';
                return (
                  <div key={msg.id || index} className={`chat-turn-card ${isUser ? 'user' : 'agent'}`}>
                    <div className="chat-turn-header">
                      <span className="chat-turn-author">
                        {isUser ? (
                          <>
                            <span style={{ fontSize: 13 }}>👤</span> <strong>{text.you}</strong>
                            {msg.provider && <span className="chat-provider-tag">{msg.provider}</span>}
                          </>
                        ) : (
                          <>
                            <Bot size={15} color="#6366f1"/> <strong>{text.agent} ({msg.provider || run.provider})</strong>
                          </>
                        )}
                      </span>
                      {msg.createdAt && (
                        <span className="chat-turn-time">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      )}
                    </div>
                    <p className="chat-turn-text">{msg.role === 'user' ? (msg.content || msg.text) : cleanAgentText(msg.content || msg.text)}</p>
                  </div>
                );
              })}

              {/* Active / Current Agent Response & Work Card */}
              <div className="chat-turn-card agent">
                <div className="chat-turn-header">
                  <span className="chat-turn-author">
                    <Bot size={15} color="#6366f1"/> <strong>{text.agent} ({run.provider})</strong>
                    {run.model && <small style={{ color: '#86868b', fontSize: 11, marginLeft: 4 }}>({run.model})</small>}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className={`run-status ${run.status}`} style={{ margin: 0 }}/>
                    <small style={{ fontSize: 10.5, fontWeight: 700, color: '#64748b' }}>{status}</small>
                  </div>
                </div>

                {/* Live Step banner if running */}
                {run.status === 'running' && (
                  <div className="live-activity-stream" style={{ margin: '8px 0 12px' }}>
                    <span className="live-pulse-dot" />
                    <span className="live-activity-label">{text.currentStep}</span>
                    <span className="live-activity-text">
                      {run.currentStep?.detail || text.workingIsolated}
                    </span>
                  </div>
                )}

                {run.status === 'failed' && (
                  <div className="run-failure-summary">
                    <strong>{localeText('Nothing is waiting for approval', 'No hay nada esperando aprobación')}</strong>
                    <p>{explanation}</p>
                    {failureDetail && <details>
                      <summary>{localeText('View the technical reason', 'Ver el motivo técnico')}</summary>
                      <pre>{failureDetail}</pre>
                    </details>}
                  </div>
                )}

                {/* Activity Steps Timeline */}
                {run.steps && run.steps.length > 0 ? (
                  <div className="activity-timeline-section" style={{ margin: '10px 0 6px', paddingTop: 8 }}>
                    <div className="activity-timeline-header">
                      <span className="activity-timeline-title">{text.timeline}</span>
                      {run.status === 'running' && (
                        <span className="activity-live-tag">
                          <span className="live-pulse-dot" style={{ width: 6, height: 6 }} /> {text.live}
                        </span>
                      )}
                    </div>
                    <div className="activity-timeline">
                      {run.steps.map((st, idx) => (
                        <ActivityStepItem key={st.id || idx} step={st} isLast={idx === run.steps.length - 1} />
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="activity-timeline-empty">
                    {run.status === 'running' ? text.starting : text.noSteps}
                  </p>
                )}

                {/* Changed Files */}
                {run.changedFiles && run.changedFiles.length > 0 && (
                  <div style={{ marginTop: 12, padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <FileCode size={13}/> {text.changedFiles} ({run.changedFiles.length})
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {run.changedFiles.map(f => (
                        <span key={f} style={{ font: '10.5px "DM Mono", monospace', background: '#fff', border: '1px solid #cbd5e1', padding: '2px 7px', borderRadius: 5, color: '#334155' }}>
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

              </div>

              {/* Ready to Merge Banner */}
              {canMerge && (
                <div className="merge-approval-banner">
                  <div>
                    <strong style={{ display: 'block', fontSize: 13, color: '#166534' }}>{copy.verifiedReady}</strong>
                    <span style={{ fontSize: 11.5, color: '#15803d' }}>{copy.verifiedReadyDesc}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="new-button"
                      style={{ background: '#16a34a', padding: '7px 14px', fontSize: 12 }}
                      onClick={async () => {
                        if (!confirm(copy.confirmMergePrompt)) return;
                        const res = await fetch(`/api/runs/${run.id}/merge`, { method: 'POST' });
                        const data = await res.json();
                        if (res.ok) {
                          let openedNextRun = false;
                          const nextTask = data.nextTask;
                          if (nextTask?.title && confirm(`Merged successfully.\n\nContinue with the next project task?\n\n${nextTask.title}`)) {
                            const prompt = `Work on this specific project task: ${nextTask.title}. First inspect the relevant code and project context. Implement only what is needed, verify the result with relevant tests, and report the changed files and any remaining risks.`;
                            const nextRun = await fetch('/api/runs', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                projectId: run.projectId,
                                provider: 'auto',
                                intent: 'implementation',
                                prompt,
                                skillId: run.skillId || undefined,
                                taskIndex: nextTask.index,
                                taskTitle: nextTask.title
                              })
                            });
                            const nextRunData = await nextRun.json();
                            if (!nextRun.ok) {
                              alert(`Changes merged, but the next task could not start: ${nextRunData.error || 'Unknown error.'}`);
                            } else {
                              alert(`Changes merged. Orbit started the next task: ${nextTask.title}`);
                              if (onOpenRun) {
                                openedNextRun = true;
                                onOpenRun(nextRunData.id);
                              }
                            }
                          } else {
                            alert(copy.mergeSuccess);
                          }
                          if (!openedNextRun) onClose();
                        }
                        else {
                          if (data.hasConflicts) {
                            alert(`⚠️ ${copy.mergeConflictTitle}\n\n${copy.mergeConflictDesc}${data.conflictingFiles ? '\n\n• ' + data.conflictingFiles.join('\n• ') : ''}\n\n${copy.mergeConflictAbort}`);
                          } else {
                            alert(`Error: ${data.error}`);
                          }
                        }
                      }}
                    >
                      {copy.approveMergeBtn}
                    </button>
                    <button
                      className="text-button danger-button"
                      style={{ padding: '6px 12px', fontSize: 11 }}
                      onClick={async () => {
                        if (!confirm(copy.confirmDiscardPrompt)) return;
                        await fetch(`/api/runs/${run.id}/discard`, { method: 'POST' });
                        onClose();
                      }}
                    >
                      {copy.discardBtn}
                    </button>
                  </div>
                </div>
              )}

              {run.worktreePath && (
                <p className="safety-copy" style={{ margin: '8px 0 0', textAlign: 'center', fontSize: 11 }}>
                  🔒 {copy.worktreeIsolatedBadge ? copy.worktreeIsolatedBadge.replace('{branch}', run.branch || 'orbit-task') : `Changes isolated on branch ${run.branch || 'orbit-task'}.`}
                </p>
              )}

              <div ref={chatEndRef} />
            </div>
          ) : (
            <div className={`embedded-terminal ${termMode === 'formatted' ? 'terminal-activity-view' : ''}`} style={{ margin: '0 0 16px' }}>
              <header className="terminal-header">
                <div className="terminal-traffic-lights">
                  <span className="term-dot term-dot-red" />
                  <span className="term-dot term-dot-yellow" />
                  <span className="term-dot term-dot-green" />
                </div>
                <div className="terminal-title">
                  orbit-worktree · {run.branch || 'agent-task'} · PID {run.pid || '—'}
                </div>
                <div className="terminal-controls">
                  <div className="terminal-mode-switch">
                    <button
                      type="button"
                      className={termMode === 'formatted' ? 'term-mode-btn active' : 'term-mode-btn'}
                      onClick={() => setTermMode('formatted')}
                      title={text.formattedOutput}
                    >
                      ✨ Activity
                    </button>
                    <button
                      type="button"
                      className={termMode === 'raw' ? 'term-mode-btn active' : 'term-mode-btn'}
                      onClick={() => setTermMode('raw')}
                      title={text.rawOutput}
                    >
                      {'{ }'} Raw JSON
                    </button>
                  </div>
                  <button
                    type="button"
                    className="term-copy-btn"
                    onClick={() => {
                      navigator.clipboard.writeText(activeTerminalContent);
                      setCopiedLog(true);
                      setTimeout(() => setCopiedLog(false), 2500);
                    }}
                  >
                    {copiedLog ? <Check size={11}/> : <Copy size={11}/>}
                    {copiedLog ? text.copied : text.copy}
                  </button>
                  <button type="button" className="term-open-btn" onClick={() => openOsTerminal('workspace')}>
                    <Terminal size={11}/> {localeText('Workspace shell', 'Shell del espacio')}
                  </button>
                  {canOpenInteractiveTerminal && <button type="button" className="term-open-btn" onClick={() => openOsTerminal('agent')}>
                    <Bot size={11}/> {localeText('Terminal chat', 'Chat en Terminal')}
                  </button>}
                </div>
              </header>
              {termMode === 'formatted' ? (
                <div className="terminal-readable" ref={terminalEndRef}>
                  <div className="terminal-readable-hero">
                    <span className={`run-status ${run.status}`} />
                    <div>
                      <strong>{run.status === 'running' ? 'Your agent is working safely in its isolated workspace.' : 'Agent activity is ready to review.'}</strong>
                      <p>{run.currentStep?.detail || (run.status === 'running' ? 'Orbit will keep this view updated as work progresses.' : 'Open Raw JSON only when you need technical diagnostics.')}</p>
                    </div>
                  </div>
                  {run.steps?.length ? (
                    <div className="activity-timeline terminal-activity-timeline">
                      {run.steps.map((step, index) => <ActivityStepItem key={step.id || index} step={step} isLast={index === run.steps.length - 1} />)}
                    </div>
                  ) : (
                    <div className="terminal-readable-empty">
                      <Activity size={16}/>
                      <span>{run.status === 'running' ? 'Preparing the first visible step…' : 'No detailed activity was recorded for this run.'}</span>
                    </div>
                  )}
                  {run.changedFiles?.length > 0 && <div className="terminal-readable-files"><strong><FileCode size={13}/> Changed files</strong><div>{run.changedFiles.map(file => <span key={file}>{file}</span>)}</div></div>}
                </div>
              ) : (
                <pre className="terminal-body" style={{ minHeight: '340px' }} ref={terminalEndRef}>
                  {technicalOutput}
                  {run.status === 'running' && <span className="terminal-cursor">_</span>}
                </pre>
              )}
            </div>
          )}
        </div>

        {/* Docked Chat Input Bar (Always accessible at bottom of modal) */}
        <form className="chat-docked-input" onSubmit={sendFollowUp}>
          {showJumpToLatest && <button className="chat-jump-latest text-button" type="button" onClick={() => {
            followsLiveOutputRef.current = true;
            if (scrollAreaRef.current) scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
            setShowJumpToLatest(false);
          }}>↓ {localeText('Jump to latest', 'Ir a lo más reciente')}</button>}
          {run.status === 'awaiting_input' && <div className="chat-composer-question" role="status">
            <strong>{text.agentNeedsReply}</strong>
            <p>{cleanAgentText(run.question, true) || text.confirmationNeeded}</p>
            {run.missingDependency && <button className="text-button" type="button" onClick={approveMissingDependency}>{localeText('Approve dependency & continue', 'Aprobar dependencia y continuar')}: {run.missingDependency}</button>}
            {replyNotice && <small>{replyNotice}</small>}
          </div>}
          <div className="chat-docked-row">
            <textarea
              className="chat-docked-textarea"
              value={followUp}
              onChange={e => setFollowUp(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  sendFollowUp(e);
                }
              }}
              placeholder={
                run.status === 'awaiting_input' ? text.replyPlaceholder : run.status === 'running'
                  ? text.runningPrompt
                  : localeText('Write your next instruction…', 'Escribe tu siguiente instrucción…')
              }
              rows={1}
            />
            {run.status !== 'awaiting_input' && <div className="chat-model-selector" style={{ height: 40, background: '#fff', borderRadius: 9, padding: '0 8px', border: '1px solid #d1d5db', display: 'flex', alignItems: 'center' }} title={text.changeNextModel}>
              <span className="chat-next-model-label">{localeText('Next:', 'Siguiente:')}</span>
              <select
                className="chat-model-dropdown"
                value={selectedProvider}
                onChange={e => setFollowUpProvider(e.target.value)}
                style={{ fontWeight: 600, fontSize: 12 }}
              >
                {providers.filter(item => item.available || item.id === run.provider).map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
              <input className="chat-model-dropdown chat-exact-model-dropdown" list={`followup-models-${run.id}`} value={selectedModel === 'auto' ? '' : selectedModel} onChange={e => setSelectedModel(e.target.value || 'auto')} aria-label="Exact model for next instruction" placeholder={`Default · ${selectedProviderInfo?.activeModel || 'automatic'}`} style={{ fontSize: 12, maxWidth: 180 }}/>
              <datalist id={`followup-models-${run.id}`}>{followUpModels.map(model => <option key={model.id} value={model.id}>{model.label || model.id}</option>)}</datalist>
              <select aria-label="Next instruction mode" value={nextExecutionMode} onChange={event => setNextExecutionMode(event.target.value)}><option value="code">Code</option><option value="plan">Plan</option></select>
            </div>}
            <button
              type="button"
              className={`chat-docked-mic ${isListening ? 'listening' : ''}`}
              onClick={toggleListening}
              title={isListening ? text.stopDictation : text.dictate}
            >
              {isListening ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
            <button
              type="submit"
              className="chat-docked-send"
              disabled={!followUp.trim() || sending}
              title={localeText('Send (Cmd/Ctrl+Enter)', 'Enviar (Cmd/Ctrl+Enter)')}
            >
              <Send size={14}/> {sending ? localeText('Sending…', 'Enviando…') : run.status === 'awaiting_input' ? text.sendReply : text.sendInstruction}
            </button>
          </div>
          <div className="chat-docked-footer">
            <span>
              {run.status === 'running' ? (
                <span className="chat-running-pill">
                  <span className="live-pulse-dot" style={{ width: 6, height: 6 }}/> {text.activeAgent}
                </span>
              ) : (
                <span>{text.workingBranch} <code>{run.branch || 'orbit-task'}</code></span>
              )}
            </span>
            {followUpNotice && <span style={{ color: '#16a34a', fontWeight: 600 }}>{followUpNotice}</span>}
            <span style={{ fontSize: 9.5 }}>{localeText('Cmd/Ctrl+Enter to send · Enter for a new line', 'Cmd/Ctrl+Enter para enviar · Enter para nueva línea')}</span>
          </div>
        </form>
      </section>
    </div>
  );
}

const FOUNDRY_DRAFTS_KEY = 'orbit-foundry-drafts';
const FOUNDRY_PROVIDER_KEY = 'orbit-foundry-provider';
function readFoundryDrafts() {
  try { return JSON.parse(localStorage.getItem(FOUNDRY_DRAFTS_KEY) || '[]').filter(draft => draft?.name && Array.isArray(draft.tasks)); } catch { return []; }
}
function saveFoundryDraft(blueprint) {
  const drafts = [{ ...blueprint, savedAt: new Date().toISOString() }, ...readFoundryDrafts().filter(draft => draft.idea !== blueprint.idea)].slice(0, 5);
  try { localStorage.setItem(FOUNDRY_DRAFTS_KEY, JSON.stringify(drafts)); } catch { /* Drafts are a convenience only. */ }
  return drafts;
}
function folderSlug(value) {
  return String(value || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'new-project';
}
function FoundrySection({ title, children, hint }) {
  return <div className="panel foundry-card"><div className="foundry-card-title"><h3>{title}</h3></div>{hint && <p className="foundry-hint">{hint}</p>}{children}</div>;
}
function FoundryList({ items }) {
  return items?.length ? <ul className="foundry-list">{items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul> : null;
}

function IdeaFoundry({ copy, providers = [], onCreated, onNavigate }) {
  const t = localeText;
  const language = typeof document !== 'undefined' && document.documentElement.lang === 'es' ? 'es' : 'en';
  const [idea, setIdea] = useState('');
  const [options, setOptions] = useState({ providers: [], suggestedParent: '' });
  const [provider, setProvider] = useState(() => { try { return localStorage.getItem(FOUNDRY_PROVIDER_KEY) || 'auto'; } catch { return 'auto'; } });
  const [forging, setForging] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState('');
  const [blueprint, setBlueprint] = useState(null);
  const [drafts, setDrafts] = useState(readFoundryDrafts);
  const [repoMode, setRepoMode] = useState('create');
  const [parentPath, setParentPath] = useState('');
  const [folderName, setFolderName] = useState('');
  const [startFirst, setStartFirst] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState('');
  const [launched, setLaunched] = useState(null);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef(null);
  const { isListening, toggleListening } = useVoiceInput(transcript => setIdea(current => current ? `${current} ${transcript}` : transcript));
  const canWriteCode = providers.some(item => item.available && item.mode === 'write');

  useEffect(() => {
    fetch('/api/foundry/options').then(response => response.json()).then(body => { setOptions(body); setParentPath(current => current || body.suggestedParent || ''); }).catch(() => {});
  }, []);
  useEffect(() => {
    if (!forging) return undefined;
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [forging]);
  useEffect(() => { try { localStorage.setItem(FOUNDRY_PROVIDER_KEY, provider); } catch { /* Preference only. */ } }, [provider]);

  const openBlueprint = next => {
    setBlueprint(next);
    setFolderName(folderSlug(next.name));
    setLaunched(null);
    setLaunchError('');
  };
  const forge = async providerOverride => {
    if (!idea.trim()) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setForging(true); setElapsed(0); setError(null); setNotice('');
    try {
      const response = await fetch('/api/foundry/forge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ idea, language, provider: providerOverride || provider }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) { setError({ message: body.error || t('Could not draft the plan.', 'No se pudo generar el plan.'), canUseTemplate: body.canUseTemplate }); return; }
      openBlueprint(body.blueprint);
      setNotice(body.notice || '');
      setDrafts(saveFoundryDraft(body.blueprint));
    } catch (forgeError) {
      if (forgeError.name !== 'AbortError') setError({ message: forgeError.message, canUseTemplate: true });
    } finally { setForging(false); abortRef.current = null; }
  };
  const update = patch => setBlueprint(current => {
    const next = { ...current, ...patch };
    setDrafts(saveFoundryDraft(next));
    return next;
  });
  const updateTask = (index, patch) => update({ tasks: blueprint.tasks.map((task, position) => position === index ? { ...task, ...patch } : task) });
  const moveTask = (index, offset) => {
    const tasks = [...blueprint.tasks];
    const target = index + offset;
    if (target < 0 || target >= tasks.length) return;
    [tasks[index], tasks[target]] = [tasks[target], tasks[index]];
    update({ tasks });
  };
  const launch = async () => {
    setLaunching(true); setLaunchError('');
    try {
      const response = await fetch('/api/foundry/launch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ blueprint, repository: repoMode === 'create' ? { mode: 'create', parentPath, folderName } : { mode: 'none' } }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || t('Could not create the project.', 'No se pudo crear el proyecto.'));
      let runStarted = false;
      let runError = '';
      if (repoMode === 'create' && startFirst && canWriteCode) {
        const run = await fetch('/api/runs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: body.project.id, provider: 'auto', prompt: body.firstPrompt, taskIndex: 0, taskTitle: body.project.tasks[0][0] }) });
        const runBody = await run.json().catch(() => ({}));
        runStarted = run.ok;
        runError = run.ok ? '' : runBody.error || '';
      }
      setLaunched({ project: body.project, runStarted, runError });
      onCreated?.();
    } catch (launchFailure) { setLaunchError(launchFailure.message); } finally { setLaunching(false); }
  };
  const copyPrompt = async () => {
    try { await navigator.clipboard.writeText(blueprint.firstPrompt); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* Clipboard may be blocked. */ }
  };

  const providerOptions = options.providers || [];
  const sparks = [
    [PawPrint, t('Dog Walkers On-Demand', 'Paseadores de perros bajo demanda'), t('On-demand dog walking app with live GPS tracking and weekly subscription billing.', 'Aplicación de paseadores de perros bajo demanda con GPS en vivo y suscripción semanal.')],
    [Scissors, t('Barber Booking & Payments', 'Reservas y pagos para barberías'), t('SaaS appointment booking and upfront deposit platform for barbershops and salons.', 'Plataforma SaaS de reservas y depósitos anticipados para barberías y salones.')],
    [FileCode, t('AI Contract Auditor', 'Auditor de contratos con IA'), t('AI agent that analyzes PDF contracts and flags unfair liability clauses.', 'Agente de IA que analiza contratos PDF y detecta cláusulas de responsabilidad injustas.')]
  ];
  const stack = blueprint ? Object.entries(blueprint.techStack || {}).filter(([key, value]) => key !== 'rationale' && value) : [];
  const stackLabels = { frontend: t('Frontend', 'Frontend'), backend: t('Backend', 'Backend'), database: t('Database', 'Base de datos'), auth: t('Sign-in', 'Inicio de sesión'), payments: t('Payments', 'Pagos'), hosting: t('Hosting', 'Alojamiento') };

  return <section className="foundry-container">
    <div className="foundry-hero">
      <div className="foundry-badge"><Lightbulb size={14}/><span>{t('IDEA FOUNDRY', 'LABORATORIO DE IDEAS')}</span></div>
      <h2>{t('Turn an idea into a project agents can build', 'Convierte una idea en un proyecto que los agentes puedan construir')}</h2>
      <p>{t('Describe the idea. Orbit drafts a first-version plan with scope, risks, a fitting stack, and agent-sized tasks. You edit everything, then Orbit creates a local Git repository with the plan and can start the first task.', 'Describe la idea. Orbit prepara un plan de primera versión con alcance, riesgos, un stack adecuado y tareas del tamaño de un agente. Lo editas todo y Orbit crea un repositorio Git local con el plan y puede iniciar la primera tarea.')}</p>
    </div>

    <div className="panel foundry-input-panel">
      <div className="foundry-input-header">
        <label htmlFor="foundry-idea-input"><strong>{t('Describe your idea', 'Describe tu idea')}</strong></label>
        <button type="button" className={`voice-button ${isListening ? 'listening' : ''}`} onClick={toggleListening}>{isListening ? <MicOff size={13}/> : <Mic size={13}/>}{isListening ? copy.listening : copy.dictate}</button>
      </div>
      <textarea id="foundry-idea-input" value={idea} maxLength={4000} onChange={event => setIdea(event.target.value)} rows={4} placeholder={t('Who has the problem, what they do today, and what your product would let them do. E.g. Vet clinics lose appointments to no-shows; send WhatsApp reminders and let owners reschedule in one tap.', 'Quién tiene el problema, qué hace hoy y qué le permitiría hacer tu producto. Ej.: Las clínicas veterinarias pierden citas por ausencias; enviar recordatorios por WhatsApp y permitir reprogramar con un toque.')}/>
      <div className="foundry-input-meta"><small>{idea.length}/4000</small></div>
      <div className="foundry-actions">
        <div className="foundry-examples">
          <small>{t('Examples:', 'Ejemplos:')}</small>
          {sparks.map(([Icon, label, value]) => <button key={label} type="button" onClick={() => setIdea(value)}><Icon size={13}/> {label}</button>)}
        </div>
        <div className="foundry-run">
          <label className="foundry-model">{t('Model', 'Modelo')}
            <select value={provider} onChange={event => setProvider(event.target.value)} disabled={forging}>
              <option value="auto">{providerOptions.length ? t(`Automatic (${providerOptions[0].label})`, `Automático (${providerOptions[0].label})`) : t('Automatic', 'Automático')}</option>
              {providerOptions.map(item => <option key={item.id} value={item.id}>{item.label}{item.local ? t(' · private', ' · privado') : ''}</option>)}
              <option value="template">{t('Template only (no AI)', 'Solo plantilla (sin IA)')}</option>
            </select>
          </label>
          {forging
            ? <button className="text-button" type="button" onClick={() => abortRef.current?.abort()}><X size={14}/> {t('Cancel', 'Cancelar')} · {elapsed}s</button>
            : <button className="new-button foundry-forge-btn" type="button" onClick={() => forge()} disabled={!idea.trim()}><Sparkles size={16}/>{t('Draft the plan', 'Crear el plan')}</button>}
        </div>
      </div>
      {!providerOptions.length && <p className="foundry-hint">{t('No AI model is connected, so Orbit can only offer a fill-in template. Connect one in Settings (Ollama keeps ideas on this computer).', 'No hay ningún modelo de IA conectado; Orbit solo puede ofrecer una plantilla para completar. Conecta uno en Ajustes (Ollama mantiene las ideas en este equipo).')}</p>}
      {error && <div className="run-notice error" role="alert">{error.message}{error.canUseTemplate && <> <button className="text-button" type="button" onClick={() => forge('template')}>{t('Use a template instead', 'Usar una plantilla')}</button></>}</div>}
    </div>

    {forging && <div className="foundry-loading-state" role="status"><div className="foundry-spinner"/><h3>{t('Drafting the plan…', 'Preparando el plan…')}</h3><p>{t('Local models and command-line agents can take a minute or two.', 'Los modelos locales y los agentes de terminal pueden tardar uno o dos minutos.')}</p></div>}

    {!blueprint && !forging && drafts.length > 0 && <div className="panel foundry-drafts">
      <p className="eyebrow">{t('RECENT PLANS ON THIS BROWSER', 'PLANES RECIENTES EN ESTE NAVEGADOR')}</p>
      <div>{drafts.map(draft => <button key={`${draft.name}-${draft.savedAt}`} type="button" onClick={() => { setIdea(draft.idea || ''); openBlueprint(draft); }}>{draft.name}<small>{formatLastUpdated(draft.savedAt)}</small></button>)}</div>
    </div>}

    {blueprint && !forging && <div className="foundry-result-wrapper">
      {notice && <div className="foundry-template-banner" role="status"><AlertCircle size={15}/> {notice}</div>}
      <div className="foundry-result-header">
        <div className="foundry-title-edit">
          <span className={`status ${blueprint.source === 'template' ? 'coral' : 'sky'}`}>{blueprint.source === 'template' ? t('TEMPLATE · NOT AN AI ANALYSIS', 'PLANTILLA · NO ES UN ANÁLISIS DE IA') : `${t('DRAFTED BY', 'CREADO CON')} ${String(blueprint.model || '').toUpperCase()}`}</span>
          <label className="sr-only" htmlFor="foundry-name">{t('Project name', 'Nombre del proyecto')}</label>
          <input id="foundry-name" className="foundry-name-input" value={blueprint.name} maxLength={40} onChange={event => { update({ name: event.target.value }); setFolderName(folderSlug(event.target.value)); }}/>
          <label className="sr-only" htmlFor="foundry-tagline">{t('Tagline', 'Eslogan')}</label>
          <input id="foundry-tagline" className="foundry-tagline-input" value={blueprint.tagline} maxLength={240} placeholder={t('One-sentence value proposition', 'Propuesta de valor en una frase')} onChange={event => update({ tagline: event.target.value })}/>
        </div>
      </div>
      {blueprint.notes?.map(note => <p key={note} className="foundry-hint">{note}</p>)}
      {blueprint.summary && <p className="foundry-summary-text">{blueprint.summary}</p>}
      {blueprint.problem && <p className="foundry-summary-text"><strong>{t('Problem: ', 'Problema: ')}</strong>{blueprint.problem}</p>}

      <div className="foundry-grid">
        {blueprint.targetUsers.length > 0 && <FoundrySection title={t('Target users', 'Usuarios objetivo')}><FoundryList items={blueprint.targetUsers}/></FoundrySection>}
        {blueprint.mvpScope.length > 0 && <FoundrySection title={t('First version', 'Primera versión')}><FoundryList items={blueprint.mvpScope}/></FoundrySection>}
        {blueprint.outOfScope.length > 0 && <FoundrySection title={t('Not yet', 'Todavía no')}><FoundryList items={blueprint.outOfScope}/></FoundrySection>}
        {blueprint.screens.length > 0 && <FoundrySection title={t('Screens', 'Pantallas')}><FoundryList items={blueprint.screens.map(screen => screen.purpose ? `${screen.name}: ${screen.purpose}` : screen.name)}/></FoundrySection>}
        {blueprint.dataModel.length > 0 && <FoundrySection title={t('Data model', 'Modelo de datos')}><FoundryList items={blueprint.dataModel.map(item => `${item.entity}: ${item.fields.join(', ')}`)}/></FoundrySection>}
        {(stack.length > 0 || blueprint.techStack?.rationale) && <FoundrySection title={t('Tech stack', 'Stack técnico')}><FoundryList items={stack.map(([key, value]) => `${stackLabels[key] || key}: ${value}`)}/>{blueprint.techStack.rationale && <p className="foundry-hint">{blueprint.techStack.rationale}</p>}</FoundrySection>}
        {(blueprint.monetization?.model || blueprint.monetization?.pricingHypothesis) && <FoundrySection title={t('Monetization', 'Monetización')} hint={t('A hypothesis to test, not market data.', 'Una hipótesis a validar, no datos de mercado.')}><FoundryList items={[blueprint.monetization.model, blueprint.monetization.pricingHypothesis && `${t('Price to test', 'Precio a probar')}: ${blueprint.monetization.pricingHypothesis}`, blueprint.monetization.rationale].filter(Boolean)}/></FoundrySection>}
        {blueprint.risks.length > 0 && <FoundrySection title={t('Risks', 'Riesgos')}><FoundryList items={blueprint.risks.map(item => item.mitigation ? `${item.risk} → ${item.mitigation}` : item.risk)}/></FoundrySection>}
        {blueprint.validation.length > 0 && <FoundrySection title={t('Validate demand', 'Validar la demanda')}><FoundryList items={blueprint.validation}/></FoundrySection>}
        {blueprint.metrics.length > 0 && <FoundrySection title={t('Success signals', 'Señales de éxito')}><FoundryList items={blueprint.metrics}/></FoundrySection>}
        {blueprint.competitorCategories.length > 0 && <FoundrySection title={t('Alternatives to research', 'Alternativas a investigar')} hint={t('Look these up yourself; the model has no web access.', 'Investígalas tú; el modelo no tiene acceso a internet.')}><FoundryList items={blueprint.competitorCategories}/></FoundrySection>}
      </div>

      <div className="panel foundry-tasks">
        <div className="foundry-card-title"><h3>{t('Build plan for agents', 'Plan de construcción para agentes')}</h3><small>{t('One reviewable change per task, in order. Deployment stays with you.', 'Un cambio revisable por tarea, en orden. El despliegue queda en tus manos.')}</small></div>
        <ol>
          {blueprint.tasks.map((task, index) => <li key={index} className="foundry-task">
            <div className="foundry-task-row">
              <input aria-label={t(`Task ${index + 1} title`, `Título de la tarea ${index + 1}`)} value={task.title} maxLength={120} onChange={event => updateTask(index, { title: event.target.value })}/>
              <div className="foundry-task-tools">
                <button type="button" className="icon-button" aria-label={t('Move up', 'Subir')} disabled={index === 0} onClick={() => moveTask(index, -1)}><ChevronUp size={14}/></button>
                <button type="button" className="icon-button" aria-label={t('Move down', 'Bajar')} disabled={index === blueprint.tasks.length - 1} onClick={() => moveTask(index, 1)}><ChevronDown size={14}/></button>
                <button type="button" className="icon-button" aria-label={t('Remove task', 'Quitar tarea')} disabled={blueprint.tasks.length === 1} onClick={() => update({ tasks: blueprint.tasks.filter((_, position) => position !== index) })}><X size={14}/></button>
              </div>
            </div>
            <textarea aria-label={t(`Task ${index + 1} details`, `Detalles de la tarea ${index + 1}`)} value={task.description} rows={2} maxLength={900} onChange={event => updateTask(index, { description: event.target.value })}/>
            {task.acceptance?.length > 0 && <ul className="foundry-acceptance">{task.acceptance.map(item => <li key={item}>{item}</li>)}</ul>}
          </li>)}
        </ol>
        {blueprint.tasks.length < 10 && <button type="button" className="text-button" onClick={() => update({ tasks: [...blueprint.tasks, { title: t('New task', 'Nueva tarea'), description: '', acceptance: [] }] })}><Plus size={14}/> {t('Add task', 'Añadir tarea')}</button>}
      </div>

      <div className="panel foundry-prompt-panel">
        <div className="foundry-card-title"><h3>{t('First instruction for the agent', 'Primera instrucción para el agente')}</h3><button type="button" className="text-button" onClick={copyPrompt}><Copy size={13}/> {copied ? t('Copied', 'Copiado') : t('Copy', 'Copiar')}</button></div>
        <textarea value={blueprint.firstPrompt} rows={3} maxLength={1500} onChange={event => update({ firstPrompt: event.target.value })}/>
      </div>

      {!launched ? <div className="panel foundry-launch">
        <h3>{t('Create the project', 'Crear el proyecto')}</h3>
        <label className="foundry-radio"><input type="radio" name="foundry-repo" checked={repoMode === 'create'} onChange={() => setRepoMode('create')}/> {t('Create a new local Git repository with this plan', 'Crear un repositorio Git local nuevo con este plan')}</label>
        {repoMode === 'create' && <div className="foundry-repo-fields">
          <label>{t('Parent folder', 'Carpeta padre')}<div className="path-field"><input value={parentPath} onChange={event => setParentPath(event.target.value)}/><button type="button" className="browse-button" aria-label={t('Choose folder', 'Elegir carpeta')} onClick={() => setPickerOpen(true)}><FolderOpen size={15}/></button></div></label>
          <label>{t('Folder name', 'Nombre de la carpeta')}<input value={folderName} maxLength={64} onChange={event => setFolderName(event.target.value)}/></label>
          <p className="foundry-hint">{t('Orbit creates', 'Orbit crea')} <code>{`${parentPath.replace(/\/$/, '')}/${folderName}`}</code> {t('with README.md, docs/PRODUCT_BRIEF.md, and a .gitignore, and makes the first commit.', 'con README.md, docs/PRODUCT_BRIEF.md y un .gitignore, y hace el primer commit.')}</p>
          <label className="foundry-check"><input type="checkbox" checked={startFirst && canWriteCode} disabled={!canWriteCode} onChange={event => setStartFirst(event.target.checked)}/> {canWriteCode ? t('Start the first task with an agent right away', 'Iniciar la primera tarea con un agente enseguida') : t('Connect Codex or Claude in Settings to start the first task automatically', 'Conecta Codex o Claude en Ajustes para iniciar la primera tarea automáticamente')}</label>
        </div>}
        <label className="foundry-radio"><input type="radio" name="foundry-repo" checked={repoMode === 'none'} onChange={() => setRepoMode('none')}/> {t('Only add the project to Orbit (connect an existing folder later)', 'Solo añadir el proyecto a Orbit (conectar una carpeta existente después)')}</label>
        {launchError && <p className="run-notice error" role="alert">{launchError}</p>}
        <button className="new-button foundry-launch-btn" type="button" onClick={launch} disabled={launching || !blueprint.name.trim() || (repoMode === 'create' && (!parentPath || !folderName))}><Rocket size={16}/>{launching ? t('Creating…', 'Creando…') : t('Create project', 'Crear proyecto')}</button>
      </div> : <div className="panel foundry-launched" role="status">
        <CheckCircle2 size={20}/>
        <div>
          <h3>{t(`${launched.project.name} is ready`, `${launched.project.name} está listo`)}</h3>
          <p>{launched.project.repoPath ? `${t('Repository', 'Repositorio')}: ${launched.project.repoPath}` : t('Connect its folder from Agents when you have one.', 'Conecta su carpeta desde Agentes cuando la tengas.')}</p>
          {launched.runStarted && <p>{t('An agent is working on the first task in an isolated branch.', 'Un agente trabaja en la primera tarea en una rama aislada.')}</p>}
          {launched.runError && <p className="run-notice error">{t('The first task did not start: ', 'La primera tarea no se inició: ')}{launched.runError}</p>}
          <div className="foundry-launched-actions">
            {launched.runStarted && <button className="new-button" type="button" onClick={() => onNavigate?.('agents')}>{t('Follow the agent', 'Seguir al agente')}</button>}
            <button className="text-button" type="button" onClick={() => onNavigate?.('projects')}>{t('Open projects', 'Abrir proyectos')}</button>
            <button className="text-button" type="button" onClick={() => { setBlueprint(null); setIdea(''); setLaunched(null); }}>{t('Start another idea', 'Empezar otra idea')}</button>
          </div>
        </div>
      </div>}
    </div>}
    {pickerOpen && <FolderPicker copy={copy} title={t('Where should the project folder go?', '¿Dónde debe ir la carpeta del proyecto?')} onClose={() => setPickerOpen(false)} onSelect={path => { setParentPath(path); setPickerOpen(false); }}/>}
  </section>;
}

function ClientPortal({ projectId, token }) {
  const text = {
    securePortal: localeText('SECURE CLIENT PORTAL', 'PORTAL SEGURO DEL CLIENTE'), linkUnavailable: localeText('Link unavailable', 'Enlace no disponible'), incompleteLink: localeText('This client portal link is incomplete. Ask the project owner for a new secure link.', 'Este enlace del portal del cliente está incompleto. Pide al responsable del proyecto un enlace seguro nuevo.'), couldNotOpen: localeText('This client portal could not be opened.', 'No se pudo abrir este portal del cliente.'), loading: localeText('Loading project update…', 'Cargando la actualización del proyecto…'), clientUpdate: localeText('Client project update', 'Actualización del proyecto para el cliente'), inProgress: localeText('In progress', 'En curso'), project: localeText('PROJECT', 'PROYECTO'), fallbackSummary: localeText('Your project is moving forward. This page shows the latest approved progress from the team.', 'Tu proyecto está avanzando. Esta página muestra el progreso aprobado más reciente del equipo.'), milestones: localeText('Project Milestones', 'Hitos del proyecto'), cloudSetup: localeText('Cloud & 1-Click Setup', 'Nube y configuración en 1 clic'), overallProgress: localeText('Overall progress', 'Progreso general'), milestonesCompleted: localeText('{completed} of {total} milestones completed', '{completed} de {total} hitos completados'), currentMilestones: localeText('CURRENT MILESTONES', 'HITOS ACTUALES'), emptyMilestones: localeText('Milestones will appear here as the project plan is updated.', 'Los hitos aparecerán aquí cuando se actualice el plan del proyecto.'), nextMilestone: localeText('NEXT MILESTONE', 'SIGUIENTE HITO'), nextFallback: localeText('Continue the next approved phase', 'Continuar la siguiente fase aprobada'), verifiedUpdate: localeText('The team will update this portal as verified work is completed.', 'El equipo actualizará este portal a medida que se complete el trabajo verificado.'), openLive: localeText('Open live project', 'Abrir proyecto en vivo'), oneClickModel: localeText('MODEL 2 · ONE-CLICK DEPLOYMENT', 'MODELO 2 · DESPLIEGUE EN 1 CLIC'), deployCloud: localeText('Deploy to Your Cloud Accounts in 1 Click', 'Publica en tus cuentas cloud en 1 clic'), ownership: localeText('You maintain 100% legal ownership and direct billing of your infrastructure. Click below to automatically provision hosting and database into your personal or company accounts.', 'Mantienes el 100% de la propiedad legal y la facturación directa de tu infraestructura. Haz clic abajo para aprovisionar alojamiento y base de datos en tus cuentas personales o de empresa.'), vercelHosting: localeText('Vercel Production Hosting', 'Alojamiento de producción en Vercel'), vercelDetail: localeText('1-Click clone & deployment directly into your Vercel account with instant global CDN and custom domains.', 'Clonación y despliegue en 1 clic directamente en tu cuenta de Vercel, con CDN global instantánea y dominios personalizados.'), deployVercel: localeText('Deploy to Vercel (1-Click)', 'Publicar en Vercel (1 clic)'), supabaseDatabase: localeText('Supabase Cloud Database', 'Base de datos cloud de Supabase'), supabaseDetail: localeText('Provision your dedicated Postgres database, authentication, and secure storage in Supabase\'s official cloud.', 'Aprovisiona tu base de datos Postgres dedicada, autenticación y almacenamiento seguro en la nube oficial de Supabase.'), createSupabase: localeText('Create Supabase Project (1-Click)', 'Crear proyecto Supabase (1 clic)'), guidedModel: localeText('MODEL 1 · GUIDED DELEGATION', 'MODELO 1 · DELEGACIÓN GUIADA'), connectAccounts: localeText('Connect Your Accounts to the Engineering Team', 'Conecta tus cuentas al equipo de ingeniería'), accountSteps: localeText('Follow these simple steps so Orbit agents and our developers can manage database migrations and health checks securely without seeing your personal password.', 'Sigue estos pasos sencillos para que los agentes de Orbit y nuestro equipo puedan gestionar migraciones y revisiones de estado de forma segura sin ver tu contraseña personal.'), createSupabaseStep: localeText('Create or open your Supabase project', 'Crea o abre tu proyecto de Supabase'), createSupabaseDetail: localeText('Use the 1-Click button above or navigate to your Supabase dashboard to create your production project.', 'Usa el botón de 1 clic de arriba o abre tu panel de Supabase para crear el proyecto de producción.'), inviteTeam: localeText('Invite the engineering team as a Collaborator', 'Invita al equipo de ingeniería como colaborador'), inviteDetail: localeText('In your Supabase project, go to Project Settings > Members and invite our technical team email with Developer access:', 'En tu proyecto de Supabase, abre Project Settings > Members e invita el correo de nuestro equipo técnico con acceso Developer:'), copied: localeText('Copied', 'Copiado'), copyEmail: localeText('Copy email', 'Copiar correo'), linkReference: localeText('Link Project Reference or Confirm Invitation', 'Vincula la referencia del proyecto o confirma la invitación'), referenceDetail: localeText('Enter your Supabase Project Reference (e.g. https://xyzcompany.supabase.co or ID xyzcompany) so Orbit can link migrations:', 'Escribe la referencia de tu proyecto de Supabase (por ejemplo, https://xyzcompany.supabase.co o el ID xyzcompany) para que Orbit pueda vincular las migraciones:'), referencePlaceholder: localeText('e.g. abcdefghijklmno or https://app.supabase.co', 'p. ej. abcdefghijklmno o https://app.supabase.co'), invitationSent: localeText('I have sent the collaborator invitation to the engineering team', 'He enviado la invitación de colaborador al equipo de ingeniería'), saving: localeText('Saving…', 'Guardando…'), saveInfrastructure: localeText('Save & Confirm Infrastructure', 'Guardar y confirmar infraestructura'), saved: localeText('Saved! The engineering team and Orbit have been notified.', '¡Guardado! El equipo de ingeniería y Orbit han sido notificados.'), readOnly: localeText('Read-only · Shared securely by Orbit', 'Solo lectura · Compartido de forma segura por Orbit')
  };
  const [project, setProject] = useState(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [supabaseRef, setSupabaseRef] = useState('');
  const [invited, setInvited] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    if (!token) {
      setError(text.incompleteLink);
      return () => { active = false; };
    }
    fetch(`/api/share/${encodeURIComponent(projectId)}?token=${encodeURIComponent(token)}`)
      .then(async response => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || text.couldNotOpen);
        return body;
      })
      .then(body => {
        if (active) {
          setProject(body);
          if (body.infra) {
            setSupabaseRef(body.infra.supabaseRef || '');
            setInvited(Boolean(body.infra.invited));
          }
        }
      })
      .catch(reason => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [projectId, token, text.couldNotOpen, text.incompleteLink]);

  const saveInfra = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/share/${encodeURIComponent(projectId)}/infra?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supabaseRef, invited })
      });
      if (res.ok) {
        const data = await res.json();
        setProject(current => ({ ...current, infra: data.infra }));
        setSavedNotice(true);
        setTimeout(() => setSavedNotice(false), 5000);
      }
    } catch {}
    setSaving(false);
  };

  const copyEmail = async () => {
    if (!project?.inviteEmail) return;
    await navigator.clipboard.writeText(project.inviteEmail);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 3000);
  };

  if (error) return <main className="client-portal-shell"><section className="client-portal-error"><div className="client-orbit-mark">O</div><p className="eyebrow">{text.securePortal}</p><h1>{text.linkUnavailable}</h1><p>{error}</p></section></main>;
  if (!project) return <main className="client-portal-shell"><section className="client-portal-loading"><div className="client-orbit-mark">O</div><p>{text.loading}</p></section></main>;

  const progress = Math.max(0, Math.min(100, Number(project.progress) || 0));
  const tasks = project.tasksSummary || [];
  const completed = tasks.filter(task => task.completed).length;

  const vercelDeployUrl = project.githubRepo
    ? `https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2F${encodeURIComponent(project.githubRepo)}&project-name=${encodeURIComponent(project.id)}`
    : 'https://vercel.com/new';
  const supabaseNewProjectUrl = `https://supabase.com/dashboard/new?name=${encodeURIComponent(project.name)}`;

  return <main className="client-portal-shell">
    <section className="client-portal-card">
      <header className="client-portal-header">
        <div className="client-portal-brand"><div className="client-orbit-mark">O</div><div><strong>Orbit</strong><span>{text.clientUpdate}</span></div></div>
        <span className="client-portal-status">{project.status || text.inProgress}</span>
      </header>
      <div className="client-portal-hero">
        <p className="eyebrow">{project.kind || text.project}</p>
        <h1>{project.name}</h1>
        <p>{project.summary || text.fallbackSummary}</p>
      </div>

      <nav className="client-tabs">
        <button
          type="button"
          className={activeTab === 'overview' ? 'client-tab-btn active' : 'client-tab-btn'}
          onClick={() => setActiveTab('overview')}
        >
          {text.milestones} ({progress}%)
        </button>
        <button
          type="button"
          className={activeTab === 'infrastructure' ? 'client-tab-btn active' : 'client-tab-btn'}
          onClick={() => setActiveTab('infrastructure')}
        >
          {text.cloudSetup} {project.infra?.status === 'configured' && '✓'}
        </button>
      </nav>

      {activeTab === 'overview' ? (
        <>
          <section className="client-progress-panel">
            <div><span>{text.overallProgress}</span><strong>{progress}%</strong></div>
            <div className="client-progress-track"><i style={{ width: `${progress}%` }}/></div>
            <small>{text.milestonesCompleted.replace('{completed}', completed).replace('{total}', tasks.length)}</small>
          </section>
          <div className="client-portal-grid">
            <section className="client-portal-section">
              <p className="eyebrow">{text.currentMilestones}</p>
              <div className="client-task-list">
                {tasks.length ? tasks.map((task, index) => <div className={task.completed ? 'complete' : ''} key={`${task.title}-${index}`}><span>{task.completed ? <Check size={14}/> : index + 1}</span><p>{task.title}</p></div>) : <p className="client-empty">{text.emptyMilestones}</p>}
              </div>
            </section>
            <aside className="client-next-card">
              <p className="eyebrow">{text.nextMilestone}</p>
              <h2>{project.nextMilestone || text.nextFallback}</h2>
              <p>{text.verifiedUpdate}</p>
              {project.deployedUrl && <a href={project.deployedUrl} target="_blank" rel="noreferrer">{text.openLive} <ArrowUpRight size={15}/></a>}
            </aside>
          </div>
        </>
      ) : (
        <div className="client-infra-grid">
          <section className="client-1click-section">
            <p className="eyebrow">{text.oneClickModel}</p>
            <h3>{text.deployCloud}</h3>
            <p className="client-section-subtitle">
              {text.ownership}
            </p>

            <div className="client-deploy-cards">
              <div className="client-deploy-card vercel">
                <div className="deploy-card-header">
                  <div className="deploy-brand-icon">▲</div>
                  <div>
                    <h4>{text.vercelHosting}</h4>
                    <p>{text.vercelDetail}</p>
                  </div>
                </div>
                <a href={vercelDeployUrl} target="_blank" rel="noreferrer" className="deploy-1click-btn">
                  {text.deployVercel} <ArrowUpRight size={14}/>
                </a>
              </div>

              <div className="client-deploy-card supabase">
                <div className="deploy-card-header">
                  <div className="deploy-brand-icon">⚡</div>
                  <div>
                    <h4>{text.supabaseDatabase}</h4>
                    <p>{text.supabaseDetail}</p>
                  </div>
                </div>
                <a href={supabaseNewProjectUrl} target="_blank" rel="noreferrer" className="deploy-1click-btn">
                  {text.createSupabase} <ArrowUpRight size={14}/>
                </a>
              </div>
            </div>
          </section>

          <section className="client-guide-section">
            <p className="eyebrow">{text.guidedModel}</p>
            <h3>{text.connectAccounts}</h3>
            <p className="client-section-subtitle">
              {text.accountSteps}
            </p>

            <div className="client-steps-card">
              <div className="client-step-row">
                <div className="step-number">1</div>
                <div className="step-content">
                  <h4>{text.createSupabaseStep}</h4>
                  <p>{text.createSupabaseDetail}</p>
                </div>
              </div>

              <div className="client-step-row">
                <div className="step-number">2</div>
                <div className="step-content">
                  <h4>{text.inviteTeam}</h4>
                  <p>{text.inviteDetail}</p>
                  <div className="step-copy-box">
                    <span>{project.inviteEmail || 'engineering@orbit.local'}</span>
                    <button type="button" className="step-copy-btn" onClick={copyEmail}>
                      {copiedEmail ? <Check size={12}/> : <Copy size={12}/>}
                      {copiedEmail ? text.copied : text.copyEmail}
                    </button>
                  </div>
                </div>
              </div>

              <div className="client-step-row">
                <div className="step-number">3</div>
                <div className="step-content">
                  <h4>{text.linkReference}</h4>
                  <p>{text.referenceDetail}</p>

                  <form className="client-infra-form" onSubmit={saveInfra}>
                    <input
                      type="text"
                      value={supabaseRef}
                      onChange={e => setSupabaseRef(e.target.value)}
                      placeholder={text.referencePlaceholder}
                    />
                    <label className="client-checkbox-label">
                      <input
                        type="checkbox"
                        checked={invited}
                        onChange={e => setInvited(e.target.checked)}
                      />
                      {text.invitationSent}
                    </label>
                    <button type="submit" className="client-infra-save-btn" disabled={saving}>
                      {saving ? text.saving : text.saveInfrastructure} <Check size={13}/>
                    </button>
                    {savedNotice && (
                      <div className="infra-success-notice">
                        <Check size={14}/> {text.saved}
                      </div>
                    )}
                  </form>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      <footer className="client-portal-footer"><span>{text.readOnly}</span><span>{formatLastUpdated(project.lastUpdatedAt || project.sharedAt)}</span></footer>
    </section>
  </main>;
}

function OrbitRoot() {
  const requestedLanguage = new URLSearchParams(window.location.search).get('lang');
  const savedLanguage = localStorage.getItem('orbit-language');
  const clientLanguage = requestedLanguage === 'es' || requestedLanguage === 'en' ? requestedLanguage : savedLanguage;
  if (clientLanguage === 'es' || clientLanguage === 'en') document.documentElement.lang = clientLanguage;
  const portalMatch = window.location.pathname.match(/^\/share\/([^/]+)\/?$/);
  if (portalMatch) {
    const token = new URLSearchParams(window.location.search).get('token') || '';
    return <ClientPortal projectId={decodeURIComponent(portalMatch[1])} token={token}/>;
  }
  return <App/>;
}

createRoot(document.getElementById('root')).render(<OrbitRoot/>);

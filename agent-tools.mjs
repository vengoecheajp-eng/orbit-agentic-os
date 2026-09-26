import { lstatSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { editableSourcePath, applyWorkspacePatch } from './workspace-patch.mjs';
import { readRepositoryFile } from './repository-file.mjs';

const MAX_ACTION_BYTES = 1_000_000;
const MAX_RESULT_CHARS = 12_000;
const MAX_SEARCH_MATCHES = 80;
const MAX_LIST_FILES = 200;
const MAX_READ_LINES = 800;

const toolDefinitions = [
  { action: 'list_files', description: 'List safe, tracked project files. Optional path is a safe relative directory.' },
  { action: 'search_files', description: 'Find a literal string in safe project files. No regular expressions or shell commands.' },
  { action: 'read_file', description: 'Read a bounded line range from a safe project file.' },
  { action: 'apply_patch', description: 'Apply one complete unified diff to safe source files.' },
  { action: 'request_verification', description: 'Ask Orbit to run its configured verification pipeline.' },
  { action: 'request_input', description: 'Ask the operator one essential, irreversible, or security question.' },
  { action: 'finish', description: 'Finish with a concise factual outcome and limitations.' }
];

export function agentToolProtocol() {
  return `Use one JSON action per response and no markdown. Available actions:\n${toolDefinitions.map(tool => `- ${tool.action}: ${tool.description}`).join('\n')}\nExamples: {"action":"search_files","query":"createRoot","path":"src"}; {"action":"read_file","path":"src/main.jsx","startLine":1,"endLine":160}; {"action":"apply_patch","patch":"diff --git ..."}; {"action":"finish","summary":"...","limitations":[]}. Orbit validates every action. You cannot run shell commands, read secrets, install dependencies, change permissions, modify .git, or grant yourself access.`;
}

function plainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function boundedString(value, field, max = 12_000, required = true) {
  if (typeof value !== 'string' || (required && !value.trim()) || value.length > max || /[\x00-\x1f]/.test(value.replace(/\n|\r|\t/g, ''))) {
    throw new Error(`Invalid ${field}.`);
  }
  return value.trim();
}

function optionalSafePath(value, field = 'path') {
  if (value === undefined || value === '') return '';
  const path = boundedString(value, field, 1_024);
  if (!editableSourcePath(path) || path.split('/').some(part => part === '.')) throw new Error(`Protected or invalid ${field}.`);
  return path.replace(/\/$/, '');
}

function exactKeys(action, allowed) {
  if (Object.keys(action).some(key => !allowed.includes(key))) throw new Error('Action has unsupported fields.');
}

export function parseAgentAction(text) {
  if (typeof text !== 'string' || Buffer.byteLength(text) > MAX_ACTION_BYTES) throw new Error('Model response is missing or too large.');
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] || text).trim();
  let action;
  try { action = JSON.parse(candidate); } catch { throw new Error('Return one valid JSON action, without prose or markdown.'); }
  return validateAgentAction(action);
}

export function validateAgentAction(action) {
  if (!plainObject(action)) throw new Error('Action must be a JSON object.');
  const name = boundedString(action.action, 'action', 64);
  switch (name) {
    case 'list_files':
      exactKeys(action, ['action', 'path', 'cursor', 'limit']);
      return { action: name, path: optionalSafePath(action.path), cursor: Number.isInteger(action.cursor) && action.cursor >= 0 ? action.cursor : 0, limit: Number.isInteger(action.limit) && action.limit > 0 && action.limit <= MAX_LIST_FILES ? action.limit : 80 };
    case 'search_files':
      exactKeys(action, ['action', 'query', 'path', 'limit']);
      return { action: name, query: boundedString(action.query, 'query', 512), path: optionalSafePath(action.path), limit: Number.isInteger(action.limit) && action.limit > 0 && action.limit <= MAX_SEARCH_MATCHES ? action.limit : 40 };
    case 'read_file': {
      exactKeys(action, ['action', 'path', 'startLine', 'endLine']);
      const startLine = Number.isInteger(action.startLine) && action.startLine > 0 ? action.startLine : 1;
      const endLine = Number.isInteger(action.endLine) && action.endLine >= startLine && action.endLine - startLine < MAX_READ_LINES ? action.endLine : startLine + 199;
      return { action: name, path: optionalSafePath(action.path), startLine, endLine };
    }
    case 'apply_patch':
      exactKeys(action, ['action', 'patch']);
      if (typeof action.patch !== 'string' || !action.patch.trim() || Buffer.byteLength(action.patch) > MAX_ACTION_BYTES) throw new Error('Invalid patch.');
      // Preserve the final newline: git apply uses it when validating hunks.
      return { action: name, patch: action.patch };
    case 'request_verification':
      exactKeys(action, ['action']); return { action: name };
    case 'request_input':
      exactKeys(action, ['action', 'question', 'reason']);
      return { action: name, question: boundedString(action.question, 'question', 1_500), reason: boundedString(action.reason, 'reason', 1_500) };
    case 'finish':
      exactKeys(action, ['action', 'summary', 'limitations']);
      if (action.limitations !== undefined && (!Array.isArray(action.limitations) || action.limitations.length > 12 || action.limitations.some(item => typeof item !== 'string' || item.length > 500))) throw new Error('Invalid limitations.');
      return { action: name, summary: boundedString(action.summary, 'summary', 4_000), limitations: action.limitations || [] };
    default:
      throw new Error('Unsupported action.');
  }
}

function safeProjectFiles(directory) {
  const listed = spawnSync('git', ['-C', directory, 'ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' });
  if (listed.status !== 0) throw new Error('Orbit could not list this worktree.');
  return [...new Set(listed.stdout.split('\n').filter(Boolean))].filter(editableSourcePath).filter(file => {
    try {
      const fullPath = resolve(directory, file);
      if (!fullPath.startsWith(`${resolve(directory)}/`)) return false;
      return lstatSync(fullPath).isFile();
    } catch { return false; }
  }).sort();
}

function underPrefix(file, prefix) {
  return !prefix || file === prefix || file.startsWith(`${prefix}/`);
}

function clip(text) {
  return text.length <= MAX_RESULT_CHARS ? text : `${text.slice(0, MAX_RESULT_CHARS)}\n[Orbit truncated this safe tool result.]`;
}

function safeFile(directory, relativePath) {
  if (!editableSourcePath(relativePath)) throw new Error('Protected or invalid file path.');
  const root = realpathSync(directory);
  const fullPath = resolve(root, relativePath);
  if (!fullPath.startsWith(`${root}/`)) throw new Error('Outside worktree.');
  return fullPath;
}

export function executeAgentTool(action, { directory, allowWrite = true, verify } = {}) {
  if (!directory) throw new Error('Missing worktree.');
  const files = safeProjectFiles(directory);
  if (action.action === 'list_files') {
    const matching = files.filter(file => underPrefix(file, action.path));
    const page = matching.slice(action.cursor, action.cursor + action.limit);
    return { files: page, nextCursor: action.cursor + page.length < matching.length ? action.cursor + page.length : null, total: matching.length };
  }
  if (action.action === 'search_files') {
    const matches = [];
    for (const file of files) {
      if (!underPrefix(file, action.path)) continue;
      try {
        const { content } = readRepositoryFile(directory, safeFile(directory, file), MAX_RESULT_CHARS);
        const lines = content.split('\n');
        for (let index = 0; index < lines.length; index++) {
          if (!lines[index].includes(action.query)) continue;
          matches.push({ path: file, line: index + 1, text: clip(lines[index]) });
          if (matches.length >= action.limit) return { matches, truncated: true };
        }
      } catch { /* A changing/unreadable file remains invisible to the model. */ }
    }
    return { matches, truncated: false };
  }
  if (action.action === 'read_file') {
    if (!files.includes(action.path)) throw new Error('File is unavailable or protected.');
    const result = readRepositoryFile(directory, safeFile(directory, action.path), MAX_RESULT_CHARS * 2);
    const lines = result.content.split('\n');
    return { path: action.path, startLine: action.startLine, endLine: Math.min(action.endLine, lines.length), content: clip(lines.slice(action.startLine - 1, action.endLine).join('\n')), partial: result.partial || action.endLine < lines.length };
  }
  if (action.action === 'apply_patch') {
    if (!allowWrite) throw new Error('This run is planning-only. Orbit will not apply patches.');
    return { changedFiles: applyWorkspacePatch(directory, action.patch) };
  }
  if (action.action === 'request_verification') {
    if (typeof verify !== 'function') throw new Error('Verification is unavailable for this run.');
    return verify();
  }
  if (action.action === 'request_input') return { waitingForInput: true, question: action.question, reason: action.reason };
  if (action.action === 'finish') return { finished: true, summary: action.summary, limitations: action.limitations };
  throw new Error('Unsupported action.');
}

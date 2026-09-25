import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [nodeMajor, nodeMinor] = process.versions.node.split('.').map(Number);
const supportedNode = (nodeMajor === 20 && nodeMinor >= 19) || (nodeMajor === 22 && nodeMinor >= 12) || nodeMajor > 22;
const supportedNodeRange = '^20.19.0 || >=22.12.0';
const executableLookup = process.platform === 'win32' ? 'where' : 'which';

function hasCommand(command) {
  return spawnSync(executableLookup, [command], { stdio: 'ignore' }).status === 0;
}

function line(label, status, detail) {
  console.log(`${status ? '✓' : '○'} ${label}${detail ? ` — ${detail}` : ''}`);
}

console.log('Orbit environment check\n');
line(`Node.js ${process.versions.node}`, supportedNode, supportedNode ? 'supported' : `Node ${supportedNodeRange} is required`);
line('Git', hasCommand('git'), hasCommand('git') ? 'available' : 'required to connect repositories');
line('Safe example project', existsSync(join(root, 'data', 'projects.example.json')), 'used for new profiles');
line('Local environment file', existsSync(join(root, '.env')), existsSync(join(root, '.env')) ? 'detected; values are never read by this check' : 'optional; copy .env.example when needed');

console.log('\nOptional agent integrations');
line('Codex CLI', hasCommand('codex'), hasCommand('codex') ? 'detected' : 'install or configure it when needed');
line('Claude CLI', hasCommand('claude'), hasCommand('claude') ? 'detected' : 'install or configure it when needed');
line('Ollama', hasCommand('ollama'), hasCommand('ollama') ? 'detected' : 'install it for local models');
line('GitHub CLI', hasCommand('gh'), hasCommand('gh') ? 'detected' : 'optional for private GitHub review');

if (!supportedNode || !hasCommand('git') || !existsSync(join(root, 'data', 'projects.example.json'))) {
  console.error('\nOrbit needs the required checks above before it can run safely.');
  process.exit(1);
}

console.log('\nOrbit is ready for local setup.');

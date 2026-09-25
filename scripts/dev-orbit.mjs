import { spawn } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const processes = [
  spawn(npm, ['run', 'server'], { stdio: 'inherit' }),
  spawn(npm, ['run', 'dev'], { stdio: 'inherit' })
];

let shuttingDown = false;
function shutDown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of processes) {
    if (!child.killed) child.kill('SIGTERM');
  }
  process.exit(exitCode);
}

for (const child of processes) {
  child.on('error', error => {
    console.error(`Unable to start Orbit: ${error.message}`);
    shutDown(1);
  });
  child.on('exit', code => {
    if (!shuttingDown && code !== 0) {
      console.error(`An Orbit development process exited with code ${code}.`);
      shutDown(code || 1);
    }
  });
}

process.on('SIGINT', () => shutDown());
process.on('SIGTERM', () => shutDown());

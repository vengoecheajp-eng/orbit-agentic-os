import { spawnSync } from 'node:child_process';

export function editableSourcePath(file) {
  return typeof file === 'string' && !file.startsWith('/') && !file.includes('\\') && !/[\x00-\x1f]/.test(file)
    && !file.split('/').some(part => part === '..' || part === '.git' || part === 'node_modules')
    && !/(^|\/)(\.env(?:\..*)?|\.npmrc|\.netrc|.*credentials.*|.*secret.*|.*token.*|id_rsa|id_ed25519)$/i.test(file)
    && !/\.(pem|key|p12)$/i.test(file);
}

// git apply validates traversal and symlink targets. --numstat validates every
// patch path before applying anything; no shell or model-provided flags run.
export function applyWorkspacePatch(directory, patch) {
  if (typeof patch !== 'string' || !patch.trim() || Buffer.byteLength(patch) > 1000000) throw new Error('Missing or oversized patch');
  const stat = spawnSync('git', ['-C', directory, 'apply', '--numstat', '-z', '-'], { input: patch, encoding: 'utf8' });
  if (stat.status !== 0) throw new Error('Invalid unified diff. Return complete file headers and correctly counted hunks.');
  const files = stat.stdout.split('\0').filter(Boolean).map(line => line.split('\t').slice(2).join('\t'));
  if (!files.length || files.some(file => !editableSourcePath(file)) || /(?:old|new|deleted file|new file) mode 120000|GIT binary patch/.test(patch)) throw new Error('Patch targets an unsupported or protected file.');
  const check = spawnSync('git', ['-C', directory, 'apply', '--check', '-'], { input: patch, encoding: 'utf8' });
  if (check.status !== 0) throw new Error('Patch does not match the current files. Use their exact contents and line counts.');
  const applied = spawnSync('git', ['-C', directory, 'apply', '-'], { input: patch, encoding: 'utf8' });
  if (applied.status !== 0) throw new Error('Git could not apply the patch.');
  return files;
}

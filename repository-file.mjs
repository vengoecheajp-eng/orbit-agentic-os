import { realpathSync, openSync, fstatSync, readSync, closeSync, constants } from 'node:fs';
import { relative, isAbsolute, sep } from 'node:path';

// Shared by the Security Center and its launch-advisory evidence readers.
// Never follow a file symlink, leave the repository, or load an entire large file.
export function readRepositoryFile(repoPath, file, maxBytes = 160_000) {
  const root = realpathSync(repoPath);
  const path = relative(root, realpathSync(file));
  if (path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path)) throw new Error('Outside repository');
  const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile()) throw new Error('Not a regular file');
    const buffer = Buffer.alloc(Math.min(stat.size, maxBytes));
    let bytes = 0;
    while (bytes < buffer.length) {
      const count = readSync(fd, buffer, bytes, buffer.length - bytes, bytes);
      if (!count) break;
      bytes += count;
    }
    return { content: buffer.subarray(0, bytes).toString('utf8'), partial: stat.size > bytes, size: stat.size, modifiedAt: stat.mtimeMs };
  } finally { closeSync(fd); }
}

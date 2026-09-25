import { chmodSync, cpSync, existsSync, lstatSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { basename, dirname, join, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'data');
const args = process.argv.slice(2);
const targetFlag = args.indexOf('--to');
const targetValue = targetFlag >= 0 ? args[targetFlag + 1] : '';

if (!targetValue || targetValue.startsWith('-')) {
  console.error('Usage: npm run personal:migrate-data -- --to /absolute/path/to/.orbit/personal');
  process.exit(1);
}

const target = resolve(targetValue);
if (target === source) {
  console.error('The personal data directory must be outside the Orbit source data/ directory.');
  process.exit(1);
}
if (!existsSync(source)) {
  console.error(`Source data directory was not found: ${source}`);
  process.exit(1);
}
if (existsSync(target) && readdirSync(target).length > 0) {
  console.error(`Target already contains files: ${target}\nRefusing to overwrite personal data.`);
  process.exit(1);
}

mkdirSync(target, { recursive: true, mode: 0o700 });
cpSync(source, target, { recursive: true, force: false, errorOnExist: true });

function lockDown(path) {
  const entry = lstatSync(path);
  chmodSync(path, entry.isDirectory() ? 0o700 : 0o600);
  if (entry.isDirectory()) for (const name of readdirSync(path)) lockDown(join(path, name));
}

lockDown(target);
console.log(`Created a private copy of Orbit data at ${target}.`);
console.log('Your existing data/ folder was left unchanged.');
console.log(`Add this to your private .env, then restart Orbit:\nORBIT_DATA_DIR=${target}`);
console.log(`Copied from: ${basename(source)}/`);

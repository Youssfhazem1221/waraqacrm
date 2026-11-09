// Copies the data Worker's pure, shared modules into the CRM before dev and
// build. They stay authored in ../data/src; the copies in src/shared are
// git-ignored. Importing ../data directly made Next trace from the repo root,
// which OpenNext (rooted at this folder's lockfile) could not package.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const from = join(here, '..', '..', 'data', 'src');
const to = join(here, '..', 'src', 'shared');
mkdirSync(to, { recursive: true });
for (const file of ['types.ts', 'rules.ts']) {
  const src = readFileSync(join(from, file), 'utf8');
  writeFileSync(join(to, file), `// GENERATED from data/src/${file} by scripts/sync-shared.mjs. Edit the original.\n${src}`);
}
console.log('[sync-shared] copied types.ts, rules.ts from data/src');

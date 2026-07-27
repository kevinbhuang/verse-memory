#!/usr/bin/env node
/**
 * Removes JavaScript that `tsc` emitted next to the TypeScript sources.
 *
 * The project never ships hand-written JavaScript under `src/`, so a `.js`
 * file is only deleted when a `.ts` or `.tsx` file of the same name sits
 * beside it. Anything else is left alone and reported.
 */

import { readdir, rm, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');

const exists = async (file) =>
  stat(file).then(
    () => true,
    () => false,
  );

async function walk(dir) {
  const removed = [];
  const kept = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await walk(full);
      removed.push(...nested.removed);
      kept.push(...nested.kept);
      continue;
    }
    if (!entry.name.endsWith('.js')) continue;

    const base = full.slice(0, -'.js'.length);
    if ((await exists(`${base}.ts`)) || (await exists(`${base}.tsx`))) {
      await rm(full);
      removed.push(path.relative(ROOT, full));
    } else {
      kept.push(path.relative(ROOT, full));
    }
  }
  return { removed, kept };
}

const { removed, kept } = await walk(SRC);
console.log(`Removed ${removed.length} emitted file(s) from src/.`);
for (const file of kept) {
  console.log(`  kept (no TypeScript sibling): ${file}`);
}

#!/usr/bin/env node
/**
 * Optional developer-only check of `src/data/verses.json` against the ESV API.
 *
 * This never runs in the browser and the token is never exposed to client
 * code: it is read from ESV_API_TOKEN in the environment (or a local `.env`),
 * which is git-ignored.
 *
 * The script reports differences for manual approval. Scripture text is only
 * rewritten when you pass --approve, and even then only for passages you have
 * selected with --only.
 *
 *   node scripts/verify-esv.mjs                      check every unverified passage
 *   node scripts/verify-esv.mjs --all                check all 171 passages
 *   node scripts/verify-esv.mjs --only verse-004     check one passage
 *   node scripts/verify-esv.mjs --only verse-004 --approve
 *                                                   adopt the API text for it
 *   node scripts/verify-esv.mjs --limit 20           stop after 20 passages
 */

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_PATH = path.join(ROOT, 'src', 'data', 'verses.json');
const ENDPOINT = 'https://api.esv.org/v3/passage/text/';

/** Roughly the published rate limit; kept conservative on purpose. */
const REQUEST_SPACING_MS = 1100;

const contentHash = (text) =>
  createHash('sha256').update(text.normalize('NFC'), 'utf8').digest('hex');

/** Grading-style normalisation, used only to decide whether texts differ. */
const comparable = (text) =>
  text
    .normalize('NFC')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

async function loadDotEnv() {
  if (process.env.ESV_API_TOKEN) return;
  try {
    const raw = await readFile(path.join(ROOT, '.env'), 'utf8');
    for (const line of raw.split('\n')) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (!match) continue;
      const [, key, value] = match;
      if (!(key in process.env)) {
        process.env[key] = value.replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    // No .env file; the token may still be exported in the shell.
  }
}

function parseArgs(argv) {
  const args = { all: false, approve: false, only: [], limit: Infinity };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--all') args.all = true;
    else if (arg === '--approve') args.approve = true;
    else if (arg === '--only') args.only.push(argv[(i += 1)]);
    else if (arg === '--limit') args.limit = Number(argv[(i += 1)]);
    else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }
  return args;
}

async function fetchPassage(reference, token) {
  const url = new URL(ENDPOINT);
  url.searchParams.set('q', reference);
  url.searchParams.set('include-headings', 'false');
  url.searchParams.set('include-footnotes', 'false');
  url.searchParams.set('include-verse-numbers', 'false');
  url.searchParams.set('include-short-copyright', 'false');
  url.searchParams.set('include-passage-references', 'false');

  const response = await fetch(url, {
    headers: { Authorization: `Token ${token}` },
  });

  if (!response.ok) {
    throw new Error(
      `ESV API returned ${response.status} ${response.statusText} for "${reference}".`,
    );
  }

  const body = await response.json();
  const passages = body.passages ?? [];
  if (passages.length === 0) {
    throw new Error(`ESV API returned no passage for "${reference}".`);
  }
  return passages.join(' ').replace(/\s+/g, ' ').trim();
}

/** A compact word-level diff, enough to eyeball a wording change. */
function describeDifference(canonical, fetched) {
  const left = comparable(canonical).split(' ');
  const right = comparable(fetched).split(' ');
  const notes = [];
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length && notes.length < 8; i += 1) {
    if (left[i] !== right[i]) {
      notes.push(
        `word ${i + 1}: local "${left[i] ?? '(none)'}" vs API "${right[i] ?? '(none)'}"`,
      );
    }
  }
  if (left.length !== right.length) {
    notes.push(`length: local ${left.length} words, API ${right.length} words`);
  }
  return notes;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await loadDotEnv();

  const token = process.env.ESV_API_TOKEN;
  if (!token) {
    console.error(
      'ESV_API_TOKEN is not set. Copy .env.example to .env and add your token,\n' +
        'or export it for this shell. The app does not need it to run reviews.',
    );
    process.exit(1);
  }

  const verses = JSON.parse(await readFile(DATA_PATH, 'utf8'));

  let queue = verses;
  if (args.only.length > 0) {
    queue = verses.filter(
      (verse) => args.only.includes(verse.id) || args.only.includes(verse.reference),
    );
    if (queue.length === 0) {
      console.error(`No passage matched: ${args.only.join(', ')}`);
      process.exit(1);
    }
  } else if (!args.all) {
    queue = verses.filter((verse) => !verse.verified);
  }
  queue = queue.slice(0, args.limit);

  if (queue.length === 0) {
    console.log('Nothing to check. Every requested passage is already verified.');
    return;
  }

  console.log(
    `Checking ${queue.length} passage(s) against the ESV API.` +
      (args.approve ? ' Differences WILL be written.' : ' Read-only.'),
  );

  const matched = [];
  const differing = [];
  const failed = [];
  const today = new Date().toISOString().slice(0, 10);

  for (const [index, verse] of queue.entries()) {
    if (index > 0) {
      await new Promise((resolve) => setTimeout(resolve, REQUEST_SPACING_MS));
    }

    let fetched;
    try {
      fetched = await fetchPassage(verse.reference, token);
    } catch (error) {
      failed.push({ verse, message: error.message });
      console.log(`  ✗ ${verse.id}  ${verse.reference}  ${error.message}`);
      continue;
    }

    if (comparable(verse.text) === comparable(fetched)) {
      matched.push(verse);
      verse.verified = true;
      verse.verificationDate = today;
      console.log(`  ✓ ${verse.id}  ${verse.reference}`);
      continue;
    }

    differing.push({ verse, fetched });
    console.log(`  ! ${verse.id}  ${verse.reference} differs from the API`);
    for (const note of describeDifference(verse.text, fetched)) {
      console.log(`      ${note}`);
    }

    if (args.approve) {
      verse.text = fetched;
      verse.contentHash = contentHash(fetched);
      verse.verified = true;
      verse.verificationDate = today;
      console.log('      adopted the API text (--approve)');
    }
  }

  const changed = matched.length > 0 || (args.approve && differing.length > 0);
  if (changed) {
    await writeFile(DATA_PATH, `${JSON.stringify(verses, null, 2)}\n`, 'utf8');
  }

  console.log('\nSummary');
  console.log('-------');
  console.log(`  matched   ${matched.length}`);
  console.log(`  differing ${differing.length}`);
  console.log(`  failed    ${failed.length}`);

  if (differing.length > 0 && !args.approve) {
    console.log(
      '\nNo Scripture text was changed. Review the differences above, then re-run\n' +
        'with "--only <verse-id> --approve" for each passage you want to adopt.',
    );
    process.exit(2);
  }

  if (changed) {
    console.log(
      '\nverses.json updated. Run "npm run validate:verses" to confirm integrity.',
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

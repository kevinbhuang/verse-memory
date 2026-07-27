#!/usr/bin/env node
/**
 * Validates the canonical passage file, `src/data/verses.json`.
 *
 * The build depends on this script, so it exits non-zero on any structural
 * problem. It never edits Scripture text; the only thing it can write is the
 * `contentHash` field, and only when explicitly asked with `--write-hashes`.
 *
 *   node scripts/validate-verses.mjs                  validate
 *   node scripts/validate-verses.mjs --write-hashes   regenerate content hashes
 *   node scripts/validate-verses.mjs --report         print a per-passage report
 */

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_PATH = path.join(ROOT, 'src', 'data', 'verses.json');

const EXPECTED_COUNT = 171;
const TRANSLATION = 'ESV';

/** Section boundaries are part of the collection's definition, not a guess. */
const SECTION_RANGES = [
  { section: 'Law and History', start: 1, end: 7 },
  { section: 'Wisdom and Poetry', start: 8, end: 19 },
  { section: 'Prophets', start: 20, end: 37 },
  { section: 'Gospels', start: 38, end: 68 },
  { section: 'Acts', start: 69, end: 72 },
  { section: 'Paul\u2019s Epistles', start: 73, end: 144 },
  { section: 'General Epistles and Revelation', start: 145, end: 171 },
];

const contentHash = (text) =>
  createHash('sha256').update(text.normalize('NFC'), 'utf8').digest('hex');

const sectionForOrder = (order) =>
  SECTION_RANGES.find((range) => order >= range.start && order <= range.end)
    ?.section ?? null;

const verseId = (order) => `verse-${String(order).padStart(3, '0')}`;

async function main() {
  const args = new Set(process.argv.slice(2));
  const writeHashes = args.has('--write-hashes');
  const report = args.has('--report');

  const raw = await readFile(DATA_PATH, 'utf8');
  let verses;
  try {
    verses = JSON.parse(raw);
  } catch (error) {
    fail([`src/data/verses.json is not valid JSON: ${error.message}`]);
  }

  const errors = [];
  const warnings = [];
  const hashMismatches = [];

  if (!Array.isArray(verses)) {
    fail(['src/data/verses.json must contain a JSON array of passages.']);
  }

  if (verses.length !== EXPECTED_COUNT) {
    errors.push(
      `Expected exactly ${EXPECTED_COUNT} passages, found ${verses.length}.`,
    );
  }

  const seenIds = new Set();
  const seenOrders = new Set();

  verses.forEach((verse, index) => {
    const label = verse?.id ?? `index ${index}`;

    for (const field of ['id', 'reference', 'text', 'section', 'translation']) {
      if (typeof verse?.[field] !== 'string' || verse[field].trim() === '') {
        errors.push(`${label}: missing or empty "${field}".`);
      }
    }

    if (typeof verse?.order !== 'number' || !Number.isInteger(verse.order)) {
      errors.push(`${label}: "order" must be an integer.`);
      return;
    }

    if (verse.order !== index + 1) {
      errors.push(
        `${label}: order ${verse.order} is out of sequence, expected ${index + 1}. Passages must stay in canonical order.`,
      );
    }

    if (seenOrders.has(verse.order)) {
      errors.push(`${label}: duplicate order ${verse.order}.`);
    }
    seenOrders.add(verse.order);

    if (seenIds.has(verse.id)) {
      errors.push(`${label}: duplicate id.`);
    }
    seenIds.add(verse.id);

    if (verse.id !== verseId(verse.order)) {
      errors.push(
        `${label}: id should be "${verseId(verse.order)}" for order ${verse.order}.`,
      );
    }

    if (verse.translation !== TRANSLATION) {
      errors.push(
        `${label}: translation must be "${TRANSLATION}", found "${verse.translation}".`,
      );
    }

    const expectedSection = sectionForOrder(verse.order);
    if (verse.section !== expectedSection) {
      errors.push(
        `${label}: section "${verse.section}" does not match the collection boundary for passage ${verse.order} ("${expectedSection}").`,
      );
    }

    if (typeof verse.verified !== 'boolean') {
      errors.push(`${label}: "verified" must be a boolean.`);
    }

    if (
      verse.verificationDate !== null &&
      typeof verse.verificationDate !== 'string'
    ) {
      errors.push(`${label}: "verificationDate" must be a string or null.`);
    }

    if (verse.verified === false) {
      warnings.push(`${label} (${verse.reference}) is not ESV-verified.`);
    }

    const expectedHash = contentHash(verse.text ?? '');
    if (verse.contentHash !== expectedHash) {
      hashMismatches.push({
        id: verse.id,
        reference: verse.reference,
        stored: verse.contentHash ?? '(missing)',
        computed: expectedHash,
      });
    }
  });

  // Consecutive orders 1..171.
  for (let order = 1; order <= EXPECTED_COUNT; order += 1) {
    if (!seenOrders.has(order)) {
      errors.push(`Missing passage with order ${order}.`);
    }
  }

  if (writeHashes && hashMismatches.length > 0) {
    for (const verse of verses) {
      verse.contentHash = contentHash(verse.text);
    }
    await writeFile(DATA_PATH, `${JSON.stringify(verses, null, 2)}\n`, 'utf8');
    console.log(
      `Rewrote ${hashMismatches.length} content hash(es). Scripture text was not modified.`,
    );
    hashMismatches.length = 0;
  }

  if (hashMismatches.length > 0) {
    errors.push(
      `${hashMismatches.length} passage(s) have a content hash that does not match their text. ` +
        `If the text change was intentional, run "npm run hash:verses" to re-baseline.`,
    );
  }

  if (report || hashMismatches.length > 0) {
    console.log('\nScripture text integrity report');
    console.log('-------------------------------');
    if (hashMismatches.length === 0) {
      console.log('All passage hashes match their text.');
    } else {
      for (const mismatch of hashMismatches.slice(0, 25)) {
        console.log(
          `  ${mismatch.id}  ${mismatch.reference}\n    stored   ${mismatch.stored}\n    computed ${mismatch.computed}`,
        );
      }
      if (hashMismatches.length > 25) {
        console.log(`  ...and ${hashMismatches.length - 25} more.`);
      }
    }
  }

  if (report) {
    console.log('\nSection counts');
    console.log('--------------');
    for (const range of SECTION_RANGES) {
      const count = verses.filter((v) => v.section === range.section).length;
      console.log(
        `  ${range.section.padEnd(34)} ${String(count).padStart(3)}  (passages ${range.start}-${range.end})`,
      );
    }
    const verified = verses.filter((v) => v.verified).length;
    console.log(`\nESV-verified passages: ${verified} of ${verses.length}`);
  }

  if (errors.length > 0) {
    fail(errors);
  }

  const unverified = warnings.length;
  console.log(
    `verses.json OK: ${verses.length} passages, ids ${verseId(1)}-${verseId(EXPECTED_COUNT)}, 7 sections, hashes match.`,
  );
  if (unverified > 0) {
    console.log(
      `Note: ${unverified} passage(s) are flagged unverified. Run "npm run verify:esv" with an ESV_API_TOKEN to check them against the ESV API.`,
    );
  }
}

function fail(messages) {
  console.error('\nverses.json validation failed:\n');
  for (const message of messages.slice(0, 50)) {
    console.error(`  - ${message}`);
  }
  if (messages.length > 50) {
    console.error(`  ...and ${messages.length - 50} more problems.`);
  }
  console.error('');
  process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

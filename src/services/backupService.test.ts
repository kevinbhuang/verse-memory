import { describe, expect, it } from 'vitest';
import { getDataStore } from '@/repositories';
import { SCHEMA_VERSION } from '@/db/db';
import { DEFAULT_SETTINGS } from '@/db/defaults';
import { verses } from '@/data/verses';
import {
  applyImport,
  buildBackup,
  buildProgressSummary,
  exportProgressCsv,
  exportReviewHistoryCsv,
  parseBackup,
  previewImport,
  resetAllProgress,
  serializeBackup,
} from './backupService';
import { getProgress, saveNote, setDifficult, setMemorized } from './progressService';
import { recordReview } from './reviewService';
import { createSession } from './sessionService';
import type { ModeResult } from '@/types';

const NOW = new Date('2026-05-04T10:00:00.000Z');
const SETTINGS = { maximumIntervalDays: 365, difficultVerseIntervalDays: 7 };

const result = (overrides: Partial<ModeResult> = {}): ModeResult => ({
  mode: 'first-letter',
  accuracy: 0.92,
  elapsedMs: 18_000,
  incorrectCount: 1,
  hintCount: 1,
  fullRevealUsed: false,
  wordErrors: [
    { wordIndex: 1, expected: 'God', received: 'god', errorType: 'incorrect' },
  ],
  suggestedRating: 'good',
  ...overrides,
});

/** Builds a small but representative amount of user data. */
async function seed() {
  await setMemorized('verse-001', true, NOW);
  await setDifficult('verse-002', true, NOW);
  await saveNote('verse-003', 'The hinge of the whole argument.', NOW);
  await recordReview({
    verseId: 'verse-001',
    rating: 'good',
    result: result(),
    settings: SETTINGS,
    now: NOW,
  });
  await recordReview({
    verseId: 'verse-002',
    rating: 'again',
    result: result({ accuracy: 0.4 }),
    settings: SETTINGS,
    now: NOW,
  });
  await createSession(
    { source: 'difficult', size: 'all', modeStrategy: 'fixed', fixedMode: 'flashcard' },
    'Difficult passages',
    NOW,
  );
  await getDataStore().settings.save({
    ...DEFAULT_SETTINGS,
    defaultReviewMode: 'flashcard',
    dailyNewVerseLimit: 5,
  });
}

describe('buildBackup', () => {
  it('captures every kind of user data', async () => {
    await seed();
    const backup = await buildBackup(NOW);

    expect(backup.schemaVersion).toBe(SCHEMA_VERSION);
    expect(backup.exportedAt).toBe(NOW.toISOString());
    expect(backup.progress.length).toBeGreaterThan(0);
    expect(backup.reviewLogs).toHaveLength(2);
    expect(backup.sessions).toHaveLength(1);
    expect(backup.wordStats.length).toBeGreaterThan(0);
    expect(backup.settings?.defaultReviewMode).toBe('flashcard');
  });

  it('carries passage fingerprints but never the Scripture text', async () => {
    const backup = await buildBackup(NOW);
    const serialized = serializeBackup(backup);

    expect(backup.verseFingerprints).toHaveLength(verses.length);
    expect(backup.verseFingerprints[0]).toEqual({
      id: verses[0].id,
      reference: verses[0].reference,
      contentHash: verses[0].contentHash,
    });
    expect(serialized).not.toContain(verses[0].text);
  });
});

describe('export and import round trip', () => {
  it('restores progress, history, sessions and settings exactly', async () => {
    await seed();

    const before = {
      progress: await getDataStore().progress.all(),
      logs: await getDataStore().reviewLogs.all(),
      sessions: await getDataStore().sessions.all(),
      wordStats: await getDataStore().wordStats.all(),
      settings: await getDataStore().settings.get(),
    };
    const file = serializeBackup(await buildBackup(NOW));

    await resetAllProgress();
    expect(await getDataStore().progress.all()).toEqual([]);

    const parsed = parseBackup(file);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    await applyImport(parsed.backup, 'replace');

    expect(await getDataStore().progress.all()).toEqual(before.progress);
    expect(await getDataStore().reviewLogs.all()).toEqual(before.logs);
    expect(await getDataStore().sessions.all()).toEqual(before.sessions);
    expect(await getDataStore().wordStats.all()).toEqual(before.wordStats);
    expect(await getDataStore().settings.get()).toEqual(before.settings);
  });

  it('survives a second round trip unchanged', async () => {
    await seed();
    const first = serializeBackup(await buildBackup(NOW));

    await resetAllProgress();
    const parsed = parseBackup(first);
    if (!parsed.ok) throw new Error('expected a valid backup');
    await applyImport(parsed.backup, 'replace');

    const second = serializeBackup(await buildBackup(NOW));
    expect(second).toBe(first);
  });
});

describe('import modes', () => {
  it('merge keeps records the backup does not mention', async () => {
    await setMemorized('verse-001', true, NOW);
    const file = serializeBackup(await buildBackup(NOW));

    await setMemorized('verse-050', true, NOW);

    const parsed = parseBackup(file);
    if (!parsed.ok) throw new Error('expected a valid backup');
    await applyImport(parsed.backup, 'merge');

    expect((await getProgress('verse-001')).isMemorized).toBe(true);
    expect((await getProgress('verse-050')).isMemorized).toBe(true);
  });

  it('replace clears data the backup does not mention', async () => {
    await setMemorized('verse-001', true, NOW);
    const file = serializeBackup(await buildBackup(NOW));

    await setMemorized('verse-050', true, NOW);

    const parsed = parseBackup(file);
    if (!parsed.ok) throw new Error('expected a valid backup');
    await applyImport(parsed.backup, 'replace');

    expect((await getProgress('verse-001')).isMemorized).toBe(true);
    expect((await getProgress('verse-050')).isMemorized).toBe(false);
  });
});

describe('parseBackup', () => {
  it('rejects a file that is not JSON', () => {
    const parsed = parseBackup('not json at all');
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.errors[0]).toMatch(/not valid JSON/);
  });

  it('rejects a JSON file that is not a backup', () => {
    const parsed = parseBackup('{"hello":"world"}');
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.errors.length).toBeGreaterThan(0);
  });

  it('rejects records with an unknown rating', () => {
    const parsed = parseBackup(
      JSON.stringify({
        schemaVersion: SCHEMA_VERSION,
        exportedAt: NOW.toISOString(),
        progress: [],
        reviewLogs: [
          {
            id: 'log-1',
            verseId: 'verse-001',
            reviewedAt: NOW.toISOString(),
            mode: 'flashcard',
            rating: 'brilliant',
            accuracy: 1,
            elapsedMs: 0,
            incorrectCount: 0,
            hintCount: 0,
            fullRevealUsed: false,
            previousIntervalDays: 0,
            nextIntervalDays: 1,
            nextDueAt: NOW.toISOString(),
          },
        ],
      }),
    );
    expect(parsed.ok).toBe(false);
  });

  it('accepts a minimal backup and fills in defaults', () => {
    const parsed = parseBackup(
      JSON.stringify({
        schemaVersion: SCHEMA_VERSION,
        exportedAt: NOW.toISOString(),
      }),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.backup.progress).toEqual([]);
    expect(parsed.backup.collection.verseCount).toBe(verses.length);
  });
});

describe('previewImport', () => {
  it('separates records that will be added from those that will be updated', async () => {
    await setMemorized('verse-001', true, NOW);
    await setMemorized('verse-002', true, NOW);
    const backup = await buildBackup(NOW);

    await resetAllProgress();
    await setMemorized('verse-001', false, NOW);

    const preview = await previewImport(backup);
    expect(preview.progressUpdated).toBe(1);
    expect(preview.progressAdded).toBe(1);
    expect(preview.willOverwrite).toBe(true);
  });

  it('rejects progress for passages this collection does not contain', async () => {
    const backup = await buildBackup(NOW);
    backup.progress = [
      {
        ...(await getProgress('verse-001')),
        verseId: 'verse-999',
      },
    ];

    const preview = await previewImport(backup);
    expect(preview.progressRejected).toBe(1);
    expect(preview.missingVerseIds).toEqual(['verse-999']);
  });

  it('reports content-hash mismatches so silent text drift is visible', async () => {
    const backup = await buildBackup(NOW);
    backup.verseFingerprints[3] = {
      ...backup.verseFingerprints[3],
      contentHash: 'stale-hash',
    };

    const preview = await previewImport(backup);
    expect(preview.contentHashMismatches).toEqual([
      { verseId: verses[3].id, reference: verses[3].reference },
    ]);
  });

  it('refuses a backup written by a newer version of the app', async () => {
    const backup = await buildBackup(NOW);
    backup.schemaVersion = SCHEMA_VERSION + 1;

    const preview = await previewImport(backup);
    expect(preview.versionCompatible).toBe(false);
    expect(preview.versionNote).toMatch(/newer than this app understands/);
  });

  it('notes that an older backup will be upgraded', async () => {
    const backup = await buildBackup(NOW);
    backup.schemaVersion = 1;

    const preview = await previewImport(backup);
    expect(preview.versionCompatible).toBe(true);
    expect(preview.versionNote).toMatch(/will be upgraded/);
  });

  it('does not duplicate review logs that are already stored', async () => {
    await seed();
    const backup = await buildBackup(NOW);

    const preview = await previewImport(backup);
    expect(preview.logsAdded).toBe(0);
    expect(preview.logsSkipped).toBe(2);
  });
});

describe('applyImport', () => {
  it('drops unknown passages instead of writing them', async () => {
    const backup = await buildBackup(NOW);
    backup.progress = [
      { ...(await getProgress('verse-001')), verseId: 'verse-999' },
      { ...(await getProgress('verse-002')), isMemorized: true },
    ];

    const outcome = await applyImport(backup, 'merge');
    expect(outcome).toMatchObject({ progressWritten: 1, rejected: 1 });
    expect(await getDataStore().progress.get('verse-999')).toBeUndefined();
  });
});

describe('CSV export', () => {
  it('writes one row per passage plus a header', async () => {
    await seed();
    const csv = await exportProgressCsv();
    const lines = csv.split('\n');

    expect(lines[0]).toMatch(/^passage_number,verse_id,reference,section,status/);
    expect(lines).toHaveLength(verses.length + 1);
    expect(lines[1]).toContain('verse-001');
  });

  it('quotes fields that contain commas', async () => {
    await saveNote('verse-004', 'Long, careful, comma-laden note.', NOW);
    const csv = await exportProgressCsv();
    expect(csv).toContain('"Long, careful, comma-laden note."');
  });

  it('writes review history oldest first', async () => {
    await seed();
    const csv = await exportReviewHistoryCsv();
    const lines = csv.split('\n');

    expect(lines[0]).toMatch(/^reviewed_at,verse_id,reference,mode,rating/);
    expect(lines).toHaveLength(3);
  });
});

describe('buildProgressSummary', () => {
  it('reads as a plain-language report', async () => {
    await seed();
    const summary = await buildProgressSummary(NOW);

    expect(summary).toContain('Memorized: 1 of 171');
    expect(summary).toContain('By section:');
    expect(summary).toContain('Law and History: 1/7');
  });
});

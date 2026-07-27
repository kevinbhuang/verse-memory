import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION, VerseMemoryDatabase } from './db';
import type { ReviewLog, VerseProgress } from '@/types';

/**
 * Opens a database at the original v1 schema so an upgrade can be exercised
 * exactly the way a returning reader's browser would run it.
 */
function openV1(name: string): Dexie {
  const database = new Dexie(name);
  database.version(1).stores({
    progress:
      'verseId, status, isMemorized, isDifficult, nextDueAt, lastReviewedAt',
    reviewLogs: 'id, verseId, reviewedAt, mode, rating',
    sessions: 'id, createdAt, completedAt',
    wordStats: 'key, verseId, wordIndex',
    settings: 'id',
    meta: 'key',
  });
  return database;
}

const uniqueName = () => `verse-memory-migration-${Math.random().toString(36).slice(2)}`;

describe('schema migrations', () => {
  it('carries version 1 records forward without losing anything', async () => {
    const name = uniqueName();
    const v1 = openV1(name);
    await v1.open();

    // A v1 progress row: no problemCategories, isPinned or totalElapsedMs.
    await v1.table('progress').put({
      verseId: 'verse-001',
      status: 'memorized',
      isMemorized: true,
      memorizedAt: '2025-01-01T00:00:00.000Z',
      isDifficult: true,
      difficultyScore: 42,
      note: 'Keep this note.',
      lastReviewedAt: '2025-02-01T00:00:00.000Z',
      nextDueAt: '2025-03-01T00:00:00.000Z',
      intervalDays: 30,
      intervalStep: 4,
      reviewCount: 9,
      successCount: 7,
      lapseCount: 2,
      consecutiveSuccesses: 3,
      lastRating: 'good',
      customMaximumIntervalDays: null,
      pinnedFrequencyDays: 30,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-02-01T00:00:00.000Z',
    });
    await v1.table('reviewLogs').put({
      id: 'log-1',
      verseId: 'verse-001',
      reviewedAt: '2025-02-01T00:00:00.000Z',
      mode: 'flashcard',
      rating: 'good',
      accuracy: null,
      elapsedMs: 8000,
      incorrectCount: 0,
      hintCount: 0,
      fullRevealUsed: false,
      previousIntervalDays: 14,
      nextIntervalDays: 30,
      nextDueAt: '2025-03-01T00:00:00.000Z',
    });
    v1.close();

    const upgraded = new VerseMemoryDatabase(name);
    await upgraded.open();

    expect(upgraded.verno).toBe(SCHEMA_VERSION);

    const progress = (await upgraded.progress.get('verse-001')) as VerseProgress;
    expect(progress).toMatchObject({
      note: 'Keep this note.',
      reviewCount: 9,
      lapseCount: 2,
      difficultyScore: 42,
      intervalDays: 30,
    });

    // Fields added in v2 are backfilled rather than left undefined.
    expect(progress.problemCategories).toEqual([]);
    expect(progress.difficultyReasons).toEqual([]);
    expect(progress.totalElapsedMs).toBe(0);
    expect(progress.isPinned).toBe(true);

    const log = (await upgraded.reviewLogs.get('log-1')) as ReviewLog;
    expect(log.sessionId).toBeNull();
    expect(log.wordErrors).toEqual([]);

    upgraded.close();
    await upgraded.delete();
  });

  it('leaves an unpinned passage unpinned after the upgrade', async () => {
    const name = uniqueName();
    const v1 = openV1(name);
    await v1.open();
    await v1.table('progress').put({
      verseId: 'verse-002',
      status: 'learning',
      isMemorized: false,
      memorizedAt: null,
      isDifficult: false,
      difficultyScore: 0,
      note: '',
      lastReviewedAt: null,
      nextDueAt: null,
      intervalDays: 0,
      intervalStep: -1,
      reviewCount: 0,
      successCount: 0,
      lapseCount: 0,
      consecutiveSuccesses: 0,
      lastRating: null,
      customMaximumIntervalDays: null,
      pinnedFrequencyDays: null,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    });
    v1.close();

    const upgraded = new VerseMemoryDatabase(name);
    await upgraded.open();
    const progress = (await upgraded.progress.get('verse-002')) as VerseProgress;
    expect(progress.isPinned).toBe(false);

    upgraded.close();
    await upgraded.delete();
  });

  it('opens cleanly for a first-time reader', async () => {
    const database = new VerseMemoryDatabase(uniqueName());
    await database.open();

    expect(database.verno).toBe(SCHEMA_VERSION);
    expect(await database.progress.count()).toBe(0);
    expect(await database.settings.count()).toBe(0);

    database.close();
    await database.delete();
  });

  it('indexes the fields the library filters query', async () => {
    const database = new VerseMemoryDatabase(uniqueName());
    await database.open();

    const indexed = database.progress.schema.indexes.map((index) => index.name);
    expect(indexed).toEqual(
      expect.arrayContaining([
        'status',
        'isMemorized',
        'isDifficult',
        'nextDueAt',
        'lastReviewedAt',
        'difficultyScore',
        'isPinned',
      ]),
    );

    database.close();
    await database.delete();
  });
});

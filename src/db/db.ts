import Dexie, { type EntityTable } from 'dexie';
import type {
  ReviewLog,
  ReviewSession,
  Settings,
  VerseProgress,
  WordStat,
} from '@/types';

export type MetaRecord = {
  key: string;
  value: unknown;
};

/**
 * Current schema version. Bump this and add a `version(n).stores(...).upgrade()`
 * block below when the shape changes; never drop or recreate a table, because
 * these records are the reader's only copy of their progress.
 */
export const SCHEMA_VERSION = 2;

export class VerseMemoryDatabase extends Dexie {
  progress!: EntityTable<VerseProgress, 'verseId'>;
  reviewLogs!: EntityTable<ReviewLog, 'id'>;
  sessions!: EntityTable<ReviewSession, 'id'>;
  wordStats!: EntityTable<WordStat, 'key'>;
  settings!: EntityTable<Settings, 'id'>;
  meta!: EntityTable<MetaRecord, 'key'>;

  constructor(name = 'verse-memory') {
    super(name);

    // v1: the original shipping schema.
    this.version(1).stores({
      progress:
        'verseId, status, isMemorized, isDifficult, nextDueAt, lastReviewedAt',
      reviewLogs: 'id, verseId, reviewedAt, mode, rating',
      sessions: 'id, createdAt, completedAt',
      wordStats: 'key, verseId, wordIndex',
      settings: 'id',
      meta: 'key',
    });

    // v2: adds difficulty/pinning fields plus indexes used by the library
    // filters. The upgrade backfills defaults so existing rows survive.
    this.version(2)
      .stores({
        progress:
          'verseId, status, isMemorized, isDifficult, nextDueAt, lastReviewedAt, difficultyScore, isPinned',
        reviewLogs: 'id, verseId, reviewedAt, mode, rating, sessionId',
        sessions: 'id, createdAt, completedAt',
        wordStats: 'key, verseId, wordIndex, misses',
        settings: 'id',
        meta: 'key',
      })
      .upgrade(async (transaction) => {
        await transaction
          .table<VerseProgress>('progress')
          .toCollection()
          .modify((record) => {
            record.problemCategories ??= [];
            record.difficultyReasons ??= [];
            record.isPinned ??= record.pinnedFrequencyDays !== null;
            record.totalElapsedMs ??= 0;
          });

        await transaction
          .table<ReviewLog>('reviewLogs')
          .toCollection()
          .modify((record) => {
            record.sessionId ??= null;
            record.wordErrors ??= [];
          });
      });
  }
}

let instance: VerseMemoryDatabase | null = null;

export function getDatabase(): VerseMemoryDatabase {
  instance ??= new VerseMemoryDatabase();
  return instance;
}

/** Test hook: swaps in an isolated database instance. */
export function setDatabase(database: VerseMemoryDatabase | null): void {
  instance = database;
}

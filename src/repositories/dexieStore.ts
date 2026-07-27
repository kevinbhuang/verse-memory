import { getDatabase, type VerseMemoryDatabase } from '@/db/db';
import { DEFAULT_SETTINGS } from '@/db/defaults';
import type {
  ReviewLog,
  ReviewSession,
  Settings,
  VerseProgress,
  WordStat,
} from '@/types';
import type { DataStore } from './types';

/** IndexedDB-backed implementation of the persistence contract. */
export function createDexieStore(
  database: VerseMemoryDatabase = getDatabase(),
): DataStore {
  return {
    progress: {
      all: () => database.progress.toArray(),
      get: (verseId) => database.progress.get(verseId),
      getMany: async (verseIds) => {
        const records = await database.progress.bulkGet(verseIds);
        return records.filter((record): record is VerseProgress =>
          Boolean(record),
        );
      },
      put: async (progress) => {
        await database.progress.put(progress);
      },
      putMany: async (records) => {
        await database.progress.bulkPut(records);
      },
      remove: async (verseId) => {
        await database.progress.delete(verseId);
      },
      clear: async () => {
        await database.progress.clear();
      },
    },

    reviewLogs: {
      all: () => database.reviewLogs.toArray(),
      forVerse: (verseId) =>
        database.reviewLogs.where('verseId').equals(verseId).toArray(),
      since: (isoDate) =>
        database.reviewLogs.where('reviewedAt').aboveOrEqual(isoDate).toArray(),
      add: async (log: ReviewLog) => {
        await database.reviewLogs.put(log);
      },
      addMany: async (logs: ReviewLog[]) => {
        await database.reviewLogs.bulkPut(logs);
      },
      removeForVerse: async (verseId) => {
        await database.reviewLogs.where('verseId').equals(verseId).delete();
      },
      clear: async () => {
        await database.reviewLogs.clear();
      },
    },

    sessions: {
      all: () => database.sessions.toArray(),
      get: (id) => database.sessions.get(id),
      latestOpen: async () => {
        const open = await database.sessions
          .filter((session: ReviewSession) => session.completedAt === null)
          .toArray();
        return open.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      },
      put: async (session) => {
        await database.sessions.put(session);
      },
      putMany: async (sessions) => {
        await database.sessions.bulkPut(sessions);
      },
      remove: async (id) => {
        await database.sessions.delete(id);
      },
      clear: async () => {
        await database.sessions.clear();
      },
    },

    wordStats: {
      all: () => database.wordStats.toArray(),
      forVerse: (verseId) =>
        database.wordStats.where('verseId').equals(verseId).toArray(),
      putMany: async (stats: WordStat[]) => {
        await database.wordStats.bulkPut(stats);
      },
      removeForVerse: async (verseId) => {
        await database.wordStats.where('verseId').equals(verseId).delete();
      },
      clear: async () => {
        await database.wordStats.clear();
      },
    },

    settings: {
      get: async (): Promise<Settings> => {
        const stored = await database.settings.get('settings');
        // Merging with defaults means a settings field added in a later
        // release is present even for readers who never opened Settings.
        return { ...DEFAULT_SETTINGS, ...(stored ?? {}), id: 'settings' };
      },
      save: async (settings) => {
        await database.settings.put({
          ...settings,
          id: 'settings',
          updatedAt: new Date().toISOString(),
        });
      },
      restore: async (settings) => {
        await database.settings.put({ ...settings, id: 'settings' });
      },
      reset: async () => {
        const fresh: Settings = {
          ...DEFAULT_SETTINGS,
          updatedAt: new Date().toISOString(),
        };
        await database.settings.put(fresh);
        return fresh;
      },
    },

    meta: {
      get: async <T,>(key: string) => {
        const record = await database.meta.get(key);
        return record?.value as T | undefined;
      },
      set: async (key, value) => {
        await database.meta.put({ key, value });
      },
    },

    clearAll: async () => {
      await database.transaction(
        'rw',
        [
          database.progress,
          database.reviewLogs,
          database.sessions,
          database.wordStats,
          database.meta,
        ],
        async () => {
          await Promise.all([
            database.progress.clear(),
            database.reviewLogs.clear(),
            database.sessions.clear(),
            database.wordStats.clear(),
            database.meta.clear(),
          ]);
        },
      );
    },
  };
}

export type { VerseProgress, ReviewLog };

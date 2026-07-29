import { useLiveQuery } from 'dexie-react-hooks';
import { getDatabase } from '@/db/db';
import { withDefaults } from '@/services/progressService';
import { verses } from '@/data/verses';
import type { ReviewLog, VerseProgress, WordStat } from '@/types';

/**
 * Live views over IndexedDB.
 *
 * These hooks are the only place components read persisted data directly; they
 * re-render automatically when any write happens, including writes made in
 * another tab.
 */

export function useAllProgress(): VerseProgress[] | undefined {
  return useLiveQuery(async () => {
    const stored = await getDatabase().progress.toArray();
    return withDefaults(stored);
  }, []);
}

export function useProgressMap():
  | Map<string, VerseProgress>
  | undefined {
  const all = useAllProgress();
  if (!all) return undefined;
  return new Map(all.map((record) => [record.verseId, record]));
}

export function useVerseProgress(
  verseId: string | undefined,
): VerseProgress | undefined {
  return useLiveQuery(async () => {
    if (!verseId) return undefined;
    const stored = await getDatabase().progress.get(verseId);
    if (stored) return stored;
    const verse = verses.find((item) => item.id === verseId);
    if (!verse) return undefined;
    return withDefaults([]).find((record) => record.verseId === verseId);
  }, [verseId]);
}

export function useReviewLogs(verseId?: string): ReviewLog[] | undefined {
  return useLiveQuery(async () => {
    const table = getDatabase().reviewLogs;
    const logs = verseId
      ? await table.where('verseId').equals(verseId).toArray()
      : await table.toArray();
    return logs.sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt));
  }, [verseId]);
}

export function useWordStats(verseId?: string): WordStat[] | undefined {
  return useLiveQuery(async () => {
    const table = getDatabase().wordStats;
    return verseId
      ? table.where('verseId').equals(verseId).toArray()
      : table.toArray();
  }, [verseId]);
}

/**
 * Resolves to `null` when the session is not stored, so callers can tell a
 * session that is still loading (`undefined`) from one that does not exist.
 */
export function useSession(sessionId: string | undefined) {
  return useLiveQuery(async () => {
    if (!sessionId) return null;
    return (await getDatabase().sessions.get(sessionId)) ?? null;
  }, [sessionId]);
}

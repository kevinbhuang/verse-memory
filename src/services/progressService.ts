import { addDays, startOfDay } from 'date-fns';
import { getDataStore } from '@/repositories';
import { createDefaultProgress } from '@/db/defaults';
import { assessDifficulty } from '@/lib/difficulty';
import { withManualDueDate } from '@/lib/scheduler';
import { verses } from '@/data/verses';
import type {
  ProblemCategory,
  Section,
  VerseProgress,
  VerseStatus,
} from '@/types';

const store = () => getDataStore();

/** Returns the stored record, or a default one that has not been saved yet. */
export async function getProgress(verseId: string): Promise<VerseProgress> {
  const existing = await store().progress.get(verseId);
  return existing ?? createDefaultProgress(verseId);
}

export async function getAllProgress(): Promise<Map<string, VerseProgress>> {
  const records = await store().progress.all();
  return new Map(records.map((record) => [record.verseId, record]));
}

/**
 * Builds a complete progress list for all 171 passages, filling in defaults
 * for passages that have never been touched.
 */
export function withDefaults(
  stored: Map<string, VerseProgress> | VerseProgress[] | undefined,
): VerseProgress[] {
  const map =
    stored instanceof Map
      ? stored
      : new Map((stored ?? []).map((record) => [record.verseId, record]));

  return verses.map(
    (verse) => map.get(verse.id) ?? createDefaultProgress(verse.id),
  );
}

export async function updateProgress(
  verseId: string,
  changes: Partial<VerseProgress>,
  now: Date = new Date(),
): Promise<VerseProgress> {
  const current = await getProgress(verseId);
  const next: VerseProgress = {
    ...current,
    ...changes,
    verseId,
    updatedAt: now.toISOString(),
  };
  await store().progress.put(next);
  return next;
}

/**
 * Marking a passage memorized schedules its first retention review; unmarking
 * it is reversible and deliberately keeps the review history intact.
 */
export async function setMemorized(
  verseId: string,
  isMemorized: boolean,
  now: Date = new Date(),
): Promise<VerseProgress> {
  const current = await getProgress(verseId);

  if (isMemorized) {
    const firstReview = addDays(startOfDay(now), 1);
    return updateProgress(
      verseId,
      {
        isMemorized: true,
        memorizedAt: current.memorizedAt ?? now.toISOString(),
        status: current.isDifficult ? 'needs-attention' : 'memorized',
        // Only schedule an initial review if nothing is scheduled yet, so
        // re-checking the box does not disturb an established interval.
        nextDueAt: current.nextDueAt ?? firstReview.toISOString(),
        intervalDays: current.nextDueAt ? current.intervalDays : 1,
        intervalStep: current.intervalStep < 0 ? 0 : current.intervalStep,
      },
      now,
    );
  }

  return updateProgress(
    verseId,
    {
      isMemorized: false,
      status: current.reviewCount > 0 ? 'learning' : 'new',
    },
    now,
  );
}

export async function setDifficult(
  verseId: string,
  isDifficult: boolean,
  now: Date = new Date(),
): Promise<VerseProgress> {
  const current = await getProgress(verseId);
  const status: VerseStatus = isDifficult
    ? 'needs-attention'
    : current.isMemorized
      ? 'memorized'
      : current.reviewCount > 0
        ? 'learning'
        : 'new';

  return updateProgress(verseId, { isDifficult, status }, now);
}

export async function setNeedsAttention(
  verseId: string,
  needsAttention: boolean,
  now: Date = new Date(),
): Promise<VerseProgress> {
  const current = await getProgress(verseId);
  if (needsAttention) {
    return updateProgress(verseId, { status: 'needs-attention' }, now);
  }
  return updateProgress(
    verseId,
    {
      status: current.isMemorized
        ? 'memorized'
        : current.reviewCount > 0
          ? 'learning'
          : 'new',
    },
    now,
  );
}

export async function saveNote(
  verseId: string,
  note: string,
  now: Date = new Date(),
): Promise<VerseProgress> {
  return updateProgress(verseId, { note }, now);
}

export async function setProblemCategories(
  verseId: string,
  problemCategories: ProblemCategory[],
  now: Date = new Date(),
): Promise<VerseProgress> {
  return updateProgress(verseId, { problemCategories }, now);
}

export async function setPinnedFrequency(
  verseId: string,
  pinnedFrequencyDays: number | null,
  now: Date = new Date(),
): Promise<VerseProgress> {
  return updateProgress(
    verseId,
    {
      pinnedFrequencyDays,
      isPinned: pinnedFrequencyDays !== null,
    },
    now,
  );
}

export async function setCustomMaximumInterval(
  verseId: string,
  days: number | null,
  now: Date = new Date(),
): Promise<VerseProgress> {
  return updateProgress(verseId, { customMaximumIntervalDays: days }, now);
}

export async function setDueDate(
  verseId: string,
  dueDate: Date,
  now: Date = new Date(),
): Promise<VerseProgress> {
  return updateProgress(verseId, withManualDueDate(dueDate, now), now);
}

/**
 * Clears scheduling and history for one passage. The note and the manual
 * difficult flag are preserved unless the caller asks otherwise.
 */
export async function resetVerse(
  verseId: string,
  options: { keepNote?: boolean; keepDifficultFlag?: boolean } = {},
  now: Date = new Date(),
): Promise<void> {
  const { keepNote = true, keepDifficultFlag = true } = options;
  const current = await getProgress(verseId);
  const fresh = createDefaultProgress(verseId, now);

  await store().progress.put({
    ...fresh,
    note: keepNote ? current.note : '',
    isDifficult: keepDifficultFlag ? current.isDifficult : false,
    problemCategories: keepDifficultFlag ? current.problemCategories : [],
    createdAt: current.createdAt,
  });
  await store().reviewLogs.removeForVerse(verseId);
  await store().wordStats.removeForVerse(verseId);
}

export async function resetSection(
  section: Section,
  now: Date = new Date(),
): Promise<number> {
  const target = verses.filter((verse) => verse.section === section);
  for (const verse of target) {
    await resetVerse(verse.id, {}, now);
  }
  return target.length;
}

/** Resets scheduling only, keeping counts, notes and flags. */
export async function resetScheduling(
  verseIds: string[],
  now: Date = new Date(),
): Promise<void> {
  const records = await Promise.all(verseIds.map((id) => getProgress(id)));
  await store().progress.putMany(
    records.map((record) => ({
      ...record,
      nextDueAt: null,
      intervalDays: 0,
      intervalStep: -1,
      consecutiveSuccesses: 0,
      updatedAt: now.toISOString(),
    })),
  );
}

export type BulkAction =
  | 'mark-memorized'
  | 'mark-not-memorized'
  | 'mark-difficult'
  | 'clear-difficult'
  | 'reset-scheduling';

export async function applyBulkAction(
  verseIds: string[],
  action: BulkAction,
  now: Date = new Date(),
): Promise<void> {
  switch (action) {
    case 'mark-memorized':
      for (const verseId of verseIds) await setMemorized(verseId, true, now);
      return;
    case 'mark-not-memorized':
      for (const verseId of verseIds) await setMemorized(verseId, false, now);
      return;
    case 'mark-difficult':
      for (const verseId of verseIds) await setDifficult(verseId, true, now);
      return;
    case 'clear-difficult':
      for (const verseId of verseIds) await setDifficult(verseId, false, now);
      return;
    case 'reset-scheduling':
      await resetScheduling(verseIds, now);
      return;
  }
}

/** Recomputes the transparent difficulty score for one passage. */
export async function refreshDifficulty(
  verseId: string,
  now: Date = new Date(),
): Promise<VerseProgress> {
  const [progress, logs, wordStats] = await Promise.all([
    getProgress(verseId),
    store().reviewLogs.forVerse(verseId),
    store().wordStats.forVerse(verseId),
  ]);

  const assessment = assessDifficulty(progress, logs, wordStats, now);
  return updateProgress(
    verseId,
    {
      difficultyScore: assessment.score,
      difficultyReasons: assessment.reasons,
    },
    now,
  );
}

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { verses } from '@/data/verses';
import { getFirestoreDb } from '@/lib/firebase';
import { getDataStore } from '@/repositories';
import type { VerseProgress } from '@/types';

/** Compact per-verse flags shared with approved friends (not the full backup). */
export type PublicVerseFlag = {
  memorized: boolean;
  needsReview: boolean;
};

export type PublicProgressSummary = {
  updatedAt: string;
  memorizedCount: number;
  needsReviewCount: number;
  total: number;
  /** Passages newly marked memorized in the last 7 days. */
  weeklyDelta: number;
  /** Sparse map: only verses that are memorized and/or Needs Review. */
  verses: Record<string, PublicVerseFlag>;
};

function startOfWeeklyWindow(now: Date = new Date()): Date {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 6);
  return start;
}

export function buildPublicProgressSummary(
  progressList: VerseProgress[],
  updatedAt: string = new Date().toISOString(),
  now: Date = new Date(),
): PublicProgressSummary {
  const byId = new Map(progressList.map((p) => [p.verseId, p]));
  const verseFlags: Record<string, PublicVerseFlag> = {};
  let memorizedCount = 0;
  let needsReviewCount = 0;
  let weeklyDelta = 0;
  const weekStart = startOfWeeklyWindow(now).getTime();

  for (const verse of verses) {
    const progress = byId.get(verse.id);
    const memorized = progress?.isMemorized ?? false;
    const needsReview = progress?.isDifficult ?? false;
    if (memorized) {
      memorizedCount += 1;
      if (progress?.memorizedAt) {
        const stamped = new Date(progress.memorizedAt).getTime();
        if (!Number.isNaN(stamped) && stamped >= weekStart) {
          weeklyDelta += 1;
        }
      }
    }
    if (needsReview) needsReviewCount += 1;
    if (memorized || needsReview) {
      verseFlags[verse.id] = { memorized, needsReview };
    }
  }

  return {
    updatedAt,
    memorizedCount,
    needsReviewCount,
    total: verses.length,
    weeklyDelta,
    verses: verseFlags,
  };
}

function summaryRef(uid: string) {
  const db = getFirestoreDb();
  if (!db) return null;
  return doc(db, 'users', uid, 'publicProgress', 'summary');
}

/** Write shareable summary from local Dexie progress (owner only). */
export async function writePublicProgressSummary(uid: string): Promise<void> {
  const ref = summaryRef(uid);
  if (!ref) return;
  const progressList = await getDataStore().progress.all();
  const summary = buildPublicProgressSummary(progressList);
  await setDoc(ref, summary);
}

export async function readPublicProgressSummary(
  uid: string,
): Promise<PublicProgressSummary | null> {
  const ref = summaryRef(uid);
  if (!ref) throw new Error('Firebase is not configured.');
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() as Partial<PublicProgressSummary>;
  if (!data.updatedAt || typeof data.verses !== 'object' || !data.verses) {
    return null;
  }
  return {
    updatedAt: data.updatedAt,
    memorizedCount: data.memorizedCount ?? 0,
    needsReviewCount: data.needsReviewCount ?? 0,
    total: data.total ?? verses.length,
    weeklyDelta: data.weeklyDelta ?? 0,
    verses: data.verses,
  };
}

/**
 * Build a Map usable by ProgressChart from a public summary
 * (missing verses = not memorized / not Needs Review).
 */
export function summaryToProgressMap(
  summary: PublicProgressSummary,
): Map<string, Pick<VerseProgress, 'verseId' | 'isMemorized' | 'isDifficult'>> {
  const map = new Map<
    string,
    Pick<VerseProgress, 'verseId' | 'isMemorized' | 'isDifficult'>
  >();
  for (const verse of verses) {
    const flags = summary.verses[verse.id];
    map.set(verse.id, {
      verseId: verse.id,
      isMemorized: flags?.memorized ?? false,
      isDifficult: flags?.needsReview ?? false,
    });
  }
  return map;
}

import {
  addDays,
  differenceInCalendarDays,
  format,
  isSameDay,
  startOfDay,
  subDays,
} from 'date-fns';
import { verses } from '@/data/verses';
import { SECTION_RANGES } from '@/config/app';
import { daysOverdue, dueState } from '@/lib/scheduler';
import { successRate } from '@/lib/weakWords';
import type {
  ReviewLog,
  Section,
  VerseProgress,
  WordStat,
} from '@/types';

export type CollectionStats = {
  total: number;
  memorized: number;
  learning: number;
  newCount: number;
  needsAttention: number;
  difficult: number;
  dueToday: number;
  overdue: number;
  current: number;
  neverReviewed: number;
  percentMemorized: number;
  percentCurrent: number;
};

export function computeCollectionStats(
  progressList: VerseProgress[],
  now: Date = new Date(),
): CollectionStats {
  const total = progressList.length;
  let memorized = 0;
  let learning = 0;
  let newCount = 0;
  let needsAttention = 0;
  let difficult = 0;
  let dueToday = 0;
  let overdue = 0;
  let neverReviewed = 0;

  for (const progress of progressList) {
    if (progress.isMemorized) memorized += 1;
    if (progress.status === 'learning') learning += 1;
    if (progress.status === 'new') newCount += 1;
    if (progress.status === 'needs-attention') needsAttention += 1;
    if (progress.isDifficult) difficult += 1;
    if (progress.reviewCount === 0) neverReviewed += 1;

    const state = dueState(progress, now);
    if (state === 'due') dueToday += 1;
    if (state === 'overdue') overdue += 1;
  }

  const current = memorized - overdue > 0 ? memorized - overdue : 0;

  return {
    total,
    memorized,
    learning,
    newCount,
    needsAttention,
    difficult,
    dueToday,
    overdue,
    current,
    neverReviewed,
    percentMemorized: total === 0 ? 0 : (memorized / total) * 100,
    percentCurrent: memorized === 0 ? 0 : (current / memorized) * 100,
  };
}

export type SectionProgress = {
  section: Section;
  start: number;
  end: number;
  total: number;
  memorized: number;
  due: number;
  difficult: number;
  percent: number;
};

export function computeSectionProgress(
  progressList: VerseProgress[],
  now: Date = new Date(),
): SectionProgress[] {
  const byId = new Map(progressList.map((record) => [record.verseId, record]));

  return SECTION_RANGES.map((range) => {
    const sectionVerses = verses.filter(
      (verse) => verse.section === range.section,
    );
    let memorized = 0;
    let due = 0;
    let difficult = 0;

    for (const verse of sectionVerses) {
      const progress = byId.get(verse.id);
      if (!progress) continue;
      if (progress.isMemorized) memorized += 1;
      if (progress.isDifficult) difficult += 1;
      const state = dueState(progress, now);
      if (state === 'due' || state === 'overdue') due += 1;
    }

    return {
      section: range.section,
      start: range.start,
      end: range.end,
      total: sectionVerses.length,
      memorized,
      due,
      difficult,
      percent:
        sectionVerses.length === 0
          ? 0
          : (memorized / sectionVerses.length) * 100,
    };
  });
}

export type ForecastDay = {
  date: Date;
  label: string;
  count: number;
};

/** How many passages fall due on each of the next `days` days. */
export function computeForecast(
  progressList: VerseProgress[],
  days = 7,
  now: Date = new Date(),
): ForecastDay[] {
  const today = startOfDay(now);
  const buckets: ForecastDay[] = Array.from({ length: days }, (_, index) => {
    const date = addDays(today, index);
    return {
      date,
      label: index === 0 ? 'Today' : format(date, 'EEE'),
      count: 0,
    };
  });

  for (const progress of progressList) {
    if (!progress.nextDueAt) continue;
    const offset = differenceInCalendarDays(
      startOfDay(new Date(progress.nextDueAt)),
      today,
    );
    if (offset < 0) {
      buckets[0].count += 1;
    } else if (offset < days) {
      buckets[offset].count += 1;
    }
  }

  return buckets;
}

export type DailyActivity = {
  date: Date;
  key: string;
  reviews: number;
  accuracy: number | null;
  elapsedMs: number;
};

export function computeDailyActivity(
  logs: ReviewLog[],
  days = 30,
  now: Date = new Date(),
): DailyActivity[] {
  const today = startOfDay(now);
  const buckets = new Map<string, DailyActivity>();

  for (let index = days - 1; index >= 0; index -= 1) {
    const date = subDays(today, index);
    const key = format(date, 'yyyy-MM-dd');
    buckets.set(key, { date, key, reviews: 0, accuracy: null, elapsedMs: 0 });
  }

  const accuracyTotals = new Map<string, { sum: number; count: number }>();

  for (const log of logs) {
    const key = format(new Date(log.reviewedAt), 'yyyy-MM-dd');
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.reviews += 1;
    bucket.elapsedMs += log.elapsedMs;
    if (log.accuracy !== null) {
      const totals = accuracyTotals.get(key) ?? { sum: 0, count: 0 };
      totals.sum += log.accuracy;
      totals.count += 1;
      accuracyTotals.set(key, totals);
    }
  }

  for (const [key, totals] of accuracyTotals) {
    const bucket = buckets.get(key);
    if (bucket && totals.count > 0) {
      bucket.accuracy = totals.sum / totals.count;
    }
  }

  return [...buckets.values()];
}

export type StreakInfo = {
  current: number;
  longest: number;
  reviewedToday: number;
  lastReviewDate: Date | null;
};

/**
 * A gentle streak: it counts back from today, and a day that has not happened
 * yet does not end the run, so opening the app in the evening after a missed
 * morning does not wipe anything out.
 */
export function computeStreak(
  logs: ReviewLog[],
  now: Date = new Date(),
): StreakInfo {
  if (logs.length === 0) {
    return { current: 0, longest: 0, reviewedToday: 0, lastReviewDate: null };
  }

  const dayKeys = new Set(
    logs.map((log) => format(new Date(log.reviewedAt), 'yyyy-MM-dd')),
  );
  const today = startOfDay(now);
  const reviewedToday = logs.filter((log) =>
    isSameDay(new Date(log.reviewedAt), now),
  ).length;

  let current = 0;
  let cursor = dayKeys.has(format(today, 'yyyy-MM-dd'))
    ? today
    : subDays(today, 1);

  while (dayKeys.has(format(cursor, 'yyyy-MM-dd'))) {
    current += 1;
    cursor = subDays(cursor, 1);
  }

  const sortedDays = [...dayKeys].sort();
  let longest = 0;
  let run = 0;
  let previous: Date | null = null;

  for (const key of sortedDays) {
    const date = new Date(`${key}T00:00:00`);
    run =
      previous && differenceInCalendarDays(date, previous) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = date;
  }

  const lastLog = logs.reduce((latest, log) =>
    log.reviewedAt > latest.reviewedAt ? log : latest,
  );

  return {
    current,
    longest,
    reviewedToday,
    lastReviewDate: new Date(lastLog.reviewedAt),
  };
}

export type AccuracyPoint = { date: Date; label: string; accuracy: number };

export function computeAccuracyTrend(
  logs: ReviewLog[],
  days = 14,
  now: Date = new Date(),
): AccuracyPoint[] {
  return computeDailyActivity(logs, days, now)
    .filter((day) => day.accuracy !== null)
    .map((day) => ({
      date: day.date,
      label: format(day.date, 'MMM d'),
      accuracy: day.accuracy as number,
    }));
}

export type DifficultVerseEntry = {
  verseId: string;
  reference: string;
  order: number;
  score: number;
  reasons: string[];
  lapses: number;
  overdueDays: number;
};

export function mostDifficultVerses(
  progressList: VerseProgress[],
  limit = 8,
  now: Date = new Date(),
): DifficultVerseEntry[] {
  const byId = new Map(verses.map((verse) => [verse.id, verse]));

  return progressList
    .filter(
      (progress) =>
        progress.difficultyScore > 0 ||
        progress.isDifficult ||
        progress.lapseCount > 0,
    )
    .sort((a, b) => {
      if (b.difficultyScore !== a.difficultyScore) {
        return b.difficultyScore - a.difficultyScore;
      }
      return b.lapseCount - a.lapseCount;
    })
    .slice(0, limit)
    .map((progress) => {
      const verse = byId.get(progress.verseId);
      return {
        verseId: progress.verseId,
        reference: verse?.reference ?? progress.verseId,
        order: verse?.order ?? 0,
        score: progress.difficultyScore,
        reasons: progress.difficultyReasons,
        lapses: progress.lapseCount,
        overdueDays: daysOverdue(progress, now),
      };
    });
}

export type MissedWordEntry = {
  key: string;
  verseId: string;
  reference: string;
  word: string;
  wordIndex: number;
  misses: number;
  hints: number;
  successRate: number;
};

export function mostMissedWords(
  stats: WordStat[],
  limit = 12,
): MissedWordEntry[] {
  const byId = new Map(verses.map((verse) => [verse.id, verse]));

  return [...stats]
    .filter((stat) => stat.misses > 0)
    .sort((a, b) => {
      if (b.misses !== a.misses) return b.misses - a.misses;
      return successRate(a) - successRate(b);
    })
    .slice(0, limit)
    .map((stat) => ({
      key: stat.key,
      verseId: stat.verseId,
      reference: byId.get(stat.verseId)?.reference ?? stat.verseId,
      word: stat.word,
      wordIndex: stat.wordIndex,
      misses: stat.misses,
      hints: stat.hints,
      successRate: successRate(stat),
    }));
}

export type MasteredEntry = {
  verseId: string;
  reference: string;
  memorizedAt: string;
};

export function recentlyMastered(
  progressList: VerseProgress[],
  limit = 5,
): MasteredEntry[] {
  const byId = new Map(verses.map((verse) => [verse.id, verse]));

  return progressList
    .filter((progress) => progress.isMemorized && progress.memorizedAt)
    .sort((a, b) =>
      (b.memorizedAt as string).localeCompare(a.memorizedAt as string),
    )
    .slice(0, limit)
    .map((progress) => ({
      verseId: progress.verseId,
      reference: byId.get(progress.verseId)?.reference ?? progress.verseId,
      memorizedAt: progress.memorizedAt as string,
    }));
}

export type ActivityEntry = {
  logId: string;
  verseId: string;
  reference: string;
  reviewedAt: string;
  rating: ReviewLog['rating'];
  mode: ReviewLog['mode'];
  accuracy: number | null;
};

export function recentActivity(logs: ReviewLog[], limit = 8): ActivityEntry[] {
  const byId = new Map(verses.map((verse) => [verse.id, verse]));

  return [...logs]
    .sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt))
    .slice(0, limit)
    .map((log) => ({
      logId: log.id,
      verseId: log.verseId,
      reference: byId.get(log.verseId)?.reference ?? log.verseId,
      reviewedAt: log.reviewedAt,
      rating: log.rating,
      mode: log.mode,
      accuracy: log.accuracy,
    }));
}

export function totalReviewTimeMs(logs: ReviewLog[]): number {
  return logs.reduce((sum, log) => sum + Math.max(0, log.elapsedMs), 0);
}

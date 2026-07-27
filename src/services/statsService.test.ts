import { describe, expect, it } from 'vitest';
import { addDays, subDays } from 'date-fns';
import { createDefaultProgress } from '@/db/defaults';
import { emptyWordStat } from '@/lib/weakWords';
import { getVerseByOrder, verses } from '@/data/verses';
import type { ReviewLog, VerseProgress } from '@/types';
import {
  computeAccuracyTrend,
  computeCollectionStats,
  computeDailyActivity,
  computeForecast,
  computeSectionProgress,
  computeStreak,
  mostDifficultVerses,
  mostMissedWords,
  recentActivity,
  recentlyMastered,
  totalReviewTimeMs,
} from './statsService';

const NOW = new Date('2026-05-04T10:00:00.000Z');

function buildProgress(
  overrides: Record<number, Partial<VerseProgress>> = {},
): VerseProgress[] {
  return verses.map((verse) => ({
    ...createDefaultProgress(verse.id, NOW),
    ...(overrides[verse.order] ?? {}),
  }));
}

let counter = 0;

function log(overrides: Partial<ReviewLog> = {}): ReviewLog {
  counter += 1;
  return {
    id: `log-${counter}`,
    verseId: 'verse-001',
    reviewedAt: NOW.toISOString(),
    mode: 'flashcard',
    rating: 'good',
    accuracy: 1,
    elapsedMs: 10_000,
    incorrectCount: 0,
    hintCount: 0,
    fullRevealUsed: false,
    previousIntervalDays: 1,
    nextIntervalDays: 3,
    nextDueAt: NOW.toISOString(),
    wordErrors: [],
    sessionId: null,
    ...overrides,
  };
}

describe('computeCollectionStats', () => {
  it('reports an untouched collection honestly', () => {
    const stats = computeCollectionStats(buildProgress(), NOW);

    expect(stats).toMatchObject({
      total: 171,
      memorized: 0,
      newCount: 171,
      neverReviewed: 171,
      dueToday: 0,
      overdue: 0,
      percentMemorized: 0,
      percentCurrent: 0,
    });
  });

  it('counts each category of passage', () => {
    const stats = computeCollectionStats(
      buildProgress({
        1: { isMemorized: true, status: 'memorized', reviewCount: 3 },
        2: { isMemorized: true, status: 'memorized', reviewCount: 5 },
        3: { status: 'learning', reviewCount: 1 },
        4: { status: 'needs-attention', isDifficult: true, reviewCount: 2 },
        5: { isDifficult: true },
      }),
      NOW,
    );

    expect(stats).toMatchObject({
      memorized: 2,
      learning: 1,
      needsAttention: 1,
      difficult: 2,
      newCount: 167,
      neverReviewed: 167,
    });
    expect(stats.percentMemorized).toBeCloseTo((2 / 171) * 100, 5);
  });

  it('separates passages due today from overdue ones', () => {
    const stats = computeCollectionStats(
      buildProgress({
        1: { nextDueAt: NOW.toISOString() },
        2: { nextDueAt: subDays(NOW, 3).toISOString() },
        3: { nextDueAt: addDays(NOW, 3).toISOString() },
      }),
      NOW,
    );

    expect(stats.dueToday).toBe(1);
    expect(stats.overdue).toBe(1);
  });

  it('treats memorized passages that are not overdue as current', () => {
    const stats = computeCollectionStats(
      buildProgress({
        1: { isMemorized: true, nextDueAt: addDays(NOW, 10).toISOString() },
        2: { isMemorized: true, nextDueAt: subDays(NOW, 10).toISOString() },
      }),
      NOW,
    );

    expect(stats.current).toBe(1);
    expect(stats.percentCurrent).toBe(50);
  });
});

describe('computeSectionProgress', () => {
  it('uses the seven approved sections and their boundaries', () => {
    const sections = computeSectionProgress(buildProgress(), NOW);

    expect(sections.map((section) => [section.section, section.total])).toEqual([
      ['Law and History', 7],
      ['Wisdom and Poetry', 12],
      ['Prophets', 18],
      ['Gospels', 31],
      ['Acts', 4],
      ['Paul\u2019s Epistles', 72],
      ['General Epistles and Revelation', 27],
    ]);
    expect(sections.reduce((sum, section) => sum + section.total, 0)).toBe(171);
  });

  it('counts progress within each section', () => {
    const sections = computeSectionProgress(
      buildProgress({
        1: { isMemorized: true },
        2: { isMemorized: true },
        69: { isMemorized: true, isDifficult: true },
        70: { nextDueAt: subDays(NOW, 1).toISOString() },
      }),
      NOW,
    );

    const law = sections[0];
    expect(law.memorized).toBe(2);
    expect(law.percent).toBeCloseTo((2 / 7) * 100, 5);

    const acts = sections.find((section) => section.section === 'Acts')!;
    expect(acts).toMatchObject({ memorized: 1, difficult: 1, due: 1 });
  });
});

describe('computeForecast', () => {
  it('buckets the next seven days', () => {
    const forecast = computeForecast(
      buildProgress({
        1: { nextDueAt: NOW.toISOString() },
        2: { nextDueAt: addDays(NOW, 1).toISOString() },
        3: { nextDueAt: addDays(NOW, 1).toISOString() },
        4: { nextDueAt: addDays(NOW, 6).toISOString() },
        5: { nextDueAt: addDays(NOW, 30).toISOString() },
      }),
      7,
      NOW,
    );

    expect(forecast).toHaveLength(7);
    expect(forecast[0].label).toBe('Today');
    expect(forecast.map((day) => day.count)).toEqual([1, 2, 0, 0, 0, 0, 1]);
  });

  it('rolls overdue passages into today rather than hiding them', () => {
    const forecast = computeForecast(
      buildProgress({ 1: { nextDueAt: subDays(NOW, 20).toISOString() } }),
      7,
      NOW,
    );
    expect(forecast[0].count).toBe(1);
  });
});

describe('computeDailyActivity', () => {
  it('returns one bucket per day, including quiet days', () => {
    const activity = computeDailyActivity(
      [
        log({ reviewedAt: NOW.toISOString(), accuracy: 1 }),
        log({ reviewedAt: NOW.toISOString(), accuracy: 0.5 }),
        log({ reviewedAt: subDays(NOW, 2).toISOString(), accuracy: 0.8 }),
      ],
      7,
      NOW,
    );

    expect(activity).toHaveLength(7);

    const today = activity.at(-1)!;
    expect(today.reviews).toBe(2);
    expect(today.accuracy).toBeCloseTo(0.75, 5);
    expect(today.elapsedMs).toBe(20_000);

    const yesterday = activity.at(-2)!;
    expect(yesterday.reviews).toBe(0);
    expect(yesterday.accuracy).toBeNull();
  });

  it('ignores reviews older than the window', () => {
    const activity = computeDailyActivity(
      [log({ reviewedAt: subDays(NOW, 60).toISOString() })],
      7,
      NOW,
    );
    expect(activity.every((day) => day.reviews === 0)).toBe(true);
  });
});

describe('computeStreak', () => {
  it('is zero with no history', () => {
    expect(computeStreak([], NOW)).toEqual({
      current: 0,
      longest: 0,
      reviewedToday: 0,
      lastReviewDate: null,
    });
  });

  it('counts consecutive days up to today', () => {
    const streak = computeStreak(
      [
        log({ reviewedAt: NOW.toISOString() }),
        log({ reviewedAt: subDays(NOW, 1).toISOString() }),
        log({ reviewedAt: subDays(NOW, 2).toISOString() }),
      ],
      NOW,
    );

    expect(streak.current).toBe(3);
    expect(streak.reviewedToday).toBe(1);
  });

  it('does not break the streak just because today is not done yet', () => {
    const streak = computeStreak(
      [
        log({ reviewedAt: subDays(NOW, 1).toISOString() }),
        log({ reviewedAt: subDays(NOW, 2).toISOString() }),
      ],
      NOW,
    );

    expect(streak.current).toBe(2);
    expect(streak.reviewedToday).toBe(0);
  });

  it('ends the streak after a genuinely missed day', () => {
    const streak = computeStreak(
      [
        log({ reviewedAt: NOW.toISOString() }),
        log({ reviewedAt: subDays(NOW, 3).toISOString() }),
        log({ reviewedAt: subDays(NOW, 4).toISOString() }),
      ],
      NOW,
    );

    expect(streak.current).toBe(1);
    expect(streak.longest).toBe(2);
  });

  it('remembers the last review date', () => {
    const streak = computeStreak(
      [
        log({ reviewedAt: subDays(NOW, 5).toISOString() }),
        log({ reviewedAt: subDays(NOW, 1).toISOString() }),
      ],
      NOW,
    );
    expect(streak.lastReviewDate?.toISOString()).toBe(
      subDays(NOW, 1).toISOString(),
    );
  });
});

describe('computeAccuracyTrend', () => {
  it('reports only the days that were actually graded', () => {
    const trend = computeAccuracyTrend(
      [
        log({ reviewedAt: NOW.toISOString(), accuracy: 0.9 }),
        log({ reviewedAt: subDays(NOW, 1).toISOString(), accuracy: null }),
      ],
      14,
      NOW,
    );

    expect(trend).toHaveLength(1);
    expect(trend[0].accuracy).toBeCloseTo(0.9, 5);
  });
});

describe('mostDifficultVerses', () => {
  it('ranks by score and names the passage', () => {
    const entries = mostDifficultVerses(
      buildProgress({
        10: { difficultyScore: 70, difficultyReasons: ['Failed recalls'] },
        20: { difficultyScore: 30 },
        30: { lapseCount: 2 },
      }),
      5,
      NOW,
    );

    expect(entries.map((entry) => entry.score)).toEqual([70, 30, 0]);
    expect(entries[0].reference).toBe(getVerseByOrder(10)?.reference);
    expect(entries[0].reasons).toEqual(['Failed recalls']);
  });

  it('leaves out passages with nothing wrong', () => {
    expect(mostDifficultVerses(buildProgress(), 5, NOW)).toEqual([]);
  });
});

describe('mostMissedWords', () => {
  it('ranks words by how often they are missed', () => {
    const entries = mostMissedWords([
      { ...emptyWordStat('verse-001', 3, 'covenant'), attempts: 6, misses: 4 },
      { ...emptyWordStat('verse-002', 1, 'LORD'), attempts: 6, misses: 5 },
      { ...emptyWordStat('verse-003', 2, 'the'), attempts: 6, misses: 0 },
    ]);

    expect(entries.map((entry) => entry.word)).toEqual(['LORD', 'covenant']);
    expect(entries[0].reference).toBe('Deuteronomy 6:4-5');
    expect(entries[0].successRate).toBeCloseTo(1 / 6, 5);
  });
});

describe('recentlyMastered', () => {
  it('lists the most recently memorized passages first', () => {
    const entries = recentlyMastered(
      buildProgress({
        1: { isMemorized: true, memorizedAt: subDays(NOW, 9).toISOString() },
        2: { isMemorized: true, memorizedAt: subDays(NOW, 1).toISOString() },
        3: { isMemorized: true, memorizedAt: null },
      }),
      5,
    );

    expect(entries.map((entry) => entry.verseId)).toEqual([
      'verse-002',
      'verse-001',
    ]);
  });
});

describe('recentActivity', () => {
  it('shows the newest reviews first with their references', () => {
    const entries = recentActivity(
      [
        log({ reviewedAt: subDays(NOW, 2).toISOString(), verseId: 'verse-001' }),
        log({ reviewedAt: NOW.toISOString(), verseId: 'verse-002' }),
      ],
      5,
    );

    expect(entries.map((entry) => entry.verseId)).toEqual([
      'verse-002',
      'verse-001',
    ]);
    expect(entries[0].reference).toBe('Deuteronomy 6:4-5');
  });
});

describe('totalReviewTimeMs', () => {
  it('adds up review time and ignores nonsense values', () => {
    expect(
      totalReviewTimeMs([
        log({ elapsedMs: 5000 }),
        log({ elapsedMs: 2500 }),
        log({ elapsedMs: -100 }),
      ]),
    ).toBe(7500);
  });
});

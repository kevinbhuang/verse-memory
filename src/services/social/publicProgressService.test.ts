import { describe, expect, it } from 'vitest';
import { verses } from '@/data/verses';
import { buildPublicProgressSummary } from '@/services/social/publicProgressService';
import type { VerseProgress } from '@/types';

function stubProgress(
  overrides: Partial<VerseProgress> & Pick<VerseProgress, 'verseId'>,
): VerseProgress {
  return {
    status: 'new',
    isMemorized: false,
    memorizedAt: null,
    isDifficult: false,
    difficultyScore: 0,
    difficultyReasons: [],
    problemCategories: [],
    note: '',
    lastReviewedAt: null,
    nextDueAt: null,
    intervalDays: 0,
    intervalStep: 0,
    reviewCount: 0,
    successCount: 0,
    lapseCount: 0,
    consecutiveSuccesses: 0,
    lastRating: null,
    customMaximumIntervalDays: null,
    pinnedFrequencyDays: null,
    isPinned: false,
    totalElapsedMs: 0,
    createdAt: '2020-01-01T00:00:00.000Z',
    updatedAt: '2020-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('buildPublicProgressSummary', () => {
  it('counts memorized and Needs Review and stores sparse flags', () => {
    const a = verses[0]!.id;
    const b = verses[1]!.id;
    const summary = buildPublicProgressSummary(
      [
        stubProgress({ verseId: a, isMemorized: true }),
        stubProgress({ verseId: b, isDifficult: true }),
      ],
      '2024-01-01T00:00:00.000Z',
    );

    expect(summary.total).toBe(verses.length);
    expect(summary.memorizedCount).toBe(1);
    expect(summary.needsReviewCount).toBe(1);
    expect(summary.verses[a]).toEqual({
      memorized: true,
      needsReview: false,
    });
    expect(summary.verses[b]).toEqual({
      memorized: false,
      needsReview: true,
    });
    expect(summary.verses[verses[2]!.id]).toBeUndefined();
    expect(summary.updatedAt).toBe('2024-01-01T00:00:00.000Z');
  });
});

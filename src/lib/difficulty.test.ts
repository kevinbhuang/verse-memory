import { describe, expect, it } from 'vitest';
import {
  assessDifficulty,
  difficultyBand,
  NEEDS_ATTENTION_THRESHOLD,
  shouldFlagNeedsAttention,
} from './difficulty';
import { createDefaultProgress } from '@/db/defaults';
import { emptyWordStat } from './weakWords';
import type { ReviewLog, Rating, VerseProgress } from '@/types';

const NOW = new Date('2026-04-01T12:00:00.000Z');

function progressFor(overrides: Partial<VerseProgress> = {}): VerseProgress {
  return { ...createDefaultProgress('verse-001', NOW), ...overrides };
}

let logCounter = 0;

function logFor(overrides: Partial<ReviewLog> = {}): ReviewLog {
  logCounter += 1;
  return {
    id: `log-${logCounter}`,
    verseId: 'verse-001',
    reviewedAt: NOW.toISOString(),
    mode: 'first-letter',
    rating: 'good' as Rating,
    accuracy: 1,
    elapsedMs: 20_000,
    incorrectCount: 0,
    hintCount: 0,
    fullRevealUsed: false,
    previousIntervalDays: 3,
    nextIntervalDays: 7,
    nextDueAt: NOW.toISOString(),
    wordErrors: [],
    sessionId: null,
    ...overrides,
  };
}

describe('assessDifficulty', () => {
  it('scores a clean history at zero with no reasons', () => {
    const assessment = assessDifficulty(
      progressFor(),
      [logFor(), logFor()],
      [],
      NOW,
    );
    expect(assessment.score).toBe(0);
    expect(assessment.factors).toEqual([]);
    expect(assessment.reasons).toEqual([]);
  });

  it('attributes every point to a named, inspectable factor', () => {
    const assessment = assessDifficulty(
      progressFor({ lapseCount: 2 }),
      [logFor({ rating: 'again', accuracy: 0.5, hintCount: 3 })],
      [],
      NOW,
    );

    const total = assessment.factors.reduce(
      (sum, factor) => sum + factor.points,
      0,
    );
    expect(assessment.score).toBe(Math.round(total));
    expect(assessment.factors.map((factor) => factor.key)).toEqual(
      expect.arrayContaining(['lapses', 'accuracy', 'hints']),
    );
    for (const factor of assessment.factors) {
      expect(factor.detail).not.toBe('');
      expect(factor.points).toBeLessThanOrEqual(factor.maxPoints);
    }
  });

  it('orders factors by weight so the biggest problem reads first', () => {
    const assessment = assessDifficulty(
      progressFor({ lapseCount: 3, isDifficult: true }),
      [logFor({ accuracy: 0.95 })],
      [],
      NOW,
    );
    const points = assessment.factors.map((factor) => factor.points);
    expect([...points].sort((a, b) => b - a)).toEqual(points);
  });

  it('caps each factor so one bad streak cannot dominate', () => {
    const assessment = assessDifficulty(
      progressFor({ lapseCount: 40 }),
      [],
      [],
      NOW,
    );
    const lapses = assessment.factors.find(
      (factor) => factor.key === 'lapses',
    );
    expect(lapses?.points).toBe(20);
  });

  it('never exceeds 100 even when everything has gone wrong', () => {
    const badLogs = Array.from({ length: 8 }, () =>
      logFor({
        rating: 'again',
        accuracy: 0,
        hintCount: 10,
        incorrectCount: 30,
        elapsedMs: 400_000,
        fullRevealUsed: true,
      }),
    );
    const wordStats = Array.from({ length: 10 }, (_unused, index) => ({
      ...emptyWordStat('verse-001', index, `word${index}`),
      attempts: 5,
      misses: 5,
    }));

    const assessment = assessDifficulty(
      progressFor({
        lapseCount: 12,
        isDifficult: true,
        nextDueAt: '2026-01-01T12:00:00.000Z',
      }),
      badLogs,
      wordStats,
      NOW,
    );

    expect(assessment.score).toBe(100);
  });

  it('counts days overdue', () => {
    const assessment = assessDifficulty(
      progressFor({ nextDueAt: '2026-03-25T12:00:00.000Z' }),
      [],
      [],
      NOW,
    );
    const overdue = assessment.factors.find(
      (factor) => factor.key === 'overdue',
    );
    expect(overdue?.detail).toBe('7 days past its due date');
  });

  it('always includes the manual flag as a contributing factor', () => {
    const assessment = assessDifficulty(
      progressFor({ isDifficult: true }),
      [],
      [],
      NOW,
    );
    expect(assessment.factors.map((factor) => factor.key)).toContain(
      'manual-flag',
    );
    expect(assessment.reasons).toContain('Marked difficult');
  });

  it('names the specific words that keep going wrong', () => {
    const assessment = assessDifficulty(
      progressFor(),
      [],
      [
        { ...emptyWordStat('verse-001', 2, 'steadfast'), attempts: 4, misses: 3 },
        { ...emptyWordStat('verse-001', 3, 'love'), attempts: 4, misses: 2 },
        { ...emptyWordStat('verse-001', 4, 'the'), attempts: 4, misses: 1 },
      ],
      NOW,
    );
    const weak = assessment.factors.find((factor) => factor.key === 'weak-words');
    expect(weak?.detail).toContain('steadfast, love');
    expect(weak?.detail).not.toContain('the');
  });
});

describe('shouldFlagNeedsAttention', () => {
  it('leaves passages that are not yet memorized alone', () => {
    expect(shouldFlagNeedsAttention(progressFor(), 90)).toBe(false);
  });

  it('flags a memorized passage once the score crosses the threshold', () => {
    const progress = progressFor({ isMemorized: true });
    expect(
      shouldFlagNeedsAttention(progress, NEEDS_ATTENTION_THRESHOLD),
    ).toBe(true);
    expect(
      shouldFlagNeedsAttention(progress, NEEDS_ATTENTION_THRESHOLD - 1),
    ).toBe(false);
  });

  it('flags a memorized passage immediately after a failed recall', () => {
    expect(
      shouldFlagNeedsAttention(
        progressFor({ isMemorized: true, lastRating: 'again' }),
        5,
      ),
    ).toBe(true);
  });

  it('clears after three consecutive good recalls', () => {
    expect(
      shouldFlagNeedsAttention(
        progressFor({
          isMemorized: true,
          consecutiveSuccesses: 3,
          lastRating: 'good',
        }),
        NEEDS_ATTENTION_THRESHOLD - 10,
      ),
    ).toBe(false);
  });
});

describe('difficultyBand', () => {
  it('splits the score into three plain-language bands', () => {
    expect(difficultyBand(0)).toBe('low');
    expect(difficultyBand(29)).toBe('low');
    expect(difficultyBand(30)).toBe('moderate');
    expect(difficultyBand(59)).toBe('moderate');
    expect(difficultyBand(60)).toBe('high');
  });
});

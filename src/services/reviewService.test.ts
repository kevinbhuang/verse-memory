import { describe, expect, it } from 'vitest';
import { addDays, differenceInCalendarDays, startOfDay } from 'date-fns';
import { getDataStore } from '@/repositories';
import { requireVerse } from '@/data/verses';
import { tokenize } from '@/lib/text/tokenize';
import { getProgress, setMemorized } from './progressService';
import { getReviewHistory, recordReview } from './reviewService';
import type { ModeResult } from '@/types';

const NOW = new Date('2026-05-04T10:00:00.000Z');
const SETTINGS = { maximumIntervalDays: 365, difficultVerseIntervalDays: 7 };

const result = (overrides: Partial<ModeResult> = {}): ModeResult => ({
  mode: 'first-letter',
  accuracy: 1,
  elapsedMs: 12_000,
  incorrectCount: 0,
  hintCount: 0,
  fullRevealUsed: false,
  wordErrors: [],
  suggestedRating: 'good',
  ...overrides,
});

describe('recordReview', () => {
  it('writes one immutable log entry describing the scheduling decision', async () => {
    const { log } = await recordReview({
      verseId: 'verse-001',
      rating: 'good',
      result: result({ accuracy: 0.94, elapsedMs: 31_000, hintCount: 1 }),
      settings: SETTINGS,
      now: NOW,
    });

    expect(log).toMatchObject({
      verseId: 'verse-001',
      mode: 'first-letter',
      rating: 'good',
      accuracy: 0.94,
      elapsedMs: 31_000,
      hintCount: 1,
      previousIntervalDays: 0,
      nextIntervalDays: 1,
    });
    expect(await getDataStore().reviewLogs.forVerse('verse-001')).toHaveLength(1);
  });

  it('advances the schedule and the counters together', async () => {
    const { progress } = await recordReview({
      verseId: 'verse-002',
      rating: 'good',
      result: result(),
      settings: SETTINGS,
      now: NOW,
    });

    expect(progress).toMatchObject({
      status: 'learning',
      reviewCount: 1,
      successCount: 1,
      consecutiveSuccesses: 1,
      lapseCount: 0,
      lastRating: 'good',
      intervalDays: 1,
      lastReviewedAt: NOW.toISOString(),
    });
    expect(progress.nextDueAt).toBe(addDays(startOfDay(NOW), 1).toISOString());
  });

  it('climbs the interval ladder over successive good recalls', async () => {
    const intervals: number[] = [];
    let day = NOW;

    for (let i = 0; i < 5; i += 1) {
      const { progress } = await recordReview({
        verseId: 'verse-003',
        rating: 'good',
        result: result(),
        settings: SETTINGS,
        now: day,
      });
      intervals.push(progress.intervalDays);
      day = addDays(day, progress.intervalDays);
    }

    expect(intervals).toEqual([1, 3, 7, 14, 30]);
  });

  it('treats Again as a lapse and returns the passage to a short interval', async () => {
    let day = NOW;
    for (let i = 0; i < 3; i += 1) {
      const { progress } = await recordReview({
        verseId: 'verse-004',
        rating: 'good',
        result: result(),
        settings: SETTINGS,
        now: day,
      });
      day = addDays(day, progress.intervalDays);
    }

    const { progress } = await recordReview({
      verseId: 'verse-004',
      rating: 'again',
      result: result({ accuracy: 0.4 }),
      settings: SETTINGS,
      now: day,
    });

    expect(progress.lapseCount).toBe(1);
    expect(progress.consecutiveSuccesses).toBe(0);
    expect(progress.intervalDays).toBeLessThanOrEqual(1);
    expect(differenceInCalendarDays(new Date(progress.nextDueAt!), day)).toBe(1);
  });

  it('never schedules a review in the past', async () => {
    for (const rating of ['again', 'hard', 'good', 'easy'] as const) {
      const { progress } = await recordReview({
        verseId: 'verse-005',
        rating,
        result: result(),
        settings: SETTINGS,
        now: NOW,
      });
      expect(
        new Date(progress.nextDueAt!).getTime(),
      ).toBeGreaterThanOrEqual(startOfDay(NOW).getTime());
    }
  });

  it('keeps a difficult passage on a short leash until three good recalls', async () => {
    // A mature passage the reader has just flagged as difficult: it should not
    // be allowed to jump straight back to a months-long interval.
    await setMemorized('verse-006', true, NOW);
    await getDataStore().progress.put({
      ...(await getProgress('verse-006')),
      isDifficult: true,
      intervalStep: 5,
      intervalDays: 60,
      consecutiveSuccesses: 0,
    });

    let day = NOW;
    const intervals: number[] = [];
    for (let i = 0; i < 3; i += 1) {
      const { progress } = await recordReview({
        verseId: 'verse-006',
        rating: 'easy',
        result: result(),
        settings: SETTINGS,
        now: day,
      });
      intervals.push(progress.intervalDays);
      day = addDays(day, progress.intervalDays);
    }

    expect(intervals[0]).toBe(SETTINGS.difficultVerseIntervalDays);
    expect(intervals[1]).toBe(SETTINGS.difficultVerseIntervalDays);
    expect(intervals[2]).toBeGreaterThan(SETTINGS.difficultVerseIntervalDays);
  });

  it('folds word mistakes into the weak-word statistics', async () => {
    const verse = requireVerse('verse-007');
    const words = tokenize(verse.text);

    await recordReview({
      verseId: 'verse-007',
      rating: 'hard',
      result: result({
        accuracy: 0.8,
        wordErrors: [
          {
            wordIndex: 2,
            expected: words[2].text,
            received: 'wrong',
            errorType: 'incorrect',
          },
          {
            wordIndex: 3,
            expected: words[3].text,
            received: null,
            errorType: 'hint',
          },
        ],
      }),
      settings: SETTINGS,
      now: NOW,
    });

    const stats = await getDataStore().wordStats.forVerse('verse-007');
    expect(stats.find((stat) => stat.wordIndex === 2)).toMatchObject({
      misses: 1,
      substitutions: 1,
    });
    expect(stats.find((stat) => stat.wordIndex === 3)?.hints).toBe(1);
  });

  it('recomputes the difficulty score with explanations attached', async () => {
    const { progress } = await recordReview({
      verseId: 'verse-008',
      rating: 'again',
      result: result({
        accuracy: 0.35,
        hintCount: 4,
        incorrectCount: 9,
        fullRevealUsed: true,
      }),
      settings: SETTINGS,
      now: NOW,
    });

    expect(progress.difficultyScore).toBeGreaterThan(0);
    expect(progress.difficultyReasons.length).toBeGreaterThan(0);
  });

  it('raises Needs Attention on a memorized passage that was just failed', async () => {
    await setMemorized('verse-009', true, NOW);
    const { progress } = await recordReview({
      verseId: 'verse-009',
      rating: 'again',
      result: result({ accuracy: 0.2 }),
      settings: SETTINGS,
      now: NOW,
    });

    expect(progress.status).toBe('needs-attention');
  });

  it('clears Needs Attention again after sustained improvement', async () => {
    await setMemorized('verse-010', true, NOW);
    let day = NOW;

    const failed = await recordReview({
      verseId: 'verse-010',
      rating: 'again',
      result: result({ accuracy: 0.2 }),
      settings: SETTINGS,
      now: day,
    });
    expect(failed.progress.status).toBe('needs-attention');

    let status = failed.progress.status;
    for (let i = 0; i < 4; i += 1) {
      day = addDays(day, 30);
      const { progress } = await recordReview({
        verseId: 'verse-010',
        rating: 'easy',
        result: result(),
        settings: SETTINGS,
        now: day,
      });
      status = progress.status;
    }

    expect(status).toBe('memorized');
  });

  it('accumulates total time spent on a passage', async () => {
    await recordReview({
      verseId: 'verse-011',
      rating: 'good',
      result: result({ elapsedMs: 10_000 }),
      settings: SETTINGS,
      now: NOW,
    });
    await recordReview({
      verseId: 'verse-011',
      rating: 'good',
      result: result({ elapsedMs: 5_000 }),
      settings: SETTINGS,
      now: addDays(NOW, 1),
    });

    expect((await getProgress('verse-011')).totalElapsedMs).toBe(15_000);
  });

  it('honours a per-passage maximum interval', async () => {
    await getDataStore().progress.put({
      ...(await getProgress('verse-012')),
      customMaximumIntervalDays: 14,
    });

    let day = NOW;
    for (let i = 0; i < 6; i += 1) {
      const { progress } = await recordReview({
        verseId: 'verse-012',
        rating: 'easy',
        result: result(),
        settings: SETTINGS,
        now: day,
      });
      expect(progress.intervalDays).toBeLessThanOrEqual(14);
      day = addDays(day, progress.intervalDays);
    }
  });

  it('honours a pinned review frequency', async () => {
    await getDataStore().progress.put({
      ...(await getProgress('verse-013')),
      isPinned: true,
      pinnedFrequencyDays: 7,
    });

    let day = NOW;
    for (let i = 0; i < 4; i += 1) {
      const { progress } = await recordReview({
        verseId: 'verse-013',
        rating: 'easy',
        result: result(),
        settings: SETTINGS,
        now: day,
      });
      expect(progress.intervalDays).toBe(7);
      day = addDays(day, 7);
    }
  });
});

describe('getReviewHistory', () => {
  it('returns the most recent review first', async () => {
    for (const [index, rating] of (['good', 'hard', 'again'] as const).entries()) {
      await recordReview({
        verseId: 'verse-014',
        rating,
        result: result(),
        settings: SETTINGS,
        now: addDays(NOW, index),
      });
    }

    const history = await getReviewHistory('verse-014');
    expect(history.map((log) => log.rating)).toEqual(['again', 'hard', 'good']);
  });
});

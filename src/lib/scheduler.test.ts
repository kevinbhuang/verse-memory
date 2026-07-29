import { describe, expect, it } from 'vitest';
import { addDays, differenceInCalendarDays, startOfDay, subDays } from 'date-fns';
import {
  INTERVAL_LADDER,
  DEFAULT_SCHEDULER_SETTINGS,
  daysOverdue,
  dueState,
  intervalForStep,
  isDue,
  previewIntervals,
  recommendationReason,
  schedule,
  withManualDueDate,
} from './scheduler';
import { createDefaultProgress } from '@/db/defaults';
import type { VerseProgress } from '@/types';

const NOW = new Date('2026-03-10T09:00:00.000Z');

function progressWith(overrides: Partial<VerseProgress> = {}): VerseProgress {
  return { ...createDefaultProgress('verse-001', NOW), ...overrides };
}

const daysUntil = (iso: string) =>
  differenceInCalendarDays(new Date(iso), startOfDay(NOW));

describe('the interval ladder', () => {
  it('is the documented sequence', () => {
    expect([...INTERVAL_LADDER]).toEqual([1, 3, 7, 14, 30, 60, 120, 180, 365]);
  });

  it('clamps steps to the ends of the ladder', () => {
    expect(intervalForStep(-5)).toBe(1);
    expect(intervalForStep(0)).toBe(1);
    expect(intervalForStep(3)).toBe(14);
    expect(intervalForStep(99)).toBe(365);
  });
});

describe('schedule', () => {
  it('advances one rung on Good', () => {
    const outcome = schedule(progressWith({ intervalStep: 2 }), 'good', NOW);
    expect(outcome.intervalStep).toBe(3);
    expect(outcome.intervalDays).toBe(14);
    expect(daysUntil(outcome.nextDueAt)).toBe(14);
    expect(outcome.consecutiveSuccesses).toBe(1);
    expect(outcome.successCount).toBe(1);
  });

  it('advances two rungs on Easy', () => {
    const outcome = schedule(progressWith({ intervalStep: 2 }), 'easy', NOW);
    expect(outcome.intervalStep).toBe(4);
    expect(outcome.intervalDays).toBe(30);
  });

  it('holds the interval on Hard and does not count a success', () => {
    const outcome = schedule(progressWith({ intervalStep: 3 }), 'hard', NOW);
    expect(outcome.intervalStep).toBe(3);
    expect(outcome.intervalDays).toBe(14);
    expect(outcome.consecutiveSuccesses).toBe(0);
    expect(outcome.successCount).toBe(0);
  });

  it('returns a failed passage to one day and records the lapse', () => {
    const outcome = schedule(
      progressWith({ intervalStep: 6, consecutiveSuccesses: 4, lapseCount: 1 }),
      'again',
      NOW,
    );
    expect(outcome.intervalDays).toBe(1);
    expect(outcome.intervalStep).toBe(0);
    expect(outcome.lapseCount).toBe(2);
    expect(outcome.consecutiveSuccesses).toBe(0);
  });

  it('never schedules a date in the past', () => {
    for (const rating of ['again', 'hard', 'good', 'easy'] as const) {
      const outcome = schedule(progressWith({ intervalStep: 8 }), rating, NOW);
      expect(new Date(outcome.nextDueAt).getTime()).toBeGreaterThan(
        NOW.getTime(),
      );
    }
  });

  it('caps a memorized passage at the global maximum interval', () => {
    const outcome = schedule(
      progressWith({ intervalStep: 8, isMemorized: true, status: 'memorized' }),
      'easy',
      NOW,
      { maximumIntervalDays: 90, difficultVerseIntervalDays: 7 },
    );
    expect(outcome.intervalDays).toBe(90);
    expect(outcome.appliedCap).toBe('global-maximum');
  });

  it('caps a passage at its own maximum interval', () => {
    const outcome = schedule(
      progressWith({
        intervalStep: 5,
        customMaximumIntervalDays: 21,
        isMemorized: true,
        status: 'memorized',
      }),
      'good',
      NOW,
    );
    expect(outcome.intervalDays).toBe(21);
    expect(outcome.appliedCap).toBe('verse-maximum');
  });

  it('keeps a difficult passage on a short interval until three clean reviews', () => {
    let progress = progressWith({
      isDifficult: true,
      isMemorized: true,
      status: 'needs-attention',
      intervalStep: 4,
    });

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const outcome = schedule(progress, 'good', NOW);
      expect(outcome.intervalDays).toBeLessThanOrEqual(
        DEFAULT_SCHEDULER_SETTINGS.difficultVerseIntervalDays,
      );
      expect(outcome.appliedCap).toBe('difficult-verse');
      progress = {
        ...progress,
        intervalStep: outcome.intervalStep,
        consecutiveSuccesses: outcome.consecutiveSuccesses,
        status: outcome.status,
      };
    }

    const third = schedule(progress, 'good', NOW);
    expect(third.consecutiveSuccesses).toBe(3);
    expect(third.intervalDays).toBeGreaterThan(
      DEFAULT_SCHEDULER_SETTINGS.difficultVerseIntervalDays,
    );
  });

  it('clears Needs Attention only after sustained improvement', () => {
    const struggling = progressWith({
      isMemorized: true,
      status: 'needs-attention',
      consecutiveSuccesses: 1,
    });
    expect(schedule(struggling, 'good', NOW).status).toBe('needs-attention');

    const recovered = { ...struggling, consecutiveSuccesses: 2 };
    expect(schedule(recovered, 'good', NOW).status).toBe('memorized');
  });

  it('sends a failed memorized passage to Needs Attention', () => {
    const outcome = schedule(
      progressWith({ isMemorized: true, status: 'memorized' }),
      'again',
      NOW,
    );
    expect(outcome.status).toBe('needs-attention');
  });

  it('honours a pinned review cadence', () => {
    const outcome = schedule(
      progressWith({
        pinnedFrequencyDays: 7,
        isPinned: true,
        intervalStep: 7,
        isMemorized: true,
        status: 'memorized',
      }),
      'easy',
      NOW,
    );
    expect(outcome.intervalDays).toBe(7);
    expect(outcome.appliedCap).toBe('pinned-frequency');
  });

  it('explains what it did', () => {
    const outcome = schedule(progressWith({ intervalStep: 1 }), 'good', NOW);
    expect(outcome.explanation).toContain('Good');
  });
});

describe('previewIntervals', () => {
  it('offers a longer interval for Easy than for Good', () => {
    const preview = previewIntervals(progressWith({ intervalStep: 2 }), NOW);
    expect(preview.again).toBe(1);
    expect(preview.hard).toBeLessThanOrEqual(preview.good);
    expect(preview.good).toBeLessThan(preview.easy);
  });
});

describe('due state', () => {
  it('describes new, due, overdue and scheduled passages', () => {
    expect(dueState(progressWith(), NOW)).toBe('new');
    expect(
      dueState(progressWith({ nextDueAt: NOW.toISOString() }), NOW),
    ).toBe('due');
    expect(
      dueState(
        progressWith({ nextDueAt: subDays(NOW, 3).toISOString() }),
        NOW,
      ),
    ).toBe('overdue');
    expect(
      dueState(progressWith({ nextDueAt: addDays(NOW, 4).toISOString() }), NOW),
    ).toBe('scheduled');
  });

  it('counts a due or overdue passage as reviewable now', () => {
    expect(isDue(progressWith({ nextDueAt: NOW.toISOString() }), NOW)).toBe(true);
    expect(
      isDue(progressWith({ nextDueAt: addDays(NOW, 1).toISOString() }), NOW),
    ).toBe(false);
  });

  it('measures how overdue a passage is', () => {
    expect(
      daysOverdue(
        progressWith({ nextDueAt: subDays(NOW, 5).toISOString() }),
        NOW,
      ),
    ).toBe(5);
    expect(daysOverdue(progressWith(), NOW)).toBe(0);
  });
});

describe('withManualDueDate', () => {
  it('accepts a future date', () => {
    const result = withManualDueDate(addDays(NOW, 10), NOW);
    expect(daysUntil(result.nextDueAt as string)).toBe(10);
  });

  it('never accepts a date in the past', () => {
    const result = withManualDueDate(subDays(NOW, 10), NOW);
    expect(daysUntil(result.nextDueAt as string)).toBe(0);
  });
});

describe('recommendationReason', () => {
  it('explains why a passage is being shown', () => {
    const reason = recommendationReason(
      progressWith({
        nextDueAt: subDays(NOW, 2).toISOString(),
        isDifficult: true,
        lastRating: 'again',
      }),
      NOW,
    );
    expect(reason).toContain('2 days overdue');
    expect(reason).toContain('marked Needs Review');
    expect(reason).toContain('failed at the last review');
  });

  it('falls back to a plain description for a healthy passage', () => {
    expect(
      recommendationReason(
        progressWith({ nextDueAt: addDays(NOW, 20).toISOString() }),
        NOW,
      ),
    ).toContain('Scheduled for');
  });
});

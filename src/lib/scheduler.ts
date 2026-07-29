import { addDays, differenceInCalendarDays, startOfDay } from 'date-fns';
import type { Rating, Settings, VerseProgress, VerseStatus } from '@/types';

/**
 * A deliberately transparent review ladder.
 *
 * This is not FSRS and does not claim to be. Every interval a passage can be
 * given is one of these values, which makes the schedule easy to predict and
 * easy to explain in the interface.
 */
export const INTERVAL_LADDER = [1, 3, 7, 14, 30, 60, 120, 180, 365] as const;

export const MAX_STEP = INTERVAL_LADDER.length - 1;

/** Consecutive good/easy ratings needed before a struggling passage relaxes. */
export const RECOVERY_SUCCESSES = 3;

export type SchedulerSettings = Pick<
  Settings,
  'maximumIntervalDays' | 'difficultVerseIntervalDays'
>;

export const DEFAULT_SCHEDULER_SETTINGS: SchedulerSettings = {
  maximumIntervalDays: 365,
  difficultVerseIntervalDays: 7,
};

export type IntervalCap =
  | 'none'
  | 'pinned-frequency'
  | 'verse-maximum'
  | 'global-maximum'
  | 'difficult-verse';

export type ScheduleOutcome = {
  intervalDays: number;
  intervalStep: number;
  nextDueAt: string;
  status: VerseStatus;
  consecutiveSuccesses: number;
  successCount: number;
  lapseCount: number;
  reviewCount: number;
  appliedCap: IntervalCap;
  explanation: string;
};

export function intervalForStep(step: number): number {
  const clamped = Math.max(0, Math.min(MAX_STEP, Math.round(step)));
  return INTERVAL_LADDER[clamped];
}

function stepAfterRating(current: number, rating: Rating): number {
  switch (rating) {
    case 'again':
      // Failed recall drops the passage back to the bottom of the ladder.
      return 0;
    case 'hard':
      // Held at the current rung rather than advanced.
      return Math.max(0, Math.min(MAX_STEP, current));
    case 'good':
      return Math.min(MAX_STEP, current + 1);
    case 'easy':
      return Math.min(MAX_STEP, current + 2);
  }
}

function isSuccess(rating: Rating): boolean {
  return rating === 'good' || rating === 'easy';
}

function deriveStatus(
  progress: VerseProgress,
  rating: Rating,
  consecutiveSuccesses: number,
): VerseStatus {
  if (!progress.isMemorized) {
    // A passage the reader has not yet claimed stays in the learning stage,
    // and a failed attempt on a flagged passage is worth surfacing.
    if (rating === 'again' && progress.isDifficult) return 'needs-attention';
    return 'learning';
  }

  if (rating === 'again') return 'needs-attention';

  if (progress.status === 'needs-attention') {
    return consecutiveSuccesses >= RECOVERY_SUCCESSES
      ? 'memorized'
      : 'needs-attention';
  }

  return 'memorized';
}

/**
 * Applies a rating to a passage and returns its next schedule.
 *
 * The function is pure: callers persist the result. Keeping every scheduling
 * decision here is what makes the algorithm replaceable later.
 */
export function schedule(
  progress: VerseProgress,
  rating: Rating,
  now: Date = new Date(),
  settings: SchedulerSettings = DEFAULT_SCHEDULER_SETTINGS,
): ScheduleOutcome {
  const success = isSuccess(rating);
  const consecutiveSuccesses = success ? progress.consecutiveSuccesses + 1 : 0;
  const nextStep = stepAfterRating(progress.intervalStep, rating);

  let intervalDays = intervalForStep(nextStep);
  let appliedCap: IntervalCap = 'none';

  const notes: string[] = [];

  switch (rating) {
    case 'again':
      notes.push('Rated Again, so the passage returns to a one-day interval.');
      break;
    case 'hard':
      notes.push('Rated Hard, so the interval is held rather than advanced.');
      break;
    case 'good':
      notes.push('Rated Good, so the interval advances one step.');
      break;
    case 'easy':
      notes.push('Rated Easy, so the interval advances two steps.');
      break;
  }

  if (progress.pinnedFrequencyDays !== null) {
    intervalDays = success
      ? progress.pinnedFrequencyDays
      : Math.min(intervalDays, progress.pinnedFrequencyDays);
    appliedCap = 'pinned-frequency';
    notes.push(
      `Pinned to a ${progress.pinnedFrequencyDays}-day review cadence.`,
    );
  }

  const strugglingDifficult =
    (progress.isDifficult || progress.status === 'needs-attention') &&
    consecutiveSuccesses < RECOVERY_SUCCESSES;

  if (strugglingDifficult && intervalDays > settings.difficultVerseIntervalDays) {
    intervalDays = settings.difficultVerseIntervalDays;
    appliedCap = 'difficult-verse';
    notes.push(
      `Held at ${settings.difficultVerseIntervalDays} days until ${RECOVERY_SUCCESSES} consecutive Good or Easy ratings (currently ${consecutiveSuccesses}).`,
    );
  }

  if (
    progress.customMaximumIntervalDays !== null &&
    intervalDays > progress.customMaximumIntervalDays
  ) {
    intervalDays = progress.customMaximumIntervalDays;
    appliedCap = 'verse-maximum';
    notes.push(
      `Capped by this passage's maximum interval of ${progress.customMaximumIntervalDays} days.`,
    );
  }

  if (intervalDays > settings.maximumIntervalDays) {
    intervalDays = settings.maximumIntervalDays;
    appliedCap = 'global-maximum';
    notes.push(
      `Capped by the ${settings.maximumIntervalDays}-day maximum interval in settings.`,
    );
  }

  intervalDays = Math.max(1, Math.round(intervalDays));

  // A due date is always in the future: intervals are counted from the start
  // of today, and the smallest interval is a full day.
  const nextDue = addDays(startOfDay(now), intervalDays);

  return {
    intervalDays,
    intervalStep: nextStep,
    nextDueAt: nextDue.toISOString(),
    status: deriveStatus(progress, rating, consecutiveSuccesses),
    consecutiveSuccesses,
    successCount: progress.successCount + (success ? 1 : 0),
    lapseCount: progress.lapseCount + (rating === 'again' ? 1 : 0),
    reviewCount: progress.reviewCount + 1,
    appliedCap,
    explanation: notes.join(' '),
  };
}

/** The interval each rating would produce, for display before choosing. */
export function previewIntervals(
  progress: VerseProgress,
  now: Date = new Date(),
  settings: SchedulerSettings = DEFAULT_SCHEDULER_SETTINGS,
): Record<Rating, number> {
  return {
    again: schedule(progress, 'again', now, settings).intervalDays,
    hard: schedule(progress, 'hard', now, settings).intervalDays,
    good: schedule(progress, 'good', now, settings).intervalDays,
    easy: schedule(progress, 'easy', now, settings).intervalDays,
  };
}

export type DueState = 'new' | 'due' | 'overdue' | 'scheduled';

export function dueState(
  progress: Pick<VerseProgress, 'nextDueAt'>,
  now: Date = new Date(),
): DueState {
  if (!progress.nextDueAt) return 'new';
  const days = differenceInCalendarDays(
    startOfDay(new Date(progress.nextDueAt)),
    startOfDay(now),
  );
  if (days < 0) return 'overdue';
  if (days === 0) return 'due';
  return 'scheduled';
}

export function isDue(
  progress: Pick<VerseProgress, 'nextDueAt'>,
  now: Date = new Date(),
): boolean {
  const state = dueState(progress, now);
  return state === 'due' || state === 'overdue';
}

export function daysOverdue(
  progress: Pick<VerseProgress, 'nextDueAt'>,
  now: Date = new Date(),
): number {
  if (!progress.nextDueAt) return 0;
  const days = differenceInCalendarDays(
    startOfDay(now),
    startOfDay(new Date(progress.nextDueAt)),
  );
  return Math.max(0, days);
}

/** Sets an explicit due date, used by the manual override control. */
export function withManualDueDate(
  dueDate: Date,
  now: Date = new Date(),
): Pick<VerseProgress, 'nextDueAt' | 'intervalDays' | 'updatedAt'> {
  const target = startOfDay(dueDate);
  const today = startOfDay(now);
  const safeTarget = target < today ? today : target;
  return {
    nextDueAt: safeTarget.toISOString(),
    intervalDays: Math.max(0, differenceInCalendarDays(safeTarget, today)),
    updatedAt: now.toISOString(),
  };
}

/** Human-readable answer to "why is this being recommended?". */
export function recommendationReason(
  progress: VerseProgress,
  now: Date = new Date(),
): string {
  const state = dueState(progress, now);
  const reasons: string[] = [];

  if (state === 'overdue') {
    const days = daysOverdue(progress, now);
    reasons.push(`${days} day${days === 1 ? '' : 's'} overdue`);
  } else if (state === 'due') {
    reasons.push('due today');
  } else if (state === 'new') {
    reasons.push('never reviewed');
  }

  if (progress.isDifficult) reasons.push('marked Needs Review');
  if (progress.status === 'needs-attention') reasons.push('needs review');
  if (progress.lastRating === 'again') reasons.push('failed at the last review');
  if (progress.pinnedFrequencyDays !== null) {
    reasons.push(`pinned to every ${progress.pinnedFrequencyDays} days`);
  }
  if (progress.difficultyScore >= 60) {
    reasons.push(`difficulty score ${Math.round(progress.difficultyScore)}`);
  }

  if (reasons.length === 0) {
    return progress.nextDueAt
      ? `Scheduled for ${new Date(progress.nextDueAt).toLocaleDateString()}`
      : 'Not yet scheduled';
  }

  return reasons.join(' \u00b7 ');
}

import type { ReviewLog, VerseProgress, WordStat } from '@/types';
import { daysOverdue } from './scheduler';

/**
 * Difficulty scoring is intentionally arithmetic and inspectable: every point
 * a passage earns comes from a named factor that the interface can show, so
 * "why is this hard?" always has a concrete answer.
 */
export type DifficultyFactor = {
  key: string;
  label: string;
  points: number;
  maxPoints: number;
  detail: string;
};

export type DifficultyAssessment = {
  score: number;
  factors: DifficultyFactor[];
  /** Short factor labels stored on the progress record. */
  reasons: string[];
};

const RECENT_WINDOW = 8;

export function assessDifficulty(
  progress: VerseProgress,
  logs: ReviewLog[],
  wordStats: WordStat[] = [],
  now: Date = new Date(),
): DifficultyAssessment {
  const recent = [...logs]
    .sort(
      (a, b) =>
        new Date(b.reviewedAt).getTime() - new Date(a.reviewedAt).getTime(),
    )
    .slice(0, RECENT_WINDOW);

  const factors: DifficultyFactor[] = [];

  const addFactor = (
    key: string,
    label: string,
    points: number,
    maxPoints: number,
    detail: string,
  ) => {
    if (points <= 0) return;
    factors.push({
      key,
      label,
      points: Math.round(Math.min(points, maxPoints) * 10) / 10,
      maxPoints,
      detail,
    });
  };

  // Lapses: the clearest signal that a passage is not retained.
  addFactor(
    'lapses',
    'Failed recalls',
    progress.lapseCount * 6,
    20,
    `${progress.lapseCount} rating${progress.lapseCount === 1 ? '' : 's'} of Again`,
  );

  // Recent accuracy across graded modes.
  const graded = recent.filter((log) => log.accuracy !== null);
  if (graded.length > 0) {
    const average =
      graded.reduce((sum, log) => sum + (log.accuracy ?? 0), 0) / graded.length;
    addFactor(
      'accuracy',
      'Recent accuracy',
      (1 - average) * 40,
      18,
      `${Math.round(average * 100)}% average across the last ${graded.length} graded review${graded.length === 1 ? '' : 's'}`,
    );
  }

  // Hints and full reveals.
  if (recent.length > 0) {
    const hints = recent.reduce((sum, log) => sum + log.hintCount, 0);
    const perReview = hints / recent.length;
    addFactor(
      'hints',
      'Hint usage',
      perReview * 4,
      12,
      `${hints} hint${hints === 1 ? '' : 's'} across the last ${recent.length} review${recent.length === 1 ? '' : 's'}`,
    );

    const reveals = recent.filter((log) => log.fullRevealUsed).length;
    addFactor(
      'reveals',
      'Full reveals',
      reveals * 5,
      10,
      `${reveals} review${reveals === 1 ? '' : 's'} needed the whole passage revealed`,
    );

    const incorrect = recent.reduce((sum, log) => sum + log.incorrectCount, 0);
    addFactor(
      'keystrokes',
      'Incorrect entries',
      (incorrect / recent.length) * 1.5,
      12,
      `${incorrect} incorrect entr${incorrect === 1 ? 'y' : 'ies'} recently`,
    );

    const hardRatings = recent.filter((log) => log.rating === 'hard').length;
    addFactor(
      'hard-ratings',
      'Hard ratings',
      hardRatings * 3,
      9,
      `${hardRatings} recent Hard rating${hardRatings === 1 ? '' : 's'}`,
    );

    // Slow recall, measured per word so long passages are not penalised.
    const timed = recent.filter((log) => log.elapsedMs > 0);
    if (timed.length > 0) {
      const averageMs =
        timed.reduce((sum, log) => sum + log.elapsedMs, 0) / timed.length;
      const seconds = averageMs / 1000;
      addFactor(
        'response-time',
        'Response time',
        Math.max(0, (seconds - 45) / 15) * 2,
        8,
        `${Math.round(seconds)}s average review time`,
      );
    }
  }

  // Words missed repeatedly.
  const repeatedWords = wordStats.filter((stat) => stat.misses >= 2);
  addFactor(
    'weak-words',
    'Repeated word errors',
    repeatedWords.length * 2.5,
    12,
    repeatedWords.length > 0
      ? `${repeatedWords.length} word${repeatedWords.length === 1 ? '' : 's'} missed more than once${
          repeatedWords.length <= 4
            ? ` (${repeatedWords.map((stat) => stat.word).join(', ')})`
            : ''
        }`
      : '',
  );

  const overdue = daysOverdue(progress, now);
  addFactor(
    'overdue',
    'Days overdue',
    overdue * 0.8,
    10,
    `${overdue} day${overdue === 1 ? '' : 's'} past its due date`,
  );

  if (progress.isDifficult) {
    addFactor(
      'manual-flag',
      'Marked difficult',
      12,
      12,
      'You flagged this passage as difficult',
    );
  }

  const score = Math.round(
    Math.max(
      0,
      Math.min(
        100,
        factors.reduce((sum, factor) => sum + factor.points, 0),
      ),
    ),
  );

  return {
    score,
    factors: factors.sort((a, b) => b.points - a.points),
    reasons: factors
      .filter((factor) => factor.points >= 3)
      .map((factor) => factor.label),
  };
}

export const NEEDS_ATTENTION_THRESHOLD = 45;

/**
 * An automatic Needs Attention status may clear once performance recovers,
 * but a manual difficult flag is never removed by the app.
 */
export function shouldFlagNeedsAttention(
  progress: VerseProgress,
  score: number,
): boolean {
  if (!progress.isMemorized) return false;
  if (progress.consecutiveSuccesses >= 3 && score < NEEDS_ATTENTION_THRESHOLD) {
    return false;
  }
  return score >= NEEDS_ATTENTION_THRESHOLD || progress.lastRating === 'again';
}

export function difficultyBand(score: number): 'low' | 'moderate' | 'high' {
  if (score >= 60) return 'high';
  if (score >= 30) return 'moderate';
  return 'low';
}

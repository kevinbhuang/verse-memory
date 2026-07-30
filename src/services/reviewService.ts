import { getDataStore } from '@/repositories';
import { requireVerse } from '@/data/verses';
import {
  assessDifficulty,
  shouldFlagNeedsAttention,
} from '@/lib/difficulty';
import { schedule } from '@/lib/scheduler';
import { applyWordErrors } from '@/lib/weakWords';
import { createId } from '@/lib/id';
import type {
  ModeResult,
  Rating,
  ReviewLog,
  Settings,
  VerseProgress,
} from '@/types';
import { notifyLocalDataChanged } from '@/lib/localDataEvents';
import { getProgress } from './progressService';

const store = () => getDataStore();

export type RecordReviewInput = {
  verseId: string;
  rating: Rating;
  result: ModeResult;
  settings: Pick<Settings, 'maximumIntervalDays' | 'difficultVerseIntervalDays'>;
  sessionId?: string | null;
  now?: Date;
};

export type RecordReviewOutcome = {
  log: ReviewLog;
  progress: VerseProgress;
};

/**
 * The single write path for a completed review.
 *
 * It appends an immutable log entry, advances the schedule, folds word-level
 * mistakes into the weak-word statistics and recomputes difficulty, all from
 * one place so no caller can update half of it.
 */
export async function recordReview({
  verseId,
  rating,
  result,
  settings,
  sessionId = null,
  now = new Date(),
}: RecordReviewInput): Promise<RecordReviewOutcome> {
  const verse = requireVerse(verseId);
  const current = await getProgress(verseId);
  const outcome = schedule(current, rating, now, settings);

  const log: ReviewLog = {
    id: createId('log'),
    verseId,
    reviewedAt: now.toISOString(),
    mode: result.mode,
    rating,
    accuracy: result.accuracy,
    elapsedMs: result.elapsedMs,
    incorrectCount: result.incorrectCount,
    hintCount: result.hintCount,
    fullRevealUsed: result.fullRevealUsed,
    previousIntervalDays: current.intervalDays,
    nextIntervalDays: outcome.intervalDays,
    nextDueAt: outcome.nextDueAt,
    wordErrors: result.wordErrors,
    sessionId,
  };

  await store().reviewLogs.add(log);

  const existingStats = await store().wordStats.forVerse(verseId);
  const updatedStats = applyWordErrors(
    verseId,
    verse.text,
    existingStats,
    result.wordErrors,
    log.reviewedAt,
  );
  await store().wordStats.putMany(updatedStats);

  const logs = await store().reviewLogs.forVerse(verseId);

  const intermediate: VerseProgress = {
    ...current,
    status: outcome.status,
    lastReviewedAt: log.reviewedAt,
    nextDueAt: outcome.nextDueAt,
    intervalDays: outcome.intervalDays,
    intervalStep: outcome.intervalStep,
    reviewCount: outcome.reviewCount,
    successCount: outcome.successCount,
    lapseCount: outcome.lapseCount,
    consecutiveSuccesses: outcome.consecutiveSuccesses,
    lastRating: rating,
    totalElapsedMs: current.totalElapsedMs + Math.max(0, result.elapsedMs),
    updatedAt: now.toISOString(),
  };

  const assessment = assessDifficulty(intermediate, logs, updatedStats, now);

  const needsAttention = shouldFlagNeedsAttention(
    intermediate,
    assessment.score,
  );

  const next: VerseProgress = {
    ...intermediate,
    difficultyScore: assessment.score,
    difficultyReasons: assessment.reasons,
    status:
      intermediate.status === 'needs-attention' && !needsAttention
        ? intermediate.isMemorized
          ? 'memorized'
          : 'learning'
        : needsAttention && intermediate.isMemorized
          ? 'needs-attention'
          : intermediate.status,
  };

  await store().progress.put(next);
  notifyLocalDataChanged();

  return { log, progress: next };
}

export async function getReviewHistory(verseId: string): Promise<ReviewLog[]> {
  const logs = await store().reviewLogs.forVerse(verseId);
  return logs.sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt));
}

export async function getRecentLogs(sinceIso: string): Promise<ReviewLog[]> {
  return store().reviewLogs.since(sinceIso);
}

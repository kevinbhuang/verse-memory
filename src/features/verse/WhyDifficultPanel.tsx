import { assessDifficulty, difficultyBand } from '@/lib/difficulty';
import { ProgressBar } from '@/components/ui/ProgressBar';
import type { ReviewLog, VerseProgress, WordStat } from '@/types';

const bandLabels = {
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
} as const;

/**
 * Shows exactly which measurements produced the difficulty score. Nothing here
 * is inferred by a model; each row is an arithmetic factor.
 */
export function WhyDifficultPanel({
  progress,
  logs,
  wordStats,
}: {
  progress: VerseProgress;
  logs: ReviewLog[];
  wordStats: WordStat[];
}) {
  const assessment = assessDifficulty(progress, logs, wordStats);
  const band = difficultyBand(assessment.score);

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm text-ink-muted">
          {`Difficulty score ${assessment.score} of 100`}
        </p>
        <p className="text-sm font-medium text-ink">{bandLabels[band]}</p>
      </div>

      <ProgressBar
        value={assessment.score}
        label={`Difficulty score ${assessment.score} of 100`}
      />

      {assessment.factors.length === 0 ? (
        <p className="text-sm text-ink-muted">
          Nothing is currently counting against this passage. Difficulty is
          calculated from failed recalls, recent accuracy, hints, full reveals,
          incorrect entries, response time, repeated word errors, Hard ratings
          and how overdue it is.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--border-subtle)] text-sm">
          {assessment.factors.map((factor) => (
            <li
              key={factor.key}
              className="flex items-baseline justify-between gap-3 py-2"
            >
              <span className="min-w-0">
                <span className="block font-medium text-ink">
                  {factor.label}
                </span>
                <span className="block text-xs text-ink-muted">
                  {factor.detail}
                </span>
              </span>
              <span className="shrink-0 font-mono text-xs text-ink-muted tabular-nums">
                {`+${factor.points} / ${factor.maxPoints}`}
              </span>
            </li>
          ))}
        </ul>
      )}

      {progress.isDifficult ? (
        <p className="rounded-md bg-warning-soft px-3 py-2 text-xs text-warning">
          You marked this passage Needs Review. That mark stays until you clear
          it.
        </p>
      ) : null}
    </div>
  );
}

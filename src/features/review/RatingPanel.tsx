import clsx from 'clsx';
import { RATINGS, type Rating, type VerseProgress } from '@/types';
import { previewIntervals, type SchedulerSettings } from '@/lib/scheduler';
import { formatInterval } from '@/utils/format';

const RATING_LABELS: Record<Rating, string> = {
  again: 'Again',
  hard: 'Hard',
  good: 'Good',
  easy: 'Easy',
};

const RATING_HINTS: Record<Rating, string> = {
  again: 'Could not recall it',
  hard: 'Recalled with effort',
  good: 'Recalled correctly',
  easy: 'Effortless',
};

export function RatingPanel({
  progress,
  settings,
  suggested,
  onRate,
  disabled,
}: {
  progress: VerseProgress;
  settings: SchedulerSettings;
  suggested: Rating | null;
  onRate: (rating: Rating) => void;
  disabled?: boolean;
}) {
  const intervals = previewIntervals(progress, new Date(), settings);

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-ink">How well did you recall it?</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {RATINGS.map((rating, index) => (
          <button
            key={rating}
            type="button"
            disabled={disabled}
            onClick={() => onRate(rating)}
            className={clsx(
              'rounded-lg border px-3 py-2.5 text-left transition-colors disabled:opacity-50',
              suggested === rating
                ? 'border-accent bg-accent-soft'
                : 'border-line-strong bg-surface hover:bg-surface-muted',
            )}
          >
            <span className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-semibold text-ink">
                {RATING_LABELS[rating]}
              </span>
              <span className="font-mono text-xs text-ink-subtle">
                {index + 1}
              </span>
            </span>
            <span className="mt-0.5 block text-xs text-ink-muted">
              {RATING_HINTS[rating]}
            </span>
            <span className="mt-1 block text-xs font-medium text-accent">
              {formatInterval(intervals[rating])}
            </span>
          </button>
        ))}
      </div>
      {suggested ? (
        <p className="text-xs text-ink-muted">
          {`Suggested from this attempt: ${RATING_LABELS[suggested]}. Press 1\u20134 to rate.`}
        </p>
      ) : null}
    </div>
  );
}

import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { verses } from '@/data/verses';
import type { VerseProgress } from '@/types';

/**
 * Single-table progress view: every passage in collection order, with
 * Memorized / Needs Review toggles and soft status tinting.
 */
export function ProgressChart({
  progressById,
  onToggleMemorized,
  onToggleNeedsReview,
}: {
  progressById: Map<string, VerseProgress>;
  onToggleMemorized: (verseId: string, memorized: boolean) => void;
  onToggleNeedsReview: (verseId: string, needsReview: boolean) => void;
}) {
  return (
    <div
      className="overflow-hidden rounded-xl border border-line bg-surface"
      role="region"
      aria-label="Progress chart"
    >
      <table className="w-full border-collapse text-left">
        <thead className="sticky top-0 z-10 bg-surface-muted/95 backdrop-blur">
          <tr className="border-b border-line text-sm text-ink-muted">
            <th scope="col" className="w-14 px-4 py-3 font-medium tabular-nums">
              #
            </th>
            <th scope="col" className="w-28 px-3 py-3 text-center font-medium">
              Memorized
            </th>
            <th scope="col" className="w-32 px-3 py-3 text-center font-medium">
              Needs Review
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Passage
            </th>
          </tr>
        </thead>
        <tbody>
          {verses.map((verse) => {
            const progress = progressById.get(verse.id);
            const memorized = progress?.isMemorized ?? false;
            const needsReview = progress?.isDifficult ?? false;

            return (
              <tr
                key={verse.id}
                className={clsx(
                  'border-b border-line last:border-b-0',
                  memorized && 'bg-success-soft',
                  !memorized && needsReview && 'bg-warning-soft',
                )}
              >
                <td className="px-4 py-2.5 font-mono text-sm tabular-nums text-ink-subtle">
                  {String(verse.order).padStart(3, '0')}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--success)]"
                    checked={memorized}
                    onChange={(event) =>
                      onToggleMemorized(verse.id, event.target.checked)
                    }
                    aria-label={`Mark ${verse.reference} as memorized`}
                  />
                </td>
                <td className="px-3 py-2.5 text-center">
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--warning)]"
                    checked={needsReview}
                    onChange={(event) =>
                      onToggleNeedsReview(verse.id, event.target.checked)
                    }
                    aria-label={`Mark ${verse.reference} as Needs Review`}
                  />
                </td>
                <td className="px-4 py-2.5">
                  <Link
                    to={`/verses/${verse.id}`}
                    className="font-serif text-base font-semibold text-ink hover:text-accent hover:underline"
                  >
                    {verse.reference}
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

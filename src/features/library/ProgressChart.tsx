import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { verses } from '@/data/verses';
import { abbreviateReference } from '@/lib/text/reference';
import type { Verse } from '@/types';
import { STICKY_BELOW_APP_HEADER } from './LibraryCheckboxHeader';

const COLUMN_COUNT = 5;

export type ProgressChartRow = {
  verseId: string;
  isMemorized: boolean;
  isDifficult: boolean;
};

function splitIntoColumns(list: readonly Verse[], columns: number): Verse[][] {
  const size = Math.ceil(list.length / columns);
  return Array.from({ length: columns }, (_, index) =>
    list.slice(index * size, index * size + size),
  ).filter((column) => column.length > 0);
}

/**
 * Five-column progress table: every passage in collection order, with
 * Memorized / Needs Review toggles (or read-only indicators) and soft tinting.
 */
export function ProgressChart({
  progressById,
  onToggleMemorized,
  onToggleNeedsReview,
  readOnly = false,
}: {
  progressById: Map<string, ProgressChartRow>;
  onToggleMemorized?: (verseId: string, memorized: boolean) => void;
  onToggleNeedsReview?: (verseId: string, needsReview: boolean) => void;
  readOnly?: boolean;
}) {
  const columns = useMemo(
    () => splitIntoColumns(verses, COLUMN_COUNT),
    [],
  );

  return (
    <div role="region" aria-label="Progress chart">
      <div
        className={`${STICKY_BELOW_APP_HEADER} mb-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line py-1.5 text-sm text-ink-muted`}
      >
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block size-3 rounded-sm bg-success-soft ring-1 ring-success/25"
            aria-hidden="true"
          />
          Memorized
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block size-3 rounded-sm bg-warning-soft ring-1 ring-warning/25"
            aria-hidden="true"
          />
          Needs Review
        </span>
      </div>

      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {columns.map((column, columnIndex) => (
          <table
            key={columnIndex}
            className="w-full border-collapse bg-surface text-left"
          >
            <thead>
              <tr className="border-b border-line bg-surface-muted text-xs font-medium text-ink-muted">
                <th
                  scope="col"
                  className="w-8 px-1.5 py-1.5 text-center"
                  title="Memorized"
                >
                  M
                </th>
                <th
                  scope="col"
                  className="w-8 px-1.5 py-1.5 text-center"
                  title="Needs Review"
                >
                  NR
                </th>
                <th scope="col" className="px-2 py-1.5">
                  Passage
                </th>
              </tr>
            </thead>
            <tbody>
              {column.map((verse) => {
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
                    <td className="px-1.5 py-1 text-center align-middle">
                      <input
                        type="checkbox"
                        className="size-3.5 accent-[var(--success)]"
                        checked={memorized}
                        disabled={readOnly}
                        onChange={
                          readOnly || !onToggleMemorized
                            ? undefined
                            : (event) =>
                                onToggleMemorized(
                                  verse.id,
                                  event.target.checked,
                                )
                        }
                        aria-label={
                          readOnly
                            ? `${verse.reference}: ${memorized ? 'memorized' : 'not memorized'}`
                            : `Mark ${verse.reference} as memorized`
                        }
                      />
                    </td>
                    <td className="px-1.5 py-1 text-center align-middle">
                      <input
                        type="checkbox"
                        className="size-3.5 accent-[var(--warning)]"
                        checked={needsReview}
                        disabled={readOnly}
                        onChange={
                          readOnly || !onToggleNeedsReview
                            ? undefined
                            : (event) =>
                                onToggleNeedsReview(
                                  verse.id,
                                  event.target.checked,
                                )
                        }
                        aria-label={
                          readOnly
                            ? `${verse.reference}: ${needsReview ? 'Needs Review' : 'not Needs Review'}`
                            : `Mark ${verse.reference} as Needs Review`
                        }
                      />
                    </td>
                    <td className="px-2 py-1 align-middle">
                      {readOnly ? (
                        <span
                          className="block truncate font-serif text-sm font-semibold leading-snug text-ink"
                          title={verse.reference}
                        >
                          {abbreviateReference(verse.reference)}
                        </span>
                      ) : (
                        <Link
                          to={`/flashcards?verse=${verse.id}`}
                          className="block truncate font-serif text-sm font-semibold leading-snug text-ink hover:text-accent hover:underline"
                          title={verse.reference}
                        >
                          {abbreviateReference(verse.reference)}
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ))}
      </div>
    </div>
  );
}

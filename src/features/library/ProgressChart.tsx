import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { DECKS, type Deck } from '@/config/app';
import { versesInSection } from '@/data/verses';
import { abbreviateReference } from '@/lib/text/reference';
import type { Verse, VerseProgress } from '@/types';

const DECK_SHORT: Record<string, string> = {
  'Law and History': 'Law & Hist.',
  'Wisdom and Poetry': 'Wisdom',
  Prophets: 'Prophets',
  Gospels: 'Gospels',
  Acts: 'Acts',
  'Paul\u2019s Epistles': 'Paul',
  'General Epistles and Revelation': 'Gen. Ep. & Rev',
};

/** Approximate rendered height of one dense chart row (px). */
const ROW_HEIGHT_PX = 14;
/** Approximate height of a column header (px). */
const HEADER_HEIGHT_PX = 34;
/** Fallback when height cannot be measured yet. */
const DEFAULT_MAX_ROWS = 28;
/** Keep at least this many rows per column so tiny viewports still spill. */
const MIN_MAX_ROWS = 18;

type ChartColumn = {
  key: string;
  deck: Deck;
  verses: Verse[];
  memorizedCount: number;
  continuation: boolean;
  part: number;
  partCount: number;
};

function chunkVerses(verses: readonly Verse[], maxRows: number): Verse[][] {
  if (verses.length === 0) return [];
  if (verses.length <= maxRows) return [[...verses]];
  const parts: Verse[][] = [];
  for (let i = 0; i < verses.length; i += maxRows) {
    parts.push(verses.slice(i, i + maxRows));
  }
  return parts;
}

function buildColumns(
  progressById: Map<string, VerseProgress>,
  maxRows: number,
): ChartColumn[] {
  const columns: ChartColumn[] = [];

  for (const deck of DECKS) {
    const deckVerses = versesInSection(deck.section);
    let memorizedCount = 0;
    for (const verse of deckVerses) {
      if (progressById.get(verse.id)?.isMemorized) memorizedCount += 1;
    }

    const parts = chunkVerses(deckVerses, maxRows);
    parts.forEach((verses, index) => {
      columns.push({
        key: `${deck.section}-${index}`,
        deck,
        verses,
        memorizedCount,
        continuation: index > 0,
        part: index + 1,
        partCount: parts.length,
      });
    });
  }

  return columns;
}

/**
 * Dense all-collection progress grid: deck columns of abbreviated refs with
 * Memorized / Needs Review toggles. Tall decks spill into extra columns so
 * the chart stays within the viewport instead of scrolling.
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
  const [maxRows, setMaxRows] = useState(DEFAULT_MAX_ROWS);

  useEffect(() => {
    const updateFromViewport = () => {
      // Leave room for page chrome (header, tabs, strip, legend, footer/nav).
      const available = Math.max(280, window.innerHeight - 260);
      const rows = Math.floor((available - HEADER_HEIGHT_PX) / ROW_HEIGHT_PX);
      setMaxRows(Math.max(MIN_MAX_ROWS, rows || DEFAULT_MAX_ROWS));
    };

    updateFromViewport();
    window.addEventListener('resize', updateFromViewport);
    return () => window.removeEventListener('resize', updateFromViewport);
  }, []);

  const columns = useMemo(
    () => buildColumns(progressById, maxRows),
    [maxRows, progressById],
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-ink-muted">
        <span className="inline-flex items-center gap-1">
          <span
            className="inline-block size-2.5 rounded-sm bg-success-soft ring-1 ring-success/30"
            aria-hidden="true"
          />
          Memorized
        </span>
        <span className="inline-flex items-center gap-1">
          <span
            className="inline-block size-2.5 rounded-sm bg-warning-soft ring-1 ring-warning/30"
            aria-hidden="true"
          />
          Needs Review
        </span>
        <span className="text-ink-subtle">M · NR · reference</span>
      </div>

      <div
        className="flex flex-wrap content-start gap-x-1.5 gap-y-3"
        role="region"
        aria-label="Progress chart by deck"
      >
        {columns.map((column) => (
          <section
            key={column.key}
            className="w-[9.75rem] shrink-0"
            aria-label={
              column.partCount > 1
                ? `${column.deck.label} · ${DECK_SHORT[column.deck.section] ?? column.deck.section} · part ${column.part} of ${column.partCount}`
                : `${column.deck.label} · ${DECK_SHORT[column.deck.section] ?? column.deck.section}`
            }
          >
            <header className="mb-0.5 border-b border-line pb-1">
              <h2
                className="text-[11px] font-semibold leading-tight text-ink"
                title={column.deck.section}
              >
                {column.continuation ? (
                  <>
                    <span className="text-ink-muted">{column.deck.label}</span>
                    <span className="font-normal text-ink-subtle">
                      {` · cont. ${column.part}/${column.partCount}`}
                    </span>
                  </>
                ) : (
                  <>
                    {column.deck.label}
                    <span className="font-normal text-ink-muted">
                      {` · ${DECK_SHORT[column.deck.section] ?? column.deck.section}`}
                    </span>
                  </>
                )}
              </h2>
              {!column.continuation ? (
                <p className="text-[10px] tabular-nums text-ink-subtle">
                  {`${column.memorizedCount}/${column.deck.passageCount}`}
                </p>
              ) : (
                <p className="text-[10px] text-ink-subtle">&nbsp;</p>
              )}
            </header>

            <ul className="space-y-px">
              {column.verses.map((verse) => {
                const progress = progressById.get(verse.id);
                const memorized = progress?.isMemorized ?? false;
                const needsReview = progress?.isDifficult ?? false;
                const abbrev = abbreviateReference(verse.reference);

                return (
                  <li
                    key={verse.id}
                    className={clsx(
                      'flex items-center gap-0.5 rounded-sm px-0.5 py-px',
                      memorized && 'bg-success-soft',
                      !memorized && needsReview && 'bg-warning-soft',
                    )}
                  >
                    <input
                      type="checkbox"
                      className="size-2.5 shrink-0 accent-[var(--success)]"
                      checked={memorized}
                      onChange={(event) =>
                        onToggleMemorized(verse.id, event.target.checked)
                      }
                      aria-label={`Mark ${verse.reference} as memorized`}
                      title="Memorized"
                    />
                    <input
                      type="checkbox"
                      className="size-2.5 shrink-0 accent-[var(--warning)]"
                      checked={needsReview}
                      onChange={(event) =>
                        onToggleNeedsReview(verse.id, event.target.checked)
                      }
                      aria-label={`Mark ${verse.reference} as Needs Review`}
                      title="Needs Review"
                    />
                    <Link
                      to={`/verses/${verse.id}`}
                      className="min-w-0 truncate font-mono text-[10px] leading-tight text-ink hover:text-accent hover:underline"
                      title={verse.reference}
                    >
                      {abbrev}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

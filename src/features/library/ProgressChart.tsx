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

/** Row height with text-xs + tight leading (px). */
const ROW_HEIGHT_PX = 17;
const HEADER_HEIGHT_PX = 28;
/** Space reserved above the chart (title, strip, legend). */
const PAGE_CHROME_PX = 168;
const DEFAULT_MAX_ROWS = 24;
const MIN_MAX_ROWS = 14;

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

export function buildProgressChartColumns(
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

function maxRowsForViewport(): number {
  if (typeof window === 'undefined') return DEFAULT_MAX_ROWS;
  const available = Math.max(240, window.innerHeight - PAGE_CHROME_PX);
  const rows = Math.floor((available - HEADER_HEIGHT_PX) / ROW_HEIGHT_PX);
  return Math.max(MIN_MAX_ROWS, rows || DEFAULT_MAX_ROWS);
}

/**
 * Dense all-collection progress grid: deck columns of abbreviated refs with
 * Memorized / Needs Review toggles. Tall decks spill into extra columns so
 * everything fits on one screen.
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
    const update = () => setMaxRows(maxRowsForViewport());
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const columns = useMemo(
    () => buildProgressChartColumns(progressById, maxRows),
    [maxRows, progressById],
  );

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-ink-muted">
        <span className="mr-3 inline-flex items-center gap-1">
          <span
            className="inline-block size-2.5 rounded-sm bg-success-soft ring-1 ring-success/30"
            aria-hidden="true"
          />
          Memorized
        </span>
        <span className="mr-3 inline-flex items-center gap-1">
          <span
            className="inline-block size-2.5 rounded-sm bg-warning-soft ring-1 ring-warning/30"
            aria-hidden="true"
          />
          Needs Review
        </span>
        <span className="text-ink-subtle">M · NR · reference</span>
      </p>

      <div
        className="grid gap-x-1"
        style={{
          gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`,
        }}
        role="region"
        aria-label="Progress chart by deck"
      >
        {columns.map((column) => (
          <section
            key={column.key}
            className="min-w-0"
            aria-label={
              column.partCount > 1
                ? `${column.deck.label} · ${DECK_SHORT[column.deck.section] ?? column.deck.section} · part ${column.part} of ${column.partCount}`
                : `${column.deck.label} · ${DECK_SHORT[column.deck.section] ?? column.deck.section}`
            }
          >
            <header className="border-b border-line pb-0.5">
              <h2
                className="truncate text-xs font-semibold leading-tight text-ink"
                title={column.deck.section}
              >
                {column.continuation ? (
                  <>
                    <span className="text-ink-muted">{`D${column.deck.number}`}</span>
                    <span className="font-normal text-ink-subtle">
                      {` · ${column.part}/${column.partCount}`}
                    </span>
                  </>
                ) : (
                  <>
                    {`D${column.deck.number}`}
                    <span className="font-normal text-ink-muted">
                      {` · ${DECK_SHORT[column.deck.section] ?? column.deck.section}`}
                    </span>
                  </>
                )}
              </h2>
              <p className="text-[11px] leading-tight tabular-nums text-ink-subtle">
                {column.continuation
                  ? '\u00a0'
                  : `${column.memorizedCount}/${column.deck.passageCount}`}
              </p>
            </header>

            <ul>
              {column.verses.map((verse) => {
                const progress = progressById.get(verse.id);
                const memorized = progress?.isMemorized ?? false;
                const needsReview = progress?.isDifficult ?? false;
                const abbrev = abbreviateReference(verse.reference);

                return (
                  <li
                    key={verse.id}
                    className={clsx(
                      'flex items-center gap-0.5 leading-none',
                      memorized && 'bg-success-soft',
                      !memorized && needsReview && 'bg-warning-soft',
                    )}
                  >
                    <input
                      type="checkbox"
                      className="size-3 shrink-0 accent-[var(--success)]"
                      checked={memorized}
                      onChange={(event) =>
                        onToggleMemorized(verse.id, event.target.checked)
                      }
                      aria-label={`Mark ${verse.reference} as memorized`}
                      title="Memorized"
                    />
                    <input
                      type="checkbox"
                      className="size-3 shrink-0 accent-[var(--warning)]"
                      checked={needsReview}
                      onChange={(event) =>
                        onToggleNeedsReview(verse.id, event.target.checked)
                      }
                      aria-label={`Mark ${verse.reference} as Needs Review`}
                      title="Needs Review"
                    />
                    <Link
                      to={`/verses/${verse.id}`}
                      className="min-w-0 truncate font-mono text-xs leading-none text-ink hover:text-accent hover:underline"
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

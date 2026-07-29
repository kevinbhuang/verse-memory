import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  EllipsisVertical,
  Layers,
  RotateCcw,
} from 'lucide-react';
import clsx from 'clsx';
import { Button } from '@/components/ui/Button';
import { NeedsReviewBadge } from '@/components/VerseBadges';
import type { Verse, VerseProgress } from '@/types';
import {
  LIBRARY_MEMORIZED_COL,
  LIBRARY_REVIEW_COL,
} from './LibraryCheckboxHeader';

export function VerseRow({
  verse,
  progress,
  showSectionLabel,
  onToggleMemorized,
  onToggleNeedsReview,
  onOpenFlashcards,
  onReset,
}: {
  verse: Verse;
  progress: VerseProgress;
  showSectionLabel: boolean;
  onToggleMemorized: (verseId: string, memorized: boolean) => void;
  onToggleNeedsReview: (verseId: string, needsReview: boolean) => void;
  onOpenFlashcards: (verseId: string) => void;
  onReset: (verseId: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <li
      className={clsx(
        'relative border-b border-line last:border-b-0',
        progress.isMemorized && 'bg-success-soft',
        !progress.isMemorized && progress.isDifficult && 'bg-warning-soft',
      )}
    >
      <div className="flex items-start gap-2.5 px-2 py-2 sm:px-3">
        <div className="flex shrink-0 gap-2 pt-0.5">
          <span className={`${LIBRARY_MEMORIZED_COL} flex justify-center`}>
            <input
              type="checkbox"
              className="size-3.5 accent-[var(--accent)]"
              checked={progress.isMemorized}
              onChange={(event) =>
                onToggleMemorized(verse.id, event.target.checked)
              }
              aria-label={`Mark ${verse.reference} as memorized`}
            />
          </span>
          <span className={`${LIBRARY_REVIEW_COL} flex justify-center`}>
            <input
              type="checkbox"
              className="size-3.5 accent-[var(--accent)]"
              checked={progress.isDifficult}
              onChange={(event) =>
                onToggleNeedsReview(verse.id, event.target.checked)
              }
              aria-label={`Mark ${verse.reference} as Needs Review`}
            />
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-mono text-[11px] text-ink-subtle tabular-nums">
              {String(verse.order).padStart(3, '0')}
            </span>
            <Link
              to={`/verses/${verse.id}`}
              className="font-serif text-sm font-semibold text-ink hover:text-accent hover:underline"
            >
              {verse.reference}
            </Link>
            {showSectionLabel ? (
              <span className="text-[11px] text-ink-subtle">{verse.section}</span>
            ) : null}
            <span className="inline-flex flex-wrap items-center gap-1">
              <NeedsReviewBadge progress={progress} />
            </span>
          </div>

          <p className="mt-0.5 font-serif text-sm leading-relaxed text-ink-muted">
            {verse.text}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-1.5"
            onClick={() => onOpenFlashcards(verse.id)}
            aria-label="Review flash cards from this point"
            title="Review flash cards from this point"
          >
            <Layers className="size-3.5" aria-hidden="true" />
          </Button>

          <div className="relative">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-1.5"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={`More actions for ${verse.reference}`}
            >
              <EllipsisVertical className="size-3.5" aria-hidden="true" />
            </Button>

            {menuOpen ? (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-10 cursor-default"
                  aria-hidden="true"
                  tabIndex={-1}
                  onClick={() => setMenuOpen(false)}
                />
                <div
                  role="menu"
                  className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-lg"
                >
                  <Link
                    role="menuitem"
                    to={`/verses/${verse.id}`}
                    className="block px-3 py-2 text-sm text-ink hover:bg-surface-muted"
                    onClick={() => setMenuOpen(false)}
                  >
                    Open passage details
                  </Link>
                  <button
                    role="menuitem"
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-danger hover:bg-danger-soft"
                    onClick={() => {
                      onReset(verse.id);
                      setMenuOpen(false);
                    }}
                  >
                    <RotateCcw className="size-3.5" aria-hidden="true" />
                    Reset this passage
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}

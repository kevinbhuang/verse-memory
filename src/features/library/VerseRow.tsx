import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  EllipsisVertical,
  Flag,
  NotebookPen,
  Play,
  RotateCcw,
} from 'lucide-react';
import clsx from 'clsx';
import { Button } from '@/components/ui/Button';
import {
  DifficultBadge,
  DueBadge,
  PinnedBadge,
  StatusBadge,
} from '@/components/VerseBadges';
import { formatRelativeDay, truncate } from '@/utils/format';
import type { Verse, VerseProgress } from '@/types';

export function VerseRow({
  verse,
  progress,
  selected,
  showSectionLabel,
  onToggleSelected,
  onToggleMemorized,
  onToggleDifficult,
  onQuickReview,
  onReset,
  onEditNote,
}: {
  verse: Verse;
  progress: VerseProgress;
  selected: boolean;
  showSectionLabel: boolean;
  onToggleSelected: (verseId: string, selected: boolean) => void;
  onToggleMemorized: (verseId: string, memorized: boolean) => void;
  onToggleDifficult: (verseId: string, difficult: boolean) => void;
  onQuickReview: (verseId: string) => void;
  onReset: (verseId: string) => void;
  onEditNote: (verseId: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <li
      className={clsx(
        'relative border-b border-line last:border-b-0',
        selected && 'bg-accent-soft/40',
      )}
    >
      <div className="flex items-start gap-3 px-3 py-3 sm:px-4">
        <input
          type="checkbox"
          className="mt-1 size-4 shrink-0 accent-[var(--accent)]"
          checked={selected}
          onChange={(event) => onToggleSelected(verse.id, event.target.checked)}
          aria-label={`Select ${verse.reference} for bulk actions`}
        />

        <input
          type="checkbox"
          className="mt-1 size-4 shrink-0 accent-[var(--accent)]"
          checked={progress.isMemorized}
          onChange={(event) => onToggleMemorized(verse.id, event.target.checked)}
          aria-label={`Mark ${verse.reference} as memorized`}
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="font-mono text-xs text-ink-subtle tabular-nums">
              {String(verse.order).padStart(3, '0')}
            </span>
            <Link
              to={`/verses/${verse.id}`}
              className="font-serif text-base font-semibold text-ink hover:text-accent hover:underline"
            >
              {verse.reference}
            </Link>
            {showSectionLabel ? (
              <span className="text-xs text-ink-subtle">{verse.section}</span>
            ) : null}
          </div>

          <p className="mt-1 font-serif text-sm leading-relaxed text-ink-muted">
            {truncate(verse.text, 150)}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <StatusBadge status={progress.status} />
            <DueBadge progress={progress} />
            <DifficultBadge progress={progress} />
            <PinnedBadge progress={progress} />
            {progress.note.trim() !== '' ? (
              <span className="inline-flex items-center gap-1 text-xs text-ink-subtle">
                <NotebookPen className="size-3" aria-hidden="true" />
                Note
              </span>
            ) : null}
            <span className="text-xs text-ink-subtle">
              Last reviewed: {formatRelativeDay(progress.lastReviewedAt)}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            size="sm"
            variant="quiet"
            onClick={() => onQuickReview(verse.id)}
            aria-label={`Review ${verse.reference} now`}
          >
            <Play className="size-3.5" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">Review</span>
          </Button>

          <div className="relative">
            <Button
              size="sm"
              variant="ghost"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={`More actions for ${verse.reference}`}
            >
              <EllipsisVertical className="size-4" aria-hidden="true" />
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
                  className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-lg"
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
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-surface-muted"
                    onClick={() => {
                      onToggleDifficult(verse.id, !progress.isDifficult);
                      setMenuOpen(false);
                    }}
                  >
                    <Flag className="size-3.5" aria-hidden="true" />
                    {progress.isDifficult
                      ? 'Remove difficult flag'
                      : 'Mark difficult'}
                  </button>
                  <button
                    role="menuitem"
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-surface-muted"
                    onClick={() => {
                      onEditNote(verse.id);
                      setMenuOpen(false);
                    }}
                  >
                    <NotebookPen className="size-3.5" aria-hidden="true" />
                    {progress.note.trim() === '' ? 'Add note' : 'Edit note'}
                  </button>
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

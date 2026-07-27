import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  EllipsisVertical,
  Flag,
  Keyboard,
  Mic,
  RotateCcw,
} from 'lucide-react';
import clsx from 'clsx';
import { Button } from '@/components/ui/Button';
import {
  DifficultBadge,
  DueBadge,
  StatusBadge,
} from '@/components/VerseBadges';
import type { ReviewMode, Verse, VerseProgress } from '@/types';

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
}: {
  verse: Verse;
  progress: VerseProgress;
  selected: boolean;
  showSectionLabel: boolean;
  onToggleSelected: (verseId: string, selected: boolean) => void;
  onToggleMemorized: (verseId: string, memorized: boolean) => void;
  onToggleDifficult: (verseId: string, difficult: boolean) => void;
  onQuickReview: (
    verseId: string,
    mode: Extract<ReviewMode, 'first-letter' | 'voice'>,
  ) => void;
  onReset: (verseId: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <li
      className={clsx(
        'relative border-b border-line last:border-b-0',
        selected && 'bg-accent-soft/40',
      )}
    >
      <div className="flex items-start gap-2 px-2 py-1.5 sm:px-3">
        <input
          type="checkbox"
          className="mt-1 size-3.5 shrink-0 accent-[var(--accent)]"
          checked={selected}
          onChange={(event) => onToggleSelected(verse.id, event.target.checked)}
          aria-label={`Select ${verse.reference} for bulk actions`}
        />

        <input
          type="checkbox"
          className="mt-1 size-3.5 shrink-0 accent-[var(--accent)]"
          checked={progress.isMemorized}
          onChange={(event) => onToggleMemorized(verse.id, event.target.checked)}
          aria-label={`Mark ${verse.reference} as memorized`}
        />

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
              <StatusBadge status={progress.status} />
              <DueBadge progress={progress} />
              <DifficultBadge progress={progress} />
            </span>
          </div>

          <p
            className="mt-0.5 line-clamp-2 font-serif text-xs leading-snug text-ink-muted"
            title={verse.text}
          >
            {verse.text}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-1.5"
            onClick={() => onQuickReview(verse.id, 'first-letter')}
            aria-label={`Practice ${verse.reference} with first letters`}
          >
            <Keyboard className="size-3.5" aria-hidden="true" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-1.5"
            onClick={() => onQuickReview(verse.id, 'voice')}
            aria-label={`Practice ${verse.reference} by speaking`}
          >
            <Mic className="size-3.5" aria-hidden="true" />
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

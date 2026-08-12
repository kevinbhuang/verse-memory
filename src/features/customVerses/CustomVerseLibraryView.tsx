import { Layers, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { Button } from '@/components/ui/Button';
import { NeedsReviewBadge } from '@/components/VerseBadges';
import type { CustomVerse } from '@/types/customVerse';
import type { VerseProgress } from '@/types';

type Props = {
  verses: CustomVerse[];
  progressById: Map<string, VerseProgress>;
  onOpenCards: (verseId: string) => void;
  onDelete: (verseId: string) => void;
  onToggleMemorized: (verseId: string, memorized: boolean) => void;
  onToggleNeedsReview: (verseId: string, needsReview: boolean) => void;
};

/**
 * List view of the custom collection — browse, open cards, or delete.
 */
export function CustomVerseLibraryView({
  verses,
  progressById,
  onOpenCards,
  onDelete,
  onToggleMemorized,
  onToggleNeedsReview,
}: Props) {
  if (!verses.length) {
    return (
      <p className="text-sm text-ink-muted">
        Your custom list is empty. Add references above to begin.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex items-center gap-2.5 border-b border-line px-2 py-2 text-xs font-medium text-ink-muted sm:px-3">
        <span className="w-8 text-center" title="Memorized">
          M
        </span>
        <span className="w-8 text-center" title="Needs Review">
          NR
        </span>
        <span className="min-w-0 flex-1">Reference</span>
        <span className="sr-only">Actions</span>
      </div>
      <ul>
        {verses.map((verse, index) => {
          const progress = progressById.get(verse.id);
          const memorized = progress?.isMemorized ?? false;
          const needsReview = progress?.isDifficult ?? false;

          return (
            <li
              key={verse.id}
              className={clsx(
                'border-b border-line last:border-b-0',
                memorized && 'bg-success-soft',
                !memorized && needsReview && 'bg-warning-soft',
              )}
            >
              <div className="flex items-start gap-2.5 px-2 py-2.5 sm:px-3">
                <span className="flex w-8 justify-center pt-0.5">
                  <input
                    type="checkbox"
                    className="size-3.5 accent-[var(--accent)]"
                    checked={memorized}
                    onChange={(event) =>
                      onToggleMemorized(verse.id, event.target.checked)
                    }
                    aria-label={`Mark ${verse.reference} as memorized`}
                  />
                </span>
                <span className="flex w-8 justify-center pt-0.5">
                  <input
                    type="checkbox"
                    className="size-3.5 accent-[var(--accent)]"
                    checked={needsReview}
                    onChange={(event) =>
                      onToggleNeedsReview(verse.id, event.target.checked)
                    }
                    aria-label={`Mark ${verse.reference} as Needs Review`}
                  />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="font-mono text-[11px] text-ink-subtle tabular-nums">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <button
                      type="button"
                      className="text-left font-serif text-sm font-semibold text-ink hover:text-accent hover:underline"
                      onClick={() => onOpenCards(verse.id)}
                    >
                      {verse.reference}
                    </button>
                    {needsReview ? <NeedsReviewBadge /> : null}
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">
                    {verse.text}
                  </p>
                </div>

                <div className="flex shrink-0 gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onOpenCards(verse.id)}
                    title="Open flash card"
                    aria-label={`Open ${verse.reference} as flash card`}
                  >
                    <Layers className="size-3.5" aria-hidden="true" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onDelete(verse.id)}
                    title="Delete from list"
                    aria-label={`Delete ${verse.reference}`}
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Flag,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { ScriptureText } from '@/components/ScriptureText';
import { Button } from '@/components/ui/Button';
import { Toggle } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { useHotkeys } from '@/hooks/useHotkeys';
import { useSettings } from '@/hooks/useSettings';
import { useVerseProgress } from '@/hooks/useProgressData';
import { verses } from '@/data/verses';
import { firstLetterSkeleton } from '@/lib/text/tokenize';
import { setDifficult, setMemorized } from '@/services/progressService';

const FIRST_LETTER_KEY = 'verse-memory:flashcards-first-letter';

function readFirstLetterPref(): boolean {
  try {
    const stored = localStorage.getItem(FIRST_LETTER_KEY);
    if (stored === null) return true;
    return stored === 'true';
  } catch {
    return true;
  }
}

function indexForVerseId(verseId: string | null): number {
  if (!verseId) return 0;
  const index = verses.findIndex((verse) => verse.id === verseId);
  return index >= 0 ? index : 0;
}

/**
 * Browse the collection as flash cards: optional first-letter cue, reveal,
 * and previous/next navigation through every passage.
 */
export function FlashCardsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { settings } = useSettings();
  const { notify } = useToast();

  const startId = searchParams.get('verse');
  const [index, setIndex] = useState(() => indexForVerseId(startId));
  const [firstLetterMode, setFirstLetterMode] = useState(readFirstLetterPref);
  const [revealed, setRevealed] = useState(false);

  const verse = verses[index] ?? verses[0]!;
  const progress = useVerseProgress(verse.id);
  const canGoPrev = index > 0;
  const canGoNext = index < verses.length - 1;

  useEffect(() => {
    const next = indexForVerseId(startId);
    setIndex(next);
    setRevealed(false);
  }, [startId]);

  useEffect(() => {
    setRevealed(false);
  }, [index, firstLetterMode]);

  useEffect(() => {
    try {
      localStorage.setItem(FIRST_LETTER_KEY, String(firstLetterMode));
    } catch {
      // Ignore quota / private-mode failures.
    }
  }, [firstLetterMode]);

  const goTo = (nextIndex: number) => {
    const clamped = Math.min(Math.max(nextIndex, 0), verses.length - 1);
    setIndex(clamped);
    const target = verses[clamped];
    if (target) {
      navigate(`/flashcards?verse=${target.id}`, { replace: true });
    }
  };

  const reveal = () => setRevealed(true);
  const hide = () => setRevealed(false);

  useHotkeys({
    arrowleft: () => {
      if (canGoPrev) goTo(index - 1);
    },
    arrowright: () => {
      if (canGoNext) goTo(index + 1);
    },
    space: () => {
      if (!revealed) reveal();
    },
    enter: () => {
      if (!revealed) reveal();
    },
  });

  const positionLabel = useMemo(
    () => `Passage ${index + 1} of ${verses.length}`,
    [index],
  );

  return (
    <>
      <PageHeader
        title="Flash Cards"
        description="Flip through the collection. Turn on first letters for a lighter cue before you reveal."
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <Toggle
          label="First letter mode"
          description="Show each word’s first letter before revealing the passage."
          checked={firstLetterMode}
          onChange={setFirstLetterMode}
        />
        <p className="text-sm text-ink-muted tabular-nums">{positionLabel}</p>
      </div>

      <div className="mx-auto w-full max-w-2xl space-y-5">
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={!canGoPrev}
            onClick={() => goTo(index - 1)}
            aria-label="Previous passage"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            Previous
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={!canGoNext}
            onClick={() => goTo(index + 1)}
            aria-label="Next passage"
          >
            Next
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        </div>

        <div>
          <h2 className="font-serif text-2xl font-semibold text-ink sm:text-3xl">
            {verse.reference}
          </h2>
          {settings.showSectionLabels ? (
            <p className="mt-1 text-sm text-ink-muted">{verse.section}</p>
          ) : null}
        </div>

        {progress ? (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={progress.isMemorized ? 'quiet' : 'secondary'}
              onClick={() =>
                void setMemorized(verse.id, !progress.isMemorized).then(() =>
                  notify(
                    progress.isMemorized
                      ? 'Cleared memorized mark.'
                      : 'Marked memorized.',
                    'success',
                  ),
                )
              }
              aria-pressed={progress.isMemorized}
            >
              {progress.isMemorized ? 'Clear memorized' : 'Mark memorized'}
            </Button>
            <Button
              size="sm"
              variant={progress.isDifficult ? 'quiet' : 'secondary'}
              onClick={() =>
                void setDifficult(verse.id, !progress.isDifficult).then(() =>
                  notify(
                    progress.isDifficult
                      ? 'Cleared Needs Review.'
                      : 'Marked Needs Review.',
                    'success',
                  ),
                )
              }
              aria-pressed={progress.isDifficult}
            >
              <Flag className="size-3.5" aria-hidden="true" />
              {progress.isDifficult ? 'Clear Needs Review' : 'Mark Needs Review'}
            </Button>
          </div>
        ) : null}

        {revealed ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-line bg-surface px-5 py-6">
              <ScriptureText text={verse.text} />
            </div>
            <Button variant="ghost" size="sm" onClick={hide}>
              <EyeOff className="size-4" aria-hidden="true" />
              Hide passage
            </Button>
          </div>
        ) : firstLetterMode ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-line bg-surface px-5 py-6">
              <p
                className="font-serif text-lg leading-relaxed text-ink sm:text-xl sm:leading-relaxed"
                aria-label="First letters of the passage"
              >
                {firstLetterSkeleton(verse.text)}
              </p>
            </div>
            <Button variant="primary" size="lg" onClick={reveal} autoFocus>
              <Eye className="size-4" aria-hidden="true" />
              Reveal passage
            </Button>
            <p className="text-xs text-ink-subtle">
              Press Space or Enter to reveal · ← → to move
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-dashed border-line-strong bg-surface-muted px-5 py-10 text-center">
              <p className="text-sm text-ink-muted">
                Recall the passage, then reveal it to check yourself.
              </p>
              <Button
                variant="primary"
                size="lg"
                className="mt-6"
                onClick={reveal}
                autoFocus
              >
                <Eye className="size-4" aria-hidden="true" />
                Reveal passage
              </Button>
              <p className="mt-2 text-xs text-ink-subtle">
                Press Space or Enter to reveal · ← → to move
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

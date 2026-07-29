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
    if (stored === null) return false;
    return stored === 'true';
  } catch {
    return false;
  }
}

function indexForVerseId(verseId: string | null): number {
  if (!verseId) return 0;
  const index = verses.findIndex((verse) => verse.id === verseId);
  return index >= 0 ? index : 0;
}

/**
 * Browse the collection as flash cards: show/hide the passage, optional
 * first-letter cue, and previous/next navigation.
 */
export function FlashCardsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { settings } = useSettings();
  const { notify } = useToast();

  const startId = searchParams.get('verse');
  const [index, setIndex] = useState(() => indexForVerseId(startId));
  const [firstLetterMode, setFirstLetterMode] = useState(readFirstLetterPref);
  const [revealed, setRevealed] = useState(true);

  const verse = verses[index] ?? verses[0]!;
  const progress = useVerseProgress(verse.id);
  const canGoPrev = index > 0;
  const canGoNext = index < verses.length - 1;

  useEffect(() => {
    const next = indexForVerseId(startId);
    setIndex(next);
  }, [startId]);

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
    setRevealed(true);
    const target = verses[clamped];
    if (target) {
      navigate(`/flashcards?verse=${target.id}`, { replace: true });
    }
  };

  const toggleRevealed = () => setRevealed((open) => !open);
  const toggleFirstLetterMode = () => setFirstLetterMode((on) => !on);

  useHotkeys({
    arrowleft: () => {
      if (canGoPrev) goTo(index - 1);
    },
    arrowright: () => {
      if (canGoNext) goTo(index + 1);
    },
    space: () => toggleRevealed(),
    enter: () => toggleRevealed(),
    h: () => toggleRevealed(),
    f: () => toggleFirstLetterMode(),
  });

  const positionLabel = useMemo(
    () => `Passage ${index + 1} of ${verses.length}`,
    [index],
  );

  return (
    <>
      <PageHeader
        title="Flash Cards"
        description="Flip through the collection. Hide a passage to test yourself, or turn on first letters for a lighter cue."
      />

      <div className="mb-5 flex flex-wrap items-center justify-end gap-3 border-b border-line pb-4">
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
          <div className="rounded-xl border border-line bg-surface px-5 py-6">
            <ScriptureText text={verse.text} />
          </div>
        ) : firstLetterMode ? (
          <div className="rounded-xl border border-line bg-surface px-5 py-6">
            <p
              className="font-serif text-lg leading-relaxed text-ink sm:text-xl sm:leading-relaxed"
              aria-label="First letters of the passage"
            >
              {firstLetterSkeleton(verse.text)}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-line-strong bg-surface-muted px-5 py-10 text-center">
            <p className="text-sm text-ink-muted">
              Passage hidden. Press Space to show it again.
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={toggleRevealed}>
            {revealed ? (
              <>
                <EyeOff className="size-4" aria-hidden="true" />
                Hide passage
              </>
            ) : (
              <>
                <Eye className="size-4" aria-hidden="true" />
                Show passage
              </>
            )}
          </Button>

          <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-ink-subtle">
            <input
              type="checkbox"
              className="size-3.5 accent-[var(--accent)]"
              checked={firstLetterMode}
              onChange={(event) => setFirstLetterMode(event.target.checked)}
              aria-label="First letter mode"
            />
            <span>
              First letters
              <span className="ml-1.5 font-mono opacity-70">F</span>
            </span>
          </label>
        </div>

        <p className="text-xs text-ink-subtle">
          Space or H show/hide · F first letters · ← → move
        </p>
      </div>
    </>
  );
}

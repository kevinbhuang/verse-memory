import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { createDefaultProgress, DEFAULT_SETTINGS } from '@/db/defaults';
import { FillBlankMode } from '@/features/review/modes/FillBlankMode';
import { FirstLetterMode } from '@/features/review/modes/FirstLetterMode';
import { VerseAudioControls } from '@/features/review/VerseAudioControls';
import { toReviewVerse } from '@/features/customVerses/toReviewVerse';
import { useHotkeys } from '@/hooks/useHotkeys';
import { useSettings } from '@/hooks/useSettings';
import type { CustomVerse } from '@/types/customVerse';
import type { ModeResult } from '@/types';

export type CustomPracticeMode = 'first-letter' | 'fill-blank';

type Props = {
  verse: CustomVerse;
  list: CustomVerse[];
  mode: CustomPracticeMode;
  onNavigate: (verseId: string) => void;
  onExit: () => void;
};

/**
 * Single-verse custom practice — uses review modes but stays on this page.
 * Left/right (and Previous/Next) move to another verse in the same list/mode.
 */
export function CustomVersePracticeSession({
  verse,
  list,
  mode,
  onNavigate,
  onExit,
}: Props) {
  const { settings } = useSettings();
  const [result, setResult] = useState<ModeResult | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [showNextLetter, setShowNextLetter] = useState(false);

  const index = useMemo(
    () => list.findIndex((item) => item.id === verse.id),
    [list, verse.id],
  );
  const canGoPrev = index > 0;
  const canGoNext = index >= 0 && index < list.length - 1;

  useEffect(() => {
    setResult(null);
    setAttempt(0);
    setShowNextLetter(false);
  }, [verse.id, mode]);

  useHotkeys(
    {
      arrowleft: () => {
        if (canGoPrev) onNavigate(list[index - 1]!.id);
      },
      arrowright: () => {
        if (canGoNext) onNavigate(list[index + 1]!.id);
      },
    },
    {
      // First-letter keeps an input focused; arrows are not used for typing there.
      // Fill-blank also allows arrows so list navigation stays consistent.
      allowWhileTyping: ['arrowleft', 'arrowright'],
    },
  );

  const reviewVerse = useMemo(() => toReviewVerse(verse), [verse]);
  const progress = createDefaultProgress(verse.id);
  const attemptKey = `${verse.id}:${mode}:${attempt}`;
  const reviewSettings = {
    ...DEFAULT_SETTINGS,
    ...settings,
    showSectionLabels: false,
    showFirstLetterSkeleton: showNextLetter,
  };
  const modeLabel =
    mode === 'first-letter' ? 'Type first letter' : 'Fill in the blank';
  const positionLabel =
    index >= 0 ? `Passage ${index + 1} of ${list.length}` : null;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-4 sm:px-6">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onExit}>
              <X className="size-4" aria-hidden="true" />
              Exit
            </Button>
            <p className="text-sm text-ink-muted">{modeLabel}</p>
          </div>
          {positionLabel ? (
            <p className="text-sm text-ink-muted tabular-nums">{positionLabel}</p>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={!canGoPrev}
            onClick={() => onNavigate(list[index - 1]!.id)}
            aria-label="Previous passage"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            Previous
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={!canGoNext}
            onClick={() => onNavigate(list[index + 1]!.id)}
            aria-label="Next passage"
          >
            Next
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        </div>

        <VerseAudioControls
          text={reviewVerse.text}
          reference={reviewVerse.reference}
          passageKey={attemptKey}
        />

        {mode === 'first-letter' ? (
          <FirstLetterMode
            verse={reviewVerse}
            progress={progress}
            settings={reviewSettings}
            wordStats={[]}
            onComplete={setResult}
            attemptKey={attemptKey}
            onRetry={() => {
              setResult(null);
              setAttempt((n) => n + 1);
            }}
            onShowFirstLetterSkeletonChange={setShowNextLetter}
          />
        ) : (
          <FillBlankMode
            verse={reviewVerse}
            progress={progress}
            settings={reviewSettings}
            wordStats={[]}
            onComplete={setResult}
            attemptKey={attemptKey}
            onRetry={() => {
              setResult(null);
              setAttempt((n) => n + 1);
            }}
          />
        )}

        {result ? (
          <div className="flex flex-wrap gap-2 border-t border-line pt-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setResult(null);
                setAttempt((n) => n + 1);
              }}
            >
              Practice again
            </Button>
            {canGoNext ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => onNavigate(list[index + 1]!.id)}
              >
                Next passage
              </Button>
            ) : (
              <Button variant="primary" size="sm" onClick={onExit}>
                Back to My Verses
              </Button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

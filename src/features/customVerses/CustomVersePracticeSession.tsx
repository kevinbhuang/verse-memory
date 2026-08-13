import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { createDefaultProgress, DEFAULT_SETTINGS } from '@/db/defaults';
import { FillBlankMode } from '@/features/review/modes/FillBlankMode';
import { FirstLetterMode } from '@/features/review/modes/FirstLetterMode';
import { VerseAudioControls } from '@/features/review/VerseAudioControls';
import { toReviewVerse } from '@/features/customVerses/toReviewVerse';
import { useSettings } from '@/hooks/useSettings';
import type { CustomVerse } from '@/types/customVerse';
import type { ModeResult } from '@/types';

export type CustomPracticeMode = 'first-letter' | 'fill-blank';

type Props = {
  verse: CustomVerse;
  mode: CustomPracticeMode;
  onExit: () => void;
};

/**
 * Single-verse custom practice — uses review modes but stays on this page.
 */
export function CustomVersePracticeSession({ verse, mode, onExit }: Props) {
  const { settings } = useSettings();
  const [result, setResult] = useState<ModeResult | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [showNextLetter, setShowNextLetter] = useState(false);

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

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-4 sm:px-6">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onExit}>
            <X className="size-4" aria-hidden="true" />
            Exit
          </Button>
          <p className="text-sm text-ink-muted">{modeLabel}</p>
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
            <Button variant="primary" size="sm" onClick={onExit}>
              Back to My Verses
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

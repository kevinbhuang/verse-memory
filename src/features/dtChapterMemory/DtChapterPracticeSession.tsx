import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { createDefaultProgress, DEFAULT_SETTINGS } from '@/db/defaults';
import {
  getDtChapterDeck,
  toChapterReviewVerse,
} from '@/data/dtChapters';
import { FlashcardMode } from '@/features/review/modes/FlashcardMode';
import { FirstLetterMode } from '@/features/review/modes/FirstLetterMode';
import { VerseAudioControls } from '@/features/review/VerseAudioControls';
import { useSettings } from '@/hooks/useSettings';
import type { ModeResult } from '@/types';

export type DtPracticeMode = 'first-letter' | 'flashcard';

type Props = {
  deckId: string;
  mode: DtPracticeMode;
  onExit: () => void;
};

/**
 * Whole-chapter DT practice — never writes Library / Progress / Quiz data.
 */
export function DtChapterPracticeSession({ deckId, mode, onExit }: Props) {
  const { settings } = useSettings();
  const deck = useMemo(() => getDtChapterDeck(deckId), [deckId]);
  const [result, setResult] = useState<ModeResult | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [showNextLetter, setShowNextLetter] = useState(false);

  const reviewSettings = {
    ...DEFAULT_SETTINGS,
    ...settings,
    showSectionLabels: false,
    showFirstLetterSkeleton: showNextLetter,
  };

  if (!deck) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-4 sm:px-6">
        <p className="text-sm text-ink-muted">Chapter not found.</p>
        <Button variant="secondary" className="mt-4" onClick={onExit}>
          Back
        </Button>
      </div>
    );
  }

  const verse = toChapterReviewVerse(deck);
  const progress = createDefaultProgress(verse.id);
  const attemptKey = `${verse.id}:${mode}:${attempt}`;
  const modeLabel =
    mode === 'first-letter'
      ? 'Type with first letter'
      : 'See verse using first letters';

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-4 sm:px-6">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onExit}>
              <X className="size-4" aria-hidden="true" />
              Exit
            </Button>
            <p className="text-sm text-ink-muted">{modeLabel}</p>
          </div>
        </div>

        <VerseAudioControls
          text={verse.text}
          reference={verse.reference}
          passageKey={attemptKey}
        />

        {mode === 'first-letter' ? (
          <FirstLetterMode
            verse={verse}
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
          <FlashcardMode
            verse={verse}
            progress={progress}
            settings={reviewSettings}
            wordStats={[]}
            onComplete={setResult}
            attemptKey={attemptKey}
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
              Back to chapters
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

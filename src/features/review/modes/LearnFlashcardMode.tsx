import { useEffect } from 'react';
import { Keyboard, Mic } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ScriptureText } from '@/components/ScriptureText';
import type { ReviewMode } from '@/types';
import type { ReviewModeProps } from '../modeTypes';

type LearnFlashcardModeProps = ReviewModeProps & {
  /** Switch this card into an active review exercise. */
  onPractice?: (mode: Extract<ReviewMode, 'first-letter' | 'voice'>) => void;
};

/**
 * Learn card: reference and passage stay visible, and rating is available
 * immediately. Optional first-letter or spoken practice is offered alongside.
 */
export function LearnFlashcardMode({
  verse,
  settings,
  onComplete,
  onPractice,
  attemptKey,
}: LearnFlashcardModeProps) {
  useEffect(() => {
    // Rating is available as soon as the passage is shown — no exercise required.
    onComplete({
      mode: 'learn',
      accuracy: null,
      elapsedMs: 0,
      incorrectCount: 0,
      hintCount: 0,
      fullRevealUsed: false,
      wordErrors: [],
      suggestedRating: 'good',
    });
  }, [attemptKey, onComplete]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-semibold text-ink sm:text-3xl">
          {verse.reference}
        </h2>
        {settings.showSectionLabels ? (
          <p className="mt-1 text-sm text-ink-muted">{verse.section}</p>
        ) : null}
      </div>

      <div className="rounded-xl border border-line bg-surface px-5 py-6">
        <ScriptureText text={verse.text} />
      </div>

      <div className="space-y-3">
        <p className="text-sm text-ink-muted">
          Rate it when you are ready, or review it first.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            variant="secondary"
            size="lg"
            className="w-full"
            onClick={() => onPractice?.('first-letter')}
            disabled={!onPractice}
          >
            <Keyboard className="size-4" aria-hidden="true" />
            First letters
          </Button>
          <Button
            variant="secondary"
            size="lg"
            className="w-full"
            onClick={() => onPractice?.('voice')}
            disabled={!onPractice}
          >
            <Mic className="size-4" aria-hidden="true" />
            Audio
          </Button>
        </div>
      </div>
    </div>
  );
}

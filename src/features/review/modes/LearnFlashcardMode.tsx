import { useEffect, useRef } from 'react';
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
 * Learn card: reference and passage stay visible. From here the reader can
 * jump straight into first-letter or spoken review, or rate and continue.
 */
export function LearnFlashcardMode({
  verse,
  settings,
  onComplete,
  onPractice,
  attemptKey,
}: LearnFlashcardModeProps) {
  const startedAt = useRef(Date.now());
  const completed = useRef(false);

  useEffect(() => {
    startedAt.current = Date.now();
    completed.current = false;
  }, [attemptKey]);

  const finishLearn = () => {
    if (completed.current) return;
    completed.current = true;
    onComplete({
      mode: 'learn',
      accuracy: null,
      elapsedMs: Date.now() - startedAt.current,
      incorrectCount: 0,
      hintCount: 0,
      fullRevealUsed: false,
      wordErrors: [],
      suggestedRating: 'good',
    });
  };

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
          Read it through, then review it now if you want.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            variant="primary"
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
        <Button variant="ghost" className="w-full" onClick={finishLearn}>
          Rate and continue
        </Button>
      </div>
    </div>
  );
}

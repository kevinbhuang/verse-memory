import { useEffect, useRef, useState } from 'react';
import { Eye } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ScriptureText } from '@/components/ScriptureText';
import { useHotkeys } from '@/hooks/useHotkeys';
import { firstLetterSkeleton } from '@/lib/text/tokenize';
import type { ReviewModeProps } from '../modeTypes';

/**
 * First-letter review: reference and letter skeleton stay visible;
 * the reader reveals the full passage when ready to check.
 */
export function FlashcardMode({
  verse,
  settings,
  onComplete,
  attemptKey,
}: ReviewModeProps) {
  const [revealed, setRevealed] = useState(false);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    setRevealed(false);
    startedAt.current = Date.now();
  }, [attemptKey]);

  const reveal = () => {
    if (revealed) return;
    setRevealed(true);
    onComplete({
      mode: 'flashcard',
      accuracy: null,
      elapsedMs: Date.now() - startedAt.current,
      incorrectCount: 0,
      hintCount: 0,
      fullRevealUsed: false,
      wordErrors: [],
      suggestedRating: 'good',
    });
  };

  useHotkeys({ space: reveal, enter: reveal }, { enabled: !revealed });

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

      {revealed ? (
        <div className="rounded-xl border border-line bg-surface px-5 py-6">
          <ScriptureText text={verse.text} />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-line bg-surface px-5 py-6">
            <p
              className="font-serif text-lg leading-relaxed text-ink sm:text-xl sm:leading-relaxed"
              aria-label="First letters of the passage"
            >
              {firstLetterSkeleton(verse.text)}
            </p>
          </div>

          <Button
            variant="primary"
            size="lg"
            className="w-full sm:w-auto"
            onClick={reveal}
            autoFocus
          >
            <Eye className="size-4" aria-hidden="true" />
            Reveal passage
          </Button>
          <p className="text-xs text-ink-subtle">
            Press Space or Enter to reveal
          </p>
        </div>
      )}
    </div>
  );
}

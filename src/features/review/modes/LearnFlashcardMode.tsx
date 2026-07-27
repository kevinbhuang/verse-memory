import { useEffect, useRef, useState } from 'react';
import { Eye } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ScriptureText } from '@/components/ScriptureText';
import { useHotkeys } from '@/hooks/useHotkeys';
import type { ReviewModeProps } from '../modeTypes';

/**
 * Learn flashcard: passage text on the front, reference on the back.
 * After reveal, the shared rating panel (Again / Hard / Good / Easy) appears.
 */
export function LearnFlashcardMode({
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

  useHotkeys({ space: reveal, enter: reveal }, { enabled: !revealed });

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-line bg-surface px-5 py-6">
        <ScriptureText text={verse.text} />
        {settings.showSectionLabels ? (
          <p className="mt-4 text-sm text-ink-muted">{verse.section}</p>
        ) : null}
      </div>

      {revealed ? (
        <div className="rounded-xl border border-accent/40 bg-accent-soft px-5 py-8 text-center">
          <p className="text-xs font-medium tracking-wide text-accent uppercase">
            Reference
          </p>
          <p className="mt-2 font-serif text-2xl font-semibold text-ink sm:text-3xl">
            {verse.reference}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-line-strong bg-surface-muted px-5 py-10 text-center">
          <p className="text-sm text-ink-muted">
            Read the passage, then flip the card to check the reference.
          </p>
          <Button
            variant="primary"
            size="lg"
            className="mt-6"
            onClick={reveal}
            autoFocus
          >
            <Eye className="size-4" aria-hidden="true" />
            Reveal reference
          </Button>
          <p className="mt-3 text-xs text-ink-subtle">Space or Enter</p>
        </div>
      )}
    </div>
  );
}

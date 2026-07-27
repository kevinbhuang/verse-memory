import { useEffect, useRef, useState } from 'react';
import { Eye } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ScriptureText } from '@/components/ScriptureText';
import { useHotkeys } from '@/hooks/useHotkeys';
import { firstLetterSkeleton, words } from '@/lib/text/tokenize';
import type { ReviewModeProps } from '../modeTypes';

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

  const openingPhrase = words(verse.text).slice(0, 4).join(' ');

  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="font-serif text-2xl font-semibold text-ink sm:text-3xl">
          {verse.reference}
        </p>
        {settings.showSectionLabels ? (
          <p className="mt-1 text-sm text-ink-muted">{verse.section}</p>
        ) : null}
      </div>

      {revealed ? (
        <div className="rounded-xl border border-line bg-surface px-5 py-6">
          <ScriptureText text={verse.text} />
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-line-strong bg-surface-muted px-5 py-10 text-center">
          <p className="text-sm text-ink-muted">
            Recall the passage, then reveal it to check yourself.
          </p>
          <p className="mt-4 font-serif text-lg text-ink-subtle">
            {openingPhrase}
            {'\u2026'}
          </p>
          {settings.showFirstLetterSkeleton ? (
            <p className="mx-auto mt-4 max-w-xl font-mono text-xs leading-relaxed break-words text-ink-subtle">
              {firstLetterSkeleton(verse.text)}
            </p>
          ) : null}
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
            Press Space or Enter to reveal
          </p>
        </div>
      )}
    </div>
  );
}

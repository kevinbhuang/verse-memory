import { useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, Check, Eye } from 'lucide-react';
import clsx from 'clsx';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Field';
import { ScriptureText } from '@/components/ScriptureText';
import { useAutofocus } from '@/hooks/useAutofocus';
import { matchReference, type ReferenceMatch } from '@/lib/text/reference';
import { truncate } from '@/utils/format';
import { suggestRating, type ReviewModeProps } from '../modeTypes';

type Direction = 'text-to-reference' | 'reference-to-text';

export function ReferenceMode({
  verse,
  settings,
  onComplete,
  attemptKey,
}: ReviewModeProps) {
  const [direction, setDirection] = useState<Direction>('text-to-reference');
  const [entry, setEntry] = useState('');
  const [outcome, setOutcome] = useState<ReferenceMatch | null>(null);
  const [revealed, setRevealed] = useState(false);
  const startedAt = useRef(Date.now());
  const completed = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEntry('');
    setOutcome(null);
    setRevealed(false);
    startedAt.current = Date.now();
    completed.current = false;
  }, [attemptKey, direction]);

  useAutofocus(
    inputRef,
    [attemptKey, direction],
    direction === 'text-to-reference' && outcome === null,
  );

  const finish = (accuracy: number, fullReveal = false) => {
    if (completed.current) return;
    completed.current = true;
    onComplete({
      mode: 'reference',
      accuracy,
      elapsedMs: Date.now() - startedAt.current,
      incorrectCount: accuracy === 1 ? 0 : 1,
      hintCount: 0,
      fullRevealUsed: fullReveal,
      wordErrors: [],
      suggestedRating: suggestRating(accuracy, { fullReveal }),
    });
  };

  const checkReference = () => {
    if (outcome) return;
    const match = matchReference(entry, verse.reference);
    setOutcome(match);
    finish(match.isMatch ? 1 : match.isCloseMatch ? 0.5 : 0);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-muted">
          {direction === 'text-to-reference'
            ? 'Read the passage and name its reference.'
            : 'Read the reference and recall the passage.'}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            setDirection(
              direction === 'text-to-reference'
                ? 'reference-to-text'
                : 'text-to-reference',
            )
          }
          disabled={outcome !== null || revealed}
        >
          <ArrowLeftRight className="size-4" aria-hidden="true" />
          Switch direction
        </Button>
      </div>

      {direction === 'text-to-reference' ? (
        <>
          <div className="rounded-xl border border-line bg-surface px-5 py-6">
            <ScriptureText text={verse.text} />
            {settings.showSectionLabels ? (
              <p className="mt-3 text-xs text-ink-subtle">{verse.section}</p>
            ) : null}
          </div>

          <Field
            label="Reference"
            htmlFor={`reference-entry-${attemptKey}`}
            hint="Abbreviations are accepted, for example Jn 3:16 or 1 Cor 13:4-7."
          >
            <TextInput
              ref={inputRef}
              id={`reference-entry-${attemptKey}`}
              name={`reference-entry-${attemptKey}`}
              value={entry}
              onChange={(event) => setEntry(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  checkReference();
                }
              }}
              disabled={outcome !== null}
              placeholder="Book chapter:verse"
              autoFocus
            />
          </Field>

          {outcome === null ? (
            <Button
              variant="primary"
              onClick={checkReference}
              disabled={entry.trim() === ''}
            >
              <Check className="size-4" aria-hidden="true" />
              Check reference
            </Button>
          ) : (
            <div
              className={clsx(
                'rounded-lg border px-4 py-3 text-sm',
                outcome.isMatch
                  ? 'border-success/30 bg-success-soft text-success'
                  : 'border-danger/30 bg-danger-soft text-danger',
              )}
              role="status"
            >
              <p className="font-medium">
                {outcome.isMatch ? 'Correct' : outcome.message}
              </p>
              {!outcome.isMatch ? (
                <p className="mt-1 text-ink-muted">
                  The passage is {verse.reference}.
                </p>
              ) : null}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="rounded-xl border border-line bg-surface px-5 py-8 text-center">
            <p className="font-serif text-2xl font-semibold text-ink">
              {verse.reference}
            </p>
            <p className="mt-2 text-sm text-ink-muted">
              {revealed ? '' : 'Recall the passage, then reveal it.'}
            </p>
            {revealed ? (
              <div className="mt-4 text-left">
                <ScriptureText text={verse.text} />
              </div>
            ) : (
              <p className="mt-4 font-serif text-sm text-ink-subtle">
                {truncate(verse.text, 40)}
              </p>
            )}
          </div>

          {!revealed ? (
            <Button
              variant="primary"
              onClick={() => {
                setRevealed(true);
                finish(1);
              }}
            >
              <Eye className="size-4" aria-hidden="true" />
              Reveal passage
            </Button>
          ) : (
            <p className="text-sm text-ink-muted">
              Rate how closely your recollection matched the passage.
            </p>
          )}
        </>
      )}
    </div>
  );
}

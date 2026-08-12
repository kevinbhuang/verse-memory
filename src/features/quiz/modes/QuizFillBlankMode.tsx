import { useEffect, useMemo, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { chooseBlankIndexes } from '@/lib/text/blanks';
import { segmentText, tokenize } from '@/lib/text/tokenize';
import type { QuizModeProps } from '../quizModeTypes';

/** Cloze: fill missing words in the passage. */
export function QuizFillBlankMode({
  verse,
  attemptKey,
  onComplete,
}: QuizModeProps) {
  const tokens = useMemo(() => tokenize(verse.text), [verse.text]);
  const blankIndexes = useMemo(
    () =>
      chooseBlankIndexes(
        tokens.map((token) => token.text),
        `${verse.id}:${attemptKey}`,
      ),
    [attemptKey, tokens, verse.id],
  );
  const blankSet = useMemo(() => new Set(blankIndexes), [blankIndexes]);

  const [values, setValues] = useState<Record<number, string>>({});
  const [checked, setChecked] = useState(false);
  const [perBlank, setPerBlank] = useState<Record<number, boolean>>({});
  const startedAt = useRef(Date.now());
  const completed = useRef(false);
  const firstBlankRef = useRef<HTMLInputElement>(null);
  const firstBlankIndex = blankIndexes[0];

  useEffect(() => {
    setValues({});
    setChecked(false);
    setPerBlank({});
    startedAt.current = Date.now();
    completed.current = false;
    const id = window.requestAnimationFrame(() => {
      firstBlankRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [attemptKey]);

  const check = () => {
    if (completed.current) return;
    const results: Record<number, boolean> = {};
    let hits = 0;
    for (const index of blankIndexes) {
      const expected = tokens[index];
      const typed = (values[index] ?? '').trim();
      const ok = Boolean(
        expected && typed && tokenize(typed)[0]?.normalized === expected.normalized,
      );
      results[index] = ok;
      if (ok) hits += 1;
    }
    const accuracy = blankIndexes.length === 0 ? 1 : hits / blankIndexes.length;
    const correct = hits === blankIndexes.length;

    setPerBlank(results);
    setChecked(true);
    completed.current = true;
    onComplete({
      correct,
      accuracy,
      elapsedMs: Date.now() - startedAt.current,
    });
  };

  const segments = useMemo(() => segmentText(verse.text), [verse.text]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-2xl font-semibold text-ink sm:text-3xl">
          {verse.reference}
        </h2>
        <p className="mt-2 text-sm text-ink-muted">
          Fill in the missing words.
        </p>
      </div>

      <div className="scripture rounded-xl border border-line bg-surface px-5 py-6 text-lg leading-relaxed">
        {segments.map((segment, i) => {
          if (segment.type === 'gap') {
            return <span key={`g-${i}`}>{segment.text}</span>;
          }
          if (!blankSet.has(segment.wordIndex)) {
            return <span key={`w-${segment.wordIndex}`}>{segment.text}</span>;
          }

          const ok = perBlank[segment.wordIndex];
          const isFirst = segment.wordIndex === firstBlankIndex;
          return (
            <input
              key={`b-${segment.wordIndex}`}
              ref={isFirst ? firstBlankRef : undefined}
              type="text"
              value={values[segment.wordIndex] ?? ''}
              disabled={checked}
              autoFocus={isFirst}
              aria-label={`Blank ${blankIndexes.indexOf(segment.wordIndex) + 1}`}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  [segment.wordIndex]: event.target.value,
                }))
              }
              onKeyDown={(event) => {
                if (event.key !== 'Enter' || checked) return;
                event.preventDefault();
                event.stopPropagation();
                check();
              }}
              className={`mx-0.5 inline-block min-w-[4.5rem] border-b-2 bg-transparent px-1 text-center font-serif outline-none ${
                checked
                  ? ok
                    ? 'border-success text-success'
                    : 'border-danger text-danger'
                  : 'border-accent text-ink'
              }`}
              style={{ width: `${Math.max(4.5, segment.text.length * 0.7)}rem` }}
            />
          );
        })}
      </div>

      {checked ? (
        <div className="rounded-lg border border-line bg-surface-muted px-4 py-3 text-sm text-ink-muted">
          {blankIndexes.map((index) =>
            perBlank[index] ? null : (
              <p key={index}>
                Blank {blankIndexes.indexOf(index) + 1}:{' '}
                <span className="font-medium text-ink">{tokens[index]?.text}</span>
              </p>
            ),
          )}
          {Object.values(perBlank).every(Boolean) ? (
            <p className="font-medium text-success">All blanks correct.</p>
          ) : null}
        </div>
      ) : (
        <Button variant="primary" onClick={check}>
          <Check className="size-4" aria-hidden="true" />
          Check answers
        </Button>
      )}
    </div>
  );
}

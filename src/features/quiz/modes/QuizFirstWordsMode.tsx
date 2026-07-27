import { useEffect, useMemo, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Field';
import { tokenize } from '@/lib/text/tokenize';
import type { QuizModeProps } from '../quizModeTypes';

/** Show the reference; grade the first three words of the passage. */
export function QuizFirstWordsMode({
  verse,
  attemptKey,
  onComplete,
}: QuizModeProps) {
  const expected = useMemo(() => tokenize(verse.text).slice(0, 3), [verse.text]);
  const expectedLabel = expected.map((token) => token.text).join(' ');

  const [entry, setEntry] = useState('');
  const [checked, setChecked] = useState(false);
  const [correct, setCorrect] = useState(false);
  const startedAt = useRef(Date.now());
  const completed = useRef(false);

  useEffect(() => {
    setEntry('');
    setChecked(false);
    setCorrect(false);
    startedAt.current = Date.now();
    completed.current = false;
  }, [attemptKey]);

  const check = () => {
    if (completed.current) return;
    const typed = tokenize(entry).slice(0, 3);
    let hits = 0;
    for (let i = 0; i < expected.length; i += 1) {
      if (typed[i] && typed[i]!.normalized === expected[i]!.normalized) {
        hits += 1;
      }
    }
    const accuracy = expected.length === 0 ? 0 : hits / expected.length;
    const isCorrect =
      hits === expected.length && typed.length >= expected.length;

    setChecked(true);
    setCorrect(isCorrect);
    completed.current = true;
    onComplete({
      correct: isCorrect,
      accuracy,
      elapsedMs: Date.now() - startedAt.current,
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-2xl font-semibold text-ink sm:text-3xl">
          {verse.reference}
        </h2>
        <p className="mt-2 text-sm text-ink-muted">
          Type the first three words of this passage.
        </p>
      </div>

      <Field label="First three words" htmlFor="quiz-first-words">
        <TextInput
          id="quiz-first-words"
          value={entry}
          onChange={(event) => setEntry(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              check();
            }
          }}
          disabled={checked}
          placeholder="Word word word"
          autoFocus
        />
      </Field>

      {checked ? (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            correct
              ? 'border-success/40 bg-success-soft text-success'
              : 'border-danger/40 bg-danger-soft text-danger'
          }`}
          role="status"
        >
          <p className="font-medium">{correct ? 'Correct.' : 'Not quite.'}</p>
          <p className="mt-1 opacity-90">Answer: {expectedLabel}</p>
        </div>
      ) : (
        <Button variant="primary" onClick={check} disabled={entry.trim() === ''}>
          <Check className="size-4" aria-hidden="true" />
          Check
        </Button>
      )}
    </div>
  );
}

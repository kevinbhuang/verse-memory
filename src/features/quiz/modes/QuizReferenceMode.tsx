import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Field';
import { ScriptureText } from '@/components/ScriptureText';
import {
  matchBookAndChapter,
  type ReferenceMatch,
} from '@/lib/text/reference';
import type { QuizModeProps } from '../quizModeTypes';

/** Show the passage; grade book + chapter (verses optional). */
export function QuizReferenceMode({
  verse,
  attemptKey,
  onComplete,
}: QuizModeProps) {
  const [entry, setEntry] = useState('');
  const [outcome, setOutcome] = useState<ReferenceMatch | null>(null);
  const startedAt = useRef(Date.now());
  const completed = useRef(false);

  useEffect(() => {
    setEntry('');
    setOutcome(null);
    startedAt.current = Date.now();
    completed.current = false;
  }, [attemptKey]);

  const check = () => {
    if (completed.current) return;
    const match = matchBookAndChapter(entry, verse.reference);
    setOutcome(match);
    completed.current = true;
    onComplete({
      correct: match.isMatch,
      accuracy: match.isMatch ? 1 : 0,
      elapsedMs: Date.now() - startedAt.current,
    });
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-ink-muted">
        Read the passage, then type the book and chapter.
      </p>

      <div className="rounded-xl border border-line bg-surface px-5 py-6">
        <ScriptureText text={verse.text} />
      </div>

      <Field
        label="Book and chapter"
        htmlFor="quiz-reference"
        hint="Example: John 3 or Jn 3:16"
      >
        <TextInput
          id="quiz-reference"
          value={entry}
          onChange={(event) => setEntry(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.stopPropagation();
              check();
            }
          }}
          disabled={outcome !== null}
          placeholder="Book chapter"
          autoFocus
        />
      </Field>

      {outcome === null ? (
        <Button variant="primary" onClick={check} disabled={entry.trim() === ''}>
          <Check className="size-4" aria-hidden="true" />
          Check
        </Button>
      ) : (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            outcome.isMatch
              ? 'border-success/40 bg-success-soft text-success'
              : 'border-danger/40 bg-danger-soft text-danger'
          }`}
          role="status"
        >
          <p className="font-medium">{outcome.message}</p>
          <p className="mt-1 opacity-90">Answer: {verse.reference}</p>
        </div>
      )}
    </div>
  );
}

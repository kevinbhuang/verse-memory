import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Field';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { ScriptureText } from '@/components/ScriptureText';
import { useAutofocus } from '@/hooks/useAutofocus';
import {
  matchBookAndChapter,
  matchReference,
  type ReferenceMatch,
} from '@/lib/text/reference';
import {
  DEFAULT_QUIZ_REFERENCE_GRADE,
  type QuizReferenceGrade,
} from '@/types/quiz';
import type { QuizModeProps } from '../quizModeTypes';

const GRADE_OPTIONS: ReadonlyArray<{
  value: QuizReferenceGrade;
  label: string;
}> = [
  { value: 'chapter-and-verse', label: 'Chapter and verse' },
  { value: 'chapter', label: 'Chapter only' },
];

/** Show the passage; grade book + chapter, or the full reference. */
export function QuizReferenceMode({
  verse,
  attemptKey,
  onComplete,
  referenceGrade = DEFAULT_QUIZ_REFERENCE_GRADE,
  onReferenceGradeChange,
}: QuizModeProps) {
  const chapterOnly = referenceGrade === 'chapter';
  const [entry, setEntry] = useState('');
  const [outcome, setOutcome] = useState<ReferenceMatch | null>(null);
  const startedAt = useRef(Date.now());
  const completed = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEntry('');
    setOutcome(null);
    startedAt.current = Date.now();
    completed.current = false;
  }, [attemptKey]);

  useAutofocus(inputRef, [attemptKey], outcome === null);

  const check = () => {
    if (completed.current) return;
    const match = chapterOnly
      ? matchBookAndChapter(entry, verse.reference)
      : matchReference(entry, verse.reference);
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm text-ink-muted">
          {chapterOnly
            ? 'Read the passage, then type the book and chapter.'
            : 'Read the passage, then type the reference.'}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-ink-muted">Test on</span>
          <SegmentedControl
            aria-label="Test on"
            size="sm"
            value={referenceGrade}
            onChange={(grade) => onReferenceGradeChange?.(grade)}
            options={GRADE_OPTIONS}
          />
        </div>
      </div>

      <div className="rounded-xl border border-line bg-surface px-5 py-6">
        <ScriptureText text={verse.text} />
      </div>

      <Field
        label={chapterOnly ? 'Book and chapter' : 'Reference'}
        htmlFor={`quiz-reference-${attemptKey}`}
        hint={
          chapterOnly
            ? 'Example: John 3 or Jn 3:16. Verse numbers are optional.'
            : 'Abbreviations are accepted, for example Jn 3:16 or Job 42:5-6.'
        }
      >
        <TextInput
          ref={inputRef}
          id={`quiz-reference-${attemptKey}`}
          name={`quiz-reference-${attemptKey}`}
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
          placeholder={chapterOnly ? 'Book chapter' : 'Book chapter:verse'}
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

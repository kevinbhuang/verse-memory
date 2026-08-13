import { useEffect, useMemo, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import clsx from 'clsx';
import { Button } from '@/components/ui/Button';
import { Field, TextArea, TextInput } from '@/components/ui/Field';
import { useAutofocus } from '@/hooks/useAutofocus';
import { gradeAttempt, type DiffOp, type GradeResult } from '@/lib/text/diff';
import { matchReference } from '@/lib/text/reference';
import { formatAccuracy, formatDuration } from '@/utils/format';
import { suggestRating, type ReviewModeProps } from '../modeTypes';

const opStyles: Record<DiffOp['type'], string> = {
  correct: 'text-ink',
  missing: 'bg-danger-soft text-danger line-through decoration-danger/50',
  extra: 'bg-warning-soft text-warning line-through decoration-warning/50',
  replaced: 'bg-danger-soft text-danger',
  moved: 'bg-warning-soft text-warning',
};

const opLabels: Record<DiffOp['type'], string> = {
  correct: 'correct',
  missing: 'missing',
  extra: 'added',
  replaced: 'replaced',
  moved: 'out of order',
};

export function FullTypingMode({
  verse,
  settings,
  onComplete,
  attemptKey,
}: ReviewModeProps) {
  const [attemptText, setAttemptText] = useState('');
  const [referenceText, setReferenceText] = useState('');
  const [result, setResult] = useState<GradeResult | null>(null);
  const [referenceCorrect, setReferenceCorrect] = useState<boolean | null>(null);
  const startedAt = useRef(Date.now());
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const referenceRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAttemptText('');
    setReferenceText('');
    setResult(null);
    setReferenceCorrect(null);
    startedAt.current = Date.now();
  }, [attemptKey]);

  const focusReferenceFirst = settings.includeReferenceInGrading;
  useAutofocus(
    focusReferenceFirst ? referenceRef : textAreaRef,
    [attemptKey, focusReferenceFirst],
    result === null,
  );

  const exact = settings.gradingMode === 'exact';

  const gradingOptions = useMemo(
    () => ({
      punctuation: exact && settings.requirePunctuation,
      capitalization: exact && settings.requireCapitalization,
    }),
    [exact, settings.requirePunctuation, settings.requireCapitalization],
  );

  const submit = () => {
    if (result) return;

    const graded = gradeAttempt(verse.text, attemptText, gradingOptions);
    setResult(graded);

    let accuracy = graded.accuracy;
    let referenceOk: boolean | null = null;

    if (settings.includeReferenceInGrading) {
      referenceOk = matchReference(referenceText, verse.reference).isMatch;
      setReferenceCorrect(referenceOk);
      // The reference is one component of the passage, weighted lightly.
      accuracy = accuracy * 0.9 + (referenceOk ? 0.1 : 0);
    }

    onComplete({
      mode: 'full-typing',
      accuracy,
      elapsedMs: Date.now() - startedAt.current,
      incorrectCount:
        graded.missingCount + graded.extraCount + graded.replacedCount,
      hintCount: 0,
      fullRevealUsed: false,
      wordErrors: graded.wordErrors,
      suggestedRating: suggestRating(accuracy),
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="font-serif text-xl font-semibold text-ink">
          {verse.reference}
        </p>
        <p className="text-sm text-ink-muted">
          {exact
            ? `Exact grading${settings.requirePunctuation ? ', punctuation required' : ''}${settings.requireCapitalization ? ', capitalisation required' : ''}.`
            : 'Forgiving grading: case, punctuation and spacing are ignored.'}
        </p>
      </div>

      {settings.includeReferenceInGrading ? (
        <Field label="Reference" htmlFor="full-typing-reference">
          <TextInput
            ref={referenceRef}
            id="full-typing-reference"
            value={referenceText}
            onChange={(event) => setReferenceText(event.target.value)}
            placeholder="e.g. John 3:16"
            disabled={result !== null}
          />
        </Field>
      ) : null}

      <Field
        label="Type the passage from memory"
        htmlFor="full-typing-input"
        hint="Line breaks and spacing do not need to match."
      >
        <TextArea
          ref={textAreaRef}
          id="full-typing-input"
          value={attemptText}
          onChange={(event) => setAttemptText(event.target.value)}
          disabled={result !== null}
          rows={8}
          className="min-h-40 font-serif text-base leading-relaxed"
          autoFocus={!focusReferenceFirst}
        />
      </Field>

      {result === null ? (
        <Button
          variant="primary"
          onClick={submit}
          disabled={attemptText.trim() === ''}
        >
          <Check className="size-4" aria-hidden="true" />
          Check my answer
        </Button>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-line bg-surface-muted px-4 py-3 text-sm">
            <p className="font-medium text-ink">
              {`${formatAccuracy(result.accuracy)} accuracy \u00b7 ${formatDuration(
                Date.now() - startedAt.current,
              )}`}
            </p>
            <p className="mt-1 text-ink-muted">
              {[
                `${result.correctCount} correct`,
                `${result.missingCount} missing`,
                `${result.extraCount} added`,
                `${result.replacedCount} replaced`,
                `${result.movedCount} out of order`,
              ].join(' \u00b7 ')}
              {referenceCorrect !== null
                ? ` \u00b7 reference ${referenceCorrect ? 'correct' : 'incorrect'}`
                : ''}
            </p>
          </div>

          <div className="min-w-0 max-w-full">
            <h3 className="mb-2 text-sm font-semibold text-ink">
              Word-by-word comparison
            </h3>
            <div className="scripture-sm flex max-w-full flex-wrap gap-x-1 gap-y-1.5 rounded-lg border border-line bg-surface px-4 py-3 text-base leading-relaxed break-words">
              {result.ops.map((op, index) => (
                <span
                  key={`${op.type}-${index}`}
                  className={clsx('rounded-sm px-0.5', opStyles[op.type])}
                  title={opLabels[op.type]}
                >
                  {op.type === 'replaced' ? (
                    <>
                      <span className="line-through decoration-danger/50">
                        {op.received}
                      </span>{' '}
                      <span className="font-medium">{op.expected}</span>
                    </>
                  ) : (
                    (op.expected ?? op.received)
                  )}
                </span>
              ))}
            </div>
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
              <li>Plain: correct</li>
              <li className="text-danger">Struck through in red: missing</li>
              <li className="text-warning">Amber: added or out of order</li>
              <li className="text-danger">
                Red pair: what you wrote, then the passage
              </li>
            </ul>
          </div>

          <details className="rounded-lg border border-line bg-surface px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium text-ink">
              Show the passage
            </summary>
            <p className="scripture mt-3">{verse.text}</p>
          </details>
        </div>
      )}
    </div>
  );
}

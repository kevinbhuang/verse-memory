import { useEffect, useRef, useState } from 'react';
import { Check, Mic, Square } from 'lucide-react';
import clsx from 'clsx';
import { Button } from '@/components/ui/Button';
import { ScriptureText } from '@/components/ScriptureText';
import {
  gradeAttempt,
  type DiffOp,
  type GradeResult,
} from '@/lib/text/diff';
import { formatAccuracy } from '@/utils/format';
import { suggestRating, type ReviewModeProps } from '../modeTypes';

/**
 * Minimal typings for the Web Speech API, which is not in the DOM lib.
 */
type SpeechRecognitionAlternative = { transcript: string };
type SpeechRecognitionResult = {
  0: SpeechRecognitionAlternative;
  isFinal: boolean;
  length: number;
};
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResult;
  };
};
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const candidate =
    (window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor })
      .SpeechRecognition ??
    (
      window as unknown as {
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
      }
    ).webkitSpeechRecognition;
  return candidate ?? null;
}

const opStyles: Record<DiffOp['type'], string> = {
  correct: 'bg-success-soft text-success',
  missing: 'bg-danger-soft text-danger line-through decoration-danger/50',
  extra: 'bg-warning-soft text-warning line-through decoration-warning/50',
  replaced: 'bg-danger-soft text-danger',
  moved: 'bg-warning-soft text-warning',
};

const opLabels: Record<DiffOp['type'], string> = {
  correct: 'correct',
  missing: 'missing from what was heard',
  extra: 'heard but not in the passage',
  replaced: 'substituted',
  moved: 'out of order',
};

function WordComparison({ ops }: { ops: DiffOp[] }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-ink">
        Word-by-word comparison
      </h3>
      <p
        className="scripture-sm rounded-lg border border-line bg-surface px-4 py-3 text-base leading-relaxed"
        aria-label="Comparison of what was heard with the passage"
      >
        {ops.map((op, index) => (
          <span
            key={`${op.type}-${index}`}
            className={clsx('mr-1 inline rounded-sm px-0.5', opStyles[op.type])}
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
      </p>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
        <li className="text-success">Green: correct</li>
        <li className="text-danger">Red: missing or wrong</li>
        <li className="text-warning">Amber: extra words heard</li>
      </ul>
    </div>
  );
}

export function VoiceMode({ verse, onComplete, attemptKey }: ReviewModeProps) {
  const [supported] = useState(() => getRecognitionConstructor() !== null);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GradeResult | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    setTranscript('');
    setResult(null);
    setError(null);
    startedAt.current = Date.now();
  }, [attemptKey]);

  useEffect(
    () => () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    },
    [],
  );

  const start = () => {
    const Recognition = getRecognitionConstructor();
    if (!Recognition) return;

    const recognition = new Recognition();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let text = '';
      for (let index = 0; index < event.results.length; index += 1) {
        text += `${event.results[index][0].transcript} `;
      }
      setTranscript(text.trim());
    };
    recognition.onerror = (event) => {
      setError(
        event.error === 'not-allowed'
          ? 'Microphone access was refused. Grant permission or use another mode.'
          : `Speech recognition stopped: ${event.error}.`,
      );
      setListening(false);
    };
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    startedAt.current = Date.now();
    setTranscript('');
    setError(null);
    setListening(true);
    recognition.start();
  };

  const stop = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  const grade = () => {
    if (result) return;
    const graded = gradeAttempt(verse.text, transcript, {});
    setResult(graded);
    onComplete({
      mode: 'voice',
      accuracy: graded.accuracy,
      elapsedMs: Date.now() - startedAt.current,
      incorrectCount: graded.missingCount + graded.replacedCount,
      hintCount: 0,
      fullRevealUsed: false,
      // Transcription is approximate, so word errors are not written back into
      // the weak-word statistics from this mode.
      wordErrors: [],
      suggestedRating: suggestRating(graded.accuracy),
    });
  };

  if (!supported) {
    return (
      <div className="space-y-4">
        <p className="font-serif text-xl font-semibold text-ink">
          {verse.reference}
        </p>
        <div className="rounded-lg border border-line bg-surface-muted px-4 py-3 text-sm text-ink-muted">
          This browser does not provide speech recognition. Recite the passage
          aloud from the reference, then reveal it and rate yourself.
        </div>
        <details className="rounded-lg border border-line bg-surface px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-ink">
            Reveal the passage
          </summary>
          <div className="mt-3">
            <ScriptureText text={verse.text} />
          </div>
        </details>
        <Button
          variant="primary"
          onClick={() =>
            onComplete({
              mode: 'voice',
              accuracy: null,
              elapsedMs: Date.now() - startedAt.current,
              incorrectCount: 0,
              hintCount: 0,
              fullRevealUsed: false,
              wordErrors: [],
              suggestedRating: 'good',
            })
          }
        >
          <Check className="size-4" aria-hidden="true" />
          I have recited this
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="font-serif text-xl font-semibold text-ink">
          {verse.reference}
        </p>
        <p className="text-sm text-ink-muted">
          Speech grading is approximate: browser transcription mishears words,
          adds no punctuation and cannot judge pauses.
        </p>
      </div>

      <div className="min-h-24 rounded-xl border border-line bg-surface px-4 py-3">
        <p className="text-xs font-medium tracking-wide text-ink-subtle uppercase">
          Transcript
        </p>
        <p className="mt-2 font-serif text-base text-ink" aria-live="polite">
          {transcript || (listening ? 'Listening\u2026' : 'Nothing recorded yet.')}
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {listening ? (
          <Button variant="secondary" onClick={stop}>
            <Square className="size-4" aria-hidden="true" />
            Stop
          </Button>
        ) : (
          <Button variant="primary" onClick={start} disabled={result !== null}>
            <Mic className="size-4" aria-hidden="true" />
            {transcript ? 'Record again' : 'Start reciting'}
          </Button>
        )}

        <Button
          variant="secondary"
          onClick={grade}
          disabled={transcript.trim() === '' || result !== null}
        >
          <Check className="size-4" aria-hidden="true" />
          Compare with the passage
        </Button>
      </div>

      {result ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-line bg-surface-muted px-4 py-3 text-sm">
            <p className="font-medium text-ink">
              {`Approximate accuracy ${formatAccuracy(result.accuracy)}`}
            </p>
            <p className="mt-1 text-ink-muted">
              {`${result.correctCount} correct \u00b7 ${result.missingCount} not heard \u00b7 ${result.replacedCount} substituted \u00b7 ${result.extraCount} extra`}
            </p>
          </div>

          <WordComparison ops={result.ops} />

          <details className="rounded-lg border border-line bg-surface px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium text-ink">
              Show the unmarked passage
            </summary>
            <div className="mt-3">
              <ScriptureText text={verse.text} />
            </div>
          </details>
        </div>
      ) : null}
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Check, RotateCcw } from 'lucide-react';
import clsx from 'clsx';
import { Button } from '@/components/ui/Button';
import { ScriptureText } from '@/components/ScriptureText';
import { useHotkeys } from '@/hooks/useHotkeys';
import { tokenize } from '@/lib/text/tokenize';
import { alternatingWordIndexes, selectWordsToHide } from '@/lib/weakWords';
import type { WordError } from '@/types';
import { suggestRating, type ReviewModeProps } from '../modeTypes';

const LEVELS = [
  { level: 1, ratio: 0.2, label: 'Level 1 \u00b7 20% hidden' },
  { level: 2, ratio: 0.4, label: 'Level 2 \u00b7 40% hidden' },
  { level: 3, ratio: 0.6, label: 'Level 3 \u00b7 60% hidden' },
  { level: 4, ratio: 0.8, label: 'Level 4 \u00b7 80% hidden' },
  { level: 5, ratio: 1, label: 'Level 5 \u00b7 every word hidden' },
] as const;

type Pattern = 'weighted' | 'alternating' | 'first-letters';

export function ProgressiveHideMode({
  verse,
  wordStats,
  onComplete,
  attemptKey,
}: ReviewModeProps) {
  const tokens = useMemo(() => tokenize(verse.text), [verse.text]);

  const [level, setLevel] = useState(1);
  const [pattern, setPattern] = useState<Pattern>('weighted');
  const [attempt, setAttempt] = useState(0);
  const [revealedWords, setRevealedWords] = useState<number[]>([]);
  const [finished, setFinished] = useState(false);
  const [startedAt, setStartedAt] = useState(() => Date.now());

  useEffect(() => {
    setLevel(1);
    setPattern('weighted');
    setAttempt(0);
    setRevealedWords([]);
    setFinished(false);
    setStartedAt(Date.now());
  }, [attemptKey]);

  const ratio = LEVELS.find((entry) => entry.level === level)?.ratio ?? 0.2;

  // Hidden words are recomputed only when the level, pattern or attempt
  // changes, so blanks never move while the reader is working.
  const hidden = useMemo(() => {
    if (pattern === 'alternating') {
      return new Set(alternatingWordIndexes(verse.text));
    }
    if (pattern === 'first-letters') {
      return new Set(tokens.map((token) => token.wordIndex));
    }
    return new Set(selectWordsToHide(verse.text, ratio, wordStats, attempt + 1));
  }, [attempt, pattern, ratio, tokens, verse.text, wordStats]);

  const revealed = useMemo(() => new Set(revealedWords), [revealedWords]);

  const revealWord = useCallback((wordIndex: number) => {
    setRevealedWords((current) =>
      current.includes(wordIndex) ? current : [...current, wordIndex],
    );
  }, []);

  const restart = (nextLevel: number) => {
    setLevel(nextLevel);
    setRevealedWords([]);
    setFinished(false);
    setAttempt((current) => current + 1);
    setStartedAt(Date.now());
  };

  const complete = useCallback(() => {
    if (finished) return;
    setFinished(true);

    const hiddenCount = hidden.size;
    const hintCount = revealedWords.length;
    const accuracy =
      hiddenCount === 0 ? 1 : Math.max(0, (hiddenCount - hintCount) / hiddenCount);

    const wordErrors: WordError[] = revealedWords.map((wordIndex) => ({
      wordIndex,
      expected: tokens[wordIndex]?.text ?? '',
      received: null,
      errorType: 'hint',
    }));

    onComplete({
      mode: 'progressive-hide',
      accuracy,
      elapsedMs: Date.now() - startedAt,
      incorrectCount: 0,
      hintCount,
      fullRevealUsed: hiddenCount > 0 && hintCount >= hiddenCount,
      wordErrors,
      suggestedRating: suggestRating(accuracy, { hints: hintCount }),
    });
  }, [finished, hidden.size, onComplete, revealedWords, startedAt, tokens]);

  const revealFirstHidden = useCallback(() => {
    const next = [...hidden]
      .sort((a, b) => a - b)
      .find((index) => !revealed.has(index));
    if (next !== undefined) revealWord(next);
  }, [hidden, revealed, revealWord]);

  const hotkeys = useMemo(() => ({ h: revealFirstHidden }), [revealFirstHidden]);
  useHotkeys(hotkeys);

  const remaining = hidden.size - revealedWords.length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-serif text-xl font-semibold text-ink">
          {verse.reference}
        </p>
        <p className="text-sm text-ink-muted tabular-nums" aria-live="polite">
          {remaining} of {hidden.size} blanks remaining
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {LEVELS.map((entry) => (
          <button
            key={entry.level}
            type="button"
            onClick={() => {
              setPattern('weighted');
              restart(entry.level);
            }}
            aria-pressed={pattern === 'weighted' && level === entry.level}
            className={clsx(
              'rounded-md border px-2.5 py-1 text-xs font-medium',
              pattern === 'weighted' && level === entry.level
                ? 'border-accent bg-accent-soft text-accent'
                : 'border-line-strong bg-surface text-ink-muted hover:bg-surface-muted',
            )}
          >
            {entry.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setPattern('alternating');
            setRevealedWords([]);
            setFinished(false);
            setStartedAt(Date.now());
          }}
          aria-pressed={pattern === 'alternating'}
          className={clsx(
            'rounded-md border px-2.5 py-1 text-xs font-medium',
            pattern === 'alternating'
              ? 'border-accent bg-accent-soft text-accent'
              : 'border-line-strong bg-surface text-ink-muted hover:bg-surface-muted',
          )}
        >
          Every other word
        </button>
        <button
          type="button"
          onClick={() => {
            setPattern('first-letters');
            setRevealedWords([]);
            setFinished(false);
            setStartedAt(Date.now());
          }}
          aria-pressed={pattern === 'first-letters'}
          className={clsx(
            'rounded-md border px-2.5 py-1 text-xs font-medium',
            pattern === 'first-letters'
              ? 'border-accent bg-accent-soft text-accent'
              : 'border-line-strong bg-surface text-ink-muted hover:bg-surface-muted',
          )}
        >
          First letters only
        </button>
      </div>

      <div className="rounded-xl border border-line bg-surface px-5 py-6">
        <ScriptureText
          text={verse.text}
          hidden={hidden}
          revealed={revealed}
          blankStyle={pattern === 'first-letters' ? 'first-letter' : 'rule'}
          onWordClick={revealWord}
          wordButtonLabel={(wordIndex) =>
            `Reveal word ${wordIndex + 1} (counts as a hint)`
          }
        />
      </div>

      <p className="text-xs text-ink-muted">
        Recite the passage and select a blank if you need it. Each reveal counts
        as a hint. Press H to reveal the next blank.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={complete} disabled={finished}>
          <Check className="size-4" aria-hidden="true" />
          I have recited this
        </Button>
        <Button
          variant="secondary"
          onClick={() => restart(Math.min(5, level + 1))}
          disabled={level >= 5 && pattern === 'weighted'}
        >
          <ArrowUpRight className="size-4" aria-hidden="true" />
          Restart one level harder
        </Button>
        <Button variant="ghost" onClick={() => restart(level)}>
          <RotateCcw className="size-4" aria-hidden="true" />
          Restart this level
        </Button>
      </div>

      {finished ? (
        <p className="rounded-lg border border-line bg-surface-muted px-4 py-3 text-sm text-ink">
          Recorded {revealedWords.length} hint
          {revealedWords.length === 1 ? '' : 's'} on {hidden.size} hidden word
          {hidden.size === 1 ? '' : 's'}.
        </p>
      ) : null}
    </div>
  );
}

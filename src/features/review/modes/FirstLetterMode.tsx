import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { Eye, Lightbulb, RotateCcw, Undo2 } from 'lucide-react';
import clsx from 'clsx';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { Toggle } from '@/components/ui/Field';
import { ScriptureText } from '@/components/ScriptureText';
import { useAutofocus } from '@/hooks/useAutofocus';
import { useSettings } from '@/hooks/useSettings';
import { tokenize } from '@/lib/text/tokenize';
import { heatLevel } from '@/lib/weakWords';
import { formatDuration } from '@/utils/format';
import type { WordError } from '@/types';
import { suggestRating, type ReviewModeProps } from '../modeTypes';

type Mistake = { wordIndex: number; typed: string };

export function FirstLetterMode({
  verse,
  settings,
  wordStats,
  onComplete,
  attemptKey,
  onRetry,
  onShowFirstLetterSkeletonChange,
}: ReviewModeProps) {
  const { update: updateSettings } = useSettings();
  const tokens = useMemo(() => tokenize(verse.text), [verse.text]);

  const [index, setIndex] = useState(0);
  const [mistakes, setMistakes] = useState<Mistake[]>([]);
  const [hintedWords, setHintedWords] = useState<number[]>([]);
  const [lastKeyWrong, setLastKeyWrong] = useState(false);
  const [fullReveal, setFullReveal] = useState(false);
  const [confirmReveal, setConfirmReveal] = useState(false);
  const [finished, setFinished] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [localAttempt, setLocalAttempt] = useState(0);

  const startedAt = useRef(Date.now());
  const inputRef = useRef<HTMLInputElement>(null);
  const completedRef = useRef(false);

  useEffect(() => {
    setIndex(0);
    setMistakes([]);
    setHintedWords([]);
    setLastKeyWrong(false);
    setFullReveal(false);
    setFinished(false);
    setElapsedMs(0);
    startedAt.current = Date.now();
    completedRef.current = false;
  }, [attemptKey, localAttempt]);

  useAutofocus(inputRef, [attemptKey, localAttempt], !finished && !fullReveal);

  const retry = () => {
    onRetry?.();
    setLocalAttempt((current) => current + 1);
  };

  const heat = useMemo(() => {
    const map = new Map<number, ReturnType<typeof heatLevel>>();
    for (const stat of wordStats) {
      const level = heatLevel(stat);
      if (level > 0) map.set(stat.wordIndex, level);
    }
    return map;
  }, [wordStats]);

  const finish = useCallback(
    (options: { revealed: boolean; reachedIndex: number }) => {
      if (completedRef.current) return;
      completedRef.current = true;

      const duration = Date.now() - startedAt.current;
      setElapsedMs(duration);
      setFinished(true);

      const missedWordIndexes = new Set(
        mistakes.map((mistake) => mistake.wordIndex),
      );
      for (const wordIndex of hintedWords) missedWordIndexes.add(wordIndex);

      const notReached = options.revealed
        ? tokens.length - options.reachedIndex
        : 0;

      const cleanWords = Math.max(
        0,
        tokens.length - missedWordIndexes.size - notReached,
      );
      const accuracy = tokens.length === 0 ? 1 : cleanWords / tokens.length;

      const wordErrors: WordError[] = [
        ...mistakes.map((mistake) => ({
          wordIndex: mistake.wordIndex,
          expected: tokens[mistake.wordIndex]?.text ?? '',
          received: mistake.typed,
          errorType: 'incorrect' as const,
        })),
        ...hintedWords.map((wordIndex) => ({
          wordIndex,
          expected: tokens[wordIndex]?.text ?? '',
          received: null,
          errorType: 'hint' as const,
        })),
      ];

      if (options.revealed) {
        for (let i = options.reachedIndex; i < tokens.length; i += 1) {
          wordErrors.push({
            wordIndex: i,
            expected: tokens[i].text,
            received: null,
            errorType: 'missing',
          });
        }
      }

      onComplete({
        mode: 'first-letter',
        accuracy,
        elapsedMs: duration,
        incorrectCount: mistakes.length,
        hintCount: hintedWords.length,
        fullRevealUsed: options.revealed,
        wordErrors,
        suggestedRating: suggestRating(accuracy, {
          hints: hintedWords.length,
          fullReveal: options.revealed,
        }),
      });
    },
    [hintedWords, mistakes, onComplete, tokens],
  );

  const advance = useCallback(
    (nextIndex: number) => {
      setIndex(nextIndex);
      if (nextIndex >= tokens.length) {
        finish({ revealed: false, reachedIndex: nextIndex });
      }
    },
    [finish, tokens.length],
  );

  const revealNextWord = useCallback(() => {
    if (finished || index >= tokens.length) return;
    setHintedWords((current) =>
      current.includes(index) ? current : [...current, index],
    );
    advance(index + 1);
  }, [advance, finished, index, tokens.length]);

  const revealEverything = useCallback(() => {
    setFullReveal(true);
    finish({ revealed: true, reachedIndex: index });
    setIndex(tokens.length);
  }, [finish, index, tokens.length]);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (finished) return;

    if (event.key === 'Backspace') {
      event.preventDefault();
      if (settings.allowBackspaceInFirstLetter && index > 0) {
        setIndex(index - 1);
        setLastKeyWrong(false);
      }
      return;
    }

    if (event.key === 'Enter' && event.shiftKey) {
      event.preventDefault();
      revealNextWord();
      return;
    }

    // Modifier combinations belong to the browser, not the exercise.
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key.length !== 1) return;

    // Keep global nav hotkeys (p/l/c/q/digits) from stealing letter keys.
    event.preventDefault();
    event.stopPropagation();
    const expected = tokens[index];
    if (!expected) return;

    // Shift and Caps Lock differences are irrelevant: only the letter matters.
    if (event.key.toLowerCase() === expected.firstLetter) {
      setLastKeyWrong(false);
      advance(index + 1);
    } else {
      setLastKeyWrong(true);
      setMistakes((current) => [
        ...current,
        { wordIndex: index, typed: event.key },
      ]);
    }
  };

  // Once the last word is in, the canonical text is shown whole so its closing
  // punctuation is not left off; before that it is cut at the last word typed.
  const revealedText =
    index >= tokens.length
      ? verse.text
      : index === 0
        ? ''
        : verse.text.slice(0, tokens[index - 1].end);

  const upcoming = tokens.slice(index, index + 12);
  const currentToken = tokens[index];
  const progressPercent =
    tokens.length === 0 ? 100 : Math.round((index / tokens.length) * 100);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="font-serif text-xl font-semibold text-ink">
            {verse.reference}
          </p>
          {settings.showSectionLabels ? (
            <p className="text-sm text-ink-muted">{verse.section}</p>
          ) : null}
        </div>
        <p className="text-sm text-ink-muted tabular-nums" aria-live="polite">
          {index} of {tokens.length} words
          {mistakes.length > 0 ? ` \u00b7 ${mistakes.length} wrong keys` : ''}
          {hintedWords.length > 0 ? ` \u00b7 ${hintedWords.length} hints` : ''}
        </p>
      </div>

      <div className="h-1 w-full overflow-hidden rounded-full bg-surface-sunken">
        <div
          className="h-full bg-brand transition-[width]"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.focus()}
        className="w-full cursor-text rounded-xl border border-line bg-surface px-5 py-6 text-left"
        aria-label="Focus the typing area"
      >
        {revealedText === '' && !finished ? (
          <p className="scripture text-ink-subtle">
            Type the first letter of the first word to begin.
          </p>
        ) : (
          <ScriptureText text={revealedText} heat={heat} />
        )}

        {!finished && currentToken ? (
          <span
            className={clsx(
              'ml-1 inline-block rounded border-b-2 px-2 py-0.5 align-baseline font-mono text-sm',
              lastKeyWrong
                ? 'border-danger bg-danger-soft text-danger'
                : 'border-accent bg-accent-soft text-accent',
            )}
            aria-live="assertive"
          >
            {settings.blindFirstLetterMode
              ? '?'
              : settings.showFirstLetterSkeleton
                ? currentToken.firstLetter
                : '\u2022'}
          </span>
        ) : null}
      </button>

      <label htmlFor="first-letter-input" className="sr-only">
        Type the first letter of each word of {verse.reference}
      </label>
      <input
        id="first-letter-input"
        ref={inputRef}
        type="text"
        inputMode="text"
        autoCapitalize="none"
        autoCorrect="off"
        autoComplete="vm-no-autofill"
        spellCheck={false}
        value=""
        onChange={() => undefined}
        onKeyDown={handleKeyDown}
        disabled={finished}
        // Kept on-screen but visually minimal so mobile keyboards open.
        className="h-10 w-full rounded-lg border border-line-strong bg-surface-muted px-3 text-center text-sm text-ink placeholder:text-ink-subtle"
        placeholder={
          finished
            ? 'Passage complete'
            : 'Type here \u2014 one letter per word'
        }
        aria-describedby="first-letter-help"
        autoFocus
      />

      <p id="first-letter-help" className="text-xs text-ink-muted">
        Punctuation, capitalisation and line breaks are handled for you.
        {settings.allowBackspaceInFirstLetter
          ? ' Backspace steps back one word.'
          : ' Backspace is disabled in settings.'}{' '}
        Shift+Enter reveals the next word as a hint.
      </p>

      {!settings.blindFirstLetterMode && settings.showFirstLetterSkeleton && !finished ? (
        <p className="font-mono text-xs tracking-[0.3em] text-ink-subtle">
          {upcoming.map((token) => token.firstLetter).join(' ')}
          {index + 12 < tokens.length ? ' \u2026' : ''}
        </p>
      ) : null}

      {!finished && !settings.blindFirstLetterMode && onRetry ? (
        <Toggle
          id="show-next-first-letter"
          label="Show next letter"
          description="Preview the letter to type next and upcoming first letters."
          checked={settings.showFirstLetterSkeleton}
          onChange={(checked) => {
            if (onShowFirstLetterSkeletonChange) {
              onShowFirstLetterSkeletonChange(checked);
              return;
            }
            void updateSettings({ showFirstLetterSkeleton: checked });
          }}
        />
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={revealNextWord}
          disabled={finished}
          title="Reveal the next word (H)"
        >
          <Lightbulb className="size-4" aria-hidden="true" />
          Hint
        </Button>

        {settings.allowBackspaceInFirstLetter ? (
          <Button
            variant="ghost"
            onClick={() => setIndex((current) => Math.max(0, current - 1))}
            disabled={finished || index === 0}
          >
            <Undo2 className="size-4" aria-hidden="true" />
            Back one word
          </Button>
        ) : null}

        <Button
          variant="ghost"
          onClick={() =>
            settings.confirmBeforeFullReveal
              ? setConfirmReveal(true)
              : revealEverything()
          }
          disabled={finished}
        >
          <Eye className="size-4" aria-hidden="true" />
          Reveal whole passage
        </Button>
      </div>

      {finished ? (
        <div className="space-y-3 rounded-lg border border-line bg-surface-muted px-4 py-3 text-sm text-ink">
          <div>
            <p className="font-medium">
              {fullReveal
                ? 'Passage revealed \u2014 recorded as an assisted review.'
                : 'Passage complete.'}
            </p>
            <p className="mt-1 text-ink-muted">
              {[
                formatDuration(elapsedMs),
                `${mistakes.length} incorrect key${mistakes.length === 1 ? '' : 's'}`,
                `${hintedWords.length} hint${hintedWords.length === 1 ? '' : 's'}`,
              ].join(' \u00b7 ')}
            </p>
            {mistakes.length > 0 ? (
              <p className="mt-2 text-ink-muted">
                Most missed:{' '}
                {[...new Set(mistakes.map((mistake) => mistake.wordIndex))]
                  .slice(0, 6)
                  .map((wordIndex) => tokens[wordIndex]?.text)
                  .filter(Boolean)
                  .join(', ')}
              </p>
            ) : null}
          </div>
          {onRetry ? (
            <Button variant="secondary" size="sm" onClick={retry}>
              <RotateCcw className="size-4" aria-hidden="true" />
              Retry
            </Button>
          ) : null}
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmReveal}
        title="Reveal the whole passage?"
        description="This counts as an assisted review."
        confirmLabel="Reveal passage"
        onCancel={() => setConfirmReveal(false)}
        onConfirm={() => {
          setConfirmReveal(false);
          revealEverything();
        }}
      />
    </div>
  );
}

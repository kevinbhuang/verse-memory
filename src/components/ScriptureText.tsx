import { useMemo } from 'react';
import clsx from 'clsx';
import { segmentText } from '@/lib/text/tokenize';
import type { HeatLevel } from '@/lib/weakWords';

export type ScriptureTextProps = {
  text: string;
  /** Words rendered as blanks unless they also appear in `revealed`. */
  hidden?: ReadonlySet<number>;
  revealed?: ReadonlySet<number>;
  /** Blanks show either an underscore rule or the word's first letter. */
  blankStyle?: 'rule' | 'first-letter';
  /** Words at or after this index are not shown at all. */
  visibleUpTo?: number;
  /** The word the reader is currently working on. */
  currentWordIndex?: number;
  /** Subtle background tint per word, from the weak-word statistics. */
  heat?: ReadonlyMap<number, HeatLevel>;
  /**
   * `subtle` = parchment weak-word tint (default).
   * `alert` = yellow → orange → red for session miss feedback.
   */
  heatTone?: 'subtle' | 'alert';
  onWordClick?: (wordIndex: number) => void;
  wordButtonLabel?: (wordIndex: number) => string;
  size?: 'base' | 'small';
  className?: string;
};

const subtleHeatStyles: Record<HeatLevel, string> = {
  0: '',
  1: 'bg-heat-1',
  2: 'bg-heat-2',
  3: 'bg-heat-3',
};

const alertHeatStyles: Record<HeatLevel, string> = {
  0: '',
  1: 'bg-warning-soft text-warning',
  2: 'bg-brand-soft text-brand-strong',
  3: 'bg-danger-soft text-danger',
};

/**
 * Renders canonical Scripture exactly as stored.
 *
 * The text is split into words and gaps so individual words can be hidden or
 * tinted without ever rewriting the passage: concatenating what is rendered
 * always reproduces the original string.
 */
export function ScriptureText({
  text,
  hidden,
  revealed,
  blankStyle = 'rule',
  visibleUpTo,
  currentWordIndex,
  heat,
  heatTone = 'subtle',
  onWordClick,
  wordButtonLabel,
  size = 'base',
  className,
}: ScriptureTextProps) {
  const segments = useMemo(() => segmentText(text), [text]);
  const heatStyles = heatTone === 'alert' ? alertHeatStyles : subtleHeatStyles;

  return (
    <p
      className={clsx(
        size === 'base' ? 'scripture' : 'scripture-sm text-[0.95rem]',
        'whitespace-pre-wrap',
        className,
      )}
    >
      {segments.map((segment, index) => {
        if (segment.type === 'gap') {
          return <span key={`gap-${index}`}>{segment.text}</span>;
        }

        const { wordIndex, text: word } = segment;

        if (visibleUpTo !== undefined && wordIndex >= visibleUpTo) {
          return null;
        }

        const isHidden = Boolean(hidden?.has(wordIndex)) && !revealed?.has(wordIndex);
        const isCurrent = currentWordIndex === wordIndex;
        const level = heat?.get(wordIndex) ?? 0;

        if (isHidden) {
          const placeholder =
            blankStyle === 'first-letter'
              ? `${word.slice(0, 1)}${'\u00b7'.repeat(Math.max(1, word.length - 1))}`
              : '\u2013'.repeat(Math.max(2, Math.min(word.length, 12)));

          const label =
            wordButtonLabel?.(wordIndex) ?? `Reveal hidden word ${wordIndex + 1}`;

          if (onWordClick) {
            return (
              <button
                key={`word-${wordIndex}`}
                type="button"
                onClick={() => onWordClick(wordIndex)}
                aria-label={label}
                className={clsx(
                  'mx-px inline-block rounded border-b-2 border-dashed border-accent/60 bg-accent-soft/60 px-0.5 font-sans text-[0.9em] tracking-tight text-accent hover:bg-accent-soft',
                  isCurrent && 'ring-2 ring-accent ring-offset-1',
                )}
              >
                {placeholder}
              </button>
            );
          }

          return (
            <span
              key={`word-${wordIndex}`}
              aria-label="hidden word"
              className="mx-px inline-block rounded border-b-2 border-dashed border-line-strong bg-surface-sunken px-0.5 font-sans text-[0.9em] tracking-tight text-ink-subtle"
            >
              {placeholder}
            </span>
          );
        }

        return (
          <span
            key={`word-${wordIndex}`}
            data-word-index={wordIndex}
            className={clsx(
              'rounded-sm',
              level > 0 && heatStyles[level],
              level > 0 && 'px-0.5',
              isCurrent &&
                'bg-accent-soft underline decoration-accent decoration-2 underline-offset-4',
            )}
          >
            {word}
          </span>
        );
      })}
    </p>
  );
}

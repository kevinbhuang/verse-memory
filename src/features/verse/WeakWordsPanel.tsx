import { useMemo } from 'react';
import { phrasesFor } from '@/lib/text/tokenize';
import { successRate, weakestWords } from '@/lib/weakWords';
import { formatRelativeDay } from '@/utils/format';
import type { Verse, WordStat } from '@/types';

export function WeakWordsPanel({
  verse,
  wordStats,
}: {
  verse: Verse;
  wordStats: WordStat[];
}) {
  const weakest = useMemo(() => weakestWords(wordStats, 8), [wordStats]);

  const troublePhrase = useMemo(() => {
    if (weakest.length === 0) return null;
    const phrases = phrasesFor(verse.text);
    const counts = phrases.map((phrase) => ({
      phrase,
      trouble: weakest
        .filter(
          (stat) =>
            stat.wordIndex >= phrase.startWordIndex &&
            stat.wordIndex <= phrase.endWordIndex,
        )
        .reduce((sum, stat) => sum + stat.misses + stat.hints, 0),
    }));
    const worst = counts.sort((a, b) => b.trouble - a.trouble)[0];
    return worst && worst.trouble > 0 ? worst.phrase.text : null;
  }, [verse.text, weakest]);

  if (wordStats.length === 0 || weakest.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        No word-level mistakes recorded yet. First-letter, progressive hiding
        and full typing reviews all feed this list.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {troublePhrase ? (
        <p className="rounded-md border border-line bg-surface-muted px-3 py-2 text-sm text-ink">
          <span className="font-medium">Phrase to work on: </span>
          <span className="font-serif">{troublePhrase}</span>
        </p>
      ) : null}

      <table className="w-full text-sm">
        <caption className="sr-only">
          Words most often missed in this passage
        </caption>
        <thead>
          <tr className="text-left text-xs tracking-wide text-ink-muted uppercase">
            <th scope="col" className="py-1.5 font-medium">
              Word
            </th>
            <th scope="col" className="py-1.5 font-medium">
              Position
            </th>
            <th scope="col" className="py-1.5 font-medium">
              Misses
            </th>
            <th scope="col" className="py-1.5 font-medium">
              Hints
            </th>
            <th scope="col" className="py-1.5 font-medium">
              Success
            </th>
            <th scope="col" className="py-1.5 font-medium">
              Last miss
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-subtle)]">
          {weakest.map((stat) => (
            <tr key={stat.key}>
              <td className="py-1.5 font-serif text-ink">{stat.word}</td>
              <td className="py-1.5 text-ink-muted tabular-nums">
                {stat.wordIndex + 1}
              </td>
              <td className="py-1.5 text-ink-muted tabular-nums">
                {stat.misses}
              </td>
              <td className="py-1.5 text-ink-muted tabular-nums">
                {stat.hints}
              </td>
              <td className="py-1.5 text-ink-muted tabular-nums">
                {`${Math.round(successRate(stat) * 100)}%`}
              </td>
              <td className="py-1.5 text-ink-muted">
                {formatRelativeDay(stat.lastMissAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

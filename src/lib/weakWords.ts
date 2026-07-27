import type { WordError, WordStat } from '@/types';
import { tokenize } from './text/tokenize';

export function wordStatKey(verseId: string, wordIndex: number): string {
  return `${verseId}:${wordIndex}`;
}

export function emptyWordStat(
  verseId: string,
  wordIndex: number,
  word: string,
): WordStat {
  return {
    key: wordStatKey(verseId, wordIndex),
    verseId,
    wordIndex,
    word,
    attempts: 0,
    misses: 0,
    hints: 0,
    substitutions: 0,
    lastMissAt: null,
  };
}

/**
 * Folds one review's word errors into the running per-word statistics.
 *
 * Returns a new array; persistence is the caller's job so this stays testable.
 */
export function applyWordErrors(
  verseId: string,
  canonicalText: string,
  existing: WordStat[],
  errors: WordError[],
  reviewedAt: string,
  /** Words the reader actually attempted, so success rates stay meaningful. */
  attemptedWordIndexes?: number[],
): WordStat[] {
  const tokens = tokenize(canonicalText);
  const byKey = new Map(existing.map((stat) => [stat.key, { ...stat }]));

  const touch = (wordIndex: number): WordStat | null => {
    const token = tokens[wordIndex];
    if (!token) return null;
    const key = wordStatKey(verseId, wordIndex);
    const current =
      byKey.get(key) ?? emptyWordStat(verseId, wordIndex, token.text);
    current.word = token.text;
    byKey.set(key, current);
    return current;
  };

  const attempted =
    attemptedWordIndexes ?? tokens.map((token) => token.wordIndex);

  for (const wordIndex of attempted) {
    const stat = touch(wordIndex);
    if (stat) stat.attempts += 1;
  }

  for (const error of errors) {
    if (error.wordIndex < 0) continue;
    const stat = touch(error.wordIndex);
    if (!stat) continue;

    switch (error.errorType) {
      case 'hint':
        stat.hints += 1;
        break;
      case 'missing':
        stat.misses += 1;
        stat.lastMissAt = reviewedAt;
        break;
      case 'incorrect':
        stat.misses += 1;
        if (error.received) stat.substitutions += 1;
        stat.lastMissAt = reviewedAt;
        break;
      case 'extra':
        break;
    }
  }

  return [...byKey.values()].sort((a, b) => a.wordIndex - b.wordIndex);
}

export function successRate(stat: WordStat): number {
  if (stat.attempts === 0) return 1;
  const failures = Math.min(stat.attempts, stat.misses + stat.hints);
  return Math.max(0, (stat.attempts - failures) / stat.attempts);
}

export type HeatLevel = 0 | 1 | 2 | 3;

/**
 * A restrained four-step scale. Level 0 is by far the most common so the
 * passage still reads as plain text.
 */
export function heatLevel(stat: WordStat | undefined): HeatLevel {
  if (!stat) return 0;
  const trouble = stat.misses + stat.hints;
  if (trouble === 0) return 0;
  const rate = successRate(stat);
  if (trouble >= 3 && rate < 0.6) return 3;
  if (trouble >= 2 || rate < 0.75) return 2;
  return 1;
}

export function weakestWords(stats: WordStat[], limit = 8): WordStat[] {
  return [...stats]
    .filter((stat) => stat.misses + stat.hints > 0)
    .sort((a, b) => {
      const troubleDelta =
        b.misses + b.hints * 0.5 - (a.misses + a.hints * 0.5);
      if (troubleDelta !== 0) return troubleDelta;
      return successRate(a) - successRate(b);
    })
    .slice(0, limit);
}

/**
 * Chooses which word indexes to hide for a progressive-hiding attempt.
 *
 * Selection is deterministic for a given seed so the blanks do not move
 * around while the reader is working through the passage, and weak words are
 * hidden first.
 */
export function selectWordsToHide(
  canonicalText: string,
  ratio: number,
  stats: WordStat[],
  seed = 1,
): number[] {
  const tokens = tokenize(canonicalText);
  if (tokens.length === 0) return [];

  const target = Math.round(tokens.length * Math.max(0, Math.min(1, ratio)));
  if (target <= 0) return [];
  if (target >= tokens.length) return tokens.map((token) => token.wordIndex);

  const statByIndex = new Map(stats.map((stat) => [stat.wordIndex, stat]));

  const scored = tokens.map((token) => {
    const stat = statByIndex.get(token.wordIndex);
    const weakness = stat ? stat.misses * 2 + stat.hints : 0;
    // A stable pseudo-random tiebreaker keyed on the word position.
    const jitter = pseudoRandom(token.wordIndex + seed * 7919);
    // Longer, less common words are slightly better targets than "the".
    const lengthBonus = Math.min(token.normalized.length, 8) / 16;
    return {
      wordIndex: token.wordIndex,
      score: weakness * 3 + lengthBonus + jitter,
    };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, target)
    .map((entry) => entry.wordIndex)
    .sort((a, b) => a - b);
}

/** Every other word, starting with the second. */
export function alternatingWordIndexes(canonicalText: string): number[] {
  return tokenize(canonicalText)
    .map((token) => token.wordIndex)
    .filter((index) => index % 2 === 1);
}

function pseudoRandom(seed: number): number {
  const x = Math.sin(seed) * 10_000;
  return x - Math.floor(x);
}

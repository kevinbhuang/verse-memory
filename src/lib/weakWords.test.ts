import { describe, expect, it } from 'vitest';
import {
  alternatingWordIndexes,
  applyWordErrors,
  emptyWordStat,
  heatLevel,
  selectWordsToHide,
  successRate,
  weakestWords,
  wordStatKey,
} from './weakWords';
import { wordCount } from './text/tokenize';
import type { WordStat } from '@/types';

const TEXT = 'For God so loved the world that he gave his only Son';
const REVIEWED_AT = '2026-03-10T09:00:00.000Z';

describe('applyWordErrors', () => {
  it('records a miss against the right word position', () => {
    const stats = applyWordErrors(
      'verse-042',
      TEXT,
      [],
      [{ wordIndex: 3, expected: 'loved', received: 'love', errorType: 'incorrect' }],
      REVIEWED_AT,
    );

    const loved = stats.find((stat) => stat.wordIndex === 3);
    expect(loved).toMatchObject({
      key: wordStatKey('verse-042', 3),
      word: 'loved',
      misses: 1,
      substitutions: 1,
      lastMissAt: REVIEWED_AT,
    });
  });

  it('counts hints separately from misses', () => {
    const stats = applyWordErrors(
      'verse-042',
      TEXT,
      [],
      [{ wordIndex: 5, expected: 'world', received: null, errorType: 'hint' }],
      REVIEWED_AT,
    );

    const world = stats.find((stat) => stat.wordIndex === 5);
    expect(world?.hints).toBe(1);
    expect(world?.misses).toBe(0);
  });

  it('accumulates across reviews', () => {
    const first = applyWordErrors(
      'verse-042',
      TEXT,
      [],
      [{ wordIndex: 3, expected: 'loved', received: null, errorType: 'missing' }],
      REVIEWED_AT,
    );
    const second = applyWordErrors(
      'verse-042',
      TEXT,
      first,
      [{ wordIndex: 3, expected: 'loved', received: null, errorType: 'missing' }],
      '2026-03-12T09:00:00.000Z',
    );

    const loved = second.find((stat) => stat.wordIndex === 3);
    expect(loved?.misses).toBe(2);
    expect(loved?.attempts).toBe(2);
    expect(loved?.lastMissAt).toBe('2026-03-12T09:00:00.000Z');
  });

  it('ignores errors for words that are not in the passage', () => {
    const stats = applyWordErrors(
      'verse-042',
      TEXT,
      [],
      [{ wordIndex: -1, expected: '', received: 'amen', errorType: 'extra' }],
      REVIEWED_AT,
    );
    expect(stats.every((stat) => stat.misses === 0)).toBe(true);
  });
});

describe('successRate and heatLevel', () => {
  const base = (overrides: Partial<WordStat>): WordStat => ({
    ...emptyWordStat('verse-001', 0, 'word'),
    ...overrides,
  });

  it('treats an untouched word as fully successful', () => {
    expect(successRate(base({ attempts: 0 }))).toBe(1);
    expect(heatLevel(undefined)).toBe(0);
    expect(heatLevel(base({ attempts: 4 }))).toBe(0);
  });

  it('escalates through the heat scale as mistakes mount', () => {
    expect(heatLevel(base({ attempts: 10, misses: 1 }))).toBe(1);
    expect(heatLevel(base({ attempts: 10, misses: 2 }))).toBe(2);
    expect(heatLevel(base({ attempts: 4, misses: 3 }))).toBe(3);
  });

  it('ranks the weakest words first', () => {
    const stats = [
      base({ wordIndex: 0, word: 'For', attempts: 5, misses: 0 }),
      base({ wordIndex: 1, word: 'God', attempts: 5, misses: 3 }),
      base({ wordIndex: 2, word: 'so', attempts: 5, misses: 1 }),
    ];
    expect(weakestWords(stats).map((stat) => stat.word)).toEqual(['God', 'so']);
  });
});

describe('selectWordsToHide', () => {
  it('hides roughly the requested share of words', () => {
    const total = wordCount(TEXT);
    expect(selectWordsToHide(TEXT, 0.2, []).length).toBe(Math.round(total * 0.2));
    expect(selectWordsToHide(TEXT, 0.6, []).length).toBe(Math.round(total * 0.6));
    expect(selectWordsToHide(TEXT, 1, []).length).toBe(total);
    expect(selectWordsToHide(TEXT, 0, [])).toEqual([]);
  });

  it('is stable for the same seed so blanks do not move mid-attempt', () => {
    const first = selectWordsToHide(TEXT, 0.4, [], 3);
    const second = selectWordsToHide(TEXT, 0.4, [], 3);
    expect(second).toEqual(first);
  });

  it('changes when the attempt seed changes', () => {
    const first = selectWordsToHide(TEXT, 0.4, [], 1);
    const second = selectWordsToHide(TEXT, 0.4, [], 2);
    expect(second).not.toEqual(first);
  });

  it('prefers words that have been missed before', () => {
    const stats: WordStat[] = [
      { ...emptyWordStat('verse-001', 11, 'Son'), attempts: 5, misses: 4 },
    ];
    expect(selectWordsToHide(TEXT, 0.2, stats, 5)).toContain(11);
  });

  it('returns indexes in reading order', () => {
    const hidden = selectWordsToHide(TEXT, 0.5, [], 7);
    expect([...hidden].sort((a, b) => a - b)).toEqual(hidden);
  });
});

describe('alternatingWordIndexes', () => {
  it('hides every other word', () => {
    expect(alternatingWordIndexes('one two three four five')).toEqual([1, 3]);
  });
});

import { describe, expect, it } from 'vitest';
import {
  firstLetterOf,
  firstLetterSequence,
  firstLetterSkeleton,
  matchesFirstLetter,
  phrasesFor,
  segmentText,
  tokenize,
  wordCount,
  words,
} from './tokenize';
import { verses } from '@/data/verses';

describe('segmentText', () => {
  it('reproduces the canonical text exactly when re-joined', () => {
    for (const verse of verses) {
      const rebuilt = segmentText(verse.text)
        .map((segment) => segment.text)
        .join('');
      expect(rebuilt).toBe(verse.text);
    }
  });

  it('numbers words consecutively from zero', () => {
    const segments = segmentText('For God so loved the world');
    const wordSegments = segments.filter((segment) => segment.type === 'word');
    expect(wordSegments.map((segment) => segment.wordIndex)).toEqual([
      0, 1, 2, 3, 4, 5,
    ]);
  });
});

describe('tokenize', () => {
  it('treats an apostrophised word as one word', () => {
    expect(words("eagles' wings")).toEqual(["eagles'", 'wings']);
    expect(words('the Lord\u2019s prayer')).toEqual([
      'the',
      'Lord\u2019s',
      'prayer',
    ]);
    expect(wordCount("I bore you on eagles' wings")).toBe(6);
  });

  it('treats a hyphenated compound as one word', () => {
    expect(words('self-control and long-suffering')).toEqual([
      'self-control',
      'and',
      'long-suffering',
    ]);
  });

  it('splits words joined by an em dash', () => {
    expect(words('peace\u2014not as the world gives')).toEqual([
      'peace',
      'not',
      'as',
      'the',
      'world',
      'gives',
    ]);
  });

  it('ignores quotation marks, parentheses, colons and semicolons', () => {
    expect(words('\u201cHear, O Israel: the Lord (our God); one.\u201d')).toEqual([
      'Hear',
      'O',
      'Israel',
      'the',
      'Lord',
      'our',
      'God',
      'one',
    ]);
  });

  it('handles multiple sentences and line breaks', () => {
    expect(wordCount('He is risen.\nHe is risen indeed!')).toBe(7);
  });

  it('records the character offsets of each word', () => {
    const tokens = tokenize('For God so loved');
    expect(tokens[1].start).toBe(4);
    expect(tokens[1].end).toBe(7);
    expect('For God so loved'.slice(tokens[1].start, tokens[1].end)).toBe('God');
  });
});

describe('first letters', () => {
  it('produces one key per word', () => {
    expect(firstLetterSequence('For God so loved the world')).toEqual([
      'f',
      'g',
      's',
      'l',
      't',
      'w',
    ]);
    expect(firstLetterSkeleton('For God so loved the world')).toBe(
      'F G s l t w',
    );
    expect(firstLetterSkeleton('Hear, O Israel\u2014')).toBe('H, O I\u2014');
    expect(firstLetterSkeleton('\u201cHear, O Israel\u201d')).toBe(
      '\u201cH, O I\u201d',
    );
  });

  it('expects L for LORD regardless of capitalisation', () => {
    expect(firstLetterOf('LORD')).toBe('l');
    expect(firstLetterOf('Lord')).toBe('l');
    expect(matchesFirstLetter('L', 'LORD')).toBe(true);
    expect(matchesFirstLetter('l', 'LORD')).toBe(true);
    expect(matchesFirstLetter('o', 'LORD')).toBe(false);
  });

  it('skips leading punctuation when choosing the expected key', () => {
    expect(firstLetterSequence('\u201cHear, O Israel')).toEqual(['h', 'o', 'i']);
  });

  it('uses the digit for a word that begins with a number', () => {
    expect(firstLetterOf('7')).toBe('7');
  });

  it('gives one key per word for a real passage', () => {
    const verse = verses[0];
    expect(firstLetterSequence(verse.text)).toHaveLength(wordCount(verse.text));
  });
});

describe('phrasesFor', () => {
  it('breaks a passage at sentence and clause punctuation', () => {
    const phrases = phrasesFor(
      'Be strong and courageous. Do not be frightened, and do not be dismayed.',
    );
    expect(phrases.length).toBeGreaterThanOrEqual(3);
    expect(phrases[0].text).toContain('Be strong and courageous');
    expect(phrases[0].startWordIndex).toBe(0);
  });
});

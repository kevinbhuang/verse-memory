import { describe, expect, it } from 'vitest';
import {
  collapseWhitespace,
  normalizeApostrophes,
  normalizeDashes,
  normalizeForGrading,
  normalizeQuotes,
  normalizeWord,
  stripPunctuation,
} from './normalize';

describe('normalisation helpers', () => {
  it('converts curly quotation marks to straight ones', () => {
    expect(normalizeQuotes('\u201cHear, O Israel\u201d')).toBe('"Hear, O Israel"');
    expect(normalizeApostrophes('eagles\u2019 wings')).toBe("eagles' wings");
  });

  it('converts em and en dashes to hyphens', () => {
    expect(normalizeDashes('peace\u2014not war')).toBe('peace-not war');
    expect(normalizeDashes('verses 1\u20133')).toBe('verses 1-3');
  });

  it('collapses runs of whitespace, including non-breaking spaces', () => {
    expect(collapseWhitespace('  He is\u00a0risen \n indeed  ')).toBe(
      'He is risen indeed',
    );
  });

  it('strips sentence punctuation', () => {
    expect(stripPunctuation('Hear, O Israel: the Lord is one.')).toBe(
      'Hear O Israel the Lord is one',
    );
  });
});

describe('normalizeForGrading', () => {
  const canonical =
    '\u201cFor God so loved the world, that he gave his only Son\u2014that whoever believes.\u201d';

  it('ignores case, punctuation and quote style by default', () => {
    expect(normalizeForGrading(canonical)).toBe(
      'for god so loved the world that he gave his only son-that whoever believes',
    );
    expect(normalizeForGrading('for god so LOVED the world')).toBe(
      'for god so loved the world',
    );
  });

  it('keeps punctuation when asked', () => {
    expect(normalizeForGrading('Hear, O Israel.', { punctuation: true })).toBe(
      'hear, o israel.',
    );
  });

  it('keeps capitalisation when asked', () => {
    expect(
      normalizeForGrading('Hear, O Israel.', { capitalization: true }),
    ).toBe('Hear O Israel');
  });

  it('treats straight and curly apostrophes as the same for grading', () => {
    expect(normalizeForGrading('eagles\u2019 wings')).toBe(
      normalizeForGrading("eagles' wings"),
    );
  });

  it('never mutates the input string', () => {
    const original = '\u201cHear, O Israel\u201d';
    normalizeForGrading(original);
    expect(original).toBe('\u201cHear, O Israel\u201d');
  });
});

describe('normalizeWord', () => {
  it('lower-cases and keeps internal apostrophes and hyphens', () => {
    expect(normalizeWord("Don\u2019t")).toBe("don't");
    expect(normalizeWord('Self-Control,')).toBe('self-control');
    expect(normalizeWord('\u201cLORD\u201d')).toBe('lord');
  });

  it('drops a possessive apostrophe so grading does not depend on it', () => {
    expect(normalizeWord('eagles\u2019')).toBe('eagles');
    expect(normalizeWord("eagles'")).toBe(normalizeWord('eagles'));
  });
});

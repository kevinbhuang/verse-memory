import { describe, expect, it } from 'vitest';
import { bookOf, matchBookAndChapter, matchReference, normalizeReference, parseReference } from './reference';
import { verses } from '@/data/verses';

describe('parseReference', () => {
  it('parses a plain reference', () => {
    expect(parseReference('John 3:16')).toMatchObject({
      book: 'John',
      chapter: 3,
      verseStart: 16,
    });
  });

  it('parses ranges and abbreviations', () => {
    expect(parseReference('1 Cor 13:4-7')).toMatchObject({
      book: '1 Corinthians',
      chapter: 13,
      verseStart: 4,
      verseEnd: 7,
    });
  });

  it('parses part markers such as 4:6b', () => {
    expect(parseReference('Zechariah 4:6b')).toMatchObject({
      book: 'Zechariah',
      chapter: 4,
      verseStart: 6,
      startPart: 'b',
    });
  });

  it('rejects text that is not a reference', () => {
    expect(parseReference('for God so loved the world')).toBeNull();
    expect(parseReference('')).toBeNull();
  });

  it('parses every reference in the collection', () => {
    for (const verse of verses) {
      expect(parseReference(verse.reference), verse.reference).not.toBeNull();
    }
  });

  it('normalises to a comparable form', () => {
    expect(normalizeReference('Jn 3:16')).toBe('john 3:16');
    expect(normalizeReference('john3:16')).toBe('john 3:16');
    expect(normalizeReference('  ROMANS 8:38-39 ')).toBe('romans 8:38-39');
  });

  it('extracts the book name', () => {
    expect(bookOf('1 Peter 2:9')).toBe('1 Peter');
  });
});

describe('matchReference', () => {
  it('accepts common formatting variants', () => {
    for (const variant of ['John 3:16', 'Jn 3:16', 'john3:16', 'JOHN 3.16', 'Jhn 3:16']) {
      expect(matchReference(variant, 'John 3:16').isMatch, variant).toBe(true);
    }
  });

  it('accepts ordinal spellings for numbered books', () => {
    expect(matchReference('1Cor 13:4-7', '1 Corinthians 13:4-7').isMatch).toBe(true);
    expect(matchReference('First Corinthians 13:4-7', '1 Corinthians 13:4-7').isMatch).toBe(true);
    expect(matchReference('I Corinthians 13:4-7', '1 Corinthians 13:4-7').isMatch).toBe(true);
  });

  it('accepts an en dash in a range', () => {
    expect(matchReference('Romans 8:38\u201339', 'Romans 8:38-39').isMatch).toBe(true);
  });

  it('rejects a different book', () => {
    const result = matchReference('Mark 3:16', 'John 3:16');
    expect(result.isMatch).toBe(false);
    expect(result.message).toContain('Wrong book');
  });

  it('rejects a different chapter and says so', () => {
    const result = matchReference('John 4:16', 'John 3:16');
    expect(result.isMatch).toBe(false);
    expect(result.message).toContain('chapter');
  });

  it('rejects a different verse but marks it close', () => {
    const result = matchReference('John 3:17', 'John 3:16');
    expect(result.isMatch).toBe(false);
    expect(result.isCloseMatch).toBe(true);
  });

  it('rejects a wrong range even when the start verse matches', () => {
    expect(matchReference('Romans 8:38', 'Romans 8:38-39').isMatch).toBe(false);
  });

  it('rejects nonsense input without throwing', () => {
    expect(matchReference('???', 'John 3:16').isMatch).toBe(false);
  });
});

describe('matchBookAndChapter', () => {
  it('accepts book and chapter without verse numbers', () => {
    expect(matchBookAndChapter('John 3', 'John 3:16').isMatch).toBe(true);
    expect(matchBookAndChapter('Jn 3:16', 'John 3:16').isMatch).toBe(true);
    expect(matchBookAndChapter('John 4', 'John 3:16').isMatch).toBe(false);
    expect(matchBookAndChapter('Romans 3', 'John 3:16').isMatch).toBe(false);
  });
});

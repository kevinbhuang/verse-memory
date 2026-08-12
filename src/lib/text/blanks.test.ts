import { describe, expect, it } from 'vitest';
import { words } from './tokenize';
import { blankWorth, chooseBlankIndexes } from './blanks';

describe('blankWorth', () => {
  it('scores stop words as zero', () => {
    expect(blankWorth('a')).toBe(0);
    expect(blankWorth('and')).toBe(0);
    expect(blankWorth('the')).toBe(0);
    expect(blankWorth('of')).toBe(0);
  });

  it('scores content words and divine names highly', () => {
    expect(blankWorth('shepherd')).toBeGreaterThan(blankWorth('him'));
    expect(blankWorth('LORD')).toBeGreaterThan(blankWorth('and'));
    expect(blankWorth('righteousness')).toBeGreaterThan(blankWorth('in'));
  });
});

describe('chooseBlankIndexes', () => {
  it('avoids blanking glue words when content words exist', () => {
    const passage =
      'The LORD is my shepherd; I shall not want. He makes me lie down in green pastures.';
    const tokens = words(passage);
    const blanks = chooseBlankIndexes(tokens, 'psalm-23:1');
    const blankWords = blanks.map((index) => tokens[index]!.toLowerCase());

    expect(blanks.length).toBeGreaterThan(0);
    for (const word of blankWords) {
      expect(['a', 'an', 'the', 'and', 'or', 'of', 'to', 'in', 'on', 'is', 'my', 'me', 'he', 'i']).not.toContain(
        word.replace(/[^a-z]/g, ''),
      );
    }
    expect(blankWords.some((word) => /shepherd|lord|pastures|want|green|lie/.test(word))).toBe(
      true,
    );
  });

  it('is deterministic for the same seed', () => {
    const tokens = words('Blessed is the man who walks not in the counsel of the wicked');
    expect(chooseBlankIndexes(tokens, 'seed-a')).toEqual(
      chooseBlankIndexes(tokens, 'seed-a'),
    );
  });

  it('varies with a different seed', () => {
    const tokens = words(
      'Commit your way to the LORD; trust in him, and he will act. He will bring forth your righteousness as the light.',
    );
    const a = chooseBlankIndexes(tokens, 'attempt-1').join(',');
    const b = chooseBlankIndexes(tokens, 'attempt-2').join(',');
    expect(a).not.toEqual(b);
  });
});

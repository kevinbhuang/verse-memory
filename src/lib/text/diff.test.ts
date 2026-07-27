import { describe, expect, it } from 'vitest';
import { gradeAttempt } from './diff';
import { verses } from '@/data/verses';

const CANONICAL = 'For God so loved the world, that he gave his only Son.';

describe('gradeAttempt', () => {
  it('scores a perfect forgiving attempt as fully correct', () => {
    const result = gradeAttempt(
      CANONICAL,
      'for god so loved the world that he gave his only son',
    );
    expect(result.accuracy).toBe(1);
    expect(result.missingCount).toBe(0);
    expect(result.extraCount).toBe(0);
    expect(result.wordErrors).toEqual([]);
  });

  it('accepts different quotation and dash styles', () => {
    const result = gradeAttempt(
      '\u201cPeace\u2014not as the world gives\u201d',
      '"peace - not as the world gives"',
    );
    expect(result.accuracy).toBe(1);
  });

  it('reports a missing word', () => {
    const result = gradeAttempt(CANONICAL, 'For God loved the world, that he gave his only Son.');
    expect(result.missingCount).toBe(1);
    expect(result.ops.find((op) => op.type === 'missing')?.expected).toBe('so');
    expect(result.wordErrors[0]).toMatchObject({
      expected: 'so',
      errorType: 'missing',
    });
  });

  it('reports an added word', () => {
    const result = gradeAttempt(CANONICAL, `${CANONICAL} Amen`);
    expect(result.extraCount).toBe(1);
    expect(result.ops.at(-1)).toMatchObject({ type: 'extra', received: 'Amen' });
  });

  it('reports a substituted word as replaced', () => {
    const result = gradeAttempt(CANONICAL, 'For God so loved the earth, that he gave his only Son.');
    expect(result.replacedCount).toBe(1);
    const replaced = result.ops.find((op) => op.type === 'replaced');
    expect(replaced?.expected).toBe('world');
    expect(replaced?.received).toBe('earth');
  });

  it('reports a word recited out of order', () => {
    const result = gradeAttempt('the fruit of the Spirit is love joy peace', 'the fruit of the Spirit is joy love peace');
    expect(result.movedCount).toBeGreaterThan(0);
    expect(result.ops.some((op) => op.type === 'moved')).toBe(true);
  });

  it('penalises accuracy for both omissions and additions', () => {
    const short = gradeAttempt(CANONICAL, 'For God so loved');
    expect(short.accuracy).toBeLessThan(0.5);

    const padded = gradeAttempt(CANONICAL, `${CANONICAL} and more words here now`);
    expect(padded.accuracy).toBeLessThan(1);
  });

  it('respects exact grading options', () => {
    const forgiving = gradeAttempt('Hear, O Israel.', 'hear o israel');
    expect(forgiving.accuracy).toBe(1);

    const strict = gradeAttempt('Hear, O Israel.', 'hear o israel', {
      capitalization: true,
    });
    expect(strict.accuracy).toBeLessThan(1);
  });

  it('handles a long real passage without losing words', () => {
    const verse = verses.find((item) => item.text.length > 400) ?? verses[2];
    const result = gradeAttempt(verse.text, verse.text);
    expect(result.accuracy).toBe(1);
    expect(result.correctCount).toBe(result.expectedWordCount);
  });

  it('treats an empty attempt as every word missing', () => {
    const result = gradeAttempt(CANONICAL, '');
    expect(result.accuracy).toBe(0);
    expect(result.missingCount).toBe(result.expectedWordCount);
  });
});

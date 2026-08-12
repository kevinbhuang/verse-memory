import { describe, expect, it } from 'vitest';
import { parseReferenceList } from './parseReferenceList';

describe('parseReferenceList', () => {
  it('splits on commas before a new book', () => {
    expect(parseReferenceList('John 3:16, Romans 8:28')).toEqual([
      'John 3:16',
      'Romans 8:28',
    ]);
  });

  it('splits on newlines and semicolons', () => {
    expect(parseReferenceList('John 3:16\nRomans 8:28; Psalm 23:1')).toEqual([
      'John 3:16',
      'Romans 8:28',
      'Psalm 23:1',
    ]);
  });

  it('keeps verse lists like Matthew 5:3,4 together', () => {
    expect(parseReferenceList('Matthew 5:3,4')).toEqual(['Matthew 5:3,4']);
  });

  it('handles numbered books after commas', () => {
    expect(
      parseReferenceList('1 Corinthians 13:4-7, 2 Timothy 3:16'),
    ).toEqual(['1 Corinthians 13:4-7', '2 Timothy 3:16']);
  });

  it('dedupes case-insensitively and ignores blanks', () => {
    expect(parseReferenceList('John 3:16,,\njohn 3:16')).toEqual([
      'John 3:16',
    ]);
  });
});

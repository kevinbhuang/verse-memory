import { describe, expect, it } from 'vitest';
import { safeReturnPath } from './safeReturnPath';

describe('safeReturnPath', () => {
  it('returns the fallback when missing', () => {
    expect(safeReturnPath(null)).toBe('/quiz');
    expect(safeReturnPath(undefined, '/flashcards')).toBe('/flashcards');
  });

  it('allows same-app relative paths', () => {
    expect(safeReturnPath('/flashcards?verse=verse-001')).toBe(
      '/flashcards?verse=verse-001',
    );
  });

  it('rejects external or protocol-relative targets', () => {
    expect(safeReturnPath('//evil.example')).toBe('/quiz');
    expect(safeReturnPath('https://evil.example')).toBe('/quiz');
    expect(safeReturnPath('/ok://still')).toBe('/quiz');
  });
});

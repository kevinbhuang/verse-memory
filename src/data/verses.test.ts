import { describe, expect, it } from 'vitest';
import { buildIntegrityReport, getVerse, verses } from './verses';
import { computeContentHash } from '@/lib/hash';
import { SECTION_RANGES, appConfig } from '@/config/app';
import { SECTIONS } from '@/types';

describe('the passage collection', () => {
  it('contains exactly 171 passages', () => {
    expect(verses).toHaveLength(171);
    expect(verses).toHaveLength(appConfig.expectedVerseCount);
  });

  it('uses stable ids from verse-001 to verse-171', () => {
    expect(verses[0].id).toBe('verse-001');
    expect(verses[170].id).toBe('verse-171');

    for (const verse of verses) {
      expect(verse.id).toBe(`verse-${String(verse.order).padStart(3, '0')}`);
    }

    expect(new Set(verses.map((verse) => verse.id)).size).toBe(171);
  });

  it('has unique order values running consecutively from 1 to 171', () => {
    const orders = verses.map((verse) => verse.order);
    expect(new Set(orders).size).toBe(171);
    expect(orders).toEqual(Array.from({ length: 171 }, (_, i) => i + 1));
  });

  it('keeps every passage in its declared section boundary', () => {
    for (const range of SECTION_RANGES) {
      const inRange = verses.filter(
        (verse) => verse.order >= range.start && verse.order <= range.end,
      );
      expect(inRange).toHaveLength(range.end - range.start + 1);
      for (const verse of inRange) {
        expect(verse.section).toBe(range.section);
      }
    }
  });

  it('uses only the seven approved section names', () => {
    const used = new Set(verses.map((verse) => verse.section));
    expect([...used].every((section) => SECTIONS.includes(section))).toBe(true);
    expect(used.size).toBe(7);
  });

  it('gives every passage a reference, text, section and translation', () => {
    for (const verse of verses) {
      expect(verse.reference.trim()).not.toBe('');
      expect(verse.text.trim()).not.toBe('');
      expect(verse.section.trim()).not.toBe('');
      expect(verse.translation).toBe('ESV');
    }
  });

  it('matches every recorded content hash', () => {
    for (const verse of verses) {
      expect(verse.contentHash).toBe(computeContentHash(verse.text));
    }
  });

  it('looks passages up by id', () => {
    expect(getVerse('verse-001')?.reference).toBe(verses[0].reference);
    expect(getVerse('verse-999')).toBeUndefined();
  });

  it('reports a clean bill of health', () => {
    const report = buildIntegrityReport();
    expect(report.ok).toBe(true);
    expect(report.countMatches).toBe(true);
    expect(report.ordersConsecutive).toBe(true);
    expect(report.idsUnique).toBe(true);
    expect(report.issues).toEqual([]);
  });

  it('flags a passage whose text no longer matches its hash', () => {
    const tampered = verses.map((verse, index) =>
      index === 3 ? { ...verse, text: `${verse.text} (edited)` } : verse,
    );

    const report = buildIntegrityReport(tampered);
    expect(report.ok).toBe(false);
    const hashIssues = report.issues.filter(
      (issue) => issue.kind === 'hash-mismatch',
    );
    expect(hashIssues).toHaveLength(1);
    expect(hashIssues[0].verseId).toBe('verse-004');
  });
});

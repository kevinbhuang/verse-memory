import { describe, expect, it } from 'vitest';
import { versesInSection } from '@/data/verses';
import { SECTIONS } from '@/types';
import {
  buildVersesPdf,
  pdfSafeText,
  verseTextForPrint,
  versesPdfFilename,
} from './printVersesPdf';

describe('printVersesPdf', () => {
  it('normalizes punctuation jsPDF cannot embed reliably', () => {
    expect(pdfSafeText('“Hear,\u00A0O Israel—”')).toBe('"Hear, O Israel--"');
    expect(pdfSafeText('Paul\u2019s Epistles')).toBe("Paul's Epistles");
  });

  it('keeps punctuation when reducing a passage to first letters', () => {
    expect(verseTextForPrint('Hear, O Israel\u2014', 'first-letter')).toBe(
      'H, O I--',
    );
    expect(verseTextForPrint('For God so loved the world', 'full')).toBe(
      'For God so loved the world',
    );
  });

  it('builds a stable download filename from a scope label', () => {
    expect(versesPdfFilename('Law and History')).toBe(
      '100-Verses-Law-and-History.pdf',
    );
    expect(versesPdfFilename("Paul's Epistles")).toBe(
      '100-Verses-Pauls-Epistles.pdf',
    );
    expect(versesPdfFilename('Collection — First letters')).toBe(
      '100-Verses-Collection-First-letters.pdf',
    );
  });

  it('builds a non-empty PDF for a deck', () => {
    const verses = versesInSection(SECTIONS[0]);
    expect(verses.length).toBeGreaterThan(0);

    const doc = buildVersesPdf({
      verses,
      title: '100 Verses Every Christian Should Know',
    });
    const bytes = doc.output('arraybuffer');
    expect(bytes.byteLength).toBeGreaterThan(1000);
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    expect(doc.getFont().fontName).toBe('SourceSerif4');
  });

  it('builds a first-letter PDF for a deck', () => {
    const verses = versesInSection(SECTIONS[0]);
    const doc = buildVersesPdf({
      verses,
      title: '100 Verses Every Christian Should Know',
      textMode: 'first-letter',
    });
    expect(doc.output('arraybuffer').byteLength).toBeGreaterThan(500);
  });
});

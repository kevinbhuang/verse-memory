import { jsPDF } from 'jspdf';
import { firstLetterSkeleton } from '@/lib/text/tokenize';
import {
  dtChapterDecks,
  toChapterReviewVerse,
  type DtChapterDeck,
} from '@/data/dtChapters';
import {
  pdfSafeText,
  type PrintTextMode,
} from '@/features/library/printVersesPdf';
import sourceSerif4Regular from '@/assets/fonts/SourceSerif4-Regular.ttf?base64';
import sourceSerif4Bold from '@/assets/fonts/SourceSerif4-Bold.ttf?base64';

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_X = 36;
const MARGIN_TOP = 32;
const MARGIN_BOTTOM = 32;
const GUTTER = 16;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const COL_WIDTH = (CONTENT_WIDTH - GUTTER) / 2;

const TITLE_SIZE = 13;
const SUBTITLE_SIZE = 8;
const CHAPTER_SIZE = 10;
const BODY_SIZE = 8;
const BODY_LEADING = 10;
const PDF_FONT = 'SourceSerif4';
const INK: [number, number, number] = [28, 32, 36];

function registerSiteFonts(doc: jsPDF): void {
  doc.addFileToVFS('SourceSerif4-Regular.ttf', sourceSerif4Regular);
  doc.addFont('SourceSerif4-Regular.ttf', PDF_FONT, 'normal');
  doc.addFileToVFS('SourceSerif4-Bold.ttf', sourceSerif4Bold);
  doc.addFont('SourceSerif4-Bold.ttf', PDF_FONT, 'bold');
}

function normalizePoetic(text: string): string {
  return text
    .replace(/\u00A0/g, ' ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2014/g, '--')
    .replace(/\u2013/g, '-');
}

/** Soft-sanitize a poetic line without collapsing intentional indent. */
function pdfSafePoeticLine(line: string): string {
  return line
    .replace(/\u00A0/g, ' ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2014/g, '--')
    .replace(/\u2013/g, '-');
}

/**
 * Prefer lineated ESV poetry when available.
 * Full text keeps ESV indentation; first-letter mode left-aligns so collapsed
 * words don't look stair-stepped from leftover poetic indent.
 */
function chapterLines(deck: DtChapterDeck, textMode: PrintTextMode): string[] {
  if (deck.displayText) {
    const poetic = normalizePoetic(deck.displayText);
    const source =
      textMode === 'first-letter' ? firstLetterSkeleton(poetic) : poetic;
    const rawLines = source.split('\n').map((line) => line.replace(/\t/g, '    '));

    if (textMode !== 'first-letter') {
      return rawLines.map(pdfSafePoeticLine);
    }

    const cleaned: string[] = [];
    for (const line of rawLines) {
      const trimmed = line.trim();
      if (!trimmed) {
        if (cleaned.length > 0 && cleaned[cleaned.length - 1] !== '') {
          cleaned.push('');
        }
        continue;
      }
      // "[2]     H m m…" / "    H m…" → "[2] H m…" / "H m…"
      cleaned.push(
        pdfSafePoeticLine(
          trimmed
            .replace(/^(\[\d+\])\s+/, '$1 ')
            .replace(/ {2,}/g, ' '),
        ),
      );
    }
    while (cleaned.length > 0 && cleaned[cleaned.length - 1] === '') {
      cleaned.pop();
    }
    return cleaned;
  }

  const prose =
    textMode === 'first-letter'
      ? pdfSafeText(firstLetterSkeleton(toChapterReviewVerse(deck).text))
      : pdfSafeText(toChapterReviewVerse(deck).text);
  return [prose];
}

/**
 * Two-column PDF of DT chapters only (not the 171-passage collection).
 */
export function downloadDtChaptersPdf(textMode: PrintTextMode = 'full'): void {
  const doc = new jsPDF({ unit: 'pt', format: 'letter', compress: true });
  registerSiteFonts(doc);

  let column: 0 | 1 = 0;
  let y = MARGIN_TOP;
  let contentTop = MARGIN_TOP;

  const columnX = (col: 0 | 1) =>
    col === 0 ? MARGIN_X : MARGIN_X + COL_WIDTH + GUTTER;

  const startPage = (isFirst: boolean) => {
    if (!isFirst) doc.addPage();
    column = 0;
    y = MARGIN_TOP;

    doc.setFont(PDF_FONT, 'bold');
    doc.setFontSize(TITLE_SIZE);
    doc.setTextColor(...INK);
    const title = 'DT Chapter Memory';
    doc.text(title, (PAGE_WIDTH - doc.getTextWidth(title)) / 2, y + TITLE_SIZE);
    y += TITLE_SIZE + 4;

    doc.setFont(PDF_FONT, 'normal');
    doc.setFontSize(SUBTITLE_SIZE);
    doc.setTextColor(90, 96, 104);
    const subtitle =
      textMode === 'first-letter'
        ? 'First letters · ESV'
        : 'Full text · ESV';
    doc.text(
      subtitle,
      (PAGE_WIDTH - doc.getTextWidth(subtitle)) / 2,
      y + SUBTITLE_SIZE,
    );
    y += SUBTITLE_SIZE + 14;
    contentTop = y;
    doc.setTextColor(...INK);
  };

  const advanceColumnOrPage = (needed: number) => {
    if (y + needed <= PAGE_HEIGHT - MARGIN_BOTTOM) return;
    if (column === 0) {
      column = 1;
      y = contentTop;
      return;
    }
    startPage(false);
  };

  startPage(true);

  for (const deck of dtChapterDecks) {
    advanceColumnOrPage(CHAPTER_SIZE + BODY_LEADING * 3);
    const x = columnX(column);

    doc.setFont(PDF_FONT, 'bold');
    doc.setFontSize(CHAPTER_SIZE);
    doc.text(pdfSafeText(deck.name), x, y);
    y += CHAPTER_SIZE + 4;

    doc.setFont(PDF_FONT, 'normal');
    doc.setFontSize(BODY_SIZE);

    const lines = chapterLines(deck, textMode);
    const isPoetic = Boolean(deck.displayText);

    for (const rawLine of lines) {
      if (rawLine.length === 0) {
        advanceColumnOrPage(BODY_LEADING * 0.6);
        y += BODY_LEADING * 0.6;
        continue;
      }

      if (isPoetic && textMode === 'full') {
        // Keep ESV indent; wrap only if a line exceeds the column.
        const indentMatch = rawLine.match(/^(\s*)/);
        const indent = indentMatch?.[1] ?? '';
        const indentWidth = doc.getTextWidth(indent);
        const available = Math.max(40, COL_WIDTH - indentWidth);
        const wrapped = doc.splitTextToSize(
          rawLine.slice(indent.length),
          available,
        ) as string[];
        for (let i = 0; i < wrapped.length; i += 1) {
          advanceColumnOrPage(BODY_LEADING);
          const prefix = i === 0 ? indent : indent;
          doc.text(prefix + wrapped[i], columnX(column), y);
          y += BODY_LEADING;
        }
      } else {
        const wrapped = doc.splitTextToSize(rawLine, COL_WIDTH) as string[];
        for (const line of wrapped) {
          advanceColumnOrPage(BODY_LEADING);
          doc.text(line, columnX(column), y);
          y += BODY_LEADING;
        }
      }
    }

    y += 10;
  }

  const filename =
    textMode === 'first-letter'
      ? 'DT-Chapter-Memory-first-letters.pdf'
      : 'DT-Chapter-Memory.pdf';
  doc.save(filename);
}

import { jsPDF } from 'jspdf';
import type { Verse } from '@/types';
import { appConfig } from '@/config/app';
import { firstLetterSkeleton } from '@/lib/text/tokenize';
import sourceSerif4Regular from '@/assets/fonts/SourceSerif4-Regular.ttf?base64';
import sourceSerif4Bold from '@/assets/fonts/SourceSerif4-Bold.ttf?base64';

export type PrintTextMode = 'full' | 'first-letter';

const PAGE_WIDTH = 612; // US Letter points
const PAGE_HEIGHT = 792;
const MARGIN_X = 40;
const MARGIN_TOP = 36;
const MARGIN_BOTTOM = 36;
const GUTTER = 20;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const COL_WIDTH = (CONTENT_WIDTH - GUTTER) / 2;

const TITLE_SIZE = 16;
const SECTION_SIZE = 9;
const META_SIZE = 9.5;
const BODY_SIZE = 9.5;
const BODY_LEADING = 12.5;

const SECTION_PAD_Y = 5;
const SECTION_PAD_X = 6;
const VERSE_GAP_TOP = 8;
const DIVIDER_GAP = 7;
const CHECK_SIZE = 8;

const SECTION_BG: [number, number, number] = [228, 235, 240];
const DIVIDER: [number, number, number] = [200, 208, 216];
const INK: [number, number, number] = [28, 32, 36];

/** Matches the site serif stack open face (see `--font-serif` in index.css). */
const PDF_FONT = 'SourceSerif4';

type SectionBlock = { kind: 'section'; title: string };
type VerseBlock = {
  kind: 'verse';
  order: number;
  reference: string;
  lines: string[];
};
type Block = SectionBlock | VerseBlock;

/** jsPDF built-in fonts use WinAnsi — normalize curly punctuation and NBSPs. */
export function pdfSafeText(text: string): string {
  return text
    .replace(/\u00A0/g, ' ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2014/g, '--')
    .replace(/\u2013/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Verse body for the PDF: full text, or first letters with punctuation kept. */
export function verseTextForPrint(
  text: string,
  textMode: PrintTextMode = 'full',
): string {
  const source =
    textMode === 'first-letter' ? firstLetterSkeleton(text) : text;
  return pdfSafeText(source);
}

function registerSiteFonts(doc: jsPDF): void {
  doc.addFileToVFS('SourceSerif4-Regular.ttf', sourceSerif4Regular);
  doc.addFont('SourceSerif4-Regular.ttf', PDF_FONT, 'normal');
  doc.addFileToVFS('SourceSerif4-Bold.ttf', sourceSerif4Bold);
  doc.addFont('SourceSerif4-Bold.ttf', PDF_FONT, 'bold');
}

function setPdfFont(doc: jsPDF, style: 'normal' | 'bold' = 'normal'): void {
  doc.setFont(PDF_FONT, style);
}

function buildBlocks(
  doc: jsPDF,
  verses: readonly Verse[],
  textMode: PrintTextMode,
): Block[] {
  const blocks: Block[] = [];
  let lastSection: string | null = null;
  const textWidth = COL_WIDTH - CHECK_SIZE - 6;

  for (const verse of verses) {
    if (verse.section !== lastSection) {
      blocks.push({ kind: 'section', title: verse.section.toUpperCase() });
      lastSection = verse.section;
    }

    const body = verseTextForPrint(verse.text, textMode);
    setPdfFont(doc, 'normal');
    doc.setFontSize(BODY_SIZE);
    const lines = doc.splitTextToSize(body, textWidth) as string[];
    blocks.push({
      kind: 'verse',
      order: verse.order,
      reference: pdfSafeText(verse.reference),
      lines,
    });
  }

  return blocks;
}

function blockHeight(block: Block): number {
  if (block.kind === 'section') {
    return SECTION_PAD_Y * 2 + SECTION_SIZE + 4;
  }
  const metaLine = META_SIZE + 2;
  const body = block.lines.length * BODY_LEADING;
  return VERSE_GAP_TOP + metaLine + 2 + body + DIVIDER_GAP;
}

function columnX(column: 0 | 1): number {
  return MARGIN_X + column * (COL_WIDTH + GUTTER);
}

function drawSection(
  doc: jsPDF,
  x: number,
  y: number,
  title: string,
): number {
  const height = SECTION_PAD_Y * 2 + SECTION_SIZE;
  doc.setFillColor(...SECTION_BG);
  doc.rect(x, y, COL_WIDTH, height, 'F');
  doc.setTextColor(...INK);
  setPdfFont(doc, 'bold');
  doc.setFontSize(SECTION_SIZE);
  doc.text(pdfSafeText(title), x + SECTION_PAD_X, y + SECTION_PAD_Y + SECTION_SIZE - 1);
  return y + height + 4;
}

function drawVerse(
  doc: jsPDF,
  x: number,
  y: number,
  block: VerseBlock,
): number {
  let cursor = y + VERSE_GAP_TOP;
  const checkY = cursor - CHECK_SIZE + 1.5;

  doc.setDrawColor(...INK);
  doc.setLineWidth(0.6);
  doc.rect(x, checkY, CHECK_SIZE, CHECK_SIZE);

  const metaX = x + CHECK_SIZE + 5;
  doc.setTextColor(...INK);
  setPdfFont(doc, 'normal');
  doc.setFontSize(META_SIZE);
  const numberLabel = `${block.order})`;
  doc.text(numberLabel, metaX, cursor);

  const numberWidth = doc.getTextWidth(numberLabel);
  setPdfFont(doc, 'bold');
  doc.setFontSize(META_SIZE);
  doc.text(block.reference, metaX + numberWidth + 3, cursor);

  cursor += META_SIZE + 3;
  setPdfFont(doc, 'normal');
  doc.setFontSize(BODY_SIZE);
  for (const line of block.lines) {
    doc.text(line, metaX, cursor);
    cursor += BODY_LEADING;
  }

  cursor += 2;
  doc.setDrawColor(...DIVIDER);
  doc.setLineWidth(0.4);
  doc.line(x, cursor, x + COL_WIDTH, cursor);
  return cursor + DIVIDER_GAP - 2;
}

export type PrintVersesPdfOptions = {
  verses: readonly Verse[];
  title?: string;
  filename?: string;
  textMode?: PrintTextMode;
};

/**
 * Build a two-column checklist PDF matching the printed collection layout.
 */
export function buildVersesPdf({
  verses,
  title = appConfig.collectionTitle,
  textMode = 'full',
}: Omit<PrintVersesPdfOptions, 'filename'>): jsPDF {
  if (verses.length === 0) {
    throw new Error('No passages to print.');
  }

  const doc = new jsPDF({
    unit: 'pt',
    format: 'letter',
    compress: true,
  });
  registerSiteFonts(doc);

  const blocks = buildBlocks(doc, verses, textMode);
  let column: 0 | 1 = 0;
  let y = MARGIN_TOP;
  let contentBottom = PAGE_HEIGHT - MARGIN_BOTTOM;
  const titleBaseline = MARGIN_TOP + TITLE_SIZE + 18;

  const startPage = (isFirst: boolean) => {
    if (!isFirst) doc.addPage();
    column = 0;
    y = MARGIN_TOP;

    setPdfFont(doc, 'bold');
    doc.setFontSize(TITLE_SIZE);
    doc.setTextColor(...INK);
    const safeTitle = pdfSafeText(title);
    const titleWidth = doc.getTextWidth(safeTitle);
    doc.text(safeTitle, (PAGE_WIDTH - titleWidth) / 2, y + TITLE_SIZE);
    y = titleBaseline;
    contentBottom = PAGE_HEIGHT - MARGIN_BOTTOM;
  };

  startPage(true);

  for (const block of blocks) {
    const height = blockHeight(block);

    if (y + height > contentBottom) {
      if (column === 0) {
        column = 1;
        y = titleBaseline;
      } else {
        startPage(false);
      }
    }

    const x = columnX(column);
    if (block.kind === 'section') {
      y = drawSection(doc, x, y, block.title);
    } else {
      y = drawVerse(doc, x, y, block);
    }
  }

  return doc;
}

/** Build the PDF and trigger a browser download. */
export function downloadVersesPdf({
  verses,
  title = appConfig.collectionTitle,
  filename = 'verses.pdf',
  textMode = 'full',
}: PrintVersesPdfOptions): void {
  buildVersesPdf({ verses, title, textMode }).save(filename);
}


/** Build a filesystem-safe PDF name from a deck or book label. */
export function versesPdfFilename(scopeLabel: string): string {
  const slug = scopeLabel
    .replace(/['\u2018\u2019]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `100-Verses-${slug || 'Collection'}.pdf`;
}

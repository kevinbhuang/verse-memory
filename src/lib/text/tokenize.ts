import { normalizeApostrophes, normalizeWord } from './normalize';

/**
 * A passage is tokenised into an alternating stream of words and "gaps".
 * Concatenating every segment's `text` reproduces the canonical passage
 * character for character, which lets review modes hide or reveal individual
 * words without ever rewriting Scripture.
 */
export type Segment =
  | { type: 'word'; text: string; wordIndex: number }
  | { type: 'gap'; text: string };

export type WordToken = {
  wordIndex: number;
  /** The word exactly as it appears in the canonical text. */
  text: string;
  /** Lower-cased, apostrophe-normalised form used for comparison. */
  normalized: string;
  /** The single key the reader must press in first-letter mode. */
  firstLetter: string;
  /** Character offset of the word inside the canonical text. */
  start: number;
  end: number;
};

/**
 * Letters and digits form words. Apostrophes and hyphens join them
 * ("eagles' wings", "self-control" are single words), while em dashes,
 * quotation marks and all other punctuation separate them.
 */
const WORD_PATTERN = /[\p{L}\p{N}]+(?:['\u2019-][\p{L}\p{N}]+)*['\u2019]?/gu;

export function segmentText(text: string): Segment[] {
  const segments: Segment[] = [];
  let cursor = 0;
  let wordIndex = 0;

  for (const match of text.matchAll(WORD_PATTERN)) {
    const start = match.index;
    if (start > cursor) {
      segments.push({ type: 'gap', text: text.slice(cursor, start) });
    }
    segments.push({ type: 'word', text: match[0], wordIndex });
    wordIndex += 1;
    cursor = start + match[0].length;
  }

  if (cursor < text.length) {
    segments.push({ type: 'gap', text: text.slice(cursor) });
  }

  return segments;
}

export function tokenize(text: string): WordToken[] {
  const tokens: WordToken[] = [];
  let wordIndex = 0;

  for (const match of text.matchAll(WORD_PATTERN)) {
    const raw = match[0];
    tokens.push({
      wordIndex,
      text: raw,
      normalized: normalizeWord(raw),
      firstLetter: firstLetterOf(raw),
      start: match.index,
      end: match.index + raw.length,
    });
    wordIndex += 1;
  }

  return tokens;
}

/** Just the words, in order. */
export function words(text: string): string[] {
  return tokenize(text).map((token) => token.text);
}

export function wordCount(text: string): number {
  return tokenize(text).length;
}

/**
 * The expected keystroke for a word. Case is irrelevant, so "LORD" and "Lord"
 * both expect `l`; a word beginning with a digit expects that digit.
 */
export function firstLetterOf(word: string): string {
  const normalized = normalizeApostrophes(word.normalize('NFC'));
  const match = normalized.match(/[\p{L}\p{N}]/u);
  return match ? match[0].toLowerCase() : '';
}

/** First letter/digit of a word with its original capitalisation preserved. */
export function firstLetterGlyph(word: string): string {
  const normalized = normalizeApostrophes(word.normalize('NFC'));
  const match = normalized.match(/[\p{L}\p{N}]/u);
  return match ? match[0] : '';
}

/** e.g. "For God so loved" -> ["f", "g", "s", "l"] */
export function firstLetterSequence(text: string): string[] {
  return tokenize(text).map((token) => token.firstLetter);
}

/**
 * Collapses each word to its first letter while keeping original capitalisation,
 * spacing, and punctuation. e.g. "Hear, O Israel—" -> "H, O I—"
 */
export function firstLetterSkeleton(text: string): string {
  return segmentText(text)
    .map((segment) =>
      segment.type === 'word'
        ? firstLetterGlyph(segment.text)
        : segment.text.replace(/\u00A0/g, ' '),
    )
    .join('');
}

/** True when the pressed key matches the expected first letter of a word. */
export function matchesFirstLetter(key: string, expectedWord: string): boolean {
  if (key.length !== 1) return false;
  return key.toLowerCase() === firstLetterOf(expectedWord);
}

/**
 * Splits a passage into readable phrases for weak-word reporting: sentence
 * punctuation and line breaks end a phrase, and commas/semicolons/colons
 * break long sentences into clauses.
 */
export function phrasesFor(text: string): Array<{
  text: string;
  startWordIndex: number;
  endWordIndex: number;
}> {
  const segments = segmentText(text);
  const phrases: Array<{
    text: string;
    startWordIndex: number;
    endWordIndex: number;
  }> = [];

  let buffer = '';
  let startWordIndex = -1;
  let endWordIndex = -1;

  const flush = () => {
    const trimmed = buffer.trim();
    if (trimmed !== '' && startWordIndex >= 0) {
      phrases.push({ text: trimmed, startWordIndex, endWordIndex });
    }
    buffer = '';
    startWordIndex = -1;
    endWordIndex = -1;
  };

  for (const segment of segments) {
    buffer += segment.text;
    if (segment.type === 'word') {
      if (startWordIndex < 0) startWordIndex = segment.wordIndex;
      endWordIndex = segment.wordIndex;
    } else if (/[.;:!?\n]/.test(segment.text) || /,/.test(segment.text)) {
      flush();
    }
  }
  flush();

  return phrases;
}

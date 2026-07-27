/**
 * Normalisation helpers used for *grading only*.
 *
 * Canonical Scripture text is never replaced by a normalised form. Every
 * function here returns a new string that is used to compare what the user
 * typed against what the passage says; the displayed text always comes
 * straight from `verses.json`.
 */

/** Curly single and double quotes become their straight equivalents. */
export function normalizeQuotes(text: string): string {
  return text
    .replace(/[\u201c\u201d\u201e\u201f\u2033\u00ab\u00bb]/g, '"')
    .replace(/[\u2018\u2019\u201a\u201b\u2032]/g, "'");
}

/** Alias kept separate because apostrophes matter for word tokenisation. */
export function normalizeApostrophes(text: string): string {
  return text.replace(/[\u2018\u2019\u201a\u201b\u2032]/g, "'");
}

/** Em dashes, en dashes and friends become a single hyphen. */
export function normalizeDashes(text: string): string {
  return text.replace(/[\u2010-\u2015\u2212]/g, '-');
}

/** Non-breaking spaces, tabs and line breaks collapse to single spaces. */
export function collapseWhitespace(text: string): string {
  return text.replace(/[\s\u00a0]+/g, ' ').trim();
}

const PUNCTUATION = /[.,;:!?"'()[\]{}\u2014\u2013\u2026*]/g;

export function stripPunctuation(text: string): string {
  return text.replace(PUNCTUATION, '');
}

export type NormalizeOptions = {
  /** Keep `.,;:!?` and quotation marks in the comparison. */
  punctuation?: boolean;
  /** Keep the original letter case. */
  capitalization?: boolean;
};

/**
 * Produces the comparable representation of a passage or a typed answer.
 *
 * Forgiving grading (the default) ignores case and punctuation and collapses
 * whitespace. Exact grading can opt into punctuation and capitalisation.
 */
export function normalizeForGrading(
  text: string,
  options: NormalizeOptions = {},
): string {
  const { punctuation = false, capitalization = false } = options;

  let result = text.normalize('NFC');
  result = normalizeQuotes(result);
  result = normalizeDashes(result);
  // A hyphen between words is a word separator for grading purposes, but a
  // hyphen inside a compound word ("self-control") is not.
  result = result.replace(/-{2,}/g, ' ');
  result = collapseWhitespace(result);

  if (!punctuation) {
    result = stripPunctuation(result);
    result = collapseWhitespace(result);
  }

  if (!capitalization) {
    result = result.toLowerCase();
  }

  return result;
}

/** Normalises a single word for comparison, keeping internal apostrophes. */
export function normalizeWord(word: string): string {
  return normalizeApostrophes(word.normalize('NFC'))
    .toLowerCase()
    .replace(/[^\p{L}\p{N}'-]/gu, '')
    .replace(/^'+|'+$/g, '');
}

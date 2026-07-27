/**
 * Bible reference parsing and comparison.
 *
 * Reference practice should accept the many ways a reader might write the
 * same reference ("John 3:16", "Jn 3.16", "john3:16") while still refusing a
 * genuinely different passage.
 */

/** Canonical book name -> accepted aliases (lower case, no spaces or dots). */
const BOOK_ALIASES: Record<string, string[]> = {
  Genesis: ['gen', 'ge', 'gn'],
  Exodus: ['exo', 'ex', 'exod'],
  Leviticus: ['lev', 'le', 'lv'],
  Numbers: ['num', 'nu', 'nm', 'nb'],
  Deuteronomy: ['deut', 'dt', 'de'],
  Joshua: ['josh', 'jos', 'jsh'],
  Judges: ['judg', 'jdg', 'jg'],
  Ruth: ['rth', 'ru'],
  '1 Samuel': ['1sam', '1sa', '1s', 'firstsamuel', 'isam', '1samuel'],
  '2 Samuel': ['2sam', '2sa', '2s', 'secondsamuel', 'iisam', '2samuel'],
  '1 Kings': ['1kgs', '1ki', '1k', '1kings'],
  '2 Kings': ['2kgs', '2ki', '2k', '2kings'],
  '1 Chronicles': ['1chr', '1ch', '1chron', '1chronicles'],
  '2 Chronicles': ['2chr', '2ch', '2chron', '2chronicles'],
  Ezra: ['ezr'],
  Nehemiah: ['neh', 'ne'],
  Esther: ['esth', 'est', 'es'],
  Job: ['jb'],
  Psalm: ['psalms', 'psa', 'ps', 'pslm', 'psm'],
  Proverbs: ['prov', 'pro', 'prv', 'pr'],
  Ecclesiastes: ['eccl', 'ecc', 'ec', 'qoh'],
  'Song of Solomon': ['song', 'sos', 'songofsongs', 'canticles', 'cant'],
  Isaiah: ['isa', 'is'],
  Jeremiah: ['jer', 'je', 'jr'],
  Lamentations: ['lam', 'la'],
  Ezekiel: ['ezek', 'eze', 'ezk'],
  Daniel: ['dan', 'da', 'dn'],
  Hosea: ['hos', 'ho'],
  Joel: ['joe', 'jl'],
  Amos: ['am'],
  Obadiah: ['obad', 'ob'],
  Jonah: ['jon', 'jnh'],
  Micah: ['mic', 'mc'],
  Nahum: ['nah', 'na'],
  Habakkuk: ['hab', 'hb'],
  Zephaniah: ['zeph', 'zep', 'zp'],
  Haggai: ['hag', 'hg'],
  Zechariah: ['zech', 'zec', 'zc'],
  Malachi: ['mal', 'ml'],
  Matthew: ['matt', 'mat', 'mt'],
  Mark: ['mrk', 'mk', 'mr'],
  Luke: ['luk', 'lk'],
  John: ['jhn', 'jn', 'joh'],
  Acts: ['act', 'ac'],
  Romans: ['rom', 'ro', 'rm'],
  '1 Corinthians': ['1cor', '1co', '1corinthians', 'icor'],
  '2 Corinthians': ['2cor', '2co', '2corinthians', 'iicor'],
  Galatians: ['gal', 'ga'],
  Ephesians: ['eph', 'ephes'],
  Philippians: ['phil', 'php', 'pp'],
  Colossians: ['col', 'co'],
  '1 Thessalonians': ['1thess', '1thes', '1th', '1thessalonians'],
  '2 Thessalonians': ['2thess', '2thes', '2th', '2thessalonians'],
  '1 Timothy': ['1tim', '1ti', '1tm', '1timothy'],
  '2 Timothy': ['2tim', '2ti', '2tm', '2timothy'],
  Titus: ['tit', 'ti'],
  Philemon: ['phlm', 'phm', 'pm'],
  Hebrews: ['heb'],
  James: ['jas', 'jm'],
  '1 Peter': ['1pet', '1pe', '1pt', '1p', '1peter'],
  '2 Peter': ['2pet', '2pe', '2pt', '2p', '2peter'],
  '1 John': ['1jn', '1joh', '1jhn', '1j', '1john'],
  '2 John': ['2jn', '2joh', '2jhn', '2j', '2john'],
  '3 John': ['3jn', '3joh', '3jhn', '3j', '3john'],
  Jude: ['jud', 'jd'],
  Revelation: ['rev', 're', 'apocalypse', 'revelations'],
};

const ALIAS_LOOKUP = new Map<string, string>();
for (const [canonical, aliases] of Object.entries(BOOK_ALIASES)) {
  ALIAS_LOOKUP.set(canonicalKey(canonical), canonical);
  for (const alias of aliases) {
    ALIAS_LOOKUP.set(alias, canonical);
  }
}

/** Lower-cases and removes spaces, dots and ordinal words. */
function canonicalKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/\u2019/g, "'")
    .replace(/^(the\s+)?/, '')
    .replace(/^first\s+/, '1')
    .replace(/^second\s+/, '2')
    .replace(/^third\s+/, '3')
    .replace(/^i{3}\s+/, '3')
    .replace(/^i{2}\s+/, '2')
    .replace(/^i\s+/, '1')
    .replace(/[\s.\u00a0]/g, '');
}

export type ParsedReference = {
  book: string;
  chapter: number;
  verseStart: number | null;
  verseEnd: number | null;
  /** Trailing part markers such as the "b" in "Zechariah 4:6b". */
  startPart: string | null;
  endPart: string | null;
  /** The chapter of the end of a cross-chapter range, when present. */
  endChapter: number | null;
};

const REFERENCE_PATTERN =
  /^\s*((?:[1-3]|i{1,3}|first|second|third)?\s*[\p{L}][\p{L}\s.']*?)\s*(\d+)\s*[:.\u00b7]?\s*(\d+)?\s*([a-c])?\s*(?:[-\u2013\u2014]\s*(?:(\d+)\s*:\s*)?(\d+)\s*([a-c])?)?\s*$/iu;

export function parseReference(input: string): ParsedReference | null {
  if (!input) return null;
  const match = input.normalize('NFC').match(REFERENCE_PATTERN);
  if (!match) return null;

  const [, bookRaw, chapterRaw, verseRaw, startPart, endChapterRaw, endVerseRaw, endPart] =
    match;

  const book = ALIAS_LOOKUP.get(canonicalKey(bookRaw));
  if (!book) return null;

  const chapter = Number.parseInt(chapterRaw, 10);
  if (!Number.isFinite(chapter)) return null;

  const verseStart = verseRaw ? Number.parseInt(verseRaw, 10) : null;
  const verseEnd = endVerseRaw ? Number.parseInt(endVerseRaw, 10) : null;

  return {
    book,
    chapter,
    verseStart,
    verseEnd,
    startPart: startPart ? startPart.toLowerCase() : null,
    endPart: endPart ? endPart.toLowerCase() : null,
    endChapter: endChapterRaw ? Number.parseInt(endChapterRaw, 10) : null,
  };
}

/** A stable, comparable string form: "john 3:16-17". */
export function normalizeReference(input: string): string | null {
  const parsed = parseReference(input);
  if (!parsed) return null;
  return formatParsed(parsed);
}

function formatParsed(parsed: ParsedReference): string {
  let result = `${parsed.book.toLowerCase()} ${parsed.chapter}`;
  if (parsed.verseStart !== null) {
    result += `:${parsed.verseStart}`;
  }
  if (parsed.verseEnd !== null) {
    result += `-${parsed.endChapter ? `${parsed.endChapter}:` : ''}${parsed.verseEnd}`;
  }
  return result;
}

export type ReferenceMatch = {
  isMatch: boolean;
  /** True when the book and chapter are right but the verses are not. */
  isCloseMatch: boolean;
  parsed: ParsedReference | null;
  expected: ParsedReference | null;
  message: string;
};

/**
 * Compares a typed reference against the canonical one. Formatting varies
 * freely, but the book, chapter and verse range must agree; part markers such
 * as "3a" are optional for the reader.
 */
export function matchReference(
  input: string,
  canonicalReference: string,
): ReferenceMatch {
  const expected = parseReference(canonicalReference);
  const parsed = parseReference(input);

  if (!parsed) {
    return {
      isMatch: false,
      isCloseMatch: false,
      parsed: null,
      expected,
      message: 'That does not look like a Bible reference.',
    };
  }

  if (!expected) {
    return {
      isMatch: false,
      isCloseMatch: false,
      parsed,
      expected: null,
      message: 'The stored reference could not be parsed.',
    };
  }

  if (parsed.book !== expected.book) {
    return {
      isMatch: false,
      isCloseMatch: false,
      parsed,
      expected,
      message: `Wrong book \u2014 you wrote ${parsed.book}.`,
    };
  }

  if (parsed.chapter !== expected.chapter) {
    return {
      isMatch: false,
      isCloseMatch: false,
      parsed,
      expected,
      message: `Right book, wrong chapter \u2014 you wrote chapter ${parsed.chapter}.`,
    };
  }

  const versesMatch =
    parsed.verseStart === expected.verseStart &&
    (expected.verseEnd === null || parsed.verseEnd === expected.verseEnd);

  if (!versesMatch) {
    return {
      isMatch: false,
      isCloseMatch: true,
      parsed,
      expected,
      message: 'Right book and chapter, but the verse numbers do not match.',
    };
  }

  return {
    isMatch: true,
    isCloseMatch: false,
    parsed,
    expected,
    message: 'Correct.',
  };
}

/** Book name only, used for grouping and search. */
export function bookOf(reference: string): string | null {
  return parseReference(reference)?.book ?? null;
}

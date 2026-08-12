/**
 * Deterministic blank selection for fill-in-the-blank practice.
 * Prefers content words and theological terms; skips glue words like “a” / “and”.
 */

/** Common function words that are poor cloze targets. */
const STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'but',
  'nor',
  'of',
  'to',
  'in',
  'on',
  'at',
  'by',
  'for',
  'from',
  'with',
  'as',
  'into',
  'onto',
  'upon',
  'out',
  'up',
  'down',
  'over',
  'under',
  'about',
  'above',
  'below',
  'between',
  'through',
  'against',
  'before',
  'after',
  'among',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'am',
  'it',
  'its',
  'he',
  'she',
  'his',
  'her',
  'him',
  'they',
  'them',
  'their',
  'we',
  'us',
  'our',
  'you',
  'your',
  'i',
  'me',
  'my',
  'mine',
  'that',
  'this',
  'these',
  'those',
  'who',
  'whom',
  'which',
  'what',
  'when',
  'where',
  'there',
  'then',
  'than',
  'so',
  'if',
  'not',
  'no',
  'do',
  'does',
  'did',
  'will',
  'shall',
  'may',
  'can',
  'could',
  'would',
  'should',
  'has',
  'have',
  'had',
  'all',
  'both',
  'each',
  'every',
  'any',
  'some',
  'such',
  'also',
  'too',
  'only',
  'even',
  'yet',
  'still',
  'just',
  'very',
  'more',
  'most',
  'other',
  'own',
  'same',
  'one',
  'two',
  'o',
  'oh',
]);

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function nextHash(hash: number): number {
  return (hash * 1664525 + 1013904223) >>> 0;
}

function shuffleInPlace<T>(items: T[], seedHash: number): number {
  let hash = seedHash;
  for (let i = items.length - 1; i > 0; i -= 1) {
    hash = nextHash(hash);
    const j = hash % (i + 1);
    const tmp = items[i]!;
    items[i] = items[j]!;
    items[j] = tmp;
  }
  return hash;
}

/** Strip trailing possessive / plural-ish apostrophe for stop-word checks. */
function coreWord(word: string): string {
  return word
    .normalize('NFC')
    .replace(/['\u2019]s$/i, '')
    .replace(/['\u2019]$/i, '')
    .toLowerCase();
}

/**
 * Higher = better blank target. Stop words score 0 and are only used as a
 * last resort when a short passage has too few content words.
 */
export function blankWorth(word: string): number {
  const core = coreWord(word);
  if (!core) return 0;
  if (STOP_WORDS.has(core)) return 0;

  let score = 10;
  // Longer content words carry more of the meaning.
  if (core.length >= 6) score += 8;
  else if (core.length >= 4) score += 5;
  else if (core.length <= 2) score -= 4;

  // Divine names / all-caps emphasis (LORD, GOD).
  const letters = word.replace(/[^A-Za-z]/g, '');
  if (letters.length >= 3 && letters === letters.toUpperCase()) {
    score += 6;
  } else if (/^[A-Z]/.test(word) && core.length >= 3) {
    // Proper names / sentence starts — still useful, but less than LORD.
    score += 2;
  }

  return Math.max(1, score);
}

function targetBlankCount(wordCount: number): number {
  if (wordCount <= 0) return 0;
  // A bit sparser than before — quality over quantity.
  return Math.min(
    Math.max(2, Math.round(wordCount * 0.22)),
    Math.min(8, wordCount),
  );
}

/**
 * Pick blank indexes from the passage words.
 * Deterministic for a given seed; prefers spaced-out content words.
 */
export function chooseBlankIndexes(
  words: readonly string[],
  seed: string,
): number[] {
  const wordCount = words.length;
  if (wordCount === 0) return [];

  const target = targetBlankCount(wordCount);
  const scored = words.map((word, index) => ({
    index,
    score: blankWorth(word),
  }));

  const preferred = scored.filter((item) => item.score > 0);
  const fallback = scored.filter((item) => item.score === 0);

  let hash = hashSeed(seed);
  // Higher-worth words first, then a seed shuffle within similar scores so
  // retries (different seeds) vary which content words are asked.
  preferred.sort((a, b) => b.score - a.score || a.index - b.index);
  // Shuffle within score bands so we don’t always blank the same longest words.
  const bands: Array<typeof preferred> = [];
  for (const item of preferred) {
    const last = bands[bands.length - 1];
    if (last && last[0]!.score === item.score) last.push(item);
    else bands.push([item]);
  }
  const orderedPreferred: typeof preferred = [];
  for (const band of bands) {
    hash = shuffleInPlace(band, hash);
    orderedPreferred.push(...band);
  }
  hash = shuffleInPlace(fallback, hash);

  const pool = [...orderedPreferred, ...fallback];
  const chosen: number[] = [];

  for (const candidate of pool) {
    if (chosen.length >= target) break;
    // Prefer not blanking two neighboring words when alternatives remain.
    const adjacent = chosen.some(
      (index) => Math.abs(index - candidate.index) === 1,
    );
    if (adjacent && chosen.length + (pool.length - pool.indexOf(candidate)) > target) {
      continue;
    }
    chosen.push(candidate.index);
  }

  // If adjacency skips left us short, fill remaining ignoring adjacency.
  if (chosen.length < target) {
    for (const candidate of pool) {
      if (chosen.length >= target) break;
      if (!chosen.includes(candidate.index)) chosen.push(candidate.index);
    }
  }

  return chosen.sort((a, b) => a - b);
}

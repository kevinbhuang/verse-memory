import type { WordError } from '@/types';
import { tokenize } from './tokenize';
import { normalizeWord, type NormalizeOptions } from './normalize';

export type DiffOpType = 'correct' | 'missing' | 'extra' | 'replaced' | 'moved';

export type DiffOp = {
  type: DiffOpType;
  /** The canonical word, when one is involved. */
  expected: string | null;
  /** What the reader typed, when anything was typed at this position. */
  received: string | null;
  expectedIndex: number | null;
  receivedIndex: number | null;
  /**
   * Set on the second half of a moved-word pair so the same mistake is shown
   * in both places but only counted once.
   */
  movedEcho?: boolean;
};

export type GradeResult = {
  ops: DiffOp[];
  accuracy: number;
  correctCount: number;
  missingCount: number;
  extraCount: number;
  replacedCount: number;
  movedCount: number;
  expectedWordCount: number;
  wordErrors: WordError[];
};

function comparable(word: string, options: NormalizeOptions): string {
  const normalized = normalizeWord(word);
  return options.capitalization ? word.replace(/[^\p{L}\p{N}'-]/gu, '') : normalized;
}

/** Longest common subsequence table over two word lists. */
function lcsTable(a: string[], b: string[]): Int32Array[] {
  const table: Int32Array[] = Array.from(
    { length: a.length + 1 },
    () => new Int32Array(b.length + 1),
  );

  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i][j] =
        a[i] === b[j]
          ? table[i + 1][j + 1] + 1
          : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  return table;
}

/**
 * Word-by-word comparison of a typed attempt against the canonical passage.
 *
 * Both sides are normalised for comparison, but every op keeps the original
 * spelling so the review summary can show the reader exactly what they wrote
 * next to exactly what the passage says.
 */
export function gradeAttempt(
  canonicalText: string,
  attemptText: string,
  options: NormalizeOptions = {},
): GradeResult {
  const expectedTokens = tokenize(canonicalText);
  const receivedTokens = tokenize(attemptText);

  const expected = expectedTokens.map((token) =>
    comparable(token.text, options),
  );
  const received = receivedTokens.map((token) =>
    comparable(token.text, options),
  );

  const table = lcsTable(expected, received);
  const ops: DiffOp[] = [];

  let i = 0;
  let j = 0;
  while (i < expected.length && j < received.length) {
    if (expected[i] === received[j]) {
      ops.push({
        type: 'correct',
        expected: expectedTokens[i].text,
        received: receivedTokens[j].text,
        expectedIndex: i,
        receivedIndex: j,
      });
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      ops.push({
        type: 'missing',
        expected: expectedTokens[i].text,
        received: null,
        expectedIndex: i,
        receivedIndex: null,
      });
      i += 1;
    } else {
      ops.push({
        type: 'extra',
        expected: null,
        received: receivedTokens[j].text,
        expectedIndex: null,
        receivedIndex: j,
      });
      j += 1;
    }
  }
  while (i < expected.length) {
    ops.push({
      type: 'missing',
      expected: expectedTokens[i].text,
      received: null,
      expectedIndex: i,
      receivedIndex: null,
    });
    i += 1;
  }
  while (j < received.length) {
    ops.push({
      type: 'extra',
      expected: null,
      received: receivedTokens[j].text,
      expectedIndex: null,
      receivedIndex: j,
    });
    j += 1;
  }

  const merged = mergeSubstitutions(ops);
  markMovedWords(merged, options);

  const correctCount = merged.filter((op) => op.type === 'correct').length;
  const missingCount = merged.filter((op) => op.type === 'missing').length;
  const extraCount = merged.filter((op) => op.type === 'extra').length;
  const replacedCount = merged.filter((op) => op.type === 'replaced').length;
  const movedCount = merged.filter(
    (op) => op.type === 'moved' && !op.movedEcho,
  ).length;

  const denominator = Math.max(expected.length, received.length, 1);
  const accuracy = Math.max(0, Math.min(1, correctCount / denominator));

  const wordErrors: WordError[] = merged
    .filter(
      (op) =>
        op.type !== 'correct' && op.expectedIndex !== null && !op.movedEcho,
    )
    .map((op) => ({
      wordIndex: op.expectedIndex as number,
      expected: op.expected ?? '',
      received: op.received,
      errorType: op.type === 'missing' ? 'missing' : 'incorrect',
    }));

  for (const op of merged) {
    if (op.type === 'extra' && op.received) {
      wordErrors.push({
        wordIndex: -1,
        expected: '',
        received: op.received,
        errorType: 'extra',
      });
    }
  }

  return {
    ops: merged,
    accuracy,
    correctCount,
    missingCount,
    extraCount,
    replacedCount,
    movedCount,
    expectedWordCount: expected.length,
    wordErrors,
  };
}

/** A missing word immediately followed by an extra word is a substitution. */
function mergeSubstitutions(ops: DiffOp[]): DiffOp[] {
  const result: DiffOp[] = [];

  for (let index = 0; index < ops.length; index += 1) {
    const current = ops[index];
    const next = ops[index + 1];

    if (current.type === 'missing' && next?.type === 'extra') {
      result.push({
        type: 'replaced',
        expected: current.expected,
        received: next.received,
        expectedIndex: current.expectedIndex,
        receivedIndex: next.receivedIndex,
      });
      index += 1;
      continue;
    }

    if (current.type === 'extra' && next?.type === 'missing') {
      result.push({
        type: 'replaced',
        expected: next.expected,
        received: current.received,
        expectedIndex: next.expectedIndex,
        receivedIndex: current.receivedIndex,
      });
      index += 1;
      continue;
    }

    result.push(current);
  }

  return result;
}

/**
 * A word that is missing here but typed somewhere else was recited out of
 * order rather than forgotten, which is worth reporting differently.
 */
function markMovedWords(ops: DiffOp[], options: NormalizeOptions): void {
  const missing = ops.filter(
    (op) => op.type === 'missing' && op.expected !== null,
  );
  const extra = ops.filter((op) => op.type === 'extra' && op.received !== null);
  if (missing.length === 0 || extra.length === 0) return;

  const claimed = new Set<DiffOp>();

  for (const missingOp of missing) {
    const target = comparable(missingOp.expected as string, options);
    const partner = extra.find(
      (op) => !claimed.has(op) && comparable(op.received as string, options) === target,
    );
    if (partner) {
      claimed.add(partner);
      missingOp.type = 'moved';
      missingOp.received = partner.received;
      missingOp.receivedIndex = partner.receivedIndex;
      partner.type = 'moved';
      partner.expected = missingOp.expected;
      partner.expectedIndex = missingOp.expectedIndex;
      partner.movedEcho = true;
    }
  }
}

import { describe, expect, it } from 'vitest';
import { addDays, subDays } from 'date-fns';
import { createDefaultProgress } from '@/db/defaults';
import { getVerseByOrder, verses } from '@/data/verses';
import type { VerseProgress } from '@/types';
import {
  DEFAULT_FILTERS,
  filterLibrary,
  groupBySection,
  isFilterActive,
  sortEntries,
  type LibraryFilterState,
} from './filters';

const NOW = new Date('2026-05-04T10:00:00.000Z');

function buildProgress(
  overrides: Record<number, Partial<VerseProgress>> = {},
): Map<string, VerseProgress> {
  return new Map(
    verses.map((verse) => [
      verse.id,
      {
        ...createDefaultProgress(verse.id, NOW),
        ...(overrides[verse.order] ?? {}),
      },
    ]),
  );
}

const filters = (overrides: Partial<LibraryFilterState> = {}) => ({
  ...DEFAULT_FILTERS,
  ...overrides,
});

const orders = (entries: ReturnType<typeof filterLibrary>) =>
  entries.map((entry) => entry.verse.order);

describe('filterLibrary', () => {
  it('returns the whole collection in canonical order by default', () => {
    const entries = filterLibrary(buildProgress(), filters(), NOW);
    expect(entries).toHaveLength(verses.length);
    expect(orders(entries)).toEqual(verses.map((verse) => verse.order));
  });

  it('searches references', () => {
    const entries = filterLibrary(
      buildProgress(),
      filters({ search: 'Romans 8' }),
      NOW,
    );
    expect(entries.length).toBeGreaterThan(0);
    expect(
      entries.every((entry) => entry.verse.reference.startsWith('Romans 8')),
    ).toBe(true);
  });

  it('accepts abbreviated and unspaced reference spellings', () => {
    const target = verses.find((verse) => verse.reference.startsWith('John 3:16'));
    if (!target) throw new Error('expected John 3:16 in the collection');

    for (const query of ['John 3:16', 'jn 3:16', 'john3:16']) {
      const entries = filterLibrary(buildProgress(), filters({ search: query }), NOW);
      expect(entries.map((entry) => entry.verse.id)).toContain(target.id);
    }
  });

  it('searches the words of a passage', () => {
    const entries = filterLibrary(
      buildProgress(),
      filters({ search: 'shepherd' }),
      NOW,
    );
    expect(entries.length).toBeGreaterThan(0);
    expect(
      entries.every((entry) => /shepherd/i.test(entry.verse.text)),
    ).toBe(true);
  });

  it('finds a passage by its number', () => {
    const entries = filterLibrary(buildProgress(), filters({ search: '42' }), NOW);
    expect(orders(entries)).toContain(42);
  });

  it('returns nothing for a search that matches no passage', () => {
    const entries = filterLibrary(
      buildProgress(),
      filters({ search: 'quinoa' }),
      NOW,
    );
    expect(entries).toEqual([]);
  });

  it('filters by section', () => {
    const entries = filterLibrary(
      buildProgress(),
      filters({ section: 'Acts' }),
      NOW,
    );
    expect(orders(entries)).toEqual([69, 70, 71, 72]);
  });

  it('filters by status', () => {
    const entries = filterLibrary(
      buildProgress({ 4: { status: 'learning' }, 9: { status: 'learning' } }),
      filters({ status: 'learning' }),
      NOW,
    );
    expect(orders(entries)).toEqual([4, 9]);
  });

  it('filters by memorized in both directions', () => {
    const progress = buildProgress({ 3: { isMemorized: true } });

    expect(
      orders(filterLibrary(progress, filters({ memorized: 'memorized' }), NOW)),
    ).toEqual([3]);
    expect(
      filterLibrary(progress, filters({ memorized: 'not-memorized' }), NOW),
    ).toHaveLength(verses.length - 1);
  });

  it('filters by the difficult flag', () => {
    const entries = filterLibrary(
      buildProgress({ 12: { isDifficult: true } }),
      filters({ difficultOnly: true }),
      NOW,
    );
    expect(orders(entries)).toEqual([12]);
  });

  it('separates due from overdue', () => {
    const progress = buildProgress({
      1: { nextDueAt: NOW.toISOString() },
      2: { nextDueAt: subDays(NOW, 5).toISOString() },
      3: { nextDueAt: addDays(NOW, 5).toISOString() },
    });

    expect(orders(filterLibrary(progress, filters({ due: 'due' }), NOW))).toEqual([1]);
    expect(orders(filterLibrary(progress, filters({ due: 'overdue' }), NOW))).toEqual([2]);
    expect(
      orders(filterLibrary(progress, filters({ due: 'due-or-overdue' }), NOW)),
    ).toEqual([1, 2]);
    expect(
      orders(filterLibrary(progress, filters({ due: 'scheduled' }), NOW)),
    ).toEqual([3]);
  });

  it('filters passages that have never been reviewed', () => {
    const entries = filterLibrary(
      buildProgress({ 1: { reviewCount: 3 }, 2: { reviewCount: 1 } }),
      filters({ neverReviewed: true }),
      NOW,
    );
    expect(entries).toHaveLength(verses.length - 2);
    expect(orders(entries)).not.toContain(1);
  });

  it('filters passages carrying a note', () => {
    const entries = filterLibrary(
      buildProgress({ 15: { note: 'Remember the context.' }, 16: { note: '  ' } }),
      filters({ withNotes: true }),
      NOW,
    );
    expect(orders(entries)).toEqual([15]);
  });

  it('combines filters', () => {
    const entries = filterLibrary(
      buildProgress({
        69: { isDifficult: true, isMemorized: true },
        70: { isDifficult: true },
        1: { isDifficult: true, isMemorized: true },
      }),
      filters({ section: 'Acts', difficultOnly: true, memorized: 'memorized' }),
      NOW,
    );
    expect(orders(entries)).toEqual([69]);
  });
});

describe('sortEntries', () => {
  const progress = buildProgress({
    5: {
      nextDueAt: addDays(NOW, 1).toISOString(),
      difficultyScore: 10,
      lastReviewedAt: subDays(NOW, 1).toISOString(),
    },
    2: {
      nextDueAt: addDays(NOW, 9).toISOString(),
      difficultyScore: 80,
      lastReviewedAt: subDays(NOW, 20).toISOString(),
    },
    8: {
      nextDueAt: addDays(NOW, 4).toISOString(),
      difficultyScore: 45,
      lastReviewedAt: subDays(NOW, 9).toISOString(),
    },
  });

  const chosen = () =>
    filterLibrary(progress, filters(), NOW).filter((entry) =>
      [2, 5, 8].includes(entry.verse.order),
    );

  it('keeps canonical order by default', () => {
    expect(orders(sortEntries(chosen(), 'canonical'))).toEqual([2, 5, 8]);
  });

  it('sorts by due date, soonest first', () => {
    expect(orders(sortEntries(chosen(), 'due-date'))).toEqual([5, 8, 2]);
  });

  it('sorts by difficulty, hardest first', () => {
    expect(orders(sortEntries(chosen(), 'difficulty'))).toEqual([2, 8, 5]);
  });

  it('sorts by last reviewed, longest ago first', () => {
    expect(orders(sortEntries(chosen(), 'last-reviewed'))).toEqual([2, 8, 5]);
  });

  it('puts passages with no due date last rather than first', () => {
    const entries = sortEntries(
      filterLibrary(progress, filters(), NOW),
      'due-date',
    );
    expect(orders(entries).slice(0, 3)).toEqual([5, 8, 2]);
    expect(entries.at(-1)?.progress.nextDueAt).toBeNull();
  });
});

describe('groupBySection', () => {
  it('groups passages under the seven headings in canonical order', () => {
    const groups = groupBySection(filterLibrary(buildProgress(), filters(), NOW));

    expect(groups.map((group) => group.section)).toEqual([
      'Law and History',
      'Wisdom and Poetry',
      'Prophets',
      'Gospels',
      'Acts',
      'Paul\u2019s Epistles',
      'General Epistles and Revelation',
    ]);
    expect(groups[0].entries).toHaveLength(7);
    expect(groups[4].entries.map((entry) => entry.verse.order)).toEqual([
      69, 70, 71, 72,
    ]);
  });

  it('omits sections that no passage matches', () => {
    const groups = groupBySection(
      filterLibrary(buildProgress(), filters({ section: 'Acts' }), NOW),
    );
    expect(groups).toHaveLength(1);
  });
});

describe('isFilterActive', () => {
  it('is false for the default state', () => {
    expect(isFilterActive(DEFAULT_FILTERS)).toBe(false);
  });

  it('ignores sort order, which is not a filter', () => {
    expect(isFilterActive(filters({ sort: 'difficulty' }))).toBe(false);
  });

  it('is true once anything narrows the list', () => {
    expect(isFilterActive(filters({ search: 'love' }))).toBe(true);
    expect(isFilterActive(filters({ difficultOnly: true }))).toBe(true);
    expect(isFilterActive(filters({ section: 'Gospels' }))).toBe(true);
  });
});

describe('canonical order', () => {
  it('never renumbers the collection', () => {
    const first = getVerseByOrder(1);
    const last = getVerseByOrder(171);
    const entries = filterLibrary(buildProgress(), filters(), NOW);

    expect(entries[0].verse.id).toBe(first?.id);
    expect(entries.at(-1)?.verse.id).toBe(last?.id);
  });
});

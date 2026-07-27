import { verses } from '@/data/verses';
import { dueState } from '@/lib/scheduler';
import { bookFromReference } from '@/lib/text/books';
import { normalizeReference, parseReference } from '@/lib/text/reference';
import { collapseWhitespace } from '@/lib/text/normalize';
import type { Section, Verse, VerseProgress, VerseStatus } from '@/types';

export type StatusFilter = 'all' | VerseStatus;
export type MemorizedFilter = 'all' | 'memorized' | 'not-memorized';
export type DueFilter = 'all' | 'due' | 'overdue' | 'due-or-overdue' | 'scheduled';
export type SortOption =
  | 'canonical'
  | 'due-date'
  | 'difficulty'
  | 'last-reviewed';

export type LibraryFilterState = {
  search: string;
  section: Section | 'all';
  /** Empty means all books. */
  books: string[];
  status: StatusFilter;
  memorized: MemorizedFilter;
  difficultOnly: boolean;
  due: DueFilter;
  neverReviewed: boolean;
  sort: SortOption;
};

export const DEFAULT_FILTERS: LibraryFilterState = {
  search: '',
  section: 'all',
  books: [],
  status: 'all',
  memorized: 'all',
  difficultOnly: false,
  due: 'all',
  neverReviewed: false,
  sort: 'canonical',
};

export function isFilterActive(filters: LibraryFilterState): boolean {
  return (
    filters.search.trim() !== '' ||
    filters.section !== 'all' ||
    filters.books.length > 0 ||
    filters.status !== 'all' ||
    filters.memorized !== 'all' ||
    filters.difficultOnly ||
    filters.due !== 'all' ||
    filters.neverReviewed
  );
}

function matchesSearch(verse: Verse, query: string): boolean {
  const needle = collapseWhitespace(query).toLowerCase();
  if (needle === '') return true;

  if (verse.reference.toLowerCase().includes(needle)) return true;
  if (verse.text.toLowerCase().includes(needle)) return true;
  if (String(verse.order) === needle) return true;

  // "jn 3" and "john3:16" should find John 3:16 even though the stored
  // reference is spelled out.
  const parsedQuery = parseReference(query);
  if (parsedQuery) {
    const normalizedQuery = normalizeReference(query);
    const normalizedReference = normalizeReference(verse.reference);
    if (normalizedQuery && normalizedReference) {
      if (normalizedReference.startsWith(normalizedQuery)) return true;
    }
    const referenceParsed = parseReference(verse.reference);
    if (
      referenceParsed &&
      referenceParsed.book === parsedQuery.book &&
      (parsedQuery.chapter === referenceParsed.chapter ||
        Number.isNaN(parsedQuery.chapter))
    ) {
      return true;
    }
  }

  return false;
}

export type LibraryEntry = {
  verse: Verse;
  progress: VerseProgress;
};

/**
 * Applies the library filters.
 *
 * Canonical order is the default and is never altered implicitly: sorting is
 * only applied when the reader explicitly chooses another order.
 */
export function filterLibrary(
  progressById: Map<string, VerseProgress>,
  filters: LibraryFilterState,
  now: Date = new Date(),
): LibraryEntry[] {
  const entries: LibraryEntry[] = [];

  for (const verse of verses) {
    const progress = progressById.get(verse.id);
    if (!progress) continue;

    if (!matchesSearch(verse, filters.search)) continue;
    if (filters.section !== 'all' && verse.section !== filters.section) continue;
    if (filters.books.length > 0) {
      const bookName = bookFromReference(verse.reference);
      if (!bookName || !filters.books.includes(bookName)) continue;
    }
    if (filters.status !== 'all' && progress.status !== filters.status) continue;

    if (filters.memorized === 'memorized' && !progress.isMemorized) continue;
    if (filters.memorized === 'not-memorized' && progress.isMemorized) continue;
    if (filters.difficultOnly && !progress.isDifficult) continue;
    if (filters.neverReviewed && progress.reviewCount > 0) continue;

    if (filters.due !== 'all') {
      const state = dueState(progress, now);
      if (filters.due === 'due' && state !== 'due') continue;
      if (filters.due === 'overdue' && state !== 'overdue') continue;
      if (
        filters.due === 'due-or-overdue' &&
        state !== 'due' &&
        state !== 'overdue'
      ) {
        continue;
      }
      if (filters.due === 'scheduled' && state !== 'scheduled') continue;
    }

    entries.push({ verse, progress });
  }

  return sortEntries(entries, filters.sort);
}

export function sortEntries(
  entries: LibraryEntry[],
  sort: SortOption,
): LibraryEntry[] {
  const sorted = [...entries];

  switch (sort) {
    case 'canonical':
      return sorted.sort((a, b) => a.verse.order - b.verse.order);
    case 'due-date':
      return sorted.sort((a, b) => {
        const left = a.progress.nextDueAt;
        const right = b.progress.nextDueAt;
        if (left === right) return a.verse.order - b.verse.order;
        if (!left) return 1;
        if (!right) return -1;
        return left.localeCompare(right);
      });
    case 'difficulty':
      return sorted.sort((a, b) => {
        const delta = b.progress.difficultyScore - a.progress.difficultyScore;
        if (delta !== 0) return delta;
        return a.verse.order - b.verse.order;
      });
    case 'last-reviewed':
      return sorted.sort((a, b) => {
        const left = a.progress.lastReviewedAt;
        const right = b.progress.lastReviewedAt;
        if (left === right) return a.verse.order - b.verse.order;
        if (!left) return 1;
        if (!right) return -1;
        return left.localeCompare(right);
      });
  }
}

export function groupBySection(
  entries: LibraryEntry[],
): Array<{ section: Section; entries: LibraryEntry[] }> {
  const groups = new Map<Section, LibraryEntry[]>();

  for (const entry of entries) {
    const list = groups.get(entry.verse.section) ?? [];
    list.push(entry);
    groups.set(entry.verse.section, list);
  }

  return [...groups.entries()].map(([section, sectionEntries]) => ({
    section,
    entries: sectionEntries,
  }));
}

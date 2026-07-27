import { verses } from '@/data/verses';
import { parseReference } from '@/lib/text/reference';

/** Canonical book name for a passage reference, or null if unparsable. */
export function bookFromReference(reference: string): string | null {
  return parseReference(reference)?.book ?? null;
}

export type CollectionBook = {
  name: string;
  passageCount: number;
  startOrder: number;
  endOrder: number;
  verseIds: string[];
};

/**
 * Books that appear in the 171-passage collection, in canonical collection
 * order (first occurrence wins).
 */
export const COLLECTION_BOOKS: readonly CollectionBook[] = (() => {
  const byName = new Map<string, CollectionBook>();

  for (const verse of verses) {
    const name = bookFromReference(verse.reference);
    if (!name) continue;

    const existing = byName.get(name);
    if (existing) {
      existing.passageCount += 1;
      existing.endOrder = verse.order;
      existing.verseIds.push(verse.id);
    } else {
      byName.set(name, {
        name,
        passageCount: 1,
        startOrder: verse.order,
        endOrder: verse.order,
        verseIds: [verse.id],
      });
    }
  }

  return [...byName.values()];
})();

export function collectionBook(name: string): CollectionBook | undefined {
  return COLLECTION_BOOKS.find((book) => book.name === name);
}

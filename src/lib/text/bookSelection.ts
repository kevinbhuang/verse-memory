import { COLLECTION_BOOKS } from '@/lib/text/books';

export function booksLabel(books: readonly string[]): string {
  if (books.length === 0) return 'No books';
  if (books.length === 1) return books[0]!;
  if (books.length === 2) return `${books[0]} & ${books[1]}`;
  return `${books.length} books`;
}

export function passageCountForBooks(books: readonly string[]): number {
  const set = new Set(books);
  return COLLECTION_BOOKS.filter((book) => set.has(book.name)).reduce(
    (sum, book) => sum + book.passageCount,
    0,
  );
}

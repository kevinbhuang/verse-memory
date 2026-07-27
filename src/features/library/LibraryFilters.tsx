import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select, TextInput } from '@/components/ui/Field';
import { COLLECTION_BOOKS } from '@/lib/text/books';
import { SECTIONS } from '@/types';
import {
  DEFAULT_FILTERS,
  isFilterActive,
  type LibraryFilterState,
} from './filters';

export function LibraryFilters({
  filters,
  onChange,
  resultCount,
  totalCount,
}: {
  filters: LibraryFilterState;
  onChange: (filters: LibraryFilterState) => void;
  resultCount: number;
  totalCount: number;
}) {
  const set = <K extends keyof LibraryFilterState>(
    key: K,
    value: LibraryFilterState[K],
  ) => onChange({ ...filters, [key]: value });

  return (
    <div className="mb-4 space-y-2.5 border-b border-line pb-4">
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-subtle"
          aria-hidden="true"
        />
        <TextInput
          type="search"
          value={filters.search}
          onChange={(event) => set('search', event.target.value)}
          placeholder="Search by reference, book, or words"
          aria-label="Search passages"
          className="pl-9"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="sr-only" htmlFor="filter-book">
          Book
        </label>
        <Select
          id="filter-book"
          value={filters.book}
          onChange={(event) => set('book', event.target.value)}
        >
          <option value="all">All books</option>
          {COLLECTION_BOOKS.map((book) => (
            <option key={book.name} value={book.name}>
              {`${book.name} (${book.passageCount})`}
            </option>
          ))}
        </Select>

        <label className="sr-only" htmlFor="filter-section">
          Section
        </label>
        <Select
          id="filter-section"
          value={filters.section}
          onChange={(event) =>
            set('section', event.target.value as LibraryFilterState['section'])
          }
        >
          <option value="all">All sections</option>
          {SECTIONS.map((section) => (
            <option key={section} value={section}>
              {section}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-sm text-ink-muted" role="status">
          Showing {resultCount} of {totalCount} passages
        </span>

        {isFilterActive(filters) ? (
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto"
            onClick={() => onChange({ ...DEFAULT_FILTERS })}
          >
            <X className="size-3.5" aria-hidden="true" />
            Clear filters
          </Button>
        ) : null}
      </div>
    </div>
  );
}

import { useEffect, useId, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select, TextInput } from '@/components/ui/Field';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { COLLECTION_BOOKS } from '@/lib/text/books';
import { SECTIONS } from '@/types';
import {
  DEFAULT_FILTERS,
  isFilterActive,
  type LibraryFilterState,
  type ReviewStateFilter,
} from './filters';

function hasSearchScope(filters: LibraryFilterState): boolean {
  return (
    filters.search.trim() !== '' ||
    filters.section !== 'all' ||
    filters.book !== 'all'
  );
}

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
  const panelId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [searchOpen, setSearchOpen] = useState(() => hasSearchScope(filters));

  const set = <K extends keyof LibraryFilterState>(
    key: K,
    value: LibraryFilterState[K],
  ) => onChange({ ...filters, [key]: value });

  useEffect(() => {
    if (hasSearchScope(filters)) setSearchOpen(true);
  }, [filters.search, filters.book, filters.section]);

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  const clearSearchScope = () => {
    onChange({
      ...filters,
      search: '',
      book: 'all',
      section: 'all',
    });
    setSearchOpen(false);
  };

  return (
    <div className="mb-4 space-y-3 border-b border-line pb-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <SegmentedControl
          aria-label="Review state"
          size="sm"
          value={filters.reviewState}
          onChange={(value) => set('reviewState', value as ReviewStateFilter)}
          options={[
            { value: 'all', label: 'All' },
            { value: 'memorized', label: 'Memorized' },
            { value: 'needs-review', label: 'Needs Review' },
          ]}
        />

        <span className="text-sm text-ink-muted" role="status">
          Showing {resultCount} of {totalCount}
        </span>

        <div className="ml-auto flex items-center gap-1">
          {isFilterActive(filters) ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-ink-subtle"
              onClick={() => {
                onChange({ ...DEFAULT_FILTERS });
                setSearchOpen(false);
              }}
            >
              Reset filters
            </Button>
          ) : null}

          <Button
            size="sm"
            variant={searchOpen || hasSearchScope(filters) ? 'secondary' : 'ghost'}
            className="h-7"
            aria-expanded={searchOpen}
            aria-controls={panelId}
            onClick={() => setSearchOpen((open) => !open)}
          >
            <Search className="size-3.5" aria-hidden="true" />
            Search
            {hasSearchScope(filters) ? (
              <span className="ml-0.5 size-1.5 rounded-full bg-accent" aria-hidden="true" />
            ) : null}
          </Button>
        </div>
      </div>

      {searchOpen ? (
        <div id={panelId} className="space-y-2.5 rounded-lg bg-surface-muted/60 p-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-subtle"
              aria-hidden="true"
            />
            <TextInput
              ref={inputRef}
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
                set(
                  'section',
                  event.target.value as LibraryFilterState['section'],
                )
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

          {hasSearchScope(filters) ? (
            <Button size="sm" variant="ghost" onClick={clearSearchScope}>
              <X className="size-3.5" aria-hidden="true" />
              Clear search
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

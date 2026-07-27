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
    <div className="card mb-3 px-3 py-2.5">
      <div className="flex flex-col gap-2">
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

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
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

          <label className="sr-only" htmlFor="filter-status">
            Status
          </label>
          <Select
            id="filter-status"
            value={filters.status}
            onChange={(event) =>
              set('status', event.target.value as LibraryFilterState['status'])
            }
          >
            <option value="all">Any status</option>
            <option value="new">New</option>
            <option value="learning">Learning</option>
            <option value="memorized">Memorized</option>
            <option value="needs-attention">Needs attention</option>
          </Select>

          <label className="sr-only" htmlFor="filter-memorized">
            Memorized
          </label>
          <Select
            id="filter-memorized"
            value={filters.memorized}
            onChange={(event) =>
              set(
                'memorized',
                event.target.value as LibraryFilterState['memorized'],
              )
            }
          >
            <option value="all">Memorized or not</option>
            <option value="memorized">Memorized only</option>
            <option value="not-memorized">Not memorized</option>
          </Select>

          <label className="sr-only" htmlFor="filter-due">
            Due
          </label>
          <Select
            id="filter-due"
            value={filters.due}
            onChange={(event) =>
              set('due', event.target.value as LibraryFilterState['due'])
            }
          >
            <option value="all">Any due date</option>
            <option value="due-or-overdue">Due or overdue</option>
            <option value="due">Due today</option>
            <option value="overdue">Overdue</option>
            <option value="scheduled">Scheduled later</option>
          </Select>

          <label className="sr-only" htmlFor="filter-sort">
            Sort
          </label>
          <Select
            id="filter-sort"
            value={filters.sort}
            onChange={(event) =>
              set('sort', event.target.value as LibraryFilterState['sort'])
            }
          >
            <option value="canonical">Canonical order</option>
            <option value="due-date">Due date</option>
            <option value="difficulty">Difficulty</option>
            <option value="last-reviewed">Last reviewed</option>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              className="size-4 accent-[var(--accent)]"
              checked={filters.difficultOnly}
              onChange={(event) => set('difficultOnly', event.target.checked)}
            />
            Difficult only
          </label>

          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              className="size-4 accent-[var(--accent)]"
              checked={filters.neverReviewed}
              onChange={(event) => set('neverReviewed', event.target.checked)}
            />
            Never reviewed
          </label>

          <span className="ml-auto text-sm text-ink-muted" role="status">
            Showing {resultCount} of {totalCount} passages
          </span>

          {isFilterActive(filters) ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onChange({ ...DEFAULT_FILTERS, sort: filters.sort })}
            >
              <X className="size-3.5" aria-hidden="true" />
              Clear filters
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

import { COLLECTION_BOOKS } from '@/lib/text/books';

type BookCheckboxListProps = {
  selected: readonly string[];
  onChange: (books: string[]) => void;
  idPrefix: string;
  /** When true, at least one book should stay selected if possible. */
  requireOne?: boolean;
};

/**
 * Visible checklist of every book in the collection — no dropdown.
 */
export function BookCheckboxList({
  selected,
  onChange,
  idPrefix,
  requireOne = false,
}: BookCheckboxListProps) {
  const selectedSet = new Set(selected);

  const toggle = (name: string) => {
    if (selectedSet.has(name)) {
      if (requireOne && selected.length <= 1) return;
      onChange(selected.filter((book) => book !== name));
      return;
    }
    onChange([...selected, name]);
  };

  const selectAll = () =>
    onChange(COLLECTION_BOOKS.map((book) => book.name));

  const clear = () => {
    if (requireOne) {
      onChange([COLLECTION_BOOKS[0]?.name].filter(Boolean) as string[]);
      return;
    }
    onChange([]);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="text-xs font-medium text-accent hover:underline"
          onClick={selectAll}
        >
          Select all
        </button>
        <span className="text-xs text-ink-subtle" aria-hidden="true">
          ·
        </span>
        <button
          type="button"
          className="text-xs font-medium text-ink-muted hover:underline"
          onClick={clear}
        >
          {requireOne ? 'Reset' : 'Clear'}
        </button>
      </div>

      <div
        className="grid max-h-64 grid-cols-1 gap-1 overflow-y-auto rounded-lg border border-line bg-surface-muted/40 p-2 sm:grid-cols-2"
        role="group"
        aria-label="Books"
      >
        {COLLECTION_BOOKS.map((book) => {
          const id = `${idPrefix}-${book.name.replace(/\s+/g, '-').toLowerCase()}`;
          const checked = selectedSet.has(book.name);
          return (
            <label
              key={book.name}
              htmlFor={id}
              className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
                checked ? 'bg-accent-soft text-accent' : 'text-ink hover:bg-surface'
              }`}
            >
              <input
                id={id}
                type="checkbox"
                className="size-3.5 shrink-0 accent-[var(--accent)]"
                checked={checked}
                onChange={() => toggle(book.name)}
              />
              <span className="min-w-0 flex-1 truncate font-medium">
                {book.name}
              </span>
              <span className="shrink-0 text-xs opacity-70 tabular-nums">
                {book.passageCount}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

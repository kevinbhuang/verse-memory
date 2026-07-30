/** Shared widths so library checkbox headers stay aligned with row controls. */
export const LIBRARY_MEMORIZED_COL = 'w-16';
export const LIBRARY_REVIEW_COL = 'w-16';

/**
 * Stick below the app header (title + account). Matches AppLayout sticky bar.
 */
export const STICKY_BELOW_APP_HEADER =
  'sticky top-14 z-20 bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/90';

/**
 * Persistent labels for the library’s Memorized / Needs Review columns.
 */
export function LibraryCheckboxHeader() {
  return (
    <div
      className={`${STICKY_BELOW_APP_HEADER} mb-2 border-b border-line py-1.5`}
      role="row"
    >
      <div className="flex items-end gap-2.5 px-2 sm:px-3">
        <div className="flex shrink-0 gap-2" role="presentation">
          <span
            role="columnheader"
            className={`${LIBRARY_MEMORIZED_COL} text-center text-[10px] leading-tight font-medium text-ink-subtle`}
          >
            Memorized
          </span>
          <span
            role="columnheader"
            className={`${LIBRARY_REVIEW_COL} text-center text-[10px] leading-tight font-medium text-ink-subtle`}
          >
            Needs Review
          </span>
        </div>
        <span className="sr-only" role="columnheader">
          Passage
        </span>
      </div>
    </div>
  );
}

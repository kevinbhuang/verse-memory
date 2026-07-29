/** Shared widths so library checkbox headers stay aligned with row controls. */
export const LIBRARY_SELECT_COL = 'w-12';
export const LIBRARY_MEMORIZED_COL = 'w-16';
export const LIBRARY_REVIEW_COL = 'w-16';

/**
 * Persistent labels for the library’s select / status checkbox columns.
 */
export function LibraryCheckboxHeader() {
  return (
    <div
      className="sticky top-12 z-20 mb-2 border-b border-line bg-paper/95 py-1.5 backdrop-blur lg:top-0"
      role="row"
    >
      <div className="flex items-end gap-2.5 px-2 sm:px-3">
        <div className="flex shrink-0 gap-2" role="presentation">
          <span
            role="columnheader"
            className={`${LIBRARY_SELECT_COL} text-center text-[10px] leading-tight font-medium text-ink-subtle`}
          >
            Selected
          </span>
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

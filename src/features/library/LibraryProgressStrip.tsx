import { formatPercent } from '@/utils/format';

/**
 * Thin collection memorization meter for the library header.
 */
export function LibraryProgressStrip({
  memorized,
  total,
  percentMemorized,
}: {
  memorized: number;
  total: number;
  percentMemorized: number;
}) {
  const clamped = Math.min(100, Math.max(0, percentMemorized));
  const label = `${memorized} of ${total} memorized · ${formatPercent(clamped, 1)}`;

  return (
    <div
      className="mb-5"
      role="status"
      aria-label={label}
    >
      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
        <p className="text-ink-muted">
          <span className="font-medium tabular-nums text-ink">{memorized}</span>
          <span className="text-ink-subtle"> / {total}</span>
          <span className="ml-1.5">memorized</span>
        </p>
        <p className="tabular-nums text-ink-muted">
          {formatPercent(clamped, 1)}
        </p>
      </div>
      <div
        className="h-1 overflow-hidden rounded-full bg-surface-sunken"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped)}
        aria-label="Percent memorized"
      >
        <div
          className="h-full rounded-full bg-success transition-[width] duration-300 ease-out"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

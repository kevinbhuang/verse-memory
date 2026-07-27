import clsx from 'clsx';

export function ProgressBar({
  value,
  max = 100,
  label,
  className,
  tone = 'accent',
}: {
  value: number;
  max?: number;
  label: string;
  className?: string;
  tone?: 'accent' | 'success';
}) {
  const percent = max === 0 ? 0 : Math.max(0, Math.min(100, (value / max) * 100));

  return (
    <div
      className={clsx('h-2 w-full overflow-hidden rounded-full bg-surface-sunken', className)}
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={clsx(
          'h-full rounded-full transition-[width] duration-300',
          tone === 'accent' ? 'bg-accent' : 'bg-success',
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

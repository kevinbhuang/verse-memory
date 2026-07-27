import type { ReactNode } from 'react';
import clsx from 'clsx';

export type SegmentOption<T extends string> = {
  value: T;
  label: ReactNode;
  disabled?: boolean;
};

/**
 * Quiet single-control chooser — preferred over clusters of primary/secondary buttons.
 */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  'aria-label': ariaLabel,
  size = 'md',
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: readonly SegmentOption<T>[];
  'aria-label': string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={clsx(
        'inline-flex max-w-full flex-wrap rounded-lg bg-surface-sunken p-0.5',
        className,
      )}
    >
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            disabled={option.disabled}
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={clsx(
              'rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
              selected
                ? 'bg-surface text-ink shadow-sm'
                : 'text-ink-muted hover:text-ink',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

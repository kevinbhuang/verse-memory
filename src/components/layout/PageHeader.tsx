import type { ReactNode } from 'react';

/**
 * Shared page chrome: the current tab/section as the primary heading.
 * Collection branding lives in the sidebar / mobile top bar.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  /** Page/section name (e.g. Flash Cards). */
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={
        className ??
        'mb-4 flex flex-wrap items-end justify-between gap-3'
      }
    >
      <div className="min-w-0">
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-ink-subtle">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

import type { ReactNode } from 'react';
import { appConfig } from '@/config/app';

/**
 * Shared page chrome: collection title as the primary heading, with the
 * current tab/section as a quieter subtitle underneath.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  /** Page/section name shown under the collection title (e.g. Flash Cards). */
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
          {appConfig.collectionTitle}
        </h1>
        <h2 className="mt-0.5 font-serif text-lg font-medium tracking-tight text-ink-muted sm:text-xl">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-ink-subtle">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

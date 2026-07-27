import type { ReactNode } from 'react';

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      {icon ? <div className="text-ink-subtle">{icon}</div> : null}
      <div>
        <p className="text-sm font-medium text-ink">{title}</p>
        {description ? (
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink-muted">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function LoadingState({ label = 'Loading\u2026' }: { label?: string }) {
  return (
    <div
      className="flex items-center justify-center gap-2 px-6 py-12 text-sm text-ink-muted"
      role="status"
      aria-live="polite"
    >
      <span className="size-2 animate-pulse rounded-full bg-accent" aria-hidden="true" />
      {label}
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  description,
  action,
}: {
  title?: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-lg border border-danger/30 bg-danger-soft px-6 py-8 text-center"
    >
      <p className="text-sm font-medium text-danger">{title}</p>
      {description ? (
        <p className="max-w-md text-sm text-ink-muted">{description}</p>
      ) : null}
      {action}
    </div>
  );
}

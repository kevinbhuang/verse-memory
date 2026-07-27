import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';

export function StatTile({
  label,
  value,
  detail,
  to,
  tone = 'neutral',
  icon,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  to?: string;
  tone?: 'neutral' | 'accent' | 'warning' | 'danger' | 'success';
  icon?: ReactNode;
}) {
  const tones = {
    neutral: 'text-ink',
    accent: 'text-accent',
    warning: 'text-warning',
    danger: 'text-danger',
    success: 'text-success',
  } as const;

  const content = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium tracking-wide text-ink-muted uppercase">
          {label}
        </span>
        {icon ? <span className="text-ink-subtle">{icon}</span> : null}
      </div>
      <p className={clsx('mt-2 text-2xl font-semibold tabular-nums', tones[tone])}>
        {value}
      </p>
      {detail ? (
        <p className="mt-1 text-xs text-ink-muted">{detail}</p>
      ) : null}
    </>
  );

  const className =
    'card block px-4 py-3.5 text-left transition-colors hover:border-line-strong';

  if (to) {
    return (
      <Link to={to} className={className}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}

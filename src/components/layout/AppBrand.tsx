import { Link } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { appConfig } from '@/config/app';

type AppBrandProps = {
  /** Show the collection subtitle under the wordmark (sidebar). */
  showSubtitle?: boolean;
  /** Slightly smaller for the mobile top bar. */
  compact?: boolean;
};

/**
 * Upper-left brand lockup: burnt-orange book mark + serif title
 * (layout inspired by memoryverses.com).
 */
export function AppBrand({
  showSubtitle = false,
  compact = false,
}: AppBrandProps) {
  return (
    <Link
      to="/flashcards"
      className="group flex min-w-0 items-start gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      aria-label={`${appConfig.appName} home`}
    >
      <span
        className={`flex shrink-0 items-center justify-center rounded-lg bg-brand text-brand-contrast shadow-sm ${
          compact ? 'size-8' : 'size-9'
        }`}
        aria-hidden="true"
      >
        <BookOpen
          className={compact ? 'size-4' : 'size-[1.125rem]'}
          strokeWidth={2}
        />
      </span>
      <span className="min-w-0 pt-0.5">
        <span
          className={`block truncate font-serif font-semibold tracking-tight text-ink group-hover:text-brand ${
            compact ? 'text-base leading-tight' : 'text-lg leading-tight'
          }`}
        >
          {appConfig.appName}
        </span>
        {showSubtitle ? (
          <span className="mt-0.5 block text-xs leading-snug text-ink-muted">
            {appConfig.collectionTitle}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

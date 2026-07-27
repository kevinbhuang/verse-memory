import { Link } from 'react-router-dom';
import { appConfig } from '@/config/app';

export function Footer() {
  return (
    <footer className="mt-8 border-t border-line px-4 py-6 text-xs leading-relaxed text-ink-muted sm:px-6 lg:px-8">
      <p className="max-w-3xl">{appConfig.translationAttribution}</p>
      <p className="mt-3">
        {[
          appConfig.appName,
          appConfig.collectionTitle,
          appConfig.collectionSubtitle,
        ].join(' \u00b7 ')}
        {' \u00b7 '}
        <Link to="/settings#about" className="underline hover:text-ink">
          About
        </Link>
      </p>
    </footer>
  );
}

import { Link } from 'react-router-dom';
import { appConfig } from '@/config/app';

export function Footer() {
  return (
    <footer className="mt-10 border-t border-line px-4 py-5 text-xs leading-relaxed text-ink-muted sm:px-6 lg:px-8">
      <p className="max-w-3xl">{appConfig.translationAttribution}</p>
      <p className="mt-2">
        {appConfig.appName}
        {' \u00b7 '}
        <Link to="/more" className="underline hover:text-ink">
          About
        </Link>
      </p>
    </footer>
  );
}

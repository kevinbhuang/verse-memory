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
      <p className="mt-3 max-w-3xl">
        Questions? Suggestions? Like this tool? Let Kevin know —{' '}
        <a
          href="mailto:kevin.huang@acts2.network"
          className="underline hover:text-ink"
        >
          kevin.huang@acts2.network
        </a>
      </p>
      <p className="mt-3 max-w-3xl">
        Interested in my other projects? Check out the{' '}
        <a
          href="https://kevinbhuang.github.io/bible-plan-generator/"
          className="underline hover:text-ink"
          target="_blank"
          rel="noreferrer"
        >
          Bible Reading Plan Generator
        </a>
        .
      </p>
    </footer>
  );
}

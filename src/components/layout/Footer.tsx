import { appConfig } from '@/config/app';

export function Footer() {
  return (
    <footer className="mt-10 border-t border-line px-4 py-5 text-xs leading-relaxed text-ink-muted sm:px-6 lg:px-8">
      <p className="max-w-3xl">{appConfig.translationAttribution}</p>
      <p className="mt-2 max-w-3xl">
        Questions or feedback?{' '}
        <a
          href="mailto:kevin.huang@acts2.network"
          className="underline hover:text-ink"
        >
          kevin.huang@acts2.network
        </a>
        {' \u00b7 '}
        Also try the{' '}
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

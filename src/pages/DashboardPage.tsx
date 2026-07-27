import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Keyboard, Mic, RotateCcw } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { LoadingState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { useAllProgress, useOpenSession } from '@/hooks/useProgressData';
import { appConfig, DECKS } from '@/config/app';
import { verses } from '@/data/verses';
import { COLLECTION_BOOKS, collectionBook } from '@/lib/text/books';
import {
  computeCollectionStats,
  computeSectionProgress,
} from '@/services/statsService';
import { createSession } from '@/services/sessionService';
import { formatPercent } from '@/utils/format';
import type { ReviewMode, Section } from '@/types';

function sessionSizeForCount(passageCount: number): number | 'all' {
  return passageCount <= 10 ? 'all' : 10;
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const progressList = useAllProgress();
  const openSession = useOpenSession();
  const [book, setBook] = useState(
    () => COLLECTION_BOOKS.find((item) => item.name === 'Romans')?.name ?? 'John',
  );

  const stats = useMemo(
    () => (progressList ? computeCollectionStats(progressList) : null),
    [progressList],
  );
  const sections = useMemo(
    () => (progressList ? computeSectionProgress(progressList) : []),
    [progressList],
  );
  const sectionByName = useMemo(
    () => new Map(sections.map((item) => [item.section, item])),
    [sections],
  );

  if (!progressList || !stats) {
    return <LoadingState label={'Loading your progress\u2026'} />;
  }

  const startDeck = async (
    section: Section,
    mode: Extract<ReviewMode, 'first-letter' | 'voice'>,
  ) => {
    const deck = DECKS.find((item) => item.section === section);
    if (!deck) return;

    const modeLabel = mode === 'first-letter' ? 'First letters' : 'Speak';
    const session = await createSession(
      {
        source: 'section',
        section,
        size: sessionSizeForCount(deck.passageCount),
        modeStrategy: 'fixed',
        fixedMode: mode,
      },
      `${deck.label} \u00b7 ${modeLabel}`,
    );

    if (!session) {
      notify(`Nothing to practice in ${deck.label} right now.`, 'info');
      return;
    }
    navigate(`/review/session?id=${session.id}`);
  };

  const startBook = async (
    mode: Extract<ReviewMode, 'first-letter' | 'voice'>,
  ) => {
    const info = collectionBook(book);
    if (!info) return;

    const modeLabel = mode === 'first-letter' ? 'First letters' : 'Speak';
    const session = await createSession(
      {
        source: 'book',
        book,
        size: sessionSizeForCount(info.passageCount),
        modeStrategy: 'fixed',
        fixedMode: mode,
      },
      `${book} \u00b7 ${modeLabel}`,
    );

    if (!session) {
      notify(`Nothing to practice in ${book} right now.`, 'info');
      return;
    }
    navigate(`/review/session?id=${session.id}`);
  };

  const selectedBook = collectionBook(book);

  return (
    <>
      <PageHeader
        title={appConfig.appName}
        description={`${appConfig.collectionTitle} \u2014 ${appConfig.collectionSubtitle}`}
      />

      {openSession ? (
        <div className="mb-6">
          <Button
            variant="quiet"
            size="lg"
            onClick={() => navigate(`/review/session?id=${openSession.id}`)}
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            {`Continue last session (${openSession.currentIndex}/${openSession.verseIds.length})`}
          </Button>
        </div>
      ) : null}

      <section aria-label="Summary" className="mb-6">
        <div className="card px-5 py-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-medium tracking-wide text-ink-muted uppercase">
                Memorized passages
              </p>
              <p className="mt-1 font-serif text-3xl font-semibold text-ink tabular-nums">
                {`${stats.memorized} of ${verses.length}`}
              </p>
            </div>
            <p className="text-2xl font-semibold text-accent tabular-nums">
              {formatPercent(stats.percentMemorized, 1)}
            </p>
          </div>
          <ProgressBar
            className="mt-3"
            value={stats.memorized}
            max={verses.length}
            label={`${stats.memorized} of ${verses.length} passages memorized`}
          />
        </div>
      </section>

      <section aria-label="Decks" className="mb-2">
        <div className="mb-4">
          <h2 className="font-serif text-xl font-semibold text-ink">
            Practice by deck
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            The collection is split into seven decks by biblical section. Pick
            one deck so you are not reviewing all 171 at once.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {DECKS.map((deck) => {
            const progress = sectionByName.get(deck.section);
            const memorized = progress?.memorized ?? 0;
            const total = progress?.total ?? deck.passageCount;

            return (
              <article
                key={deck.section}
                className="flex flex-col rounded-xl border border-line-strong bg-surface p-4 shadow-sm"
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-medium tracking-wide text-accent uppercase">
                      {deck.label}
                    </p>
                    <h3 className="mt-0.5 font-serif text-lg font-semibold text-ink">
                      {deck.section}
                    </h3>
                    <p className="mt-1 text-xs text-ink-muted">
                      {`Passages ${deck.rangeLabel} \u00b7 ${total} total`}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-medium text-ink tabular-nums">
                    {`${memorized}/${total}`}
                  </p>
                </div>

                <ProgressBar
                  className="mb-4"
                  value={memorized}
                  max={total}
                  label={`${deck.label}: ${memorized} of ${total} memorized`}
                />

                <div className="mt-auto flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => void startDeck(deck.section, 'first-letter')}
                  >
                    <Keyboard className="size-3.5" aria-hidden="true" />
                    Letters
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void startDeck(deck.section, 'voice')}
                  >
                    <Mic className="size-3.5" aria-hidden="true" />
                    Speak
                  </Button>
                  <Link
                    to={`/verses?section=${encodeURIComponent(deck.section)}`}
                    className="inline-flex h-8 items-center px-2 text-xs font-medium text-ink-muted hover:text-accent"
                  >
                    Browse
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section aria-label="Practice by book" className="mt-8">
        <div className="mb-3">
          <h2 className="font-serif text-xl font-semibold text-ink">
            Or practice by book
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Jump straight into Romans, John, or any other book in the collection.
          </p>
        </div>
        <div className="card flex flex-wrap items-end gap-3 px-4 py-3">
          <label className="min-w-48 flex-1 text-sm text-ink" htmlFor="dashboard-book">
            <span className="mb-1 block text-xs font-medium text-ink-muted">
              Book
            </span>
            <select
              id="dashboard-book"
              className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm"
              value={book}
              onChange={(event) => setBook(event.target.value)}
            >
              {COLLECTION_BOOKS.map((item) => (
                <option key={item.name} value={item.name}>
                  {`${item.name} (${item.passageCount})`}
                </option>
              ))}
            </select>
          </label>
          <Button
            size="sm"
            variant="primary"
            onClick={() => void startBook('first-letter')}
          >
            <Keyboard className="size-3.5" aria-hidden="true" />
            Letters
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void startBook('voice')}
          >
            <Mic className="size-3.5" aria-hidden="true" />
            Speak
          </Button>
          <Link
            to={`/verses?book=${encodeURIComponent(book)}`}
            className="inline-flex h-8 items-center text-xs font-medium text-ink-muted hover:text-accent"
          >
            {`Browse ${selectedBook?.passageCount ?? ''} passages`}
          </Link>
        </div>
      </section>
    </>
  );
}

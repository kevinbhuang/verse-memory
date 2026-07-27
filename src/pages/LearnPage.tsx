import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Play, RotateCcw } from 'lucide-react';
import { BookCheckboxList } from '@/components/BookCheckboxList';
import { booksLabel, passageCountForBooks } from '@/lib/text/bookSelection';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState, LoadingState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { useAllProgress, useOpenSession } from '@/hooks/useProgressData';
import { DECKS, deckForSection } from '@/config/app';
import { COLLECTION_BOOKS } from '@/lib/text/books';
import { getVerse } from '@/data/verses';
import { SECTIONS, type Section } from '@/types';
import {
  createSession,
  selectVerseIds,
  type SessionCriteria,
} from '@/services/sessionService';
import { formatRelativeDay } from '@/utils/format';

const SIZE_OPTIONS = [5, 10, 20] as const;
type Scope = 'deck' | 'book';

function initialSection(param: string | null): Section {
  if (param && (SECTIONS as readonly string[]).includes(param)) {
    return param as Section;
  }
  return SECTIONS[0];
}

function initialBooks(param: string | null): string[] {
  if (param && COLLECTION_BOOKS.some((book) => book.name === param)) {
    return [param];
  }
  const romans = COLLECTION_BOOKS.find((book) => book.name === 'Romans');
  return [romans?.name ?? COLLECTION_BOOKS[0]?.name ?? 'John'];
}

export function LearnPage() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const progressList = useAllProgress();
  const openSession = useOpenSession();
  const [searchParams] = useSearchParams();

  const bookParam = searchParams.get('book');
  const [scope, setScope] = useState<Scope>(bookParam ? 'book' : 'deck');
  const [section, setSection] = useState<Section>(() =>
    initialSection(searchParams.get('section')),
  );
  const [books, setBooks] = useState(() => initialBooks(bookParam));
  const [size, setSize] = useState<number | 'all'>(() => {
    const deck = deckForSection(initialSection(searchParams.get('section')));
    return deck && deck.passageCount <= 10 ? 'all' : 10;
  });
  const [starting, setStarting] = useState(false);

  const selectedDeck = deckForSection(section) ?? DECKS[0];
  const matchingTotal =
    scope === 'deck'
      ? selectedDeck.passageCount
      : passageCountForBooks(books);

  const criteria: SessionCriteria = useMemo(
    () =>
      scope === 'deck'
        ? {
            source: 'section',
            section,
            size,
            modeStrategy: 'fixed',
            fixedMode: 'learn',
          }
        : {
            source: 'book',
            books,
            size,
            modeStrategy: 'fixed',
            fixedMode: 'learn',
          },
    [books, scope, section, size],
  );

  const preview = useMemo(
    () => (progressList ? selectVerseIds(criteria, progressList) : []),
    [criteria, progressList],
  );

  if (!progressList) return <LoadingState />;

  const start = async () => {
    setStarting(true);
    try {
      const scopeLabel =
        scope === 'deck' ? selectedDeck.label : booksLabel(books);
      const session = await createSession(criteria, `Learn \u00b7 ${scopeLabel}`);
      if (!session) {
        notify('No passages match that choice.', 'error');
        return;
      }
      navigate(`/review/session?id=${session.id}`);
    } finally {
      setStarting(false);
    }
  };

  const resumeIsLearn = openSession?.fixedMode === 'learn';

  return (
    <>
      <PageHeader
        title="Learn"
        description="Flashcards that show the passage first. Flip to check the reference, then rate how well you knew it."
      />

      {openSession && resumeIsLearn ? (
        <Card className="mb-5 border-accent/40 bg-accent-soft">
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-ink">
                You have an unfinished learn session
              </p>
              <p className="text-sm text-ink-muted">
                {`${openSession.label} \u00b7 ${openSession.currentIndex} of ${openSession.verseIds.length} completed \u00b7 started ${formatRelativeDay(openSession.createdAt)}`}
              </p>
            </div>
            <Button
              variant="primary"
              onClick={() => navigate(`/review/session?id=${openSession.id}`)}
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              Resume
            </Button>
          </CardBody>
        </Card>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-5">
          <Card>
            <CardHeader
              title="What to learn"
              description="Pick a deck or one or more books."
            />
            <CardBody className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={scope === 'deck' ? 'primary' : 'secondary'}
                  onClick={() => setScope('deck')}
                >
                  Deck
                </Button>
                <Button
                  variant={scope === 'book' ? 'primary' : 'secondary'}
                  onClick={() => {
                    setScope('book');
                    const count = passageCountForBooks(books);
                    if (count > 0 && count <= 10) setSize('all');
                  }}
                >
                  Book
                </Button>
              </div>

              {scope === 'deck' ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {DECKS.map((deck) => {
                    const selected = section === deck.section;
                    return (
                      <button
                        key={deck.section}
                        type="button"
                        onClick={() => {
                          setSection(deck.section);
                          if (deck.passageCount <= 10) setSize('all');
                          else if (size === 'all') setSize(10);
                        }}
                        aria-pressed={selected}
                        className={`rounded-lg border px-3 py-3 text-left ${
                          selected
                            ? 'border-accent bg-accent-soft text-accent'
                            : 'border-line-strong bg-surface text-ink hover:bg-surface-muted'
                        }`}
                      >
                        <span className="block text-xs font-medium tracking-wide uppercase opacity-80">
                          {deck.label}
                        </span>
                        <span className="mt-0.5 block text-sm font-semibold">
                          {deck.section}
                        </span>
                        <span className="mt-1 block text-xs opacity-80">
                          {`Passages ${deck.rangeLabel} \u00b7 ${deck.passageCount}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <BookCheckboxList
                  idPrefix="learn-book"
                  selected={books}
                  onChange={(next) => {
                    setBooks(next);
                    const count = passageCountForBooks(next);
                    if (count > 0 && count <= 10) setSize('all');
                    else if (size === 'all' && count > 10) setSize(10);
                  }}
                  requireOne
                />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="How many cards" />
            <CardBody>
              <div className="flex flex-wrap gap-2">
                {SIZE_OPTIONS.map((option) => (
                  <Button
                    key={option}
                    variant={size === option ? 'primary' : 'secondary'}
                    onClick={() => setSize(option)}
                    disabled={option > matchingTotal}
                  >
                    {option}
                  </Button>
                ))}
                <Button
                  variant={size === 'all' ? 'primary' : 'secondary'}
                  onClick={() => setSize('all')}
                  disabled={matchingTotal === 0}
                >
                  {`All (${matchingTotal})`}
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>

        <aside className="lg:sticky lg:top-4 lg:self-start">
          <Card>
            <CardHeader title="Preview" />
            <CardBody>
              {preview.length === 0 ? (
                <EmptyState title="Nothing to learn" description="Try another deck or book." />
              ) : (
                <>
                  <p className="text-sm text-ink-muted">
                    {`${preview.length} card${preview.length === 1 ? '' : 's'} · passage first, then reference`}
                  </p>
                  <ol className="mt-3 max-h-64 space-y-1 overflow-y-auto text-sm">
                    {preview.slice(0, 20).map((verseId) => {
                      const verse = getVerse(verseId);
                      return (
                        <li key={verseId} className="flex gap-2 text-ink">
                          <span className="font-mono text-xs text-ink-subtle tabular-nums">
                            {String(verse?.order ?? 0).padStart(3, '0')}
                          </span>
                          <span className="font-serif">{verse?.reference}</span>
                        </li>
                      );
                    })}
                    {preview.length > 20 ? (
                      <li className="text-xs text-ink-subtle">
                        {`and ${preview.length - 20} more`}
                      </li>
                    ) : null}
                  </ol>
                </>
              )}

              <Button
                variant="primary"
                size="lg"
                className="mt-4 w-full"
                disabled={preview.length === 0 || starting}
                onClick={() => void start()}
              >
                <Play className="size-4" aria-hidden="true" />
                Start learning
              </Button>
            </CardBody>
          </Card>
        </aside>
      </div>
    </>
  );
}

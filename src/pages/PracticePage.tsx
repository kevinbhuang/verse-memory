import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { GraduationCap, Keyboard, Play, RotateCcw } from 'lucide-react';
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
import { SECTIONS, type ReviewMode, type Section } from '@/types';
import {
  createSession,
  selectVerseIds,
  type SessionCriteria,
} from '@/services/sessionService';
import { formatRelativeDay } from '@/utils/format';

type Scope = 'deck' | 'book';
type PracticeKind = 'learn' | 'first-letter';
type PassageFilter = 'all' | 'difficult';

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

function defaultSize(passageCount: number): number | 'all' {
  return passageCount > 0 && passageCount <= 10 ? 'all' : 10;
}

/**
 * Single entry point for sessions: pick a deck/book, Learn or Practice,
 * optionally Difficult only, then start.
 */
export function PracticePage() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const progressList = useAllProgress();
  const openSession = useOpenSession();
  const [searchParams] = useSearchParams();

  const bookParam = searchParams.get('book');
  const kindParam = searchParams.get('mode');
  const filterParam = searchParams.get('filter');

  const [scope, setScope] = useState<Scope>(bookParam ? 'book' : 'deck');
  const [section, setSection] = useState<Section>(() =>
    initialSection(searchParams.get('section') ?? searchParams.get('deck')),
  );
  const [books, setBooks] = useState(() => initialBooks(bookParam));
  const [kind, setKind] = useState<PracticeKind>(
    kindParam === 'first-letter' ? 'first-letter' : 'learn',
  );
  const [filter, setFilter] = useState<PassageFilter>(
    filterParam === 'difficult' ? 'difficult' : 'all',
  );
  const [starting, setStarting] = useState(false);

  const selectedDeck = deckForSection(section) ?? DECKS[0];
  const matchingTotal =
    scope === 'deck'
      ? selectedDeck.passageCount
      : passageCountForBooks(books);
  const size = defaultSize(matchingTotal);

  const fixedMode: Extract<ReviewMode, 'learn' | 'first-letter'> =
    kind === 'learn' ? 'learn' : 'first-letter';

  const criteria: SessionCriteria = useMemo(() => {
    const source =
      filter === 'difficult'
        ? 'difficult'
        : scope === 'deck'
          ? 'section'
          : 'book';

    return {
      source,
      size,
      modeStrategy: 'fixed',
      fixedMode,
      section: scope === 'deck' ? section : null,
      books: scope === 'book' ? books : null,
    };
  }, [books, filter, fixedMode, scope, section, size]);

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
      const kindLabel = kind === 'learn' ? 'Learn' : 'Practice';
      const filterLabel = filter === 'difficult' ? ' · Difficult' : '';
      const session = await createSession(
        criteria,
        `${kindLabel} \u00b7 ${scopeLabel}${filterLabel}`,
      );
      if (!session) {
        notify('No passages match that choice.', 'error');
        return;
      }
      navigate(`/review/session?id=${session.id}`);
    } finally {
      setStarting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Practice"
        description="Pick a deck or book, choose Learn or Practice, then start."
      />

      {openSession ? (
        <Card className="mb-5 border-accent/40 bg-accent-soft">
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-ink">
                You have an unfinished session
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
            <CardHeader title="What to practice" />
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
                  onClick={() => setScope('book')}
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
                        onClick={() => setSection(deck.section)}
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
                  idPrefix="practice-book"
                  selected={books}
                  onChange={setBooks}
                  requireOne
                />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="How" />
            <CardBody className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setKind('learn')}
                  aria-pressed={kind === 'learn'}
                  className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-left ${
                    kind === 'learn'
                      ? 'border-accent bg-accent-soft text-accent'
                      : 'border-line-strong bg-surface text-ink hover:bg-surface-muted'
                  }`}
                >
                  <GraduationCap className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                  <span>
                    <span className="block text-sm font-semibold">Learn</span>
                    <span className="mt-0.5 block text-xs opacity-80">
                      See the reference and passage, then review.
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setKind('first-letter')}
                  aria-pressed={kind === 'first-letter'}
                  className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-left ${
                    kind === 'first-letter'
                      ? 'border-accent bg-accent-soft text-accent'
                      : 'border-line-strong bg-surface text-ink hover:bg-surface-muted'
                  }`}
                >
                  <Keyboard className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                  <span>
                    <span className="block text-sm font-semibold">Practice</span>
                    <span className="mt-0.5 block text-xs opacity-80">
                      Type the first letter of each word.
                    </span>
                  </span>
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant={filter === 'all' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setFilter('all')}
                >
                  All
                </Button>
                <Button
                  variant={filter === 'difficult' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setFilter('difficult')}
                >
                  Difficult only
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>

        <aside className="lg:sticky lg:top-4 lg:self-start">
          <Card>
            <CardHeader title="Session" />
            <CardBody>
              {preview.length === 0 ? (
                <EmptyState
                  title="Nothing matches"
                  description="Try All, or pick a different deck or book."
                />
              ) : (
                <>
                  <p className="text-sm text-ink-muted">
                    {`${preview.length} passage${preview.length === 1 ? '' : 's'}${
                      size !== 'all' && matchingTotal > preview.length
                        ? ` of ${matchingTotal}`
                        : ''
                    }`}
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
                Start
              </Button>
            </CardBody>
          </Card>
        </aside>
      </div>
    </>
  );
}

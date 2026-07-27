import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Keyboard, Mic, Play, RotateCcw } from 'lucide-react';
import {
  BookCheckboxList,
} from '@/components/BookCheckboxList';
import { booksLabel } from '@/lib/text/bookSelection';
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
  type SessionSource,
} from '@/services/sessionService';
import { formatRelativeDay } from '@/utils/format';

const SIZE_OPTIONS = [5, 10, 20] as const;
type Scope = 'deck' | 'book';
type ReviewFilter = 'all' | 'difficult' | 'due' | 'new' | 'learning' | 'memorized';

const FILTER_OPTIONS: Array<{ id: ReviewFilter; label: string; hint: string }> = [
  { id: 'all', label: 'All', hint: 'Every passage in the deck or book' },
  { id: 'difficult', label: 'Difficult', hint: 'Marked difficult' },
  { id: 'due', label: 'Need practice', hint: 'Due or overdue' },
  { id: 'new', label: 'New', hint: 'Never reviewed' },
  { id: 'learning', label: 'Learning', hint: 'In progress' },
  { id: 'memorized', label: 'Memorized', hint: 'Marked memorized' },
];

const PRACTICE_MODES: Array<{
  mode: Extract<ReviewMode, 'first-letter' | 'voice'>;
  title: string;
  description: string;
  icon: typeof Keyboard;
}> = [
  {
    mode: 'first-letter',
    title: 'First letters',
    description: 'Type the first letter of each word.',
    icon: Keyboard,
  },
  {
    mode: 'voice',
    title: 'Speak',
    description: 'Recite into your microphone.',
    icon: Mic,
  },
];

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

function sourceForFilter(filter: ReviewFilter, scope: Scope): SessionSource {
  if (filter === 'all') return scope === 'deck' ? 'section' : 'book';
  return filter;
}

export function ReviewSetupPage() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const progressList = useAllProgress();
  const openSession = useOpenSession();
  const [searchParams] = useSearchParams();

  const initialMode = searchParams.get('mode');
  const bookParam = searchParams.get('book');
  const filterParam = searchParams.get('filter') as ReviewFilter | null;

  const [scope, setScope] = useState<Scope>(bookParam ? 'book' : 'deck');
  const [filter, setFilter] = useState<ReviewFilter>(
    filterParam && FILTER_OPTIONS.some((option) => option.id === filterParam)
      ? filterParam
      : 'all',
  );
  const [mode, setMode] = useState<Extract<ReviewMode, 'first-letter' | 'voice'>>(
    initialMode === 'voice' ? 'voice' : 'first-letter',
  );
  const [section, setSection] = useState<Section>(() =>
    initialSection(searchParams.get('section') ?? searchParams.get('deck')),
  );
  const [books, setBooks] = useState(() => initialBooks(bookParam));
  const [size, setSize] = useState<number | 'all'>(10);
  const [starting, setStarting] = useState(false);

  const selectedDeck = deckForSection(section) ?? DECKS[0];

  const criteria: SessionCriteria = useMemo(() => {
    const source = sourceForFilter(filter, scope);
    const base = {
      size,
      modeStrategy: 'fixed' as const,
      fixedMode: mode,
      section: scope === 'deck' ? section : null,
      books: scope === 'book' ? books : null,
    };
    return { ...base, source };
  }, [books, filter, mode, scope, section, size]);

  const preview = useMemo(
    () => (progressList ? selectVerseIds(criteria, progressList) : []),
    [criteria, progressList],
  );

  const matchingCount = useMemo(
    () =>
      progressList
        ? selectVerseIds({ ...criteria, size: 'all' }, progressList).length
        : 0,
    [criteria, progressList],
  );

  if (!progressList) return <LoadingState />;

  const start = async () => {
    setStarting(true);
    try {
      const scopeLabel =
        scope === 'deck' ? selectedDeck.label : booksLabel(books);
      const filterLabel =
        FILTER_OPTIONS.find((option) => option.id === filter)?.label ?? filter;
      const modeLabel = mode === 'first-letter' ? 'First letters' : 'Speak';
      const session = await createSession(
        criteria,
        `${scopeLabel} \u00b7 ${filterLabel} \u00b7 ${modeLabel}`,
      );
      if (!session) {
        notify('No passages match that choice right now.', 'error');
        return;
      }
      navigate(`/review/session?id=${session.id}`);
    } finally {
      setStarting(false);
    }
  };

  const resumeIsReview = openSession && openSession.fixedMode !== 'learn';

  return (
    <>
      <PageHeader
        title="Review"
        description="Pick a deck or books, choose what to include, then practice with first letters or speak."
      />

      {resumeIsReview ? (
        <Card className="mb-5 border-accent/40 bg-accent-soft">
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-ink">
                You have an unfinished review session
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
              Resume session
            </Button>
          </CardBody>
        </Card>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Deck or books" />
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
                  idPrefix="review-book"
                  selected={books}
                  onChange={setBooks}
                  requireOne
                />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Which passages"
              description="Filter within the deck or books you chose."
            />
            <CardBody>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {FILTER_OPTIONS.map((option) => {
                  const selected = filter === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setFilter(option.id)}
                      aria-pressed={selected}
                      className={`rounded-lg border px-3 py-2.5 text-left ${
                        selected
                          ? 'border-accent bg-accent-soft text-accent'
                          : 'border-line-strong bg-surface text-ink hover:bg-surface-muted'
                      }`}
                    >
                      <span className="block text-sm font-semibold">{option.label}</span>
                      <span className="mt-0.5 block text-xs opacity-80">
                        {option.hint}
                      </span>
                    </button>
                  );
                })}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="How to practice" />
            <CardBody>
              <div className="grid gap-3 sm:grid-cols-2">
                {PRACTICE_MODES.map((option) => {
                  const Icon = option.icon;
                  const selected = mode === option.mode;
                  return (
                    <button
                      key={option.mode}
                      type="button"
                      onClick={() => setMode(option.mode)}
                      aria-pressed={selected}
                      className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-left ${
                        selected
                          ? 'border-accent bg-accent-soft text-accent'
                          : 'border-line-strong bg-surface text-ink hover:bg-surface-muted'
                      }`}
                    >
                      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                      <span>
                        <span className="block text-sm font-semibold">
                          {option.title}
                        </span>
                        <span className="mt-0.5 block text-xs opacity-80">
                          {option.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="How many" />
            <CardBody>
              <div className="flex flex-wrap gap-2">
                {SIZE_OPTIONS.map((option) => (
                  <Button
                    key={option}
                    variant={size === option ? 'primary' : 'secondary'}
                    onClick={() => setSize(option)}
                    disabled={matchingCount > 0 && option > matchingCount}
                  >
                    {option}
                  </Button>
                ))}
                <Button
                  variant={size === 'all' ? 'primary' : 'secondary'}
                  onClick={() => setSize('all')}
                >
                  {`All matching (${matchingCount})`}
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <Card>
            <CardHeader title="Session preview" />
            <CardBody>
              {preview.length === 0 ? (
                <EmptyState
                  title="Nothing matches"
                  description="Try All, or pick a different deck, book, or filter."
                />
              ) : (
                <>
                  <p className="text-sm text-ink-muted">
                    {`${preview.length} passage${preview.length === 1 ? '' : 's'}${
                      matchingCount > preview.length
                        ? ` of ${matchingCount} matching`
                        : ''
                    }.`}
                  </p>
                  <ol className="mt-3 max-h-64 space-y-1 overflow-y-auto text-sm">
                    {preview.slice(0, 25).map((verseId) => {
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
                    {preview.length > 25 ? (
                      <li className="text-xs text-ink-subtle">
                        {`and ${preview.length - 25} more`}
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
                Start review
              </Button>
            </CardBody>
          </Card>
        </aside>
      </div>
    </>
  );
}

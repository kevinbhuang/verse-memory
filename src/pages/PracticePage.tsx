import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  CalendarClock,
  GraduationCap,
  Keyboard,
  Play,
  RotateCcw,
} from 'lucide-react';
import { BookCheckboxList } from '@/components/BookCheckboxList';
import { booksLabel, passageCountForBooks } from '@/lib/text/bookSelection';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState, LoadingState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { useAllProgress, useOpenSession } from '@/hooks/useProgressData';
import { DECKS } from '@/config/app';
import { COLLECTION_BOOKS } from '@/lib/text/books';
import { getVerse } from '@/data/verses';
import { dueState } from '@/lib/scheduler';
import { SECTIONS, type ReviewMode, type Section } from '@/types';
import {
  createSession,
  selectVerseIds,
  type SessionCriteria,
} from '@/services/sessionService';
import { formatRelativeDay } from '@/utils/format';

type Scope = 'deck' | 'book';
type PracticeKind = 'learn' | 'first-letter';
type PassageFilter = 'all' | 'difficult' | 'memorized';
type SizeChoice = 10 | 'all';

function initialSections(param: string | null): Section[] {
  if (param && (SECTIONS as readonly string[]).includes(param)) {
    return [param as Section];
  }
  return [SECTIONS[0]];
}

function initialBooks(param: string | null): string[] {
  if (param && COLLECTION_BOOKS.some((book) => book.name === param)) {
    return [param];
  }
  const romans = COLLECTION_BOOKS.find((book) => book.name === 'Romans');
  return [romans?.name ?? COLLECTION_BOOKS[0]?.name ?? 'John'];
}

function decksLabel(sections: readonly Section[]): string {
  if (sections.length === 0) return 'No decks';
  if (sections.length === DECKS.length) return 'All decks';
  if (sections.length === 1) {
    const deck = DECKS.find((item) => item.section === sections[0]);
    return deck?.label ?? sections[0]!;
  }
  return `${sections.length} decks`;
}

/**
 * Single entry point for sessions: pick deck(s)/book(s), Learn or Practice,
 * size and difficulty, then start.
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
  const [sections, setSections] = useState<Section[]>(() =>
    initialSections(searchParams.get('section') ?? searchParams.get('deck')),
  );
  const [books, setBooks] = useState(() => initialBooks(bookParam));
  const [sizeChoice, setSizeChoice] = useState<SizeChoice>(10);
  const [kind, setKind] = useState<PracticeKind>(
    kindParam === 'first-letter' ? 'first-letter' : 'learn',
  );
  const [filter, setFilter] = useState<PassageFilter>(
    filterParam === 'difficult' || filterParam === 'memorized'
      ? filterParam
      : 'all',
  );
  const [starting, setStarting] = useState(false);

  const matchingTotal = useMemo(() => {
    if (scope === 'deck') {
      return DECKS.filter((deck) => sections.includes(deck.section)).reduce(
        (sum, deck) => sum + deck.passageCount,
        0,
      );
    }
    return passageCountForBooks(books);
  }, [books, scope, sections]);

  const size: number | 'all' =
    sizeChoice === 'all' ? 'all' : Math.min(10, matchingTotal || 10);

  const fixedMode: Extract<ReviewMode, 'learn' | 'first-letter'> =
    kind === 'learn' ? 'learn' : 'first-letter';

  const criteria: SessionCriteria = useMemo(() => {
    const source =
      filter === 'difficult'
        ? 'difficult'
        : filter === 'memorized'
          ? 'memorized'
          : scope === 'deck'
            ? 'section'
            : 'book';

    return {
      source,
      size,
      modeStrategy: 'fixed',
      fixedMode,
      sections: scope === 'deck' ? sections : null,
      section: null,
      books: scope === 'book' ? books : null,
    };
  }, [books, filter, fixedMode, scope, sections, size]);

  const preview = useMemo(
    () => (progressList ? selectVerseIds(criteria, progressList) : []),
    [criteria, progressList],
  );

  const dueCriteria = useMemo<SessionCriteria>(
    () => ({
      source: 'due',
      size: 'all',
      modeStrategy: 'fixed',
      fixedMode: 'first-letter',
    }),
    [],
  );

  const dueVerseIds = useMemo(
    () => (progressList ? selectVerseIds(dueCriteria, progressList) : []),
    [dueCriteria, progressList],
  );

  const overdueCount = useMemo(() => {
    if (!progressList) return 0;
    return progressList.filter((progress) => dueState(progress) === 'overdue')
      .length;
  }, [progressList]);

  const allDecksSelected =
    scope === 'deck' && sections.length === DECKS.length;

  const toggleSection = (section: Section) => {
    setSections((current) => {
      if (current.includes(section)) {
        if (current.length <= 1) return current;
        return current.filter((item) => item !== section);
      }
      return [...current, section];
    });
  };

  if (!progressList) return <LoadingState />;

  const start = async () => {
    setStarting(true);
    try {
      const scopeLabel =
        scope === 'deck' ? decksLabel(sections) : booksLabel(books);
      const kindLabel = kind === 'learn' ? 'Learn' : 'Practice';
      const filterLabel =
        filter === 'difficult'
          ? ' · Difficult'
          : filter === 'memorized'
            ? ' · Memorized'
            : '';
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

  const startDueToday = async () => {
    setStarting(true);
    try {
      const session = await createSession(dueCriteria, 'Due today');
      if (!session) {
        notify('Nothing is due right now.', 'error');
        return;
      }
      navigate(`/review/session?id=${session.id}`);
    } finally {
      setStarting(false);
    }
  };

  const dueDetail =
    dueVerseIds.length === 0
      ? 'Nothing due right now.'
      : overdueCount > 0
        ? `${dueVerseIds.length} passage${dueVerseIds.length === 1 ? '' : 's'} \u00b7 ${overdueCount} overdue`
        : `${dueVerseIds.length} passage${dueVerseIds.length === 1 ? '' : 's'} ready to review`;

  return (
    <>
      <PageHeader
        title="Practice"
        description="Review what's due, or build a Learn/Practice session by deck or book."
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

      <Card className="mb-5">
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <CalendarClock
              className="mt-0.5 size-5 shrink-0 text-accent"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">Due today</p>
              <p className="text-sm text-ink-muted">{dueDetail}</p>
            </div>
          </div>
          <Button
            variant="primary"
            disabled={dueVerseIds.length === 0 || starting}
            onClick={() => void startDueToday()}
            aria-label={
              dueVerseIds.length === 0
                ? 'Nothing due today'
                : `Start ${dueVerseIds.length} due passage${dueVerseIds.length === 1 ? '' : 's'}`
            }
          >
            <Play className="size-4" aria-hidden="true" />
            Start
          </Button>
        </CardBody>
      </Card>

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
                  Decks
                </Button>
                <Button
                  variant={scope === 'book' ? 'primary' : 'secondary'}
                  onClick={() => setScope('book')}
                >
                  Books
                </Button>
              </div>

              {scope === 'deck' ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="text-xs font-medium text-accent hover:underline"
                      onClick={() =>
                        setSections(DECKS.map((deck) => deck.section))
                      }
                    >
                      Select all decks
                    </button>
                    <span className="text-xs text-ink-subtle" aria-hidden="true">
                      ·
                    </span>
                    <button
                      type="button"
                      className="text-xs font-medium text-ink-muted hover:underline"
                      onClick={() => setSections([SECTIONS[0]])}
                    >
                      Reset
                    </button>
                  </div>
                  <div
                    className="grid gap-2 sm:grid-cols-2"
                    role="group"
                    aria-label="Decks"
                  >
                    {DECKS.map((deck) => {
                      const selected = sections.includes(deck.section);
                      return (
                        <button
                          key={deck.section}
                          type="button"
                          onClick={() => toggleSection(deck.section)}
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
                  {allDecksSelected ? (
                    <p className="text-xs text-ink-muted">All decks selected.</p>
                  ) : null}
                </div>
              ) : (
                <BookCheckboxList
                  idPrefix="practice-book"
                  selected={books}
                  onChange={setBooks}
                  requireOne
                />
              )}

              <div>
                <p className="mb-2 text-sm font-medium text-ink">How many</p>
                <div
                  className="flex flex-wrap gap-2"
                  role="group"
                  aria-label="Session length"
                >
                  <Button
                    variant={sizeChoice === 10 ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setSizeChoice(10)}
                    disabled={matchingTotal === 0}
                    aria-pressed={sizeChoice === 10}
                  >
                    10 passages
                  </Button>
                  <Button
                    variant={sizeChoice === 'all' ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setSizeChoice('all')}
                    disabled={matchingTotal === 0}
                    aria-pressed={sizeChoice === 'all'}
                  >
                    {matchingTotal > 0
                      ? `All ${matchingTotal} passages`
                      : 'All passages'}
                  </Button>
                </div>
              </div>
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
                  variant={filter === 'memorized' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setFilter('memorized')}
                >
                  Memorized only
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
                    {sizeChoice === 'all'
                      ? `All ${preview.length} passages`
                      : `${preview.length} of ${matchingTotal} passages`}
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

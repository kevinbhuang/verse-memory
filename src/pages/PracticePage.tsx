import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ALargeSmall,
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
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useToast } from '@/components/ui/Toast';
import { useAllProgress, useOpenSession } from '@/hooks/useProgressData';
import { DECKS } from '@/config/app';
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
type PracticeKind = 'learn' | 'flashcard' | 'first-letter';
type PassageFilter = 'all' | 'needs-review' | 'memorized';
type SizeChoice = 10 | 'all';

function parsePassageFilter(param: string | null): PassageFilter {
  if (param === 'memorized') return 'memorized';
  if (param === 'needs-review' || param === 'difficult') return 'needs-review';
  return 'all';
}
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
 * Single entry point for sessions: pick deck(s)/book(s), how to review,
 * size and status filter, then start.
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
  const [kind, setKind] = useState<PracticeKind>(() => {
    if (kindParam === 'first-letter' || kindParam === 'flashcard') {
      return kindParam;
    }
    return 'learn';
  });
  const [filter, setFilter] = useState<PassageFilter>(() =>
    parsePassageFilter(filterParam),
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

  const fixedMode: Extract<ReviewMode, 'learn' | 'flashcard' | 'first-letter'> =
    kind === 'learn'
      ? 'learn'
      : kind === 'flashcard'
        ? 'flashcard'
        : 'first-letter';

  const criteria: SessionCriteria = useMemo(() => {
    const source =
      filter === 'needs-review'
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
      const kindLabel =
        kind === 'learn'
          ? 'Learn'
          : kind === 'flashcard'
            ? 'First letter'
            : 'Practice';
      const filterLabel =
        filter === 'needs-review'
          ? ' · Needs Review'
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

  return (
    <>
      <PageHeader
        title="Practice"
        description="Build a Learn or Practice session by deck or book."
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

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_17rem] lg:items-start">
        <Card>
          <CardHeader title="What to practice" className="px-4 py-3" />
          <CardBody className="space-y-3 px-4 py-3">
            <SegmentedControl
              aria-label="Practice scope"
              value={scope}
              onChange={setScope}
              options={[
                { value: 'deck', label: 'Decks' },
                { value: 'book', label: 'Books' },
              ]}
            />

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
                  className="max-h-56 divide-y divide-line overflow-y-auto border-y border-line"
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
                        className={`flex w-full items-baseline justify-between gap-3 px-1 py-2 text-left transition-colors ${
                          selected
                            ? 'bg-accent-soft/50 text-accent'
                            : 'text-ink hover:bg-surface-muted'
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block text-xs text-ink-subtle">
                            {deck.label}
                          </span>
                          <span className="block text-sm font-medium">
                            {deck.section}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs text-ink-muted tabular-nums">
                          {deck.passageCount}
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
              <div className="max-h-56 overflow-y-auto">
                <BookCheckboxList
                  idPrefix="practice-book"
                  selected={books}
                  onChange={setBooks}
                  requireOne
                />
              </div>
            )}

            <div>
              <p className="mb-1.5 text-sm font-medium text-ink">How many</p>
              <SegmentedControl
                aria-label="Session length"
                size="sm"
                value={sizeChoice === 'all' ? 'all' : '10'}
                onChange={(next) =>
                  setSizeChoice(next === 'all' ? 'all' : 10)
                }
                options={[
                  {
                    value: '10',
                    label: '10 passages',
                    disabled: matchingTotal === 0,
                  },
                  {
                    value: 'all',
                    label:
                      matchingTotal > 0
                        ? `All ${matchingTotal} passages`
                        : 'All passages',
                    disabled: matchingTotal === 0,
                  },
                ]}
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="How" className="px-4 py-3" />
          <CardBody className="space-y-3 px-4 py-3">
            <div
              className="divide-y divide-line border-y border-line"
              role="group"
              aria-label="Practice style"
            >
              <button
                type="button"
                onClick={() => setKind('learn')}
                aria-pressed={kind === 'learn'}
                className={`flex w-full items-start gap-3 px-1 py-2.5 text-left transition-colors ${
                  kind === 'learn'
                    ? 'bg-accent-soft/50 text-accent'
                    : 'text-ink hover:bg-surface-muted'
                }`}
              >
                <GraduationCap
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  <span className="block text-sm font-semibold">Learn</span>
                  <span className="mt-0.5 block text-xs opacity-80">
                    See the reference and passage, then review.
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setKind('flashcard')}
                aria-pressed={kind === 'flashcard'}
                className={`flex w-full items-start gap-3 px-1 py-2.5 text-left transition-colors ${
                  kind === 'flashcard'
                    ? 'bg-accent-soft/50 text-accent'
                    : 'text-ink hover:bg-surface-muted'
                }`}
              >
                <ALargeSmall
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  <span className="block text-sm font-semibold">
                    First letter
                  </span>
                  <span className="mt-0.5 block text-xs opacity-80">
                    See first letters, then reveal the full passage.
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setKind('first-letter')}
                aria-pressed={kind === 'first-letter'}
                className={`flex w-full items-start gap-3 px-1 py-2.5 text-left transition-colors ${
                  kind === 'first-letter'
                    ? 'bg-accent-soft/50 text-accent'
                    : 'text-ink hover:bg-surface-muted'
                }`}
              >
                <Keyboard
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  <span className="block text-sm font-semibold">Practice</span>
                  <span className="mt-0.5 block text-xs opacity-80">
                    Type the first letter of each word.
                  </span>
                </span>
              </button>
            </div>

            <SegmentedControl
              aria-label="Passage filter"
              size="sm"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'All' },
                { value: 'memorized', label: 'Memorized' },
                { value: 'needs-review', label: 'Needs Review' },
              ]}
            />
          </CardBody>
        </Card>

        <aside className="lg:col-span-2 xl:col-span-1 xl:sticky xl:top-4 xl:self-start">
          <Card>
            <CardHeader title="Session" className="px-4 py-3" />
            <CardBody className="px-4 py-3">
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
                  <ol className="mt-2 max-h-40 space-y-1 overflow-y-auto text-sm">
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
                className="mt-3 w-full"
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

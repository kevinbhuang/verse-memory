import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  ClipboardList,
  Keyboard,
  PencilLine,
  Play,
  Quote,
} from 'lucide-react';
import { BookCheckboxList } from '@/components/BookCheckboxList';
import { booksLabel, passageCountForBooks } from '@/lib/text/bookSelection';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useToast } from '@/components/ui/Toast';
import { DECKS, appConfig } from '@/config/app';
import { COLLECTION_BOOKS } from '@/lib/text/books';
import { verses } from '@/data/verses';
import {
  createQuizSession,
  selectQuizVerseIds,
  type QuizScope,
} from '@/services/quizService';
import { SECTIONS, type Section } from '@/types';
import {
  QUIZ_MODES,
  QUIZ_MODE_DESCRIPTIONS,
  QUIZ_MODE_LABELS,
  type QuizMode,
} from '@/types/quiz';

type SizeChoice = 10 | 'all';

const MODE_ICONS: Record<QuizMode, typeof Quote> = {
  reference: BookOpen,
  'first-words': Quote,
  'first-letter': Keyboard,
  'fill-blank': PencilLine,
};

function decksLabel(sections: readonly Section[]): string {
  if (sections.length === 0) return 'No decks';
  if (sections.length === 1) {
    const deck = DECKS.find((item) => item.section === sections[0]);
    return deck?.label ?? sections[0]!;
  }
  return `${sections.length} decks`;
}

/**
 * Build a scored quiz: pick scope, size, and quiz type, then start.
 */
export function QuizPage() {
  const navigate = useNavigate();
  const { notify } = useToast();

  const [scope, setScope] = useState<QuizScope>('deck');
  const [sections, setSections] = useState<Section[]>([SECTIONS[0]]);
  const [books, setBooks] = useState(() => {
    const romans = COLLECTION_BOOKS.find((item) => item.name === 'Romans');
    return [romans?.name ?? COLLECTION_BOOKS[0]?.name ?? 'John'];
  });
  const [sizeChoice, setSizeChoice] = useState<SizeChoice>(10);
  const [mode, setMode] = useState<QuizMode>('reference');
  const [starting, setStarting] = useState(false);

  const matchingTotal = useMemo(() => {
    if (scope === 'all') return verses.length;
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

  const previewCount = selectQuizVerseIds({
    scope,
    sections,
    books,
    size,
    mode,
    shuffle: false,
  }).length;

  const toggleSection = (section: Section) => {
    setSections((current) => {
      if (current.includes(section)) {
        if (current.length <= 1) return current;
        return current.filter((item) => item !== section);
      }
      return [...current, section];
    });
  };

  const start = () => {
    if (previewCount === 0) {
      notify('Select at least one deck or book with passages.', 'error');
      return;
    }
    setStarting(true);
    try {
      const scopePart =
        scope === 'all'
          ? 'All verses'
          : scope === 'deck'
            ? decksLabel(sections)
            : booksLabel(books);
      const session = createQuizSession(
        { scope, sections, books, size, mode, shuffle: true },
        `${QUIZ_MODE_LABELS[mode]} \u00b7 ${scopePart}`,
      );
      if (!session) {
        notify('No passages match that choice.', 'error');
        return;
      }
      navigate(`/quiz/session?id=${session.id}`);
    } finally {
      setStarting(false);
    }
  };

  return (
    <>
      <PageHeader title="Quiz" />

      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.95fr)_15rem] lg:items-stretch">
        <Card className="flex flex-col">
          <CardHeader title="What to quiz" className="px-4 py-2.5" />
          <CardBody className="flex flex-1 flex-col space-y-3 px-4 py-3">
            <SegmentedControl
              aria-label="Quiz scope"
              size="sm"
              value={scope}
              onChange={setScope}
              options={[
                { value: 'all', label: 'All verses' },
                { value: 'deck', label: 'Decks' },
                { value: 'book', label: 'Books' },
              ]}
            />

            {scope === 'all' ? (
              <p className="text-sm text-ink-muted">
                {`Every passage in ${appConfig.collectionTitle} (${verses.length}).`}
              </p>
            ) : null}

            {scope === 'deck' ? (
              <div
                className="divide-y divide-line border-y border-line"
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
                      className={`flex w-full items-center justify-between gap-3 px-1 py-1.5 text-left transition-colors ${
                        selected
                          ? 'bg-accent-soft/50 text-accent'
                          : 'text-ink hover:bg-surface-muted'
                      }`}
                    >
                      <span className="min-w-0 truncate text-sm font-medium">
                        <span className="text-ink-subtle font-normal">
                          {deck.label}
                        </span>
                        {` · ${deck.section}`}
                      </span>
                      <span className="shrink-0 text-xs text-ink-muted tabular-nums">
                        {deck.passageCount}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}

            {scope === 'book' ? (
              <BookCheckboxList
                idPrefix="quiz-book"
                selected={books}
                onChange={setBooks}
                requireOne
              />
            ) : null}

            <div>
              <p className="mb-1.5 text-sm font-medium text-ink">How many</p>
              <SegmentedControl
                aria-label="Quiz length"
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

        <Card className="flex flex-col">
          <CardHeader title="Quiz type" className="px-4 py-2.5" />
          <CardBody className="!flex-1 !p-0">
            <div className="divide-y divide-line">
              {QUIZ_MODES.map((option) => {
                const Icon = MODE_ICONS[option];
                const selected = mode === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setMode(option)}
                    aria-pressed={selected}
                    className={`flex w-full items-start gap-3 px-4 py-2 text-left transition-colors ${
                      selected
                        ? 'bg-accent-soft/50 text-accent'
                        : 'text-ink hover:bg-surface-muted'
                    }`}
                  >
                    <Icon
                      className="mt-0.5 size-4 shrink-0"
                      aria-hidden="true"
                    />
                    <span>
                      <span className="block text-sm font-semibold">
                        {QUIZ_MODE_LABELS[option]}
                      </span>
                      <span className="mt-0.5 block text-xs opacity-80">
                        {QUIZ_MODE_DESCRIPTIONS[option]}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </CardBody>
        </Card>

        <aside className="space-y-3 lg:col-span-2 xl:col-span-1 xl:sticky xl:top-4 xl:self-start">
          <Card>
            <CardHeader title="Ready" className="px-4 py-2.5" />
            <CardBody className="space-y-3 px-4 py-3">
              {previewCount === 0 ? (
                <EmptyState
                  icon={<ClipboardList className="size-6" aria-hidden="true" />}
                  title="Nothing selected"
                  description="Pick at least one deck or book."
                />
              ) : (
                <p className="text-sm text-ink-muted">
                  {sizeChoice === 'all'
                    ? `All ${previewCount} passages`
                    : `${previewCount} of ${matchingTotal} passages`}
                  {` \u00b7 ${QUIZ_MODE_LABELS[mode]}`}
                </p>
              )}
              <Button
                variant="primary"
                className="w-full"
                disabled={starting || previewCount === 0}
                onClick={start}
              >
                <Play className="size-4" aria-hidden="true" />
                {starting ? 'Starting\u2026' : 'Start quiz'}
              </Button>
            </CardBody>
          </Card>
        </aside>
      </div>
    </>
  );
}

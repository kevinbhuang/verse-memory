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
import { useToast } from '@/components/ui/Toast';
import { DECKS } from '@/config/app';
import { COLLECTION_BOOKS } from '@/lib/text/books';
import { createQuizSession, selectQuizVerseIds } from '@/services/quizService';
import { SECTIONS, type Section } from '@/types';
import {
  QUIZ_MODES,
  QUIZ_MODE_DESCRIPTIONS,
  QUIZ_MODE_LABELS,
  type QuizMode,
} from '@/types/quiz';

type Scope = 'deck' | 'book';

const MODE_ICONS: Record<QuizMode, typeof Quote> = {
  reference: BookOpen,
  'first-words': Quote,
  'first-letter': Keyboard,
  'fill-blank': PencilLine,
};

function defaultSize(count: number): number | 'all' {
  return count > 0 && count <= 10 ? 'all' : 10;
}

function decksLabel(sections: readonly Section[]): string {
  if (sections.length === 0) return 'No decks';
  if (sections.length === 1) {
    const deck = DECKS.find((item) => item.section === sections[0]);
    return deck?.label ?? sections[0]!;
  }
  return `${sections.length} decks`;
}

/**
 * Build a scored quiz: pick decks or books, choose a quiz type, then start.
 */
export function QuizPage() {
  const navigate = useNavigate();
  const { notify } = useToast();

  const [scope, setScope] = useState<Scope>('deck');
  const [sections, setSections] = useState<Section[]>([SECTIONS[0]]);
  const [books, setBooks] = useState(() => {
    const romans = COLLECTION_BOOKS.find((item) => item.name === 'Romans');
    return [romans?.name ?? COLLECTION_BOOKS[0]?.name ?? 'John'];
  });
  const [mode, setMode] = useState<QuizMode>('reference');
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

  const size = defaultSize(matchingTotal);
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
        scope === 'deck' ? decksLabel(sections) : booksLabel(books);
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
      <PageHeader
        title="Quiz"
        description="Test yourself on decks or books with a scored quiz."
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_18rem]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="What to quiz" />
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
                          {`${deck.passageCount} passages`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <BookCheckboxList
                  idPrefix="quiz-book"
                  selected={books}
                  onChange={setBooks}
                  requireOne
                />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Quiz type" />
            <CardBody className="grid gap-2 sm:grid-cols-2">
              {QUIZ_MODES.map((option) => {
                const Icon = MODE_ICONS[option];
                const selected = mode === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setMode(option)}
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
                        {QUIZ_MODE_LABELS[option]}
                      </span>
                      <span className="mt-0.5 block text-xs opacity-80">
                        {QUIZ_MODE_DESCRIPTIONS[option]}
                      </span>
                    </span>
                  </button>
                );
              })}
            </CardBody>
          </Card>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardHeader title="Ready" />
            <CardBody className="space-y-4">
              {previewCount === 0 ? (
                <EmptyState
                  icon={<ClipboardList className="size-6" aria-hidden="true" />}
                  title="Nothing selected"
                  description="Pick at least one deck or book."
                />
              ) : (
                <p className="text-sm text-ink-muted">
                  {size === 'all'
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

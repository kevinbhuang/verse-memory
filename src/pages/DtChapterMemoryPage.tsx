import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Eye, Keyboard } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { dtChapterDecks, getDtChapterDeck } from '@/data/dtChapters';
import {
  DtChapterPracticeSession,
  type DtPracticeMode,
} from '@/features/dtChapterMemory/DtChapterPracticeSession';
import { DtChapterPrintPanel } from '@/features/dtChapterMemory/DtChapterPrintPanel';

function parseMode(value: string | null): DtPracticeMode | null {
  if (value === 'first-letter' || value === 'flashcard') return value;
  return null;
}

/**
 * Isolated chapter-memory collection. Not part of the 171-verse Library,
 * Progress Chart, or Quiz systems. Practice is always whole-chapter.
 */
export function DtChapterMemoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const practiceDeckId = searchParams.get('practice');
  const practiceMode = parseMode(searchParams.get('mode'));

  const totalVerses = useMemo(
    () => dtChapterDecks.reduce((sum, deck) => sum + deck.verses.length, 0),
    [],
  );

  const startPractice = (deckId: string, mode: DtPracticeMode) => {
    setSearchParams({ practice: deckId, mode }, { replace: false });
  };

  const exitPractice = () => {
    setSearchParams({}, { replace: true });
  };

  if (
    practiceDeckId &&
    practiceMode &&
    getDtChapterDeck(practiceDeckId)
  ) {
    return (
      <DtChapterPracticeSession
        deckId={practiceDeckId}
        mode={practiceMode}
        onExit={exitPractice}
      />
    );
  }

  return (
    <>
      <PageHeader
        title="DT Chapter Memory"
        description={`${dtChapterDecks.length} chapters · ${totalVerses} verses · separate from the 171-passage collection`}
        actions={<DtChapterPrintPanel />}
        className="mb-3 flex flex-wrap items-end justify-between gap-2"
      />

      <div className="grid gap-3 md:grid-cols-2">
        {dtChapterDecks.map((deck) => (
          <Card key={deck.id} className="min-w-0">
            <div className="flex items-baseline justify-between gap-2 border-b border-line px-3 py-2">
              <h2 className="truncate text-sm font-semibold text-ink">
                {deck.name}
              </h2>
              <p className="shrink-0 text-xs text-ink-muted">
                {deck.verses.length} verses
              </p>
            </div>
            <CardBody className="space-y-2 px-3 py-2.5">
              <div className="flex flex-wrap gap-1.5">
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => startPractice(deck.id, 'first-letter')}
                >
                  <Keyboard className="size-3" aria-hidden="true" />
                  Type first letter
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => startPractice(deck.id, 'flashcard')}
                >
                  <Eye className="size-3" aria-hidden="true" />
                  See first letters
                </Button>
              </div>

              <div className="border-t border-line pt-2">
                {deck.displayText ? (
                  <pre className="overflow-x-auto whitespace-pre-wrap font-serif text-xs leading-snug text-ink sm:text-[0.8125rem] sm:leading-snug">
                    {deck.displayText}
                  </pre>
                ) : (
                  <p className="font-serif text-xs leading-snug text-ink sm:text-[0.8125rem] sm:leading-snug">
                    {deck.verses.map((verse) => (
                      <span key={verse.id}>
                        <sup className="mr-0.5 select-none font-sans text-[0.7em] font-medium text-ink-muted">
                          {verse.verseNumber}
                        </sup>
                        {verse.text.trim()}{' '}
                      </span>
                    ))}
                  </p>
                )}
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </>
  );
}

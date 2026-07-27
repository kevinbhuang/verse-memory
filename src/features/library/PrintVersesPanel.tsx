import { useMemo, useState } from 'react';
import { Printer } from 'lucide-react';
import { BookCheckboxList } from '@/components/BookCheckboxList';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { DECKS, appConfig } from '@/config/app';
import { getVerse, verses, versesInSection } from '@/data/verses';
import { COLLECTION_BOOKS } from '@/lib/text/books';
import { booksLabel } from '@/lib/text/bookSelection';
import type { Section } from '@/types';
import { downloadVersesPdf, versesPdfFilename } from './printVersesPdf';

type PrintMode = 'all' | 'deck' | 'books';

function versesForBooks(names: readonly string[]) {
  const selected = new Set(names);
  return COLLECTION_BOOKS.filter((book) => selected.has(book.name)).flatMap(
    (book) =>
      book.verseIds
        .map((id) => getVerse(id))
        .filter((verse): verse is NonNullable<typeof verse> => Boolean(verse)),
  );
}

/**
 * Compact library control: print all, one deck, or one-or-more books as PDF.
 */
export function PrintVersesPanel() {
  const { notify } = useToast();
  const [mode, setMode] = useState<PrintMode>('all');
  const [section, setSection] = useState<Section>(DECKS[0]?.section ?? 'Law and History');
  const [books, setBooks] = useState<string[]>(() => {
    const romans = COLLECTION_BOOKS.find((item) => item.name === 'Romans');
    return [romans?.name ?? COLLECTION_BOOKS[0]?.name ?? ''].filter(Boolean);
  });
  const [busy, setBusy] = useState(false);

  const selectedVerses = useMemo(() => {
    if (mode === 'all') return [...verses];
    if (mode === 'deck') return versesInSection(section);
    return versesForBooks(books);
  }, [books, mode, section]);

  const scopeLabel =
    mode === 'all'
      ? 'Collection'
      : mode === 'deck'
        ? section
        : booksLabel(books);

  const onDownload = () => {
    if (selectedVerses.length === 0) {
      notify(
        mode === 'books' && books.length === 0
          ? 'Select at least one book to print.'
          : 'No passages in that selection.',
        'error',
      );
      return;
    }

    setBusy(true);
    try {
      downloadVersesPdf({
        verses: selectedVerses,
        title: appConfig.collectionTitle,
        filename: versesPdfFilename(scopeLabel),
      });
      notify(
        `Downloaded ${selectedVerses.length} passage${selectedVerses.length === 1 ? '' : 's'}.`,
        'success',
      );
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Could not create the PDF.',
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="print-mode">
          Passages to print
        </label>
        <Select
          id="print-mode"
          value={mode}
          onChange={(event) => setMode(event.target.value as PrintMode)}
          className="w-auto min-w-[9rem]"
          aria-label="Passages to print"
        >
          <option value="all">{`All (${verses.length})`}</option>
          <option value="deck">Deck</option>
          <option value="books">Books</option>
        </Select>

        {mode === 'deck' ? (
          <>
            <label className="sr-only" htmlFor="print-deck">
              Deck to print
            </label>
            <Select
              id="print-deck"
              value={section}
              onChange={(event) => setSection(event.target.value as Section)}
              className="min-w-0 flex-1 sm:max-w-xs"
              aria-label="Deck to print"
            >
              {DECKS.map((deck) => (
                <option key={deck.section} value={deck.section}>
                  {`${deck.label} — ${deck.section} (${deck.passageCount})`}
                </option>
              ))}
            </Select>
          </>
        ) : null}

        <Button
          variant="ghost"
          size="sm"
          onClick={onDownload}
          disabled={busy || selectedVerses.length === 0}
        >
          <Printer className="size-3.5" aria-hidden="true" />
          {busy ? 'Preparing\u2026' : 'Print PDF'}
        </Button>
      </div>

      {mode === 'books' ? (
        <BookCheckboxList
          idPrefix="print-book"
          selected={books}
          onChange={setBooks}
        />
      ) : null}
    </div>
  );
}

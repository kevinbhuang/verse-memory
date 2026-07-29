import { useMemo, useState } from 'react';
import { Printer } from 'lucide-react';
import { BookCheckboxList } from '@/components/BookCheckboxList';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Select } from '@/components/ui/Field';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useToast } from '@/components/ui/Toast';
import { useAllProgress } from '@/hooks/useProgressData';
import { DECKS, appConfig } from '@/config/app';
import { getVerse, verses, versesInSection } from '@/data/verses';
import { COLLECTION_BOOKS } from '@/lib/text/books';
import { booksLabel } from '@/lib/text/bookSelection';
import type { Section, Verse, VerseProgress } from '@/types';
import { downloadVersesPdf, versesPdfFilename } from './printVersesPdf';

type PrintMode = 'all' | 'deck' | 'books';
type PrintStatusFilter = 'all' | 'memorized' | 'needs-review';

function versesForBooks(names: readonly string[]) {
  const selected = new Set(names);
  return COLLECTION_BOOKS.filter((book) => selected.has(book.name)).flatMap(
    (book) =>
      book.verseIds
        .map((id) => getVerse(id))
        .filter((verse): verse is NonNullable<typeof verse> => Boolean(verse)),
  );
}

function filterByStatus(
  list: readonly Verse[],
  status: PrintStatusFilter,
  progressById: Map<string, VerseProgress>,
): Verse[] {
  if (status === 'all') return [...list];
  return list.filter((verse) => {
    const progress = progressById.get(verse.id);
    if (!progress) return false;
    if (status === 'memorized') return progress.isMemorized;
    return progress.isDifficult;
  });
}

function statusLabel(status: PrintStatusFilter): string | null {
  if (status === 'memorized') return 'Memorized';
  if (status === 'needs-review') return 'Needs Review';
  return null;
}

/**
 * Subtle library print control: one button, then a dialog to choose the set.
 */
export function PrintVersesPanel() {
  const { notify } = useToast();
  const progressList = useAllProgress();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<PrintMode>('all');
  const [statusFilter, setStatusFilter] = useState<PrintStatusFilter>('all');
  const [section, setSection] = useState<Section>(
    DECKS[0]?.section ?? 'Law and History',
  );
  const [books, setBooks] = useState<string[]>(() => {
    const romans = COLLECTION_BOOKS.find((item) => item.name === 'Romans');
    return [romans?.name ?? COLLECTION_BOOKS[0]?.name ?? ''].filter(Boolean);
  });
  const [busy, setBusy] = useState(false);

  const progressById = useMemo(
    () => new Map((progressList ?? []).map((item) => [item.verseId, item])),
    [progressList],
  );

  const selectedVerses = useMemo(() => {
    const scoped =
      mode === 'all'
        ? [...verses]
        : mode === 'deck'
          ? versesInSection(section)
          : versesForBooks(books);
    return filterByStatus(scoped, statusFilter, progressById);
  }, [books, mode, progressById, section, statusFilter]);

  const scopeLabel = useMemo(() => {
    const base =
      mode === 'all'
        ? 'Collection'
        : mode === 'deck'
          ? section
          : booksLabel(books);
    const status = statusLabel(statusFilter);
    return status ? `${base} — ${status}` : base;
  }, [books, mode, section, statusFilter]);

  const onDownload = () => {
    if (selectedVerses.length === 0) {
      notify(
        mode === 'books' && books.length === 0
          ? 'Select at least one book to print.'
          : statusFilter !== 'all'
            ? `No ${statusLabel(statusFilter)?.toLowerCase() ?? ''} passages in that selection.`
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
      setOpen(false);
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
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Printer className="size-3.5" aria-hidden="true" />
        Print
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Print passages"
        description="Download a two-column PDF checklist."
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={onDownload}
              disabled={busy || selectedVerses.length === 0}
            >
              <Printer className="size-4" aria-hidden="true" />
              {busy
                ? 'Preparing\u2026'
                : `Download PDF (${selectedVerses.length})`}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={mode === 'all' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setMode('all')}
            >
              {`All (${verses.length})`}
            </Button>
            <Button
              variant={mode === 'deck' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setMode('deck')}
            >
              Deck
            </Button>
            <Button
              variant={mode === 'books' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setMode('books')}
            >
              Books
            </Button>
          </div>

          {mode === 'deck' ? (
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">Deck</span>
              <Select
                value={section}
                onChange={(event) => setSection(event.target.value as Section)}
                aria-label="Deck to print"
              >
                {DECKS.map((deck) => (
                  <option key={deck.section} value={deck.section}>
                    {`${deck.label} — ${deck.section} (${deck.passageCount})`}
                  </option>
                ))}
              </Select>
            </label>
          ) : null}

          {mode === 'books' ? (
            <BookCheckboxList
              idPrefix="print-book"
              selected={books}
              onChange={setBooks}
            />
          ) : null}

          <div className="space-y-1.5">
            <p className="text-sm font-medium text-ink">Include</p>
            <SegmentedControl
              aria-label="Print status filter"
              size="sm"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'all', label: 'All' },
                { value: 'memorized', label: 'Memorized' },
                { value: 'needs-review', label: 'Needs Review' },
              ]}
            />
          </div>
        </div>
      </Dialog>
    </>
  );
}

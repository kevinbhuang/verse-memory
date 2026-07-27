import { useMemo, useState } from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Select } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { DECKS, appConfig, deckForSection } from '@/config/app';
import { getVerse, versesInSection } from '@/data/verses';
import { COLLECTION_BOOKS, collectionBook } from '@/lib/text/books';
import { SECTIONS, type Section } from '@/types';
import { downloadVersesPdf, versesPdfFilename } from './printVersesPdf';

type PrintScope = 'deck' | 'book';

/**
 * Pick a deck or book and download a two-column checklist PDF of its passages.
 */
export function PrintVersesPanel() {
  const { notify } = useToast();
  const [scope, setScope] = useState<PrintScope>('deck');
  const [section, setSection] = useState<Section>(SECTIONS[0]);
  const [book, setBook] = useState(
    () => COLLECTION_BOOKS.find((item) => item.name === 'Romans')?.name ?? COLLECTION_BOOKS[0]?.name ?? '',
  );
  const [busy, setBusy] = useState(false);

  const selectedVerses = useMemo(() => {
    if (scope === 'deck') return versesInSection(section);
    const entry = collectionBook(book);
    if (!entry) return [];
    return entry.verseIds
      .map((id) => getVerse(id))
      .filter((verse): verse is NonNullable<typeof verse> => Boolean(verse));
  }, [book, scope, section]);

  const scopeLabel =
    scope === 'deck'
      ? (deckForSection(section)?.section ?? section)
      : book;

  const onDownload = () => {
    if (selectedVerses.length === 0) {
      notify('No passages in that selection.', 'error');
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
    <Card className="mb-3">
      <CardHeader
        title="Print passages"
        description="Download a two-column PDF checklist for a deck or book."
      />
      <CardBody className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button
            variant={scope === 'deck' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setScope('deck')}
          >
            Deck
          </Button>
          <Button
            variant={scope === 'book' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setScope('book')}
          >
            Book
          </Button>
        </div>

        {scope === 'deck' ? (
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
        ) : (
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Book</span>
            <Select
              value={book}
              onChange={(event) => setBook(event.target.value)}
              aria-label="Book to print"
            >
              {COLLECTION_BOOKS.map((item) => (
                <option key={item.name} value={item.name}>
                  {`${item.name} (${item.passageCount})`}
                </option>
              ))}
            </Select>
          </label>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-muted">
            {selectedVerses.length} passage
            {selectedVerses.length === 1 ? '' : 's'}
          </p>
          <Button onClick={onDownload} disabled={busy || selectedVerses.length === 0}>
            <Printer className="size-4" aria-hidden="true" />
            {busy ? 'Preparing\u2026' : 'Download PDF'}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

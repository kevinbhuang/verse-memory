import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { EmptyState, LoadingState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { useAllProgress } from '@/hooks/useProgressData';
import { useSettings } from '@/hooks/useSettings';
import { getVerse, verses } from '@/data/verses';
import { appConfig } from '@/config/app';
import { COLLECTION_BOOKS } from '@/lib/text/books';
import { SECTIONS, VERSE_STATUSES, type Section } from '@/types';
import {
  resetVerse,
  setDifficult,
  setMemorized,
} from '@/services/progressService';
import {
  DEFAULT_FILTERS,
  filterLibrary,
  groupBySection,
  type LibraryFilterState,
} from '@/features/library/filters';
import { LibraryFilters } from '@/features/library/LibraryFilters';
import { LibraryProgressStrip } from '@/features/library/LibraryProgressStrip';
import { PrintVersesPanel } from '@/features/library/PrintVersesPanel';
import { LibraryCheckboxHeader } from '@/features/library/LibraryCheckboxHeader';
import { VerseRow } from '@/features/library/VerseRow';
import { computeCollectionStats } from '@/services/statsService';

function filtersFromParams(params: URLSearchParams): LibraryFilterState {
  const section = params.get('section');
  const book = params.get('book');
  const status = params.get('status');
  const review = params.get('review');
  const legacyMemorized = params.get('memorized');
  const legacyDifficult = params.get('difficult');

  let reviewState: LibraryFilterState['reviewState'] = 'all';
  if (review === 'memorized' || review === 'needs-review') {
    reviewState = review;
  } else if (legacyDifficult === 'true' || review === 'difficult') {
    reviewState = 'needs-review';
  } else if (legacyMemorized === 'memorized') {
    reviewState = 'memorized';
  } else if (status === 'memorized') {
    reviewState = 'memorized';
  } else if (status === 'needs-attention') {
    reviewState = 'needs-review';
  }

  return {
    ...DEFAULT_FILTERS,
    search: params.get('q') ?? '',
    section:
      section && (SECTIONS as readonly string[]).includes(section)
        ? (section as Section)
        : 'all',
    book:
      book && COLLECTION_BOOKS.some((item) => item.name === book) ? book : 'all',
    status:
      status &&
      (VERSE_STATUSES as readonly string[]).includes(status) &&
      status !== 'memorized' &&
      status !== 'needs-attention'
        ? (status as LibraryFilterState['status'])
        : 'all',
    reviewState,
  };
}

export function LibraryPage() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const { settings } = useSettings();
  const progressList = useAllProgress();
  const [searchParams] = useSearchParams();

  const [filters, setFilters] = useState<LibraryFilterState>(() =>
    filtersFromParams(searchParams),
  );
  const [resetVerseId, setResetVerseId] = useState<string | null>(null);

  const progressById = useMemo(
    () => new Map((progressList ?? []).map((item) => [item.verseId, item])),
    [progressList],
  );

  const entries = useMemo(
    () => (progressList ? filterLibrary(progressById, filters) : []),
    [progressList, progressById, filters],
  );

  const groups = useMemo(() => groupBySection(entries), [entries]);

  const collectionStats = useMemo(
    () => (progressList ? computeCollectionStats(progressList) : null),
    [progressList],
  );

  if (!progressList || !collectionStats) {
    return <LoadingState label={'Loading the collection\u2026'} />;
  }

  const resetTarget = resetVerseId ? getVerse(resetVerseId) : null;

  return (
    <>
      <PageHeader
        title={appConfig.collectionTitle}
        actions={<PrintVersesPanel />}
      />

      <LibraryProgressStrip
        memorized={collectionStats.memorized}
        total={collectionStats.total}
        percentMemorized={collectionStats.percentMemorized}
      />

      <LibraryFilters
        filters={filters}
        onChange={setFilters}
        resultCount={entries.length}
        totalCount={verses.length}
      />

      {entries.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<BookOpen className="size-6" aria-hidden="true" />}
            title="No passages match these filters"
            description="Try clearing the search box or widening the filters. The collection itself always contains all 171 passages."
            action={
              <Button
                variant="secondary"
                onClick={() => setFilters(DEFAULT_FILTERS)}
              >
                Clear filters
              </Button>
            }
          />
        </div>
      ) : (
        <div className="space-y-4">
          <LibraryCheckboxHeader />
          {groups.map((group) => (
            <section key={group.section} aria-labelledby={`section-${group.section}`}>
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <h2
                  id={`section-${group.section}`}
                  className="font-serif text-base font-semibold text-ink"
                >
                  {group.section}
                </h2>
                <span className="text-xs text-ink-muted">
                  {group.entries.length} passage
                  {group.entries.length === 1 ? '' : 's'}
                </span>
              </div>

              <ul className="card overflow-hidden">
                {group.entries.map(({ verse, progress }) => (
                  <VerseRow
                    key={verse.id}
                    verse={verse}
                    progress={progress}
                    showSectionLabel={
                      settings.showSectionLabels && filters.sort !== 'canonical'
                    }
                    onToggleMemorized={(verseId, memorized) => {
                      void setMemorized(verseId, memorized).then(() =>
                        notify(
                          memorized
                            ? 'Marked memorized.'
                            : 'Cleared memorized mark.',
                          'success',
                        ),
                      );
                    }}
                    onToggleNeedsReview={(verseId, needsReview) => {
                      void setDifficult(verseId, needsReview).then(() =>
                        notify(
                          needsReview
                            ? 'Marked Needs Review.'
                            : 'Cleared Needs Review.',
                          'success',
                        ),
                      );
                    }}
                    onOpenFlashcards={(verseId) => {
                      navigate(`/flashcards?verse=${verseId}`);
                    }}
                    onReset={(verseId) => setResetVerseId(verseId)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={resetVerseId !== null}
        title={`Reset ${resetTarget?.reference ?? 'this passage'}?`}
        description="Review history and word statistics for this passage are deleted. Memorized and Needs Review marks are kept."
        confirmLabel="Reset passage"
        destructive
        onCancel={() => setResetVerseId(null)}
        onConfirm={() => {
          if (!resetVerseId) return;
          void resetVerse(resetVerseId).then(() => {
            notify('Passage reset.', 'success');
            setResetVerseId(null);
          });
        }}
      />
    </>
  );
}

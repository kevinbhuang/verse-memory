import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { EmptyState, LoadingState } from '@/components/ui/EmptyState';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useToast } from '@/components/ui/Toast';
import { useAllProgress } from '@/hooks/useProgressData';
import { useSettings } from '@/hooks/useSettings';
import { getVerse, verses } from '@/data/verses';
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
import { ProgressChart } from '@/features/library/ProgressChart';
import { VerseRow } from '@/features/library/VerseRow';
import { computeCollectionStats } from '@/services/statsService';

type LibraryView = 'list' | 'chart';

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

function viewFromParams(params: URLSearchParams): LibraryView {
  return params.get('view') === 'chart' ? 'chart' : 'list';
}

export function LibraryPage() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const { settings } = useSettings();
  const progressList = useAllProgress();
  const [searchParams, setSearchParams] = useSearchParams();

  const [filters, setFilters] = useState<LibraryFilterState>(() =>
    filtersFromParams(searchParams),
  );
  const [view, setView] = useState<LibraryView>(() =>
    viewFromParams(searchParams),
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

  const setLibraryView = (next: LibraryView) => {
    setView(next);
    const params = new URLSearchParams(searchParams);
    if (next === 'chart') params.set('view', 'chart');
    else params.delete('view');
    setSearchParams(params, { replace: true });
  };

  if (!progressList || !collectionStats) {
    return <LoadingState label={'Loading the collection\u2026'} />;
  }

  const resetTarget = resetVerseId ? getVerse(resetVerseId) : null;

  const onToggleMemorized = (verseId: string, memorized: boolean) => {
    void setMemorized(verseId, memorized).then(() =>
      notify(
        memorized ? 'Marked memorized.' : 'Cleared memorized mark.',
        'success',
      ),
    );
  };

  const onToggleNeedsReview = (verseId: string, needsReview: boolean) => {
    void setDifficult(verseId, needsReview).then(() =>
      notify(
        needsReview ? 'Marked Needs Review.' : 'Cleared Needs Review.',
        'success',
      ),
    );
  };

  return (
    <>
      <PageHeader title="Library" actions={<PrintVersesPanel />} />

      <div className="mb-3">
        <SegmentedControl
          aria-label="Library view"
          size="sm"
          value={view}
          onChange={setLibraryView}
          options={[
            { value: 'list', label: 'List' },
            { value: 'chart', label: 'Progress Chart' },
          ]}
        />
      </div>

      <LibraryProgressStrip
        memorized={collectionStats.memorized}
        total={collectionStats.total}
        percentMemorized={collectionStats.percentMemorized}
      />

      {view === 'chart' ? (
        <ProgressChart
          progressById={progressById}
          onToggleMemorized={onToggleMemorized}
          onToggleNeedsReview={onToggleNeedsReview}
        />
      ) : (
        <>
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
                <section
                  key={group.section}
                  aria-labelledby={`section-${group.section}`}
                >
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
                          settings.showSectionLabels &&
                          filters.sort !== 'canonical'
                        }
                        onToggleMemorized={onToggleMemorized}
                        onToggleNeedsReview={onToggleNeedsReview}
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
        </>
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

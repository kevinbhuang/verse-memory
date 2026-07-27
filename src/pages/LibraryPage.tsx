import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BookOpen, ListFilter } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { EmptyState, LoadingState } from '@/components/ui/EmptyState';
import { NoteDialog } from '@/components/NoteDialog';
import { useToast } from '@/components/ui/Toast';
import { useAllProgress } from '@/hooks/useProgressData';
import { useSettings } from '@/hooks/useSettings';
import { getVerse, verses } from '@/data/verses';
import { appConfig } from '@/config/app';
import { SECTIONS, VERSE_STATUSES, type Section } from '@/types';
import {
  applyBulkAction,
  resetVerse,
  saveNote,
  setDifficult,
  setMemorized,
  type BulkAction,
} from '@/services/progressService';
import { createSession } from '@/services/sessionService';
import {
  DEFAULT_FILTERS,
  filterLibrary,
  groupBySection,
  type LibraryFilterState,
} from '@/features/library/filters';
import { LibraryFilters } from '@/features/library/LibraryFilters';
import { BulkActionBar } from '@/features/library/BulkActionBar';
import { VerseRow } from '@/features/library/VerseRow';

function filtersFromParams(params: URLSearchParams): LibraryFilterState {
  const section = params.get('section');
  const status = params.get('status');
  const memorized = params.get('memorized');
  const due = params.get('due');

  return {
    ...DEFAULT_FILTERS,
    search: params.get('q') ?? '',
    section:
      section && (SECTIONS as readonly string[]).includes(section)
        ? (section as Section)
        : 'all',
    status:
      status && (VERSE_STATUSES as readonly string[]).includes(status)
        ? (status as LibraryFilterState['status'])
        : 'all',
    memorized:
      memorized === 'memorized' || memorized === 'not-memorized'
        ? memorized
        : 'all',
    difficultOnly: params.get('difficult') === 'true',
    due:
      due === 'due' || due === 'overdue' || due === 'due-or-overdue'
        ? due
        : 'all',
  };
}

export function LibraryPage() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const { settings } = useSettings();
  const progressList = useAllProgress();
  const [searchParams] = useSearchParams();

  // Dashboard and progress tiles deep-link into a pre-filtered library.
  const [filters, setFilters] = useState<LibraryFilterState>(() =>
    filtersFromParams(searchParams),
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [noteVerseId, setNoteVerseId] = useState<string | null>(null);
  const [resetVerseId, setResetVerseId] = useState<string | null>(null);
  const [pendingBulk, setPendingBulk] = useState<BulkAction | null>(null);

  const progressById = useMemo(
    () => new Map((progressList ?? []).map((item) => [item.verseId, item])),
    [progressList],
  );

  const entries = useMemo(
    () => (progressList ? filterLibrary(progressById, filters) : []),
    [progressList, progressById, filters],
  );

  const groups = useMemo(() => groupBySection(entries), [entries]);

  if (!progressList) {
    return <LoadingState label={'Loading the collection\u2026'} />;
  }

  const toggleSelected = (verseId: string, isSelected: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      if (isSelected) next.add(verseId);
      else next.delete(verseId);
      return next;
    });
  };

  const runBulk = async (action: BulkAction) => {
    const ids = [...selected];
    await applyBulkAction(ids, action);
    setSelected(new Set());
    notify(
      `${ids.length} passage${ids.length === 1 ? '' : 's'} updated.`,
      'success',
    );
  };

  const startSessionWith = async (
    verseIds: string[],
    label: string,
    mode: 'first-letter' | 'voice' = 'first-letter',
  ) => {
    const session = await createSession(
      {
        source: 'custom',
        verseIds,
        size: 'all',
        modeStrategy: 'fixed',
        fixedMode: mode,
      },
      label,
    );
    if (!session) {
      notify('Could not start a session with those passages.', 'error');
      return;
    }
    navigate(`/review/session?id=${session.id}`);
  };

  const noteVerse = noteVerseId ? getVerse(noteVerseId) : null;
  const noteProgress = noteVerseId ? progressById.get(noteVerseId) : undefined;
  const resetTarget = resetVerseId ? getVerse(resetVerseId) : null;

  return (
    <>
      <PageHeader
        title="Verse library"
        description={`All ${verses.length} passages of ${appConfig.collectionTitle}, in their original order.`}
        actions={
          <Button
            variant="secondary"
            onClick={() =>
              setFilters((current) => ({
                ...DEFAULT_FILTERS,
                sort: current.sort,
              }))
            }
          >
            <ListFilter className="size-4" aria-hidden="true" />
            Reset filters
          </Button>
        }
      />

      <LibraryFilters
        filters={filters}
        onChange={setFilters}
        resultCount={entries.length}
        totalCount={verses.length}
      />

      <BulkActionBar
        selectedCount={selected.size}
        onAction={(action) => {
          if (action === 'reset-scheduling') {
            setPendingBulk(action);
            return;
          }
          void runBulk(action);
        }}
        onStartSession={() =>
          void startSessionWith(
            [...selected],
            'Selected passages',
            'first-letter',
          )
        }
        onClear={() => setSelected(new Set())}
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
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.section} aria-labelledby={`section-${group.section}`}>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <h2
                  id={`section-${group.section}`}
                  className="font-serif text-lg font-semibold text-ink"
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
                    selected={selected.has(verse.id)}
                    showSectionLabel={
                      settings.showSectionLabels && filters.sort !== 'canonical'
                    }
                    onToggleSelected={toggleSelected}
                    onToggleMemorized={(verseId, memorized) => {
                      void setMemorized(verseId, memorized).then(() =>
                        notify(
                          memorized
                            ? 'Marked memorized. First retention review scheduled for tomorrow.'
                            : 'No longer marked memorized. Review history kept.',
                          'success',
                        ),
                      );
                    }}
                    onToggleDifficult={(verseId, difficult) => {
                      void setDifficult(verseId, difficult);
                    }}
                    onQuickReview={(verseId, mode) => {
                      const target = getVerse(verseId);
                      const modeLabel =
                        mode === 'first-letter' ? 'First letters' : 'Speak';
                      void startSessionWith(
                        [verseId],
                        target
                          ? `${modeLabel} \u2014 ${target.reference}`
                          : modeLabel,
                        mode,
                      );
                    }}
                    onReset={(verseId) => setResetVerseId(verseId)}
                    onEditNote={(verseId) => setNoteVerseId(verseId)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <NoteDialog
        open={noteVerseId !== null}
        reference={noteVerse?.reference ?? ''}
        initialNote={noteProgress?.note ?? ''}
        onClose={() => setNoteVerseId(null)}
        onSave={async (note) => {
          if (!noteVerseId) return;
          await saveNote(noteVerseId, note);
          setNoteVerseId(null);
          notify('Note saved.', 'success');
        }}
      />

      <ConfirmDialog
        open={resetVerseId !== null}
        title={`Reset ${resetTarget?.reference ?? 'this passage'}?`}
        description="Scheduling, review history and word statistics for this passage are deleted. Your note and difficult flag are kept."
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

      <ConfirmDialog
        open={pendingBulk !== null}
        title={`Reset scheduling for ${selected.size} passage${selected.size === 1 ? '' : 's'}?`}
        description="Due dates and intervals are cleared. Review history, notes and flags are kept."
        confirmLabel="Reset scheduling"
        destructive
        onCancel={() => setPendingBulk(null)}
        onConfirm={() => {
          const action = pendingBulk;
          setPendingBulk(null);
          if (action) void runBulk(action);
        }}
      />
    </>
  );
}

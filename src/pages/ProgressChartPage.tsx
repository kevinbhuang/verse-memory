import { useMemo } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { LoadingState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { useAllProgress } from '@/hooks/useProgressData';
import { LibraryProgressStrip } from '@/features/library/LibraryProgressStrip';
import { ProgressChart } from '@/features/library/ProgressChart';
import { setDifficult, setMemorized } from '@/services/progressService';
import { computeCollectionStats } from '@/services/statsService';

/**
 * Standalone progress chart: every passage in a five-column table, with
 * Memorized / Needs Review toggles.
 */
export function ProgressChartPage() {
  const { notify } = useToast();
  const progressList = useAllProgress();

  const progressById = useMemo(
    () => new Map((progressList ?? []).map((item) => [item.verseId, item])),
    [progressList],
  );

  const collectionStats = useMemo(
    () => (progressList ? computeCollectionStats(progressList) : null),
    [progressList],
  );

  if (!progressList || !collectionStats) {
    return <LoadingState label={'Loading the collection\u2026'} />;
  }

  return (
    <>
      <PageHeader
        title="Progress Chart"
        className="mb-2 flex flex-wrap items-end justify-between gap-3"
      />

      <LibraryProgressStrip
        memorized={collectionStats.memorized}
        total={collectionStats.total}
        percentMemorized={collectionStats.percentMemorized}
        className="mb-2"
      />

      <ProgressChart
        progressById={progressById}
        onToggleMemorized={(verseId, memorized) => {
          void setMemorized(verseId, memorized).then(() =>
            notify(
              memorized ? 'Marked memorized.' : 'Cleared memorized mark.',
              'success',
            ),
          );
        }}
        onToggleNeedsReview={(verseId, needsReview) => {
          void setDifficult(verseId, needsReview).then(() =>
            notify(
              needsReview ? 'Marked Needs Review.' : 'Cleared Needs Review.',
              'success',
            ),
          );
        }}
      />
    </>
  );
}

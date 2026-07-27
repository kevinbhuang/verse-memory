import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Keyboard, Mic, RotateCcw } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { EmptyState, LoadingState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { useAllProgress, useOpenSession } from '@/hooks/useProgressData';
import { appConfig } from '@/config/app';
import { verses } from '@/data/verses';
import {
  computeCollectionStats,
  computeSectionProgress,
} from '@/services/statsService';
import {
  createSession,
  SOURCE_LABELS,
  type SessionSource,
} from '@/services/sessionService';
import { formatPercent } from '@/utils/format';
import type { ReviewMode } from '@/types';

/** Prefer passages that need practice; fall back so one tap always does something. */
const PRACTICE_FALLBACKS: SessionSource[] = [
  'due',
  'weak',
  'learning',
  'new',
  'memorized',
];

export function DashboardPage() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const progressList = useAllProgress();
  const openSession = useOpenSession();

  const stats = useMemo(
    () => (progressList ? computeCollectionStats(progressList) : null),
    [progressList],
  );
  const sections = useMemo(
    () => (progressList ? computeSectionProgress(progressList) : []),
    [progressList],
  );

  if (!progressList || !stats) {
    return <LoadingState label={'Loading your progress\u2026'} />;
  }

  const startPractice = async (mode: Extract<ReviewMode, 'first-letter' | 'voice'>) => {
    const modeLabel = mode === 'first-letter' ? 'First letters' : 'Speak';

    for (const source of PRACTICE_FALLBACKS) {
      const session = await createSession(
        {
          source,
          size: source === 'new' ? 1 : 10,
          modeStrategy: 'fixed',
          fixedMode: mode,
        },
        `${modeLabel} \u00b7 ${SOURCE_LABELS[source]}`,
      );
      if (session) {
        navigate(`/review/session?id=${session.id}`);
        return;
      }
    }

    notify('Nothing to practice yet. Open the Library and mark a passage memorized.', 'info');
  };

  return (
    <>
      <PageHeader
        title={appConfig.appName}
        description={`${appConfig.collectionTitle} \u2014 ${appConfig.collectionSubtitle}`}
      />

      <section aria-label="Practice" className="mb-8">
        <p className="mb-3 text-sm text-ink-muted">
          Pick how you want to practice. One tap starts a short session.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => void startPractice('first-letter')}
            className="flex flex-col items-start gap-3 rounded-xl border border-line-strong bg-surface px-5 py-6 text-left shadow-sm transition hover:border-accent hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <span className="flex size-10 items-center justify-center rounded-lg bg-accent-soft text-accent">
              <Keyboard className="size-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block font-serif text-xl font-semibold text-ink">
                First letters
              </span>
              <span className="mt-1 block text-sm text-ink-muted">
                Type the first letter of each word to reveal the passage.
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => void startPractice('voice')}
            className="flex flex-col items-start gap-3 rounded-xl border border-line-strong bg-surface px-5 py-6 text-left shadow-sm transition hover:border-accent hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <span className="flex size-10 items-center justify-center rounded-lg bg-accent-soft text-accent">
              <Mic className="size-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block font-serif text-xl font-semibold text-ink">
                Speak
              </span>
              <span className="mt-1 block text-sm text-ink-muted">
                Recite into your microphone. Grading is approximate.
              </span>
            </span>
          </button>
        </div>

        {openSession ? (
          <div className="mt-3">
            <Button
              variant="quiet"
              size="lg"
              onClick={() => navigate(`/review/session?id=${openSession.id}`)}
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              {`Continue last session (${openSession.currentIndex}/${openSession.verseIds.length})`}
            </Button>
          </div>
        ) : null}
      </section>

      <section aria-label="Summary" className="mb-6">
        <div className="card px-5 py-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-medium tracking-wide text-ink-muted uppercase">
                Memorized passages
              </p>
              <p className="mt-1 font-serif text-3xl font-semibold text-ink tabular-nums">
                {`${stats.memorized} of ${verses.length}`}
              </p>
            </div>
            <p className="text-2xl font-semibold text-accent tabular-nums">
              {formatPercent(stats.percentMemorized, 1)}
            </p>
          </div>
          <ProgressBar
            className="mt-3"
            value={stats.memorized}
            max={verses.length}
            label={`${stats.memorized} of ${verses.length} passages memorized`}
          />
          {stats.difficult > 0 ? (
            <p className="mt-3 text-sm text-ink-muted">
              {`${stats.difficult} marked difficult`}
            </p>
          ) : null}
        </div>
      </section>

      <Card>
        <CardHeader
          title="Progress by section"
          description="The seven divisions of the collection, in order."
        />
        <CardBody className="space-y-3">
          {sections.length === 0 ? (
            <EmptyState
              title="No progress yet"
              description="Open the Library to browse passages, or start practicing above."
            />
          ) : (
            sections.map((section) => (
              <div key={section.section}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-ink">{section.section}</span>
                  <span className="text-ink-muted tabular-nums">
                    {`${section.memorized}/${section.total}`}
                  </span>
                </div>
                <ProgressBar
                  className="mt-1.5"
                  value={section.memorized}
                  max={section.total}
                  label={`${section.section}: ${section.memorized} of ${section.total} memorized`}
                />
              </div>
            ))
          )}
        </CardBody>
      </Card>
    </>
  );
}

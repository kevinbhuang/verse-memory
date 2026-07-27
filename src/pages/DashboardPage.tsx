import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  BookOpenCheck,
  CalendarClock,
  CircleCheck,
  Flag,
  Flame,
  Play,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { StatTile } from '@/components/ui/StatTile';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { EmptyState, LoadingState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import {
  useAllProgress,
  useOpenSession,
  useReviewLogs,
} from '@/hooks/useProgressData';
import { appConfig } from '@/config/app';
import { verses } from '@/data/verses';
import {
  computeCollectionStats,
  computeForecast,
  computeSectionProgress,
  computeStreak,
  recentActivity,
} from '@/services/statsService';
import { createSession, type SessionSource } from '@/services/sessionService';
import {
  MODE_LABELS,
  formatAccuracy,
  formatPercent,
  formatRelativeDay,
  formatTimeAgo,
} from '@/utils/format';

export function DashboardPage() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const progressList = useAllProgress();
  const logs = useReviewLogs();
  const openSession = useOpenSession();

  const stats = useMemo(
    () => (progressList ? computeCollectionStats(progressList) : null),
    [progressList],
  );
  const sections = useMemo(
    () => (progressList ? computeSectionProgress(progressList) : []),
    [progressList],
  );
  const forecast = useMemo(
    () => (progressList ? computeForecast(progressList, 7) : []),
    [progressList],
  );
  const streak = useMemo(() => computeStreak(logs ?? []), [logs]);
  const activity = useMemo(() => recentActivity(logs ?? [], 6), [logs]);

  if (!progressList || !stats) {
    return <LoadingState label={'Loading your progress\u2026'} />;
  }

  const startSession = async (source: SessionSource, label: string) => {
    const session = await createSession(
      {
        source,
        size: source === 'new' ? 1 : 'all',
        modeStrategy: 'automatic',
        fixedMode: null,
      },
      label,
    );
    if (!session) {
      notify(`Nothing to review under "${label}" right now.`, 'info');
      return;
    }
    navigate(`/review/session?id=${session.id}`);
  };

  const maxForecast = Math.max(1, ...forecast.map((day) => day.count));

  return (
    <>
      <PageHeader
        title={appConfig.appName}
        description={`${appConfig.collectionTitle} \u2014 ${appConfig.collectionSubtitle}`}
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <Button
          variant="primary"
          size="lg"
          onClick={() => void startSession('due', 'Due today')}
        >
          <Play className="size-4" aria-hidden="true" />
          {`Review due passages${stats.dueToday + stats.overdue > 0 ? ` (${stats.dueToday + stats.overdue})` : ''}`}
        </Button>
        <Button
          variant="secondary"
          size="lg"
          onClick={() => void startSession('weak', 'Weak passages')}
        >
          <Flag className="size-4" aria-hidden="true" />
          Review difficult passages
        </Button>
        <Button
          variant="secondary"
          size="lg"
          onClick={() => void startSession('new', 'Learn a new passage')}
        >
          <Sparkles className="size-4" aria-hidden="true" />
          Learn a new passage
        </Button>
        {openSession ? (
          <Button
            variant="quiet"
            size="lg"
            onClick={() => navigate(`/review/session?id=${openSession.id}`)}
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            {`Continue last session (${openSession.currentIndex}/${openSession.verseIds.length})`}
          </Button>
        ) : null}
      </div>

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
        </div>
      </section>

      <section
        aria-label="Key numbers"
        className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
      >
        <StatTile
          label="Due today"
          value={stats.dueToday}
          tone={stats.dueToday > 0 ? 'accent' : 'neutral'}
          to="/verses?due=due"
          icon={<CalendarClock className="size-4" aria-hidden="true" />}
        />
        <StatTile
          label="Overdue"
          value={stats.overdue}
          tone={stats.overdue > 0 ? 'danger' : 'neutral'}
          to="/review?source=overdue"
          icon={<AlertTriangle className="size-4" aria-hidden="true" />}
        />
        <StatTile
          label="Difficult"
          value={stats.difficult}
          tone={stats.difficult > 0 ? 'warning' : 'neutral'}
          to="/review?source=difficult"
          icon={<Flag className="size-4" aria-hidden="true" />}
        />
        <StatTile
          label="Reviewed today"
          value={streak.reviewedToday}
          icon={<CircleCheck className="size-4" aria-hidden="true" />}
        />
        <StatTile
          label="Daily streak"
          value={`${streak.current}d`}
          detail={streak.longest > 0 ? `Longest ${streak.longest}d` : undefined}
          icon={<Flame className="size-4" aria-hidden="true" />}
        />
        <StatTile
          label="Last review"
          value={
            streak.lastReviewDate
              ? formatRelativeDay(streak.lastReviewDate)
              : 'Never'
          }
          detail={
            streak.lastReviewDate ? formatTimeAgo(streak.lastReviewDate) : undefined
          }
          icon={<BookOpenCheck className="size-4" aria-hidden="true" />}
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Progress by section"
            description="The seven divisions of the collection, in order."
          />
          <CardBody className="space-y-3">
            {sections.map((section) => (
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
            ))}
          </CardBody>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Next seven days"
              description="Passages falling due, including anything already overdue."
            />
            <CardBody>
              <div className="flex items-end justify-between gap-2">
                {forecast.map((day) => (
                  <div
                    key={day.date.toISOString()}
                    className="flex flex-1 flex-col items-center gap-1"
                  >
                    <span className="text-xs text-ink-muted tabular-nums">
                      {day.count}
                    </span>
                    <div
                      className="w-full rounded-t bg-accent/80"
                      style={{
                        height: `${Math.max(4, (day.count / maxForecast) * 72)}px`,
                      }}
                      aria-hidden="true"
                    />
                    <span className="text-xs text-ink-subtle">{day.label}</span>
                  </div>
                ))}
              </div>
              <p className="sr-only">
                {forecast
                  .map((day) => `${day.label}: ${day.count} passages`)
                  .join(', ')}
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Recent activity"
              action={
                activity.length > 0 ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/progress')}
                  >
                    All statistics
                  </Button>
                ) : null
              }
            />
            <CardBody className="px-0 py-0">
              {activity.length === 0 ? (
                <EmptyState
                  title="No reviews yet"
                  description="Start with a passage you already know to see how the schedule works, or learn a new one."
                  action={
                    <Button
                      variant="secondary"
                      onClick={() => void startSession('new', 'Learn a new passage')}
                    >
                      Learn a new passage
                    </Button>
                  }
                />
              ) : (
                <ul className="divide-y divide-[var(--border-subtle)]">
                  {activity.map((entry) => (
                    <li
                      key={entry.logId}
                      className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-2.5"
                    >
                      <span className="font-serif text-sm text-ink">
                        {entry.reference}
                      </span>
                      <span className="text-xs text-ink-muted">
                        {`${MODE_LABELS[entry.mode]} \u00b7 ${entry.rating}${
                          entry.accuracy !== null
                            ? ` \u00b7 ${formatAccuracy(entry.accuracy)}`
                            : ''
                        } \u00b7 ${formatTimeAgo(entry.reviewedAt)}`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import clsx from 'clsx';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { StatTile } from '@/components/ui/StatTile';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { EmptyState, LoadingState } from '@/components/ui/EmptyState';
import {
  useAllProgress,
  useReviewLogs,
  useWordStats,
} from '@/hooks/useProgressData';
import { verses } from '@/data/verses';
import {
  computeAccuracyTrend,
  computeCollectionStats,
  computeDailyActivity,
  computeForecast,
  computeSectionProgress,
  computeStreak,
  mostDifficultVerses,
  mostMissedWords,
  recentlyMastered,
  totalReviewTimeMs,
} from '@/services/statsService';
import {
  formatAccuracy,
  formatDate,
  formatDuration,
  formatPercent,
} from '@/utils/format';

/**
 * Bars are sized in pixels rather than percentages: a percentage height would
 * resolve against an auto-height flex item and collapse to nothing.
 */
const CHART_HEIGHT_PX = 104;

export function ProgressPage() {
  const progressList = useAllProgress();
  const logs = useReviewLogs();
  const wordStats = useWordStats();

  const stats = useMemo(
    () => (progressList ? computeCollectionStats(progressList) : null),
    [progressList],
  );
  const sections = useMemo(
    () => (progressList ? computeSectionProgress(progressList) : []),
    [progressList],
  );
  const activity = useMemo(
    () => computeDailyActivity(logs ?? [], 91),
    [logs],
  );
  const trend = useMemo(() => computeAccuracyTrend(logs ?? [], 14), [logs]);
  const streak = useMemo(() => computeStreak(logs ?? []), [logs]);
  const forecast = useMemo(
    () => (progressList ? computeForecast(progressList, 14) : []),
    [progressList],
  );
  const difficult = useMemo(
    () => (progressList ? mostDifficultVerses(progressList, 8) : []),
    [progressList],
  );
  const missedWords = useMemo(
    () => mostMissedWords(wordStats ?? [], 12),
    [wordStats],
  );
  const mastered = useMemo(
    () => (progressList ? recentlyMastered(progressList, 6) : []),
    [progressList],
  );

  if (!progressList || !stats || logs === undefined || wordStats === undefined) {
    return <LoadingState />;
  }

  const reviewTime = totalReviewTimeMs(logs);
  const maxDaily = Math.max(1, ...activity.map((day) => day.reviews));
  const maxForecast = Math.max(1, ...forecast.map((day) => day.count));

  return (
    <>
      <PageHeader
        title="Progress"
        description="Every figure here links to a review session or a filtered view of the library."
      />

      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile
          label="Memorized"
          value={stats.memorized}
          detail={formatPercent(stats.percentMemorized, 1)}
          to="/verses?memorized=memorized"
          tone="success"
        />
        <StatTile
          label="Learning"
          value={stats.learning}
          to="/verses?status=learning"
          tone="accent"
        />
        <StatTile label="Not started" value={stats.newCount} to="/verses?status=new" />
        <StatTile
          label="Current"
          value={stats.current}
          detail={`${formatPercent(stats.percentCurrent, 0)} of memorized`}
        />
        <StatTile
          label="Overdue"
          value={stats.overdue}
          tone={stats.overdue > 0 ? 'danger' : 'neutral'}
          to="/review?source=overdue"
        />
        <StatTile
          label="Difficult"
          value={stats.difficult}
          tone={stats.difficult > 0 ? 'warning' : 'neutral'}
          to="/review?source=difficult"
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="By section"
            description="Passages memorized within each division of the collection."
          />
          <CardBody className="space-y-3">
            {sections.map((section) => (
              <div key={section.section}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <Link
                    to={`/verses?section=${encodeURIComponent(section.section)}`}
                    className="text-ink hover:text-accent hover:underline"
                  >
                    {section.section}
                  </Link>
                  <span className="text-ink-muted tabular-nums">
                    {`${section.memorized}/${section.total} \u00b7 ${section.due} due`}
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

        <Card>
          <CardHeader
            title="Review activity"
            description="Reviews completed each day over the last thirteen weeks."
          />
          <CardBody>
            {logs.length === 0 ? (
              <EmptyState
                title="No review history yet"
                description="Complete a review session and this calendar will start filling in."
              />
            ) : (
              <>
                <div
                  className="grid grid-flow-col grid-rows-7 gap-1"
                  role="img"
                  aria-label={`Review activity calendar: ${logs.length} reviews over the last 13 weeks`}
                >
                  {activity.map((day) => {
                    const intensity =
                      day.reviews === 0
                        ? 0
                        : Math.min(
                            3,
                            Math.ceil((day.reviews / maxDaily) * 3),
                          );
                    return (
                      <div
                        key={day.key}
                        title={`${format(day.date, 'd MMM yyyy')}: ${day.reviews} review${day.reviews === 1 ? '' : 's'}`}
                        className={clsx(
                          'size-3 rounded-[3px] border border-line',
                          intensity === 0 && 'bg-surface-muted',
                          intensity === 1 && 'bg-accent/30',
                          intensity === 2 && 'bg-accent/60',
                          intensity === 3 && 'bg-accent',
                        )}
                      />
                    );
                  })}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
                  <span>{`${logs.length} reviews total`}</span>
                  <span>{`${formatDuration(reviewTime)} spent reviewing`}</span>
                  <span>{`Current streak ${streak.current} day${streak.current === 1 ? '' : 's'}`}</span>
                  <span>{`Longest ${streak.longest} day${streak.longest === 1 ? '' : 's'}`}</span>
                </div>
              </>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Accuracy trend"
            description="Average graded accuracy per day over the last fortnight."
          />
          <CardBody>
            {trend.length === 0 ? (
              <EmptyState
                title="No graded reviews yet"
                description="First-letter, typing and reference reviews produce an accuracy score."
              />
            ) : (
              <>
                <div className="flex items-end gap-1.5">
                  {trend.map((point) => (
                    <div
                      key={point.date.toISOString()}
                      className="flex flex-1 flex-col items-center gap-1"
                      title={`${point.label}: ${formatAccuracy(point.accuracy)}`}
                    >
                      <div
                        className="w-full rounded-t bg-accent/80"
                        style={{
                          height: `${Math.max(4, point.accuracy * CHART_HEIGHT_PX)}px`,
                        }}
                        aria-hidden="true"
                      />
                      <span className="text-[0.625rem] text-ink-subtle">
                        {point.label.split(' ')[1]}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="sr-only">
                  {trend
                    .map(
                      (point) =>
                        `${point.label}: ${formatAccuracy(point.accuracy)}`,
                    )
                    .join(', ')}
                </p>
              </>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Upcoming review load"
            description="Passages due over the next fortnight."
          />
          <CardBody>
            <div className="flex items-end gap-1">
              {forecast.map((day) => (
                <div
                  key={day.date.toISOString()}
                  className="flex flex-1 flex-col items-center gap-1"
                  title={`${format(day.date, 'd MMM')}: ${day.count} due`}
                >
                  <span className="text-[0.625rem] text-ink-muted tabular-nums">
                    {day.count > 0 ? day.count : ''}
                  </span>
                  <div
                    className="w-full rounded-t bg-accent/70"
                    style={{
                      height: `${Math.max(3, (day.count / maxForecast) * CHART_HEIGHT_PX)}px`,
                    }}
                    aria-hidden="true"
                  />
                  <span className="text-[0.625rem] text-ink-subtle">
                    {format(day.date, 'd')}
                  </span>
                </div>
              ))}
            </div>
            <p className="sr-only">
              {forecast
                .map(
                  (day) => `${format(day.date, 'd MMM')}: ${day.count} passages`,
                )
                .join(', ')}
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Most difficult passages"
            action={
              <Link
                to="/review?source=weak"
                className="text-sm text-accent underline"
              >
                Review these
              </Link>
            }
          />
          <CardBody className="px-0 py-0">
            {difficult.length === 0 ? (
              <EmptyState
                title="Nothing is flagged as difficult"
                description="Difficulty is calculated from your own review results, so this fills in as you practise."
              />
            ) : (
              <ul className="divide-y divide-[var(--border-subtle)]">
                {difficult.map((entry) => (
                  <li
                    key={entry.verseId}
                    className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-2.5"
                  >
                    <Link
                      to={`/verses/${entry.verseId}`}
                      className="font-serif text-sm text-ink hover:text-accent hover:underline"
                    >
                      {entry.reference}
                    </Link>
                    <span className="text-xs text-ink-muted">
                      {`score ${entry.score}${entry.lapses > 0 ? ` \u00b7 ${entry.lapses} lapse${entry.lapses === 1 ? '' : 's'}` : ''}${
                        entry.reasons.length > 0
                          ? ` \u00b7 ${entry.reasons.slice(0, 2).join(', ')}`
                          : ''
                      }`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Most frequently missed words"
            description="Tracked by position within each passage."
          />
          <CardBody className="px-0 py-0">
            {missedWords.length === 0 ? (
              <EmptyState
                title="No word-level mistakes recorded"
                description="First-letter and typing reviews record which words trip you up."
              />
            ) : (
              <ul className="divide-y divide-[var(--border-subtle)]">
                {missedWords.map((entry) => (
                  <li
                    key={entry.key}
                    className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-2"
                  >
                    <span className="font-serif text-sm text-ink">
                      {entry.word}
                    </span>
                    <span className="text-xs text-ink-muted">
                      <Link
                        to={`/verses/${entry.verseId}`}
                        className="hover:underline"
                      >
                        {entry.reference}
                      </Link>
                      {` \u00b7 word ${entry.wordIndex + 1} \u00b7 ${entry.misses} miss${entry.misses === 1 ? '' : 'es'} \u00b7 ${Math.round(entry.successRate * 100)}% correct`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Recently mastered" />
          <CardBody className="px-0 py-0">
            {mastered.length === 0 ? (
              <EmptyState
                title="Nothing marked memorized yet"
                description={`Tick the checkbox beside a passage in the library once you can recite it. There are ${verses.length} to work through.`}
              />
            ) : (
              <ul className="divide-y divide-[var(--border-subtle)]">
                {mastered.map((entry) => (
                  <li
                    key={entry.verseId}
                    className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-2.5"
                  >
                    <Link
                      to={`/verses/${entry.verseId}`}
                      className="font-serif text-sm text-ink hover:text-accent hover:underline"
                    >
                      {entry.reference}
                    </Link>
                    <span className="text-xs text-ink-muted">
                      {formatDate(entry.memorizedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}

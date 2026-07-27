import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BadgeCheck,
  BadgeX,
  Flag,
  Keyboard,
  RotateCcw,
} from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { LoadingState } from '@/components/ui/EmptyState';
import { ScriptureText } from '@/components/ScriptureText';
import { useToast } from '@/components/ui/Toast';
import {
  DifficultBadge,
  DueBadge,
  StatusBadge,
} from '@/components/VerseBadges';
import { useReviewLogs, useVerseProgress } from '@/hooks/useProgressData';
import { useSettings } from '@/hooks/useSettings';
import { getVerse, verses } from '@/data/verses';
import {
  resetVerse,
  setDifficult,
  setMemorized,
} from '@/services/progressService';
import { createSession } from '@/services/sessionService';
import {
  MODE_LABELS,
  formatAccuracy,
  formatDate,
  formatInterval,
  formatRelativeDay,
} from '@/utils/format';

export function VerseDetailPage() {
  const { verseId } = useParams<{ verseId: string }>();
  const navigate = useNavigate();
  const { notify } = useToast();
  const { settings } = useSettings();

  const verse = verseId ? getVerse(verseId) : undefined;
  const progress = useVerseProgress(verseId);
  const logs = useReviewLogs(verseId);

  const [confirmReset, setConfirmReset] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  if (!verse) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h1 className="font-serif text-xl font-semibold text-ink">
          Passage not found
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          {`The collection contains passages 1 to ${verses.length}.`}
        </p>
        <ButtonLink to="/verses" variant="primary" className="mt-4">
          Back to the library
        </ButtonLink>
      </div>
    );
  }

  if (!progress || logs === undefined) {
    return <LoadingState />;
  }

  const practice = async () => {
    const session = await createSession(
      {
        source: 'custom',
        verseIds: [verse.id],
        size: 'all',
        modeStrategy: 'fixed',
        fixedMode: 'first-letter',
      },
      `Practice \u2014 ${verse.reference}`,
    );
    if (session) navigate(`/review/session?id=${session.id}`);
  };

  const previous = verses[verse.order - 2];
  const next = verses[verse.order];

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          to="/verses"
          className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Library
        </Link>
        <div className="flex gap-2 text-sm">
          {previous ? (
            <Link
              to={`/verses/${previous.id}`}
              className="text-ink-muted hover:text-ink"
            >
              {`\u2190 ${previous.reference}`}
            </Link>
          ) : null}
          {next ? (
            <Link
              to={`/verses/${next.id}`}
              className="text-ink-muted hover:text-ink"
            >
              {`${next.reference} \u2192`}
            </Link>
          ) : null}
        </div>
      </div>

      <header className="mb-5">
        <p className="font-mono text-xs text-ink-subtle tabular-nums">
          {`Passage ${String(verse.order).padStart(3, '0')} of ${verses.length}`}
        </p>
        <h1 className="mt-1 font-serif text-3xl font-semibold text-ink">
          {verse.reference}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <StatusBadge status={progress.status} />
          <DueBadge progress={progress} />
          <DifficultBadge progress={progress} />
          <span className="text-xs text-ink-muted">{verse.section}</span>
          <span className="text-xs text-ink-muted">{verse.translation}</span>
          {settings.showVerificationStatus ? (
            <span className="inline-flex items-center gap-1 text-xs text-ink-subtle">
              {verse.verified ? (
                <>
                  <BadgeCheck className="size-3.5" aria-hidden="true" />
                  {`ESV verified ${formatDate(verse.verificationDate)}`}
                </>
              ) : (
                <>
                  <BadgeX className="size-3.5" aria-hidden="true" />
                  Not yet ESV-verified
                </>
              )}
            </span>
          ) : null}
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-5">
          <Card>
            <CardBody className="px-6 py-6">
              <ScriptureText text={verse.text} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Review history"
              description={`${logs.length} recorded review${logs.length === 1 ? '' : 's'}.`}
            />
            <CardBody className="px-0 py-0">
              {logs.length === 0 ? (
                <p className="px-5 py-6 text-sm text-ink-muted">
                  No reviews recorded yet.
                </p>
              ) : (
                <ul className="divide-y divide-[var(--border-subtle)]">
                  {logs.slice(0, 25).map((log) => (
                    <li
                      key={log.id}
                      className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-2.5 text-sm"
                    >
                      <span className="text-ink">
                        {formatDate(log.reviewedAt)}
                      </span>
                      <span className="text-xs text-ink-muted">
                        {`${MODE_LABELS[log.mode]} \u00b7 ${log.rating}${
                          log.accuracy !== null
                            ? ` \u00b7 ${formatAccuracy(log.accuracy)}`
                            : ''
                        } \u00b7 next in ${formatInterval(log.nextIntervalDays)}`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <aside className="space-y-5">
          <Card>
            <CardHeader title="Actions" />
            <CardBody className="space-y-2">
              <Button
                variant="primary"
                className="w-full"
                onClick={() => void practice()}
              >
                <Keyboard className="size-4" aria-hidden="true" />
                Practice
              </Button>

              <Button
                variant={progress.isMemorized ? 'quiet' : 'secondary'}
                className="w-full"
                onClick={() =>
                  void setMemorized(verse.id, !progress.isMemorized).then(() =>
                    notify(
                      progress.isMemorized
                        ? 'No longer marked memorized. History kept.'
                        : 'Marked memorized. First retention review scheduled.',
                      'success',
                    ),
                  )
                }
              >
                {progress.isMemorized
                  ? 'Unmark as memorized'
                  : 'Mark as memorized'}
              </Button>

              <Button
                variant={progress.isDifficult ? 'quiet' : 'secondary'}
                className="w-full"
                onClick={() => void setDifficult(verse.id, !progress.isDifficult)}
              >
                <Flag className="size-4" aria-hidden="true" />
                {progress.isDifficult ? 'Remove difficult flag' : 'Mark difficult'}
              </Button>

              <Button
                variant="danger"
                className="w-full"
                onClick={() => setConfirmReset(true)}
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                Reset progress for this passage
              </Button>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Schedule" />
            <CardBody className="space-y-1.5 text-sm">
              <Row
                label="Next due"
                value={formatRelativeDay(progress.nextDueAt)}
              />
              <Row
                label="Interval"
                value={
                  progress.intervalDays > 0
                    ? formatInterval(progress.intervalDays)
                    : 'Not scheduled'
                }
              />
              <Row label="Reviews" value={String(progress.reviewCount)} />
            </CardBody>
          </Card>

          <button
            type="button"
            className="text-sm text-accent hover:underline"
            onClick={() => setShowDetails((open) => !open)}
          >
            {showDetails ? 'Hide details' : 'Show details'}
          </button>

          {showDetails ? (
            <Card>
              <CardHeader title="More schedule detail" />
              <CardBody className="space-y-1.5 text-sm">
                <Row
                  label="Last reviewed"
                  value={formatRelativeDay(progress.lastReviewedAt)}
                />
                <Row label="Successful" value={String(progress.successCount)} />
                <Row label="Failed" value={String(progress.lapseCount)} />
                <Row
                  label="Most recent result"
                  value={progress.lastRating ?? 'None yet'}
                />
              </CardBody>
            </Card>
          ) : null}
        </aside>
      </div>

      <ConfirmDialog
        open={confirmReset}
        title={`Reset ${verse.reference}?`}
        description="Scheduling, review history and word statistics for this passage are deleted. The difficult flag is kept."
        confirmLabel="Reset passage"
        destructive
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          void resetVerse(verse.id).then(() => {
            setConfirmReset(false);
            notify('Passage reset.', 'success');
          });
        }}
      />
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right text-ink">{value}</dd>
    </div>
  );
}

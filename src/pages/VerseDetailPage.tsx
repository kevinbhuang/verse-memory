import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BadgeCheck,
  BadgeX,
  Flag,
  NotebookPen,
  Pin,
  Play,
  RotateCcw,
} from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { Field, Select, TextInput } from '@/components/ui/Field';
import { LoadingState } from '@/components/ui/EmptyState';
import { NoteDialog } from '@/components/NoteDialog';
import { ScriptureText } from '@/components/ScriptureText';
import { useToast } from '@/components/ui/Toast';
import {
  DifficultBadge,
  DueBadge,
  PinnedBadge,
  StatusBadge,
} from '@/components/VerseBadges';
import {
  useReviewLogs,
  useVerseProgress,
  useWordStats,
} from '@/hooks/useProgressData';
import { useSettings } from '@/hooks/useSettings';
import { getVerse, verses } from '@/data/verses';
import { heatLevel } from '@/lib/weakWords';
import { recommendationReason } from '@/lib/scheduler';
import {
  resetVerse,
  saveNote,
  setCustomMaximumInterval,
  setDifficult,
  setDueDate,
  setMemorized,
  setPinnedFrequency,
  setProblemCategories,
} from '@/services/progressService';
import { createSession } from '@/services/sessionService';
import { PROBLEM_CATEGORIES, type ProblemCategory } from '@/types';
import {
  MODE_LABELS,
  formatAccuracy,
  formatDate,
  formatDuration,
  formatInterval,
  formatRelativeDay,
} from '@/utils/format';
import { WhyDifficultPanel } from '@/features/verse/WhyDifficultPanel';
import { WeakWordsPanel } from '@/features/verse/WeakWordsPanel';

const PROBLEM_LABELS: Record<ProblemCategory, string> = {
  'exact-wording': 'Exact wording',
  'verse-order': 'Verse order',
  reference: 'Reference',
  'similar-to-another-verse': 'Similar to another verse',
  'long-passage': 'Long passage',
  punctuation: 'Punctuation',
  'frequently-forgotten-phrase': 'Frequently forgotten phrase',
  other: 'Other',
};

const PIN_OPTIONS = [
  { value: '', label: 'Not pinned' },
  { value: '1', label: 'Daily' },
  { value: '7', label: 'Weekly' },
  { value: '30', label: 'Monthly' },
  { value: '90', label: 'Quarterly' },
  { value: '182', label: 'Twice a year' },
  { value: '365', label: 'Annually' },
];

export function VerseDetailPage() {
  const { verseId } = useParams<{ verseId: string }>();
  const navigate = useNavigate();
  const { notify } = useToast();
  const { settings } = useSettings();

  const verse = verseId ? getVerse(verseId) : undefined;
  const progress = useVerseProgress(verseId);
  const logs = useReviewLogs(verseId);
  const wordStats = useWordStats(verseId);

  const [noteOpen, setNoteOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const heat = useMemo(() => {
    const map = new Map<number, ReturnType<typeof heatLevel>>();
    for (const stat of wordStats ?? []) {
      const level = heatLevel(stat);
      if (level > 0) map.set(stat.wordIndex, level);
    }
    return map;
  }, [wordStats]);

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

  if (!progress || logs === undefined || wordStats === undefined) {
    return <LoadingState />;
  }

  const successRatePercent =
    progress.reviewCount === 0
      ? null
      : Math.round((progress.successCount / progress.reviewCount) * 100);

  const averageResponseMs =
    logs.length === 0
      ? 0
      : logs.reduce((sum, log) => sum + log.elapsedMs, 0) / logs.length;

  const practice = async () => {
    const session = await createSession(
      {
        source: 'custom',
        verseIds: [verse.id],
        size: 'all',
        modeStrategy: 'automatic',
        fixedMode: null,
      },
      `Practice \u2014 ${verse.reference}`,
    );
    if (session) navigate(`/review/session?id=${session.id}`);
  };

  const toggleCategory = (category: ProblemCategory) => {
    const next = progress.problemCategories.includes(category)
      ? progress.problemCategories.filter((item) => item !== category)
      : [...progress.problemCategories, category];
    void setProblemCategories(verse.id, next);
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
          <PinnedBadge progress={progress} />
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
              <ScriptureText text={verse.text} heat={heat} />
              {heat.size > 0 ? (
                <p className="mt-4 text-xs text-ink-subtle">
                  Shaded words are the ones you have missed most often.
                </p>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Personal note"
              action={
                <Button size="sm" variant="secondary" onClick={() => setNoteOpen(true)}>
                  <NotebookPen className="size-3.5" aria-hidden="true" />
                  {progress.note.trim() === '' ? 'Add note' : 'Edit'}
                </Button>
              }
            />
            <CardBody>
              {progress.note.trim() === '' ? (
                <p className="text-sm text-ink-muted">
                  No note yet. Notes are private and never change the passage
                  text.
                </p>
              ) : (
                <p className="text-sm whitespace-pre-wrap text-ink">
                  {progress.note}
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Why this is difficult" />
            <CardBody>
              <WhyDifficultPanel
                progress={progress}
                logs={logs}
                wordStats={wordStats}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Weak words"
              description="Tracked by position, so repeated mistakes on the same word are visible."
            />
            <CardBody>
              <WeakWordsPanel verse={verse} wordStats={wordStats} />
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
                        } \u00b7 ${log.hintCount} hint${log.hintCount === 1 ? '' : 's'} \u00b7 next in ${formatInterval(log.nextIntervalDays)}`}
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
                <Play className="size-4" aria-hidden="true" />
                Practise this passage
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
            <CardHeader title="Scheduling" />
            <CardBody className="space-y-3 text-sm">
              <dl className="space-y-1.5">
                <Row label="Status" value={progress.status} />
                <Row
                  label="Current interval"
                  value={
                    progress.intervalDays > 0
                      ? formatInterval(progress.intervalDays)
                      : 'Not scheduled'
                  }
                />
                <Row
                  label="Next due"
                  value={formatRelativeDay(progress.nextDueAt)}
                />
                <Row
                  label="Last reviewed"
                  value={formatRelativeDay(progress.lastReviewedAt)}
                />
                <Row label="Reviews" value={String(progress.reviewCount)} />
                <Row
                  label="Successful"
                  value={
                    successRatePercent === null
                      ? String(progress.successCount)
                      : `${progress.successCount} (${successRatePercent}%)`
                  }
                />
                <Row label="Failed" value={String(progress.lapseCount)} />
                <Row
                  label="Average response"
                  value={formatDuration(averageResponseMs)}
                />
                <Row
                  label="Most recent result"
                  value={progress.lastRating ?? 'None yet'}
                />
              </dl>

              <p className="rounded-md bg-surface-muted px-3 py-2 text-xs text-ink-muted">
                {`Recommended because: ${recommendationReason(progress)}`}
              </p>

              <Field label="Pin for frequent review" htmlFor="pin-frequency">
                <Select
                  id="pin-frequency"
                  value={
                    progress.pinnedFrequencyDays === null
                      ? ''
                      : String(progress.pinnedFrequencyDays)
                  }
                  onChange={(event) =>
                    void setPinnedFrequency(
                      verse.id,
                      event.target.value === ''
                        ? null
                        : Number(event.target.value),
                    )
                  }
                >
                  {PIN_OPTIONS.map((option) => (
                    <option key={option.label} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label="Maximum interval for this passage"
                htmlFor="max-interval"
                hint="Leave empty to use the global maximum from settings."
              >
                <TextInput
                  id="max-interval"
                  type="number"
                  min={1}
                  max={3650}
                  value={progress.customMaximumIntervalDays ?? ''}
                  onChange={(event) =>
                    void setCustomMaximumInterval(
                      verse.id,
                      event.target.value === ''
                        ? null
                        : Number(event.target.value),
                    )
                  }
                />
              </Field>

              <Field label="Override the due date" htmlFor="due-override">
                <TextInput
                  id="due-override"
                  type="date"
                  value={
                    progress.nextDueAt
                      ? progress.nextDueAt.slice(0, 10)
                      : ''
                  }
                  onChange={(event) => {
                    if (!event.target.value) return;
                    void setDueDate(
                      verse.id,
                      new Date(`${event.target.value}T00:00:00`),
                    );
                  }}
                />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Problem categories"
              description="Your own labels for why this passage is hard."
            />
            <CardBody className="flex flex-wrap gap-1.5">
              {PROBLEM_CATEGORIES.map((category) => {
                const active = progress.problemCategories.includes(category);
                return (
                  <button
                    key={category}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleCategory(category)}
                    className={`rounded-md border px-2 py-1 text-xs ${
                      active
                        ? 'border-accent bg-accent-soft text-accent'
                        : 'border-line-strong bg-surface text-ink-muted hover:bg-surface-muted'
                    }`}
                  >
                    {PROBLEM_LABELS[category]}
                  </button>
                );
              })}
            </CardBody>
          </Card>

          {progress.isPinned ? (
            <p className="flex items-center gap-1.5 text-xs text-ink-muted">
              <Pin className="size-3.5" aria-hidden="true" />
              Pinned passages keep a fixed review cadence.
            </p>
          ) : null}
        </aside>
      </div>

      <NoteDialog
        open={noteOpen}
        reference={verse.reference}
        initialNote={progress.note}
        onClose={() => setNoteOpen(false)}
        onSave={async (note) => {
          await saveNote(verse.id, note);
          setNoteOpen(false);
          notify('Note saved.', 'success');
        }}
      />

      <ConfirmDialog
        open={confirmReset}
        title={`Reset ${verse.reference}?`}
        description="Scheduling, review history and word statistics for this passage are deleted. Your note and difficult flag are kept."
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

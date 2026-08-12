import { useLiveQuery } from 'dexie-react-hooks';
import { CheckCircle2 } from 'lucide-react';
import { getDatabase } from '@/db/db';
import { ButtonLink } from '@/components/ui/Button';
import { getVerse } from '@/data/verses';
import { MODE_LABELS, formatAccuracy, formatDuration } from '@/utils/format';
import type { ReviewSession } from '@/types';

export function SessionSummary({
  session,
  returnTo = '/quiz',
}: {
  session: ReviewSession;
  returnTo?: string;
}) {
  const logs = useLiveQuery(
    async () => getDatabase().reviewLogs.bulkGet(session.results),
    [session.results.join(',')],
  );

  const completed = (logs ?? []).filter(Boolean);
  const graded = completed.filter((log) => log?.accuracy !== null);
  const averageAccuracy =
    graded.length > 0
      ? graded.reduce((sum, log) => sum + (log?.accuracy ?? 0), 0) / graded.length
      : null;
  const totalTime = completed.reduce((sum, log) => sum + (log?.elapsedMs ?? 0), 0);
  const backLabel = returnTo.startsWith('/flashcards')
    ? 'Back to flash cards'
    : returnTo.startsWith('/quiz')
      ? 'Back to quiz'
      : 'Back';

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="text-center">
        <CheckCircle2
          className="mx-auto size-8 text-success"
          aria-hidden="true"
        />
        <h1 className="mt-3 font-serif text-2xl font-semibold text-ink">
          Session complete
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {`${completed.length} passage${completed.length === 1 ? '' : 's'} practiced \u00b7 ${formatDuration(totalTime)}${
            averageAccuracy !== null
              ? ` \u00b7 ${formatAccuracy(averageAccuracy)} average accuracy`
              : ''
          }`}
        </p>
      </div>

      <ul className="card mt-6 divide-y divide-[var(--border-subtle)]">
        {completed.map((log) =>
          log ? (
            <li
              key={log.id}
              className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="font-serif text-sm font-semibold text-ink">
                  {getVerse(log.verseId)?.reference ?? log.verseId}
                </p>
                <p className="text-xs text-ink-muted">
                  {`${MODE_LABELS[log.mode]}${
                    log.accuracy !== null
                      ? ` \u00b7 ${formatAccuracy(log.accuracy)}`
                      : ''
                  }`}
                </p>
              </div>
              <p className="text-xs text-ink-subtle">
                {formatDuration(log.elapsedMs)}
              </p>
            </li>
          ) : null,
        )}
      </ul>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <ButtonLink to={returnTo} variant="primary">
          {backLabel}
        </ButtonLink>
        <ButtonLink to="/verses" variant="secondary">
          Library
        </ButtonLink>
        <ButtonLink to="/more" variant="ghost">
          More
        </ButtonLink>
      </div>
    </div>
  );
}

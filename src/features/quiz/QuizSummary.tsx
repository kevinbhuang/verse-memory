import { ButtonLink } from '@/components/ui/Button';
import { getVerse } from '@/data/verses';
import { quizScore } from '@/services/quizService';
import type { QuizSession } from '@/types/quiz';
import { QUIZ_MODE_LABELS } from '@/types/quiz';
import { formatAccuracy } from '@/utils/format';

export function QuizSummary({ session }: { session: QuizSession }) {
  const score = quizScore(session);

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <h1 className="font-serif text-3xl font-semibold text-ink">Quiz complete</h1>
      <p className="mt-2 text-sm text-ink-muted">{session.label}</p>

      <div className="mt-8 rounded-xl border border-line bg-surface px-5 py-6 text-center">
        <p className="text-xs font-medium tracking-wide text-ink-subtle uppercase">
          Score
        </p>
        <p className="mt-2 font-serif text-4xl font-semibold text-ink tabular-nums">
          {score.correct}/{score.total}
        </p>
        <p className="mt-1 text-sm text-ink-muted">
          {formatAccuracy(score.accuracy)} · {QUIZ_MODE_LABELS[session.mode]}
        </p>
      </div>

      <ul className="mt-6 divide-y divide-line rounded-xl border border-line bg-surface">
        {session.answers.map((answer) => {
          const verse = getVerse(answer.verseId);
          return (
            <li
              key={`${answer.verseId}-${answer.elapsedMs}`}
              className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
            >
              <span className="min-w-0 truncate font-medium text-ink">
                {verse?.reference ?? answer.verseId}
              </span>
              <span
                className={
                  answer.correct ? 'text-success' : 'text-danger'
                }
              >
                {answer.correct ? 'Correct' : 'Missed'}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-8 flex flex-wrap gap-2">
        <ButtonLink to="/quiz" variant="primary">
          Quiz again
        </ButtonLink>
        <ButtonLink to="/verses" variant="secondary">
          Library
        </ButtonLink>
      </div>
    </div>
  );
}

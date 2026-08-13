import { ButtonLink } from '@/components/ui/Button';
import { getVerse } from '@/data/verses';
import { tokenize } from '@/lib/text/tokenize';
import { quizScore } from '@/services/quizService';
import type { QuizSession } from '@/types/quiz';
import { QUIZ_MODE_LABELS } from '@/types/quiz';
import { formatAccuracy } from '@/utils/format';

function firstThreeWords(text: string): string {
  return tokenize(text)
    .slice(0, 3)
    .map((token) => token.text)
    .join(' ');
}

export function QuizSummary({ session }: { session: QuizSession }) {
  const score = quizScore(session);
  const againTo = session.returnPath?.trim() || '/quiz';
  const isCustom = Boolean(session.verseSnapshots);
  const showFirstWords = session.mode === 'first-words';

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
          const snapshot = session.verseSnapshots?.[answer.verseId];
          const verse = snapshot
            ? null
            : getVerse(answer.verseId);
          const reference =
            snapshot?.reference ?? verse?.reference ?? answer.verseId;
          const text = snapshot?.text ?? verse?.text ?? '';
          const answerLabel =
            showFirstWords && text ? firstThreeWords(text) : null;
          return (
            <li
              key={`${answer.verseId}-${answer.elapsedMs}`}
              className="flex items-start justify-between gap-3 px-4 py-3 text-sm"
            >
              <span className="min-w-0">
                <span className="block font-medium text-ink">{reference}</span>
                {answerLabel ? (
                  <span className="mt-0.5 block text-ink-muted">
                    {answerLabel}
                  </span>
                ) : null}
              </span>
              <span
                className={
                  answer.correct
                    ? 'shrink-0 text-success'
                    : 'shrink-0 text-danger'
                }
              >
                {answer.correct ? 'Correct' : 'Missed'}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-8 flex flex-wrap gap-2">
        <ButtonLink to={againTo} variant="primary">
          Quiz again
        </ButtonLink>
        {isCustom ? (
          <ButtonLink to={againTo} variant="secondary">
            Back to My Verses
          </ButtonLink>
        ) : (
          <ButtonLink to="/verses" variant="secondary">
            Library
          </ButtonLink>
        )}
      </div>
    </div>
  );
}

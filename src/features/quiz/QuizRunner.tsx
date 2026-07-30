import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/EmptyState';
import { useHotkeys } from '@/hooks/useHotkeys';
import { getVerse } from '@/data/verses';
import {
  discardQuizSession,
  getQuizSession,
  quizScore,
  recordQuizAnswer,
} from '@/services/quizService';
import type { QuizMode, QuizSession } from '@/types/quiz';
import { QUIZ_MODE_LABELS } from '@/types/quiz';
import { formatAccuracy } from '@/utils/format';
import type { QuizModeProps, QuizModeResult } from './quizModeTypes';
import { QuizReferenceMode } from './modes/QuizReferenceMode';
import { QuizFirstWordsMode } from './modes/QuizFirstWordsMode';
import { QuizFirstLetterMode } from './modes/QuizFirstLetterMode';
import { QuizFillBlankMode } from './modes/QuizFillBlankMode';
import { QuizSummary } from './QuizSummary';

const MODE_COMPONENTS: Record<QuizMode, ComponentType<QuizModeProps>> = {
  reference: QuizReferenceMode,
  'first-words': QuizFirstWordsMode,
  'first-letter': QuizFirstLetterMode,
  'fill-blank': QuizFillBlankMode,
};

export function QuizRunner({ quizId }: { quizId: string }) {
  const navigate = useNavigate();
  const [session, setSession] = useState<QuizSession | null | undefined>(undefined);
  const [pendingResult, setPendingResult] = useState<QuizModeResult | null>(null);
  /** Blocks Enter-to-advance until the key is released after checking an answer. */
  const enterArmed = useRef(true);

  useEffect(() => {
    setSession(getQuizSession(quizId));
    setPendingResult(null);
    enterArmed.current = true;
  }, [quizId]);

  const verseId = session?.verseIds[session.currentIndex];
  const verse = verseId ? getVerse(verseId) : undefined;
  const cardKey = `${quizId}:${session?.currentIndex ?? 0}:${verseId ?? ''}`;

  useEffect(() => {
    setPendingResult(null);
    enterArmed.current = true;
  }, [cardKey]);

  useEffect(() => {
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Enter') enterArmed.current = true;
    };
    window.addEventListener('keyup', onKeyUp);
    return () => window.removeEventListener('keyup', onKeyUp);
  }, []);

  const continueAfterAnswer = useCallback(() => {
    if (!session || !verse || !pendingResult) return;
    const next = recordQuizAnswer(session, {
      verseId: verse.id,
      correct: pendingResult.correct,
      accuracy: pendingResult.accuracy,
      elapsedMs: pendingResult.elapsedMs,
    });
    setPendingResult(null);
    setSession(next);
  }, [pendingResult, session, verse]);

  const onModeComplete = useCallback((result: QuizModeResult) => {
    // The Enter that submitted the answer must not also advance.
    enterArmed.current = false;
    setPendingResult(result);
  }, []);

  const leaveQuiz = useCallback(() => {
    if (session && !session.completedAt) {
      discardQuizSession(session.id);
    }
    navigate('/quiz');
  }, [navigate, session]);

  const hotkeys = useMemo(
    () => ({
      enter: () => {
        if (!pendingResult || !enterArmed.current) return;
        continueAfterAnswer();
      },
      escape: () => {
        void leaveQuiz();
      },
    }),
    [continueAfterAnswer, leaveQuiz, pendingResult],
  );

  useHotkeys(hotkeys, {
    enabled: Boolean(session && !session.completedAt),
  });

  if (session === undefined) {
    return <LoadingState label={'Loading quiz\u2026'} />;
  }

  if (session === null) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-sm text-ink-muted">That quiz no longer exists.</p>
        <ButtonLink to="/quiz" variant="primary" className="mt-4">
          Start a new quiz
        </ButtonLink>
      </div>
    );
  }

  if (session.completedAt || session.currentIndex >= session.verseIds.length) {
    return <QuizSummary session={session} />;
  }

  if (!verse) {
    return <LoadingState label={'Loading passage\u2026'} />;
  }

  const ModeComponent = MODE_COMPONENTS[session.mode];
  const position = session.currentIndex + 1;
  const total = session.verseIds.length;
  const soFar = quizScore(session);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-4 sm:px-6">
      <header className="flex items-center justify-between gap-3 border-b border-line pb-3">
        <div className="min-w-0">
          <p className="text-xs tracking-wide text-ink-subtle uppercase">
            {session.label}
          </p>
          <p className="text-sm text-ink-muted tabular-nums">
            {`Question ${position} of ${total} \u00b7 ${QUIZ_MODE_LABELS[session.mode]}`}
            {soFar.total > 0
              ? ` \u00b7 ${soFar.correct}/${soFar.total} so far`
              : ''}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void leaveQuiz()}
          title="Leave quiz (Escape)"
        >
          <X className="size-4" aria-hidden="true" />
          <span className="sr-only">Leave quiz</span>
        </Button>
      </header>

      <div
        className="mt-1 h-1 w-full overflow-hidden rounded-full bg-surface-sunken"
        role="progressbar"
        aria-valuenow={position}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-label="Quiz progress"
      >
        <div
          className="h-full bg-accent transition-[width]"
          style={{ width: `${(session.currentIndex / total) * 100}%` }}
        />
      </div>

      <main className="flex-1 py-6">
        <ModeComponent
          verse={verse}
          attemptKey={cardKey}
          onComplete={onModeComplete}
        />
      </main>

      <footer className="sticky bottom-0 border-t border-line bg-paper/95 py-3 backdrop-blur">
        {pendingResult ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-muted">
              {pendingResult.correct
                ? 'Correct'
                : `Missed \u00b7 ${formatAccuracy(pendingResult.accuracy)}`}
            </p>
            <Button variant="primary" onClick={continueAfterAnswer}>
              {position >= total ? 'See results' : 'Next question'}
              <span className="ml-1 text-xs opacity-70">(Enter)</span>
            </Button>
          </div>
        ) : (
          <p className="text-xs text-ink-muted">Answer to continue.</p>
        )}
      </footer>
    </div>
  );
}

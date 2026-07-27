import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Flag,
  Keyboard,
  Mic,
  SkipForward,
  X,
} from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { LoadingState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { useHotkeys } from '@/hooks/useHotkeys';
import { useSettings } from '@/hooks/useSettings';
import { useSession, useVerseProgress, useWordStats } from '@/hooks/useProgressData';
import { getVerse } from '@/data/verses';
import { recordReview } from '@/services/reviewService';
import {
  advanceSession,
  completeSession,
  modeForIndex,
  setSessionIndex,
  skipCard,
} from '@/services/sessionService';
import { setDifficult } from '@/services/progressService';
import { MODE_LABELS, formatAccuracy, formatDuration } from '@/utils/format';
import type { ModeResult, Rating, ReviewMode } from '@/types';
import { RatingPanel } from './RatingPanel';
import { VerseAudioControls } from './VerseAudioControls';
import { emptyResult } from './modeTypes';
import { FlashcardMode } from './modes/FlashcardMode';
import { LearnFlashcardMode } from './modes/LearnFlashcardMode';
import { FirstLetterMode } from './modes/FirstLetterMode';
import { ProgressiveHideMode } from './modes/ProgressiveHideMode';
import { FullTypingMode } from './modes/FullTypingMode';
import { ReferenceMode } from './modes/ReferenceMode';
import { VoiceMode } from './modes/VoiceMode';
import { SessionSummary } from './SessionSummary';

const MODE_COMPONENTS = {
  flashcard: FlashcardMode,
  learn: LearnFlashcardMode,
  'first-letter': FirstLetterMode,
  'progressive-hide': ProgressiveHideMode,
  'full-typing': FullTypingMode,
  reference: ReferenceMode,
  voice: VoiceMode,
} as const;

/** Modes offered when a session asks the reader to choose each card. */
const CHOOSE_EACH_MODES: ReviewMode[] = ['learn', 'first-letter'];

type LearnPracticeMode = Extract<ReviewMode, 'first-letter' | 'voice'>;

export function SessionRunner({ sessionId }: { sessionId: string }) {
  const navigate = useNavigate();
  const { notify } = useToast();
  const { settings } = useSettings();

  const session = useSession(sessionId);
  const verseId = session?.verseIds[session.currentIndex];
  const verse = verseId ? getVerse(verseId) : undefined;
  const progress = useVerseProgress(verseId);
  const wordStats = useWordStats(verseId);

  const [result, setResult] = useState<ModeResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [chosenMode, setChosenMode] = useState<ReviewMode | null>(null);
  const [practiceMode, setPracticeMode] = useState<LearnPracticeMode | null>(
    null,
  );

  const cardKey = `${sessionId}:${session?.currentIndex ?? 0}:${verseId ?? ''}`;
  const isLearnSession = session?.fixedMode === 'learn';

  useEffect(() => {
    setResult(null);
    setChosenMode(null);
    setPracticeMode(null);
  }, [cardKey]);

  const mode: ReviewMode | null = useMemo(() => {
    if (!session || !progress) return null;
    if (practiceMode) return practiceMode;
    if (session.modeStrategy === 'choose-each') return chosenMode;
    return modeForIndex(
      session,
      progress,
      session.currentIndex,
      settings.defaultReviewMode,
    );
  }, [chosenMode, practiceMode, progress, session, settings.defaultReviewMode]);

  const rate = useCallback(
    async (rating: Rating) => {
      if (!session || !verse || !mode || saving) return;
      const attempt = result ?? emptyResult(mode);
      setSaving(true);
      try {
        const { log } = await recordReview({
          verseId: verse.id,
          rating,
          result: attempt,
          settings,
          sessionId: session.id,
        });
        await advanceSession(session, log.id, { requeue: rating === 'again' });
        setResult(null);
      } finally {
        setSaving(false);
      }
    },
    [mode, result, saving, session, settings, verse],
  );

  const goToIndex = useCallback(
    (index: number) => {
      if (!session) return;
      setResult(null);
      setPracticeMode(null);
      void setSessionIndex(session, index);
    },
    [session],
  );

  const switchLearnPractice = useCallback((next: LearnPracticeMode | null) => {
    setResult(null);
    setPracticeMode(next);
  }, []);

  const hotkeys = useMemo(
    () => ({
      '1': () => void (mode && rate('again')),
      '2': () => void (mode && rate('hard')),
      '3': () => void (mode && rate('good')),
      '4': () => void (mode && rate('easy')),
      d: () => {
        if (!verse || !progress) return;
        void setDifficult(verse.id, !progress.isDifficult).then(() =>
          notify(
            progress.isDifficult
              ? 'Difficult flag removed.'
              : 'Marked difficult.',
            'success',
          ),
        );
      },
      escape: () => setConfirmExit(true),
      arrowleft: () => {
        if (!session || !isLearnSession || session.currentIndex <= 0) return;
        goToIndex(session.currentIndex - 1);
      },
      arrowright: () => {
        if (
          !session ||
          !isLearnSession ||
          session.currentIndex >= session.verseIds.length - 1
        ) {
          return;
        }
        goToIndex(session.currentIndex + 1);
      },
    }),
    [goToIndex, isLearnSession, mode, notify, progress, rate, session, verse],
  );

  useHotkeys(hotkeys);

  if (session === undefined) {
    return <LoadingState label={'Loading session\u2026'} />;
  }

  if (session === null || !session) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-sm text-ink-muted">
          That review session no longer exists.
        </p>
        <ButtonLink to="/practice" variant="primary">
          Build a new session
        </ButtonLink>
      </div>
    );
  }

  const finished =
    session.completedAt !== null ||
    session.currentIndex >= session.verseIds.length;

  if (finished) {
    return <SessionSummary session={session} />;
  }

  if (!verse || !progress || wordStats === undefined) {
    return <LoadingState label={'Loading passage\u2026'} />;
  }

  const ModeComponent = mode ? MODE_COMPONENTS[mode] : null;
  const position = session.currentIndex + 1;
  const total = session.verseIds.length;
  const canGoPrev = session.currentIndex > 0;
  const canGoNext = session.currentIndex < session.verseIds.length - 1;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-4 sm:px-6">
      <header className="flex items-center justify-between gap-3 border-b border-line pb-3">
        <div className="min-w-0">
          <p className="text-xs tracking-wide text-ink-subtle uppercase">
            {session.label}
          </p>
          <p className="text-sm text-ink-muted tabular-nums">
            {`Passage ${position} of ${total}${mode ? ` \u00b7 ${MODE_LABELS[mode]}` : ''}`}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void setDifficult(verse.id, !progress.isDifficult)}
            aria-pressed={progress.isDifficult}
            title="Toggle difficult (D)"
          >
            <Flag
              className="size-4"
              aria-hidden="true"
              fill={progress.isDifficult ? 'currentColor' : 'none'}
            />
            <span className="sr-only">Toggle difficult</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmExit(true)}
            title="Leave session (Escape)"
          >
            <X className="size-4" aria-hidden="true" />
            <span className="sr-only">Leave session</span>
          </Button>
        </div>
      </header>

      <div
        className="mt-1 h-1 w-full overflow-hidden rounded-full bg-surface-sunken"
        role="progressbar"
        aria-valuenow={position}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-label="Session progress"
      >
        <div
          className="h-full bg-accent transition-[width]"
          style={{ width: `${(session.currentIndex / total) * 100}%` }}
        />
      </div>

      <VerseAudioControls
        text={verse.text}
        passageKey={cardKey}
        className="mt-2"
      />

      {isLearnSession ? (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={!canGoPrev}
              onClick={() => goToIndex(session.currentIndex - 1)}
              aria-label="Previous passage"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={!canGoNext}
              onClick={() => goToIndex(session.currentIndex + 1)}
              aria-label="Next passage"
            >
              Next
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          </div>

          {practiceMode ? (
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label="Practice mode"
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={() => switchLearnPractice(null)}
              >
                Show passage
              </Button>
              <Button
                variant={practiceMode === 'first-letter' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => switchLearnPractice('first-letter')}
                aria-pressed={practiceMode === 'first-letter'}
              >
                <Keyboard className="size-4" aria-hidden="true" />
                First letters
              </Button>
              <Button
                variant={practiceMode === 'voice' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => switchLearnPractice('voice')}
                aria-pressed={practiceMode === 'voice'}
              >
                <Mic className="size-4" aria-hidden="true" />
                Audio
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <main className="flex-1 py-6">
        {session.modeStrategy === 'choose-each' && !chosenMode ? (
          <div className="space-y-4">
            <h2 className="font-serif text-xl font-semibold text-ink">
              {verse.reference}
            </h2>
            <p className="text-sm text-ink-muted">
              Choose how you want to practice this passage.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {CHOOSE_EACH_MODES.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setChosenMode(option)}
                  className="rounded-lg border border-line-strong bg-surface px-4 py-3 text-left hover:bg-surface-muted"
                >
                  <span className="block text-sm font-medium text-ink">
                    {MODE_LABELS[option]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : mode === 'learn' ? (
          <LearnFlashcardMode
            verse={verse}
            progress={progress}
            settings={settings}
            wordStats={wordStats}
            onComplete={setResult}
            attemptKey={`${cardKey}:${mode}`}
            onPractice={(next) => switchLearnPractice(next)}
          />
        ) : ModeComponent ? (
          <ModeComponent
            verse={verse}
            progress={progress}
            settings={settings}
            wordStats={wordStats}
            onComplete={setResult}
            attemptKey={`${cardKey}:${mode}`}
          />
        ) : (
          <LoadingState />
        )}
      </main>

      <footer className="sticky bottom-0 border-t border-line bg-paper/95 py-3 backdrop-blur">
        {mode ? (
          <div className="space-y-2">
            {result?.accuracy !== null && result ? (
              <p className="text-xs text-ink-muted">
                {`${formatAccuracy(result.accuracy)} accuracy \u00b7 ${formatDuration(result.elapsedMs)} \u00b7 ${result.hintCount} hint${result.hintCount === 1 ? '' : 's'}`}
              </p>
            ) : null}
            <RatingPanel
              progress={progress}
              settings={settings}
              suggested={result?.suggestedRating ?? null}
              disabled={saving}
              onRate={(rating) => void rate(rating)}
            />
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void skipCard(session)}
              >
                <SkipForward className="size-4" aria-hidden="true" />
                Skip
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-ink-muted">
            Choose a practice mode to continue.
          </p>
        )}
      </footer>

      <ConfirmDialog
        open={confirmExit}
        title="Leave this session?"
        description="Your completed passages are already saved. You can resume this session from Practice."
        confirmLabel="Pause and leave"
        cancelLabel="Keep practicing"
        onCancel={() => setConfirmExit(false)}
        onConfirm={() => {
          setConfirmExit(false);
          navigate('/practice');
        }}
      >
        <div className="space-y-3 text-sm text-ink-muted">
          <p>
            {`${session.currentIndex} of ${session.verseIds.length} passages completed.`}
          </p>
          <p>
            <Link
              to="/verses"
              className="underline"
              onClick={() => void completeSession(session)}
            >
              End the session instead
            </Link>{' '}
            if you do not intend to come back to it.
          </p>
        </div>
      </ConfirmDialog>
    </div>
  );
}

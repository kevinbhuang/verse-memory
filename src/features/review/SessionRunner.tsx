import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Flag,
  Keyboard,
  Mic,
  SkipForward,
  X,
} from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { useHotkeys } from '@/hooks/useHotkeys';
import { useSettings } from '@/hooks/useSettings';
import { useSession, useVerseProgress, useWordStats } from '@/hooks/useProgressData';
import { getVerse } from '@/data/verses';
import { recordReview } from '@/services/reviewService';
import {
  abandonSession,
  advanceSession,
  modeForIndex,
  setSessionIndex,
  skipCard,
} from '@/services/sessionService';
import { setDifficult, setMemorized } from '@/services/progressService';
import { safeReturnPath } from '@/lib/safeReturnPath';
import { MODE_LABELS, formatAccuracy, formatDuration } from '@/utils/format';
import type { ModeResult, ReviewMode } from '@/types';
import { VerseAudioControls } from './VerseAudioControls';
import { emptyResult } from './modeTypes';
import { FlashcardMode } from './modes/FlashcardMode';
import { LearnFlashcardMode } from './modes/LearnFlashcardMode';
import { FirstLetterMode } from './modes/FirstLetterMode';
import { FillBlankMode } from './modes/FillBlankMode';
import { ProgressiveHideMode } from './modes/ProgressiveHideMode';
import { FullTypingMode } from './modes/FullTypingMode';
import { ReferenceMode } from './modes/ReferenceMode';
import { VoiceMode } from './modes/VoiceMode';
import { SessionSummary } from './SessionSummary';

const MODE_COMPONENTS = {
  flashcard: FlashcardMode,
  learn: LearnFlashcardMode,
  'first-letter': FirstLetterMode,
  'fill-blank': FillBlankMode,
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
  const [searchParams] = useSearchParams();
  const { notify } = useToast();
  const { settings } = useSettings();
  const returnTo = safeReturnPath(searchParams.get('return'));

  const session = useSession(sessionId);
  const verseId = session?.verseIds[session.currentIndex];
  const verse = verseId ? getVerse(verseId) : undefined;
  const progress = useVerseProgress(verseId);
  const wordStats = useWordStats(verseId);

  const [result, setResult] = useState<ModeResult | null>(null);
  const [saving, setSaving] = useState(false);
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

  const goNext = useCallback(async () => {
    if (!session || !verse || !mode || saving) return;
    const attempt = result ?? emptyResult(mode);
    setSaving(true);
    try {
      // Practice no longer asks for a 1–4 grade; log the attempt neutrally.
      const { log } = await recordReview({
        verseId: verse.id,
        rating: 'good',
        result: attempt,
        settings,
        sessionId: session.id,
      });
      await advanceSession(session, log.id, { requeue: false });
      setResult(null);
    } finally {
      setSaving(false);
    }
  }, [mode, result, saving, session, settings, verse]);

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

  const leaveSession = useCallback(async () => {
    if (session) {
      await abandonSession(session.id);
    }
    navigate(returnTo);
  }, [navigate, returnTo, session]);

  const returnToFlashcards = returnTo.startsWith('/flashcards');

  // Single-verse drills from Flash Cards skip the summary and land back on the card.
  useEffect(() => {
    if (!session || !returnToFlashcards) return;
    const done =
      session.completedAt !== null ||
      session.currentIndex >= session.verseIds.length;
    if (!done) return;
    navigate(returnTo, { replace: true });
  }, [navigate, returnTo, returnToFlashcards, session]);

  const hotkeys = useMemo(
    () => ({
      enter: () => {
        if (mode) void goNext();
      },
      d: () => {
        if (!verse || !progress) return;
        void setDifficult(verse.id, !progress.isDifficult).then(() =>
          notify(
            progress.isDifficult
              ? 'Cleared Needs Review.'
              : 'Marked Needs Review.',
            'success',
          ),
        );
      },
      m: () => {
        if (!verse || !progress) return;
        void setMemorized(verse.id, !progress.isMemorized).then(() =>
          notify(
            progress.isMemorized
              ? 'Cleared memorized mark.'
              : 'Marked memorized.',
            'success',
          ),
        );
      },
      escape: () => {
        void leaveSession();
      },
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
    [
      goNext,
      goToIndex,
      isLearnSession,
      leaveSession,
      mode,
      notify,
      progress,
      session,
      verse,
    ],
  );

  useHotkeys(hotkeys);

  if (session === undefined) {
    return <LoadingState label={'Loading session\u2026'} />;
  }

  if (session === null || !session) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-sm text-ink-muted">
          That practice session no longer exists.
        </p>
        <ButtonLink to={returnTo} variant="primary">
          {returnTo.startsWith('/flashcards')
            ? 'Back to flash cards'
            : returnTo.startsWith('/quiz')
              ? 'Back to quiz'
              : 'Back'}
        </ButtonLink>
      </div>
    );
  }

  const finished =
    session.completedAt !== null ||
    session.currentIndex >= session.verseIds.length;

  if (finished) {
    if (returnToFlashcards) {
      return <LoadingState label={'Returning to flash cards\u2026'} />;
    }
    return <SessionSummary session={session} returnTo={returnTo} />;
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
          <p className="text-xs text-ink-subtle">{session.label}</p>
          <p className="text-sm text-ink-muted tabular-nums">
            {`Passage ${position} of ${total}${mode ? ` \u00b7 ${MODE_LABELS[mode]}` : ''}`}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              void setMemorized(verse.id, !progress.isMemorized).then(() =>
                notify(
                  progress.isMemorized
                    ? 'Cleared memorized mark.'
                    : 'Marked memorized.',
                  'success',
                ),
              )
            }
            aria-pressed={progress.isMemorized}
            title="Toggle memorized (M)"
          >
            <Check
              className="size-4"
              aria-hidden="true"
              strokeWidth={progress.isMemorized ? 3 : 2}
            />
            <span className="sr-only">Toggle memorized</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              void setDifficult(verse.id, !progress.isDifficult).then(() =>
                notify(
                  progress.isDifficult
                    ? 'Cleared Needs Review.'
                    : 'Marked Needs Review.',
                  'success',
                ),
              )
            }
            aria-pressed={progress.isDifficult}
            title="Toggle Needs Review (D)"
          >
            <Flag
              className="size-4"
              aria-hidden="true"
              fill={progress.isDifficult ? 'currentColor' : 'none'}
            />
            <span className="sr-only">Toggle Needs Review</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void leaveSession()}
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
          className="h-full bg-brand transition-[width]"
          style={{ width: `${(session.currentIndex / total) * 100}%` }}
        />
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-line pb-2">
        <VerseAudioControls
          text={verse.text}
          reference={verse.reference}
          passageKey={cardKey}
          className="mt-0"
        />

        {isLearnSession ? (
          <div className="flex flex-wrap items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={!canGoPrev}
              onClick={() => goToIndex(session.currentIndex - 1)}
              aria-label="Previous passage"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={!canGoNext}
              onClick={() => goToIndex(session.currentIndex + 1)}
              aria-label="Next passage"
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
            {practiceMode ? (
              <div
                className="ml-1 flex flex-wrap gap-1"
                role="group"
                aria-label="Practice mode"
              >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => switchLearnPractice(null)}
                >
                  Passage
                </Button>
                <Button
                  variant={
                    practiceMode === 'first-letter' ? 'quiet' : 'ghost'
                  }
                  size="sm"
                  onClick={() => switchLearnPractice('first-letter')}
                  aria-pressed={practiceMode === 'first-letter'}
                >
                  <Keyboard className="size-4" aria-hidden="true" />
                  Letters
                </Button>
                <Button
                  variant={practiceMode === 'voice' ? 'quiet' : 'ghost'}
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
      </div>

      <main className="flex-1 py-5">
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
            key={`${cardKey}:${mode}`}
            verse={verse}
            progress={progress}
            settings={settings}
            wordStats={wordStats}
            onComplete={setResult}
            attemptKey={`${cardKey}:${mode}`}
            onRetry={() => setResult(null)}
            onPractice={(next) => switchLearnPractice(next)}
          />
        ) : ModeComponent ? (
          <ModeComponent
            key={`${cardKey}:${mode}`}
            verse={verse}
            progress={progress}
            settings={settings}
            wordStats={wordStats}
            onComplete={setResult}
            attemptKey={`${cardKey}:${mode}`}
            onRetry={() => setResult(null)}
          />
        ) : (
          <LoadingState />
        )}
      </main>

      <footer className="sticky bottom-0 border-t border-line bg-paper/95 py-3 backdrop-blur">
        {mode ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            {result?.accuracy !== null && result ? (
              <p className="text-xs text-ink-muted">
                {`${formatAccuracy(result.accuracy)} accuracy \u00b7 ${formatDuration(result.elapsedMs)} \u00b7 ${result.hintCount} hint${result.hintCount === 1 ? '' : 's'}`}
              </p>
            ) : (
              <p className="text-xs text-ink-muted">
                Ready when you are · Enter for next
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void skipCard(session)}
                disabled={saving}
              >
                <SkipForward className="size-4" aria-hidden="true" />
                Skip
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => void goNext()}
                disabled={saving}
              >
                {saving
                  ? 'Saving\u2026'
                  : position >= total
                    ? 'Finish'
                    : 'Next'}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-ink-muted">
            Choose a practice mode to continue.
          </p>
        )}
      </footer>
    </div>
  );
}

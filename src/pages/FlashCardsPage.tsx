import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Flag,
  Keyboard,
  TextCursorInput,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { ScriptureText } from '@/components/ScriptureText';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useHotkeys } from '@/hooks/useHotkeys';
import { useSettings } from '@/hooks/useSettings';
import { useVerseProgress } from '@/hooks/useProgressData';
import { verses } from '@/data/verses';
import { firstLetterSkeleton } from '@/lib/text/tokenize';
import { setDifficult, setMemorized } from '@/services/progressService';
import { createSession } from '@/services/sessionService';
import type { ReviewMode } from '@/types';
import { VerseAudioControls } from '@/features/review/VerseAudioControls';

const FIRST_LETTER_KEY = 'verse-memory:flashcards-first-letter';
const REVEALED_KEY = 'verse-memory:flashcards-revealed';
const CUE_HIDDEN_KEY = 'verse-memory:flashcards-cue-hidden';

function readBoolPref(key: string, fallback: boolean): boolean {
  try {
    const stored = localStorage.getItem(key);
    if (stored === null) return fallback;
    return stored === 'true';
  } catch {
    return fallback;
  }
}

function writeBoolPref(key: string, value: boolean) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Ignore quota / private-mode failures.
  }
}

function indexForVerseId(verseId: string | null): number {
  if (!verseId) return 0;
  const index = verses.findIndex((verse) => verse.id === verseId);
  return index >= 0 ? index : 0;
}

/**
 * Browse the collection as flash cards: show/hide the passage, optional
 * first-letter cue, and previous/next navigation.
 *
 * Show/hide and first-letter preferences are global for the session (and
 * persisted), not per verse.
 */
export function FlashCardsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { settings } = useSettings();
  const { notify } = useToast();

  const startId = searchParams.get('verse');
  const [index, setIndex] = useState(() => indexForVerseId(startId));
  const [firstLetterMode, setFirstLetterMode] = useState(() =>
    readBoolPref(FIRST_LETTER_KEY, false),
  );
  const [revealed, setRevealed] = useState(() =>
    readBoolPref(REVEALED_KEY, true),
  );
  /** When first-letter mode is on and the full verse is hidden, hide the cue too. */
  const [cueHidden, setCueHidden] = useState(() =>
    readBoolPref(CUE_HIDDEN_KEY, false),
  );

  const verse = verses[index] ?? verses[0]!;
  const progress = useVerseProgress(verse.id);
  const canGoPrev = index > 0;
  const canGoNext = index < verses.length - 1;
  const showingFirstLetters = !revealed && firstLetterMode && !cueHidden;

  useEffect(() => {
    const next = indexForVerseId(startId);
    setIndex(next);
  }, [startId]);

  useEffect(() => {
    writeBoolPref(FIRST_LETTER_KEY, firstLetterMode);
  }, [firstLetterMode]);

  useEffect(() => {
    writeBoolPref(REVEALED_KEY, revealed);
  }, [revealed]);

  useEffect(() => {
    writeBoolPref(CUE_HIDDEN_KEY, cueHidden);
  }, [cueHidden]);

  const goTo = (nextIndex: number) => {
    const clamped = Math.min(Math.max(nextIndex, 0), verses.length - 1);
    setIndex(clamped);
    const target = verses[clamped];
    if (target) {
      navigate(`/flashcards?verse=${target.id}`, { replace: true });
    }
  };

  /**
   * Space / H: show or hide the current card face.
   * With first letters on, that face is the cue — Space must not jump to the
   * full verse (use Show passage for that).
   */
  const toggleVisibility = () => {
    if (revealed) {
      setRevealed(false);
      setCueHidden(false);
      return;
    }
    if (firstLetterMode) {
      setCueHidden((hidden) => !hidden);
      return;
    }
    setRevealed(true);
  };

  const showFullPassage = () => {
    setRevealed(true);
    setCueHidden(false);
  };

  const hideFullPassage = () => {
    setRevealed(false);
    setCueHidden(false);
  };

  /** F: toggle between first-letter cue and the full verse. */
  const toggleFirstLetterMode = () => {
    if (firstLetterMode) {
      setFirstLetterMode(false);
      setRevealed(true);
      setCueHidden(false);
      return;
    }
    setFirstLetterMode(true);
    setRevealed(false);
    setCueHidden(false);
  };

  const toggleMemorized = () => {
    if (!progress) return;
    void setMemorized(verse.id, !progress.isMemorized).then(() =>
      notify(
        progress.isMemorized ? 'Cleared memorized mark.' : 'Marked memorized.',
        'success',
      ),
    );
  };

  const toggleNeedsReview = () => {
    if (!progress) return;
    void setDifficult(verse.id, !progress.isDifficult).then(() =>
      notify(
        progress.isDifficult
          ? 'Cleared Needs Review.'
          : 'Marked Needs Review.',
        'success',
      ),
    );
  };

  const startPractice = async (
    mode: Extract<ReviewMode, 'first-letter' | 'fill-blank'>,
  ) => {
    const label =
      mode === 'first-letter'
        ? `Type first letter \u2014 ${verse.reference}`
        : `Fill in the blank \u2014 ${verse.reference}`;
    const session = await createSession(
      {
        source: 'custom',
        verseIds: [verse.id],
        size: 'all',
        modeStrategy: 'fixed',
        fixedMode: mode,
      },
      label,
    );
    if (session) {
      const returnTo = encodeURIComponent(`/flashcards?verse=${verse.id}`);
      navigate(`/review/session?id=${session.id}&return=${returnTo}`);
    }
  };

  useHotkeys({
    arrowleft: () => {
      if (canGoPrev) goTo(index - 1);
    },
    arrowright: () => {
      if (canGoNext) goTo(index + 1);
    },
    space: () => toggleVisibility(),
    enter: () => toggleVisibility(),
    h: () => toggleVisibility(),
    f: () => toggleFirstLetterMode(),
    t: () => {
      void startPractice('first-letter');
    },
    b: () => {
      void startPractice('fill-blank');
    },
    m: () => toggleMemorized(),
    n: () => toggleNeedsReview(),
  });

  const positionLabel = useMemo(
    () => `Passage ${index + 1} of ${verses.length}`,
    [index],
  );

  return (
    <>
      <PageHeader
        title="Flash Cards"
        description="Space hide · F first-letter cue · T type first letter · B fill in the blank."
      />

      <div className="mb-5 flex flex-wrap items-center justify-end gap-3 border-b border-line pb-4">
        <p className="text-sm text-ink-muted tabular-nums">{positionLabel}</p>
      </div>

      <div className="mx-auto w-full max-w-2xl space-y-5">
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={!canGoPrev}
            onClick={() => goTo(index - 1)}
            aria-label="Previous passage"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            Previous
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={!canGoNext}
            onClick={() => goTo(index + 1)}
            aria-label="Next passage"
          >
            Next
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        </div>

        <div>
          <h2 className="font-serif text-2xl font-semibold text-ink sm:text-3xl">
            {verse.reference}
          </h2>
          {settings.showSectionLabels ? (
            <p className="mt-1 text-sm text-ink-muted">{verse.section}</p>
          ) : null}
          <VerseAudioControls
            text={verse.text}
            reference={verse.reference}
            passageKey={verse.id}
            className="mt-3"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void startPractice('first-letter')}
            title="Type first letter (T)"
          >
            <Keyboard className="size-3.5" aria-hidden="true" />
            Type first letter (T)
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void startPractice('fill-blank')}
            title="Fill in the blank (B)"
          >
            <TextCursorInput className="size-3.5" aria-hidden="true" />
            Fill in the blank (B)
          </Button>
          {progress ? (
            <>
              <Button
                size="sm"
                variant={progress.isMemorized ? 'quiet' : 'secondary'}
                onClick={toggleMemorized}
                aria-pressed={progress.isMemorized}
                title="Toggle memorized (M)"
              >
                {progress.isMemorized
                  ? 'Clear memorized (M)'
                  : 'Mark memorized (M)'}
              </Button>
              <Button
                size="sm"
                variant={progress.isDifficult ? 'quiet' : 'secondary'}
                onClick={toggleNeedsReview}
                aria-pressed={progress.isDifficult}
                title="Toggle Needs Review (N)"
              >
                <Flag className="size-3.5" aria-hidden="true" />
                {progress.isDifficult
                  ? 'Clear Needs Review (N)'
                  : 'Mark Needs Review (N)'}
              </Button>
            </>
          ) : null}
        </div>

        {revealed ? (
          <div className="rounded-xl border border-line bg-surface px-5 py-6">
            <ScriptureText text={verse.text} />
          </div>
        ) : showingFirstLetters ? (
          <div className="rounded-xl border border-line bg-surface px-5 py-6">
            <p
              className="font-serif text-lg leading-relaxed text-ink sm:text-xl sm:leading-relaxed"
              aria-label="First letters of the passage"
            >
              {firstLetterSkeleton(verse.text)}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-line-strong bg-surface-muted px-5 py-10 text-center">
            <p className="text-sm text-ink-muted">
              {firstLetterMode
                ? 'Hidden. Press Space for first letters, or Show for the full passage.'
                : 'Passage hidden. Press Space to show it again.'}
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={revealed ? hideFullPassage : showFullPassage}
          >
            {revealed ? (
              <>
                <EyeOff className="size-4" aria-hidden="true" />
                Hide passage
              </>
            ) : (
              <>
                <Eye className="size-4" aria-hidden="true" />
                Show passage
              </>
            )}
          </Button>

          <p className="text-xs text-ink-subtle" aria-live="polite">
            T type first letter · B fill blank · F first-letter cue · M memorized
            · N Needs Review · Space{' '}
            {firstLetterMode ? 'show/hide first letters' : 'show/hide'} · ← →
            move
          </p>
        </div>
      </div>
    </>
  );
}

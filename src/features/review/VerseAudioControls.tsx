import { Pause, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useVerseSpeech } from '@/hooks/useVerseSpeech';
import {
  SPEAK_RATES,
  formatSpeakRate,
  type SpeakRate,
} from '@/lib/speech/speak';

type VerseAudioControlsProps = {
  text: string;
  /** Change when the active passage changes so playback stops. */
  passageKey: string;
  className?: string;
};

/**
 * Listen-along controls for review: play once, or loop 5 / 10 times,
 * with optional faster playback speeds.
 */
export function VerseAudioControls({
  text,
  passageKey,
  className,
}: VerseAudioControlsProps) {
  const speech = useVerseSpeech(text, passageKey);

  if (!speech.supported) {
    return (
      <p className={`text-xs text-ink-subtle ${className ?? ''}`}>
        Audio playback is not available in this browser.
      </p>
    );
  }

  return (
    <div
      className={`space-y-2 ${className ?? ''}`}
      role="group"
      aria-label="Passage audio"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted">
          <Volume2 className="size-3.5" aria-hidden="true" />
          Listen
        </span>

        {speech.playing ? (
          <>
            <p className="text-xs text-ink-muted tabular-nums" aria-live="polite">
              {speech.playTotal > 1
                ? `Playing ${speech.playIndex} of ${speech.playTotal}`
                : 'Playing\u2026'}
              {` · ${formatSpeakRate(speech.rate)}`}
            </p>
            <Button variant="secondary" size="sm" onClick={speech.stop}>
              <Pause className="size-3.5" aria-hidden="true" />
              Stop
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => speech.play(1)}
              aria-label="Play passage once"
            >
              Play
            </Button>
            <Button
              variant="quiet"
              size="sm"
              onClick={() => speech.play(5)}
              aria-label="Play passage 5 times"
            >
              ×5
            </Button>
            <Button
              variant="quiet"
              size="sm"
              onClick={() => speech.play(10)}
              aria-label="Play passage 10 times"
            >
              ×10
            </Button>
          </>
        )}
      </div>

      <div
        className="flex flex-wrap items-center gap-1.5"
        role="group"
        aria-label="Playback speed"
      >
        <span className="mr-1 text-xs text-ink-muted">Speed</span>
        {SPEAK_RATES.map((rate) => {
          const selected = speech.rate === rate;
          return (
            <button
              key={rate}
              type="button"
              aria-pressed={selected}
              aria-label={`Playback speed ${formatSpeakRate(rate)}`}
              disabled={speech.playing}
              onClick={() => speech.setRate(rate as SpeakRate)}
              className={`rounded-md border px-2 py-0.5 text-xs tabular-nums transition-colors disabled:opacity-50 ${
                selected
                  ? 'border-accent bg-accent-soft font-semibold text-accent'
                  : 'border-line-strong bg-surface text-ink-muted hover:bg-surface-muted hover:text-ink'
              }`}
            >
              {formatSpeakRate(rate)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

import { Pause, Volume2 } from 'lucide-react';
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
 * Compact listen-along controls: play / ×5 and speed, in one quiet row.
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
      className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-subtle ${className ?? ''}`}
      role="group"
      aria-label="Passage audio"
    >
      <Volume2 className="size-3 shrink-0 opacity-70" aria-hidden="true" />

      {speech.playing ? (
        <>
          <span className="tabular-nums" aria-live="polite">
            {speech.playTotal > 1
              ? `${speech.playIndex}/${speech.playTotal}`
              : 'Playing'}
            {` · ${formatSpeakRate(speech.rate)}`}
          </span>
          <button
            type="button"
            onClick={speech.stop}
            className="inline-flex items-center gap-1 text-ink-muted underline-offset-2 hover:text-ink hover:underline"
          >
            <Pause className="size-3" aria-hidden="true" />
            Stop
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => speech.play(1)}
            aria-label="Play passage once"
            className="text-ink-muted underline-offset-2 hover:text-ink hover:underline"
          >
            Play
          </button>
          <button
            type="button"
            onClick={() => speech.play(5)}
            aria-label="Play passage 5 times"
            className="text-ink-muted underline-offset-2 hover:text-ink hover:underline"
          >
            ×5
          </button>
        </>
      )}

      <span className="text-ink-subtle/50" aria-hidden="true">
        ·
      </span>

      <span
        className="inline-flex items-center gap-2"
        role="group"
        aria-label="Playback speed"
      >
        {SPEAK_RATES.map((rate, index) => {
          const selected = speech.rate === rate;
          return (
            <span key={rate} className="inline-flex items-center gap-2">
              {index > 0 ? (
                <span className="text-ink-subtle/40" aria-hidden="true">
                  /
                </span>
              ) : null}
              <button
                type="button"
                aria-pressed={selected}
                aria-label={`Playback speed ${formatSpeakRate(rate)}`}
                disabled={speech.playing}
                onClick={() => speech.setRate(rate as SpeakRate)}
                className={`tabular-nums transition-colors disabled:opacity-40 ${
                  selected
                    ? 'font-medium text-ink'
                    : 'text-ink-subtle hover:text-ink-muted'
                }`}
              >
                {formatSpeakRate(rate)}
              </button>
            </span>
          );
        })}
      </span>
    </div>
  );
}

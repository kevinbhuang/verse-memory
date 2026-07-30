import { Pause, Volume2 } from 'lucide-react';
import { useVerseSpeech } from '@/hooks/useVerseSpeech';
import {
  SPEAK_RATES,
  formatSpeakRate,
  type SpeakRate,
} from '@/lib/speech/speak';

type VerseAudioControlsProps = {
  text: string;
  /** Canonical reference for Crossway ESV audio (e.g. "John 3:16"). */
  reference?: string;
  /** Change when the active passage changes so playback stops. */
  passageKey: string;
  className?: string;
};

/**
 * Compact listen-along controls: play once / on repeat and speed.
 * Prefers official ESV narration when `reference` is set; falls back to TTS.
 */
export function VerseAudioControls({
  text,
  reference,
  passageKey,
  className,
}: VerseAudioControlsProps) {
  const speech = useVerseSpeech(text, passageKey, reference);

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
            {speech.looping ? 'On repeat' : 'Playing'}
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
            onClick={() => speech.play('loop')}
            aria-label="Play passage on repeat"
            className="text-ink-muted underline-offset-2 hover:text-ink hover:underline"
          >
            Play on repeat
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
                onClick={() => speech.setRate(rate as SpeakRate)}
                className={`tabular-nums transition-colors ${
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

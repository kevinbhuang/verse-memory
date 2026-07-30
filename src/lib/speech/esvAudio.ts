import type { SpeakRate, SpeakRepeatCount } from './speak';
import { DEFAULT_REPEAT_GAP_MS, DEFAULT_SPEAK_RATE } from './speak';

export type EsvAudioProgress = {
  play: number;
  plays: number | 'loop';
};

export type EsvAudioController = {
  stop: () => void;
  done: Promise<void>;
  setRate: (rate: SpeakRate) => void;
};

type PlayEsvAudioOptions = {
  onProgress?: (progress: EsvAudioProgress) => void;
  gapMs?: number;
  rate?: SpeakRate;
};

/** Same-origin proxy — token stays on the server (Vite proxy / Netlify function). */
export function esvAudioUrl(reference: string): string {
  return `/api/esv-audio?q=${encodeURIComponent(reference)}`;
}

/**
 * Play Crossway ESV narration for a reference (via `/api/esv-audio`).
 * Rejects if the audio cannot load so callers can fall back to TTS.
 * `setRate` updates the active element immediately (and later repeats).
 */
export function playPassageEsvAudio(
  reference: string,
  times: SpeakRepeatCount,
  options: PlayEsvAudioOptions = {},
): EsvAudioController {
  const {
    onProgress,
    gapMs = DEFAULT_REPEAT_GAP_MS,
    rate = DEFAULT_SPEAK_RATE,
  } = options;
  const signal = { cancelled: false };
  let gapTimer: ReturnType<typeof setTimeout> | null = null;
  let audio: HTMLAudioElement | null = null;
  let currentRate = rate;
  const looping = times === 'loop';
  const maxPlays = looping ? null : times;

  const stop = () => {
    signal.cancelled = true;
    if (gapTimer) clearTimeout(gapTimer);
    gapTimer = null;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      audio = null;
    }
  };

  const setRate = (next: SpeakRate) => {
    currentRate = next;
    if (audio) audio.playbackRate = next;
  };

  const done = (async () => {
    const url = esvAudioUrl(reference);

    for (let play = 1; maxPlays === null || play <= maxPlays; play += 1) {
      if (signal.cancelled) return;
      onProgress?.({ play, plays: looping ? 'loop' : times });

      await new Promise<void>((resolve, reject) => {
        if (signal.cancelled) {
          resolve();
          return;
        }

        const el = new Audio(url);
        audio = el;
        el.playbackRate = currentRate;
        el.preload = 'auto';

        const cleanup = () => {
          el.onended = null;
          el.onerror = null;
          if (audio === el) audio = null;
        };

        el.onended = () => {
          cleanup();
          resolve();
        };
        el.onerror = () => {
          cleanup();
          reject(new Error('ESV audio failed to load'));
        };

        void el.play().catch((error: unknown) => {
          cleanup();
          reject(error instanceof Error ? error : new Error('ESV audio play failed'));
        });
      });

      if (signal.cancelled || (maxPlays !== null && play >= maxPlays)) return;

      await new Promise<void>((resolve) => {
        gapTimer = setTimeout(() => {
          gapTimer = null;
          resolve();
        }, gapMs);
      });
    }
  })();

  return { stop, done, setRate };
}

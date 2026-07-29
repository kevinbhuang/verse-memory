/**
 * Browser text-to-speech helpers for listening to a passage while reviewing.
 * Uses the Web Speech Synthesis API (no licensed audio files).
 */

export type SpeakRepeatCount = 1 | 5 | 10;

export const DEFAULT_REPEAT_GAP_MS = 750;

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** Split long passages so browsers that truncate long utterances still finish. */
export function splitForSpeech(text: string): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];

  const sentences =
    cleaned.match(/[^.!?]+[.!?]+\s*|[^.!?]+$/g)?.map((part) => part.trim()) ??
    [cleaned];

  const chunks: string[] = [];
  for (const sentence of sentences) {
    if (!sentence) continue;
    if (sentence.length <= 220) {
      chunks.push(sentence);
      continue;
    }
    // Fall back to clause / phrase breaks for very long sentences.
    const pieces = sentence.split(/(?<=[,;:])\s+/);
    let buffer = '';
    for (const piece of pieces) {
      const next = buffer ? `${buffer} ${piece}` : piece;
      if (next.length > 220 && buffer) {
        chunks.push(buffer);
        buffer = piece;
      } else {
        buffer = next;
      }
    }
    if (buffer) chunks.push(buffer);
  }
  return chunks;
}

function pickVoice(): SpeechSynthesisVoice | null {
  if (!speechSupported()) return null;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;

  const preferred =
    voices.find((voice) => /^en(-|_)/i.test(voice.lang) && /google/i.test(voice.name)) ??
    voices.find((voice) => /^en-US/i.test(voice.lang)) ??
    voices.find((voice) => /^en/i.test(voice.lang));

  return preferred ?? null;
}

type SpeakOptions = {
  rate?: number;
  /** Read on each chunk so speed can change while a multi-chunk play is running. */
  getRate?: () => number;
  onChunkStart?: (index: number, total: number) => void;
  signal?: { cancelled: boolean };
};

function speakChunks(
  chunks: string[],
  options: SpeakOptions = {},
): Promise<void> {
  const { rate = 1, getRate, onChunkStart, signal } = options;

  return new Promise((resolve, reject) => {
    if (!speechSupported() || chunks.length === 0) {
      resolve();
      return;
    }

    let index = 0;
    const voice = pickVoice();

    const speakNext = () => {
      if (signal?.cancelled) {
        window.speechSynthesis.cancel();
        resolve();
        return;
      }
      if (index >= chunks.length) {
        resolve();
        return;
      }

      onChunkStart?.(index + 1, chunks.length);
      const utterance = new SpeechSynthesisUtterance(chunks[index]);
      utterance.rate = getRate?.() ?? rate;
      utterance.lang = voice?.lang ?? 'en-US';
      if (voice) utterance.voice = voice;

      utterance.onend = () => {
        index += 1;
        speakNext();
      };
      utterance.onerror = (event) => {
        if (signal?.cancelled || event.error === 'canceled' || event.error === 'interrupted') {
          resolve();
          return;
        }
        reject(new Error(event.error || 'Speech synthesis failed'));
      };

      window.speechSynthesis.speak(utterance);
    };

    // Chrome sometimes needs getVoices() warmed before the first speak.
    void window.speechSynthesis.getVoices();
    speakNext();
  });
}

export type RepeatProgress = {
  play: number;
  plays: number;
};

export type SpeakRate = 1 | 1.2 | 1.5 | 2;

export const SPEAK_RATES: readonly SpeakRate[] = [1, 1.2, 1.5, 2];

export const DEFAULT_SPEAK_RATE: SpeakRate = 1.5;

export function formatSpeakRate(rate: SpeakRate): string {
  return `${rate}×`;
}

export type PassageSpeechController = {
  stop: () => void;
  done: Promise<void>;
  setRate: (rate: SpeakRate) => void;
};

type PlayPassageOptions = {
  onProgress?: (progress: RepeatProgress) => void;
  /** Pause between repeats so back-to-back plays are easier to follow. */
  gapMs?: number;
  /** SpeechSynthesis utterance rate (1 = normal). */
  rate?: SpeakRate;
};

/**
 * Speak `text` once, or loop it `times` with a short gap between plays.
 * Callers can cancel via the returned controller.
 * `setRate` applies on the next utterance chunk (Web Speech has no live rate).
 */
export function playPassageSpeech(
  text: string,
  times: SpeakRepeatCount,
  options: PlayPassageOptions = {},
): PassageSpeechController {
  const {
    onProgress,
    gapMs = DEFAULT_REPEAT_GAP_MS,
    rate = DEFAULT_SPEAK_RATE,
  } = options;
  const signal = { cancelled: false };
  let gapTimer: ReturnType<typeof setTimeout> | null = null;
  const rateRef = { current: rate };

  const stop = () => {
    signal.cancelled = true;
    if (gapTimer) clearTimeout(gapTimer);
    if (speechSupported()) window.speechSynthesis.cancel();
  };

  const setRate = (next: SpeakRate) => {
    rateRef.current = next;
  };

  const chunks = splitForSpeech(text);

  const done = (async () => {
    if (!speechSupported() || chunks.length === 0) return;

    for (let play = 1; play <= times; play += 1) {
      if (signal.cancelled) return;
      onProgress?.({ play, plays: times });
      await speakChunks(chunks, {
        signal,
        getRate: () => rateRef.current,
      });
      if (signal.cancelled || play >= times) return;

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

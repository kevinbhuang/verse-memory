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
  onChunkStart?: (index: number, total: number) => void;
  signal?: { cancelled: boolean };
};

function speakChunks(
  chunks: string[],
  options: SpeakOptions = {},
): Promise<void> {
  const { rate = 1, onChunkStart, signal } = options;

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
      utterance.rate = rate;
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

export type SpeakRate = 1 | 1.1 | 1.2 | 1.3 | 1.4 | 1.5 | 2;

export const SPEAK_RATES: readonly SpeakRate[] = [
  1, 1.1, 1.2, 1.3, 1.4, 1.5, 2,
];

export function formatSpeakRate(rate: SpeakRate): string {
  return rate === 1 ? '1×' : rate === 2 ? '2×' : `${rate}×`;
}

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
 */
export function playPassageSpeech(
  text: string,
  times: SpeakRepeatCount,
  options: PlayPassageOptions = {},
): { stop: () => void; done: Promise<void> } {
  const { onProgress, gapMs = DEFAULT_REPEAT_GAP_MS, rate = 1 } = options;
  const signal = { cancelled: false };
  let gapTimer: ReturnType<typeof setTimeout> | null = null;

  const stop = () => {
    signal.cancelled = true;
    if (gapTimer) clearTimeout(gapTimer);
    if (speechSupported()) window.speechSynthesis.cancel();
  };

  const chunks = splitForSpeech(text);

  const done = (async () => {
    if (!speechSupported() || chunks.length === 0) return;

    for (let play = 1; play <= times; play += 1) {
      if (signal.cancelled) return;
      onProgress?.({ play, plays: times });
      await speakChunks(chunks, { signal, rate });
      if (signal.cancelled || play >= times) return;

      await new Promise<void>((resolve) => {
        gapTimer = setTimeout(() => {
          gapTimer = null;
          resolve();
        }, gapMs);
      });
    }
  })();

  return { stop, done };
}

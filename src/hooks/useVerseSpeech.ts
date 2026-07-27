import { useCallback, useEffect, useRef, useState } from 'react';
import {
  playPassageSpeech,
  speechSupported,
  type SpeakRate,
  type SpeakRepeatCount,
} from '@/lib/speech/speak';

export type VerseSpeechState = {
  supported: boolean;
  playing: boolean;
  playIndex: number;
  playTotal: number;
  rate: SpeakRate;
  setRate: (rate: SpeakRate) => void;
  play: (times?: SpeakRepeatCount) => void;
  stop: () => void;
};

/**
 * Play a passage aloud with optional 5× / 10× repeats for listening practice.
 * Stops automatically when `key` changes (next card) or the component unmounts.
 */
export function useVerseSpeech(text: string, key: string): VerseSpeechState {
  const [supported] = useState(() => speechSupported());
  const [playing, setPlaying] = useState(false);
  const [playIndex, setPlayIndex] = useState(0);
  const [playTotal, setPlayTotal] = useState(0);
  const [rate, setRate] = useState<SpeakRate>(1);
  const rateRef = useRef(rate);
  rateRef.current = rate;
  const stopRef = useRef<(() => void) | null>(null);

  const stop = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
    setPlaying(false);
    setPlayIndex(0);
    setPlayTotal(0);
  }, []);

  useEffect(() => {
    stop();
  }, [key, stop]);

  useEffect(() => () => stop(), [stop]);

  const play = useCallback(
    (times: SpeakRepeatCount = 1) => {
      if (!speechSupported()) return;

      stopRef.current?.();
      setPlaying(true);
      setPlayTotal(times);
      setPlayIndex(1);

      const controller = playPassageSpeech(text, times, {
        rate: rateRef.current,
        onProgress: (progress) => {
          setPlayIndex(progress.play);
          setPlayTotal(progress.plays);
        },
      });
      stopRef.current = controller.stop;

      void controller.done.finally(() => {
        if (stopRef.current === controller.stop) {
          stopRef.current = null;
          setPlaying(false);
          setPlayIndex(0);
          setPlayTotal(0);
        }
      });
    },
    [text],
  );

  return {
    supported,
    playing,
    playIndex,
    playTotal,
    rate,
    setRate,
    play,
    stop,
  };
}

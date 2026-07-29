import { useCallback, useEffect, useRef, useState } from 'react';
import { playPassageEsvAudio } from '@/lib/speech/esvAudio';
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
 * Play a passage aloud: prefer Crossway ESV audio when a reference is given,
 * otherwise (or on failure) fall back to browser text-to-speech.
 */
export function useVerseSpeech(
  text: string,
  key: string,
  reference?: string,
): VerseSpeechState {
  const [supported] = useState(() => true);
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
      stopRef.current?.();
      setPlaying(true);
      setPlayTotal(times);
      setPlayIndex(1);

      const onProgress = (progress: { play: number; plays: number }) => {
        setPlayIndex(progress.play);
        setPlayTotal(progress.plays);
      };

      const finishIfCurrent = (controllerStop: () => void) => {
        if (stopRef.current === controllerStop) {
          stopRef.current = null;
          setPlaying(false);
          setPlayIndex(0);
          setPlayTotal(0);
        }
      };

      const startTts = () => {
        if (!speechSupported()) {
          setPlaying(false);
          setPlayIndex(0);
          setPlayTotal(0);
          return;
        }
        const controller = playPassageSpeech(text, times, {
          rate: rateRef.current,
          onProgress,
        });
        stopRef.current = controller.stop;
        void controller.done.finally(() => finishIfCurrent(controller.stop));
      };

      if (reference) {
        const controller = playPassageEsvAudio(reference, times, {
          rate: rateRef.current,
          onProgress,
        });
        stopRef.current = controller.stop;
        void controller.done
          .then(() => finishIfCurrent(controller.stop))
          .catch(() => {
            if (stopRef.current !== controller.stop) return;
            startTts();
          });
        return;
      }

      startTts();
    },
    [reference, text],
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

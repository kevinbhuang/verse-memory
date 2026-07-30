import { useCallback, useEffect, useRef, useState } from 'react';
import { playPassageEsvAudio } from '@/lib/speech/esvAudio';
import {
  DEFAULT_SPEAK_RATE,
  playPassageSpeech,
  speechSupported,
  type SpeakRate,
  type SpeakRepeatCount,
} from '@/lib/speech/speak';

export type VerseSpeechState = {
  supported: boolean;
  playing: boolean;
  looping: boolean;
  playIndex: number;
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
  const [looping, setLooping] = useState(false);
  const [playIndex, setPlayIndex] = useState(0);
  const [rate, setRateState] = useState<SpeakRate>(DEFAULT_SPEAK_RATE);
  const rateRef = useRef(rate);
  rateRef.current = rate;
  const stopRef = useRef<(() => void) | null>(null);
  const liveSetRateRef = useRef<((next: SpeakRate) => void) | null>(null);

  const stop = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
    liveSetRateRef.current = null;
    setPlaying(false);
    setLooping(false);
    setPlayIndex(0);
  }, []);

  const setRate = useCallback((next: SpeakRate) => {
    setRateState(next);
    rateRef.current = next;
    liveSetRateRef.current?.(next);
  }, []);

  useEffect(() => {
    stop();
  }, [key, stop]);

  useEffect(() => () => stop(), [stop]);

  const play = useCallback(
    (times: SpeakRepeatCount = 1) => {
      stopRef.current?.();
      liveSetRateRef.current = null;
      const isLoop = times === 'loop';
      setPlaying(true);
      setLooping(isLoop);
      setPlayIndex(1);

      const onProgress = (progress: { play: number; plays: number | 'loop' }) => {
        setPlayIndex(progress.play);
        setLooping(progress.plays === 'loop');
      };

      const finishIfCurrent = (controllerStop: () => void) => {
        if (stopRef.current === controllerStop) {
          stopRef.current = null;
          liveSetRateRef.current = null;
          setPlaying(false);
          setLooping(false);
          setPlayIndex(0);
        }
      };

      const startTts = () => {
        if (!speechSupported()) {
          setPlaying(false);
          setLooping(false);
          setPlayIndex(0);
          return;
        }
        const controller = playPassageSpeech(text, times, {
          rate: rateRef.current,
          onProgress,
        });
        stopRef.current = controller.stop;
        liveSetRateRef.current = controller.setRate;
        void controller.done.finally(() => finishIfCurrent(controller.stop));
      };

      if (reference) {
        const controller = playPassageEsvAudio(reference, times, {
          rate: rateRef.current,
          onProgress,
        });
        stopRef.current = controller.stop;
        liveSetRateRef.current = controller.setRate;
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
    looping,
    playIndex,
    rate,
    setRate,
    play,
    stop,
  };
}

import { useEffect, useRef, useState } from 'react';
import { Mic } from 'lucide-react';

type Phase = 'idle' | 'recording' | 'preview';

function pickRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) {
    return undefined;
  }
  return [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg',
  ].find((type) => MediaRecorder.isTypeSupported(type));
}

function recordingSupported(): boolean {
  return (
    typeof MediaRecorder !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

/**
 * In-memory self-test recorder. Audio never hits storage and is discarded
 * when the passage changes or the page unmounts.
 */
export function SelfTestRecorder({
  passageKey,
  className,
}: {
  passageKey: string;
  className?: string;
}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const urlRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const discardRecordingRef = useRef(false);

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const stopPlayback = (updateState = true) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
      audioRef.current = null;
    }
    if (updateState) setPlaying(false);
  };

  const releaseResources = () => {
    discardRecordingRef.current = true;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch {
        // Already stopped.
      }
    }
    recorderRef.current = null;
    chunksRef.current = [];
    stopTracks();
    stopPlayback(false);
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  };

  const resetUi = () => {
    setPhase('idle');
    setPlaying(false);
    setError(null);
  };

  useEffect(() => {
    discardRecordingRef.current = false;
    setPhase('idle');
    setPlaying(false);
    setError(null);
    return () => {
      releaseResources();
    };
    // Recreate the session when the card changes; cleanup must not setState.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- passage-scoped capture
  }, [passageKey]);

  useEffect(() => {
    const onLeave = () => {
      releaseResources();
    };
    window.addEventListener('pagehide', onLeave);
    return () => window.removeEventListener('pagehide', onLeave);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable listeners
  }, []);

  const startRecording = async () => {
    setError(null);
    if (!recordingSupported()) {
      setError('Recording isn’t available in this browser.');
      return;
    }

    discardRecordingRef.current = false;
    stopPlayback();
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (discardRecordingRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const mimeType = pickRecorderMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        stopTracks();
        setError('Could not record audio. Try again.');
        setPhase('idle');
      };
      recorder.onstop = () => {
        stopTracks();
        recorderRef.current = null;
        if (discardRecordingRef.current) {
          chunksRef.current = [];
          return;
        }
        const type = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type });
        chunksRef.current = [];
        if (blob.size === 0) {
          setError('Nothing was recorded. Try again.');
          setPhase('idle');
          return;
        }
        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        setPhase('preview');
      };
      recorderRef.current = recorder;
      recorder.start();
      setPhase('recording');
    } catch {
      stopTracks();
      setError('Microphone permission is needed to record a self-test.');
      setPhase('idle');
    }
  };

  const stopRecording = () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
  };

  const playRecording = async () => {
    if (!urlRef.current) return;
    stopPlayback();
    const audio = new Audio(urlRef.current);
    audioRef.current = audio;
    audio.onended = () => setPlaying(false);
    try {
      await audio.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
      setError('Could not play the recording.');
    }
  };

  const linkClass =
    'text-ink-muted underline-offset-2 hover:text-ink hover:underline';

  return (
    <div
      className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-subtle ${className ?? ''}`}
    >
      <Mic className="size-3 shrink-0 opacity-70" aria-hidden="true" />
      {phase === 'idle' ? (
        <button
          type="button"
          onClick={() => void startRecording()}
          className={linkClass}
        >
          Record to self-test
        </button>
      ) : null}
      {phase === 'recording' ? (
        <>
          <span className="font-medium text-danger" aria-live="polite">
            Recording
          </span>
          <button type="button" onClick={stopRecording} className={linkClass}>
            Stop
          </button>
        </>
      ) : null}
      {phase === 'preview' ? (
        <>
          {playing ? (
            <button type="button" onClick={() => stopPlayback()} className={linkClass}>
              Stop playback
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void playRecording()}
              className={linkClass}
            >
              Play recording
            </button>
          )}
          <span className="text-ink-subtle/50" aria-hidden="true">
            ·
          </span>
          <button
            type="button"
            onClick={() => {
              resetUi();
              void startRecording();
            }}
            className={linkClass}
          >
            Re-record
          </button>
        </>
      ) : null}
      {error ? (
        <span className="text-ink-subtle" role="status">
          {error}
        </span>
      ) : null}
    </div>
  );
}

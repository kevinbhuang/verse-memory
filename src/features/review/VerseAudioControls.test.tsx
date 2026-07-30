import { describe, expect, it, vi, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { playPassageSpeech, splitForSpeech } from '@/lib/speech/speak';
import { VerseAudioControls } from './VerseAudioControls';

type UtteranceListener = ((event?: { error?: string }) => void) | null;

class FakeUtterance {
  text: string;
  rate = 1;
  lang = 'en-US';
  voice: SpeechSynthesisVoice | null = null;
  onend: UtteranceListener = null;
  onerror: UtteranceListener = null;

  constructor(text: string) {
    this.text = text;
  }
}

function installSpeechMock(autoEnd = true) {
  const spoken: string[] = [];

  const synthesis = {
    speak(utterance: FakeUtterance) {
      spoken.push(utterance.text);
      if (autoEnd) queueMicrotask(() => utterance.onend?.());
    },
    cancel: vi.fn(),
    getVoices: () => [],
  };

  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: synthesis,
  });
  Object.defineProperty(window, 'SpeechSynthesisUtterance', {
    configurable: true,
    value: FakeUtterance,
  });

  return { spoken, synthesis };
}

afterEach(() => {
  // Avoid leaking synthesis mocks across files.
  Reflect.deleteProperty(window, 'speechSynthesis');
});

describe('splitForSpeech', () => {
  it('keeps a short sentence intact', () => {
    expect(splitForSpeech('Jesus wept.')).toEqual(['Jesus wept.']);
  });

  it('splits multi-sentence passages', () => {
    const text =
      'For God so loved the world, that he gave his only Son. Whoever believes in him should not perish.';
    expect(splitForSpeech(text)).toEqual([
      'For God so loved the world, that he gave his only Son.',
      'Whoever believes in him should not perish.',
    ]);
  });
});

describe('playPassageSpeech', () => {
  it('loops the passage until stopped', async () => {
    const { spoken } = installSpeechMock();
    const progress: Array<{ play: number; plays: number | 'loop' }> = [];

    const { stop, done } = playPassageSpeech('Jesus wept.', 'loop', {
      gapMs: 0,
      onProgress: (entry) => {
        progress.push(entry);
        // Stop once the 4th play begins so the first three finished speaking.
        if (entry.play >= 4) stop();
      },
    });
    await done;

    expect(spoken.length).toBeGreaterThanOrEqual(3);
    expect(progress.slice(0, 3)).toEqual([
      { play: 1, plays: 'loop' },
      { play: 2, plays: 'loop' },
      { play: 3, plays: 'loop' },
    ]);
  });
});

describe('VerseAudioControls', () => {
  it('plays the passage once', async () => {
    const { spoken } = installSpeechMock();
    const { user } = renderWithProviders(
      <VerseAudioControls text="Jesus wept." passageKey="v1" />,
    );

    await user.click(screen.getByRole('button', { name: /play passage once/i }));

    await waitFor(() => {
      expect(spoken).toEqual(['Jesus wept.']);
    });
  });

  it('falls back to speech when ESV audio cannot load', async () => {
    const { spoken } = installSpeechMock();
    class FailingAudio {
      playbackRate = 1;
      preload = 'auto';
      onended: (() => void) | null = null;
      onerror: (() => void) | null = null;
      play() {
        queueMicrotask(() => this.onerror?.());
        return Promise.resolve();
      }
      pause() {}
      load() {}
      removeAttribute() {}
    }
    vi.stubGlobal('Audio', FailingAudio);

    const { user } = renderWithProviders(
      <VerseAudioControls
        text="Jesus wept."
        reference="John 11:35"
        passageKey="v1"
      />,
    );

    await user.click(screen.getByRole('button', { name: /play passage once/i }));

    await waitFor(() => {
      expect(spoken).toEqual(['Jesus wept.']);
    });
    vi.unstubAllGlobals();
  });

  it('offers playback speed options including 1.2×', async () => {
    installSpeechMock();
    renderWithProviders(
      <VerseAudioControls text="Jesus wept." passageKey="v1" />,
    );

    expect(
      screen.getByRole('button', { name: /play passage on repeat/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /play passage 5 times/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /play passage 10 times/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: /playback speed/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /playback speed 1\.2×/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /playback speed 1\.5×/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /playback speed 2×/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /playback speed 1\.5×/i }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('defaults to 1.5× playback speed', async () => {
    const { spoken } = installSpeechMock();
    const rates: number[] = [];
    const originalSpeak = window.speechSynthesis.speak.bind(window.speechSynthesis);
    window.speechSynthesis.speak = ((utterance: FakeUtterance) => {
      rates.push(utterance.rate);
      originalSpeak(utterance as unknown as SpeechSynthesisUtterance);
    }) as typeof window.speechSynthesis.speak;

    const { user } = renderWithProviders(
      <VerseAudioControls text="Jesus wept." passageKey="v1" />,
    );

    await user.click(screen.getByRole('button', { name: /play passage once/i }));

    await waitFor(() => {
      expect(spoken).toEqual(['Jesus wept.']);
    });
    expect(rates).toEqual([1.5]);
  });

  it('plays at the selected speed', async () => {
    const { spoken } = installSpeechMock();
    const rates: number[] = [];
    const originalSpeak = window.speechSynthesis.speak.bind(window.speechSynthesis);
    window.speechSynthesis.speak = ((utterance: FakeUtterance) => {
      rates.push(utterance.rate);
      originalSpeak(utterance as unknown as SpeechSynthesisUtterance);
    }) as typeof window.speechSynthesis.speak;

    const { user } = renderWithProviders(
      <VerseAudioControls text="Jesus wept." passageKey="v1" />,
    );

    await user.click(screen.getByRole('button', { name: /playback speed 1\.2×/i }));
    await user.click(screen.getByRole('button', { name: /play passage once/i }));

    await waitFor(() => {
      expect(spoken).toEqual(['Jesus wept.']);
    });
    expect(rates).toEqual([1.2]);
  });

  it('can change ESV playback speed while playing', async () => {
    installSpeechMock();
    class PlayingAudio {
      playbackRate = 1;
      preload = 'auto';
      onended: (() => void) | null = null;
      onerror: (() => void) | null = null;
      play() {
        return Promise.resolve();
      }
      pause() {}
      load() {}
      removeAttribute() {}
    }
    const instances: PlayingAudio[] = [];
    vi.stubGlobal(
      'Audio',
      class extends PlayingAudio {
        constructor() {
          super();
          instances.push(this);
        }
      },
    );

    const { user } = renderWithProviders(
      <VerseAudioControls
        text="Jesus wept."
        reference="John 11:35"
        passageKey="v1"
      />,
    );

    await user.click(screen.getByRole('button', { name: /play passage once/i }));
    await waitFor(() => {
      expect(instances[0]?.playbackRate).toBe(1.5);
    });

    await user.click(screen.getByRole('button', { name: /playback speed 2×/i }));
    expect(instances[0]?.playbackRate).toBe(2);

    await user.click(screen.getByRole('button', { name: /stop/i }));
    vi.unstubAllGlobals();
  });

  it('can stop mid-loop', async () => {
    const { synthesis } = installSpeechMock(false);
    const { user } = renderWithProviders(
      <VerseAudioControls text="Jesus wept." passageKey="v1" />,
    );

    await user.click(screen.getByRole('button', { name: /play passage on repeat/i }));
    expect(await screen.findByRole('button', { name: /stop/i })).toBeInTheDocument();
    expect(screen.getByText(/^on repeat/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /stop/i }));
    expect(synthesis.cancel).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /play passage once/i })).toBeInTheDocument();
  });
});

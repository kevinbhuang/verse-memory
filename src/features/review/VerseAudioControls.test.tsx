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
  it('loops the passage the requested number of times', async () => {
    const { spoken } = installSpeechMock();
    const progress: Array<{ play: number; plays: number }> = [];

    const { done } = playPassageSpeech('Jesus wept.', 5, {
      gapMs: 0,
      onProgress: (entry) => progress.push(entry),
    });
    await done;

    expect(spoken).toEqual([
      'Jesus wept.',
      'Jesus wept.',
      'Jesus wept.',
      'Jesus wept.',
      'Jesus wept.',
    ]);
    expect(progress).toEqual([
      { play: 1, plays: 5 },
      { play: 2, plays: 5 },
      { play: 3, plays: 5 },
      { play: 4, plays: 5 },
      { play: 5, plays: 5 },
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

  it('offers playback speed options', async () => {
    installSpeechMock();
    renderWithProviders(
      <VerseAudioControls text="Jesus wept." passageKey="v1" />,
    );

    expect(
      screen.getByRole('button', { name: /play passage 5 times/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /play passage 10 times/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: /playback speed/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /playback speed 1\.5×/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /playback speed 2×/i }),
    ).toBeInTheDocument();
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

    await user.click(screen.getByRole('button', { name: /playback speed 1\.5×/i }));
    await user.click(screen.getByRole('button', { name: /play passage once/i }));

    await waitFor(() => {
      expect(spoken).toEqual(['Jesus wept.']);
    });
    expect(rates).toEqual([1.5]);
  });

  it('can stop mid-loop', async () => {
    const { synthesis } = installSpeechMock(false);
    const { user } = renderWithProviders(
      <VerseAudioControls text="Jesus wept." passageKey="v1" />,
    );

    await user.click(screen.getByRole('button', { name: /play passage 5 times/i }));
    expect(await screen.findByRole('button', { name: /stop/i })).toBeInTheDocument();
    expect(screen.getByText(/1\/5/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /stop/i }));
    expect(synthesis.cancel).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /play passage once/i })).toBeInTheDocument();
  });
});

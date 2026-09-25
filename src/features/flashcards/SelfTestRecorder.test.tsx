import { describe, expect, it, vi, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { SelfTestRecorder } from './SelfTestRecorder';

type RecorderHandler = (() => void) | null;
type DataHandler = ((event: { data: Blob }) => void) | null;

class FakeMediaRecorder {
  static isTypeSupported = () => true;
  mimeType = 'audio/webm';
  state: 'inactive' | 'recording' = 'inactive';
  ondataavailable: DataHandler = null;
  onstop: RecorderHandler = null;
  onerror: RecorderHandler = null;

  start() {
    this.state = 'recording';
  }

  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({
      data: new Blob(['self-test'], { type: 'audio/webm' }),
    });
    this.onstop?.();
  }
}

function installMediaMocks() {
  const trackStop = vi.fn();
  const stream = {
    getTracks: () => [{ stop: trackStop }],
  };
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: vi.fn().mockResolvedValue(stream),
    },
  });
  Object.defineProperty(window, 'MediaRecorder', {
    configurable: true,
    value: FakeMediaRecorder,
  });
  URL.createObjectURL = vi.fn(() => 'blob:self-test');
  URL.revokeObjectURL = vi.fn();
  return {
    trackStop,
    createObjectURL: URL.createObjectURL as ReturnType<typeof vi.fn>,
    revokeObjectURL: URL.revokeObjectURL as ReturnType<typeof vi.fn>,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, 'mediaDevices');
  Reflect.deleteProperty(window, 'MediaRecorder');
});

describe('SelfTestRecorder', () => {
  it('records, then offers playback, and discards the blob on unmount', async () => {
    const { trackStop, createObjectURL, revokeObjectURL } = installMediaMocks();
    const { user, unmount } = renderWithProviders(
      <SelfTestRecorder passageKey="verse-001" />,
    );

    await user.click(
      screen.getByRole('button', { name: /record to self-test/i }),
    );
    expect(await screen.findByText(/^recording$/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^stop$/i }));
    expect(
      await screen.findByRole('button', { name: /play recording/i }),
    ).toBeInTheDocument();
    expect(createObjectURL).toHaveBeenCalled();

    unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:self-test');
    expect(trackStop).toHaveBeenCalled();
  });

  it('deletes the recording when the passage changes', async () => {
    const { revokeObjectURL } = installMediaMocks();
    const { user, rerender } = renderWithProviders(
      <SelfTestRecorder passageKey="verse-001" />,
    );

    await user.click(
      screen.getByRole('button', { name: /record to self-test/i }),
    );
    await user.click(await screen.findByRole('button', { name: /^stop$/i }));
    await screen.findByRole('button', { name: /play recording/i });

    rerender(<SelfTestRecorder passageKey="verse-002" />);
    await waitFor(() => {
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:self-test');
    });
    expect(
      screen.getByRole('button', { name: /record to self-test/i }),
    ).toBeInTheDocument();
  });

  it('deletes the recording on pagehide', async () => {
    const { revokeObjectURL } = installMediaMocks();
    const { user } = renderWithProviders(
      <SelfTestRecorder passageKey="verse-001" />,
    );

    await user.click(
      screen.getByRole('button', { name: /record to self-test/i }),
    );
    await user.click(await screen.findByRole('button', { name: /^stop$/i }));
    await screen.findByRole('button', { name: /play recording/i });

    window.dispatchEvent(new Event('pagehide'));
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:self-test');
  });
});

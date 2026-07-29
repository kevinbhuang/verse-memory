import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { requireVerse } from '@/data/verses';
import { getProgress } from '@/services/progressService';
import { recordReview } from '@/services/reviewService';
import {
  normalizeSpace,
  renderWithProviders,
  visibleText,
} from '@/test/render';
import type { ModeResult } from '@/types';
import { VerseDetailPage } from './VerseDetailPage';

const verse = requireVerse('verse-004');
const passage = normalizeSpace(verse.text);

async function renderDetail(verseId = verse.id) {
  const view = renderWithProviders(<VerseDetailPage />, {
    route: `/verses/${verseId}`,
    path: '/verses/:verseId',
  });
  await screen.findByRole('heading', { name: requireVerse(verseId).reference });
  return view;
}

const modeResult = (overrides: Partial<ModeResult> = {}): ModeResult => ({
  mode: 'first-letter',
  accuracy: 0.85,
  elapsedMs: 24_000,
  incorrectCount: 2,
  hintCount: 1,
  fullRevealUsed: false,
  wordErrors: [],
  suggestedRating: 'hard',
  ...overrides,
});

describe('VerseDetailPage', () => {
  it('shows the passage exactly as written, with its metadata', async () => {
    await renderDetail();

    expect(visibleText()).toContain(passage);
    expect(screen.getByText(verse.section)).toBeInTheDocument();
    expect(screen.getByText('ESV')).toBeInTheDocument();
    expect(screen.getByText('Passage 004 of 171')).toBeInTheDocument();
  });

  it('marks the passage memorized from the detail page', async () => {
    const { user } = await renderDetail();

    await user.click(screen.getByRole('button', { name: /mark as memorized/i }));

    await waitFor(async () => {
      expect((await getProgress(verse.id)).isMemorized).toBe(true);
    });
    expect(
      await screen.findByRole('button', { name: /unmark as memorized/i }),
    ).toBeInTheDocument();
  });

  it('flags and unflags the passage as difficult', async () => {
    const { user } = await renderDetail();

    await user.click(screen.getByRole('button', { name: /mark difficult/i }));
    await waitFor(async () => {
      expect((await getProgress(verse.id)).isDifficult).toBe(true);
    });

    await user.click(
      await screen.findByRole('button', { name: /remove difficult flag/i }),
    );
    await waitFor(async () => {
      expect((await getProgress(verse.id)).isDifficult).toBe(false);
    });
  });

  it('offers practice without notes or speak mode', async () => {
    await renderDetail();

    expect(screen.getByRole('button', { name: /^practice$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^speak$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add note/i })).not.toBeInTheDocument();
    expect(visibleText()).toContain(passage);
  });

  it('reports the review history and the schedule', async () => {
    await recordReview({
      verseId: verse.id,
      rating: 'hard',
      result: modeResult(),
      settings: { maximumIntervalDays: 365, difficultVerseIntervalDays: 7 },
    });

    await renderDetail();

    expect(await screen.findByText(/1 recorded review\./)).toBeInTheDocument();
    expect(screen.getByText(/Letter typing · hard · 85%/)).toBeInTheDocument();
    expect(screen.getAllByText('Tomorrow').length).toBeGreaterThan(0);
  });

  it('confirms before resetting the passage', async () => {
    const { user } = await renderDetail();

    await user.click(screen.getByRole('button', { name: /reset progress/i }));

    expect(
      await screen.findByText(new RegExp(`reset ${verse.reference}`, 'i')),
    ).toBeInTheDocument();
  });

  it('says so plainly when the passage does not exist', async () => {
    renderWithProviders(<VerseDetailPage />, {
      route: '/verses/verse-999',
      path: '/verses/:verseId',
    });

    expect(
      await screen.findByRole('heading', { name: /passage not found/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/the collection contains passages 1 to 171/i),
    ).toBeInTheDocument();
  });
});

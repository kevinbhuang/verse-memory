import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { subDays } from 'date-fns';
import { requireVerse } from '@/data/verses';
import { setDifficult, setMemorized } from '@/services/progressService';
import { recordReview } from '@/services/reviewService';
import { renderWithProviders } from '@/test/render';
import type { ModeResult } from '@/types';
import { DashboardPage } from './DashboardPage';

const SETTINGS = { maximumIntervalDays: 365, difficultVerseIntervalDays: 7 };

const modeResult = (overrides: Partial<ModeResult> = {}): ModeResult => ({
  mode: 'flashcard',
  accuracy: 1,
  elapsedMs: 9_000,
  incorrectCount: 0,
  hintCount: 0,
  fullRevealUsed: false,
  wordErrors: [],
  suggestedRating: 'good',
  ...overrides,
});

async function renderDashboard() {
  const view = renderWithProviders(<DashboardPage />);
  await screen.findByRole('heading', { name: /verse memory/i });
  return view;
}

describe('DashboardPage', () => {
  it('starts from an honest zero state', async () => {
    await renderDashboard();

    expect(screen.getByText('0 of 171')).toBeInTheDocument();
    expect(screen.getByText('0.0%')).toBeInTheDocument();
    expect(screen.getByText(/no reviews yet/i)).toBeInTheDocument();
    expect(screen.getByText('Never')).toBeInTheDocument();
  });

  it('answers the four questions the dashboard exists to answer', async () => {
    await setMemorized('verse-001', true, subDays(new Date(), 5));
    await setMemorized('verse-002', true, subDays(new Date(), 5));
    await setDifficult('verse-003', true);

    await renderDashboard();

    expect(await screen.findByText('2 of 171')).toBeInTheDocument();

    const numbers = screen.getByRole('region', { name: /key numbers/i });
    expect(within(numbers).getByText('Overdue').closest('a')).toHaveAttribute(
      'href',
      '/review?source=overdue',
    );
    expect(
      within(numbers).getByText('Difficult').closest('a'),
    ).toHaveTextContent('Difficult1');
  });

  it('lists the seven sections in canonical order', async () => {
    await renderDashboard();

    const labels = screen
      .getAllByText(/^(Law and History|Wisdom and Poetry|Prophets|Gospels|Acts|Paul’s Epistles|General Epistles and Revelation)$/)
      .map((node) => node.textContent);

    expect(labels).toEqual([
      'Law and History',
      'Wisdom and Poetry',
      'Prophets',
      'Gospels',
      'Acts',
      'Paul’s Epistles',
      'General Epistles and Revelation',
    ]);
    expect(screen.getByText('0/7')).toBeInTheDocument();
    expect(screen.getByText('0/31')).toBeInTheDocument();
  });

  it('shows recent reviews and a seven-day forecast', async () => {
    const verse = requireVerse('verse-010');
    await recordReview({
      verseId: verse.id,
      rating: 'good',
      result: modeResult(),
      settings: SETTINGS,
    });

    await renderDashboard();

    expect(await screen.findByText(verse.reference)).toBeInTheDocument();
    expect(screen.getByText(/Flashcard · good · 100%/)).toBeInTheDocument();

    const forecast = screen.getByText(/today: \d+ passages/i);
    expect(forecast.textContent?.split(',')).toHaveLength(7);
  });
});

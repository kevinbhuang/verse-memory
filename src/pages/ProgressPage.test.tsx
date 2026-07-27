import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { requireVerse } from '@/data/verses';
import { tokenize } from '@/lib/text/tokenize';
import { setDifficult, setMemorized } from '@/services/progressService';
import { recordReview } from '@/services/reviewService';
import { renderWithProviders } from '@/test/render';
import type { ModeResult } from '@/types';
import { ProgressPage } from './ProgressPage';

const SETTINGS = { maximumIntervalDays: 365, difficultVerseIntervalDays: 7 };

const modeResult = (overrides: Partial<ModeResult> = {}): ModeResult => ({
  mode: 'first-letter',
  accuracy: 0.6,
  elapsedMs: 30_000,
  incorrectCount: 4,
  hintCount: 2,
  fullRevealUsed: false,
  wordErrors: [
    { wordIndex: 2, expected: 'steadfast', received: 'stedfast', errorType: 'incorrect' },
  ],
  suggestedRating: 'hard',
  ...overrides,
});

async function renderProgress() {
  const view = renderWithProviders(<ProgressPage />);
  await screen.findByRole('heading', { name: 'Progress' });
  return view;
}

describe('ProgressPage', () => {
  it('offers realistic empty states before any practice', async () => {
    await renderProgress();

    expect(screen.getByText(/no review history yet/i)).toBeInTheDocument();
    expect(screen.getByText(/no graded reviews yet/i)).toBeInTheDocument();
    expect(
      screen.getByText(/nothing is flagged as difficult/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/no word-level mistakes recorded/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/there are 171 to work through/i),
    ).toBeInTheDocument();
  });

  it('links every headline number to a filtered view', async () => {
    await renderProgress();

    expect(screen.getByText('Memorized').closest('a')).toHaveAttribute(
      'href',
      '/verses?memorized=memorized',
    );
    expect(screen.getByText('Learning').closest('a')).toHaveAttribute(
      'href',
      '/verses?status=learning',
    );
    expect(screen.getByText('Not started').closest('a')).toHaveAttribute(
      'href',
      '/verses?status=new',
    );
    expect(screen.getByText('Overdue').closest('a')).toHaveAttribute(
      'href',
      '/review?source=overdue',
    );
    expect(screen.getByText('Review these').closest('a')).toHaveAttribute(
      'href',
      '/review?source=weak',
    );
  });

  it('summarises review history, weak words and difficult passages', async () => {
    const verse = requireVerse('verse-014');
    await setMemorized(verse.id, true);
    await setDifficult(verse.id, true);
    await recordReview({
      verseId: verse.id,
      rating: 'again',
      result: modeResult(),
      settings: SETTINGS,
    });

    await renderProgress();

    expect(await screen.findByText('1 reviews total')).toBeInTheDocument();
    expect(screen.getByText(/current streak 1 day/i)).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: /review activity calendar: 1 reviews/i }),
    ).toBeInTheDocument();

    const difficultEntry = screen.getAllByRole('link', {
      name: verse.reference,
    })[0];
    expect(difficultEntry).toHaveAttribute('href', `/verses/${verse.id}`);
    const missedWord = tokenize(verse.text)[2].text;
    expect(screen.getByText(missedWord)).toBeInTheDocument();
    expect(screen.getByText(/word 3 · 1 miss/)).toBeInTheDocument();
  });
});

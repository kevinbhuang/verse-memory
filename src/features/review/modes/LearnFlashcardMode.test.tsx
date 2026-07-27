import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { requireVerse } from '@/data/verses';
import { createDefaultProgress, DEFAULT_SETTINGS } from '@/db/defaults';
import { renderWithProviders } from '@/test/render';
import { LearnFlashcardMode } from './LearnFlashcardMode';

const verse = requireVerse('verse-001');

describe('LearnFlashcardMode', () => {
  it('shows the reference with the passage and offers review options', async () => {
    const onComplete = vi.fn();
    const onPractice = vi.fn();
    const { user } = renderWithProviders(
      <LearnFlashcardMode
        verse={verse}
        progress={createDefaultProgress(verse.id)}
        settings={DEFAULT_SETTINGS}
        wordStats={[]}
        onComplete={onComplete}
        onPractice={onPractice}
        attemptKey="1"
      />,
    );

    expect(screen.getByText(verse.reference)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /first letters/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^audio$/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /first letters/i }));
    expect(onPractice).toHaveBeenCalledWith('first-letter');

    await user.click(screen.getByRole('button', { name: /^audio$/i }));
    expect(onPractice).toHaveBeenCalledWith('voice');

    await user.click(screen.getByRole('button', { name: /rate and continue/i }));
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'learn', suggestedRating: 'good' }),
    );
  });
});

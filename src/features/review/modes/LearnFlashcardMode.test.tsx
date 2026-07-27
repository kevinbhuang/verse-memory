import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { requireVerse } from '@/data/verses';
import { createDefaultProgress, DEFAULT_SETTINGS } from '@/db/defaults';
import { renderWithProviders } from '@/test/render';
import { LearnFlashcardMode } from './LearnFlashcardMode';

const verse = requireVerse('verse-001');

describe('LearnFlashcardMode', () => {
  it('shows the passage first and reveals the reference after flip', async () => {
    const onComplete = vi.fn();
    const { user } = renderWithProviders(
      <LearnFlashcardMode
        verse={verse}
        progress={createDefaultProgress(verse.id)}
        settings={DEFAULT_SETTINGS}
        wordStats={[]}
        onComplete={onComplete}
        attemptKey="1"
      />,
    );

    expect(screen.getByRole('button', { name: /reveal reference/i })).toBeInTheDocument();
    expect(screen.queryByText(verse.reference)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /reveal reference/i }));

    expect(screen.getByText(verse.reference)).toBeInTheDocument();
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'learn', suggestedRating: 'good' }),
    );
  });
});

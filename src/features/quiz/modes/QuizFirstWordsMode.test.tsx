import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { requireVerse } from '@/data/verses';
import { normalizeSpace, renderWithProviders, visibleText } from '@/test/render';
import { QuizFirstWordsMode } from './QuizFirstWordsMode';

const verse = requireVerse('verse-004');

function setup() {
  const onComplete = vi.fn();
  const view = renderWithProviders(
    <QuizFirstWordsMode
      verse={verse}
      attemptKey="attempt-1"
      onComplete={onComplete}
    />,
  );
  return { ...view, onComplete };
}

const wordsField = () => screen.getByLabelText(/^first three words$/i);

describe('QuizFirstWordsMode', () => {
  it('shows the full passage after a miss, not only the first three words', async () => {
    const { user } = setup();

    await user.type(wordsField(), 'has the lord');
    await user.click(screen.getByRole('button', { name: /^check$/i }));

    expect(screen.getByRole('status')).toHaveTextContent(/not quite/i);
    expect(screen.queryByText(/answer:/i)).not.toBeInTheDocument();
    expect(visibleText()).toContain(normalizeSpace(verse.text));
  });

  it('shows the full passage after a correct answer', async () => {
    const { user, onComplete } = setup();

    await user.type(wordsField(), 'Moreover as for');
    await user.click(screen.getByRole('button', { name: /^check$/i }));

    expect(screen.getByRole('status')).toHaveTextContent(/correct/i);
    expect(visibleText()).toContain(normalizeSpace(verse.text));
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({ correct: true }),
    );
  });
});

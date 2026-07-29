import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { requireVerse } from '@/data/verses';
import { firstLetterSkeleton } from '@/lib/text/tokenize';
import {
  normalizeSpace,
  renderWithProviders,
  testProgress,
  testSettings,
  visibleText,
} from '@/test/render';
import { FlashcardMode } from './FlashcardMode';

const verse = requireVerse('verse-045');
const passage = normalizeSpace(verse.text);
const skeleton = firstLetterSkeleton(verse.text);

function setup(settingsOverrides = {}) {
  const onComplete = vi.fn();
  const view = renderWithProviders(
    <FlashcardMode
      verse={verse}
      progress={testProgress(verse.id)}
      settings={testSettings(settingsOverrides)}
      wordStats={[]}
      onComplete={onComplete}
      attemptKey="attempt-1"
    />,
  );
  return { ...view, onComplete };
}

describe('FlashcardMode', () => {
  it('shows the reference and first-letter skeleton while the passage stays hidden', () => {
    setup();

    expect(screen.getByText(verse.reference)).toBeInTheDocument();
    expect(screen.getByText(verse.section)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/first letters of the passage/i),
    ).toHaveTextContent(skeleton);
    expect(visibleText()).not.toContain(passage);
  });

  it('reveals the passage exactly as written when the button is pressed', async () => {
    const { user, onComplete } = setup();

    await user.click(screen.getByRole('button', { name: /reveal passage/i }));

    expect(visibleText()).toContain(passage);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0][0]).toMatchObject({
      mode: 'flashcard',
      accuracy: null,
      fullRevealUsed: false,
      suggestedRating: 'good',
    });
  });

  it('reveals with the space bar', async () => {
    const { user, onComplete } = setup();

    await user.keyboard(' ');

    expect(visibleText()).toContain(passage);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('reveals with Enter', async () => {
    const { user, onComplete } = setup();

    await user.keyboard('{Enter}');

    expect(visibleText()).toContain(passage);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('does not report a second result if the reader presses again', async () => {
    const { user, onComplete } = setup();

    await user.keyboard(' ');
    await user.keyboard(' ');
    await user.keyboard('{Enter}');

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('hides the section label when that setting is off', () => {
    setup({ showSectionLabels: false });
    expect(screen.queryByText(verse.section)).not.toBeInTheDocument();
  });
});

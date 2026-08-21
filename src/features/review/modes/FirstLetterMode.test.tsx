import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { requireVerse } from '@/data/verses';
import { firstLetterSequence, tokenize } from '@/lib/text/tokenize';
import {
  renderWithProviders,
  testProgress,
  testSettings,
  visibleText,
} from '@/test/render';
import type { Settings } from '@/types';
import { FirstLetterMode } from './FirstLetterMode';

// A short passage keeps the typed sequences in these tests readable.
const verse = requireVerse('verse-058');
const tokens = tokenize(verse.text);
const letters = firstLetterSequence(verse.text);

function setup(settingsOverrides: Partial<Settings> = {}) {
  const onComplete = vi.fn();
  const view = renderWithProviders(
    <FirstLetterMode
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

const typingArea = () => screen.getByLabelText(/type the first letter of each word/i);

const progressText = () => screen.getByText(/of \d+ words/).textContent ?? '';

describe('FirstLetterMode', () => {
  it('hides the passage until letters are typed', () => {
    setup();

    expect(screen.getByText(verse.reference)).toBeInTheDocument();
    expect(
      screen.getByText(/type the first letter of the first word to begin/i),
    ).toBeInTheDocument();
    expect(progressText()).toContain(`0 of ${tokens.length} words`);
  });

  it('reveals the next word when the correct letter is typed', async () => {
    const { user } = setup();

    await user.type(typingArea(), letters[0]);

    expect(visibleText()).toContain(tokens[0].text);
    expect(progressText()).toContain(`1 of ${tokens.length} words`);
  });

  it('accepts the letter whatever its case', async () => {
    const { user } = setup();

    await user.type(typingArea(), letters[0].toUpperCase());

    expect(progressText()).toContain(`1 of ${tokens.length} words`);
  });

  it('does not advance on a wrong letter, and counts it', async () => {
    const { user } = setup();
    const wrong = letters[0] === 'z' ? 'q' : 'z';

    await user.type(typingArea(), wrong);

    expect(progressText()).toContain(`0 of ${tokens.length} words`);
    expect(progressText()).toContain('1 wrong keys');
  });

  it('needs one keystroke per word, not per character or punctuation', async () => {
    const { user, onComplete } = setup();

    await user.type(typingArea(), letters.join(''));

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0][0]).toMatchObject({
      mode: 'first-letter',
      accuracy: 1,
      incorrectCount: 0,
      hintCount: 0,
      fullRevealUsed: false,
      suggestedRating: 'easy',
    });
  });

  it('shows the whole passage once every word has been recalled', async () => {
    const { user } = setup();

    await user.type(typingArea(), letters.join(''));

    expect(visibleText()).toContain(verse.text.replace(/\s+/g, ' ').trim());
    expect(screen.getByText(/passage complete/i)).toBeInTheDocument();
  });

  it('records a hint and moves on when the reader asks for one', async () => {
    const { user, onComplete } = setup();

    await user.click(screen.getByRole('button', { name: /^hint$/i }));
    expect(progressText()).toContain('1 hints');

    await user.type(typingArea(), letters.slice(1).join(''));

    expect(onComplete.mock.calls[0][0]).toMatchObject({ hintCount: 1 });
    expect(onComplete.mock.calls[0][0].accuracy).toBeLessThan(1);
    expect(onComplete.mock.calls[0][0].wordErrors).toContainEqual({
      wordIndex: 0,
      expected: tokens[0].text,
      received: null,
      errorType: 'hint',
    });
  });

  it('steps back one word when Backspace is allowed', async () => {
    const { user } = setup({ allowBackspaceInFirstLetter: true });

    await user.type(typingArea(), letters.slice(0, 3).join(''));
    expect(progressText()).toContain(`3 of ${tokens.length} words`);

    await user.type(typingArea(), '{Backspace}');
    expect(progressText()).toContain(`2 of ${tokens.length} words`);
  });

  it('ignores Backspace when the setting is off', async () => {
    const { user } = setup({ allowBackspaceInFirstLetter: false });

    await user.type(typingArea(), letters.slice(0, 3).join(''));
    await user.type(typingArea(), '{Backspace}');

    expect(progressText()).toContain(`3 of ${tokens.length} words`);
    expect(
      screen.queryByRole('button', { name: /back one word/i }),
    ).not.toBeInTheDocument();
  });

  it('treats a full reveal as an assisted review', async () => {
    const { user, onComplete } = setup({ confirmBeforeFullReveal: false });

    await user.type(typingArea(), letters[0]);
    await user.click(screen.getByRole('button', { name: /reveal whole passage/i }));

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0][0]).toMatchObject({
      fullRevealUsed: true,
      suggestedRating: 'again',
    });
    expect(screen.getByText(/recorded as an assisted review/i)).toBeInTheDocument();
  });

  it('confirms before revealing when that setting is on', async () => {
    const { user, onComplete } = setup({ confirmBeforeFullReveal: true });

    await user.click(screen.getByRole('button', { name: /reveal whole passage/i }));
    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.getByText(/reveal the whole passage\?/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^reveal passage$/i }));
    expect(onComplete.mock.calls[0][0].fullRevealUsed).toBe(true);
  });

  it('reveals trailing punctuation as soon as the preceding word is typed', async () => {
    const { user } = setup();
    const withPunct = tokens.findIndex((token, i) => {
      if (i >= tokens.length - 1) return false;
      const gap = verse.text.slice(token.end, tokens[i + 1]!.start);
      return /[.!?;:,]/.test(gap);
    });
    expect(withPunct).toBeGreaterThanOrEqual(0);

    const punctGap = verse.text.slice(
      tokens[withPunct]!.end,
      tokens[withPunct + 1]!.start,
    );
    const punctMark = punctGap.match(/[.!?;:,]/)?.[0];
    expect(punctMark).toBeTruthy();

    await user.type(typingArea(), letters.slice(0, withPunct + 1).join(''));

    expect(visibleText()).toContain(tokens[withPunct]!.text);
    expect(visibleText()).toContain(punctMark!);
    // Next word should not be revealed yet.
    expect(visibleText()).not.toContain(
      `${tokens[withPunct]!.text}${punctGap}${tokens[withPunct + 1]!.text}`,
    );
  });

  it('highlights missed words in the passage after completion', async () => {
    const { user } = setup();
    const wrong = letters[1] === 'z' ? 'q' : 'z';

    await user.type(typingArea(), letters[0]);
    await user.type(typingArea(), wrong);
    await user.type(typingArea(), letters.slice(1).join(''));

    const missed = document.querySelector(`[data-word-index="${1}"]`);
    expect(missed).toBeTruthy();
    expect(missed?.className).toMatch(/bg-(warning|brand|danger)-soft/);
  });

  it('reports which words were missed', async () => {
    const { user, onComplete } = setup();
    const wrong = letters[1] === 'z' ? 'q' : 'z';

    await user.type(typingArea(), letters[0]);
    await user.type(typingArea(), wrong);
    await user.type(typingArea(), letters.slice(1).join(''));

    const result = onComplete.mock.calls[0][0];
    expect(result.incorrectCount).toBe(1);
    expect(result.wordErrors).toContainEqual({
      wordIndex: 1,
      expected: tokens[1].text,
      received: wrong,
      errorType: 'incorrect',
    });
    expect(screen.getByText(new RegExp(`Most missed: ${tokens[1].text}`))).toBeInTheDocument();
  });

  it('shows the first-letter skeleton only when asked', () => {
    const { unmount } = setup({ showFirstLetterSkeleton: true });
    expect(
      screen.getByText(new RegExp(letters.slice(0, 3).join(' '))),
    ).toBeInTheDocument();
    unmount();

    setup({ showFirstLetterSkeleton: false });
    expect(
      screen.queryByText(new RegExp(letters.slice(0, 3).join(' '))),
    ).not.toBeInTheDocument();
  });

  it('offers Retry after completion and restarts the exercise', async () => {
    const onRetry = vi.fn();
    const onComplete = vi.fn();
    const { user } = renderWithProviders(
      <FirstLetterMode
        verse={verse}
        progress={testProgress(verse.id)}
        settings={testSettings()}
        wordStats={[]}
        onComplete={onComplete}
        onRetry={onRetry}
        attemptKey="attempt-1"
      />,
    );

    await user.type(typingArea(), letters.join(''));
    expect(screen.getByText(/passage complete/i)).toBeInTheDocument();
    expect(onComplete).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /^retry$/i }));

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText(/type the first letter of the first word to begin/i),
    ).toBeInTheDocument();
    expect(progressText()).toContain(`0 of ${tokens.length} words`);
  });
});

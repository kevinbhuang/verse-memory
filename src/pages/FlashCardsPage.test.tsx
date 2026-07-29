import { describe, expect, it, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { requireVerse } from '@/data/verses';
import { firstLetterSkeleton } from '@/lib/text/tokenize';
import { renderWithProviders, visibleText } from '@/test/render';
import { FlashCardsPage } from './FlashCardsPage';

const first = requireVerse('verse-001');
const second = requireVerse('verse-002');

describe('FlashCardsPage', () => {
  beforeEach(() => {
    localStorage.removeItem('verse-memory:flashcards-first-letter');
    localStorage.removeItem('verse-memory:flashcards-revealed');
    localStorage.removeItem('verse-memory:flashcards-cue-hidden');
  });

  it('starts on the first passage with the verse shown', async () => {
    renderWithProviders(<FlashCardsPage />, { route: '/flashcards' });

    expect(
      await screen.findByRole('heading', { name: /^flash cards$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: /100 Verses Every Christian Should Know/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(first.reference)).toBeInTheDocument();
    expect(visibleText()).toContain(first.text.slice(0, 24));
    expect(
      screen.queryByLabelText(/first letters of the passage/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /previous passage/i }),
    ).toBeDisabled();
    expect(screen.queryByLabelText(/first letter mode/i)).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: /passage audio/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /play passage once/i }),
    ).toBeInTheDocument();
  });

  it('opens on a deep-linked verse and can move next', async () => {
    const { user } = renderWithProviders(<FlashCardsPage />, {
      route: `/flashcards?verse=${first.id}`,
    });

    expect(await screen.findByText(first.reference)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /next passage/i }));
    expect(await screen.findByText(second.reference)).toBeInTheDocument();
    expect(visibleText()).toMatch(/Hear, O Israel/);
  });

  it('can hide and show the passage with the button or Space', async () => {
    const { user } = renderWithProviders(<FlashCardsPage />, {
      route: `/flashcards?verse=${first.id}`,
    });

    await screen.findByText(first.reference);
    expect(visibleText()).toContain(first.text.slice(0, 24));

    await user.click(screen.getByRole('button', { name: /hide passage/i }));
    expect(visibleText()).not.toContain(first.text.slice(0, 24));

    await user.keyboard(' ');
    expect(visibleText()).toContain(first.text.slice(0, 24));
  });

  it('pressing F twice returns to the full verse', async () => {
    const { user } = renderWithProviders(<FlashCardsPage />, {
      route: `/flashcards?verse=${first.id}`,
    });

    await screen.findByText(first.reference);
    await user.keyboard('f');
    expect(
      screen.getByLabelText(/first letters of the passage/i),
    ).toBeInTheDocument();

    await user.keyboard('f');
    expect(
      screen.queryByLabelText(/first letters of the passage/i),
    ).not.toBeInTheDocument();
    expect(visibleText()).toContain(first.text.slice(0, 24));
  });

  it('pressing Space from first letters hides the cue instead of revealing the verse', async () => {
    const { user } = renderWithProviders(<FlashCardsPage />, {
      route: `/flashcards?verse=${first.id}`,
    });

    await screen.findByText(first.reference);
    await user.keyboard('f');
    expect(
      screen.getByLabelText(/first letters of the passage/i),
    ).toBeInTheDocument();

    await user.keyboard(' ');
    expect(
      screen.queryByLabelText(/first letters of the passage/i),
    ).not.toBeInTheDocument();
    expect(visibleText()).not.toContain(first.text.slice(0, 24));
    expect(visibleText()).toMatch(/hidden/i);

    await user.keyboard(' ');
    expect(
      screen.getByLabelText(/first letters of the passage/i),
    ).toBeInTheDocument();
  });

  it('keeps first-letter and hide preferences when moving to the next verse', async () => {
    const { user } = renderWithProviders(<FlashCardsPage />, {
      route: `/flashcards?verse=${first.id}`,
    });

    await screen.findByText(first.reference);
    await user.keyboard('f');
    expect(
      screen.getByLabelText(/first letters of the passage/i),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /next passage/i }));

    expect(await screen.findByText(second.reference)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/first letters of the passage/i),
    ).toHaveTextContent(
      firstLetterSkeleton(second.text).replace(/\u00A0/g, ' '),
    );
    expect(visibleText()).not.toMatch(/Hear, O Israel/);
  });

  it('toggles Memorized with M and Needs Review with N', async () => {
    const { user } = renderWithProviders(<FlashCardsPage />, {
      route: `/flashcards?verse=${first.id}`,
    });

    await screen.findByText(first.reference);
    const memorized = await screen.findByRole('button', {
      name: /mark memorized/i,
    });
    const needsReview = screen.getByRole('button', {
      name: /mark needs review/i,
    });

    await user.keyboard('m');
    await waitFor(() => expect(memorized).toHaveAttribute('aria-pressed', 'true'));

    await user.keyboard('n');
    await waitFor(() =>
      expect(needsReview).toHaveAttribute('aria-pressed', 'true'),
    );
  });
});

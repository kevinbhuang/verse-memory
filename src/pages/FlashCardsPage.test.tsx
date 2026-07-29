import { describe, expect, it, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { requireVerse } from '@/data/verses';
import { firstLetterSkeleton } from '@/lib/text/tokenize';
import { renderWithProviders, visibleText } from '@/test/render';
import { FlashCardsPage } from './FlashCardsPage';

const first = requireVerse('verse-001');
const second = requireVerse('verse-002');

describe('FlashCardsPage', () => {
  beforeEach(() => {
    localStorage.removeItem('verse-memory:flashcards-first-letter');
  });

  it('starts on the first passage with first-letter mode on by default', async () => {
    renderWithProviders(<FlashCardsPage />, { route: '/flashcards' });

    expect(
      await screen.findByRole('heading', { name: /^flash cards$/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(first.reference)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/first letters of the passage/i),
    ).toHaveTextContent(firstLetterSkeleton(first.text).replace(/\u00A0/g, ' '));
    expect(
      screen.getByRole('button', { name: /previous passage/i }),
    ).toBeDisabled();
  });

  it('opens on a deep-linked verse and can move next', async () => {
    const { user } = renderWithProviders(<FlashCardsPage />, {
      route: `/flashcards?verse=${first.id}`,
    });

    expect(await screen.findByText(first.reference)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /next passage/i }));
    expect(await screen.findByText(second.reference)).toBeInTheDocument();
  });

  it('can turn off first-letter mode and still reveal the passage', async () => {
    const { user } = renderWithProviders(<FlashCardsPage />, {
      route: `/flashcards?verse=${first.id}`,
    });

    await screen.findByText(first.reference);
    await user.click(screen.getByRole('switch', { name: /first letter mode/i }));

    expect(
      screen.queryByLabelText(/first letters of the passage/i),
    ).not.toBeInTheDocument();
    expect(visibleText()).not.toContain(first.text.slice(0, 24));

    await user.click(screen.getByRole('button', { name: /reveal passage/i }));
    expect(visibleText()).toContain(first.text.slice(0, 24));
  });
});

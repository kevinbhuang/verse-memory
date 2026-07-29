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

  it('starts on the first passage with the verse shown', async () => {
    renderWithProviders(<FlashCardsPage />, { route: '/flashcards' });

    expect(
      await screen.findByRole('heading', { name: /^flash cards$/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(first.reference)).toBeInTheDocument();
    expect(visibleText()).toContain(first.text.slice(0, 24));
    expect(
      screen.queryByLabelText(/first letters of the passage/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /previous passage/i }),
    ).toBeDisabled();
    expect(screen.getByLabelText(/first letter mode/i)).not.toBeChecked();
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

  it('can toggle first-letter mode with the checkbox or F', async () => {
    const { user } = renderWithProviders(<FlashCardsPage />, {
      route: `/flashcards?verse=${first.id}`,
    });

    await screen.findByText(first.reference);
    await user.click(screen.getByRole('button', { name: /hide passage/i }));
    await user.click(screen.getByLabelText(/first letter mode/i));

    expect(screen.getByLabelText(/first letter mode/i)).toBeChecked();
    expect(
      screen.getByLabelText(/first letters of the passage/i),
    ).toHaveTextContent(firstLetterSkeleton(first.text).replace(/\u00A0/g, ' '));

    await user.keyboard('f');
    expect(screen.getByLabelText(/first letter mode/i)).not.toBeChecked();
    expect(
      screen.queryByLabelText(/first letters of the passage/i),
    ).not.toBeInTheDocument();
  });
});

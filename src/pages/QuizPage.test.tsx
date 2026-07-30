import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { QuizPage } from './QuizPage';

describe('QuizPage', () => {
  it('lists quiz types and can start a quiz', async () => {
    localStorage.clear();
    const { user } = renderWithProviders(<QuizPage />, { route: '/quiz' });

    expect(
      await screen.findByRole('heading', { name: /^quiz$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /reference.*book and chapter/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /first three words/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /first letters.*first letter of each word/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /fill in the blank/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^books$/i }));
    expect(screen.getByRole('group', { name: /^books$/i })).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /10 passages/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(screen.getByRole('button', { name: /all \d+ passages/i }));
    expect(
      screen.getByRole('button', { name: /all \d+ passages/i }),
    ).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: /all verses/i }));
    expect(screen.getByText(/every passage/i)).toBeInTheDocument();

    expect(screen.getByRole('group', { name: /passage filter/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^memorized$/i }));
    expect(screen.getByRole('button', { name: /^memorized$/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(screen.getByRole('button', { name: /^all$/i }));

    await user.click(screen.getByRole('button', { name: /start quiz/i }));
    await waitFor(() => {
      const keys = Object.keys(localStorage).filter((key) =>
        key.startsWith('verse-memory:quiz:'),
      );
      expect(keys.length).toBeGreaterThan(0);
    });
  });
});

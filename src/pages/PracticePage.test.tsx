import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { requireVerse } from '@/data/verses';
import { getDataStore } from '@/repositories';
import { setDifficult } from '@/services/progressService';
import { createSession } from '@/services/sessionService';
import { renderWithProviders } from '@/test/render';
import { PracticePage } from './PracticePage';

const actsOne = requireVerse('verse-069');
const romansOne = requireVerse('verse-073');

describe('PracticePage', () => {
  it('defaults to learn mode on a deck', async () => {
    renderWithProviders(<PracticePage />, { route: '/practice' });
    await screen.findByRole('heading', { name: /^practice$/i });

    expect(
      screen.getByRole('button', { name: /see the reference and passage/i }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /deck 1/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: /10 passages/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('starts a learn session for a deck', async () => {
    const { user } = renderWithProviders(<PracticePage />, { route: '/practice' });
    await screen.findByRole('heading', { name: /^practice$/i });

    await user.click(screen.getByRole('button', { name: /deck 5/i }));
    await user.click(screen.getByRole('button', { name: /deck 1/i }));
    await user.click(screen.getByRole('button', { name: /^start$/i }));

    await waitFor(async () => {
      const [session] = await getDataStore().sessions.all();
      expect(session.fixedMode).toBe('learn');
      expect(session.verseIds).toContain(actsOne.id);
    });
  });

  it('can select all decks and practice every passage', async () => {
    const { user } = renderWithProviders(<PracticePage />, { route: '/practice' });
    await screen.findByRole('heading', { name: /^practice$/i });

    await user.click(screen.getByRole('button', { name: /select all decks/i }));
    expect(screen.getByText(/all decks selected/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /all 171 passages/i }));
    expect(
      screen.getByRole('button', { name: /all 171 passages/i }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByText(/all 171 passages/i).length).toBeGreaterThan(0);
  });

  it('practices only difficult passages in a deck', async () => {
    await setDifficult(actsOne.id, true);
    const { user } = renderWithProviders(<PracticePage />, { route: '/practice' });
    await screen.findByRole('heading', { name: /^practice$/i });

    await user.click(screen.getByRole('button', { name: /deck 5/i }));
    await user.click(screen.getByRole('button', { name: /deck 1/i }));
    await user.click(screen.getByRole('button', { name: /all \d+ passages/i }));
    await user.click(screen.getByRole('button', { name: /difficult only/i }));
    await user.click(
      screen.getByRole('button', { name: /type the first letter of each word/i }),
    );

    expect(await screen.findByText(/1 passage/i)).toBeInTheDocument();
    expect(screen.getByText(actsOne.reference)).toBeInTheDocument();
  });

  it('can scope to a book', async () => {
    const { user } = renderWithProviders(<PracticePage />, {
      route: '/practice?book=Romans',
    });
    await screen.findByRole('heading', { name: /^practice$/i });

    expect(await screen.findByText(/10 of 14 passages/i)).toBeInTheDocument();
    expect(screen.getByText(romansOne.reference)).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: /type the first letter of each word/i }),
    );
    expect(
      screen.getByRole('button', { name: /type the first letter of each word/i }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('offers to resume an unfinished session', async () => {
    await createSession(
      {
        source: 'section',
        section: 'Acts',
        size: 'all',
        modeStrategy: 'fixed',
        fixedMode: 'first-letter',
      },
      'Practice · Deck 5',
    );

    renderWithProviders(<PracticePage />, { route: '/practice' });

    expect(
      await screen.findByText(/you have an unfinished session/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^resume$/i })).toBeInTheDocument();
  });
});

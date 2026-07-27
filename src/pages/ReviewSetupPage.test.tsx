import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { requireVerse } from '@/data/verses';
import { getDataStore } from '@/repositories';
import { setDifficult } from '@/services/progressService';
import { createSession } from '@/services/sessionService';
import { renderWithProviders } from '@/test/render';
import { LearnPage } from './LearnPage';
import { ReviewSetupPage } from './ReviewSetupPage';

const actsOne = requireVerse('verse-069');
const romansOne = requireVerse('verse-073');

describe('LearnPage', () => {
  it('starts a learn session for a deck', async () => {
    const { user } = renderWithProviders(<LearnPage />, { route: '/learn' });
    await screen.findByRole('heading', { name: /^learn$/i });

    await user.click(screen.getByRole('button', { name: /deck 5/i }));
    await user.click(screen.getByRole('button', { name: /all \(/i }));
    await user.click(screen.getByRole('button', { name: /start learning/i }));

    await waitFor(async () => {
      const [session] = await getDataStore().sessions.all();
      expect(session.fixedMode).toBe('learn');
      expect(session.verseIds).toContain(actsOne.id);
      expect(session.label).toMatch(/Learn/);
    });
  });
});

describe('ReviewSetupPage', () => {
  it('defaults to deck practice with first letters', async () => {
    renderWithProviders(<ReviewSetupPage />, { route: '/review' });
    await screen.findByRole('heading', { name: /^review$/i });

    expect(
      screen.getByRole('button', { name: /first letters/i }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /deck 1/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(
      screen.getByRole('button', { name: /all.*every passage/i }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('reviews only difficult passages in a deck', async () => {
    await setDifficult(actsOne.id, true);
    const { user } = renderWithProviders(<ReviewSetupPage />, { route: '/review' });
    await screen.findByRole('heading', { name: /^review$/i });

    await user.click(screen.getByRole('button', { name: /deck 5/i }));
    await user.click(
      screen.getByRole('button', { name: /difficult.*marked difficult/i }),
    );
    await user.click(screen.getByRole('button', { name: /all matching/i }));

    expect(await screen.findByText(/1 passage/i)).toBeInTheDocument();
    expect(screen.getByText(actsOne.reference)).toBeInTheDocument();
  });

  it('reviews all passages in a book', async () => {
    const { user } = renderWithProviders(<ReviewSetupPage />, {
      route: '/review?book=Romans',
    });
    await screen.findByRole('heading', { name: /^review$/i });

    await user.click(screen.getByRole('button', { name: /all matching/i }));

    expect(await screen.findByText(/14 passages/i)).toBeInTheDocument();
    expect(screen.getByText(romansOne.reference)).toBeInTheDocument();
  });

  it('starts a filtered review session', async () => {
    await setDifficult(actsOne.id, true);
    const { user } = renderWithProviders(<ReviewSetupPage />, { route: '/review' });
    await screen.findByRole('heading', { name: /^review$/i });

    await user.click(screen.getByRole('button', { name: /deck 5/i }));
    await user.click(
      screen.getByRole('button', { name: /difficult.*marked difficult/i }),
    );
    await user.click(screen.getByRole('button', { name: /start review/i }));

    await waitFor(async () => {
      const [session] = await getDataStore().sessions.all();
      expect(session.verseIds).toEqual([actsOne.id]);
      expect(session.fixedMode).toBe('first-letter');
    });
  });

  it('offers to resume an unfinished review session', async () => {
    await createSession(
      {
        source: 'section',
        section: 'Acts',
        size: 'all',
        modeStrategy: 'fixed',
        fixedMode: 'first-letter',
      },
      'Deck 5 · All · First letters',
    );

    renderWithProviders(<ReviewSetupPage />, { route: '/review' });

    expect(
      await screen.findByText(/you have an unfinished review session/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resume session/i })).toBeInTheDocument();
  });
});

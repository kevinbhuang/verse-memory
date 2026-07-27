import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { requireVerse } from '@/data/verses';
import { getDataStore } from '@/repositories';
import { getProgress, setDifficult } from '@/services/progressService';
import { createSession, getSession } from '@/services/sessionService';
import { renderWithProviders } from '@/test/render';
import type { ReviewSession } from '@/types';
import { SessionRunner } from './SessionRunner';

const first = requireVerse('verse-002');
const second = requireVerse('verse-003');

async function startFlashcardSession(
  verseIds = [first.id, second.id],
): Promise<ReviewSession> {
  const session = await createSession(
    {
      source: 'custom',
      verseIds,
      size: 'all',
      modeStrategy: 'fixed',
      fixedMode: 'flashcard',
    },
    'Test session',
  );
  if (!session) throw new Error('expected a session');
  return session;
}

async function renderSession(session: ReviewSession) {
  const view = renderWithProviders(<SessionRunner sessionId={session.id} />, {
    route: `/review/session?id=${session.id}`,
  });
  await screen.findByText(session.label);
  return view;
}

const ratingButton = (name: RegExp) =>
  screen.getByRole('button', { name });

describe('SessionRunner', () => {
  it('shows the passage position and why it was recommended', async () => {
    const session = await startFlashcardSession();
    await renderSession(session);

    expect(await screen.findByText(/passage 1 of 2/i)).toBeInTheDocument();
    expect(screen.getByText(/recommended because:/i)).toBeInTheDocument();
    expect(screen.getByText(first.reference)).toBeInTheDocument();
  });

  it('offers passage audio listen controls during review', async () => {
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        speak: vi.fn(),
        cancel: vi.fn(),
        getVoices: () => [],
      },
    });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      configurable: true,
      value: class {
        text = '';
        constructor(text: string) {
          this.text = text;
        }
      },
    });

    const session = await startFlashcardSession();
    await renderSession(session);

    expect(
      screen.getByRole('group', { name: /passage audio/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /play passage once/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /play passage 5 times/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /play passage 10 times/i }),
    ).toBeInTheDocument();
  });

  it('asks for a rating only once the exercise is finished', async () => {
    const session = await startFlashcardSession();
    const { user } = await renderSession(session);

    expect(
      screen.getByText(/finish the exercise to rate this passage/i),
    ).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: /reveal passage/i }));

    expect(
      await screen.findByText(/how well did you recall it\?/i),
    ).toBeInTheDocument();
  });

  it('shows the interval each rating would produce before choosing', async () => {
    const session = await startFlashcardSession();
    const { user } = await renderSession(session);

    await user.click(await screen.findByRole('button', { name: /reveal passage/i }));

    expect(within(ratingButton(/^Again/)).getByText('1 day')).toBeInTheDocument();
    expect(within(ratingButton(/^Good/)).getByText('1 day')).toBeInTheDocument();
    expect(within(ratingButton(/^Easy/)).getByText('3 days')).toBeInTheDocument();
  });

  it('records the rating and moves to the next passage', async () => {
    const session = await startFlashcardSession();
    const { user } = await renderSession(session);

    await user.click(await screen.findByRole('button', { name: /reveal passage/i }));
    await user.click(ratingButton(/^Good/));

    await waitFor(async () => {
      const progress = await getProgress(first.id);
      expect(progress.reviewCount).toBe(1);
      expect(progress.lastRating).toBe('good');
      expect(progress.nextDueAt).not.toBeNull();
    });

    expect(await screen.findByText(/passage 2 of 2/i)).toBeInTheDocument();
    expect(screen.getByText(second.reference)).toBeInTheDocument();
  });

  it('writes a review log tied to the session', async () => {
    const session = await startFlashcardSession();
    const { user } = await renderSession(session);

    await user.click(await screen.findByRole('button', { name: /reveal passage/i }));
    await user.click(ratingButton(/^Hard/));

    await screen.findByText(/passage 2 of 2/i);

    const logs = await getDataStore().reviewLogs.forVerse(first.id);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      mode: 'flashcard',
      rating: 'hard',
      sessionId: session.id,
    });
  });

  it('accepts number keys 1 to 4 as ratings', async () => {
    const session = await startFlashcardSession();
    const { user } = await renderSession(session);

    await user.keyboard(' ');
    await screen.findByText(/how well did you recall it\?/i);
    await user.keyboard('4');

    await waitFor(async () => {
      expect((await getProgress(first.id)).lastRating).toBe('easy');
    });
    // Wait for the card to turn over too, so the session write has settled
    // before the test tears the database down.
    await screen.findByText(/passage 2 of 2/i);
  });

  it('queues a failed passage again before the session ends', async () => {
    const session = await startFlashcardSession();
    const { user } = await renderSession(session);

    await user.click(await screen.findByRole('button', { name: /reveal passage/i }));
    await user.click(ratingButton(/^Again/));

    await waitFor(async () => {
      const stored = await getSession(session.id);
      expect(stored?.verseIds).toEqual([first.id, second.id, first.id]);
    });
    expect(await screen.findByText(/passage 2 of 3/i)).toBeInTheDocument();
  });

  it('saves progress card by card so nothing is lost part way through', async () => {
    const session = await startFlashcardSession();
    const { user, unmount } = await renderSession(session);

    await user.click(await screen.findByRole('button', { name: /reveal passage/i }));
    await user.click(ratingButton(/^Good/));
    await screen.findByText(/passage 2 of 2/i);

    unmount();

    const stored = await getSession(session.id);
    expect(stored?.currentIndex).toBe(1);
    expect(stored?.results).toHaveLength(1);
    expect(stored?.completedAt).toBeNull();
    expect((await getProgress(first.id)).reviewCount).toBe(1);
  });

  it('resumes an interrupted session at the right card', async () => {
    const session = await startFlashcardSession();
    const { user, unmount } = await renderSession(session);

    await user.click(await screen.findByRole('button', { name: /reveal passage/i }));
    await user.click(ratingButton(/^Good/));
    await screen.findByText(/passage 2 of 2/i);
    unmount();

    const resumed = await getSession(session.id);
    await renderSession(resumed!);

    expect(await screen.findByText(/passage 2 of 2/i)).toBeInTheDocument();
    expect(screen.getByText(second.reference)).toBeInTheDocument();
  });

  it('summarises the session once every passage is done', async () => {
    const session = await startFlashcardSession([first.id]);
    const { user } = await renderSession(session);

    await user.click(await screen.findByRole('button', { name: /reveal passage/i }));
    await user.click(ratingButton(/^Good/));

    expect(await screen.findByText(/session complete/i)).toBeInTheDocument();
  });

  it('toggles the difficult flag during a review', async () => {
    const session = await startFlashcardSession();
    const { user } = await renderSession(session);

    await user.click(
      await screen.findByRole('button', { name: /toggle difficult/i }),
    );

    await waitFor(async () => {
      expect((await getProgress(first.id)).isDifficult).toBe(true);
    });
  });

  it('does not offer notes during a review', async () => {
    const session = await startFlashcardSession();
    await renderSession(session);

    expect(await screen.findByText(/passage 1 of 2/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add note/i })).not.toBeInTheDocument();
  });

  it('confirms before leaving a session', async () => {
    const session = await startFlashcardSession();
    const { user } = await renderSession(session);

    await user.keyboard('{Escape}');

    expect(await screen.findByText(/leave this session\?/i)).toBeInTheDocument();
    expect(screen.getByText(/0 of 2 passages completed/i)).toBeInTheDocument();
  });

  it('picks first-letter typing automatically for a difficult passage', async () => {
    await setDifficult(first.id, true);
    await getDataStore().progress.put({
      ...(await getProgress(first.id)),
      isMemorized: true,
      reviewCount: 6,
    });

    const session = await createSession(
      {
        source: 'custom',
        verseIds: [first.id],
        size: 'all',
        modeStrategy: 'automatic',
        fixedMode: null,
      },
      'Difficult passages',
    );
    await renderSession(session!);

    expect(
      await screen.findByLabelText(/type the first letter of each word/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/First letter/)).toBeInTheDocument();
  });

  it('explains when the session no longer exists', async () => {
    renderWithProviders(<SessionRunner sessionId="session-missing" />);
    expect(
      await screen.findByText(/that review session no longer exists/i),
    ).toBeInTheDocument();
  });
});

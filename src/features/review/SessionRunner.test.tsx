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

describe('SessionRunner', () => {
  it('shows the passage position', async () => {
    const session = await startFlashcardSession();
    await renderSession(session);

    expect(await screen.findByText(/passage 1 of 2/i)).toBeInTheDocument();
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
      screen.queryByRole('button', { name: /play passage 10 times/i }),
    ).not.toBeInTheDocument();
  });

  it('does not offer 1-4 recall ratings', async () => {
    const session = await startFlashcardSession();
    await renderSession(session);

    expect(screen.queryByText(/how well did you recall it\?/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^again/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^good/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^next$/i })).toBeInTheDocument();
  });

  it('advances with Next without finishing the exercise first', async () => {
    const session = await startFlashcardSession();
    const { user } = await renderSession(session);

    await user.click(screen.getByRole('button', { name: /^next$/i }));

    await waitFor(async () => {
      const progress = await getProgress(first.id);
      expect(progress.reviewCount).toBe(1);
    });
    expect(await screen.findByText(/passage 2 of 2/i)).toBeInTheDocument();
  });

  it('records a practice log and moves to the next passage', async () => {
    const session = await startFlashcardSession();
    const { user } = await renderSession(session);

    await user.click(await screen.findByRole('button', { name: /reveal passage/i }));
    await user.click(screen.getByRole('button', { name: /^next$/i }));

    await waitFor(async () => {
      const progress = await getProgress(first.id);
      expect(progress.reviewCount).toBe(1);
    });

    expect(await screen.findByText(/passage 2 of 2/i)).toBeInTheDocument();
    expect(screen.getByText(second.reference)).toBeInTheDocument();

    const logs = await getDataStore().reviewLogs.forVerse(first.id);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      mode: 'flashcard',
      sessionId: session.id,
    });
  });

  it('accepts Enter to move to the next passage', async () => {
    const session = await startFlashcardSession();
    const { user } = await renderSession(session);

    await user.keyboard('{Enter}');

    await waitFor(async () => {
      expect((await getProgress(first.id)).reviewCount).toBe(1);
    });
    await screen.findByText(/passage 2 of 2/i);
  });

  it('does not requeue a passage when advancing', async () => {
    const session = await startFlashcardSession();
    const { user } = await renderSession(session);

    await user.click(await screen.findByRole('button', { name: /reveal passage/i }));
    await user.click(screen.getByRole('button', { name: /^next$/i }));

    await waitFor(async () => {
      const stored = await getSession(session.id);
      expect(stored?.verseIds).toEqual([first.id, second.id]);
    });
    expect(await screen.findByText(/passage 2 of 2/i)).toBeInTheDocument();
  });

  it('saves progress card by card so nothing is lost part way through', async () => {
    const session = await startFlashcardSession();
    const { user, unmount } = await renderSession(session);

    await user.click(await screen.findByRole('button', { name: /reveal passage/i }));
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await screen.findByText(/passage 2 of 2/i);

    unmount();

    const stored = await getSession(session.id);
    expect(stored?.currentIndex).toBe(1);
    expect(stored?.results).toHaveLength(1);
    expect(stored?.completedAt).toBeNull();
    expect((await getProgress(first.id)).reviewCount).toBe(1);
  });

  it('summarises the session once every passage is done', async () => {
    const session = await startFlashcardSession([first.id]);
    const { user } = await renderSession(session);

    await user.click(await screen.findByRole('button', { name: /reveal passage/i }));
    await user.click(screen.getByRole('button', { name: /^finish$/i }));

    expect(await screen.findByText(/session complete/i)).toBeInTheDocument();
  });

  it('toggles Needs Review during a review', async () => {
    const session = await startFlashcardSession();
    const { user } = await renderSession(session);

    await user.click(
      await screen.findByRole('button', { name: /toggle needs review/i }),
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
    expect(
      screen.getByRole('button', { name: /discard and leave/i }),
    ).toBeInTheDocument();
  });

  it('discards the session when leaving', async () => {
    const session = await startFlashcardSession();
    const { user } = await renderSession(session);

    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: /discard and leave/i }));

    await waitFor(async () => {
      expect(await getSession(session.id)).toBeUndefined();
    });
  });

  it('picks first-letter typing automatically for a Needs Review passage', async () => {
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
      'Needs Review',
    );
    await renderSession(session!);

    expect(
      await screen.findByLabelText(/type the first letter of each word/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Letter typing/)).toBeInTheDocument();
  });

  it('explains when the session no longer exists', async () => {
    renderWithProviders(<SessionRunner sessionId="session-missing" />);
    expect(
      await screen.findByText(/that practice session no longer exists/i),
    ).toBeInTheDocument();
  });

  it('lets learn sessions switch practice modes and move between passages', async () => {
    const session = await createSession(
      {
        source: 'custom',
        verseIds: [first.id, second.id],
        size: 'all',
        modeStrategy: 'fixed',
        fixedMode: 'learn',
      },
      'Learn test',
    );
    const { user } = await renderSession(session!);

    expect(await screen.findByText(first.reference)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /previous passage/i })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /^audio$/i }));
    expect(
      await screen.findByRole('group', { name: /practice mode/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/does not provide speech recognition|start reciting/i),
    ).toBeInTheDocument();

    await user.click(
      within(screen.getByRole('group', { name: /practice mode/i })).getByRole(
        'button',
        { name: /^letters$/i },
      ),
    );
    expect(
      await screen.findByLabelText(/type the first letter of each word/i),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /next passage/i }));
    expect(await screen.findByText(second.reference)).toBeInTheDocument();
    expect(screen.getByText(/passage 2 of 2/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /previous passage/i }));
    expect(await screen.findByText(first.reference)).toBeInTheDocument();
  });
});

import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { requireVerse } from '@/data/verses';
import { getDataStore } from '@/repositories';
import { setDifficult, setMemorized } from '@/services/progressService';
import { createSession } from '@/services/sessionService';
import { renderWithProviders } from '@/test/render';
import { ReviewSetupPage } from './ReviewSetupPage';

const difficultOne = requireVerse('verse-012');
const difficultTwo = requireVerse('verse-090');

async function renderSetup(route = '/review') {
  const view = renderWithProviders(<ReviewSetupPage />, { route });
  await screen.findByRole('heading', { name: /build a review session/i });
  return view;
}

describe('ReviewSetupPage', () => {
  it('previews the passages a source would select', async () => {
    await setDifficult(difficultOne.id, true);
    await setDifficult(difficultTwo.id, true);
    const { user } = await renderSetup();

    await user.click(screen.getByRole('button', { name: /difficult passages/i }));

    expect(await screen.findByText(/2 passages in this session/i)).toBeInTheDocument();
    expect(screen.getByText(difficultOne.reference)).toBeInTheDocument();
    expect(screen.getByText(difficultTwo.reference)).toBeInTheDocument();
  });

  it('starts a difficult-verse session containing only flagged passages', async () => {
    await setDifficult(difficultOne.id, true);
    await setDifficult(difficultTwo.id, true);
    await setMemorized('verse-001', true);
    const { user } = await renderSetup();

    await user.click(screen.getByRole('button', { name: /difficult passages/i }));
    await screen.findByText(/2 passages in this session/i);
    await user.click(screen.getByRole('button', { name: /start session/i }));

    await waitFor(async () => {
      const sessions = await getDataStore().sessions.all();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].verseIds).toEqual([difficultOne.id, difficultTwo.id]);
      expect(sessions[0].label).toBe('Difficult passages');
      expect(sessions[0].currentIndex).toBe(0);
    });
  });

  it('limits the session to the chosen size', async () => {
    const { user } = await renderSetup();

    await user.click(screen.getByRole('button', { name: /new passages/i }));
    await user.click(screen.getByRole('button', { name: '5' }));

    expect(
      await screen.findByText(/5 passages in this session of 171 matching/i),
    ).toBeInTheDocument();
  });

  it('offers every matching passage', async () => {
    const { user } = await renderSetup();

    await user.click(screen.getByRole('button', { name: /new passages/i }));
    await user.click(screen.getByRole('button', { name: /all matching/i }));

    expect(
      await screen.findByText(/171 passages in this session/i),
    ).toBeInTheDocument();
  });

  it('asks which section when a section session is chosen', async () => {
    const { user } = await renderSetup();

    await user.click(screen.getByRole('button', { name: /^a section$/i }));
    await user.selectOptions(await screen.findByLabelText(/section/i), 'Acts');

    expect(await screen.findByText(/4 passages in this session/i)).toBeInTheDocument();
  });

  it('asks for the range when a passage range is chosen', async () => {
    const { user } = await renderSetup();

    await user.click(screen.getByRole('button', { name: /passage number range/i }));
    const start = await screen.findByLabelText(/from passage/i);
    const end = screen.getByLabelText(/to passage/i);

    await user.clear(start);
    await user.type(start, '10');
    await user.clear(end);
    await user.type(end, '14');
    await user.click(screen.getByRole('button', { name: /all matching/i }));

    expect(await screen.findByText(/5 passages in this session/i)).toBeInTheDocument();
  });

  it('lets a single mode be fixed for the whole session', async () => {
    const { user } = await renderSetup();

    await user.click(screen.getByRole('button', { name: /one mode for the session/i }));
    await user.selectOptions(await screen.findByLabelText(/^mode$/i), 'flashcard');
    await user.click(screen.getByRole('button', { name: /new passages/i }));
    await user.click(screen.getByRole('button', { name: /start session/i }));

    await waitFor(async () => {
      const [session] = await getDataStore().sessions.all();
      expect(session).toMatchObject({
        modeStrategy: 'fixed',
        fixedMode: 'flashcard',
      });
    });
  });

  it('will not start a session with nothing in it', async () => {
    const { user } = await renderSetup();

    await user.click(screen.getByRole('button', { name: /^due today$/i }));

    expect(await screen.findByText(/nothing matches yet/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start session/i })).toBeDisabled();
  });

  it('offers to resume an unfinished session', async () => {
    await createSession(
      {
        source: 'custom',
        verseIds: [difficultOne.id, difficultTwo.id],
        size: 'all',
        modeStrategy: 'fixed',
        fixedMode: 'flashcard',
      },
      'Difficult passages',
    );

    await renderSetup();

    expect(
      await screen.findByText(/you have an unfinished session/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/0 of 2 completed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resume session/i })).toBeInTheDocument();
  });

  it('opens on the source named in the link', async () => {
    await setDifficult(difficultOne.id, true);
    await renderSetup('/review?source=difficult');

    expect(
      await screen.findByRole('button', { name: /difficult passages/i }),
    ).toHaveAttribute('aria-pressed', 'true');
  });
});

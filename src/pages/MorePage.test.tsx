import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { getDataStore } from '@/repositories';
import { setMemorized } from '@/services/progressService';
import { requireVerse } from '@/data/verses';
import { renderWithProviders } from '@/test/render';
import { MorePage } from './MorePage';

async function renderMore() {
  const view = renderWithProviders(<MorePage />, { route: '/more' });
  await screen.findByRole('heading', { name: /^more$/i });
  return view;
}

describe('MorePage', () => {
  it('shows core progress stats and theme controls', async () => {
    await renderMore();

    expect(screen.getByText('Memorized')).toBeInTheDocument();
    expect(screen.getByText('Learning')).toBeInTheDocument();
    expect(screen.getByText('Difficult')).toBeInTheDocument();
    expect(screen.getByText('Streak')).toBeInTheDocument();
    expect(screen.getByLabelText(/theme/i)).toBeInTheDocument();
  });

  it('links memorized count into the library', async () => {
    await setMemorized(requireVerse('verse-001').id, true);
    await renderMore();

    expect(screen.getByText('Memorized').closest('a')).toHaveAttribute(
      'href',
      '/verses?status=memorized',
    );
  });

  it('persists a theme change', async () => {
    const { user } = await renderMore();

    await user.selectOptions(screen.getByLabelText(/theme/i), 'dark');

    await waitFor(async () => {
      expect((await getDataStore().settings.get()).theme).toBe('dark');
    });
  });

  it('shows backup tools and attribution', async () => {
    await renderMore();

    expect(screen.getByText(/english standard version/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /export all data \(json\)/i }),
    ).toBeInTheDocument();
  });
});

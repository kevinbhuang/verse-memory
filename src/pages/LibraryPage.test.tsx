import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { requireVerse } from '@/data/verses';
import { getProgress, setDifficult, setMemorized } from '@/services/progressService';
import { renderWithProviders } from '@/test/render';
import { LibraryPage } from './LibraryPage';

const passage = requireVerse('verse-053');

/** Section names also appear in the filter dropdown, so match the heading. */
const sectionHeading = (name: string) =>
  screen.queryByRole('heading', { name });

async function renderLibrary(route = '/verses') {
  const view = renderWithProviders(<LibraryPage />, { route });
  await screen.findByRole('heading', { name: /verse library/i });
  await screen.findByRole('heading', { name: 'Law and History' });
  return view;
}

const rowFor = (reference: string) => {
  const checkbox = screen.getByLabelText(`Mark ${reference} as memorized`);
  return checkbox.closest('li') as HTMLElement;
};

describe('LibraryPage', { timeout: 15_000 }, () => {
  it('lists every passage under its section heading in canonical order', async () => {
    await renderLibrary();

    expect(screen.getByText(/all 171 passages/i)).toBeInTheDocument();
    for (const section of [
      'Law and History',
      'Wisdom and Poetry',
      'Prophets',
      'Gospels',
      'Acts',
      'Paul\u2019s Epistles',
      'General Epistles and Revelation',
    ]) {
      expect(
        screen.getByRole('heading', { name: section }),
      ).toBeInTheDocument();
    }

    const references = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'))
      .filter((href): href is string => Boolean(href?.startsWith('/verses/verse-')));
    expect(references[0]).toBe('/verses/verse-001');
    expect(references.at(-1)).toBe('/verses/verse-171');
  });

  it('marks a passage memorized and keeps it checked', async () => {
    const { user } = await renderLibrary();

    const checkbox = screen.getByLabelText(
      `Mark ${passage.reference} as memorized`,
    );
    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);

    await waitFor(async () => {
      expect((await getProgress(passage.id)).isMemorized).toBe(true);
    });
    await waitFor(() => expect(checkbox).toBeChecked());
    expect(
      await screen.findByText(/first retention review scheduled for tomorrow/i),
    ).toBeInTheDocument();
  });

  it('unmarks a memorized passage', async () => {
    await setMemorized(passage.id, true);
    const { user } = await renderLibrary();

    const checkbox = await screen.findByLabelText(
      `Mark ${passage.reference} as memorized`,
    );
    await waitFor(() => expect(checkbox).toBeChecked());

    await user.click(checkbox);

    await waitFor(async () => {
      expect((await getProgress(passage.id)).isMemorized).toBe(false);
    });
  });

  it('marks a passage difficult from the overflow menu', async () => {
    const { user } = await renderLibrary();

    await user.click(
      screen.getByLabelText(`More actions for ${passage.reference}`),
    );
    await user.click(screen.getByRole('menuitem', { name: /mark difficult/i }));

    await waitFor(async () => {
      expect((await getProgress(passage.id)).isDifficult).toBe(true);
    });
    expect(
      within(rowFor(passage.reference)).getByText('Difficult'),
    ).toBeInTheDocument();
  });

  it('filters the library to a single book', async () => {
    const { user } = await renderLibrary();

    await user.selectOptions(screen.getByLabelText(/^book$/i), 'John');

    await waitFor(() => {
      expect(sectionHeading('Law and History')).not.toBeInTheDocument();
    });
    expect(screen.getByText(/showing 15 of 171/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /john 3:16/i })).toBeInTheDocument();
  });

  it('filters by a search term', async () => {
    const { user } = await renderLibrary();

    await user.type(screen.getByLabelText(/search/i), 'Romans 8:28');

    await waitFor(() => {
      expect(sectionHeading('Law and History')).not.toBeInTheDocument();
    });
    expect(screen.getByText(/Romans 8:28/)).toBeInTheDocument();
  });

  it('filters by section', async () => {
    const { user } = await renderLibrary();

    await user.selectOptions(screen.getByLabelText(/section/i), 'Acts');

    await waitFor(() => {
      expect(sectionHeading('Gospels')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { name: 'Acts' })).toBeInTheDocument();
    expect(screen.getByText(/4 passages/)).toBeInTheDocument();
  });

  it('filters to difficult passages only', async () => {
    await setDifficult(passage.id, true);
    const { user } = await renderLibrary();

    await user.click(screen.getByLabelText(/difficult only/i));

    await waitFor(() => {
      expect(
        screen.getAllByRole('link', { name: /\d?\w/ }).filter((link) =>
          link.getAttribute('href')?.startsWith('/verses/verse-'),
        ),
      ).toHaveLength(1);
    });
    expect(screen.getByText(passage.reference)).toBeInTheDocument();
  });

  it('explains when nothing matches and offers a way back', async () => {
    const { user } = await renderLibrary();

    await user.type(screen.getByLabelText(/search/i), 'zzzzzz');

    expect(
      await screen.findByText(/no passages match these filters/i),
    ).toBeInTheDocument();

    // The filter bar and the empty state both offer a way out.
    const [clearFilters] = screen.getAllByRole('button', {
      name: /clear filters/i,
    });
    await user.click(clearFilters);

    expect(
      await screen.findByRole('heading', { name: 'Law and History' }),
    ).toBeInTheDocument();
  });

  it('opens pre-filtered from a progress link', async () => {
    renderWithProviders(<LibraryPage />, { route: '/verses?section=Acts' });

    expect(
      await screen.findByRole('heading', { name: 'Acts' }),
    ).toBeInTheDocument();
    expect(sectionHeading('Gospels')).not.toBeInTheDocument();
  });

  it('offers bulk actions once passages are selected', async () => {
    const { user } = await renderLibrary();

    await user.click(
      screen.getByLabelText(`Select ${passage.reference} for bulk actions`),
    );
    expect(await screen.findByText(/1 selected/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /mark memorized/i }));

    await waitFor(async () => {
      expect((await getProgress(passage.id)).isMemorized).toBe(true);
    });
  });

  it('confirms before resetting scheduling in bulk', async () => {
    const { user } = await renderLibrary();

    await user.click(
      screen.getByLabelText(`Select ${passage.reference} for bulk actions`),
    );
    await user.click(screen.getByRole('button', { name: /reset scheduling/i }));

    expect(
      await screen.findByText(/reset scheduling for 1 passage\?/i),
    ).toBeInTheDocument();
  });
});

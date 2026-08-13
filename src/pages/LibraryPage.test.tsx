import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { requireVerse } from '@/data/verses';
import { getProgress, setMemorized } from '@/services/progressService';
import { renderWithProviders } from '@/test/render';
import { LibraryPage } from './LibraryPage';

const passage = requireVerse('verse-053');

/** Section names also appear in the filter dropdown, so match the heading. */
const sectionHeading = (name: string) =>
  screen.queryByRole('heading', { name });

async function renderLibrary(route = '/verses') {
  const view = renderWithProviders(<LibraryPage />, { route });
  await screen.findByRole('heading', { name: /100 Verses Every Christian Should Know/i });
  await screen.findByRole('heading', { name: 'Law and History' });
  return view;
}

async function openSearch(user: Awaited<ReturnType<typeof renderLibrary>>['user']) {
  const button = screen.getByRole('button', { name: /^search$/i });
  if (button.getAttribute('aria-expanded') !== 'true') {
    await user.click(button);
  }
  await screen.findByLabelText(/search passages/i);
}

const rowFor = (reference: string) => {
  const checkbox = screen.getByLabelText(`Mark ${reference} as memorized`);
  return checkbox.closest('li') as HTMLElement;
};

describe('LibraryPage', { timeout: 15_000 }, () => {
  it('lists every passage under its section heading in canonical order', async () => {
    await renderLibrary();

    expect(
      screen.getByRole('heading', {
        name: /100 Verses Every Christian Should Know/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /^library$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('status', { name: /0 of 171 memorized/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: /percent memorized/i })).toHaveAttribute(
      'aria-valuenow',
      '0',
    );
    expect(
      screen.queryByRole('columnheader', { name: /^selected$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: /^memorized$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: /^needs review$/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^search$/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/search passages/i)).not.toBeInTheDocument();
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
      .filter((href): href is string =>
        Boolean(href?.startsWith('/flashcards?verse=verse-')),
      );
    expect(references[0]).toBe('/flashcards?verse=verse-001');
    expect(references.at(-1)).toBe('/flashcards?verse=verse-171');
  });

  it('offers deck and book PDF download controls', async () => {
    const { user } = await renderLibrary();

    expect(screen.getByRole('button', { name: /^print$/i })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: /^print$/i }));

    const dialog = await screen.findByRole('dialog', { name: /print passages/i });
    expect(dialog).toBeInTheDocument();
    expect(
      within(dialog).getByRole('group', { name: /print status filter/i }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: /^memorized$/i }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: /^non-memorized$/i }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: /^needs review$/i }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole('group', { name: /print text mode/i }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: /^first letters$/i }),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: /^books$/i }));
    const bookList = within(dialog).getByRole('group', { name: /^books$/i });
    expect(within(bookList).getByRole('checkbox', { name: /romans/i })).toBeChecked();

    await user.click(within(bookList).getByRole('checkbox', { name: /^john\b/i }));
    expect(within(bookList).getByRole('checkbox', { name: /^john\b/i })).toBeChecked();
  });

  it('offers a flash cards button on each row', async () => {
    await renderLibrary();

    const buttons = screen.getAllByRole('button', {
      name: 'Review flash cards from this point',
    });
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons[0]).toHaveAttribute(
      'title',
      'Review flash cards from this point',
    );
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
    expect(await screen.findByText(/marked memorized/i)).toBeInTheDocument();
    expect(
      await screen.findByRole('status', { name: /1 of 171 memorized/i }),
    ).toBeInTheDocument();
    expect(rowFor(passage.reference)).toHaveClass('bg-success-soft');
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

  it('marks a passage Needs Review from the checkbox', async () => {
    const { user } = await renderLibrary();

    await user.click(
      screen.getByLabelText(`Mark ${passage.reference} as Needs Review`),
    );

    await waitFor(async () => {
      expect((await getProgress(passage.id)).isDifficult).toBe(true);
    });
    expect(
      within(rowFor(passage.reference)).getByText('Needs Review'),
    ).toBeInTheDocument();
    expect(rowFor(passage.reference)).toHaveClass('bg-warning-soft');
  });

  it('filters the library to a single book', async () => {
    const { user } = await renderLibrary();
    await openSearch(user);

    await user.selectOptions(screen.getByLabelText(/^book$/i), 'John');

    await waitFor(() => {
      expect(sectionHeading('Law and History')).not.toBeInTheDocument();
    });
    expect(screen.getByText(/showing 15 of 171/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /john 3:16/i })).toBeInTheDocument();
  });

  it('filters by a search term', async () => {
    const { user } = await renderLibrary();
    await openSearch(user);

    await user.type(screen.getByLabelText(/search passages/i), 'Romans 8:28');

    await waitFor(() => {
      expect(sectionHeading('Law and History')).not.toBeInTheDocument();
    });
    expect(screen.getByText(/Romans 8:28/)).toBeInTheDocument();
  });

  it('filters by section', async () => {
    const { user } = await renderLibrary();
    await openSearch(user);

    await user.selectOptions(screen.getByLabelText(/section/i), 'Acts');

    await waitFor(() => {
      expect(sectionHeading('Gospels')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { name: 'Acts' })).toBeInTheDocument();
    expect(screen.getByText(/4 passages/)).toBeInTheDocument();
  });

  it('explains when nothing matches and offers a way back', async () => {
    const { user } = await renderLibrary();
    await openSearch(user);

    await user.type(screen.getByLabelText(/search passages/i), 'zzzzzz');

    expect(
      await screen.findByText(/no passages match these filters/i),
    ).toBeInTheDocument();

    // The filter bar and the empty state both offer a way out.
    await user.click(screen.getByRole('button', { name: /reset filters/i }));

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
    expect(screen.getByLabelText(/search passages/i)).toBeInTheDocument();
  });

  it('redirects the old chart view query to the Progress Chart tab', async () => {
    renderWithProviders(<LibraryPage />, { route: '/verses?view=chart' });

    // Library unmounts in favor of the navigate target; assert no list chrome.
    await waitFor(() => {
      expect(sectionHeading('Law and History')).not.toBeInTheDocument();
    });
  });
});

import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { createDefaultProgress } from '@/db/defaults';
import { renderWithProviders } from '@/test/render';
import type { CustomVerse } from '@/types/customVerse';
import { CustomVerseLibraryView } from './CustomVerseLibraryView';

const verse: CustomVerse = {
  id: 'custom-john-316',
  listId: 'custom-list-1',
  order: 1,
  reference: 'John 3:16',
  text: 'For God so loved the world…',
  translation: 'ESV',
  createdAt: '2026-05-04T10:00:00.000Z',
  updatedAt: '2026-05-04T10:00:00.000Z',
};

const noop = vi.fn();

describe('CustomVerseLibraryView', () => {
  it('shows Memorized and Needs Review from stored custom-verse progress', () => {
    const progressById = new Map([
      [
        verse.id,
        {
          ...createDefaultProgress(verse.id),
          isMemorized: true,
          isDifficult: true,
        },
      ],
    ]);

    renderWithProviders(
      <CustomVerseLibraryView
        verses={[verse]}
        progressById={progressById}
        onOpenCards={noop}
        onDelete={noop}
        onToggleMemorized={noop}
        onToggleNeedsReview={noop}
      />,
    );

    expect(
      screen.getByLabelText('Mark John 3:16 as memorized'),
    ).toBeChecked();
    expect(
      screen.getByLabelText('Mark John 3:16 as Needs Review'),
    ).toBeChecked();
  });
});

import { describe, expect, it } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import { verses } from '@/data/verses';
import { createDefaultProgress } from '@/db/defaults';
import { getDatabase } from '@/db/db';
import { setDifficult, setMemorized } from '@/services/progressService';
import { renderWithProviders } from '@/test/render';
import { useAllProgress, useProgressMap } from './useProgressData';

const CUSTOM_ID = 'custom-test-verse';

function ProgressMapProbe({ verseId }: { verseId: string }) {
  const map = useProgressMap();
  if (!map) return <div>loading map</div>;
  const progress = map.get(verseId);
  return (
    <div>
      <span data-testid="map-memorized">
        {String(progress?.isMemorized ?? false)}
      </span>
      <span data-testid="map-needs-review">
        {String(progress?.isDifficult ?? false)}
      </span>
    </div>
  );
}

function CollectionProbe() {
  const all = useAllProgress();
  if (!all) return <div>loading collection</div>;
  return (
    <div>
      <span data-testid="collection-count">{all.length}</span>
      <span data-testid="collection-has-custom">
        {String(all.some((record) => record.verseId === CUSTOM_ID))}
      </span>
    </div>
  );
}

describe('useProgressMap', () => {
  it('includes custom My Verses progress, not only the 171 collection', async () => {
    await getDatabase().progress.put({
      ...createDefaultProgress(CUSTOM_ID),
      isMemorized: true,
      isDifficult: true,
    });

    renderWithProviders(<ProgressMapProbe verseId={CUSTOM_ID} />);

    await waitFor(() => {
      expect(screen.getByTestId('map-memorized')).toHaveTextContent('true');
      expect(screen.getByTestId('map-needs-review')).toHaveTextContent('true');
    });
  });

  it('updates after Cards-style setMemorized / setDifficult writes', async () => {
    await getDatabase().progress.put(createDefaultProgress(CUSTOM_ID));
    renderWithProviders(<ProgressMapProbe verseId={CUSTOM_ID} />);

    await waitFor(() => {
      expect(screen.getByTestId('map-memorized')).toHaveTextContent('false');
    });

    await act(async () => {
      await setMemorized(CUSTOM_ID, true);
      await setDifficult(CUSTOM_ID, true);
    });

    await waitFor(() => {
      expect(screen.getByTestId('map-memorized')).toHaveTextContent('true');
      expect(screen.getByTestId('map-needs-review')).toHaveTextContent('true');
    });
  });
});

describe('useAllProgress', () => {
  it('stays limited to the 171-passage collection', async () => {
    await getDatabase().progress.put({
      ...createDefaultProgress(CUSTOM_ID),
      isMemorized: true,
    });

    renderWithProviders(<CollectionProbe />);

    await waitFor(() => {
      expect(screen.getByTestId('collection-count')).toHaveTextContent(
        String(verses.length),
      );
      expect(screen.getByTestId('collection-has-custom')).toHaveTextContent(
        'false',
      );
    });
  });
});

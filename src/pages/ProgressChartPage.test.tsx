import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { buildProgressChartColumns } from '@/features/library/ProgressChart';
import { ProgressChartPage } from './ProgressChartPage';

describe('ProgressChartPage', () => {
  it('shows all 171 passages across deck columns', async () => {
    renderWithProviders(<ProgressChartPage />, { route: '/progress-chart' });

    expect(
      await screen.findByRole('heading', { level: 2, name: /^progress chart$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: /progress chart by deck/i }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('checkbox', { name: /as memorized$/i }),
    ).toHaveLength(171);
    expect(
      screen.getAllByRole('checkbox', { name: /as needs review$/i }),
    ).toHaveLength(171);
    expect(screen.getByText('Ex 19:4-6')).toBeInTheDocument();
  });
});

describe('buildProgressChartColumns', () => {
  it('spills a tall deck into multiple columns', () => {
    const columns = buildProgressChartColumns(new Map(), 24);
    const paulParts = columns.filter((column) =>
      column.deck.section.includes('Paul'),
    );
    expect(paulParts.length).toBeGreaterThan(1);
    expect(paulParts.every((part) => part.verses.length <= 24)).toBe(true);
    expect(paulParts.reduce((sum, part) => sum + part.verses.length, 0)).toBe(
      72,
    );
  });
});

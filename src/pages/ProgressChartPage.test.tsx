import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { ProgressChartPage } from './ProgressChartPage';

describe('ProgressChartPage', () => {
  it('shows all 171 passages in a single table', async () => {
    renderWithProviders(<ProgressChartPage />, { route: '/progress-chart' });

    expect(
      await screen.findByRole('heading', { level: 2, name: /^progress chart$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: /^progress chart$/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /^memorized$/i })).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: /^needs review$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: /^passage$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('checkbox', { name: /as memorized$/i }),
    ).toHaveLength(171);
    expect(
      screen.getAllByRole('checkbox', { name: /as needs review$/i }),
    ).toHaveLength(171);
    expect(
      screen.getByRole('link', { name: /exodus 19:4-6/i }),
    ).toBeInTheDocument();
  });
});

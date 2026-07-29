import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { ProgressChartPage } from './ProgressChartPage';

describe('ProgressChartPage', () => {
  it('shows all 171 passages in a five-column table', async () => {
    renderWithProviders(<ProgressChartPage />, { route: '/progress-chart' });

    expect(
      await screen.findByRole('heading', { level: 2, name: /^progress chart$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: /^progress chart$/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader', { name: /^m$/i })).toHaveLength(
      5,
    );
    expect(
      screen.getAllByRole('columnheader', { name: /^passage$/i }),
    ).toHaveLength(5);
    expect(
      screen.getAllByRole('checkbox', { name: /as memorized$/i }),
    ).toHaveLength(171);
    expect(
      screen.getAllByRole('checkbox', { name: /as needs review$/i }),
    ).toHaveLength(171);
    expect(screen.getByRole('link', { name: /ex 19:4-6/i })).toBeInTheDocument();
  });
});

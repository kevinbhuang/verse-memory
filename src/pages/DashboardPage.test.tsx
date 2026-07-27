import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { setMemorized } from '@/services/progressService';
import { renderWithProviders } from '@/test/render';
import { DashboardPage } from './DashboardPage';

async function renderDashboard() {
  const view = renderWithProviders(<DashboardPage />);
  await screen.findByRole('heading', { name: /verse memory/i });
  return view;
}

describe('DashboardPage', () => {
  it('starts from an honest zero state with seven decks', async () => {
    await renderDashboard();

    expect(screen.getByText('0 of 171')).toBeInTheDocument();
    expect(screen.getByText('0.0%')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /practice by deck/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /or practice by book/i })).toBeInTheDocument();
    expect(screen.getByText('Deck 1')).toBeInTheDocument();
    expect(screen.getByText('Deck 7')).toBeInTheDocument();
    expect(screen.getByLabelText(/^book$/i)).toBeInTheDocument();
  });

  it('shows memorized count across the collection', async () => {
    await setMemorized('verse-001', true);
    await setMemorized('verse-002', true);

    await renderDashboard();

    expect(await screen.findByText('2 of 171')).toBeInTheDocument();
  });

  it('lists the seven decks in canonical section order', async () => {
    await renderDashboard();

    const labels = screen
      .getAllByRole('heading', {
        name: /^(Law and History|Wisdom and Poetry|Prophets|Gospels|Acts|Paul’s Epistles|General Epistles and Revelation)$/,
      })
      .map((node) => node.textContent);

    expect(labels).toEqual([
      'Law and History',
      'Wisdom and Poetry',
      'Prophets',
      'Gospels',
      'Acts',
      'Paul’s Epistles',
      'General Epistles and Revelation',
    ]);
    expect(screen.getByText('0/7')).toBeInTheDocument();
    expect(screen.getByText('0/31')).toBeInTheDocument();
  });
});

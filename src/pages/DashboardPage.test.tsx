import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { setDifficult, setMemorized } from '@/services/progressService';
import { renderWithProviders } from '@/test/render';
import { DashboardPage } from './DashboardPage';

async function renderDashboard() {
  const view = renderWithProviders(<DashboardPage />);
  await screen.findByRole('heading', { name: /verse memory/i });
  return view;
}

describe('DashboardPage', () => {
  it('starts from an honest zero state', async () => {
    await renderDashboard();

    expect(screen.getByText('0 of 171')).toBeInTheDocument();
    expect(screen.getByText('0.0%')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /first letters/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /speak recite/i })).toBeInTheDocument();
  });

  it('shows memorized count and difficult summary', async () => {
    await setMemorized('verse-001', true);
    await setMemorized('verse-002', true);
    await setDifficult('verse-003', true);

    await renderDashboard();

    expect(await screen.findByText('2 of 171')).toBeInTheDocument();
    expect(screen.getByText(/1 marked difficult/i)).toBeInTheDocument();
  });

  it('lists the seven sections in canonical order', async () => {
    await renderDashboard();

    const labels = screen
      .getAllByText(
        /^(Law and History|Wisdom and Poetry|Prophets|Gospels|Acts|Paul’s Epistles|General Epistles and Revelation)$/,
      )
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

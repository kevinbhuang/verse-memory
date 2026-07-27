import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { getDataStore } from '@/repositories';
import { renderWithProviders } from '@/test/render';
import { SettingsPage } from './SettingsPage';

async function renderSettings() {
  const view = renderWithProviders(<SettingsPage />);
  await screen.findByRole('heading', { name: 'Settings' });
  return view;
}

describe('SettingsPage', () => {
  it('persists a changed preference', async () => {
    const { user } = await renderSettings();

    await user.selectOptions(
      screen.getByLabelText(/default review mode/i),
      'full-typing',
    );

    await waitFor(async () => {
      expect((await getDataStore().settings.get()).defaultReviewMode).toBe(
        'full-typing',
      );
    });
  });

  it('persists a toggle', async () => {
    const { user } = await renderSettings();

    await user.click(
      screen.getByRole('switch', { name: /allow backspace in first-letter mode/i }),
    );

    await waitFor(async () => {
      expect(
        (await getDataStore().settings.get()).allowBackspaceInFirstLetter,
      ).toBe(false);
    });
  });

  it('reports that all 171 passages match their content hashes', async () => {
    await renderSettings();

    expect(
      screen.getByText(/all 171 passages match their recorded content hashes/i),
    ).toBeInTheDocument();
    expect(screen.getByText('Passage count: 171 of 171')).toBeInTheDocument();
    expect(
      screen.getByText('Order 1–171 consecutive: yes'),
    ).toBeInTheDocument();
    expect(screen.getByText('Identifiers unique: yes')).toBeInTheDocument();
  });

  it('shows the translation attribution and the data-management tools', async () => {
    await renderSettings();

    expect(screen.getByText(/english standard version/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /export all data \(json\)/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /reset all progress/i }),
    ).toBeInTheDocument();
  });
});

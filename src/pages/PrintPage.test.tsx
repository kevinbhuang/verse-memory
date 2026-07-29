import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { PrintPage } from './PrintPage';

describe('PrintPage', () => {
  it('offers scope, status, and first-letter print controls', async () => {
    const { user } = renderWithProviders(<PrintPage />, { route: '/print' });

    expect(
      screen.getByRole('heading', { level: 2, name: /^print$/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^all \(/i })).toBeInTheDocument();
    expect(
      screen.getByRole('group', { name: /print status filter/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('group', { name: /print text mode/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^first letters$/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^first letters$/i }));
    expect(
      screen.getByText(/keeps punctuation and spacing/i),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('button', { name: /download pdf/i }),
    ).toBeEnabled();
  });
});

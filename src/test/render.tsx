import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactElement, ReactNode } from 'react';
import { SettingsProvider } from '@/hooks/useSettings';
import { ToastProvider } from '@/components/ui/Toast';
import { createDefaultProgress, DEFAULT_SETTINGS } from '@/db/defaults';
import type { Settings, VerseProgress } from '@/types';

function Providers({
  children,
  route,
  path,
}: {
  children: ReactNode;
  route: string;
  path: string | undefined;
}) {
  return (
    <MemoryRouter initialEntries={[route]}>
      <SettingsProvider>
        <ToastProvider>
          {path ? (
            <Routes>
              <Route path={path} element={children} />
            </Routes>
          ) : (
            children
          )}
        </ToastProvider>
      </SettingsProvider>
    </MemoryRouter>
  );
}

export type RenderWithProvidersOptions = Omit<RenderOptions, 'wrapper'> & {
  route?: string;
  /** Supply a route pattern when the component reads URL parameters. */
  path?: string;
};

/** Renders a component inside the providers the real application supplies. */
export function renderWithProviders(
  ui: ReactElement,
  { route = '/', path, ...options }: RenderWithProvidersOptions = {},
): RenderResult & { user: ReturnType<typeof userEvent.setup> } {
  const user = userEvent.setup();
  const result = render(ui, {
    wrapper: ({ children }) => (
      <Providers route={route} path={path}>
        {children}
      </Providers>
    ),
    ...options,
  });
  return { ...result, user };
}

/**
 * Scripture is rendered one word per element so words can be hidden or
 * highlighted individually, so assertions read the flattened text instead of
 * looking for a single matching node.
 */
export function visibleText(element: HTMLElement = document.body): string {
  return (element.textContent ?? '').replace(/\s+/g, ' ').trim();
}

export function normalizeSpace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export const testSettings = (overrides: Partial<Settings> = {}): Settings => ({
  ...DEFAULT_SETTINGS,
  ...overrides,
});

export const testProgress = (
  verseId: string,
  overrides: Partial<VerseProgress> = {},
): VerseProgress => ({
  ...createDefaultProgress(verseId, new Date('2026-05-04T10:00:00.000Z')),
  ...overrides,
});

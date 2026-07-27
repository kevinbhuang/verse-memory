import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { closeTestDatabase, resetTestDatabase } from './db';

// jsdom does not implement matchMedia, which the theme provider queries.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

if (!window.scrollTo) {
  window.scrollTo = vi.fn();
}

// Every test starts from an empty database so persistence tests cannot leak
// state into one another.
beforeEach(async () => {
  await resetTestDatabase();
});

// Components are unmounted before the database goes away, so live queries stop
// listening rather than failing against a closed connection.
afterEach(async () => {
  cleanup();
  await closeTestDatabase();
});

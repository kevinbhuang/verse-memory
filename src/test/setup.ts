import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { closeTestDatabase, resetTestDatabase } from './db';

// Node 22+ / Firebase can leave localStorage undefined in jsdom. Provide a
// minimal in-memory Storage so page tests and sync meta keep working.
// Keys are own properties so Object.keys(localStorage) works like browsers.
const storageMethods = new Set([
  'length',
  'clear',
  'getItem',
  'key',
  'removeItem',
  'setItem',
]);

const memoryStorage = {
  get length() {
    return Object.keys(this).filter((key) => !storageMethods.has(key)).length;
  },
  clear() {
    for (const key of Object.keys(this)) {
      if (!storageMethods.has(key)) {
        delete (this as Record<string, unknown>)[key];
      }
    }
  },
  getItem(key: string) {
    return Object.prototype.hasOwnProperty.call(this, key)
      ? String((this as Record<string, unknown>)[key])
      : null;
  },
  key(index: number) {
    return Object.keys(this).filter((key) => !storageMethods.has(key))[index] ?? null;
  },
  removeItem(key: string) {
    delete (this as Record<string, unknown>)[key];
  },
  setItem(key: string, value: string) {
    (this as Record<string, unknown>)[key] = String(value);
  },
} as Storage;

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  writable: true,
  value: memoryStorage,
});
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    writable: true,
    value: memoryStorage,
  });
}

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

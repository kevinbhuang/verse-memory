import { createDexieStore } from './dexieStore';
import type { DataStore } from './types';

let store: DataStore | null = null;

/**
 * The single access point for persistence.
 *
 * Swap the implementation here (or via `setDataStore`) to move to a different
 * backend; no feature code imports Dexie directly.
 */
export function getDataStore(): DataStore {
  store ??= createDexieStore();
  return store;
}

export function setDataStore(next: DataStore | null): void {
  store = next;
}

export type { DataStore } from './types';

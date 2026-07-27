import { VerseMemoryDatabase, setDatabase } from '@/db/db';
import { createDexieStore } from '@/repositories/dexieStore';
import { setDataStore } from '@/repositories';

let current: VerseMemoryDatabase | null = null;

/** Gives each test a clean IndexedDB instance backed by fake-indexeddb. */
export async function resetTestDatabase(): Promise<VerseMemoryDatabase> {
  await closeTestDatabase();

  const database = new VerseMemoryDatabase(
    `verse-memory-test-${Date.now()}-${Math.random()}`,
  );
  await database.open();

  current = database;
  setDatabase(database);
  setDataStore(createDexieStore(database));

  return database;
}

/**
 * Closes the database between tests.
 *
 * Live queries and in-flight writes belonging to a component that has just
 * been unmounted are given a turn of the event loop to settle first;
 * otherwise they reject against a database that has already gone away.
 */
export async function closeTestDatabase(): Promise<void> {
  if (!current) return;
  const database = current;
  current = null;

  for (let turn = 0; turn < 3; turn += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  database.close();
  await database.delete().catch(() => undefined);
}

export function getTestDatabase(): VerseMemoryDatabase {
  if (!current) throw new Error('Call resetTestDatabase() first');
  return current;
}

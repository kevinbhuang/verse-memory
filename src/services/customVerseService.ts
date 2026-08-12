import { getDatabase } from '@/db/db';
import { createDefaultProgress } from '@/db/defaults';
import { fetchPassageText } from '@/lib/esv/fetchPassageText';
import { parseReferenceList } from '@/lib/text/parseReferenceList';
import type { CustomList, CustomVerse } from '@/types/customVerse';

function newVerseId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `custom-${crypto.randomUUID()}`;
  }
  return `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function newListId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `custom-list-${crypto.randomUUID()}`;
  }
  return `custom-list-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function listCustomLists(): Promise<CustomList[]> {
  return getDatabase().customLists.orderBy('order').toArray();
}

export async function getCustomList(
  id: string,
): Promise<CustomList | undefined> {
  return getDatabase().customLists.get(id);
}

export async function createCustomList(name: string): Promise<CustomList> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Enter a name for the new list.');
  }

  const db = getDatabase();
  const duplicate = await db.customLists
    .filter((list) => list.name.trim().toLowerCase() === trimmed.toLowerCase())
    .first();
  if (duplicate) {
    throw new Error(`A list named “${duplicate.name}” already exists.`);
  }

  const now = new Date().toISOString();
  const maxOrder = await db.customLists.orderBy('order').last();
  const list: CustomList = {
    id: newListId(),
    name: trimmed,
    order: (maxOrder?.order ?? 0) + 1,
    createdAt: now,
    updatedAt: now,
  };
  await db.customLists.put(list);
  return list;
}

export async function renameCustomList(
  id: string,
  name: string,
): Promise<CustomList> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Enter a list name.');
  }
  const db = getDatabase();
  const current = await db.customLists.get(id);
  if (!current) {
    throw new Error('That list was not found.');
  }
  const duplicate = await db.customLists
    .filter(
      (list) =>
        list.id !== id &&
        list.name.trim().toLowerCase() === trimmed.toLowerCase(),
    )
    .first();
  if (duplicate) {
    throw new Error(`A list named “${duplicate.name}” already exists.`);
  }
  const updated: CustomList = {
    ...current,
    name: trimmed,
    updatedAt: new Date().toISOString(),
  };
  await db.customLists.put(updated);
  return updated;
}

/** Deletes a list and every verse (plus progress) belonging to it. */
export async function deleteCustomList(id: string): Promise<void> {
  const db = getDatabase();
  const verseIds = (
    await db.customVerses.where('listId').equals(id).toArray()
  ).map((verse) => verse.id);

  await db.transaction(
    'rw',
    db.customLists,
    db.customVerses,
    db.progress,
    db.reviewLogs,
    db.wordStats,
    async () => {
      await db.customLists.delete(id);
      await db.customVerses.where('listId').equals(id).delete();
      for (const verseId of verseIds) {
        await db.progress.delete(verseId);
        await db.reviewLogs.where('verseId').equals(verseId).delete();
        await db.wordStats.where('verseId').equals(verseId).delete();
      }
    },
  );
}

export async function listCustomVerses(
  listId?: string,
): Promise<CustomVerse[]> {
  const table = getDatabase().customVerses;
  if (!listId) {
    return table.orderBy('order').toArray();
  }
  return table.where('listId').equals(listId).sortBy('order');
}

export async function getCustomVerse(
  id: string,
): Promise<CustomVerse | undefined> {
  return getDatabase().customVerses.get(id);
}

/**
 * Fetch ESV text for a reference and append it to the given custom list.
 * Skips duplicates that already use the same canonical reference in that list.
 */
export async function addCustomVerseFromReference(
  reference: string,
  listId: string,
): Promise<CustomVerse> {
  const db = getDatabase();
  const list = await db.customLists.get(listId);
  if (!list) {
    throw new Error('Choose a custom list for these verses.');
  }

  const fetched = await fetchPassageText(reference);
  const existing = await db.customVerses
    .where('listId')
    .equals(listId)
    .filter(
      (verse) =>
        verse.reference.trim().toLowerCase() ===
        fetched.canonicalReference.trim().toLowerCase(),
    )
    .first();
  if (existing) {
    throw new Error(
      `${fetched.canonicalReference} is already in “${list.name}”.`,
    );
  }

  const now = new Date().toISOString();
  const siblings = await db.customVerses.where('listId').equals(listId).toArray();
  const maxOrder = siblings.reduce(
    (max, verse) => Math.max(max, verse.order),
    0,
  );
  const verse: CustomVerse = {
    id: newVerseId(),
    listId,
    order: maxOrder + 1,
    reference: fetched.canonicalReference,
    text: fetched.text,
    translation: 'ESV',
    createdAt: now,
    updatedAt: now,
  };

  await db.transaction('rw', db.customVerses, db.progress, async () => {
    await db.customVerses.put(verse);
    const progress = createDefaultProgress(verse.id);
    await db.progress.put(progress);
  });

  return verse;
}

export type BatchAddItemResult = {
  reference: string;
  reason: string;
};

export type BatchAddResult = {
  list: CustomList;
  added: CustomVerse[];
  skipped: BatchAddItemResult[];
  failed: BatchAddItemResult[];
};

export type AddDestination =
  | { mode: 'new'; name: string }
  | { mode: 'existing'; listId: string };

/**
 * Resolve the destination list, then parse and add each reference.
 */
export async function addCustomVersesFromReferences(
  raw: string,
  destination: AddDestination,
  onProgress?: (done: number, total: number, reference: string) => void,
): Promise<BatchAddResult> {
  const references = parseReferenceList(raw);
  if (!references.length) {
    throw new Error('Enter one or more verse references.');
  }

  const list =
    destination.mode === 'new'
      ? await createCustomList(destination.name)
      : await getCustomList(destination.listId);

  if (!list) {
    throw new Error('Choose a custom list for these verses.');
  }

  const added: CustomVerse[] = [];
  const skipped: BatchAddItemResult[] = [];
  const failed: BatchAddItemResult[] = [];

  for (let i = 0; i < references.length; i += 1) {
    const reference = references[i]!;
    onProgress?.(i + 1, references.length, reference);
    try {
      const verse = await addCustomVerseFromReference(reference, list.id);
      added.push(verse);
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : 'Could not add that verse.';
      if (/already in/i.test(reason)) {
        skipped.push({ reference, reason });
      } else {
        failed.push({ reference, reason });
      }
    }
  }

  return { list, added, skipped, failed };
}

export async function removeCustomVerse(id: string): Promise<void> {
  const db = getDatabase();
  await db.transaction(
    'rw',
    db.customVerses,
    db.progress,
    db.reviewLogs,
    db.wordStats,
    async () => {
      await db.customVerses.delete(id);
      await db.progress.delete(id);
      await db.reviewLogs.where('verseId').equals(id).delete();
      await db.wordStats.where('verseId').equals(id).delete();
    },
  );
}

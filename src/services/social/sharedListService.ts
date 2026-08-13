import {
  collection,
  doc,
  getDoc,
  setDoc,
  type Firestore,
} from 'firebase/firestore';
import { getFirestoreDb } from '@/lib/firebase';
import {
  addCustomVersesFromReferences,
  createCustomList,
  type BatchAddResult,
} from '@/services/customVerseService';
import type { CustomList } from '@/types/customVerse';

export type SharedListSnapshot = {
  id: string;
  name: string;
  accessCode: string;
  createdBy: string;
  createdAt: string;
  /** ESV references only — redeemers fetch passage text locally. */
  references: string[];
};

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function requireDb(): Firestore {
  const db = getFirestoreDb();
  if (!db) throw new Error('Firebase is not configured.');
  return db;
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function randomCode(length = 6): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  }
  return out;
}

function listCodeRef(db: Firestore, code: string) {
  return doc(db, 'listCodes', code);
}

function sharedListRef(db: Firestore, listId: string) {
  return doc(db, 'sharedLists', listId);
}

async function allocateListCode(db: Firestore): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = randomCode(6);
    const snap = await getDoc(listCodeRef(db, code));
    if (!snap.exists()) return code;
  }
  throw new Error('Could not generate a unique share code. Try again.');
}

function parseSharedList(
  id: string,
  data: Record<string, unknown>,
): SharedListSnapshot | null {
  if (
    typeof data.name !== 'string' ||
    typeof data.accessCode !== 'string' ||
    typeof data.createdBy !== 'string' ||
    !Array.isArray(data.references)
  ) {
    return null;
  }
  const references = data.references.filter(
    (item): item is string => typeof item === 'string' && item.trim() !== '',
  );
  if (references.length === 0) return null;
  return {
    id,
    name: data.name,
    accessCode: data.accessCode,
    createdBy: data.createdBy,
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : '',
    references,
  };
}

async function createUniqueLocalList(baseName: string): Promise<CustomList> {
  const trimmed = baseName.trim() || 'Shared list';
  try {
    return await createCustomList(trimmed);
  } catch {
    // Fall through — name already taken.
  }
  for (let n = 2; n <= 20; n += 1) {
    try {
      return await createCustomList(`${trimmed} (${n})`);
    } catch {
      // try next
    }
  }
  return createCustomList(
    `${trimmed} ${new Date().toISOString().slice(0, 10)}`,
  );
}

/**
 * Publish the active list’s references under a new 6-letter share code.
 */
export async function publishSharedList(input: {
  uid: string;
  name: string;
  references: string[];
}): Promise<SharedListSnapshot> {
  const name = input.name.trim();
  if (!name) throw new Error('That list has no name.');

  const references = [
    ...new Set(
      input.references
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    ),
  ];
  if (references.length === 0) {
    throw new Error('Add at least one passage before sharing this list.');
  }
  if (references.length > 200) {
    throw new Error('This list is too large to share (max 200 passages).');
  }

  const db = requireDb();
  const accessCode = await allocateListCode(db);
  const now = new Date().toISOString();
  const id = doc(collection(db, 'sharedLists')).id;
  const snapshot: SharedListSnapshot = {
    id,
    name,
    accessCode,
    createdBy: input.uid,
    createdAt: now,
    references,
  };

  await setDoc(sharedListRef(db, id), {
    name: snapshot.name,
    accessCode: snapshot.accessCode,
    createdBy: snapshot.createdBy,
    createdAt: snapshot.createdAt,
    references: snapshot.references,
  });
  await setDoc(listCodeRef(db, accessCode), {
    sharedListId: id,
    createdAt: now,
  });

  return snapshot;
}

export async function lookupSharedListByCode(
  code: string,
): Promise<SharedListSnapshot> {
  const normalized = normalizeCode(code);
  if (normalized.length < 4) {
    throw new Error('Enter a valid share code.');
  }

  const db = requireDb();
  const codeSnap = await getDoc(listCodeRef(db, normalized));
  if (!codeSnap.exists()) {
    throw new Error('No shared list found for that code.');
  }
  const sharedListId = codeSnap.data()?.sharedListId;
  if (typeof sharedListId !== 'string' || !sharedListId) {
    throw new Error('That share code is invalid.');
  }

  const listSnap = await getDoc(sharedListRef(db, sharedListId));
  if (!listSnap.exists()) {
    throw new Error('That shared list is no longer available.');
  }
  const parsed = parseSharedList(
    listSnap.id,
    listSnap.data() as Record<string, unknown>,
  );
  if (!parsed) {
    throw new Error('That shared list could not be read.');
  }
  return parsed;
}

export type ImportSharedListResult = {
  list: CustomList;
  accessCode: string;
  batch: BatchAddResult;
};

/**
 * Look up a share code and copy it into a new local custom list,
 * fetching ESV text for each reference.
 */
export async function importSharedListByCode(
  code: string,
  onProgress?: (done: number, total: number, reference: string) => void,
): Promise<ImportSharedListResult> {
  const snapshot = await lookupSharedListByCode(code);
  const list = await createUniqueLocalList(snapshot.name);
  const batch = await addCustomVersesFromReferences(
    snapshot.references.join('\n'),
    { mode: 'existing', listId: list.id },
    onProgress,
  );
  return { list, accessCode: snapshot.accessCode, batch };
}

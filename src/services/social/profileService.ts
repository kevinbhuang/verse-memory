import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { getFirestoreDb } from '@/lib/firebase';

export type UserProfile = {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  updatedAt: string;
};

/** Normalize for emailIndex document ids (exact Google email lookup). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function profileRef(uid: string) {
  const db = getFirestoreDb();
  if (!db) return null;
  return doc(db, 'users', uid, 'profile', 'public');
}

function emailIndexRef(normalizedEmail: string) {
  const db = getFirestoreDb();
  if (!db) return null;
  return doc(db, 'emailIndex', normalizedEmail);
}

/**
 * Upsert the signed-in user's profile and email → uid index.
 * Call after Google sign-in / auth restore.
 */
export async function upsertUserProfile(user: User): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;
  if (!user.email) {
    throw new Error('Your Google account has no email address.');
  }

  const email = normalizeEmail(user.email);
  const updatedAt = new Date().toISOString();
  const profile: UserProfile = {
    uid: user.uid,
    email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    updatedAt,
  };

  const pRef = profileRef(user.uid);
  const eRef = emailIndexRef(email);
  if (!pRef || !eRef) return;

  const existingIndex = await getDoc(eRef);
  if (existingIndex.exists()) {
    const owner = (existingIndex.data() as { uid?: string }).uid;
    if (owner && owner !== user.uid) {
      throw new Error(
        'That email is already linked to another Verse Memory account.',
      );
    }
  }

  await Promise.all([
    setDoc(pRef, profile, { merge: true }),
    setDoc(eRef, { uid: user.uid, updatedAt }, { merge: true }),
  ]);
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const ref = profileRef(uid);
  if (!ref) return null;
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() as Partial<UserProfile>;
  if (!data.uid || !data.email) return null;
  return {
    uid: data.uid,
    email: data.email,
    displayName: data.displayName ?? null,
    photoURL: data.photoURL ?? null,
    updatedAt: data.updatedAt ?? '',
  };
}

/** Resolve a Google sign-in email to a uid, if they have used the app. */
export async function lookupUidByEmail(
  email: string,
): Promise<{ uid: string } | null> {
  const normalized = normalizeEmail(email);
  if (!normalized || !normalized.includes('@')) {
    throw new Error('Enter a valid email address.');
  }
  const ref = emailIndexRef(normalized);
  if (!ref) throw new Error('Firebase is not configured.');
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const uid = (snap.data() as { uid?: string }).uid;
  if (!uid) return null;
  return { uid };
}

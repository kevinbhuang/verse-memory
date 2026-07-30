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
 * Preserves a custom displayName if the user already set one.
 */
export async function upsertUserProfile(user: User): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;
  if (!user.email) {
    throw new Error('Your Google account has no email address.');
  }

  const email = normalizeEmail(user.email);
  const updatedAt = new Date().toISOString();
  const pRef = profileRef(user.uid);
  const eRef = emailIndexRef(email);
  if (!pRef || !eRef) return;

  const [existingProfile, existingIndex] = await Promise.all([
    getDoc(pRef),
    getDoc(eRef),
  ]);

  if (existingIndex.exists()) {
    const owner = (existingIndex.data() as { uid?: string }).uid;
    if (owner && owner !== user.uid) {
      throw new Error(
        'That email is already linked to another Verse Memory account.',
      );
    }
  }

  const previousName = existingProfile.exists()
    ? ((existingProfile.data() as Partial<UserProfile>).displayName ?? null)
    : null;
  const displayName =
    typeof previousName === 'string' && previousName.trim().length > 0
      ? previousName.trim()
      : user.displayName;

  const profile: UserProfile = {
    uid: user.uid,
    email,
    displayName,
    photoURL: user.photoURL,
    updatedAt,
  };

  await Promise.all([
    setDoc(pRef, profile, { merge: true }),
    setDoc(eRef, { uid: user.uid, updatedAt }, { merge: true }),
  ]);
}

const DISPLAY_NAME_MAX = 40;

/**
 * Update the public display name shown in groups / leaderboards.
 */
export async function updateDisplayName(
  user: User,
  displayName: string,
): Promise<UserProfile> {
  const trimmed = displayName.trim().replace(/\s+/g, ' ');
  if (trimmed.length < 1) {
    throw new Error('Enter a display name.');
  }
  if (trimmed.length > DISPLAY_NAME_MAX) {
    throw new Error(`Keep display names to ${DISPLAY_NAME_MAX} characters.`);
  }
  if (!user.email) {
    throw new Error('Your Google account has no email address.');
  }

  const pRef = profileRef(user.uid);
  if (!pRef) throw new Error('Firebase is not configured.');

  const updatedAt = new Date().toISOString();
  const email = normalizeEmail(user.email);

  // Ensure a full profile exists (first-time name edit before upsert finishes).
  await setDoc(
    pRef,
    {
      uid: user.uid,
      email,
      displayName: trimmed,
      photoURL: user.photoURL,
      updatedAt,
    } satisfies UserProfile,
    { merge: true },
  );

  const next = await getUserProfile(user.uid);
  if (!next) throw new Error('Could not save display name.');
  return next;
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

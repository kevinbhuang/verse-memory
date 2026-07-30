import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  type Firestore,
} from 'firebase/firestore';
import { getFirestoreDb } from '@/lib/firebase';
import { getUserProfile, type UserProfile } from './profileService';
import { readPublicProgressSummary } from './publicProgressService';

export type ShareRequestStatus =
  | 'pending'
  | 'approved'
  | 'declined'
  | 'revoked'
  | 'cancelled';

export type ShareRequest = {
  id: string;
  fromUid: string;
  toUid: string;
  status: ShareRequestStatus;
  createdAt: string;
  updatedAt: string;
};

export type ShareEdge = {
  ownerUid: string;
  viewerUid: string;
  requestId: string;
  createdAt: string;
};

function requireDb(): Firestore {
  const db = getFirestoreDb();
  if (!db) throw new Error('Firebase is not configured.');
  return db;
}

/** One directional request per pair: requester → recipient. */
export function shareRequestId(fromUid: string, toUid: string): string {
  return `${fromUid}_${toUid}`;
}

function requestRef(db: Firestore, id: string) {
  return doc(db, 'shareRequests', id);
}

function shareRef(db: Firestore, ownerUid: string, viewerUid: string) {
  return doc(db, 'users', ownerUid, 'shares', viewerUid);
}

function parseRequest(
  id: string,
  data: Record<string, unknown>,
): ShareRequest | null {
  const fromUid = data.fromUid;
  const toUid = data.toUid;
  const status = data.status;
  if (
    typeof fromUid !== 'string' ||
    typeof toUid !== 'string' ||
    typeof status !== 'string'
  ) {
    return null;
  }
  return {
    id,
    fromUid,
    toUid,
    status: status as ShareRequestStatus,
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : '',
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '',
  };
}

/**
 * Send a one-way request: fromUid wants to view toUid’s Progress Chart.
 */
export async function sendShareRequest(
  fromUid: string,
  toUid: string,
): Promise<ShareRequest> {
  if (fromUid === toUid) {
    throw new Error('You can’t send a request to yourself.');
  }
  const db = requireDb();
  const id = shareRequestId(fromUid, toUid);
  const ref = requestRef(db, id);
  const existing = await getDoc(ref);
  if (existing.exists()) {
    const current = parseRequest(id, existing.data() as Record<string, unknown>);
    if (current?.status === 'pending') {
      throw new Error('You already have a pending request to this person.');
    }
    if (current?.status === 'approved') {
      throw new Error('You can already view their Progress Chart.');
    }
  }

  const now = new Date().toISOString();
  const request: ShareRequest = {
    id,
    fromUid,
    toUid,
    status: 'pending',
    createdAt: existing.exists()
      ? ((existing.data() as { createdAt?: string }).createdAt ?? now)
      : now,
    updatedAt: now,
  };
  await setDoc(ref, request);
  return request;
}

export async function approveShareRequest(
  requestId: string,
  actingUid: string,
): Promise<void> {
  const db = requireDb();
  const ref = requestRef(db, requestId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Request not found.');
  const request = parseRequest(requestId, snap.data() as Record<string, unknown>);
  if (!request) throw new Error('Request is invalid.');
  if (request.toUid !== actingUid) {
    throw new Error('Only the recipient can approve this request.');
  }
  if (request.status !== 'pending') {
    throw new Error('This request is no longer pending.');
  }

  const now = new Date().toISOString();
  await setDoc(
    ref,
    { ...request, status: 'approved', updatedAt: now },
    { merge: true },
  );
  await setDoc(shareRef(db, request.toUid, request.fromUid), {
    ownerUid: request.toUid,
    viewerUid: request.fromUid,
    requestId,
    createdAt: now,
  } satisfies ShareEdge);
}

export async function declineShareRequest(
  requestId: string,
  actingUid: string,
): Promise<void> {
  const db = requireDb();
  const ref = requestRef(db, requestId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Request not found.');
  const request = parseRequest(requestId, snap.data() as Record<string, unknown>);
  if (!request) throw new Error('Request is invalid.');
  if (request.toUid !== actingUid) {
    throw new Error('Only the recipient can decline this request.');
  }
  if (request.status !== 'pending') {
    throw new Error('This request is no longer pending.');
  }
  const now = new Date().toISOString();
  await setDoc(
    ref,
    { ...request, status: 'declined', updatedAt: now },
    { merge: true },
  );
}

/** Requester cancels a pending outgoing request. */
export async function cancelShareRequest(
  requestId: string,
  actingUid: string,
): Promise<void> {
  const db = requireDb();
  const ref = requestRef(db, requestId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Request not found.');
  const request = parseRequest(requestId, snap.data() as Record<string, unknown>);
  if (!request) throw new Error('Request is invalid.');
  if (request.fromUid !== actingUid) {
    throw new Error('Only the sender can cancel this request.');
  }
  if (request.status !== 'pending') {
    throw new Error('This request is no longer pending.');
  }
  const now = new Date().toISOString();
  await setDoc(
    ref,
    { ...request, status: 'cancelled', updatedAt: now },
    { merge: true },
  );
}

/**
 * Either party removes access: deletes the share edge and marks the request revoked.
 */
export async function revokeShareAccess(input: {
  ownerUid: string;
  viewerUid: string;
  actingUid: string;
}): Promise<void> {
  const { ownerUid, viewerUid, actingUid } = input;
  if (actingUid !== ownerUid && actingUid !== viewerUid) {
    throw new Error('You can’t revoke this share.');
  }
  const db = requireDb();
  const now = new Date().toISOString();
  const id = shareRequestId(viewerUid, ownerUid);
  const ref = requestRef(db, id);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const request = parseRequest(id, snap.data() as Record<string, unknown>);
    if (request) {
      await setDoc(
        ref,
        { ...request, status: 'revoked', updatedAt: now },
        { merge: true },
      );
    }
  }
  await deleteDoc(shareRef(db, ownerUid, viewerUid));
}

async function listRequestsWhere(
  field: 'fromUid' | 'toUid',
  uid: string,
  status?: ShareRequestStatus,
): Promise<ShareRequest[]> {
  const db = requireDb();
  const constraints = status
    ? [where(field, '==', uid), where('status', '==', status)]
    : [where(field, '==', uid)];
  const q = query(collection(db, 'shareRequests'), ...constraints);
  const snap = await getDocs(q);
  const list: ShareRequest[] = [];
  for (const docSnap of snap.docs) {
    const parsed = parseRequest(
      docSnap.id,
      docSnap.data() as Record<string, unknown>,
    );
    if (parsed) list.push(parsed);
  }
  return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function listIncomingPending(
  uid: string,
): Promise<ShareRequest[]> {
  return listRequestsWhere('toUid', uid, 'pending');
}

export async function listOutgoingPending(
  uid: string,
): Promise<ShareRequest[]> {
  return listRequestsWhere('fromUid', uid, 'pending');
}

/** People whose charts I can view (I am viewer on their shares). */
export async function listViewableOwners(viewerUid: string): Promise<
  Array<{
    ownerUid: string;
    share: ShareEdge;
    profile: UserProfile | null;
    memorizedCount: number | null;
    needsReviewCount: number | null;
    total: number | null;
  }>
> {
  const db = requireDb();
  // Approved requests where I am the requester.
  const approved = await listRequestsWhere('fromUid', viewerUid, 'approved');
  const results: Array<{
    ownerUid: string;
    share: ShareEdge;
    profile: UserProfile | null;
    memorizedCount: number | null;
    needsReviewCount: number | null;
    total: number | null;
  }> = [];

  for (const request of approved) {
    const edgeSnap = await getDoc(shareRef(db, request.toUid, viewerUid));
    if (!edgeSnap.exists()) continue;
    const share = edgeSnap.data() as ShareEdge;
    const [profile, summary] = await Promise.all([
      getUserProfile(request.toUid),
      readPublicProgressSummary(request.toUid).catch(() => null),
    ]);
    results.push({
      ownerUid: request.toUid,
      share,
      profile,
      memorizedCount: summary?.memorizedCount ?? null,
      needsReviewCount: summary?.needsReviewCount ?? null,
      total: summary?.total ?? null,
    });
  }

  return results;
}

/** People who can view my chart (I am owner). */
export async function listMyViewers(ownerUid: string): Promise<
  Array<{ viewerUid: string; share: ShareEdge; profile: UserProfile | null }>
> {
  const db = requireDb();
  const snap = await getDocs(collection(db, 'users', ownerUid, 'shares'));
  const results: Array<{
    viewerUid: string;
    share: ShareEdge;
    profile: UserProfile | null;
  }> = [];

  for (const docSnap of snap.docs) {
    const share = docSnap.data() as ShareEdge;
    const viewerUid = share.viewerUid ?? docSnap.id;
    const profile = await getUserProfile(viewerUid);
    results.push({ viewerUid, share, profile });
  }

  return results;
}

export async function canViewPublicProgress(
  ownerUid: string,
  viewerUid: string,
): Promise<boolean> {
  if (ownerUid === viewerUid) return true;
  const db = requireDb();
  const snap = await getDoc(shareRef(db, ownerUid, viewerUid));
  return snap.exists();
}

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

export type GroupRole = 'leader' | 'member';
export type MembershipStatus = 'pending' | 'active' | 'rejected' | 'left';

export type MemoryGroup = {
  id: string;
  name: string;
  accessCode: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type GroupMember = {
  uid: string;
  role: GroupRole;
  status: MembershipStatus;
  createdAt: string;
  updatedAt: string;
};

export type GroupMembershipIndex = {
  groupId: string;
  name: string;
  accessCode: string;
  role: GroupRole;
  status: MembershipStatus;
  updatedAt: string;
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

function groupRef(db: Firestore, groupId: string) {
  return doc(db, 'groups', groupId);
}

function codeRef(db: Firestore, code: string) {
  return doc(db, 'groupCodes', code);
}

function memberRef(db: Firestore, groupId: string, uid: string) {
  return doc(db, 'groups', groupId, 'members', uid);
}

function membershipIndexRef(db: Firestore, uid: string, groupId: string) {
  return doc(db, 'users', uid, 'groupMemberships', groupId);
}

function shareRef(db: Firestore, ownerUid: string, viewerUid: string) {
  return doc(db, 'users', ownerUid, 'shares', viewerUid);
}

async function allocateAccessCode(db: Firestore): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = randomCode(6);
    const snap = await getDoc(codeRef(db, code));
    if (!snap.exists()) return code;
  }
  throw new Error('Could not generate a unique access code. Try again.');
}

function parseGroup(
  id: string,
  data: Record<string, unknown>,
): MemoryGroup | null {
  if (
    typeof data.name !== 'string' ||
    typeof data.accessCode !== 'string' ||
    typeof data.createdBy !== 'string'
  ) {
    return null;
  }
  return {
    id,
    name: data.name,
    accessCode: data.accessCode,
    createdBy: data.createdBy,
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : '',
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '',
  };
}

function parseMember(
  uid: string,
  data: Record<string, unknown>,
): GroupMember | null {
  if (typeof data.role !== 'string' || typeof data.status !== 'string') {
    return null;
  }
  return {
    uid,
    role: data.role as GroupRole,
    status: data.status as MembershipStatus,
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : '',
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '',
  };
}

async function writeMembershipIndex(
  db: Firestore,
  uid: string,
  group: Pick<MemoryGroup, 'id' | 'name' | 'accessCode'>,
  role: GroupRole,
  status: MembershipStatus,
  updatedAt: string,
): Promise<void> {
  await setDoc(membershipIndexRef(db, uid, group.id), {
    groupId: group.id,
    name: group.name,
    accessCode: group.accessCode,
    role,
    status,
    updatedAt,
  } satisfies GroupMembershipIndex);
}

/** Mutual chart access for two active group members. */
async function grantMutualShare(
  db: Firestore,
  a: string,
  b: string,
  groupId: string,
): Promise<void> {
  if (a === b) return;
  const now = new Date().toISOString();
  const payload = (ownerUid: string, viewerUid: string) => ({
    ownerUid,
    viewerUid,
    groupId,
    createdAt: now,
  });
  await Promise.all([
    setDoc(shareRef(db, a, b), payload(a, b), { merge: true }),
    setDoc(shareRef(db, b, a), payload(b, a), { merge: true }),
  ]);
}

async function revokeMutualShare(
  db: Firestore,
  a: string,
  b: string,
): Promise<void> {
  if (a === b) return;
  await Promise.all([
    deleteDoc(shareRef(db, a, b)).catch(() => undefined),
    deleteDoc(shareRef(db, b, a)).catch(() => undefined),
  ]);
}

async function listActiveMemberUids(
  db: Firestore,
  groupId: string,
): Promise<string[]> {
  const q = query(
    collection(db, 'groups', groupId, 'members'),
    where('status', '==', 'active'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.id);
}

/**
 * Create a group. Creator becomes leader (active) and receives an access code.
 */
export async function createGroup(
  uid: string,
  name: string,
): Promise<MemoryGroup> {
  const trimmed = name.trim();
  if (trimmed.length < 2) {
    throw new Error('Enter a group name (at least 2 characters).');
  }
  if (trimmed.length > 60) {
    throw new Error('Group name is too long.');
  }

  const db = requireDb();
  const accessCode = await allocateAccessCode(db);
  const now = new Date().toISOString();
  const groupId = doc(collection(db, 'groups')).id;
  const group: MemoryGroup = {
    id: groupId,
    name: trimmed,
    accessCode,
    createdBy: uid,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(groupRef(db, groupId), group);
  await setDoc(codeRef(db, accessCode), { groupId, createdAt: now });
  await setDoc(memberRef(db, groupId, uid), {
    uid,
    role: 'leader',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  } satisfies GroupMember);
  await writeMembershipIndex(db, uid, group, 'leader', 'active', now);

  return group;
}

export async function getGroup(groupId: string): Promise<MemoryGroup | null> {
  const db = requireDb();
  const snap = await getDoc(groupRef(db, groupId));
  if (!snap.exists()) return null;
  return parseGroup(snap.id, snap.data() as Record<string, unknown>);
}

export async function lookupGroupByAccessCode(
  code: string,
): Promise<MemoryGroup | null> {
  const normalized = normalizeCode(code);
  if (normalized.length < 4) {
    throw new Error('Enter the full access code.');
  }
  const db = requireDb();
  const snap = await getDoc(codeRef(db, normalized));
  if (!snap.exists()) return null;
  const groupId = (snap.data() as { groupId?: string }).groupId;
  if (!groupId) return null;
  return getGroup(groupId);
}

/**
 * Request to join via access code. Leader must approve.
 */
export async function requestJoinWithCode(
  uid: string,
  code: string,
): Promise<{ group: MemoryGroup; status: MembershipStatus }> {
  const group = await lookupGroupByAccessCode(code);
  if (!group) {
    throw new Error('No group found for that access code.');
  }

  const db = requireDb();
  const existing = await getDoc(memberRef(db, group.id, uid));
  if (existing.exists()) {
    const member = parseMember(uid, existing.data() as Record<string, unknown>);
    if (member?.status === 'active') {
      throw new Error('You’re already in this group.');
    }
    if (member?.status === 'pending') {
      throw new Error('Your join request is already pending approval.');
    }
  }

  const now = new Date().toISOString();
  const member: GroupMember = {
    uid,
    role: 'member',
    status: 'pending',
    createdAt: existing.exists()
      ? ((existing.data() as { createdAt?: string }).createdAt ?? now)
      : now,
    updatedAt: now,
  };
  await setDoc(memberRef(db, group.id, uid), member);
  await writeMembershipIndex(db, uid, group, 'member', 'pending', now);
  return { group, status: 'pending' };
}

export async function listMyGroupMemberships(
  uid: string,
): Promise<GroupMembershipIndex[]> {
  const db = requireDb();
  const snap = await getDocs(collection(db, 'users', uid, 'groupMemberships'));
  const list: GroupMembershipIndex[] = [];
  for (const docSnap of snap.docs) {
    const data = docSnap.data() as Partial<GroupMembershipIndex>;
    if (!data.groupId || !data.name || !data.status || !data.role) continue;
    list.push({
      groupId: data.groupId,
      name: data.name,
      accessCode: data.accessCode ?? '',
      role: data.role,
      status: data.status,
      updatedAt: data.updatedAt ?? '',
    });
  }
  return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function listPendingJoinRequests(
  groupId: string,
): Promise<Array<{ member: GroupMember; profile: UserProfile | null }>> {
  const db = requireDb();
  const q = query(
    collection(db, 'groups', groupId, 'members'),
    where('status', '==', 'pending'),
  );
  const snap = await getDocs(q);
  const results: Array<{ member: GroupMember; profile: UserProfile | null }> =
    [];
  for (const docSnap of snap.docs) {
    const member = parseMember(
      docSnap.id,
      docSnap.data() as Record<string, unknown>,
    );
    if (!member) continue;
    results.push({
      member,
      profile: await getUserProfile(member.uid),
    });
  }
  return results.sort((a, b) =>
    b.member.updatedAt.localeCompare(a.member.updatedAt),
  );
}

export async function listActiveGroupMembers(groupId: string): Promise<
  Array<{
    member: GroupMember;
    profile: UserProfile | null;
    memorizedCount: number | null;
    needsReviewCount: number | null;
    total: number | null;
  }>
> {
  const db = requireDb();
  const q = query(
    collection(db, 'groups', groupId, 'members'),
    where('status', '==', 'active'),
  );
  const snap = await getDocs(q);
  const results: Array<{
    member: GroupMember;
    profile: UserProfile | null;
    memorizedCount: number | null;
    needsReviewCount: number | null;
    total: number | null;
  }> = [];

  for (const docSnap of snap.docs) {
    const member = parseMember(
      docSnap.id,
      docSnap.data() as Record<string, unknown>,
    );
    if (!member) continue;
    const [profile, summary] = await Promise.all([
      getUserProfile(member.uid),
      readPublicProgressSummary(member.uid).catch(() => null),
    ]);
    results.push({
      member,
      profile,
      memorizedCount: summary?.memorizedCount ?? null,
      needsReviewCount: summary?.needsReviewCount ?? null,
      total: summary?.total ?? null,
    });
  }

  return results.sort((a, b) => {
    if (a.member.role === 'leader' && b.member.role !== 'leader') return -1;
    if (b.member.role === 'leader' && a.member.role !== 'leader') return 1;
    const nameA = a.profile?.displayName ?? a.profile?.email ?? a.member.uid;
    const nameB = b.profile?.displayName ?? b.profile?.email ?? b.member.uid;
    return nameA.localeCompare(nameB);
  });
}

export async function approveJoinRequest(
  groupId: string,
  leaderUid: string,
  memberUid: string,
): Promise<void> {
  const db = requireDb();
  const group = await getGroup(groupId);
  if (!group) throw new Error('Group not found.');
  if (group.createdBy !== leaderUid) {
    throw new Error('Only the group creator can approve join requests.');
  }

  const ref = memberRef(db, groupId, memberUid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Join request not found.');
  const member = parseMember(memberUid, snap.data() as Record<string, unknown>);
  if (!member || member.status !== 'pending') {
    throw new Error('This request is no longer pending.');
  }

  const now = new Date().toISOString();
  await setDoc(
    ref,
    { ...member, status: 'active', role: 'member', updatedAt: now },
    { merge: true },
  );
  await writeMembershipIndex(db, memberUid, group, 'member', 'active', now);

  const activeUids = await listActiveMemberUids(db, groupId);
  await Promise.all(
    activeUids
      .filter((uid) => uid !== memberUid)
      .map((uid) => grantMutualShare(db, uid, memberUid, groupId)),
  );
}

export async function rejectJoinRequest(
  groupId: string,
  leaderUid: string,
  memberUid: string,
): Promise<void> {
  const db = requireDb();
  const group = await getGroup(groupId);
  if (!group) throw new Error('Group not found.');
  if (group.createdBy !== leaderUid) {
    throw new Error('Only the group creator can reject join requests.');
  }

  const ref = memberRef(db, groupId, memberUid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Join request not found.');
  const member = parseMember(memberUid, snap.data() as Record<string, unknown>);
  if (!member || member.status !== 'pending') {
    throw new Error('This request is no longer pending.');
  }

  const now = new Date().toISOString();
  await setDoc(
    ref,
    { ...member, status: 'rejected', updatedAt: now },
    { merge: true },
  );
  await writeMembershipIndex(db, memberUid, group, 'member', 'rejected', now);
}

/** Member cancels their own pending request. */
export async function cancelJoinRequest(
  groupId: string,
  uid: string,
): Promise<void> {
  const db = requireDb();
  const group = await getGroup(groupId);
  if (!group) throw new Error('Group not found.');
  const ref = memberRef(db, groupId, uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const member = parseMember(uid, snap.data() as Record<string, unknown>);
  if (!member || member.status !== 'pending') {
    throw new Error('No pending request to cancel.');
  }
  const now = new Date().toISOString();
  await setDoc(
    ref,
    { ...member, status: 'left', updatedAt: now },
    { merge: true },
  );
  await writeMembershipIndex(db, uid, group, 'member', 'left', now);
}

/** Leave an active group (not available to the sole leader — transfer later). */
export async function leaveGroup(groupId: string, uid: string): Promise<void> {
  const db = requireDb();
  const group = await getGroup(groupId);
  if (!group) throw new Error('Group not found.');
  if (group.createdBy === uid) {
    throw new Error(
      'The group creator can’t leave yet. Remove the group or transfer leadership first (coming later).',
    );
  }

  const ref = memberRef(db, groupId, uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const member = parseMember(uid, snap.data() as Record<string, unknown>);
  if (!member || member.status !== 'active') {
    throw new Error('You’re not an active member of this group.');
  }

  const others = (await listActiveMemberUids(db, groupId)).filter(
    (id) => id !== uid,
  );
  await Promise.all(others.map((other) => revokeMutualShare(db, uid, other)));

  const now = new Date().toISOString();
  await setDoc(
    ref,
    { ...member, status: 'left', updatedAt: now },
    { merge: true },
  );
  await writeMembershipIndex(db, uid, group, 'member', 'left', now);
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

export { normalizeCode };

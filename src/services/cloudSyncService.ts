import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getFirestoreDb } from '@/lib/firebase';
import { onLocalDataChanged } from '@/lib/localDataEvents';
import {
  applyImport,
  buildBackup,
  backupSchema,
  type BackupFile,
} from '@/services/backupService';
import { getDataStore } from '@/repositories';
import { writePublicProgressSummary } from '@/services/social/publicProgressService';

const META_KEY = 'verse-memory:cloud-sync-meta';
const PUSH_DEBOUNCE_MS = 3000;

export type SyncStatus =
  | 'idle'
  | 'syncing'
  | 'synced'
  | 'offline'
  | 'error'
  | 'disabled';

export type SyncDecision = 'push' | 'pull' | 'noop';

type SyncMeta = {
  uid: string | null;
  lastSyncedCloudUpdatedAt: string | null;
  lastLocalPushAt: string | null;
};

type CloudProgressDoc = {
  updatedAt: string;
  backup: BackupFile;
};

type StatusListener = (status: SyncStatus, detail?: string | null) => void;

let status: SyncStatus = 'disabled';
let statusDetail: string | null = null;
let listeners = new Set<StatusListener>();
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let syncing = false;
let activeUid: string | null = null;
/** Blocks push while a pull is applying, so we don't bounce data back up. */
let suppressPush = false;

function readMeta(): SyncMeta {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) {
      return {
        uid: null,
        lastSyncedCloudUpdatedAt: null,
        lastLocalPushAt: null,
      };
    }
    const parsed = JSON.parse(raw) as Partial<SyncMeta>;
    return {
      uid: parsed.uid ?? null,
      lastSyncedCloudUpdatedAt: parsed.lastSyncedCloudUpdatedAt ?? null,
      lastLocalPushAt: parsed.lastLocalPushAt ?? null,
    };
  } catch {
    return {
      uid: null,
      lastSyncedCloudUpdatedAt: null,
      lastLocalPushAt: null,
    };
  }
}

function writeMeta(next: SyncMeta): void {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(next));
  } catch {
    // Private mode may refuse storage; sync still works for this session.
  }
}

function setStatus(next: SyncStatus, detail: string | null = null): void {
  status = next;
  statusDetail = detail;
  for (const listener of listeners) listener(status, statusDetail);
}

export function getSyncStatus(): {
  status: SyncStatus;
  detail: string | null;
} {
  return { status, detail: statusDetail };
}

export function subscribeSyncStatus(listener: StatusListener): () => void {
  listeners.add(listener);
  listener(status, statusDetail);
  return () => {
    listeners.delete(listener);
  };
}

/** Latest meaningful local edit time, or null if the device has no progress yet. */
export async function getLocalStamp(): Promise<string | null> {
  const [progress, settings] = await Promise.all([
    getDataStore().progress.all(),
    getDataStore().settings.get(),
  ]);

  let stamp: string | null = null;
  for (const record of progress) {
    if (!stamp || record.updatedAt > stamp) stamp = record.updatedAt;
  }
  if (settings?.updatedAt && (!stamp || settings.updatedAt > stamp)) {
    stamp = settings.updatedAt;
  }

  // Treat a fresh install (only default settings, no progress rows) as empty.
  if (progress.length === 0) return null;
  return stamp;
}

/**
 * Last-write-wins decision for whole-backup sync.
 * Exported for unit tests.
 */
export function decideSyncAction(input: {
  cloudUpdatedAt: string | null;
  localStamp: string | null;
}): SyncDecision {
  const { cloudUpdatedAt, localStamp } = input;
  if (!cloudUpdatedAt && !localStamp) return 'noop';
  if (!cloudUpdatedAt) return 'push';
  if (!localStamp) return 'pull';
  if (cloudUpdatedAt > localStamp) return 'pull';
  if (localStamp > cloudUpdatedAt) return 'push';
  return 'noop';
}

function progressDocRef(uid: string) {
  const db = getFirestoreDb();
  if (!db) return null;
  return doc(db, 'users', uid, 'data', 'progress');
}

async function readCloud(uid: string): Promise<CloudProgressDoc | null> {
  const ref = progressDocRef(uid);
  if (!ref) throw new Error('Firebase is not configured.');
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() as Partial<CloudProgressDoc>;
  if (!data.updatedAt || !data.backup) return null;
  const parsed = backupSchema.safeParse(data.backup);
  if (!parsed.success) {
    throw new Error('Cloud backup is invalid or from a newer app version.');
  }
  return { updatedAt: data.updatedAt, backup: parsed.data };
}

async function writeCloud(uid: string, backup: BackupFile): Promise<string> {
  const ref = progressDocRef(uid);
  if (!ref) throw new Error('Firebase is not configured.');
  const updatedAt = backup.exportedAt;
  await setDoc(ref, { updatedAt, backup } satisfies CloudProgressDoc);
  return updatedAt;
}

async function pullFromCloud(uid: string, cloud: CloudProgressDoc): Promise<void> {
  suppressPush = true;
  try {
    // Replace keeps one shared cloud snapshot as the source of truth for LWW.
    await applyImport(cloud.backup, 'replace');
    writeMeta({
      uid,
      lastSyncedCloudUpdatedAt: cloud.updatedAt,
      lastLocalPushAt: readMeta().lastLocalPushAt,
    });
  } finally {
    suppressPush = false;
  }
}

async function pushToCloud(uid: string): Promise<void> {
  const backup = await buildBackup();
  // Prefer the newest local progress stamp so LWW compares apples-to-apples.
  const localStamp = (await getLocalStamp()) ?? backup.exportedAt;
  const stamped: BackupFile = { ...backup, exportedAt: localStamp };
  const updatedAt = await writeCloud(uid, stamped);
  writeMeta({
    uid,
    lastSyncedCloudUpdatedAt: updatedAt,
    lastLocalPushAt: updatedAt,
  });
  await writePublicProgressSummary(uid);
}

/**
 * Compare local vs cloud and push or pull. Call on sign-in, online, and focus.
 */
export async function runCloudSync(uid: string): Promise<void> {
  if (!getFirestoreDb()) {
    setStatus('disabled');
    return;
  }
  if (!navigator.onLine) {
    setStatus('offline');
    return;
  }
  if (syncing) return;

  activeUid = uid;
  syncing = true;
  setStatus('syncing');

  try {
    const [cloud, localStamp] = await Promise.all([
      readCloud(uid),
      getLocalStamp(),
    ]);
    const decision = decideSyncAction({
      cloudUpdatedAt: cloud?.updatedAt ?? null,
      localStamp,
    });

    if (decision === 'pull' && cloud) {
      await pullFromCloud(uid, cloud);
      await writePublicProgressSummary(uid);
    } else if (decision === 'push') {
      await pushToCloud(uid);
    } else if (cloud) {
      writeMeta({
        uid,
        lastSyncedCloudUpdatedAt: cloud.updatedAt,
        lastLocalPushAt: readMeta().lastLocalPushAt,
      });
      // Keep the shareable summary fresh even when backup LWW is a noop.
      await writePublicProgressSummary(uid);
    } else {
      await writePublicProgressSummary(uid);
    }

    setStatus('synced');
  } catch (error) {
    setStatus(
      'error',
      error instanceof Error ? error.message : 'Cloud sync failed.',
    );
  } finally {
    syncing = false;
  }
}

/** Debounced upload after local edits. */
export function scheduleCloudPush(uid?: string | null): void {
  const targetUid = uid ?? activeUid;
  if (!targetUid || suppressPush || !getFirestoreDb()) return;
  if (!navigator.onLine) {
    setStatus('offline');
    return;
  }

  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void (async () => {
      if (syncing || suppressPush) {
        scheduleCloudPush(targetUid);
        return;
      }
      syncing = true;
      setStatus('syncing');
      try {
        await pushToCloud(targetUid);
        setStatus('synced');
      } catch (error) {
        setStatus(
          'error',
          error instanceof Error ? error.message : 'Cloud sync failed.',
        );
      } finally {
        syncing = false;
      }
    })();
  }, PUSH_DEBOUNCE_MS);
}

onLocalDataChanged(() => {
  scheduleCloudPush();
});

export function setActiveSyncUser(uid: string | null): void {
  activeUid = uid;
  if (!uid) {
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = null;
    setStatus('idle');
  }
}

export function clearSyncMeta(): void {
  try {
    localStorage.removeItem(META_KEY);
  } catch {
    // ignore
  }
}

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  GoogleAuthProvider,
  browserPopupRedirectResolver,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { getFirebaseAuth, isFirebaseConfigured } from '@/lib/firebase';
import {
  clearSyncMeta,
  runCloudSync,
  setActiveSyncUser,
  subscribeSyncStatus,
  type SyncStatus,
} from '@/services/cloudSyncService';
import { upsertUserProfile } from '@/services/social/profileService';
import { useSettings } from '@/hooks/useSettings';

type AuthContextValue = {
  configured: boolean;
  user: User | null;
  loading: boolean;
  syncStatus: SyncStatus;
  syncDetail: string | null;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isFirebaseConfigured();
  const { reload: reloadSettings } = useSettings();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(configured);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(
    configured ? 'idle' : 'disabled',
  );
  const [syncDetail, setSyncDetail] = useState<string | null>(null);

  useEffect(
    () =>
      subscribeSyncStatus((next, detail) => {
        setSyncStatus(next);
        setSyncDetail(detail ?? null);
      }),
    [],
  );

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }
    const auth = getFirebaseAuth();
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsub = onAuthStateChanged(auth, (next) => {
      setUser(next);
      setLoading(false);
      setActiveSyncUser(next?.uid ?? null);
      if (next) {
        void (async () => {
          try {
            await upsertUserProfile(next);
          } catch (error) {
            console.warn('Could not upsert user profile:', error);
          }
          await runCloudSync(next.uid);
          reloadSettings();
        })();
      }
    });
    return unsub;
  }, [configured, reloadSettings]);

  useEffect(() => {
    if (!user) return;

    const sync = () => {
      void runCloudSync(user.uid).then(() => reloadSettings());
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') sync();
    };

    window.addEventListener('online', sync);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', sync);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [reloadSettings, user]);

  const signInWithGoogle = useCallback(async () => {
    const auth = getFirebaseAuth();
    if (!auth) {
      throw new Error('Firebase is not configured on this build.');
    }
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await signInWithPopup(auth, provider, browserPopupRedirectResolver);
  }, []);

  const signOutUser = useCallback(async () => {
    const auth = getFirebaseAuth();
    if (!auth) return;
    setActiveSyncUser(null);
    clearSyncMeta();
    await signOut(auth);
  }, []);

  const value = useMemo(
    () => ({
      configured,
      user,
      loading,
      syncStatus,
      syncDetail,
      signInWithGoogle,
      signOutUser,
    }),
    [
      configured,
      loading,
      signInWithGoogle,
      signOutUser,
      syncDetail,
      syncStatus,
      user,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return value;
}

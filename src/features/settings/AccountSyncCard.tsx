import { useState } from 'react';
import { Cloud, CloudOff, LoaderCircle, LogIn, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/hooks/useAuth';
import type { SyncStatus } from '@/services/cloudSyncService';

function statusLabel(status: SyncStatus, detail: string | null): string {
  switch (status) {
    case 'syncing':
      return 'Syncing…';
    case 'synced':
      return 'Synced';
    case 'offline':
      return 'Offline — will sync when you reconnect';
    case 'error':
      return detail ? `Sync error: ${detail}` : 'Sync error';
    case 'disabled':
      return 'Cloud sync is not configured for this build';
    default:
      return 'Ready to sync';
  }
}

export function AccountSyncCard() {
  const {
    configured,
    user,
    loading,
    syncStatus,
    syncDetail,
    signInWithGoogle,
    signOutUser,
  } = useAuth();
  const { notify } = useToast();
  const [busy, setBusy] = useState(false);

  const onSignIn = async () => {
    setBusy(true);
    try {
      await signInWithGoogle();
      notify('Signed in. Progress will sync automatically.', 'success');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Sign-in failed.';
      notify(message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const onSignOut = async () => {
    setBusy(true);
    try {
      await signOutUser();
      notify('Signed out. Progress on this device was kept.', 'success');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Sign-out failed.';
      notify(message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!configured) {
    return (
      <Card>
        <CardHeader title="Account" />
        <CardBody className="space-y-2 text-sm text-ink-muted">
          <p className="inline-flex items-center gap-2">
            <CloudOff className="size-4 shrink-0" aria-hidden="true" />
            Cloud sync is not configured in this environment.
          </p>
          <p>
            Add the Firebase web config to your <code>.env</code> file to enable
            Google sign-in and automatic progress sync.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Account" />
      <CardBody className="space-y-4">
        {loading ? (
          <p className="inline-flex items-center gap-2 text-sm text-ink-muted">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            Checking sign-in…
          </p>
        ) : user ? (
          <>
            <div className="flex items-start gap-3">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt=""
                  className="size-10 rounded-full border border-line"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex size-10 items-center justify-center rounded-full bg-surface-muted text-sm font-medium text-ink">
                  {(user.displayName ?? user.email ?? '?')
                    .slice(0, 1)
                    .toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">
                  {user.displayName ?? 'Signed in'}
                </p>
                {user.email ? (
                  <p className="truncate text-sm text-ink-muted">{user.email}</p>
                ) : null}
              </div>
            </div>

            <p className="inline-flex items-start gap-2 text-sm text-ink-muted">
              {syncStatus === 'syncing' ? (
                <LoaderCircle
                  className="mt-0.5 size-4 shrink-0 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Cloud className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              )}
              <span>{statusLabel(syncStatus, syncDetail)}</span>
            </p>

            <p className="text-sm text-ink-muted">
              Progress saves on this device and syncs to your Google account so
              you can continue on another phone or computer.
            </p>

            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => void onSignOut()}
            >
              <LogOut className="size-4" aria-hidden="true" />
              Sign out
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-ink-muted">
              Sign in with Google to keep memorized marks, Needs Review, and
              review history in sync across your devices.
            </p>
            <Button
              variant="primary"
              size="sm"
              disabled={busy}
              onClick={() => void onSignIn()}
            >
              <LogIn className="size-4" aria-hidden="true" />
              {busy ? 'Signing in…' : 'Sign in with Google'}
            </Button>
          </>
        )}
      </CardBody>
    </Card>
  );
}

import { useEffect, useState } from 'react';
import { Cloud, CloudOff, LoaderCircle, LogIn, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Field, TextInput } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/hooks/useAuth';
import { notifyProfileChanged } from '@/lib/profileEvents';
import type { SyncStatus } from '@/services/cloudSyncService';
import {
  getUserProfile,
  updateDisplayName,
} from '@/services/social/profileService';

function statusLabel(status: SyncStatus, detail: string | null): string {
  switch (status) {
    case 'syncing':
      return 'Saving your progress to the cloud…';
    case 'synced':
      return 'Up to date — progress is synced to your Google account.';
    case 'offline':
      return 'You’re offline. Changes stay on this device and will sync when you reconnect.';
    case 'error':
      return detail
        ? `Couldn’t sync: ${detail}`
        : 'Couldn’t sync right now. Your progress is still saved on this device.';
    case 'disabled':
      return 'Cloud sync is not configured for this build.';
    default:
      return 'Ready to sync when you make changes.';
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
  const [nameBusy, setNameBusy] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [savedDisplayName, setSavedDisplayName] = useState('');

  useEffect(() => {
    if (!user) {
      setDisplayName('');
      setSavedDisplayName('');
      return;
    }
    let cancelled = false;
    void getUserProfile(user.uid)
      .then((profile) => {
        if (cancelled) return;
        const name =
          profile?.displayName?.trim() ||
          user.displayName?.trim() ||
          '';
        setDisplayName(name);
        setSavedDisplayName(name);
      })
      .catch(() => {
        if (cancelled) return;
        const name = user.displayName?.trim() || '';
        setDisplayName(name);
        setSavedDisplayName(name);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

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

  const onSaveDisplayName = async () => {
    if (!user) return;
    setNameBusy(true);
    try {
      const profile = await updateDisplayName(user, displayName);
      const next = profile.displayName?.trim() || '';
      setDisplayName(next);
      setSavedDisplayName(next);
      notifyProfileChanged();
      notify('Display name updated.', 'success');
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Could not save display name.',
        'error',
      );
    } finally {
      setNameBusy(false);
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

  const nameDirty =
    displayName.trim().replace(/\s+/g, ' ') !== savedDisplayName.trim();
  const shownLabel = savedDisplayName || user?.displayName || 'Signed in';

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
                  {shownLabel.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">{shownLabel}</p>
                {user.email ? (
                  <p className="truncate text-sm text-ink-muted">{user.email}</p>
                ) : null}
              </div>
            </div>

            <Field
              label="Display name"
              htmlFor="display-name"
              hint="Shown in groups and leaderboards."
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <TextInput
                  id="display-name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Your name"
                  disabled={nameBusy || busy}
                  maxLength={40}
                  autoComplete="nickname"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  className="shrink-0"
                  disabled={nameBusy || busy || !nameDirty || !displayName.trim()}
                  onClick={() => void onSaveDisplayName()}
                >
                  {nameBusy ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </Field>

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

            <Button
              variant="secondary"
              size="sm"
              disabled={busy || nameBusy}
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
              review history in sync across your devices. You can also sign in
              from the button in the upper right.
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

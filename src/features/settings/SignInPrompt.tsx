import { useState } from 'react';
import { Cloud, LoaderCircle, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/hooks/useAuth';
import type { SyncStatus } from '@/services/cloudSyncService';

function shortSyncLabel(status: SyncStatus): string {
  switch (status) {
    case 'syncing':
      return 'Saving…';
    case 'synced':
      return 'Synced';
    case 'offline':
      return 'Offline';
    case 'error':
      return 'Sync issue';
    default:
      return 'Signed in';
  }
}

/**
 * Compact account strip for the home (Flash Cards) page: sign-in CTA when
 * logged out, or a quiet signed-in + sync status when logged in.
 */
export function SignInPrompt({ className }: { className?: string }) {
  const {
    configured,
    user,
    loading,
    syncStatus,
    signInWithGoogle,
  } = useAuth();
  const { notify } = useToast();
  const [busy, setBusy] = useState(false);

  if (!configured || loading) return null;

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

  if (user) {
    return (
      <div
        className={`flex flex-wrap items-center gap-2 text-sm text-ink-muted ${className ?? ''}`}
      >
        {syncStatus === 'syncing' ? (
          <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Cloud className="size-3.5" aria-hidden="true" />
        )}
        <span className="truncate">
          {user.displayName ?? user.email ?? 'Signed in'}
          {' · '}
          {shortSyncLabel(syncStatus)}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface-muted/60 px-3 py-2.5 ${className ?? ''}`}
    >
      <p className="text-sm text-ink-muted">
        Sign in to sync your progress across phones and computers.
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
    </div>
  );
}

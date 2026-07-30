import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/hooks/useAuth';

/**
 * Top-right account chrome: Sign in with Google, or “Logged in as …” → More.
 */
export function NavAccountControl() {
  const { configured, user, loading, signInWithGoogle } = useAuth();
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

  if (!user) {
    return (
      <Button
        variant="secondary"
        size="sm"
        disabled={busy}
        onClick={() => void onSignIn()}
        className="shrink-0"
      >
        <LogIn className="size-3.5" aria-hidden="true" />
        {busy ? 'Signing in…' : 'Sign in with Google'}
      </Button>
    );
  }

  const label = user.displayName ?? user.email ?? 'Signed in';

  return (
    <Link
      to="/more"
      className="max-w-[16rem] truncate text-right text-sm text-ink-muted hover:text-ink"
      title={`Logged in as ${label}. Open Account on More.`}
    >
      Logged in as {label}
    </Link>
  );
}

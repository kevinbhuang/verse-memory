import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LogIn, User } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/hooks/useAuth';

/**
 * Top-right account chrome: Sign in with Google, or avatar + “Logged in as …” → More.
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
      className="flex max-w-[16rem] items-center gap-2 text-sm text-ink-muted hover:text-ink"
      title={`Logged in as ${label}. Open Account on More.`}
    >
      <span
        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand"
        aria-hidden="true"
      >
        <User className="size-3.5" strokeWidth={2.25} />
      </span>
      <span className="min-w-0 truncate text-right">Logged in as {label}</span>
    </Link>
  );
}

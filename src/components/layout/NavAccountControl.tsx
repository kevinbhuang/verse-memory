import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/hooks/useAuth';

type NavAccountControlProps = {
  /** Compact for the mobile top bar; fuller for the desktop sidebar. */
  variant?: 'sidebar' | 'header';
};

/**
 * Global account chrome: Sign in, or “Logged in as …” linking to More.
 * Matches the usual site pattern of one consistent control in the shell.
 */
export function NavAccountControl({
  variant = 'sidebar',
}: NavAccountControlProps) {
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
    if (variant === 'header') {
      return (
        <Button
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => void onSignIn()}
          className="shrink-0"
        >
          <LogIn className="size-3.5" aria-hidden="true" />
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
      );
    }

    return (
      <Button
        variant="secondary"
        size="sm"
        disabled={busy}
        onClick={() => void onSignIn()}
        className="w-full justify-start"
      >
        <LogIn className="size-4" aria-hidden="true" />
        {busy ? 'Signing in…' : 'Sign in with Google'}
      </Button>
    );
  }

  const label = user.displayName ?? user.email ?? 'Signed in';

  if (variant === 'header') {
    return (
      <Link
        to="/more"
        className="max-w-[11rem] truncate text-right text-xs text-ink-muted hover:text-ink"
        title={`Logged in as ${label}. Open Account on More.`}
      >
        Logged in as {label}
      </Link>
    );
  }

  return (
    <Link
      to="/more"
      className="block rounded-lg px-3 py-2 text-sm text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
      title="Account and sync status"
    >
      <span className="block text-xs tracking-wide text-ink-subtle uppercase">
        Logged in as
      </span>
      <span className="mt-0.5 block truncate font-medium text-ink">{label}</span>
    </Link>
  );
}

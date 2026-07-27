import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ButtonLink } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/EmptyState';
import { getResumableSession } from '@/services/sessionService';
import { SessionRunner } from '@/features/review/SessionRunner';

export function ReviewSessionPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const sessionId = searchParams.get('id');
  const [checking, setChecking] = useState(sessionId === null);

  // Landing on /review/session without an id (a bookmark, or a reload after
  // the query string was lost) should pick up the open session if there is one.
  useEffect(() => {
    if (sessionId) return;
    let cancelled = false;

    void getResumableSession().then((session) => {
      if (cancelled) return;
      if (session) {
        setSearchParams({ id: session.id }, { replace: true });
      }
      setChecking(false);
    });

    return () => {
      cancelled = true;
    };
  }, [sessionId, setSearchParams]);

  if (sessionId) {
    return <SessionRunner sessionId={sessionId} />;
  }

  if (checking) {
    return <LoadingState label={'Looking for an open session\u2026'} />;
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="font-serif text-xl font-semibold text-ink">
        No active session
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        Build a session to choose which passages to review and how.
      </p>
      <ButtonLink to="/practice" variant="primary" className="mt-4">
        Start practicing
      </ButtonLink>
    </div>
  );
}

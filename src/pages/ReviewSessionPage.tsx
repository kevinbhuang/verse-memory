import { useSearchParams } from 'react-router-dom';
import { ButtonLink } from '@/components/ui/Button';
import { SessionRunner } from '@/features/review/SessionRunner';

export function ReviewSessionPage() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('id');

  if (sessionId) {
    return <SessionRunner sessionId={sessionId} />;
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="font-serif text-xl font-semibold text-ink">
        No active session
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        Build a session to choose which passages to practice and how.
      </p>
      <ButtonLink to="/quiz" variant="primary" className="mt-4">
        Start a quiz
      </ButtonLink>
    </div>
  );
}

import { ButtonLink } from '@/components/ui/Button';

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-lg py-20 text-center">
      <h1 className="font-serif text-2xl font-semibold text-ink">
        Page not found
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        That address does not match anything in the app.
      </p>
      <div className="mt-5 flex justify-center gap-2">
        <ButtonLink to="/flashcards" variant="primary">
          Library
        </ButtonLink>
        <ButtonLink to="/practice" variant="secondary">
          Practice
        </ButtonLink>
      </div>
    </div>
  );
}

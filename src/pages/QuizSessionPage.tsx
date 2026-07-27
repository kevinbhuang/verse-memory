import { useSearchParams } from 'react-router-dom';
import { ButtonLink } from '@/components/ui/Button';
import { QuizRunner } from '@/features/quiz/QuizRunner';

export function QuizSessionPage() {
  const [params] = useSearchParams();
  const id = params.get('id');

  if (!id) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-sm text-ink-muted">Missing quiz id.</p>
        <ButtonLink to="/quiz" variant="primary" className="mt-4">
          Back to Quiz
        </ButtonLink>
      </div>
    );
  }

  return <QuizRunner quizId={id} />;
}

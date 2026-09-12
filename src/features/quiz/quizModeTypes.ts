import type { Verse } from '@/types';
import type { QuizReferenceGrade } from '@/types/quiz';

export type QuizModeResult = {
  correct: boolean;
  accuracy: number;
  elapsedMs: number;
};

export type QuizModeProps = {
  verse: Verse;
  attemptKey: string;
  onComplete: (result: QuizModeResult) => void;
  /** Clear the scored result and let the reader attempt this question again. */
  onRetry?: () => void;
  /** Reference quizzes only. Defaults to chapter and verse. */
  referenceGrade?: QuizReferenceGrade;
  onReferenceGradeChange?: (grade: QuizReferenceGrade) => void;
};

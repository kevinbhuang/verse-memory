import type { Verse } from '@/types';

export type QuizModeResult = {
  correct: boolean;
  accuracy: number;
  elapsedMs: number;
};

export type QuizModeProps = {
  verse: Verse;
  attemptKey: string;
  onComplete: (result: QuizModeResult) => void;
};

import { createDefaultProgress, DEFAULT_SETTINGS } from '@/db/defaults';
import { FirstLetterMode } from '@/features/review/modes/FirstLetterMode';
import type { ModeResult } from '@/types';
import type { QuizModeProps } from '../quizModeTypes';

/**
 * Reuses the review first-letter exercise inside a scored quiz.
 */
export function QuizFirstLetterMode({
  verse,
  attemptKey,
  onComplete,
}: QuizModeProps) {
  const handleComplete = (result: ModeResult) => {
    const accuracy = result.accuracy ?? 0;
    onComplete({
      correct: accuracy >= 0.9 && !result.fullRevealUsed,
      accuracy,
      elapsedMs: result.elapsedMs,
    });
  };

  return (
    <FirstLetterMode
      verse={verse}
      progress={createDefaultProgress(verse.id)}
      settings={DEFAULT_SETTINGS}
      wordStats={[]}
      onComplete={handleComplete}
      attemptKey={attemptKey}
    />
  );
}

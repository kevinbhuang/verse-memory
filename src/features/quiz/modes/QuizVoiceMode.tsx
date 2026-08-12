import { createDefaultProgress, DEFAULT_SETTINGS } from '@/db/defaults';
import { VoiceMode } from '@/features/review/modes/VoiceMode';
import type { ModeResult } from '@/types';
import type { QuizModeProps } from '../quizModeTypes';

/**
 * Reuses the review spoken-recitation exercise inside a scored quiz.
 */
export function QuizVoiceMode({
  verse,
  attemptKey,
  onComplete,
}: QuizModeProps) {
  const handleComplete = (result: ModeResult) => {
    const accuracy = result.accuracy;
    // Unsupported browsers self-rate with null accuracy — count as complete.
    if (accuracy === null) {
      onComplete({
        correct: true,
        accuracy: 1,
        elapsedMs: result.elapsedMs,
      });
      return;
    }
    onComplete({
      correct: accuracy >= 0.9,
      accuracy,
      elapsedMs: result.elapsedMs,
    });
  };

  return (
    <VoiceMode
      verse={verse}
      progress={createDefaultProgress(verse.id)}
      settings={DEFAULT_SETTINGS}
      wordStats={[]}
      onComplete={handleComplete}
      attemptKey={attemptKey}
    />
  );
}

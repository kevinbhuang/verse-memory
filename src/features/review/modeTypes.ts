import type {
  ModeResult,
  Rating,
  Settings,
  Verse,
  VerseProgress,
  WordStat,
} from '@/types';

export type ReviewModeProps = {
  verse: Verse;
  progress: VerseProgress;
  settings: Settings;
  wordStats: WordStat[];
  /** Called once the reader has finished the exercise. */
  onComplete: (result: ModeResult) => void;
  /** Remounts the exercise when the reader repeats the same passage. */
  attemptKey: string;
  /** Clears the parent session result when the reader retries this card. */
  onRetry?: () => void;
  /**
   * Optional override for the “Show next letter” toggle. When set, the mode
   * does not write the preference into global Settings.
   */
  onShowFirstLetterSkeletonChange?: (checked: boolean) => void;
};

/** Maps measured performance to the rating the mode recommends. */
export function suggestRating(
  accuracy: number,
  options: { hints?: number; fullReveal?: boolean } = {},
): Rating {
  if (options.fullReveal) return 'again';
  if (accuracy >= 0.99 && (options.hints ?? 0) === 0) return 'easy';
  if (accuracy >= 0.92) return 'good';
  if (accuracy >= 0.75) return 'hard';
  return 'again';
}

export function emptyResult(mode: ModeResult['mode']): ModeResult {
  return {
    mode,
    accuracy: null,
    elapsedMs: 0,
    incorrectCount: 0,
    hintCount: 0,
    fullRevealUsed: false,
    wordErrors: [],
    suggestedRating: 'good',
  };
}

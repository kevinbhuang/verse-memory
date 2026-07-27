import type { Settings, VerseProgress } from '@/types';

export function createDefaultProgress(
  verseId: string,
  now: Date = new Date(),
): VerseProgress {
  const timestamp = now.toISOString();
  return {
    verseId,
    status: 'new',
    isMemorized: false,
    memorizedAt: null,
    isDifficult: false,
    difficultyScore: 0,
    difficultyReasons: [],
    problemCategories: [],
    note: '',
    lastReviewedAt: null,
    nextDueAt: null,
    intervalDays: 0,
    intervalStep: -1,
    reviewCount: 0,
    successCount: 0,
    lapseCount: 0,
    consecutiveSuccesses: 0,
    lastRating: null,
    customMaximumIntervalDays: null,
    pinnedFrequencyDays: null,
    isPinned: false,
    totalElapsedMs: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  defaultReviewMode: 'first-letter',
  gradingMode: 'forgiving',
  requirePunctuation: false,
  requireCapitalization: false,
  allowBackspaceInFirstLetter: true,
  showFirstLetterSkeleton: true,
  blindFirstLetterMode: false,
  announceReference: true,
  defaultSessionSize: 10,
  dailyNewVerseLimit: 3,
  maximumIntervalDays: 365,
  difficultVerseIntervalDays: 7,
  theme: 'system',
  reducedMotion: false,
  confirmBeforeFullReveal: true,
  showVerificationStatus: true,
  showSectionLabels: true,
  includeReferenceInGrading: false,
  updatedAt: new Date(0).toISOString(),
};

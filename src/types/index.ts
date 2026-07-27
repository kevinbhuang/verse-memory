export const SECTIONS = [
  'Law and History',
  'Wisdom and Poetry',
  'Prophets',
  'Gospels',
  'Acts',
  'Paul\u2019s Epistles',
  'General Epistles and Revelation',
] as const;

export type Section = (typeof SECTIONS)[number];

export type Verse = {
  id: string;
  order: number;
  reference: string;
  text: string;
  translation: 'ESV';
  section: Section;
  verified: boolean;
  verificationDate: string | null;
  contentHash: string;
};

export const VERSE_STATUSES = [
  'new',
  'learning',
  'memorized',
  'needs-attention',
] as const;

export type VerseStatus = (typeof VERSE_STATUSES)[number];

export const RATINGS = ['again', 'hard', 'good', 'easy'] as const;
export type Rating = (typeof RATINGS)[number];

export const REVIEW_MODES = [
  'flashcard',
  'first-letter',
  'progressive-hide',
  'full-typing',
  'reference',
  'voice',
] as const;

export type ReviewMode = (typeof REVIEW_MODES)[number];

export const PROBLEM_CATEGORIES = [
  'exact-wording',
  'verse-order',
  'reference',
  'similar-to-another-verse',
  'long-passage',
  'punctuation',
  'frequently-forgotten-phrase',
  'other',
] as const;

export type ProblemCategory = (typeof PROBLEM_CATEGORIES)[number];

export type VerseProgress = {
  verseId: string;
  status: VerseStatus;
  isMemorized: boolean;
  memorizedAt: string | null;
  isDifficult: boolean;
  difficultyScore: number;
  difficultyReasons: string[];
  problemCategories: ProblemCategory[];
  note: string;
  lastReviewedAt: string | null;
  nextDueAt: string | null;
  intervalDays: number;
  intervalStep: number;
  reviewCount: number;
  successCount: number;
  lapseCount: number;
  consecutiveSuccesses: number;
  lastRating: Rating | null;
  customMaximumIntervalDays: number | null;
  pinnedFrequencyDays: number | null;
  isPinned: boolean;
  totalElapsedMs: number;
  createdAt: string;
  updatedAt: string;
};

export type WordErrorType = 'incorrect' | 'missing' | 'extra' | 'hint';

export type WordError = {
  wordIndex: number;
  expected: string;
  received: string | null;
  errorType: WordErrorType;
};

export type ReviewLog = {
  id: string;
  verseId: string;
  reviewedAt: string;
  mode: ReviewMode;
  rating: Rating;
  accuracy: number | null;
  elapsedMs: number;
  incorrectCount: number;
  hintCount: number;
  fullRevealUsed: boolean;
  previousIntervalDays: number;
  nextIntervalDays: number;
  nextDueAt: string;
  wordErrors: WordError[];
  sessionId: string | null;
};

export type ModeStrategy = 'fixed' | 'mixed' | 'automatic' | 'choose-each';

export type ReviewSession = {
  id: string;
  createdAt: string;
  completedAt: string | null;
  label: string;
  verseIds: string[];
  currentIndex: number;
  modeStrategy: ModeStrategy;
  fixedMode: ReviewMode | null;
  /** Review log ids produced by this session, in completion order. */
  results: string[];
};

/** Per-word accuracy statistics, keyed by `${verseId}:${wordIndex}`. */
export type WordStat = {
  key: string;
  verseId: string;
  wordIndex: number;
  word: string;
  attempts: number;
  misses: number;
  hints: number;
  substitutions: number;
  lastMissAt: string | null;
};

export type ThemePreference = 'system' | 'light' | 'dark';
export type GradingMode = 'forgiving' | 'exact';

export type Settings = {
  id: 'settings';
  defaultReviewMode: ReviewMode;
  gradingMode: GradingMode;
  requirePunctuation: boolean;
  requireCapitalization: boolean;
  allowBackspaceInFirstLetter: boolean;
  showFirstLetterSkeleton: boolean;
  /** Hide the first letters entirely so every character must be supplied. */
  blindFirstLetterMode: boolean;
  announceReference: boolean;
  defaultSessionSize: number;
  dailyNewVerseLimit: number;
  maximumIntervalDays: number;
  difficultVerseIntervalDays: number;
  theme: ThemePreference;
  reducedMotion: boolean;
  confirmBeforeFullReveal: boolean;
  showVerificationStatus: boolean;
  showSectionLabels: boolean;
  includeReferenceInGrading: boolean;
  updatedAt: string;
};

/** A single review outcome handed back by a practice mode. */
export type ModeResult = {
  mode: ReviewMode;
  accuracy: number | null;
  elapsedMs: number;
  incorrectCount: number;
  hintCount: number;
  fullRevealUsed: boolean;
  wordErrors: WordError[];
  /** Rating the mode recommends based on measured performance. */
  suggestedRating: Rating;
};

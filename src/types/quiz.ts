export const QUIZ_MODES = [
  'reference',
  'first-words',
  'first-letter',
  'fill-blank',
] as const;

export type QuizMode = (typeof QUIZ_MODES)[number];

export const QUIZ_MODE_LABELS: Record<QuizMode, string> = {
  reference: 'Reference',
  'first-words': 'First three words',
  'first-letter': 'First letters',
  'fill-blank': 'Fill in the blank',
};

export const QUIZ_MODE_DESCRIPTIONS: Record<QuizMode, string> = {
  reference: 'Read the passage, then type the book and chapter.',
  'first-words': 'See the reference, then type the first three words.',
  'first-letter': 'Type the first letter of each word to reveal the passage.',
  'fill-blank': 'Fill in the missing words in the passage.',
};

export type QuizAnswer = {
  verseId: string;
  correct: boolean;
  accuracy: number;
  elapsedMs: number;
};

export type QuizSession = {
  id: string;
  createdAt: string;
  completedAt: string | null;
  label: string;
  mode: QuizMode;
  verseIds: string[];
  currentIndex: number;
  answers: QuizAnswer[];
};

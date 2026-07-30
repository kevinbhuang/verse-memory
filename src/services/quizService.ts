import { createId } from '@/lib/id';
import { verses } from '@/data/verses';
import { bookFromReference } from '@/lib/text/books';
import type { Section, VerseProgress } from '@/types';
import type { QuizAnswer, QuizMode, QuizSession } from '@/types/quiz';

const STORAGE_PREFIX = 'verse-memory:quiz:';

export type QuizScope = 'all' | 'deck' | 'book';

export type QuizProgressFilter = 'all' | 'memorized' | 'needs-review';

export type QuizCriteria = {
  scope: QuizScope;
  /** One or more deck sections when scope is deck. */
  sections: Section[];
  /** One or more book names when scope is book. */
  books: string[];
  size: number | 'all';
  mode: QuizMode;
  /** Limit to memorized or Needs Review passages (on top of scope). */
  progressFilter?: QuizProgressFilter;
  shuffle?: boolean;
};

function shuffleInPlace<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = items[i]!;
    items[i] = items[j]!;
    items[j] = tmp;
  }
  return items;
}

function progressMap(
  progressList: VerseProgress[] | Map<string, VerseProgress> | undefined,
): Map<string, VerseProgress> {
  if (!progressList) return new Map();
  if (progressList instanceof Map) return progressList;
  return new Map(progressList.map((record) => [record.verseId, record]));
}

/** Resolve passage ids for a quiz from the full collection, deck(s), or book(s). */
export function selectQuizVerseIds(
  criteria: QuizCriteria,
  progressList?: VerseProgress[] | Map<string, VerseProgress>,
): string[] {
  const byId = progressMap(progressList);
  const progressFilter = criteria.progressFilter ?? 'all';

  const matching = verses.filter((verse) => {
    if (criteria.scope === 'deck') {
      if (!criteria.sections.includes(verse.section)) return false;
    } else if (criteria.scope === 'book') {
      const book = bookFromReference(verse.reference);
      if (!book || !criteria.books.includes(book)) return false;
    }

    if (progressFilter === 'memorized') {
      return byId.get(verse.id)?.isMemorized === true;
    }
    if (progressFilter === 'needs-review') {
      return byId.get(verse.id)?.isDifficult === true;
    }
    return true;
  });

  const ids = matching.map((verse) => verse.id);
  if (criteria.shuffle !== false) shuffleInPlace(ids);

  if (criteria.size === 'all') return ids;
  return ids.slice(0, Math.max(0, criteria.size));
}

export function createQuizSession(
  criteria: QuizCriteria,
  label: string,
  progressList?: VerseProgress[] | Map<string, VerseProgress>,
  now: Date = new Date(),
): QuizSession | null {
  const verseIds = selectQuizVerseIds(criteria, progressList);
  if (verseIds.length === 0) return null;

  const session: QuizSession = {
    id: createId('quiz'),
    createdAt: now.toISOString(),
    completedAt: null,
    label,
    mode: criteria.mode,
    verseIds,
    currentIndex: 0,
    answers: [],
  };
  saveQuizSession(session);
  return session;
}

export function saveQuizSession(session: QuizSession): void {
  localStorage.setItem(`${STORAGE_PREFIX}${session.id}`, JSON.stringify(session));
}

export function discardQuizSession(id: string): void {
  localStorage.removeItem(`${STORAGE_PREFIX}${id}`);
}

export function getQuizSession(id: string): QuizSession | null {
  const raw = localStorage.getItem(`${STORAGE_PREFIX}${id}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as QuizSession;
  } catch {
    return null;
  }
}

export function recordQuizAnswer(
  session: QuizSession,
  answer: QuizAnswer,
  now: Date = new Date(),
): QuizSession {
  const nextIndex = session.currentIndex + 1;
  const next: QuizSession = {
    ...session,
    currentIndex: nextIndex,
    answers: [...session.answers, answer],
    completedAt:
      nextIndex >= session.verseIds.length ? now.toISOString() : null,
  };
  saveQuizSession(next);
  return next;
}

export function quizScore(session: QuizSession): {
  correct: number;
  total: number;
  accuracy: number;
} {
  const total = session.answers.length;
  const correct = session.answers.filter((answer) => answer.correct).length;
  return {
    correct,
    total,
    accuracy: total === 0 ? 0 : correct / total,
  };
}

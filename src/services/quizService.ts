import { createId } from '@/lib/id';
import { verses } from '@/data/verses';
import { bookFromReference } from '@/lib/text/books';
import type { Section } from '@/types';
import type { QuizAnswer, QuizMode, QuizSession } from '@/types/quiz';

const STORAGE_PREFIX = 'verse-memory:quiz:';

export type QuizScope = 'deck' | 'book';

export type QuizCriteria = {
  scope: QuizScope;
  /** One or more deck sections when scope is deck. */
  sections: Section[];
  /** One or more book names when scope is book. */
  books: string[];
  size: number | 'all';
  mode: QuizMode;
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

/** Resolve passage ids for a quiz from deck(s) or book(s). */
export function selectQuizVerseIds(criteria: QuizCriteria): string[] {
  let matching = verses.filter((verse) => {
    if (criteria.scope === 'deck') {
      return criteria.sections.includes(verse.section);
    }
    const book = bookFromReference(verse.reference);
    return Boolean(book && criteria.books.includes(book));
  });

  const ids = matching.map((verse) => verse.id);
  if (criteria.shuffle !== false) shuffleInPlace(ids);

  if (criteria.size === 'all') return ids;
  return ids.slice(0, Math.max(0, criteria.size));
}

export function createQuizSession(
  criteria: QuizCriteria,
  label: string,
  now: Date = new Date(),
): QuizSession | null {
  const verseIds = selectQuizVerseIds(criteria);
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

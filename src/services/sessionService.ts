import { differenceInCalendarDays } from 'date-fns';
import { getDataStore } from '@/repositories';
import { verses } from '@/data/verses';
import { createId } from '@/lib/id';
import { bookFromReference } from '@/lib/text/books';
import { daysOverdue, dueState, isDue } from '@/lib/scheduler';
import type {
  ModeStrategy,
  ReviewMode,
  ReviewSession,
  Section,
  VerseProgress,
} from '@/types';
import { getAllProgress, withDefaults } from './progressService';

const store = () => getDataStore();

export const SESSION_SOURCES = [
  'due',
  'overdue',
  'difficult',
  'needs-attention',
  'weak',
  'section',
  'book',
  'memorized',
  'learning',
  'new',
  'recently-failed',
  'with-notes',
  'not-reviewed-in',
  'range',
  'random',
  'custom',
] as const;

export type SessionSource = (typeof SESSION_SOURCES)[number];

export type SessionCriteria = {
  source: SessionSource;
  section?: Section | null;
  /** One or more deck sections. Prefer this over `section` for multi-select. */
  sections?: Section[] | null;
  /** Canonical book name, e.g. "Romans" or "John". Prefer `books` for multi-select. */
  book?: string | null;
  /** One or more canonical book names. */
  books?: string[] | null;
  verseIds?: string[];
  range?: { start: number; end: number };
  notReviewedInDays?: number;
  /** `'all'` keeps every matching passage. */
  size: number | 'all';
  modeStrategy: ModeStrategy;
  fixedMode: ReviewMode | null;
  shuffle?: boolean;
};

export const SOURCE_LABELS: Record<SessionSource, string> = {
  due: 'Due today',
  overdue: 'Overdue',
  difficult: 'Needs Review',
  'needs-attention': 'Needs Review',
  weak: 'Weak passages',
  section: 'A section',
  book: 'A book',
  memorized: 'Memorized passages',
  learning: 'Learning passages',
  new: 'New passages',
  'recently-failed': 'Recently failed',
  'with-notes': 'Passages with notes',
  'not-reviewed-in': 'Not reviewed recently',
  range: 'Passage number range',
  random: 'Random selection',
  custom: 'Custom selection',
};

/**
 * Turns session criteria into an ordered list of passage ids.
 *
 * Canonical order is preserved for every source except the ones whose whole
 * purpose is a different order (weak, random), because a review queue is a
 * temporary subset, not a re-ordering of the collection.
 */
export function selectVerseIds(
  criteria: SessionCriteria,
  progressList: VerseProgress[],
  now: Date = new Date(),
): string[] {
  const byId = new Map(progressList.map((record) => [record.verseId, record]));
  const progressFor = (verseId: string) => byId.get(verseId);

  let matching = verses.filter((verse) => {
    const progress = progressFor(verse.id);
    if (!progress) return false;

    // Optional scope filters (deck / book) apply on top of any source.
    if (criteria.sections && criteria.sections.length > 0) {
      if (!criteria.sections.includes(verse.section)) return false;
    } else if (criteria.section && verse.section !== criteria.section) {
      return false;
    }
    const bookName = bookFromReference(verse.reference);
    if (criteria.books && criteria.books.length > 0) {
      if (!bookName || !criteria.books.includes(bookName)) return false;
    } else if (criteria.book && bookName !== criteria.book) {
      return false;
    }

    switch (criteria.source) {
      case 'due':
        return isDue(progress, now);
      case 'overdue':
        return dueState(progress, now) === 'overdue';
      case 'difficult':
        return progress.isDifficult;
      case 'needs-attention':
        return progress.status === 'needs-attention';
      case 'weak':
        return (
          progress.isDifficult ||
          progress.status === 'needs-attention' ||
          progress.lastRating === 'again' ||
          progress.difficultyScore >= 30
        );
      case 'section':
        return true;
      case 'book':
        return true;
      case 'memorized':
        return progress.isMemorized;
      case 'learning':
        return progress.status === 'learning';
      case 'new':
        return progress.reviewCount === 0;
      case 'recently-failed':
        return (
          progress.lastRating === 'again' &&
          progress.lastReviewedAt !== null &&
          differenceInCalendarDays(now, new Date(progress.lastReviewedAt)) <= 14
        );
      case 'with-notes':
        return progress.note.trim().length > 0;
      case 'not-reviewed-in': {
        const days = criteria.notReviewedInDays ?? 30;
        if (!progress.lastReviewedAt) return true;
        return (
          differenceInCalendarDays(now, new Date(progress.lastReviewedAt)) >=
          days
        );
      }
      case 'range': {
        const range = criteria.range;
        if (!range) return false;
        return verse.order >= range.start && verse.order <= range.end;
      }
      case 'random':
        return true;
      case 'custom':
        return (criteria.verseIds ?? []).includes(verse.id);
    }
  });

  if (criteria.source === 'weak') {
    matching = [...matching].sort((a, b) => {
      const left = progressFor(a.id);
      const right = progressFor(b.id);
      return weakPriority(right, now) - weakPriority(left, now);
    });
  } else if (criteria.source === 'random' || criteria.shuffle) {
    matching = shuffle(matching, now.getTime());
  } else if (criteria.source === 'overdue' || criteria.source === 'due') {
    matching = [...matching].sort(
      (a, b) =>
        daysOverdue(progressFor(b.id)!, now) -
        daysOverdue(progressFor(a.id)!, now),
    );
  }

  const ids = matching.map((verse) => verse.id);
  if (criteria.size === 'all') return ids;
  return ids.slice(0, Math.max(1, criteria.size));
}

/**
 * Weak-verse priority, highest first:
 * overdue difficult, recently failed, repeated word errors, manually flagged,
 * low recent accuracy.
 */
function weakPriority(
  progress: VerseProgress | undefined,
  now: Date,
): number {
  if (!progress) return 0;
  let score = 0;
  const overdue = daysOverdue(progress, now);

  if (progress.isDifficult && overdue > 0) score += 1000 + overdue;
  if (progress.lastRating === 'again') score += 500;
  if (progress.status === 'needs-attention') score += 250;
  if (progress.isDifficult) score += 200;
  score += progress.difficultyScore;
  score += Math.min(overdue, 60);

  return score;
}

function shuffle<T>(items: T[], seed: number): T[] {
  const result = [...items];
  let state = seed % 2_147_483_647;
  if (state <= 0) state += 2_147_483_646;
  for (let i = result.length - 1; i > 0; i -= 1) {
    state = (state * 16_807) % 2_147_483_647;
    const j = state % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const MIXED_ROTATION: ReviewMode[] = [
  'flashcard',
  'first-letter',
  'progressive-hide',
  'full-typing',
  'reference',
];

/**
 * Automatic mode selection follows the passage's learning stage: recognition
 * first, then production, then full recall.
 */
export function automaticModeFor(progress: VerseProgress): ReviewMode {
  if (progress.reviewCount === 0 && !progress.isMemorized) {
    return 'progressive-hide';
  }
  if (progress.isDifficult || progress.status === 'needs-attention') {
    return 'first-letter';
  }
  if (!progress.isMemorized) return 'first-letter';
  if (progress.intervalDays >= 60) {
    return progress.consecutiveSuccesses % 2 === 0 ? 'full-typing' : 'flashcard';
  }
  return 'flashcard';
}

export function modeForIndex(
  session: Pick<ReviewSession, 'modeStrategy' | 'fixedMode'>,
  progress: VerseProgress,
  index: number,
  fallback: ReviewMode,
): ReviewMode {
  switch (session.modeStrategy) {
    case 'fixed':
      return session.fixedMode ?? fallback;
    case 'mixed':
      return MIXED_ROTATION[index % MIXED_ROTATION.length];
    case 'automatic':
      return automaticModeFor(progress);
    case 'choose-each':
      return session.fixedMode ?? fallback;
  }
}

export async function createSession(
  criteria: SessionCriteria,
  label: string,
  now: Date = new Date(),
): Promise<ReviewSession | null> {
  const progressList = withDefaults(await getAllProgress());
  const verseIds = selectVerseIds(criteria, progressList, now);
  if (verseIds.length === 0) return null;

  // Drop any unfinished session — practice is not meant to be paused/resumed.
  const open = await store().sessions.latestOpen();
  if (open) await store().sessions.remove(open.id);

  const session: ReviewSession = {
    id: createId('session'),
    createdAt: now.toISOString(),
    completedAt: null,
    label,
    verseIds,
    currentIndex: 0,
    modeStrategy: criteria.modeStrategy,
    fixedMode: criteria.fixedMode,
    results: [],
  };

  await store().sessions.put(session);
  await store().meta.set('lastSessionId', session.id);
  return session;
}

export async function getSession(id: string): Promise<ReviewSession | undefined> {
  return store().sessions.get(id);
}

export async function getResumableSession(): Promise<ReviewSession | undefined> {
  return store().sessions.latestOpen();
}

/**
 * Records a completed card. A passage rated Again is queued once more near the
 * end of the session so the reader sees it again before finishing.
 */
export async function advanceSession(
  session: ReviewSession,
  logId: string,
  options: { requeue: boolean },
  now: Date = new Date(),
): Promise<ReviewSession> {
  const verseIds = [...session.verseIds];
  const currentVerseId = verseIds[session.currentIndex];

  if (options.requeue && currentVerseId) {
    const alreadyQueuedLater = verseIds
      .slice(session.currentIndex + 1)
      .includes(currentVerseId);
    if (!alreadyQueuedLater) {
      verseIds.push(currentVerseId);
    }
  }

  const currentIndex = session.currentIndex + 1;
  const next: ReviewSession = {
    ...session,
    verseIds,
    currentIndex,
    results: [...session.results, logId],
    completedAt:
      currentIndex >= verseIds.length ? now.toISOString() : session.completedAt,
  };

  await store().sessions.put(next);
  return next;
}

export async function skipCard(
  session: ReviewSession,
  now: Date = new Date(),
): Promise<ReviewSession> {
  const currentIndex = session.currentIndex + 1;
  const next: ReviewSession = {
    ...session,
    currentIndex,
    completedAt:
      currentIndex >= session.verseIds.length
        ? now.toISOString()
        : session.completedAt,
  };
  await store().sessions.put(next);
  return next;
}

/**
 * Jump to another passage in the session without recording a review.
 * Used while browsing during Learn sessions.
 */
export async function setSessionIndex(
  session: ReviewSession,
  index: number,
): Promise<ReviewSession> {
  if (session.verseIds.length === 0) return session;
  const currentIndex = Math.max(
    0,
    Math.min(index, session.verseIds.length - 1),
  );
  if (currentIndex === session.currentIndex) return session;

  const next: ReviewSession = {
    ...session,
    currentIndex,
    completedAt: null,
  };
  await store().sessions.put(next);
  return next;
}

export async function completeSession(
  session: ReviewSession,
  now: Date = new Date(),
): Promise<ReviewSession> {
  const next: ReviewSession = { ...session, completedAt: now.toISOString() };
  await store().sessions.put(next);
  return next;
}

export async function abandonSession(sessionId: string): Promise<void> {
  await store().sessions.remove(sessionId);
}

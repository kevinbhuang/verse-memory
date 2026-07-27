import { describe, expect, it } from 'vitest';
import { addDays, subDays } from 'date-fns';
import { getDataStore } from '@/repositories';
import { createDefaultProgress } from '@/db/defaults';
import { getVerseByOrder, verses } from '@/data/verses';
import type { ReviewSession, VerseProgress } from '@/types';
import {
  abandonSession,
  advanceSession,
  automaticModeFor,
  createSession,
  getResumableSession,
  modeForIndex,
  selectVerseIds,
  setSessionIndex,
  skipCard,
  type SessionCriteria,
} from './sessionService';

const NOW = new Date('2026-05-04T10:00:00.000Z');

function progressFor(
  order: number,
  overrides: Partial<VerseProgress> = {},
): VerseProgress {
  const verse = getVerseByOrder(order)!;
  return { ...createDefaultProgress(verse.id, NOW), ...overrides };
}

/** A complete progress list with a few passages given interesting histories. */
function buildProgressList(
  overrides: Record<number, Partial<VerseProgress>> = {},
): VerseProgress[] {
  return verses.map((verse) =>
    progressFor(verse.order, overrides[verse.order] ?? {}),
  );
}

const criteria = (overrides: Partial<SessionCriteria>): SessionCriteria => ({
  source: 'due',
  size: 'all',
  modeStrategy: 'fixed',
  fixedMode: 'flashcard',
  ...overrides,
});

describe('selectVerseIds', () => {
  it('finds passages that are due today or already overdue', () => {
    const list = buildProgressList({
      2: { nextDueAt: NOW.toISOString() },
      5: { nextDueAt: subDays(NOW, 9).toISOString() },
      9: { nextDueAt: addDays(NOW, 4).toISOString() },
    });

    const due = selectVerseIds(criteria({ source: 'due' }), list, NOW);
    expect(due).toEqual(['verse-005', 'verse-002']);
  });

  it('puts the most overdue passage first', () => {
    const list = buildProgressList({
      3: { nextDueAt: subDays(NOW, 2).toISOString() },
      7: { nextDueAt: subDays(NOW, 30).toISOString() },
      11: { nextDueAt: subDays(NOW, 10).toISOString() },
    });

    expect(selectVerseIds(criteria({ source: 'overdue' }), list, NOW)).toEqual([
      'verse-007',
      'verse-011',
      'verse-003',
    ]);
  });

  it('keeps canonical order for ordinary sources', () => {
    const list = buildProgressList({
      40: { isDifficult: true },
      2: { isDifficult: true },
      120: { isDifficult: true },
    });

    expect(
      selectVerseIds(criteria({ source: 'difficult' }), list, NOW),
    ).toEqual(['verse-002', 'verse-040', 'verse-120']);
  });

  it('ranks weak passages by how much they need attention', () => {
    const list = buildProgressList({
      10: { isDifficult: true, nextDueAt: subDays(NOW, 12).toISOString() },
      20: { lastRating: 'again', difficultyScore: 40 },
      30: { status: 'needs-attention', difficultyScore: 35 },
      40: { isDifficult: true },
    });

    expect(selectVerseIds(criteria({ source: 'weak' }), list, NOW)).toEqual([
      'verse-010',
      'verse-020',
      'verse-030',
      'verse-040',
    ]);
  });

  it('selects a whole section', () => {
    const ids = selectVerseIds(
      criteria({ source: 'section', section: 'Acts' }),
      buildProgressList(),
      NOW,
    );
    expect(ids).toEqual(['verse-069', 'verse-070', 'verse-071', 'verse-072']);
  });

  it('selects an inclusive passage-number range', () => {
    const ids = selectVerseIds(
      criteria({ source: 'range', range: { start: 8, end: 12 } }),
      buildProgressList(),
      NOW,
    );
    expect(ids).toEqual([
      'verse-008',
      'verse-009',
      'verse-010',
      'verse-011',
      'verse-012',
    ]);
  });

  it('treats every untouched passage as new', () => {
    const list = buildProgressList({ 1: { reviewCount: 4 } });
    const ids = selectVerseIds(criteria({ source: 'new' }), list, NOW);
    expect(ids).toHaveLength(verses.length - 1);
    expect(ids).not.toContain('verse-001');
  });

  it('finds passages carrying a note', () => {
    const list = buildProgressList({
      6: { note: 'Compare with Romans 8.' },
      7: { note: '   ' },
    });
    expect(
      selectVerseIds(criteria({ source: 'with-notes' }), list, NOW),
    ).toEqual(['verse-006']);
  });

  it('finds passages that have gone untouched for too long', () => {
    const list = buildProgressList({
      1: { lastReviewedAt: subDays(NOW, 40).toISOString() },
      2: { lastReviewedAt: subDays(NOW, 3).toISOString() },
    });

    const ids = selectVerseIds(
      criteria({ source: 'not-reviewed-in', notReviewedInDays: 30 }),
      list,
      NOW,
    );
    expect(ids).toContain('verse-001');
    expect(ids).not.toContain('verse-002');
  });

  it('limits a session to the requested size', () => {
    const ids = selectVerseIds(
      criteria({ source: 'new', size: 5 }),
      buildProgressList(),
      NOW,
    );
    expect(ids).toHaveLength(5);
  });

  it('honours an explicit custom selection', () => {
    const chosen = ['verse-100', 'verse-004', 'verse-055'];
    const ids = selectVerseIds(
      criteria({ source: 'custom', verseIds: chosen }),
      buildProgressList(),
      NOW,
    );
    expect(ids).toEqual(['verse-004', 'verse-055', 'verse-100']);
  });

  it('returns nothing when no passage matches', () => {
    expect(
      selectVerseIds(criteria({ source: 'due' }), buildProgressList(), NOW),
    ).toEqual([]);
  });
});

describe('automaticModeFor', () => {
  it('starts a brand new passage with progressive hiding', () => {
    expect(automaticModeFor(progressFor(1))).toBe('progressive-hide');
  });

  it('drills a learning passage with first-letter typing', () => {
    expect(
      automaticModeFor(progressFor(1, { reviewCount: 2, status: 'learning' })),
    ).toBe('first-letter');
  });

  it('drills a difficult passage with first-letter typing', () => {
    expect(
      automaticModeFor(
        progressFor(1, { reviewCount: 9, isMemorized: true, isDifficult: true }),
      ),
    ).toBe('first-letter');
  });

  it('uses recognition for a settled memorized passage', () => {
    expect(
      automaticModeFor(
        progressFor(1, {
          reviewCount: 5,
          isMemorized: true,
          status: 'memorized',
          intervalDays: 14,
        }),
      ),
    ).toBe('flashcard');
  });

  it('asks for full recall once a passage is mature', () => {
    expect(
      automaticModeFor(
        progressFor(1, {
          reviewCount: 20,
          isMemorized: true,
          status: 'memorized',
          intervalDays: 120,
          consecutiveSuccesses: 4,
        }),
      ),
    ).toBe('full-typing');
  });
});

describe('modeForIndex', () => {
  const progress = progressFor(1);

  it('uses the chosen mode for a fixed session', () => {
    expect(
      modeForIndex(
        { modeStrategy: 'fixed', fixedMode: 'reference' },
        progress,
        3,
        'flashcard',
      ),
    ).toBe('reference');
  });

  it('rotates through modes in a mixed session', () => {
    const modes = [0, 1, 2, 3, 4, 5].map((index) =>
      modeForIndex(
        { modeStrategy: 'mixed', fixedMode: null },
        progress,
        index,
        'flashcard',
      ),
    );
    expect(new Set(modes).size).toBeGreaterThan(1);
    expect(modes[5]).toBe(modes[0]);
  });
});

describe('session persistence', () => {
  it('stores a session that can be resumed after the browser closes', async () => {
    const session = await createSession(
      criteria({ source: 'range', range: { start: 1, end: 3 } }),
      'Passages 1 to 3',
      NOW,
    );
    expect(session).not.toBeNull();

    const resumable = await getResumableSession();
    expect(resumable?.id).toBe(session!.id);
    expect(resumable?.verseIds).toEqual([
      'verse-001',
      'verse-002',
      'verse-003',
    ]);
  });

  it('returns null rather than creating an empty session', async () => {
    const session = await createSession(
      criteria({ source: 'due' }),
      'Due today',
      NOW,
    );
    expect(session).toBeNull();
  });

  it('keeps completed results when advancing', async () => {
    const session = (await createSession(
      criteria({ source: 'range', range: { start: 1, end: 3 } }),
      'Passages 1 to 3',
      NOW,
    ))!;

    const afterFirst = await advanceSession(session, 'log-1', { requeue: false }, NOW);
    expect(afterFirst.currentIndex).toBe(1);
    expect(afterFirst.results).toEqual(['log-1']);
    expect(afterFirst.completedAt).toBeNull();

    const stored = await getDataStore().sessions.get(session.id);
    expect(stored?.results).toEqual(['log-1']);
  });

  it('queues a failed passage again near the end of the session', async () => {
    const session = (await createSession(
      criteria({ source: 'range', range: { start: 1, end: 3 } }),
      'Passages 1 to 3',
      NOW,
    ))!;

    const next = await advanceSession(session, 'log-1', { requeue: true }, NOW);
    expect(next.verseIds).toEqual([
      'verse-001',
      'verse-002',
      'verse-003',
      'verse-001',
    ]);
    expect(next.completedAt).toBeNull();
  });

  it('does not queue the same passage twice', async () => {
    const session = (await createSession(
      criteria({ source: 'range', range: { start: 1, end: 2 } }),
      'Passages 1 to 2',
      NOW,
    ))!;

    const once = await advanceSession(session, 'log-1', { requeue: true }, NOW);
    const twice = await advanceSession(
      { ...once, currentIndex: 0 },
      'log-2',
      { requeue: true },
      NOW,
    );
    expect(twice.verseIds.filter((id) => id === 'verse-001')).toHaveLength(2);
  });

  it('marks the session complete after the last card', async () => {
    let session = (await createSession(
      criteria({ source: 'range', range: { start: 1, end: 2 } }),
      'Passages 1 to 2',
      NOW,
    ))!;

    session = await advanceSession(session, 'log-1', { requeue: false }, NOW);
    session = await advanceSession(session, 'log-2', { requeue: false }, NOW);

    expect(session.completedAt).toBe(NOW.toISOString());
    expect(await getResumableSession()).toBeUndefined();
  });

  it('lets a card be skipped without recording a result', async () => {
    const session = (await createSession(
      criteria({ source: 'range', range: { start: 1, end: 3 } }),
      'Passages 1 to 3',
      NOW,
    ))!;

    const next = await skipCard(session, NOW);
    expect(next.currentIndex).toBe(1);
    expect(next.results).toEqual([]);
  });

  it('moves to a specific passage index without recording a result', async () => {
    const session = (await createSession(
      criteria({ source: 'range', range: { start: 1, end: 3 } }),
      'Passages 1 to 3',
      NOW,
    ))!;

    const next = await setSessionIndex(session, 2);
    expect(next.currentIndex).toBe(2);
    expect(next.results).toEqual([]);

    const back = await setSessionIndex(next, 0);
    expect(back.currentIndex).toBe(0);
  });

  it('forgets an abandoned session', async () => {
    const session = (await createSession(
      criteria({ source: 'range', range: { start: 1, end: 3 } }),
      'Passages 1 to 3',
      NOW,
    ))!;

    await abandonSession(session.id);
    expect(await getResumableSession()).toBeUndefined();
  });

  it('resumes the most recent unfinished session', async () => {
    const older = (await createSession(
      criteria({ source: 'range', range: { start: 1, end: 2 } }),
      'Older',
      subDays(NOW, 2),
    ))!;
    const newer = (await createSession(
      criteria({ source: 'range', range: { start: 5, end: 6 } }),
      'Newer',
      NOW,
    ))!;

    const resumable = (await getResumableSession()) as ReviewSession;
    expect(resumable.id).toBe(newer.id);
    expect(resumable.id).not.toBe(older.id);
  });
});

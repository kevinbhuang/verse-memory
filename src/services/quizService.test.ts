import { beforeEach, describe, expect, it } from 'vitest';
import { SECTIONS } from '@/types';
import {
  createQuizSession,
  createQuizSessionFromPassages,
  getQuizSession,
  quizScore,
  recordQuizAnswer,
  selectQuizVerseIds,
} from './quizService';

describe('quizService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('selects passages from multiple decks', () => {
    const ids = selectQuizVerseIds({
      scope: 'deck',
      sections: [SECTIONS[0], SECTIONS[4]],
      books: [],
      size: 'all',
      mode: 'reference',
      shuffle: false,
    });
    expect(ids.length).toBe(7 + 4);
  });

  it('can quiz the entire collection or cap at 10', () => {
    const all = selectQuizVerseIds({
      scope: 'all',
      sections: [],
      books: [],
      size: 'all',
      mode: 'reference',
      shuffle: false,
    });
    expect(all.length).toBe(171);

    const ten = selectQuizVerseIds({
      scope: 'all',
      sections: [],
      books: [],
      size: 10,
      mode: 'reference',
      shuffle: false,
    });
    expect(ten).toHaveLength(10);
  });

  it('filters to memorized or Needs Review passages', async () => {
    const { createDefaultProgress } = await import('@/db/defaults');
    const progress = [
      {
        ...createDefaultProgress('verse-001'),
        isMemorized: true,
      },
      {
        ...createDefaultProgress('verse-002'),
        isDifficult: true,
      },
    ];

    const memorized = selectQuizVerseIds(
      {
        scope: 'all',
        sections: [],
        books: [],
        size: 'all',
        mode: 'reference',
        progressFilter: 'memorized',
        shuffle: false,
      },
      progress,
    );
    expect(memorized).toEqual(['verse-001']);

    const needsReview = selectQuizVerseIds(
      {
        scope: 'all',
        sections: [],
        books: [],
        size: 'all',
        mode: 'reference',
        progressFilter: 'needs-review',
        shuffle: false,
      },
      progress,
    );
    expect(needsReview).toEqual(['verse-002']);
  });

  it('creates, answers, and scores a quiz session', () => {
    const session = createQuizSession(
      {
        scope: 'deck',
        sections: [SECTIONS[4]],
        books: [],
        size: 2,
        mode: 'first-words',
        shuffle: false,
      },
      'Test quiz',
    );
    expect(session).not.toBeNull();
    expect(getQuizSession(session!.id)?.verseIds).toHaveLength(2);

    const afterFirst = recordQuizAnswer(session!, {
      verseId: session!.verseIds[0]!,
      correct: true,
      accuracy: 1,
      elapsedMs: 1000,
    });
    expect(afterFirst.currentIndex).toBe(1);
    expect(afterFirst.completedAt).toBeNull();

    const done = recordQuizAnswer(afterFirst, {
      verseId: afterFirst.verseIds[1]!,
      correct: false,
      accuracy: 0,
      elapsedMs: 800,
    });
    expect(done.completedAt).not.toBeNull();
    expect(quizScore(done)).toEqual({ correct: 1, total: 2, accuracy: 0.5 });
  });

  it('creates a quiz from explicit passages with snapshots', () => {
    const session = createQuizSessionFromPassages(
      [
        { id: 'custom-a', reference: 'John 3:16', text: 'For God so loved' },
        { id: 'custom-b', reference: 'Romans 8:28', text: 'And we know' },
      ],
      'reference',
      'Custom list quiz',
      {
        size: 'all',
        shuffle: false,
        returnPath: '/custom-verses?view=quiz',
      },
    );
    expect(session).not.toBeNull();
    expect(session!.verseIds).toEqual(['custom-a', 'custom-b']);
    expect(session!.verseSnapshots?.['custom-a']?.reference).toBe('John 3:16');
    expect(session!.returnPath).toBe('/custom-verses?view=quiz');
  });
});

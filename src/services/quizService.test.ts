import { beforeEach, describe, expect, it } from 'vitest';
import { SECTIONS } from '@/types';
import {
  createQuizSession,
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
});

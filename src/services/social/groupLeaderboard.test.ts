import { describe, expect, it } from 'vitest';
import { verses } from '@/data/verses';
import { buildGroupLeaderboard } from '@/services/social/groupLeaderboard';
import type { PublicProgressSummary } from '@/services/social/publicProgressService';

function summaryWithMemorized(
  ids: string[],
  needsReview: string[] = [],
): PublicProgressSummary {
  const verseFlags: PublicProgressSummary['verses'] = {};
  for (const id of ids) {
    verseFlags[id] = {
      memorized: true,
      needsReview: needsReview.includes(id),
    };
  }
  for (const id of needsReview) {
    if (!verseFlags[id]) {
      verseFlags[id] = { memorized: false, needsReview: true };
    }
  }
  return {
    updatedAt: '2024-01-01T00:00:00.000Z',
    memorizedCount: ids.length,
    needsReviewCount: needsReview.length,
    total: verses.length,
    weeklyDelta: 0,
    verses: verseFlags,
  };
}

describe('buildGroupLeaderboard', () => {
  it('ranks by memorized count and awards collection crown', () => {
    const johnVerses = verses
      .filter((v) => v.reference.startsWith('John '))
      .map((v) => v.id);
    const otVerses = verses
      .filter((v) =>
        ['Law and History', 'Wisdom and Poetry', 'Prophets'].includes(
          v.section,
        ),
      )
      .slice(0, 8)
      .map((v) => v.id);

    const board = buildGroupLeaderboard([
      {
        uid: 'a',
        displayName: 'Alex',
        isLeader: true,
        summary: summaryWithMemorized(otVerses.slice(0, 5)),
      },
      {
        uid: 'b',
        displayName: 'Blake',
        isLeader: false,
        summary: summaryWithMemorized([
          ...otVerses,
          ...johnVerses.slice(0, 4),
        ]),
      },
    ]);

    expect(board[0]?.uid).toBe('b');
    expect(board[0]?.rank).toBe(1);
    expect(board[0]?.badges.some((b) => b.id === 'collection-crown')).toBe(
      true,
    );
    expect(board[0]?.badges.some((b) => b.id === 'ot-warrior')).toBe(true);
    expect(
      board[0]?.badges.some((b) => b.label.startsWith('King of John')),
    ).toBe(true);
    expect(board[1]?.rank).toBe(2);
  });
});

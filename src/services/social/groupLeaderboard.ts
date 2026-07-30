import { verses } from '@/data/verses';
import { bookFromReference } from '@/lib/text/books';
import type { Section } from '@/types';
import type { PublicProgressSummary } from '@/services/social/publicProgressService';

const OT_SECTIONS = new Set<Section>([
  'Law and History',
  'Wisdom and Poetry',
  'Prophets',
]);

/** Books with enough passages in the collection to earn a “King of …” badge. */
const MIN_BOOK_PASSAGES_FOR_CROWN = 3;
const MIN_MEMORIZED_FOR_BOOK_CROWN = 2;
const MIN_FOR_OT_NT_BADGE = 3;

export type GroupBadge = {
  id: string;
  label: string;
  description: string;
};

export type LeaderboardPersonInput = {
  uid: string;
  displayName: string;
  isLeader: boolean;
  summary: PublicProgressSummary | null;
};

export type LeaderboardEntry = {
  uid: string;
  displayName: string;
  isLeader: boolean;
  rank: number;
  memorizedCount: number;
  needsReviewCount: number;
  weeklyDelta: number;
  total: number;
  percent: number;
  badges: GroupBadge[];
  synced: boolean;
};

type MemberTallies = {
  uid: string;
  displayName: string;
  isLeader: boolean;
  memorizedCount: number;
  needsReviewCount: number;
  weeklyDelta: number;
  total: number;
  synced: boolean;
  byBook: Record<string, number>;
  bySection: Record<string, number>;
  otCount: number;
  ntCount: number;
};

function tallyMember(person: LeaderboardPersonInput): MemberTallies {
  const total = person.summary?.total ?? verses.length;
  if (!person.summary) {
    return {
      uid: person.uid,
      displayName: person.displayName,
      isLeader: person.isLeader,
      memorizedCount: 0,
      needsReviewCount: 0,
      weeklyDelta: 0,
      total,
      synced: false,
      byBook: {},
      bySection: {},
      otCount: 0,
      ntCount: 0,
    };
  }

  const byBook: Record<string, number> = {};
  const bySection: Record<string, number> = {};
  let otCount = 0;
  let ntCount = 0;
  let memorizedCount = 0;
  let needsReviewCount = 0;

  for (const verse of verses) {
    const flags = person.summary.verses[verse.id];
    if (!flags) continue;
    if (flags.needsReview) needsReviewCount += 1;
    if (!flags.memorized) continue;
    memorizedCount += 1;

    bySection[verse.section] = (bySection[verse.section] ?? 0) + 1;
    if (OT_SECTIONS.has(verse.section)) otCount += 1;
    else ntCount += 1;

    const book = bookFromReference(verse.reference);
    if (book) byBook[book] = (byBook[book] ?? 0) + 1;
  }

  return {
    uid: person.uid,
    displayName: person.displayName,
    isLeader: person.isLeader,
    memorizedCount: person.summary.memorizedCount || memorizedCount,
    needsReviewCount: person.summary.needsReviewCount || needsReviewCount,
    weeklyDelta: person.summary.weeklyDelta ?? 0,
    total,
    synced: true,
    byBook,
    bySection,
    otCount,
    ntCount,
  };
}

function bookPassageCounts(): Map<string, number> {
  const counts = new Map<string, number>();
  for (const verse of verses) {
    const book = bookFromReference(verse.reference);
    if (!book) continue;
    counts.set(book, (counts.get(book) ?? 0) + 1);
  }
  return counts;
}

function winnersByScore(
  rows: MemberTallies[],
  scoreOf: (row: MemberTallies) => number,
  minimum: number,
): MemberTallies[] {
  let best = -1;
  for (const row of rows) {
    const score = scoreOf(row);
    if (score > best) best = score;
  }
  if (best < minimum) return [];
  return rows.filter((row) => scoreOf(row) === best);
}

/**
 * Rank group members by memorized count and award Strava-style crowns.
 */
export function buildGroupLeaderboard(
  people: LeaderboardPersonInput[],
): LeaderboardEntry[] {
  const tallies = people.map(tallyMember);
  const sorted = [...tallies].sort((a, b) => {
    if (b.memorizedCount !== a.memorizedCount) {
      return b.memorizedCount - a.memorizedCount;
    }
    if (a.needsReviewCount !== b.needsReviewCount) {
      return a.needsReviewCount - b.needsReviewCount;
    }
    return a.displayName.localeCompare(b.displayName);
  });

  const badgesByUid = new Map<string, GroupBadge[]>();
  const addBadge = (uid: string, badge: GroupBadge) => {
    const list = badgesByUid.get(uid) ?? [];
    if (!list.some((item) => item.id === badge.id)) list.push(badge);
    badgesByUid.set(uid, list);
  };

  const synced = tallies.filter((row) => row.synced);

  // Collection crown — top memorized (ties share it).
  for (const row of winnersByScore(synced, (r) => r.memorizedCount, 1)) {
    addBadge(row.uid, {
      id: 'collection-crown',
      label: 'Collection Crown',
      description: 'Most passages memorized in the group',
    });
  }

  // OT / NT
  for (const row of winnersByScore(synced, (r) => r.otCount, MIN_FOR_OT_NT_BADGE)) {
    addBadge(row.uid, {
      id: 'ot-warrior',
      label: 'OT Warrior',
      description: 'Most Old Testament passages memorized',
    });
  }
  for (const row of winnersByScore(synced, (r) => r.ntCount, MIN_FOR_OT_NT_BADGE)) {
    addBadge(row.uid, {
      id: 'nt-trailblazer',
      label: 'NT Trailblazer',
      description: 'Most New Testament passages memorized',
    });
  }

  // Section crowns
  const sectionBadges: Array<{ section: Section; id: string; label: string }> = [
    {
      section: 'Gospels',
      id: 'gospel-guide',
      label: 'Gospel Guide',
    },
    {
      section: 'Wisdom and Poetry',
      id: 'psalm-keeper',
      label: 'Poetry & Psalms',
    },
    {
      section: 'Prophets',
      id: 'prophets-path',
      label: 'Prophets Pathfinder',
    },
    {
      section: 'Paul\u2019s Epistles',
      id: 'pauline-pro',
      label: 'Pauline Pro',
    },
  ];
  for (const def of sectionBadges) {
    for (const row of winnersByScore(
      synced,
      (r) => r.bySection[def.section] ?? 0,
      2,
    )) {
      addBadge(row.uid, {
        id: def.id,
        label: def.label,
        description: `Most ${def.section} passages memorized`,
      });
    }
  }

  // Book KOMs (King of the Mountain style)
  const passageCounts = bookPassageCounts();
  for (const [book, passageCount] of passageCounts) {
    if (passageCount < MIN_BOOK_PASSAGES_FOR_CROWN) continue;
    const winners = winnersByScore(
      synced,
      (r) => r.byBook[book] ?? 0,
      MIN_MEMORIZED_FOR_BOOK_CROWN,
    );
    for (const row of winners) {
      addBadge(row.uid, {
        id: `king-of-${book.toLowerCase().replace(/\s+/g, '-')}`,
        label: `King of ${book}`,
        description: `Most ${book} passages memorized in the group`,
      });
    }
  }

  // Steady memory — high memorized, fewest Needs Review (among those with 10+)
  const eligibleSteady = synced.filter((r) => r.memorizedCount >= 10);
  if (eligibleSteady.length > 0) {
    let bestMem = -1;
    let bestNr = Number.POSITIVE_INFINITY;
    for (const row of eligibleSteady) {
      if (
        row.memorizedCount > bestMem ||
        (row.memorizedCount === bestMem && row.needsReviewCount < bestNr)
      ) {
        bestMem = row.memorizedCount;
        bestNr = row.needsReviewCount;
      }
    }
    for (const row of eligibleSteady) {
      if (row.memorizedCount === bestMem && row.needsReviewCount === bestNr) {
        addBadge(row.uid, {
          id: 'steady-memory',
          label: 'Steady Memory',
          description: 'Strong memorized count with the fewest Needs Review',
        });
      }
    }
  }

  let rank = 0;
  let lastCount = Number.NaN;
  return sorted.map((row, index) => {
    if (row.memorizedCount !== lastCount) {
      rank = index + 1;
      lastCount = row.memorizedCount;
    }
    return {
      uid: row.uid,
      displayName: row.displayName,
      isLeader: row.isLeader,
      rank,
      memorizedCount: row.memorizedCount,
      needsReviewCount: row.needsReviewCount,
      weeklyDelta: row.weeklyDelta,
      total: row.total,
      percent: row.total === 0 ? 0 : (row.memorizedCount / row.total) * 100,
      badges: badgesByUid.get(row.uid) ?? [],
      synced: row.synced,
    };
  });
}

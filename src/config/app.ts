import { SECTIONS, type Section } from '@/types';

const env = import.meta.env;

/**
 * Presentation-level configuration. Everything here is overridable through
 * `.env` so the collection can be re-titled without touching components.
 */
export const appConfig = {
  appName: env.VITE_APP_NAME ?? 'Verse Memory',
  collectionTitle:
    env.VITE_COLLECTION_TITLE ?? '100 Verses Every Christian Should Know',
  collectionSubtitle: env.VITE_COLLECTION_SUBTITLE ?? '171-Passage Collection',
  translationAttribution:
    env.VITE_TRANSLATION_ATTRIBUTION ??
    'Scripture quotations are from the ESV\u00ae Bible (The Holy Bible, English Standard Version\u00ae), copyright \u00a9 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved.',
  expectedVerseCount: 171,
  /**
   * One-tap join for the official Acts2Network group. Approvals go to the
   * leader’s Google account (no access code shown to joiners).
   */
  officialGroup: {
    buttonLabel: '💪📖 Join the Official A2N Verse Memory Group!',
    leaderEmail: 'kevin.huang@acts2.network',
    preferredName: 'A2N Verse Memory Group',
    /** Optional hard-coded group id from Firebase (overrides name lookup). */
    groupId: (env.VITE_OFFICIAL_GROUP_ID as string | undefined)?.trim() || null,
  },
} as const;

export const SECTION_RANGES: ReadonlyArray<{
  section: Section;
  start: number;
  end: number;
}> = [
  { section: SECTIONS[0], start: 1, end: 7 },
  { section: SECTIONS[1], start: 8, end: 19 },
  { section: SECTIONS[2], start: 20, end: 37 },
  { section: SECTIONS[3], start: 38, end: 68 },
  { section: SECTIONS[4], start: 69, end: 72 },
  { section: SECTIONS[5], start: 73, end: 144 },
  { section: SECTIONS[6], start: 145, end: 171 },
];

/** The seven review decks — one per biblical section, in collection order. */
export const DECKS = SECTION_RANGES.map((range, index) => ({
  number: index + 1,
  section: range.section,
  start: range.start,
  end: range.end,
  passageCount: range.end - range.start + 1,
  label: `Deck ${index + 1}`,
  rangeLabel: `${range.start}\u2013${range.end}`,
}));

export type Deck = (typeof DECKS)[number];

export function sectionForOrder(order: number): Section | null {
  return (
    SECTION_RANGES.find((range) => order >= range.start && order <= range.end)
      ?.section ?? null
  );
}

export function deckForSection(section: Section): Deck | undefined {
  return DECKS.find((deck) => deck.section === section);
}

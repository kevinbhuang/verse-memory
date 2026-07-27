import { z } from 'zod';
import rawVerses from './verses.json';
import { SECTIONS, type Section, type Verse } from '@/types';
import { appConfig, sectionForOrder } from '@/config/app';
import { computeContentHash } from '@/lib/hash';

const verseSchema = z.object({
  id: z.string().regex(/^verse-\d{3}$/),
  order: z.number().int().positive(),
  reference: z.string().min(1),
  text: z.string().min(1),
  translation: z.literal('ESV'),
  section: z.enum(SECTIONS),
  verified: z.boolean(),
  verificationDate: z.string().nullable(),
  contentHash: z.string().length(64),
});

export const versesSchema = z.array(verseSchema);

export type VerseIntegrityIssue = {
  verseId: string;
  reference: string;
  kind: 'hash-mismatch' | 'section-mismatch' | 'order-mismatch' | 'id-mismatch';
  detail: string;
};

export type VerseIntegrityReport = {
  count: number;
  expectedCount: number;
  countMatches: boolean;
  ordersConsecutive: boolean;
  idsUnique: boolean;
  issues: VerseIntegrityIssue[];
  verifiedCount: number;
  ok: boolean;
};

const parsed = versesSchema.safeParse(rawVerses);

if (!parsed.success) {
  // A malformed data file is a build-time defect, not a runtime condition the
  // user can recover from, so failing loudly is the correct behaviour.
  throw new Error(
    `src/data/verses.json failed schema validation: ${parsed.error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.join('.')} ${issue.message}`)
      .join('; ')}`,
  );
}

/** The canonical, immutable passage collection in its original order. */
export const verses: readonly Verse[] = Object.freeze(
  [...parsed.data].sort((a, b) => a.order - b.order),
);

const versesById = new Map(verses.map((verse) => [verse.id, verse]));

export function getVerse(verseId: string): Verse | undefined {
  return versesById.get(verseId);
}

export function requireVerse(verseId: string): Verse {
  const verse = versesById.get(verseId);
  if (!verse) throw new Error(`Unknown verse id: ${verseId}`);
  return verse;
}

export function getVerseByOrder(order: number): Verse | undefined {
  return verses[order - 1]?.order === order ? verses[order - 1] : undefined;
}

export function versesInSection(section: Section): Verse[] {
  return verses.filter((verse) => verse.section === section);
}

export const verseIds: readonly string[] = verses.map((verse) => verse.id);

/**
 * Developer-facing integrity report. Surfaced in Settings so an accidental
 * edit to Scripture text is visible in the running app, not only in CI.
 */
export function buildIntegrityReport(
  collection: readonly Verse[] = verses,
): VerseIntegrityReport {
  const issues: VerseIntegrityIssue[] = [];
  const seenIds = new Set<string>();
  let ordersConsecutive = true;
  let idsUnique = true;

  collection.forEach((verse, index) => {
    if (verse.order !== index + 1) {
      ordersConsecutive = false;
      issues.push({
        verseId: verse.id,
        reference: verse.reference,
        kind: 'order-mismatch',
        detail: `Expected order ${index + 1}, found ${verse.order}.`,
      });
    }

    if (seenIds.has(verse.id)) {
      idsUnique = false;
    }
    seenIds.add(verse.id);

    const expectedId = `verse-${String(verse.order).padStart(3, '0')}`;
    if (verse.id !== expectedId) {
      issues.push({
        verseId: verse.id,
        reference: verse.reference,
        kind: 'id-mismatch',
        detail: `Expected id ${expectedId}.`,
      });
    }

    const expectedSection = sectionForOrder(verse.order);
    if (verse.section !== expectedSection) {
      issues.push({
        verseId: verse.id,
        reference: verse.reference,
        kind: 'section-mismatch',
        detail: `Expected section "${expectedSection}", found "${verse.section}".`,
      });
    }

    const expectedHash = computeContentHash(verse.text);
    if (verse.contentHash !== expectedHash) {
      issues.push({
        verseId: verse.id,
        reference: verse.reference,
        kind: 'hash-mismatch',
        detail: `Scripture text no longer matches its recorded hash (${verse.contentHash.slice(0, 12)}\u2026 vs ${expectedHash.slice(0, 12)}\u2026).`,
      });
    }
  });

  const countMatches = collection.length === appConfig.expectedVerseCount;

  return {
    count: collection.length,
    expectedCount: appConfig.expectedVerseCount,
    countMatches,
    ordersConsecutive,
    idsUnique,
    issues,
    verifiedCount: collection.filter((verse) => verse.verified).length,
    ok: countMatches && ordersConsecutive && idsUnique && issues.length === 0,
  };
}

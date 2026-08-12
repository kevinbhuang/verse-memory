import type { CustomVerse } from '@/types/customVerse';
import type { Verse } from '@/types';

/** Adapt a custom verse into the shape review/quiz modes expect. */
export function toReviewVerse(verse: CustomVerse): Verse {
  return {
    id: verse.id,
    order: verse.order,
    reference: verse.reference,
    text: verse.text,
    translation: 'ESV',
    section: 'Law and History',
    verified: true,
    verificationDate: null,
    contentHash: '',
  };
}

/** Build a Verse from a quiz session snapshot (custom-list quizzes). */
export function verseFromQuizSnapshot(
  id: string,
  snapshot: { reference: string; text: string },
): Verse {
  return {
    id,
    order: 0,
    reference: snapshot.reference,
    text: snapshot.text,
    translation: 'ESV',
    section: 'Law and History',
    verified: true,
    verificationDate: null,
    contentHash: '',
  };
}

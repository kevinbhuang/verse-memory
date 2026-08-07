import raw from './dtChapters.json';
import type { Verse } from '@/types';

export type DtChapterVerse = {
  id: string;
  order: number;
  reference: string;
  text: string;
  translation: 'ESV';
  verseNumber: number;
};

export type DtChapterDeck = {
  id: string;
  name: string;
  referenceLabel: string;
  /** Poetic lineated ESV text for browse display (Psalms). */
  displayText?: string;
  verses: DtChapterVerse[];
};

/** Drop ESV psalm titles / choirmaster lines before the verse body. */
export function stripPsalmSuperscription(text: string): string {
  let next = text.trim();
  for (let i = 0; i < 4; i += 1) {
    const cleaned = next
      .replace(/^To the choirmaster:[^.]*\.\s*/i, '')
      .replace(/^To the choirmaster\.\s*/i, '')
      .replace(/^A (?:Psalm|Maskil|Miktam) of David\.\s*/i, '')
      .replace(/^Of David\.\s*/i, '')
      .trim();
    if (cleaned === next) break;
    next = cleaned;
  }
  return next;
}

function stripDisplaySuperscription(text: string): string {
  const marker = text.search(/\[\d+\]/);
  if (marker === -1) return stripPsalmSuperscription(text);
  return text.slice(marker).replace(/^\s+/, '');
}

function sanitizeDeck(deck: DtChapterDeck): DtChapterDeck {
  if (!deck.id.startsWith('psalm-')) return deck;
  return {
    ...deck,
    displayText: deck.displayText
      ? stripDisplaySuperscription(deck.displayText)
      : deck.displayText,
    verses: deck.verses.map((verse) => ({
      ...verse,
      text: stripPsalmSuperscription(verse.text),
    })),
  };
}

export const dtChapterDecks = (raw as DtChapterDeck[]).map(sanitizeDeck);

export function getDtChapterDeck(deckId: string): DtChapterDeck | undefined {
  return dtChapterDecks.find((deck) => deck.id === deckId);
}

/** ESV audio / API-friendly reference (ASCII hyphen ranges). */
export function dtChapterAudioReference(deck: DtChapterDeck): string {
  return deck.referenceLabel.replace(/[–—]/g, '-');
}

/** Join a chapter’s verses into one passage for whole-chapter practice / audio. */
export function toChapterReviewVerse(deck: DtChapterDeck): Verse {
  const text = deck.verses
    .map((verse) => verse.text.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    id: `dt-chapter-${deck.id}`,
    order: deck.verses[0]?.order ?? 0,
    reference: dtChapterAudioReference(deck),
    text,
    translation: 'ESV',
    section: 'Wisdom and Poetry',
    verified: true,
    verificationDate: null,
    contentHash: '',
  };
}

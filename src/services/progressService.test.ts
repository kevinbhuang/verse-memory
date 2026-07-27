import { describe, expect, it } from 'vitest';
import { startOfDay } from 'date-fns';
import { getDataStore } from '@/repositories';
import { requireVerse, verses } from '@/data/verses';
import {
  applyBulkAction,
  getProgress,
  resetScheduling,
  resetSection,
  resetVerse,
  saveNote,
  setDifficult,
  setDueDate,
  setMemorized,
  setPinnedFrequency,
  withDefaults,
} from './progressService';
import { recordReview } from './reviewService';
import type { ModeResult } from '@/types';

const NOW = new Date('2026-05-04T10:00:00.000Z');
const SETTINGS = { maximumIntervalDays: 365, difficultVerseIntervalDays: 7 };

const result = (overrides: Partial<ModeResult> = {}): ModeResult => ({
  mode: 'first-letter',
  accuracy: 1,
  elapsedMs: 12_000,
  incorrectCount: 0,
  hintCount: 0,
  fullRevealUsed: false,
  wordErrors: [],
  suggestedRating: 'good',
  ...overrides,
});

describe('getProgress', () => {
  it('returns an unsaved default record for an untouched passage', async () => {
    const progress = await getProgress('verse-010');
    expect(progress).toMatchObject({
      verseId: 'verse-010',
      status: 'new',
      isMemorized: false,
      reviewCount: 0,
    });
    expect(await getDataStore().progress.all()).toEqual([]);
  });
});

describe('withDefaults', () => {
  it('always covers the whole collection in canonical order', async () => {
    await setMemorized('verse-100', true, NOW);
    const all = withDefaults(await getDataStore().progress.all());

    expect(all).toHaveLength(verses.length);
    expect(all.map((record) => record.verseId)).toEqual(
      verses.map((verse) => verse.id),
    );
    expect(all[99].isMemorized).toBe(true);
  });
});

describe('setMemorized', () => {
  it('records the date and schedules a first retention review', async () => {
    const progress = await setMemorized('verse-001', true, NOW);

    expect(progress.isMemorized).toBe(true);
    expect(progress.status).toBe('memorized');
    expect(progress.memorizedAt).toBe(NOW.toISOString());
    expect(progress.intervalDays).toBe(1);
    expect(new Date(progress.nextDueAt!).getTime()).toBeGreaterThan(
      NOW.getTime() - 24 * 60 * 60 * 1000,
    );
  });

  it('is reversible without discarding review history', async () => {
    await recordReview({
      verseId: 'verse-001',
      rating: 'good',
      result: result(),
      settings: SETTINGS,
      now: NOW,
    });
    await setMemorized('verse-001', true, NOW);

    const unmarked = await setMemorized('verse-001', false, NOW);
    expect(unmarked.isMemorized).toBe(false);
    expect(unmarked.status).toBe('learning');
    expect(unmarked.reviewCount).toBe(1);
    expect(await getDataStore().reviewLogs.forVerse('verse-001')).toHaveLength(1);
  });

  it('does not disturb an established interval when re-checked', async () => {
    await recordReview({
      verseId: 'verse-002',
      rating: 'good',
      result: result(),
      settings: SETTINGS,
      now: NOW,
    });
    const scheduled = await getProgress('verse-002');

    const memorized = await setMemorized('verse-002', true, NOW);
    expect(memorized.nextDueAt).toBe(scheduled.nextDueAt);
    expect(memorized.intervalDays).toBe(scheduled.intervalDays);
  });

  it('returns an unmarked, never-reviewed passage to New', async () => {
    await setMemorized('verse-003', true, NOW);
    const unmarked = await setMemorized('verse-003', false, NOW);
    expect(unmarked.status).toBe('new');
  });
});

describe('setDifficult', () => {
  it('moves the passage to needs attention and back again', async () => {
    await setMemorized('verse-005', true, NOW);

    const flagged = await setDifficult('verse-005', true, NOW);
    expect(flagged.isDifficult).toBe(true);
    expect(flagged.status).toBe('needs-attention');

    const cleared = await setDifficult('verse-005', false, NOW);
    expect(cleared.isDifficult).toBe(false);
    expect(cleared.status).toBe('memorized');
  });

  it('survives a successful review, because the flag is mine to remove', async () => {
    await setMemorized('verse-006', true, NOW);
    await setDifficult('verse-006', true, NOW);

    const { progress } = await recordReview({
      verseId: 'verse-006',
      rating: 'easy',
      result: result(),
      settings: SETTINGS,
      now: NOW,
    });

    expect(progress.isDifficult).toBe(true);
  });
});

describe('notes', () => {
  it('saves a note without touching the Scripture text', async () => {
    const verse = requireVerse('verse-020');
    const saved = await saveNote('verse-020', 'Compare with Isaiah 40.', NOW);

    expect(saved.note).toBe('Compare with Isaiah 40.');
    expect(requireVerse('verse-020').text).toBe(verse.text);
  });
});

describe('scheduling overrides', () => {
  it('accepts a manual due date, normalised to the start of that day', async () => {
    const due = new Date(2026, 5, 1, 15, 30);
    const progress = await setDueDate('verse-030', due, NOW);
    expect(progress.nextDueAt).toBe(startOfDay(due).toISOString());
  });

  it('never accepts a due date in the past', async () => {
    const progress = await setDueDate('verse-032', new Date(2020, 0, 1), NOW);
    expect(progress.nextDueAt).toBe(startOfDay(NOW).toISOString());
    expect(progress.intervalDays).toBe(0);
  });

  it('pins a passage to a fixed review frequency', async () => {
    const pinned = await setPinnedFrequency('verse-031', 7, NOW);
    expect(pinned).toMatchObject({ isPinned: true, pinnedFrequencyDays: 7 });

    const unpinned = await setPinnedFrequency('verse-031', null, NOW);
    expect(unpinned).toMatchObject({
      isPinned: false,
      pinnedFrequencyDays: null,
    });
  });
});

describe('resetVerse', () => {
  it('clears scheduling, history and word statistics', async () => {
    await recordReview({
      verseId: 'verse-040',
      rating: 'again',
      result: result({
        wordErrors: [
          { wordIndex: 1, expected: 'the', received: 'a', errorType: 'incorrect' },
        ],
      }),
      settings: SETTINGS,
      now: NOW,
    });

    await resetVerse('verse-040', {}, NOW);

    const progress = await getProgress('verse-040');
    expect(progress).toMatchObject({
      status: 'new',
      reviewCount: 0,
      lapseCount: 0,
      nextDueAt: null,
      intervalDays: 0,
    });
    expect(await getDataStore().reviewLogs.forVerse('verse-040')).toEqual([]);
    expect(await getDataStore().wordStats.forVerse('verse-040')).toEqual([]);
  });

  it('keeps the note and difficult flag by default', async () => {
    await saveNote('verse-041', 'Keep me.', NOW);
    await setDifficult('verse-041', true, NOW);

    await resetVerse('verse-041', {}, NOW);
    const kept = await getProgress('verse-041');
    expect(kept.note).toBe('Keep me.');
    expect(kept.isDifficult).toBe(true);

    await resetVerse('verse-041', { keepNote: false, keepDifficultFlag: false }, NOW);
    const cleared = await getProgress('verse-041');
    expect(cleared.note).toBe('');
    expect(cleared.isDifficult).toBe(false);
  });
});

describe('resetSection', () => {
  it('resets only the passages in that section', async () => {
    await setMemorized('verse-001', true, NOW);
    await setMemorized('verse-100', true, NOW);

    const count = await resetSection('Law and History', NOW);

    expect(count).toBe(7);
    expect((await getProgress('verse-001')).isMemorized).toBe(false);
    expect((await getProgress('verse-100')).isMemorized).toBe(true);
  });
});

describe('resetScheduling', () => {
  it('clears the due date but keeps counts and flags', async () => {
    await recordReview({
      verseId: 'verse-050',
      rating: 'good',
      result: result(),
      settings: SETTINGS,
      now: NOW,
    });
    await setDifficult('verse-050', true, NOW);

    await resetScheduling(['verse-050'], NOW);

    const progress = await getProgress('verse-050');
    expect(progress.nextDueAt).toBeNull();
    expect(progress.intervalDays).toBe(0);
    expect(progress.reviewCount).toBe(1);
    expect(progress.isDifficult).toBe(true);
  });
});

describe('applyBulkAction', () => {
  const ids = ['verse-008', 'verse-009', 'verse-010'];

  it('marks a selection memorized', async () => {
    await applyBulkAction(ids, 'mark-memorized', NOW);
    for (const id of ids) {
      expect((await getProgress(id)).isMemorized).toBe(true);
    }
  });

  it('flags and clears a selection as difficult', async () => {
    await applyBulkAction(ids, 'mark-difficult', NOW);
    expect((await getProgress('verse-009')).isDifficult).toBe(true);

    await applyBulkAction(ids, 'clear-difficult', NOW);
    expect((await getProgress('verse-009')).isDifficult).toBe(false);
  });
});

import {
  differenceInCalendarDays,
  format,
  formatDistanceToNowStrict,
  isToday,
  isTomorrow,
  isYesterday,
} from 'date-fns';
import type { ReviewMode, VerseStatus } from '@/types';

export const STATUS_LABELS: Record<VerseStatus, string> = {
  new: 'New',
  learning: 'Learning',
  memorized: 'Memorized',
  'needs-attention': 'Needs attention',
};

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '\u2014';
  return format(new Date(value), 'd MMM yyyy');
}

export function formatShortDate(
  value: string | Date | null | undefined,
): string {
  if (!value) return '\u2014';
  return format(new Date(value), 'd MMM');
}

export function formatRelativeDay(
  value: string | Date | null | undefined,
  now: Date = new Date(),
): string {
  if (!value) return 'Never';
  const date = new Date(value);
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  if (isYesterday(date)) return 'Yesterday';

  const days = differenceInCalendarDays(date, now);
  if (days < 0 && days > -14) return `${Math.abs(days)} days ago`;
  if (days > 0 && days < 14) return `In ${days} days`;
  return format(date, 'd MMM yyyy');
}

export function formatTimeAgo(value: string | Date | null | undefined): string {
  if (!value) return 'Never';
  return `${formatDistanceToNowStrict(new Date(value))} ago`;
}

export function formatInterval(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return '1 day';
  if (days < 30) return `${days} days`;
  if (days < 365) {
    const months = Math.round(days / 30);
    return months === 1 ? '1 month' : `${months} months`;
  }
  const years = Math.round((days / 365) * 10) / 10;
  return years === 1 ? '1 year' : `${years} years`;
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0s';
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return `${minutes}m ${seconds}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export function formatPercent(value: number, digits = 0): string {
  return `${value.toFixed(digits)}%`;
}

export function formatAccuracy(accuracy: number | null): string {
  if (accuracy === null) return '\u2014';
  return `${Math.round(accuracy * 100)}%`;
}

export const MODE_LABELS: Record<ReviewMode, string> = {
  flashcard: 'Flashcard',
  learn: 'Learn card',
  'first-letter': 'First letter',
  'progressive-hide': 'Progressive hiding',
  'full-typing': 'Full typing',
  reference: 'Reference practice',
  voice: 'Spoken recitation',
};

export const MODE_DESCRIPTIONS: Record<ReviewMode, string> = {
  flashcard: 'See the reference, recall the passage, then rate yourself.',
  learn: 'See the passage, then flip to reveal the reference.',
  'first-letter': 'Type the first letter of each word to reveal it.',
  'progressive-hide': 'Read the passage with a share of the words removed.',
  'full-typing': 'Type the whole passage and compare it word by word.',
  reference: 'Match references to passages in either direction.',
  voice: 'Recite aloud and compare an approximate transcript.',
};

export function truncate(text: string, length = 110): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= length) return collapsed;
  return `${collapsed.slice(0, length).trimEnd()}\u2026`;
}

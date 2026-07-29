import { z } from 'zod';
import { format } from 'date-fns';
import { getDataStore } from '@/repositories';
import { SCHEMA_VERSION } from '@/db/db';
import { DEFAULT_SETTINGS } from '@/db/defaults';
import { appConfig } from '@/config/app';
import { getVerse, verses } from '@/data/verses';
import {
  PROBLEM_CATEGORIES,
  RATINGS,
  REVIEW_MODES,
  VERSE_STATUSES,
  type VerseProgress,
} from '@/types';
import { computeCollectionStats, computeSectionProgress } from './statsService';
import { withDefaults } from './progressService';

const store = () => getDataStore();

/* ------------------------------------------------------------------ */
/* Schemas                                                             */
/* ------------------------------------------------------------------ */

const ratingSchema = z.enum(RATINGS);
const modeSchema = z.enum(REVIEW_MODES);

const progressSchema = z.object({
  verseId: z.string(),
  status: z.enum(VERSE_STATUSES),
  isMemorized: z.boolean(),
  memorizedAt: z.string().nullable(),
  isDifficult: z.boolean(),
  difficultyScore: z.number(),
  difficultyReasons: z.array(z.string()).default([]),
  problemCategories: z.array(z.enum(PROBLEM_CATEGORIES)).default([]),
  note: z.string().default(''),
  lastReviewedAt: z.string().nullable(),
  nextDueAt: z.string().nullable(),
  intervalDays: z.number(),
  intervalStep: z.number(),
  reviewCount: z.number(),
  successCount: z.number(),
  lapseCount: z.number(),
  consecutiveSuccesses: z.number(),
  lastRating: ratingSchema.nullable(),
  customMaximumIntervalDays: z.number().nullable().default(null),
  pinnedFrequencyDays: z.number().nullable().default(null),
  isPinned: z.boolean().default(false),
  totalElapsedMs: z.number().default(0),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const wordErrorSchema = z.object({
  wordIndex: z.number(),
  expected: z.string(),
  received: z.string().nullable(),
  errorType: z.enum(['incorrect', 'missing', 'extra', 'hint']),
});

const reviewLogSchema = z.object({
  id: z.string(),
  verseId: z.string(),
  reviewedAt: z.string(),
  mode: modeSchema,
  rating: ratingSchema,
  accuracy: z.number().nullable(),
  elapsedMs: z.number(),
  incorrectCount: z.number(),
  hintCount: z.number(),
  fullRevealUsed: z.boolean(),
  previousIntervalDays: z.number(),
  nextIntervalDays: z.number(),
  nextDueAt: z.string(),
  wordErrors: z.array(wordErrorSchema).default([]),
  sessionId: z.string().nullable().default(null),
});

const sessionSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  completedAt: z.string().nullable(),
  label: z.string().default('Review session'),
  verseIds: z.array(z.string()),
  currentIndex: z.number(),
  modeStrategy: z.enum(['fixed', 'mixed', 'automatic', 'choose-each']),
  fixedMode: modeSchema.nullable(),
  results: z.array(z.string()).default([]),
});

const wordStatSchema = z.object({
  key: z.string(),
  verseId: z.string(),
  wordIndex: z.number(),
  word: z.string(),
  attempts: z.number(),
  misses: z.number(),
  hints: z.number(),
  substitutions: z.number(),
  lastMissAt: z.string().nullable(),
});

const settingsSchema = z
  .object({
    id: z.literal('settings').default('settings'),
    defaultReviewMode: modeSchema,
    gradingMode: z.enum(['forgiving', 'exact']),
    requirePunctuation: z.boolean(),
    requireCapitalization: z.boolean(),
    allowBackspaceInFirstLetter: z.boolean(),
    showFirstLetterSkeleton: z.boolean(),
    blindFirstLetterMode: z.boolean(),
    announceReference: z.boolean(),
    defaultSessionSize: z.number(),
    dailyNewVerseLimit: z.number(),
    maximumIntervalDays: z.number(),
    difficultVerseIntervalDays: z.number(),
    theme: z.enum(['system', 'light', 'dark']),
    reducedMotion: z.boolean(),
    confirmBeforeFullReveal: z.boolean(),
    showVerificationStatus: z.boolean(),
    showSectionLabels: z.boolean(),
    includeReferenceInGrading: z.boolean(),
    updatedAt: z.string(),
  })
  .partial()
  .transform((value) => ({ ...DEFAULT_SETTINGS, ...value, id: 'settings' as const }));

/**
 * Backups carry passage identity (id, reference, hash) but never the
 * Scripture text itself: the text lives in the application, and duplicating
 * copyrighted material in every export is unnecessary.
 */
const fingerprintSchema = z.object({
  id: z.string(),
  reference: z.string(),
  contentHash: z.string(),
});

export const backupSchema = z.object({
  schemaVersion: z.number(),
  appVersion: z.string().default('1.0.0'),
  exportedAt: z.string(),
  collection: z
    .object({
      title: z.string().default(appConfig.collectionTitle),
      verseCount: z.number().default(appConfig.expectedVerseCount),
    })
    .default({
      title: appConfig.collectionTitle,
      verseCount: appConfig.expectedVerseCount,
    }),
  progress: z.array(progressSchema).default([]),
  reviewLogs: z.array(reviewLogSchema).default([]),
  sessions: z.array(sessionSchema).default([]),
  wordStats: z.array(wordStatSchema).default([]),
  settings: settingsSchema.optional(),
  verseFingerprints: z.array(fingerprintSchema).default([]),
});

export type BackupFile = z.infer<typeof backupSchema>;

/* ------------------------------------------------------------------ */
/* Export                                                              */
/* ------------------------------------------------------------------ */

export async function buildBackup(now: Date = new Date()): Promise<BackupFile> {
  const [progress, reviewLogs, sessions, wordStats, settings] =
    await Promise.all([
      store().progress.all(),
      store().reviewLogs.all(),
      store().sessions.all(),
      store().wordStats.all(),
      store().settings.get(),
    ]);

  return {
    schemaVersion: SCHEMA_VERSION,
    appVersion: '1.0.0',
    exportedAt: now.toISOString(),
    collection: {
      title: appConfig.collectionTitle,
      verseCount: verses.length,
    },
    progress,
    reviewLogs,
    sessions,
    wordStats,
    settings,
    verseFingerprints: verses.map((verse) => ({
      id: verse.id,
      reference: verse.reference,
      contentHash: verse.contentHash,
    })),
  };
}

export function serializeBackup(backup: BackupFile): string {
  return JSON.stringify(backup, null, 2);
}

export function backupFileName(now: Date = new Date()): string {
  return `verse-memory-backup-${format(now, 'yyyy-MM-dd-HHmm')}.json`;
}

const csvCell = (value: unknown): string => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const csvRows = (rows: unknown[][]): string =>
  rows.map((row) => row.map(csvCell).join(',')).join('\n');

export async function exportProgressCsv(): Promise<string> {
  const stored = await store().progress.all();
  const all = withDefaults(stored);

  const rows: unknown[][] = [
    [
      'passage_number',
      'verse_id',
      'reference',
      'section',
      'status',
      'memorized',
      'memorized_at',
      'difficult',
      'difficulty_score',
      'last_reviewed_at',
      'next_due_at',
      'interval_days',
      'review_count',
      'success_count',
      'lapse_count',
      'consecutive_successes',
      'last_rating',
      'note',
    ],
  ];

  for (const progress of all) {
    const verse = getVerse(progress.verseId);
    rows.push([
      verse?.order ?? '',
      progress.verseId,
      verse?.reference ?? '',
      verse?.section ?? '',
      progress.status,
      progress.isMemorized ? 'yes' : 'no',
      progress.memorizedAt ?? '',
      progress.isDifficult ? 'yes' : 'no',
      progress.difficultyScore,
      progress.lastReviewedAt ?? '',
      progress.nextDueAt ?? '',
      progress.intervalDays,
      progress.reviewCount,
      progress.successCount,
      progress.lapseCount,
      progress.consecutiveSuccesses,
      progress.lastRating ?? '',
      progress.note,
    ]);
  }

  return csvRows(rows);
}

export async function exportReviewHistoryCsv(): Promise<string> {
  const logs = await store().reviewLogs.all();

  const rows: unknown[][] = [
    [
      'reviewed_at',
      'verse_id',
      'reference',
      'mode',
      'rating',
      'accuracy',
      'elapsed_ms',
      'incorrect_count',
      'hint_count',
      'full_reveal_used',
      'previous_interval_days',
      'next_interval_days',
      'next_due_at',
      'word_errors',
      'session_id',
    ],
  ];

  for (const log of [...logs].sort((a, b) =>
    a.reviewedAt.localeCompare(b.reviewedAt),
  )) {
    rows.push([
      log.reviewedAt,
      log.verseId,
      getVerse(log.verseId)?.reference ?? '',
      log.mode,
      log.rating,
      log.accuracy === null ? '' : log.accuracy.toFixed(4),
      log.elapsedMs,
      log.incorrectCount,
      log.hintCount,
      log.fullRevealUsed ? 'yes' : 'no',
      log.previousIntervalDays,
      log.nextIntervalDays,
      log.nextDueAt,
      log.wordErrors.length,
      log.sessionId ?? '',
    ]);
  }

  return csvRows(rows);
}

export async function buildProgressSummary(
  now: Date = new Date(),
): Promise<string> {
  const all = withDefaults(await store().progress.all());
  const stats = computeCollectionStats(all, now);
  const sections = computeSectionProgress(all, now);

  const lines = [
    `${appConfig.collectionTitle} \u2014 ${appConfig.collectionSubtitle}`,
    `Progress as of ${format(now, 'd MMMM yyyy')}`,
    '',
    `Memorized: ${stats.memorized} of ${stats.total} (${stats.percentMemorized.toFixed(1)}%)`,
    `Learning: ${stats.learning}`,
    `Not started: ${stats.newCount}`,
    `Needs Review: ${stats.difficult}`,
    '',
    'By section:',
    ...sections.map(
      (section) =>
        `  ${section.section}: ${section.memorized}/${section.total} (${section.percent.toFixed(0)}%)`,
    ),
  ];

  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/* Import                                                              */
/* ------------------------------------------------------------------ */

export type ParseResult =
  | { ok: true; backup: BackupFile }
  | { ok: false; errors: string[] };

export function parseBackup(raw: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (error) {
    return {
      ok: false,
      errors: [
        `The file is not valid JSON: ${error instanceof Error ? error.message : 'unknown error'}`,
      ],
    };
  }

  const parsed = backupSchema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues
        .slice(0, 12)
        .map((issue) => `${issue.path.join('.') || 'file'}: ${issue.message}`),
    };
  }

  return { ok: true, backup: parsed.data };
}

export type ImportPreview = {
  schemaVersion: number;
  exportedAt: string;
  versionCompatible: boolean;
  versionNote: string | null;
  progressAdded: number;
  progressUpdated: number;
  progressRejected: number;
  logsAdded: number;
  logsSkipped: number;
  sessionsAdded: number;
  wordStatsAdded: number;
  settingsIncluded: boolean;
  missingVerseIds: string[];
  contentHashMismatches: Array<{ verseId: string; reference: string }>;
  willOverwrite: boolean;
  existingProgressCount: number;
};

export async function previewImport(
  backup: BackupFile,
): Promise<ImportPreview> {
  const [existingProgress, existingLogs] = await Promise.all([
    store().progress.all(),
    store().reviewLogs.all(),
  ]);

  const existingIds = new Set(existingProgress.map((item) => item.verseId));
  const existingLogIds = new Set(existingLogs.map((log) => log.id));
  const knownVerseIds = new Set(verses.map((verse) => verse.id));

  const missingVerseIds = new Set<string>();
  let progressAdded = 0;
  let progressUpdated = 0;
  let progressRejected = 0;

  for (const record of backup.progress) {
    if (!knownVerseIds.has(record.verseId)) {
      progressRejected += 1;
      missingVerseIds.add(record.verseId);
      continue;
    }
    if (existingIds.has(record.verseId)) progressUpdated += 1;
    else progressAdded += 1;
  }

  let logsAdded = 0;
  let logsSkipped = 0;
  for (const log of backup.reviewLogs) {
    if (!knownVerseIds.has(log.verseId) || existingLogIds.has(log.id)) {
      logsSkipped += 1;
    } else {
      logsAdded += 1;
    }
  }

  const contentHashMismatches = backup.verseFingerprints
    .filter((fingerprint) => {
      const verse = getVerse(fingerprint.id);
      return verse && verse.contentHash !== fingerprint.contentHash;
    })
    .map((fingerprint) => ({
      verseId: fingerprint.id,
      reference: fingerprint.reference,
    }));

  const versionCompatible = backup.schemaVersion <= SCHEMA_VERSION;

  return {
    schemaVersion: backup.schemaVersion,
    exportedAt: backup.exportedAt,
    versionCompatible,
    versionNote: versionCompatible
      ? backup.schemaVersion < SCHEMA_VERSION
        ? `This backup was made with schema version ${backup.schemaVersion}; it will be upgraded to version ${SCHEMA_VERSION} on import.`
        : null
      : `This backup was made with schema version ${backup.schemaVersion}, which is newer than this app understands (version ${SCHEMA_VERSION}). Update the app before importing.`,
    progressAdded,
    progressUpdated,
    progressRejected,
    logsAdded,
    logsSkipped,
    sessionsAdded: backup.sessions.length,
    wordStatsAdded: backup.wordStats.length,
    settingsIncluded: Boolean(backup.settings),
    missingVerseIds: [...missingVerseIds],
    contentHashMismatches,
    willOverwrite: progressUpdated > 0,
    existingProgressCount: existingProgress.length,
  };
}

export type ImportMode = 'merge' | 'replace';

export type ImportResult = {
  progressWritten: number;
  logsWritten: number;
  sessionsWritten: number;
  wordStatsWritten: number;
  settingsApplied: boolean;
  rejected: number;
};

/**
 * Writes an imported backup. `merge` keeps records the backup does not
 * mention; `replace` clears user data first. Neither is ever run without an
 * explicit confirmation in the interface.
 */
export async function applyImport(
  backup: BackupFile,
  mode: ImportMode,
): Promise<ImportResult> {
  const knownVerseIds = new Set(verses.map((verse) => verse.id));

  if (mode === 'replace') {
    await store().clearAll();
  }

  const progress = backup.progress.filter((record) =>
    knownVerseIds.has(record.verseId),
  ) as VerseProgress[];
  const rejected = backup.progress.length - progress.length;

  const logs = backup.reviewLogs.filter((log) =>
    knownVerseIds.has(log.verseId),
  );
  const wordStats = backup.wordStats.filter((stat) =>
    knownVerseIds.has(stat.verseId),
  );

  await store().progress.putMany(progress);
  await store().reviewLogs.addMany(logs);
  await store().sessions.putMany(backup.sessions);
  await store().wordStats.putMany(wordStats);

  if (backup.settings) {
    await store().settings.restore(backup.settings);
  }

  return {
    progressWritten: progress.length,
    logsWritten: logs.length,
    sessionsWritten: backup.sessions.length,
    wordStatsWritten: wordStats.length,
    settingsApplied: Boolean(backup.settings),
    rejected,
  };
}

export async function resetAllProgress(): Promise<void> {
  await store().clearAll();
}

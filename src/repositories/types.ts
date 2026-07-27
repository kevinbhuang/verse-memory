import type {
  ReviewLog,
  ReviewSession,
  Settings,
  VerseProgress,
  WordStat,
} from '@/types';

/**
 * Persistence contract.
 *
 * Everything above this layer talks to these interfaces only, so the
 * IndexedDB implementation can later be replaced by, or paired with, a cloud
 * store such as Supabase without touching feature code.
 */

export interface ProgressRepository {
  all(): Promise<VerseProgress[]>;
  get(verseId: string): Promise<VerseProgress | undefined>;
  getMany(verseIds: string[]): Promise<VerseProgress[]>;
  put(progress: VerseProgress): Promise<void>;
  putMany(records: VerseProgress[]): Promise<void>;
  remove(verseId: string): Promise<void>;
  clear(): Promise<void>;
}

export interface ReviewLogRepository {
  all(): Promise<ReviewLog[]>;
  forVerse(verseId: string): Promise<ReviewLog[]>;
  since(isoDate: string): Promise<ReviewLog[]>;
  add(log: ReviewLog): Promise<void>;
  addMany(logs: ReviewLog[]): Promise<void>;
  removeForVerse(verseId: string): Promise<void>;
  clear(): Promise<void>;
}

export interface SessionRepository {
  all(): Promise<ReviewSession[]>;
  get(id: string): Promise<ReviewSession | undefined>;
  latestOpen(): Promise<ReviewSession | undefined>;
  put(session: ReviewSession): Promise<void>;
  putMany(sessions: ReviewSession[]): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

export interface WordStatRepository {
  all(): Promise<WordStat[]>;
  forVerse(verseId: string): Promise<WordStat[]>;
  putMany(stats: WordStat[]): Promise<void>;
  removeForVerse(verseId: string): Promise<void>;
  clear(): Promise<void>;
}

export interface SettingsRepository {
  get(): Promise<Settings>;
  /** Stamps `updatedAt`, so this is the path the settings screen uses. */
  save(settings: Settings): Promise<void>;
  /** Writes the record verbatim so restoring a backup reproduces it exactly. */
  restore(settings: Settings): Promise<void>;
  reset(): Promise<Settings>;
}

export interface MetaRepository {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
}

export interface DataStore {
  progress: ProgressRepository;
  reviewLogs: ReviewLogRepository;
  sessions: SessionRepository;
  wordStats: WordStatRepository;
  settings: SettingsRepository;
  meta: MetaRepository;
  /** Removes all user data. Scripture data is static and untouched. */
  clearAll(): Promise<void>;
}

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Copy,
  Download,
  Eye,
  EyeOff,
  Flag,
  Keyboard,
  Layers,
  List,
  Plus,
  Share2,
  TextCursorInput,
  Trash2,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { ScriptureText } from '@/components/ScriptureText';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { Field, Select, TextArea, TextInput } from '@/components/ui/Field';
import { LoadingState } from '@/components/ui/EmptyState';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useToast } from '@/components/ui/Toast';
import { appConfig } from '@/config/app';
import { getDatabase } from '@/db/db';
import { CustomListQuizPanel } from '@/features/customVerses/CustomListQuizPanel';
import { CustomVerseLibraryView } from '@/features/customVerses/CustomVerseLibraryView';
import {
  CustomVersePracticeSession,
  type CustomPracticeMode,
} from '@/features/customVerses/CustomVersePracticeSession';
import { QuizRunner } from '@/features/quiz/QuizRunner';
import { VerseAudioControls } from '@/features/review/VerseAudioControls';
import { useAuth } from '@/hooks/useAuth';
import { useHotkeys } from '@/hooks/useHotkeys';
import { useProgressMap, useVerseProgress } from '@/hooks/useProgressData';
import { useSettings } from '@/hooks/useSettings';
import { firstLetterSkeleton } from '@/lib/text/tokenize';
import {
  addCustomVersesFromReferences,
  deleteCustomList,
  removeCustomVerse,
  type AddDestination,
} from '@/services/customVerseService';
import { setDifficult, setMemorized } from '@/services/progressService';
import {
  importSharedListByCode,
  publishSharedList,
} from '@/services/social/sharedListService';
import type { CustomList, CustomVerse } from '@/types/customVerse';

const FIRST_LETTER_KEY = 'verse-memory:custom-flashcards-first-letter';
const REVEALED_KEY = 'verse-memory:custom-flashcards-revealed';
const CUE_HIDDEN_KEY = 'verse-memory:custom-flashcards-cue-hidden';
const ACTIVE_LIST_KEY = 'verse-memory:custom-active-list';

function readBoolPref(key: string, fallback: boolean): boolean {
  try {
    const stored = localStorage.getItem(key);
    if (stored === null) return fallback;
    return stored === 'true';
  } catch {
    return fallback;
  }
}

function writeBoolPref(key: string, value: boolean) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Ignore quota / private-mode failures.
  }
}

function readActiveListPref(): string | null {
  try {
    return localStorage.getItem(ACTIVE_LIST_KEY);
  } catch {
    return null;
  }
}

function writeActiveListPref(listId: string) {
  try {
    localStorage.setItem(ACTIVE_LIST_KEY, listId);
  } catch {
    // Ignore quota / private-mode failures.
  }
}

function parseMode(value: string | null): CustomPracticeMode | null {
  if (value === 'first-letter' || value === 'fill-blank') return value;
  return null;
}

type BrowseView = 'cards' | 'library' | 'quiz';
type AddTargetMode = 'new' | 'existing';

function parseBrowseView(value: string | null): BrowseView {
  if (value === 'library' || value === 'quiz') return value;
  return 'cards';
}

/**
 * User-built ESV lists with Flash Cards–style browse/practice, library, and quiz.
 * Google sign-in required. Kept separate from the 171-passage collection.
 */
export function CustomVersesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { settings } = useSettings();
  const { notify } = useToast();
  const { configured, user, loading: authLoading, signInWithGoogle } =
    useAuth();
  const progressById = useProgressMap();
  const [signingIn, setSigningIn] = useState(false);

  const signedIn = Boolean(configured && user);

  const customLists = useLiveQuery(
    () =>
      signedIn
        ? getDatabase().customLists.orderBy('order').toArray()
        : Promise.resolve([] as CustomList[]),
    [signedIn],
  );
  const allCustomVerses = useLiveQuery(
    () =>
      signedIn
        ? getDatabase().customVerses.orderBy('order').toArray()
        : Promise.resolve([] as CustomVerse[]),
    [signedIn],
  );

  const practiceId = searchParams.get('practice');
  const practiceMode = parseMode(searchParams.get('mode'));
  const quizId = searchParams.get('quiz');
  const startId = searchParams.get('verse');
  const listParam = searchParams.get('list');
  const view = parseBrowseView(searchParams.get('view'));

  const lists = customLists ?? [];
  const activeListId = useMemo(() => {
    if (listParam && lists.some((list) => list.id === listParam)) {
      return listParam;
    }
    const preferred = readActiveListPref();
    if (preferred && lists.some((list) => list.id === preferred)) {
      return preferred;
    }
    return lists[0]?.id ?? null;
  }, [listParam, lists]);

  const activeList =
    lists.find((list) => list.id === activeListId) ?? null;

  const [referenceInput, setReferenceInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [addProgress, setAddProgress] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addTargetMode, setAddTargetMode] = useState<AddTargetMode>('new');
  const [newListName, setNewListName] = useState('');
  const [existingListId, setExistingListId] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<CustomVerse | null>(null);
  const [deleteListTarget, setDeleteListTarget] = useState<CustomList | null>(
    null,
  );
  const [shareOpen, setShareOpen] = useState(false);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importCode, setImportCode] = useState('');
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [firstLetterMode, setFirstLetterMode] = useState(() =>
    readBoolPref(FIRST_LETTER_KEY, false),
  );
  const [revealed, setRevealed] = useState(() =>
    readBoolPref(REVEALED_KEY, true),
  );
  const [cueHidden, setCueHidden] = useState(() =>
    readBoolPref(CUE_HIDDEN_KEY, false),
  );

  const list = useMemo(
    () =>
      (allCustomVerses ?? []).filter(
        (verse) => activeListId != null && verse.listId === activeListId,
      ),
    [allCustomVerses, activeListId],
  );
  const verse = list[index] ?? list[0];
  const progress = useVerseProgress(verse?.id);
  const canGoPrev = index > 0;
  const canGoNext = index < list.length - 1;
  const showingFirstLetters = !revealed && firstLetterMode && !cueHidden;
  const hasLists = lists.length > 0;
  const showAddPanel = showAdd || !hasLists;

  useEffect(() => {
    if (!activeListId) return;
    writeActiveListPref(activeListId);
  }, [activeListId]);

  useEffect(() => {
    if (!activeListId || listParam === activeListId) return;
    const params = new URLSearchParams(searchParams);
    params.set('list', activeListId);
    setSearchParams(params, { replace: true });
    // Only sync when the resolved list differs from the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- avoid looping on searchParams identity
  }, [activeListId, listParam, setSearchParams]);

  useEffect(() => {
    if (!hasLists) {
      setAddTargetMode('new');
      return;
    }
    if (activeListId) {
      setExistingListId(activeListId);
      setAddTargetMode('existing');
    }
  }, [hasLists, activeListId]);

  useEffect(() => {
    if (!list.length) {
      setIndex(0);
      return;
    }
    if (startId) {
      const found = list.findIndex((item) => item.id === startId);
      setIndex(found >= 0 ? found : 0);
      return;
    }
    setIndex((current) => Math.min(current, list.length - 1));
  }, [list, startId]);

  useEffect(() => {
    writeBoolPref(FIRST_LETTER_KEY, firstLetterMode);
  }, [firstLetterMode]);
  useEffect(() => {
    writeBoolPref(REVEALED_KEY, revealed);
  }, [revealed]);
  useEffect(() => {
    writeBoolPref(CUE_HIDDEN_KEY, cueHidden);
  }, [cueHidden]);

  const buildParams = (overrides: Record<string, string | null> = {}) => {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(overrides)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    return params;
  };

  const selectList = (listId: string) => {
    writeActiveListPref(listId);
    setSearchParams(
      buildParams({
        list: listId,
        verse: null,
        practice: null,
        mode: null,
        quiz: null,
      }),
      { replace: true },
    );
  };

  const setView = (next: BrowseView) => {
    setSearchParams(
      buildParams({
        view: next === 'cards' ? null : next,
        verse: next === 'cards' && verse ? verse.id : null,
        practice: null,
        mode: null,
        quiz: null,
        list: activeListId,
      }),
      { replace: true },
    );
  };

  const quizReturnPath = activeListId
    ? `/custom-verses?list=${activeListId}&view=quiz`
    : '/custom-verses?view=quiz';

  const goTo = (nextIndex: number) => {
    if (!list.length || !activeListId) return;
    const clamped = Math.min(Math.max(nextIndex, 0), list.length - 1);
    setIndex(clamped);
    const target = list[clamped];
    if (target) {
      navigate(
        `/custom-verses?list=${activeListId}&verse=${target.id}`,
        { replace: true },
      );
    }
  };

  const openCards = (verseId: string) => {
    if (!activeListId) return;
    navigate(`/custom-verses?list=${activeListId}&verse=${verseId}`, {
      replace: true,
    });
  };

  const toggleVisibility = () => {
    if (revealed) {
      setRevealed(false);
      setCueHidden(false);
      return;
    }
    if (firstLetterMode) {
      setCueHidden((hidden) => !hidden);
      return;
    }
    setRevealed(true);
  };

  const showFullPassage = () => {
    setRevealed(true);
    setCueHidden(false);
  };
  const hideFullPassage = () => {
    setRevealed(false);
    setCueHidden(false);
  };

  const toggleFirstLetterMode = () => {
    if (firstLetterMode) {
      setFirstLetterMode(false);
      setRevealed(true);
      setCueHidden(false);
      return;
    }
    setFirstLetterMode(true);
    setRevealed(false);
    setCueHidden(false);
  };

  const toggleMemorized = () => {
    if (!verse || !progress) return;
    void setMemorized(verse.id, !progress.isMemorized).then(() =>
      notify(
        progress.isMemorized ? 'Cleared memorized mark.' : 'Marked memorized.',
        'success',
      ),
    );
  };

  const toggleNeedsReview = () => {
    if (!verse || !progress) return;
    void setDifficult(verse.id, !progress.isDifficult).then(() =>
      notify(
        progress.isDifficult
          ? 'Cleared Needs Review.'
          : 'Marked Needs Review.',
        'success',
      ),
    );
  };

  const startPractice = (mode: CustomPracticeMode) => {
    if (!verse || !activeListId) return;
    setSearchParams(
      {
        list: activeListId,
        practice: verse.id,
        mode,
        verse: verse.id,
      },
      { replace: false },
    );
  };

  const exitPractice = () => {
    if (verse && activeListId) {
      setSearchParams(
        { list: activeListId, verse: verse.id },
        { replace: true },
      );
      return;
    }
    setSearchParams(
      activeListId ? { list: activeListId } : {},
      { replace: true },
    );
  };

  const onAdd = async () => {
    setAdding(true);
    setAddProgress(null);
    try {
      const destination: AddDestination =
        addTargetMode === 'new' || !hasLists
          ? { mode: 'new', name: newListName }
          : { mode: 'existing', listId: existingListId || activeListId || '' };

      if (destination.mode === 'existing' && !destination.listId) {
        throw new Error('Choose an existing list.');
      }

      const result = await addCustomVersesFromReferences(
        referenceInput,
        destination,
        (done, total, reference) => {
          setAddProgress(`Fetching ${done} of ${total}: ${reference}`);
        },
      );

      const parts: string[] = [];
      if (result.added.length === 1) {
        parts.push(`Added ${result.added[0]!.reference}.`);
      } else if (result.added.length > 1) {
        parts.push(`Added ${result.added.length} passages.`);
      }
      if (destination.mode === 'new') {
        parts.unshift(`Created “${result.list.name}”.`);
      }
      if (result.skipped.length) {
        parts.push(
          `Skipped ${result.skipped.length} already on the list.`,
        );
      }
      if (result.failed.length) {
        const sample = result.failed
          .slice(0, 2)
          .map((item) => item.reference)
          .join(', ');
        parts.push(
          `Could not add ${result.failed.length}${sample ? ` (${sample})` : ''}.`,
        );
      }

      if (result.added.length || destination.mode === 'new') {
        setReferenceInput('');
        setNewListName('');
        setShowAdd(false);
        writeActiveListPref(result.list.id);
        notify(
          parts.join(' ') || `Ready on “${result.list.name}”.`,
          result.failed.length ? 'info' : 'success',
        );
        if (view === 'library') {
          setSearchParams(
            { list: result.list.id, view: 'library' },
            { replace: true },
          );
        } else if (result.added.length) {
          const last = result.added[result.added.length - 1]!;
          navigate(
            `/custom-verses?list=${result.list.id}&verse=${last.id}`,
            { replace: true },
          );
        } else {
          setSearchParams({ list: result.list.id }, { replace: true });
        }
      } else if (result.failed.length || result.skipped.length) {
        notify(parts.join(' ') || 'Nothing was added.', 'error');
      } else {
        notify('Enter one or more verse references.', 'error');
      }
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Could not add those verses.',
        'error',
      );
    } finally {
      setAdding(false);
      setAddProgress(null);
    }
  };

  const confirmDeleteVerse = async () => {
    if (!deleteTarget) return;
    const label = deleteTarget.reference;
    const id = deleteTarget.id;
    await removeCustomVerse(id);
    setDeleteTarget(null);
    notify(`Deleted ${label}.`, 'success');
    if (view === 'library' && activeListId) {
      setSearchParams(
        { list: activeListId, view: 'library' },
        { replace: true },
      );
      return;
    }
    navigate(
      activeListId ? `/custom-verses?list=${activeListId}` : '/custom-verses',
      { replace: true },
    );
  };

  const confirmDeleteList = async () => {
    if (!deleteListTarget) return;
    const label = deleteListTarget.name;
    await deleteCustomList(deleteListTarget.id);
    setDeleteListTarget(null);
    notify(`Deleted “${label}”.`, 'success');
    navigate('/custom-verses', { replace: true });
  };

  const copyShareCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      notify('Share code copied.', 'success');
    } catch {
      notify(`Share code: ${code}`, 'success');
    }
  };

  const onShareList = async () => {
    if (!user || !activeList) return;
    if (!list.length) {
      notify('Add at least one passage before sharing.', 'error');
      return;
    }
    setSharing(true);
    setShareOpen(true);
    setShareCode(null);
    try {
      const snapshot = await publishSharedList({
        uid: user.uid,
        name: activeList.name,
        references: list.map((item) => item.reference),
      });
      setShareCode(snapshot.accessCode);
    } catch (error) {
      setShareOpen(false);
      notify(
        error instanceof Error ? error.message : 'Could not share that list.',
        'error',
      );
    } finally {
      setSharing(false);
    }
  };

  const onImportList = async () => {
    setImporting(true);
    setImportProgress(null);
    try {
      const result = await importSharedListByCode(
        importCode,
        (done, total, reference) => {
          setImportProgress(`Fetching ${done} of ${total}: ${reference}`);
        },
      );
      const parts = [
        `Imported “${result.list.name}” (${result.batch.added.length} passage${result.batch.added.length === 1 ? '' : 's'}).`,
      ];
      if (result.batch.failed.length) {
        parts.push(`${result.batch.failed.length} could not be fetched.`);
      }
      notify(parts.join(' '), result.batch.failed.length ? 'info' : 'success');
      setImportOpen(false);
      setImportCode('');
      writeActiveListPref(result.list.id);
      navigate(`/custom-verses?list=${result.list.id}`, { replace: true });
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Could not import that list.',
        'error',
      );
    } finally {
      setImporting(false);
      setImportProgress(null);
    }
  };

  useHotkeys(
    {
      arrowleft: () => {
        if (canGoPrev) goTo(index - 1);
      },
      arrowright: () => {
        if (canGoNext) goTo(index + 1);
      },
      space: () => toggleVisibility(),
      enter: () => toggleVisibility(),
      h: () => toggleVisibility(),
      f: () => toggleFirstLetterMode(),
      t: () => startPractice('first-letter'),
      b: () => startPractice('fill-blank'),
      m: () => toggleMemorized(),
      n: () => toggleNeedsReview(),
    },
    {
      enabled:
        Boolean(verse) && !practiceId && !quizId && view === 'cards',
    },
  );

  const countLabel = useMemo(() => {
    if (!activeList) return '';
    if (view === 'quiz') return `${list.length} in list`;
    if (!list.length) return 'Empty';
    if (view === 'library') {
      return `${list.length} passage${list.length === 1 ? '' : 's'}`;
    }
    return `${index + 1}/${list.length}`;
  }, [activeList, index, list.length, view]);

  const practiceVerse =
    practiceId && practiceMode
      ? (allCustomVerses ?? []).find((item) => item.id === practiceId)
      : undefined;

  if (authLoading) {
    return <LoadingState label="Checking sign-in…" />;
  }

  if (!configured) {
    return (
      <>
        <PageHeader title="My Verses" />
        <Card className="mx-auto max-w-lg">
          <CardHeader
            title="Sign-in unavailable"
            description="Google sign-in is not configured in this environment, so My Verses cannot be used."
          />
        </Card>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <PageHeader title="My Verses" />
        <Card className="mx-auto max-w-lg">
          <CardHeader
            title="Sign in to use My Verses"
            description={
              <div className="space-y-2">
                <p>
                  Build your own verse lists beyond the main collection—add any
                  ESV passages you want to memorize, practice with flash cards
                  and quizzes, and share lists with others via a code.
                </p>
                <p>
                  Sign in with Google to get started. Your lists stay on this
                  device and can sync with your account.
                </p>
              </div>
            }
          />
          <CardBody>
            <Button
              variant="primary"
              disabled={signingIn}
              onClick={() => {
                setSigningIn(true);
                void signInWithGoogle()
                  .catch((error) => {
                    notify(
                      error instanceof Error
                        ? error.message
                        : 'Could not sign in.',
                      'error',
                    );
                  })
                  .finally(() => setSigningIn(false));
              }}
            >
              {signingIn ? 'Signing in…' : 'Sign in with Google'}
            </Button>
          </CardBody>
        </Card>
      </>
    );
  }

  if (quizId) {
    return <QuizRunner quizId={quizId} fallbackPath={quizReturnPath} />;
  }

  if (practiceVerse && practiceMode) {
    return (
      <CustomVersePracticeSession
        verse={practiceVerse}
        mode={practiceMode}
        onExit={exitPractice}
      />
    );
  }

  if (customLists === undefined || allCustomVerses === undefined) {
    return (
      <>
        <PageHeader title="My Verses" />
        <p className="text-sm text-ink-muted">Loading…</p>
      </>
    );
  }

  const addDisabled =
    adding ||
    referenceInput.trim() === '' ||
    (addTargetMode === 'new' || !hasLists
      ? newListName.trim() === ''
      : !(existingListId || activeListId));

  return (
    <>
      <header className="mb-4 border-b border-line pb-3">
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-ink sm:text-3xl lg:hidden">
          {appConfig.collectionTitle}
        </h1>
        <div className="mt-0.5 flex items-center justify-between gap-3 lg:mt-0">
          <h2 className="min-w-0 font-serif text-lg font-medium tracking-tight text-ink-muted sm:text-xl">
            My Verses
          </h2>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setImportOpen(true);
                setImportCode('');
                setImportProgress(null);
              }}
              title="Import a list with a share code"
            >
              <Download className="size-3.5" aria-hidden="true" />
              Import
            </Button>
            {activeList && list.length > 0 ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={sharing}
                onClick={() => void onShareList()}
                title="Share this list with a code"
              >
                <Share2 className="size-3.5" aria-hidden="true" />
                Share
              </Button>
            ) : null}
            <Button
              size="sm"
              variant={showAddPanel ? 'quiet' : 'secondary'}
              onClick={() => setShowAdd((open) => !open)}
            >
              <Plus className="size-3.5" aria-hidden="true" />
              Add
            </Button>
          </div>
        </div>

        {hasLists ? (
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
            <div className="flex min-w-0 items-center gap-2">
              <Select
                aria-label="Custom list"
                value={activeListId ?? ''}
                onChange={(event) => selectList(event.target.value)}
                className="min-w-[8.5rem] max-w-[13rem]"
              >
                {lists.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
              <span className="shrink-0 text-xs text-ink-muted tabular-nums">
                {countLabel}
              </span>
            </div>
            <SegmentedControl
              aria-label="My Verses view"
              size="sm"
              value={view}
              onChange={setView}
              options={[
                {
                  value: 'cards',
                  label: (
                    <span className="inline-flex items-center gap-1">
                      <Layers className="size-3" aria-hidden="true" />
                      Cards
                    </span>
                  ),
                },
                {
                  value: 'library',
                  label: (
                    <span className="inline-flex items-center gap-1">
                      <List className="size-3" aria-hidden="true" />
                      Library
                    </span>
                  ),
                },
                {
                  value: 'quiz',
                  label: (
                    <span className="inline-flex items-center gap-1">
                      <ClipboardList className="size-3" aria-hidden="true" />
                      Quiz
                    </span>
                  ),
                },
              ]}
            />
            {activeList && (view === 'library' || list.length === 0) ? (
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto"
                onClick={() => setDeleteListTarget(activeList)}
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
                Delete list
              </Button>
            ) : null}
          </div>
        ) : null}
      </header>

      {showAddPanel ? (
        <div className="mb-4 space-y-2.5 rounded-lg border border-line bg-surface px-3 py-3 sm:px-4">
          <div className="flex flex-wrap items-end gap-3">
            <fieldset className="min-w-0 flex-1 space-y-1.5">
              <legend className="sr-only">Add verses to</legend>
              <div className="flex flex-wrap gap-3 text-sm text-ink">
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="custom-add-target"
                    className="size-3.5 accent-[var(--accent)]"
                    checked={addTargetMode === 'new' || !hasLists}
                    onChange={() => setAddTargetMode('new')}
                  />
                  New list
                </label>
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="custom-add-target"
                    className="size-3.5 accent-[var(--accent)]"
                    checked={addTargetMode === 'existing' && hasLists}
                    disabled={!hasLists}
                    onChange={() => setAddTargetMode('existing')}
                  />
                  Existing list
                </label>
              </div>
              {addTargetMode === 'new' || !hasLists ? (
                <TextInput
                  value={newListName}
                  onChange={(event) => setNewListName(event.target.value)}
                  placeholder="List name"
                  aria-label="New list name"
                />
              ) : (
                <Select
                  aria-label="Existing custom list"
                  value={existingListId || activeListId || ''}
                  onChange={(event) => setExistingListId(event.target.value)}
                >
                  {lists.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              )}
            </fieldset>
          </div>

          <Field label="References" htmlFor="custom-verse-references">
            <TextArea
              id="custom-verse-references"
              value={referenceInput}
              onChange={(event) => setReferenceInput(event.target.value)}
              placeholder="John 3:16, Romans 8:28 — or one per line"
              rows={3}
              className="min-h-0"
              autoFocus={showAddPanel}
            />
          </Field>
          <p className="text-xs text-ink-muted">
            Separate with commas, semicolons, or new lines.
          </p>
          {addProgress ? (
            <p className="text-xs text-ink-muted">{addProgress}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              size="sm"
              disabled={addDisabled}
              onClick={() => void onAdd()}
            >
              <Plus className="size-3.5" aria-hidden="true" />
              {adding ? 'Adding…' : 'Add to list'}
            </Button>
            {hasLists ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={adding}
                onClick={() => setShowAdd(false)}
              >
                Cancel
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {!hasLists ? (
        <p className="text-sm text-ink-muted">
          Create a list and paste references to begin.
        </p>
      ) : view === 'quiz' && activeList ? (
        <CustomListQuizPanel
          list={activeList}
          verses={list}
          progressById={progressById ?? new Map()}
          returnPath={quizReturnPath}
          onStarted={(id) => {
            setSearchParams(
              {
                list: activeList.id,
                view: 'quiz',
                quiz: id,
              },
              { replace: false },
            );
          }}
        />
      ) : view === 'library' ? (
        <div className="mx-auto w-full max-w-2xl">
          <CustomVerseLibraryView
            verses={list}
            progressById={progressById ?? new Map()}
            onOpenCards={openCards}
            onDelete={(verseId) => {
              const target = list.find((item) => item.id === verseId) ?? null;
              setDeleteTarget(target);
            }}
            onToggleMemorized={(verseId, memorized) => {
              void setMemorized(verseId, memorized).then(() =>
                notify(
                  memorized
                    ? 'Marked memorized.'
                    : 'Cleared memorized mark.',
                  'success',
                ),
              );
            }}
            onToggleNeedsReview={(verseId, needsReview) => {
              void setDifficult(verseId, needsReview).then(() =>
                notify(
                  needsReview
                    ? 'Marked Needs Review.'
                    : 'Cleared Needs Review.',
                  'success',
                ),
              );
            }}
          />
        </div>
      ) : !list.length ? (
        <p className="text-sm text-ink-muted">
          This list is empty. Use Add to paste references.
        </p>
      ) : verse ? (
        <div className="mx-auto w-full max-w-2xl space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={!canGoPrev}
              onClick={() => goTo(index - 1)}
              aria-label="Previous passage"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
              Prev
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={!canGoNext}
              onClick={() => goTo(index + 1)}
              aria-label="Next passage"
            >
              Next
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          </div>

          <div>
            <h3 className="font-serif text-xl font-semibold text-ink sm:text-2xl">
              {verse.reference}
            </h3>
            {settings.showSectionLabels && activeList ? (
              <p className="mt-0.5 text-xs text-ink-muted">{activeList.name}</p>
            ) : null}
            <VerseAudioControls
              text={verse.text}
              reference={verse.reference}
              passageKey={verse.id}
              className="mt-2"
              enableRepeatHotkey
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => startPractice('first-letter')}
              title="Type first letter (T)"
            >
              <Keyboard className="size-3.5" aria-hidden="true" />
              First letter
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => startPractice('fill-blank')}
              title="Fill in the blank (B)"
            >
              <TextCursorInput className="size-3.5" aria-hidden="true" />
              Fill blank
            </Button>
            {progress ? (
              <>
                <Button
                  size="sm"
                  variant={progress.isMemorized ? 'quiet' : 'secondary'}
                  onClick={toggleMemorized}
                  aria-pressed={progress.isMemorized}
                  title="Toggle memorized (M)"
                >
                  {progress.isMemorized ? 'Memorized' : 'Mark memorized'}
                </Button>
                <Button
                  size="sm"
                  variant={progress.isDifficult ? 'quiet' : 'secondary'}
                  onClick={toggleNeedsReview}
                  aria-pressed={progress.isDifficult}
                  title="Toggle Needs Review (N)"
                >
                  <Flag className="size-3.5" aria-hidden="true" />
                  {progress.isDifficult ? 'Clear review' : 'Needs review'}
                </Button>
              </>
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDeleteTarget(verse)}
              title="Delete from this list"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
            </Button>
          </div>

          {revealed ? (
            <div className="rounded-lg border border-line bg-surface px-4 py-4 sm:px-5">
              <ScriptureText text={verse.text} />
            </div>
          ) : showingFirstLetters ? (
            <div className="rounded-lg border border-line bg-surface px-4 py-4 sm:px-5">
              <p
                className="font-serif text-lg leading-relaxed text-ink sm:text-xl sm:leading-relaxed"
                aria-label="First letters of the passage"
              >
                {firstLetterSkeleton(verse.text)}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-line-strong bg-surface-muted px-4 py-6 text-center">
              <p className="text-sm text-ink-muted">
                {firstLetterMode
                  ? 'Hidden — Space for first letters, or Show.'
                  : 'Hidden — Space to show.'}
              </p>
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={revealed ? hideFullPassage : showFullPassage}
          >
            {revealed ? (
              <>
                <EyeOff className="size-4" aria-hidden="true" />
                Hide
              </>
            ) : (
              <>
                <Eye className="size-4" aria-hidden="true" />
                Show
              </>
            )}
          </Button>
        </div>
      ) : null}

      <Dialog
        open={shareOpen}
        onClose={() => {
          if (!sharing) setShareOpen(false);
        }}
        title="Share list"
        description="Anyone signed in can import a copy with this code. Their progress stays separate."
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              disabled={sharing || !shareCode}
              onClick={() => {
                if (shareCode) void copyShareCode(shareCode);
              }}
            >
              <Copy className="size-3.5" aria-hidden="true" />
              Copy code
            </Button>
            <Button
              variant="primary"
              disabled={sharing}
              onClick={() => setShareOpen(false)}
            >
              Done
            </Button>
          </>
        }
      >
        {sharing || !shareCode ? (
          <p className="text-sm text-ink-muted">Generating share code…</p>
        ) : (
          <p className="font-mono text-3xl font-semibold tracking-[0.2em] text-ink">
            {shareCode}
          </p>
        )}
      </Dialog>

      <Dialog
        open={importOpen}
        onClose={() => {
          if (!importing) setImportOpen(false);
        }}
        title="Import list"
        description="Enter a 6-letter share code to copy that list onto this device."
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              disabled={importing}
              onClick={() => setImportOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={importing || importCode.trim().length < 4}
              onClick={() => void onImportList()}
            >
              <Download className="size-3.5" aria-hidden="true" />
              {importing ? 'Importing…' : 'Import'}
            </Button>
          </>
        }
      >
        <Field label="Share code" htmlFor="custom-list-import-code">
          <TextInput
            id="custom-list-import-code"
            value={importCode}
            onChange={(event) =>
              setImportCode(event.target.value.toUpperCase())
            }
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void onImportList();
              }
            }}
            placeholder="e.g. AB3K7M"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            maxLength={8}
            disabled={importing}
            autoFocus
          />
        </Field>
        {importProgress ? (
          <p className="mt-2 text-xs text-ink-muted">{importProgress}</p>
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        title={`Delete ${deleteTarget?.reference ?? 'this passage'}?`}
        description="It will be removed from this custom list. This does not affect the 171-passage collection."
        confirmLabel="Delete"
        destructive
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          void confirmDeleteVerse();
        }}
      />

      <ConfirmDialog
        open={deleteListTarget !== null}
        title={`Delete “${deleteListTarget?.name ?? 'this list'}”?`}
        description="Every verse in this list will be deleted. This does not affect the 171-passage collection."
        confirmLabel="Delete list"
        destructive
        onCancel={() => setDeleteListTarget(null)}
        onConfirm={() => {
          void confirmDeleteList();
        }}
      />
    </>
  );
}

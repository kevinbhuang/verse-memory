import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Keyboard, Mic, Play, RotateCcw } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Field, Select } from '@/components/ui/Field';
import { EmptyState, LoadingState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { useAllProgress, useOpenSession } from '@/hooks/useProgressData';
import { getVerse, verses } from '@/data/verses';
import { SECTIONS, type ReviewMode, type Section } from '@/types';
import {
  createSession,
  selectVerseIds,
  SOURCE_LABELS,
  type SessionCriteria,
  type SessionSource,
} from '@/services/sessionService';
import { formatRelativeDay } from '@/utils/format';

const SIZE_OPTIONS = [5, 10, 20] as const;

const SIMPLE_SOURCES: SessionSource[] = [
  'due',
  'difficult',
  'new',
  'learning',
  'memorized',
  'section',
];

const PRACTICE_MODES: Array<{
  mode: Extract<ReviewMode, 'first-letter' | 'voice'>;
  title: string;
  description: string;
  icon: typeof Keyboard;
}> = [
  {
    mode: 'first-letter',
    title: 'First letters',
    description: 'Type the first letter of each word.',
    icon: Keyboard,
  },
  {
    mode: 'voice',
    title: 'Speak',
    description: 'Recite into your microphone.',
    icon: Mic,
  },
];

export function ReviewSetupPage() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const progressList = useAllProgress();
  const openSession = useOpenSession();
  const [searchParams] = useSearchParams();

  const initialMode = searchParams.get('mode');
  const initialSource = (searchParams.get('source') ?? 'due') as SessionSource;

  const [mode, setMode] = useState<Extract<ReviewMode, 'first-letter' | 'voice'>>(
    initialMode === 'voice' ? 'voice' : 'first-letter',
  );
  const [source, setSource] = useState<SessionSource>(
    SIMPLE_SOURCES.includes(initialSource) ? initialSource : 'due',
  );
  const [section, setSection] = useState<Section>(SECTIONS[0]);
  const [size, setSize] = useState<number | 'all'>(10);
  const [starting, setStarting] = useState(false);

  const criteria: SessionCriteria = useMemo(
    () => ({
      source,
      section: source === 'section' ? section : null,
      size,
      modeStrategy: 'fixed',
      fixedMode: mode,
    }),
    [mode, section, size, source],
  );

  const preview = useMemo(
    () => (progressList ? selectVerseIds(criteria, progressList) : []),
    [criteria, progressList],
  );

  const matchingCount = useMemo(
    () =>
      progressList
        ? selectVerseIds({ ...criteria, size: 'all' }, progressList).length
        : 0,
    [criteria, progressList],
  );

  if (!progressList) return <LoadingState />;

  const start = async () => {
    setStarting(true);
    try {
      const session = await createSession(criteria, SOURCE_LABELS[source]);
      if (!session) {
        notify('No passages match that choice right now. Try New or Memorized.', 'error');
        return;
      }
      navigate(`/review/session?id=${session.id}`);
    } finally {
      setStarting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Review"
        description="Choose how to practice, then start. Sessions save as you go."
      />

      {openSession ? (
        <Card className="mb-5 border-accent/40 bg-accent-soft">
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-ink">
                You have an unfinished session
              </p>
              <p className="text-sm text-ink-muted">
                {`${openSession.label} \u00b7 ${openSession.currentIndex} of ${openSession.verseIds.length} completed \u00b7 started ${formatRelativeDay(openSession.createdAt)}`}
              </p>
            </div>
            <Button
              variant="primary"
              onClick={() => navigate(`/review/session?id=${openSession.id}`)}
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              Resume session
            </Button>
          </CardBody>
        </Card>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="How to practice" />
            <CardBody>
              <div className="grid gap-3 sm:grid-cols-2">
                {PRACTICE_MODES.map((option) => {
                  const Icon = option.icon;
                  const selected = mode === option.mode;
                  return (
                    <button
                      key={option.mode}
                      type="button"
                      onClick={() => setMode(option.mode)}
                      aria-pressed={selected}
                      className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-left ${
                        selected
                          ? 'border-accent bg-accent-soft text-accent'
                          : 'border-line-strong bg-surface text-ink hover:bg-surface-muted'
                      }`}
                    >
                      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                      <span>
                        <span className="block text-sm font-semibold">{option.title}</span>
                        <span className="mt-0.5 block text-xs opacity-80">
                          {option.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Which passages"
              description='"Need practice" covers anything due, including overdue.'
            />
            <CardBody className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {SIMPLE_SOURCES.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setSource(option)}
                    aria-pressed={source === option}
                    className={`rounded-lg border px-3 py-2 text-left text-sm ${
                      source === option
                        ? 'border-accent bg-accent-soft text-accent'
                        : 'border-line-strong bg-surface text-ink hover:bg-surface-muted'
                    }`}
                  >
                    {option === 'due' ? 'Need practice' : SOURCE_LABELS[option]}
                  </button>
                ))}
              </div>

              {source === 'section' ? (
                <Field label="Section" htmlFor="session-section">
                  <Select
                    id="session-section"
                    value={section}
                    onChange={(event) => setSection(event.target.value as Section)}
                  >
                    {SECTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="How many" />
            <CardBody>
              <div className="flex flex-wrap items-center gap-2">
                {SIZE_OPTIONS.map((option) => (
                  <Button
                    key={option}
                    variant={size === option ? 'primary' : 'secondary'}
                    onClick={() => setSize(option)}
                  >
                    {option}
                  </Button>
                ))}
                <Button
                  variant={size === 'all' ? 'primary' : 'secondary'}
                  onClick={() => setSize('all')}
                >
                  All matching
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <Card>
            <CardHeader title="Session preview" />
            <CardBody>
              {preview.length === 0 ? (
                <EmptyState
                  title="Nothing matches yet"
                  description="Try New passages, Memorized, or a section."
                />
              ) : (
                <>
                  <p className="text-sm text-ink-muted">
                    {`${preview.length} passage${preview.length === 1 ? '' : 's'} in this session${
                      matchingCount > preview.length
                        ? ` of ${matchingCount} matching`
                        : ''
                    }.`}
                  </p>
                  <ol className="mt-3 max-h-64 space-y-1 overflow-y-auto text-sm">
                    {preview.slice(0, 25).map((verseId) => {
                      const verse = getVerse(verseId);
                      return (
                        <li key={verseId} className="flex gap-2 text-ink">
                          <span className="font-mono text-xs text-ink-subtle tabular-nums">
                            {String(verse?.order ?? 0).padStart(3, '0')}
                          </span>
                          <span className="font-serif">{verse?.reference}</span>
                        </li>
                      );
                    })}
                    {preview.length > 25 ? (
                      <li className="text-xs text-ink-subtle">
                        {`and ${preview.length - 25} more`}
                      </li>
                    ) : null}
                  </ol>
                </>
              )}

              <Button
                variant="primary"
                size="lg"
                className="mt-4 w-full"
                disabled={preview.length === 0 || starting}
                onClick={() => void start()}
              >
                <Play className="size-4" aria-hidden="true" />
                Start session
              </Button>
              <p className="mt-2 text-center text-xs text-ink-subtle">
                {mode === 'first-letter' ? 'First letters' : 'Speak'}
                {` \u00b7 up to ${size === 'all' ? verses.length : size}`}
              </p>
            </CardBody>
          </Card>
        </aside>
      </div>
    </>
  );
}

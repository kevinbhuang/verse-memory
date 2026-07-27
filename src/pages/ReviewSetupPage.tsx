import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Play, RotateCcw } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Field, Select, TextInput } from '@/components/ui/Field';
import { EmptyState, LoadingState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { useAllProgress, useOpenSession } from '@/hooks/useProgressData';
import { useSettings } from '@/hooks/useSettings';
import { getVerse, verses } from '@/data/verses';
import { SECTIONS, type ModeStrategy, type ReviewMode, type Section } from '@/types';
import {
  SESSION_SOURCES,
  SOURCE_LABELS,
  createSession,
  selectVerseIds,
  type SessionCriteria,
  type SessionSource,
} from '@/services/sessionService';
import { MODE_DESCRIPTIONS, MODE_LABELS, formatRelativeDay } from '@/utils/format';
import { REVIEW_MODES } from '@/types';

const SIZE_OPTIONS = [5, 10, 20] as const;

export function ReviewSetupPage() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const { settings } = useSettings();
  const progressList = useAllProgress();
  const openSession = useOpenSession();
  const [searchParams] = useSearchParams();

  const initialSource = (searchParams.get('source') ?? 'due') as SessionSource;

  const [source, setSource] = useState<SessionSource>(
    SESSION_SOURCES.includes(initialSource) ? initialSource : 'due',
  );
  const [section, setSection] = useState<Section>(SECTIONS[0]);
  const [rangeStart, setRangeStart] = useState(1);
  const [rangeEnd, setRangeEnd] = useState(20);
  const [notReviewedInDays, setNotReviewedInDays] = useState(30);
  const [size, setSize] = useState<number | 'all'>(settings.defaultSessionSize);
  const [customSize, setCustomSize] = useState(settings.defaultSessionSize);
  const [modeStrategy, setModeStrategy] = useState<ModeStrategy>('automatic');
  const [fixedMode, setFixedMode] = useState<ReviewMode>(
    settings.defaultReviewMode,
  );
  const [starting, setStarting] = useState(false);

  const criteria: SessionCriteria = useMemo(
    () => ({
      source,
      section: source === 'section' ? section : null,
      range: source === 'range' ? { start: rangeStart, end: rangeEnd } : undefined,
      notReviewedInDays,
      size,
      modeStrategy,
      fixedMode: modeStrategy === 'fixed' ? fixedMode : null,
    }),
    [
      fixedMode,
      modeStrategy,
      notReviewedInDays,
      rangeEnd,
      rangeStart,
      section,
      size,
      source,
    ],
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
        notify('No passages match those criteria right now.', 'error');
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
        title="Build a review session"
        description="Choose which passages to review and how you want to be tested. Sessions are saved as you go, so you can pause and resume."
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
            <CardHeader
              title="Which passages"
              description="Every option keeps the collection order unless the option itself implies another order."
            />
            <CardBody className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {SESSION_SOURCES.filter((option) => option !== 'custom').map(
                  (option) => (
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
                      {SOURCE_LABELS[option]}
                    </button>
                  ),
                )}
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

              {source === 'range' ? (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="From passage" htmlFor="range-start">
                    <TextInput
                      id="range-start"
                      type="number"
                      min={1}
                      max={verses.length}
                      value={rangeStart}
                      onChange={(event) =>
                        setRangeStart(Number(event.target.value))
                      }
                    />
                  </Field>
                  <Field label="To passage" htmlFor="range-end">
                    <TextInput
                      id="range-end"
                      type="number"
                      min={1}
                      max={verses.length}
                      value={rangeEnd}
                      onChange={(event) => setRangeEnd(Number(event.target.value))}
                    />
                  </Field>
                </div>
              ) : null}

              {source === 'not-reviewed-in' ? (
                <Field
                  label="Not reviewed in the last"
                  htmlFor="not-reviewed-days"
                  hint="Days since the last review."
                >
                  <TextInput
                    id="not-reviewed-days"
                    type="number"
                    min={1}
                    max={730}
                    value={notReviewedInDays}
                    onChange={(event) =>
                      setNotReviewedInDays(Number(event.target.value))
                    }
                  />
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
                <div className="flex items-center gap-2">
                  <label htmlFor="custom-size" className="text-sm text-ink-muted">
                    Custom
                  </label>
                  <TextInput
                    id="custom-size"
                    type="number"
                    min={1}
                    max={verses.length}
                    value={customSize}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      setCustomSize(next);
                      setSize(next);
                    }}
                    className="w-24"
                  />
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Review mode"
              description="Automatic follows each passage's learning stage."
            />
            <CardBody className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {(
                  [
                    ['automatic', 'Automatic by learning stage'],
                    ['fixed', 'One mode for the session'],
                    ['mixed', 'Mixed modes'],
                    ['choose-each', 'Choose for each passage'],
                  ] as Array<[ModeStrategy, string]>
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setModeStrategy(value)}
                    aria-pressed={modeStrategy === value}
                    className={`rounded-lg border px-3 py-2 text-left text-sm ${
                      modeStrategy === value
                        ? 'border-accent bg-accent-soft text-accent'
                        : 'border-line-strong bg-surface text-ink hover:bg-surface-muted'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {modeStrategy === 'fixed' ? (
                <Field
                  label="Mode"
                  htmlFor="fixed-mode"
                  hint={MODE_DESCRIPTIONS[fixedMode]}
                >
                  <Select
                    id="fixed-mode"
                    value={fixedMode}
                    onChange={(event) =>
                      setFixedMode(event.target.value as ReviewMode)
                    }
                  >
                    {REVIEW_MODES.map((option) => (
                      <option key={option} value={option}>
                        {MODE_LABELS[option]}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : null}
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
                  description="Nothing currently fits these criteria. Try a different source, such as new passages or a section."
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
            </CardBody>
          </Card>
        </aside>
      </div>
    </>
  );
}

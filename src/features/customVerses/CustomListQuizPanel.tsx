import { useMemo, useState } from 'react';
import {
  BookOpen,
  ClipboardList,
  Keyboard,
  Mic,
  PencilLine,
  Play,
  Quote,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useToast } from '@/components/ui/Toast';
import {
  createQuizSessionFromPassages,
  type QuizProgressFilter,
} from '@/services/quizService';
import type { CustomList, CustomVerse } from '@/types/customVerse';
import type { VerseProgress } from '@/types';
import {
  QUIZ_MODES,
  QUIZ_MODE_DESCRIPTIONS,
  QUIZ_MODE_LABELS,
  type QuizMode,
} from '@/types/quiz';

type SizeChoice = 10 | 'all';

const MODE_ICONS: Record<QuizMode, typeof Quote> = {
  reference: BookOpen,
  'first-words': Quote,
  'first-letter': Keyboard,
  'fill-blank': PencilLine,
  voice: Mic,
};

function progressFilterLabel(filter: QuizProgressFilter): string {
  if (filter === 'memorized') return ' · Memorized';
  if (filter === 'needs-review') return ' · Needs Review';
  return '';
}

type Props = {
  list: CustomList;
  verses: CustomVerse[];
  progressById: Map<string, VerseProgress>;
  returnPath: string;
  onStarted: (quizId: string) => void;
};

/**
 * Quiz setup for one custom list — same modes as the main Quiz tab.
 */
export function CustomListQuizPanel({
  list,
  verses,
  progressById,
  returnPath,
  onStarted,
}: Props) {
  const { notify } = useToast();
  const [progressFilter, setProgressFilter] =
    useState<QuizProgressFilter>('all');
  const [sizeChoice, setSizeChoice] = useState<SizeChoice>(10);
  const [mode, setMode] = useState<QuizMode>('reference');
  const [starting, setStarting] = useState(false);

  const matchingTotal = useMemo(() => {
    if (progressFilter === 'all') return verses.length;
    return verses.filter((verse) => {
      const progress = progressById.get(verse.id);
      if (progressFilter === 'memorized') return progress?.isMemorized === true;
      return progress?.isDifficult === true;
    }).length;
  }, [progressById, progressFilter, verses]);

  const previewCount =
    sizeChoice === 'all' ? matchingTotal : Math.min(10, matchingTotal);

  const start = () => {
    if (previewCount === 0) {
      notify(
        progressFilter === 'all'
          ? 'Add passages to this list before quizzing.'
          : 'No passages match that filter. Try All, or mark some passages first.',
        'error',
      );
      return;
    }
    setStarting(true);
    try {
      const session = createQuizSessionFromPassages(
        verses.map((verse) => ({
          id: verse.id,
          reference: verse.reference,
          text: verse.text,
        })),
        mode,
        `${QUIZ_MODE_LABELS[mode]} · ${list.name}${progressFilterLabel(progressFilter)}`,
        {
          size: sizeChoice === 'all' ? 'all' : Math.min(10, matchingTotal),
          shuffle: true,
          returnPath,
          progressFilter,
          progressList: progressById,
        },
      );
      if (!session) {
        notify('No passages match that choice.', 'error');
        return;
      }
      onStarted(session.id);
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.95fr)_15rem] lg:items-stretch">
      <Card className="flex flex-col">
        <CardHeader title="What to quiz" className="px-4 py-2.5" />
        <CardBody className="flex flex-1 flex-col space-y-3 px-4 py-3">
          <p className="text-sm text-ink-muted">
            Quizzing{' '}
            <span className="font-medium text-ink">{list.name}</span>
            {` · ${verses.length} passage${verses.length === 1 ? '' : 's'} in this list.`}
          </p>

          <div>
            <p className="mb-1.5 text-sm font-medium text-ink">Passages</p>
            <SegmentedControl
              aria-label="Passage filter"
              size="sm"
              value={progressFilter}
              onChange={setProgressFilter}
              options={[
                { value: 'all', label: 'All' },
                { value: 'memorized', label: 'Memorized' },
                { value: 'needs-review', label: 'Needs Review' },
              ]}
            />
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium text-ink">How many</p>
            <SegmentedControl
              aria-label="Quiz length"
              size="sm"
              value={sizeChoice === 'all' ? 'all' : '10'}
              onChange={(next) =>
                setSizeChoice(next === 'all' ? 'all' : 10)
              }
              options={[
                {
                  value: '10',
                  label: '10 passages',
                  disabled: matchingTotal === 0,
                },
                {
                  value: 'all',
                  label:
                    matchingTotal > 0
                      ? `All ${matchingTotal} passages`
                      : 'All passages',
                  disabled: matchingTotal === 0,
                },
              ]}
            />
          </div>
        </CardBody>
      </Card>

      <Card className="flex flex-col">
        <CardHeader title="Quiz type" className="px-4 py-2.5" />
        <CardBody className="!flex-1 !p-0">
          <div className="divide-y divide-line">
            {QUIZ_MODES.map((option) => {
              const Icon = MODE_ICONS[option];
              const selected = mode === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setMode(option)}
                  aria-pressed={selected}
                  className={`flex w-full items-start gap-3 px-4 py-2 text-left transition-colors ${
                    selected
                      ? 'bg-accent-soft/50 text-accent'
                      : 'text-ink hover:bg-surface-muted'
                  }`}
                >
                  <Icon
                    className="mt-0.5 size-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    <span className="block text-sm font-semibold">
                      {QUIZ_MODE_LABELS[option]}
                    </span>
                    <span className="mt-0.5 block text-xs opacity-80">
                      {QUIZ_MODE_DESCRIPTIONS[option]}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </CardBody>
      </Card>

      <aside className="space-y-3 lg:col-span-2 xl:col-span-1 xl:sticky xl:top-4 xl:self-start">
        <Card>
          <CardHeader title="Ready" className="px-4 py-2.5" />
          <CardBody className="space-y-3 px-4 py-3">
            {previewCount === 0 ? (
              <EmptyState
                icon={<ClipboardList className="size-6" aria-hidden="true" />}
                title="Nothing to quiz"
                description={
                  progressFilter === 'all'
                    ? 'Add passages to this list first.'
                    : 'No passages match that filter yet.'
                }
              />
            ) : (
              <p className="text-sm text-ink-muted">
                {sizeChoice === 'all'
                  ? `All ${previewCount} passages`
                  : `${previewCount} of ${matchingTotal} passages`}
                {progressFilterLabel(progressFilter)}
                {` · ${QUIZ_MODE_LABELS[mode]}`}
              </p>
            )}
            <Button
              variant="primary"
              className="w-full"
              disabled={starting || previewCount === 0}
              onClick={start}
            >
              <Play className="size-4" aria-hidden="true" />
              {starting ? 'Starting…' : 'Start quiz'}
            </Button>
          </CardBody>
        </Card>
      </aside>
    </div>
  );
}

import {
  AlertTriangle,
  CalendarClock,
  CircleDot,
  Flag,
  Pin,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { dueState } from '@/lib/scheduler';
import { formatRelativeDay } from '@/utils/format';
import type { VerseProgress, VerseStatus } from '@/types';

export function StatusBadge({ status }: { status: VerseStatus }) {
  switch (status) {
    case 'memorized':
      return <Badge tone="success">Memorized</Badge>;
    case 'learning':
      return <Badge tone="accent">Learning</Badge>;
    case 'needs-attention':
      return (
        <Badge
          tone="warning"
          icon={<AlertTriangle className="size-3" aria-hidden="true" />}
        >
          Needs attention
        </Badge>
      );
    case 'new':
      return (
        <Badge tone="outline" icon={<CircleDot className="size-3" aria-hidden="true" />}>
          New
        </Badge>
      );
  }
}

export function DueBadge({
  progress,
  now = new Date(),
}: {
  progress: VerseProgress;
  now?: Date;
}) {
  const state = dueState(progress, now);
  if (state === 'new') return null;

  if (state === 'overdue') {
    return (
      <Badge tone="danger" icon={<CalendarClock className="size-3" aria-hidden="true" />}>
        {`Overdue \u00b7 ${formatRelativeDay(progress.nextDueAt, now)}`}
      </Badge>
    );
  }

  if (state === 'due') {
    return (
      <Badge tone="accent" icon={<CalendarClock className="size-3" aria-hidden="true" />}>
        Due today
      </Badge>
    );
  }

  return (
    <Badge tone="outline" icon={<CalendarClock className="size-3" aria-hidden="true" />}>
      {formatRelativeDay(progress.nextDueAt, now)}
    </Badge>
  );
}

export function DifficultBadge({ progress }: { progress: VerseProgress }) {
  if (!progress.isDifficult) return null;
  return (
    <Badge
      tone="warning"
      icon={<Flag className="size-3" aria-hidden="true" />}
      title={
        progress.difficultyReasons.length > 0
          ? progress.difficultyReasons.join(', ')
          : 'Marked difficult'
      }
    >
      Difficult
    </Badge>
  );
}

export function PinnedBadge({ progress }: { progress: VerseProgress }) {
  if (progress.pinnedFrequencyDays === null) return null;
  return (
    <Badge tone="outline" icon={<Pin className="size-3" aria-hidden="true" />}>
      Every {progress.pinnedFrequencyDays}d
    </Badge>
  );
}

import { Flag, Pin } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import type { VerseProgress, VerseStatus } from '@/types';

export function StatusBadge({
  status,
}: {
  status: VerseStatus;
  /** @deprecated Unused — kept for call-site compatibility. */
  exceptionalOnly?: boolean;
}) {
  switch (status) {
    case 'memorized':
      return <Badge tone="success">Memorized</Badge>;
    case 'learning':
      return <Badge tone="accent">Learning</Badge>;
    case 'needs-attention':
    case 'new':
      return null;
  }
}

/** @deprecated Timing cues removed from the UI. Always returns null. */
export function DueBadge(_props: {
  progress: VerseProgress;
  now?: Date;
  exceptionalOnly?: boolean;
}) {
  return null;
}

export function NeedsReviewBadge({ progress }: { progress: VerseProgress }) {
  if (!progress.isDifficult) return null;
  return (
    <Badge
      tone="warning"
      icon={<Flag className="size-3" aria-hidden="true" />}
      title="Marked Needs Review"
    >
      Needs Review
    </Badge>
  );
}

/** @deprecated Use NeedsReviewBadge */
export const DifficultBadge = NeedsReviewBadge;

export function PinnedBadge({ progress }: { progress: VerseProgress }) {
  if (progress.pinnedFrequencyDays === null) return null;
  return (
    <Badge tone="outline" icon={<Pin className="size-3" aria-hidden="true" />}>
      Every {progress.pinnedFrequencyDays}d
    </Badge>
  );
}

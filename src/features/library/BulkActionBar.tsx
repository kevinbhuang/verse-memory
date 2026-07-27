import { Button } from '@/components/ui/Button';
import type { BulkAction } from '@/services/progressService';

export function BulkActionBar({
  selectedCount,
  onAction,
  onStartSession,
  onClear,
}: {
  selectedCount: number;
  onAction: (action: BulkAction) => void;
  onStartSession: () => void;
  onClear: () => void;
}) {
  if (selectedCount === 0) return null;

  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="sticky top-14 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-accent/30 bg-accent-soft px-3 py-2 lg:top-2"
    >
      <span className="text-sm font-medium text-accent">
        {selectedCount} selected
      </span>

      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant="secondary" onClick={() => onAction('mark-memorized')}>
          Mark memorized
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onAction('mark-not-memorized')}
        >
          Mark not memorized
        </Button>
        <Button size="sm" variant="secondary" onClick={() => onAction('mark-difficult')}>
          Mark difficult
        </Button>
        <Button size="sm" variant="secondary" onClick={() => onAction('clear-difficult')}>
          Remove difficult
        </Button>
        <Button size="sm" variant="secondary" onClick={onStartSession}>
          Review these
        </Button>
        <Button size="sm" variant="danger" onClick={() => onAction('reset-scheduling')}>
          Reset scheduling
        </Button>
      </div>

      <Button size="sm" variant="ghost" className="ml-auto" onClick={onClear}>
        Clear selection
      </Button>
    </div>
  );
}

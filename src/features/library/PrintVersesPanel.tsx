import { useState } from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { PrintVersesForm } from './PrintVersesForm';

/**
 * Subtle library print control: one button, then a dialog to choose the set.
 */
export function PrintVersesPanel() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Printer className="size-3.5" aria-hidden="true" />
        Print
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Print passages"
        description="Download a two-column PDF checklist."
        size="md"
      >
        <PrintVersesForm
          idPrefix="print-dialog"
          onSuccess={() => setOpen(false)}
          actions={({ download, busy, count }) => (
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={download}
                disabled={busy || count === 0}
              >
                <Printer className="size-4" aria-hidden="true" />
                {busy ? 'Preparing\u2026' : `Download PDF (${count})`}
              </Button>
            </div>
          )}
        />
      </Dialog>
    </>
  );
}

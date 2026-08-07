import { useState } from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useToast } from '@/components/ui/Toast';
import type { PrintTextMode } from '@/features/library/printVersesPdf';
import { downloadDtChaptersPdf } from './dtChapterPrintPdf';

/**
 * Print controls for DT chapters only — separate from the main Print tab.
 */
export function DtChapterPrintPanel() {
  const { notify } = useToast();
  const [open, setOpen] = useState(false);
  const [textMode, setTextMode] = useState<PrintTextMode>('full');
  const [busy, setBusy] = useState(false);

  const onDownload = () => {
    setBusy(true);
    try {
      downloadDtChaptersPdf(textMode);
      notify('PDF downloaded.', 'success');
      setOpen(false);
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Could not create PDF.',
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Printer className="size-3.5" aria-hidden="true" />
        Print
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Print DT chapters"
        description="Downloads a PDF of these seven chapters only — not the 171-passage collection."
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-ink">Passage text</p>
            <SegmentedControl
              aria-label="DT print text mode"
              size="sm"
              value={textMode}
              onChange={setTextMode}
              options={[
                { value: 'full', label: 'Full text' },
                { value: 'first-letter', label: 'First letters' },
              ]}
            />
            {textMode === 'first-letter' ? (
              <p className="text-xs text-ink-muted">
                Each word becomes its first letter; punctuation is kept.
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={busy}
              onClick={onDownload}
            >
              <Printer className="size-3.5" aria-hidden="true" />
              {busy ? 'Preparing…' : 'Download PDF'}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

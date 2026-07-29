import { Printer } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { PrintVersesForm } from '@/features/library/PrintVersesForm';

/**
 * Dedicated print tab: choose scope, status, and full vs first-letter text.
 */
export function PrintPage() {
  return (
    <>
      <PageHeader title="Print" />

      <Card className="max-w-xl">
        <CardHeader title="Print passages" className="px-4 py-2.5" />
        <CardBody className="px-4 py-3">
          <p className="mb-4 text-sm text-ink-muted">
            Download a two-column PDF checklist. Filters stack — deck or books,
            Memorized or Needs Review, and full text or first letters.
          </p>
          <PrintVersesForm
            idPrefix="print-page"
            actions={({ download, busy, count }) => (
              <Button
                variant="primary"
                className="w-full"
                onClick={download}
                disabled={busy || count === 0}
              >
                <Printer className="size-4" aria-hidden="true" />
                {busy ? 'Preparing\u2026' : `Download PDF (${count})`}
              </Button>
            )}
          />
        </CardBody>
      </Card>
    </>
  );
}

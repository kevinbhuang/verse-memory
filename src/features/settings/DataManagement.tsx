import { useRef, useState } from 'react';
import { Copy, Download, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { Field, Select } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { SECTIONS, type Section } from '@/types';
import { resetSection } from '@/services/progressService';
import {
  applyImport,
  backupFileName,
  buildBackup,
  buildProgressSummary,
  exportProgressCsv,
  exportReviewHistoryCsv,
  parseBackup,
  previewImport,
  resetAllProgress,
  serializeBackup,
  type BackupFile,
  type ImportMode,
  type ImportPreview,
} from '@/services/backupService';
import { format } from 'date-fns';

function downloadFile(contents: string, filename: string, type: string): void {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function DataManagement() {
  const { notify } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pendingBackup, setPendingBackup] = useState<BackupFile | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [importMode, setImportMode] = useState<ImportMode>('merge');
  const [confirmResetAll, setConfirmResetAll] = useState(false);
  const [sectionToReset, setSectionToReset] = useState<Section | ''>('');
  const [confirmSectionReset, setConfirmSectionReset] = useState(false);

  const exportJson = async () => {
    const backup = await buildBackup();
    downloadFile(
      serializeBackup(backup),
      backupFileName(),
      'application/json',
    );
    notify('Backup downloaded.', 'success');
  };

  const exportCsv = async (kind: 'progress' | 'history') => {
    const contents =
      kind === 'progress'
        ? await exportProgressCsv()
        : await exportReviewHistoryCsv();
    downloadFile(
      contents,
      `verse-memory-${kind}-${format(new Date(), 'yyyy-MM-dd')}.csv`,
      'text/csv',
    );
    notify('CSV downloaded.', 'success');
  };

  const copySummary = async () => {
    const summary = await buildProgressSummary();
    try {
      await navigator.clipboard.writeText(summary);
      notify('Progress summary copied to the clipboard.', 'success');
    } catch {
      // Clipboard permissions vary; falling back to a download keeps the
      // action useful rather than silently failing.
      downloadFile(summary, 'verse-memory-summary.txt', 'text/plain');
      notify('Clipboard unavailable, so the summary was downloaded.', 'info');
    }
  };

  const handleFile = async (file: File) => {
    setParseErrors([]);
    const raw = await file.text();
    const parsed = parseBackup(raw);

    if (!parsed.ok) {
      setParseErrors(parsed.errors);
      setPendingBackup(null);
      setPreview(null);
      return;
    }

    setPendingBackup(parsed.backup);
    setPreview(await previewImport(parsed.backup));
  };

  const runImport = async () => {
    if (!pendingBackup) return;
    const result = await applyImport(pendingBackup, importMode);
    setPendingBackup(null);
    setPreview(null);
    notify(
      `Imported ${result.progressWritten} passage records and ${result.logsWritten} review logs.`,
      'success',
    );
  };

  return (
    <>
      <Card>
        <CardHeader
          title="Backup and export"
          description="Backups contain your progress, notes and review history. They reference passages by id and content hash rather than duplicating the Scripture text."
        />
        <CardBody className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => void exportJson()}>
            <Download className="size-4" aria-hidden="true" />
            Export all data (JSON)
          </Button>
          <Button variant="secondary" onClick={() => void exportCsv('progress')}>
            <Download className="size-4" aria-hidden="true" />
            Progress CSV
          </Button>
          <Button variant="secondary" onClick={() => void exportCsv('history')}>
            <Download className="size-4" aria-hidden="true" />
            Review history CSV
          </Button>
          <Button variant="ghost" onClick={() => void copySummary()}>
            <Copy className="size-4" aria-hidden="true" />
            Copy progress summary
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Restore from a backup"
          description="You will see exactly what will change before anything is written."
        />
        <CardBody className="space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
              event.target.value = '';
            }}
          />
          <Button
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="size-4" aria-hidden="true" />
            Choose a backup file
          </Button>

          {parseErrors.length > 0 ? (
            <div
              role="alert"
              className="rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger"
            >
              <p className="font-medium">This file could not be imported.</p>
              <ul className="mt-1 list-inside list-disc">
                {parseErrors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Reset data"
          description="Scripture data is never affected by these actions."
        />
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Reset one section" htmlFor="reset-section" className="w-64">
              <Select
                id="reset-section"
                value={sectionToReset}
                onChange={(event) =>
                  setSectionToReset(event.target.value as Section | '')
                }
              >
                <option value="">Choose a section</option>
                {SECTIONS.map((section) => (
                  <option key={section} value={section}>
                    {section}
                  </option>
                ))}
              </Select>
            </Field>
            <Button
              variant="danger"
              disabled={sectionToReset === ''}
              onClick={() => setConfirmSectionReset(true)}
            >
              Reset section
            </Button>
          </div>

          <div className="border-t border-line pt-4">
            <Button variant="danger" onClick={() => setConfirmResetAll(true)}>
              <Trash2 className="size-4" aria-hidden="true" />
              Reset all progress
            </Button>
          </div>
        </CardBody>
      </Card>

      <Dialog
        open={preview !== null}
        onClose={() => {
          setPreview(null);
          setPendingBackup(null);
        }}
        title="Review this import"
        description="Nothing has been written yet."
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setPreview(null);
                setPendingBackup(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={preview?.versionCompatible === false}
              onClick={() => void runImport()}
            >
              {importMode === 'replace'
                ? 'Replace my data'
                : 'Merge into my data'}
            </Button>
          </>
        }
      >
        {preview ? (
          <div className="space-y-4 text-sm">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              <Row label="Backup created" value={new Date(preview.exportedAt).toLocaleString()} />
              <Row label="Schema version" value={String(preview.schemaVersion)} />
              <Row label="Passage records added" value={String(preview.progressAdded)} />
              <Row
                label="Passage records updated"
                value={String(preview.progressUpdated)}
              />
              <Row label="Records rejected" value={String(preview.progressRejected)} />
              <Row label="Review logs added" value={String(preview.logsAdded)} />
              <Row label="Review logs skipped" value={String(preview.logsSkipped)} />
              <Row label="Sessions" value={String(preview.sessionsAdded)} />
              <Row label="Word statistics" value={String(preview.wordStatsAdded)} />
              <Row
                label="Settings included"
                value={preview.settingsIncluded ? 'Yes' : 'No'}
              />
            </dl>

            {preview.versionNote ? (
              <p
                className={
                  preview.versionCompatible
                    ? 'rounded-md bg-surface-muted px-3 py-2 text-ink-muted'
                    : 'rounded-md bg-danger-soft px-3 py-2 text-danger'
                }
              >
                {preview.versionNote}
              </p>
            ) : null}

            {preview.missingVerseIds.length > 0 ? (
              <p className="rounded-md bg-warning-soft px-3 py-2 text-warning">
                {`${preview.missingVerseIds.length} record(s) refer to passage ids that are not in this collection and will be skipped.`}
              </p>
            ) : null}

            {preview.contentHashMismatches.length > 0 ? (
              <div className="rounded-md bg-warning-soft px-3 py-2 text-warning">
                <p className="font-medium">
                  {`${preview.contentHashMismatches.length} passage(s) have different Scripture text than when this backup was made.`}
                </p>
                <p className="mt-1 text-xs">
                  {preview.contentHashMismatches
                    .slice(0, 6)
                    .map((item) => item.reference)
                    .join(', ')}
                  . Progress still imports; only the text differs.
                </p>
              </div>
            ) : null}

            <Field label="How should existing data be handled?" htmlFor="import-mode">
              <Select
                id="import-mode"
                value={importMode}
                onChange={(event) =>
                  setImportMode(event.target.value as ImportMode)
                }
              >
                <option value="merge">
                  Merge — keep anything the backup does not mention
                </option>
                <option value="replace">
                  Replace — delete current data first
                </option>
              </Select>
            </Field>

            {importMode === 'replace' && preview.existingProgressCount > 0 ? (
              <p className="rounded-md bg-danger-soft px-3 py-2 text-danger">
                {`This will delete your current ${preview.existingProgressCount} passage record(s) before importing.`}
              </p>
            ) : null}
          </div>
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={confirmResetAll}
        title="Reset all progress?"
        description="Every passage record, review log, session, note and word statistic is deleted. Export a backup first if you might want it back."
        confirmLabel="Delete all my progress"
        destructive
        onCancel={() => setConfirmResetAll(false)}
        onConfirm={() => {
          void resetAllProgress().then(() => {
            setConfirmResetAll(false);
            notify('All progress has been reset.', 'success');
          });
        }}
      />

      <ConfirmDialog
        open={confirmSectionReset}
        title={`Reset ${sectionToReset}?`}
        description="Progress, scheduling and history for every passage in this section are deleted."
        confirmLabel="Reset section"
        destructive
        onCancel={() => setConfirmSectionReset(false)}
        onConfirm={() => {
          if (sectionToReset === '') return;
          void resetSection(sectionToReset).then((count) => {
            setConfirmSectionReset(false);
            setSectionToReset('');
            notify(`${count} passages reset.`, 'success');
          });
        }}
      />
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right text-ink tabular-nums">{value}</dd>
    </>
  );
}

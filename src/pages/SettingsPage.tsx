import { useMemo } from 'react';
import { CheckCircle2, TriangleAlert } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Field, Select, TextInput, Toggle } from '@/components/ui/Field';
import { LoadingState } from '@/components/ui/EmptyState';
import { useSettings } from '@/hooks/useSettings';
import { appConfig } from '@/config/app';
import { buildIntegrityReport, verses } from '@/data/verses';
import { INTERVAL_LADDER } from '@/lib/scheduler';
import { REVIEW_MODES, type ReviewMode, type ThemePreference } from '@/types';
import { MODE_DESCRIPTIONS, MODE_LABELS } from '@/utils/format';
import { DataManagement } from '@/features/settings/DataManagement';

export function SettingsPage() {
  const { settings, loaded, update } = useSettings();
  const integrity = useMemo(() => buildIntegrityReport(), []);

  if (!loaded) return <LoadingState />;

  return (
    <>
      <PageHeader
        title="Settings"
        description="Preferences are stored on this device alongside your progress."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Review defaults" />
            <CardBody className="space-y-4">
              <Field
                label="Default review mode"
                htmlFor="default-mode"
                hint={MODE_DESCRIPTIONS[settings.defaultReviewMode]}
              >
                <Select
                  id="default-mode"
                  value={settings.defaultReviewMode}
                  onChange={(event) =>
                    void update({
                      defaultReviewMode: event.target.value as ReviewMode,
                    })
                  }
                >
                  {REVIEW_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {MODE_LABELS[mode]}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Default session size" htmlFor="session-size">
                <TextInput
                  id="session-size"
                  type="number"
                  min={1}
                  max={verses.length}
                  value={settings.defaultSessionSize}
                  onChange={(event) =>
                    void update({
                      defaultSessionSize: Number(event.target.value),
                    })
                  }
                />
              </Field>

              <Field
                label="New passages per day"
                htmlFor="new-limit"
                hint="How many unseen passages a Learn session will offer."
              >
                <TextInput
                  id="new-limit"
                  type="number"
                  min={0}
                  max={20}
                  value={settings.dailyNewVerseLimit}
                  onChange={(event) =>
                    void update({ dailyNewVerseLimit: Number(event.target.value) })
                  }
                />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Typing and grading"
              description="Applies to full typing, reference practice and first-letter mode."
            />
            <CardBody className="divide-y divide-[var(--border-subtle)]">
              <Field label="Grading" htmlFor="grading-mode" className="pb-3">
                <Select
                  id="grading-mode"
                  value={settings.gradingMode}
                  onChange={(event) =>
                    void update({
                      gradingMode: event.target.value as 'forgiving' | 'exact',
                    })
                  }
                >
                  <option value="forgiving">
                    Forgiving — ignore case, punctuation and spacing
                  </option>
                  <option value="exact">Exact — require the words as written</option>
                </Select>
              </Field>

              <Toggle
                label="Require punctuation"
                description="Only applies to exact grading."
                checked={settings.requirePunctuation}
                onChange={(value) => void update({ requirePunctuation: value })}
              />
              <Toggle
                label="Require capitalisation"
                description="Only applies to exact grading."
                checked={settings.requireCapitalization}
                onChange={(value) => void update({ requireCapitalization: value })}
              />
              <Toggle
                label="Allow Backspace in first-letter mode"
                description="Step back one word at a time."
                checked={settings.allowBackspaceInFirstLetter}
                onChange={(value) =>
                  void update({ allowBackspaceInFirstLetter: value })
                }
              />
              <Toggle
                label="Show the first-letter skeleton"
                description="Display the sequence of first letters before you type."
                checked={settings.showFirstLetterSkeleton}
                onChange={(value) => void update({ showFirstLetterSkeleton: value })}
              />
              <Toggle
                label="Hide letters entirely"
                description="Supply every letter from memory, with no prompt at all."
                checked={settings.blindFirstLetterMode}
                onChange={(value) => void update({ blindFirstLetterMode: value })}
              />
              <Toggle
                label="Include the reference in grading"
                description="Type the reference alongside the passage in full typing mode."
                checked={settings.includeReferenceInGrading}
                onChange={(value) =>
                  void update({ includeReferenceInGrading: value })
                }
              />
              <Toggle
                label="Confirm before revealing a whole passage"
                checked={settings.confirmBeforeFullReveal}
                onChange={(value) =>
                  void update({ confirmBeforeFullReveal: value })
                }
              />
              <Toggle
                label="Show the reference at the start of a card"
                checked={settings.announceReference}
                onChange={(value) => void update({ announceReference: value })}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Scheduling"
              description={`Intervals follow a fixed ladder: ${INTERVAL_LADDER.join(', ')} days.`}
            />
            <CardBody className="space-y-4">
              <Field
                label="Maximum normal interval (days)"
                htmlFor="max-interval-setting"
              >
                <TextInput
                  id="max-interval-setting"
                  type="number"
                  min={1}
                  max={3650}
                  value={settings.maximumIntervalDays}
                  onChange={(event) =>
                    void update({
                      maximumIntervalDays: Number(event.target.value),
                    })
                  }
                />
              </Field>

              <Field
                label="Difficult-passage interval (days)"
                htmlFor="difficult-interval"
                hint="Difficult passages are capped at this interval until three consecutive Good or Easy ratings."
              >
                <TextInput
                  id="difficult-interval"
                  type="number"
                  min={1}
                  max={90}
                  value={settings.difficultVerseIntervalDays}
                  onChange={(event) =>
                    void update({
                      difficultVerseIntervalDays: Number(event.target.value),
                    })
                  }
                />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Appearance and accessibility" />
            <CardBody className="divide-y divide-[var(--border-subtle)]">
              <Field label="Theme" htmlFor="theme" className="pb-3">
                <Select
                  id="theme"
                  value={settings.theme}
                  onChange={(event) =>
                    void update({ theme: event.target.value as ThemePreference })
                  }
                >
                  <option value="system">Match the system</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </Select>
              </Field>
              <Toggle
                label="Reduce motion"
                description="Removes the few transitions the app uses."
                checked={settings.reducedMotion}
                onChange={(value) => void update({ reducedMotion: value })}
              />
              <Toggle
                label="Show section labels"
                checked={settings.showSectionLabels}
                onChange={(value) => void update({ showSectionLabels: value })}
              />
              <Toggle
                label="Show ESV verification status"
                checked={settings.showVerificationStatus}
                onChange={(value) =>
                  void update({ showVerificationStatus: value })
                }
              />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-5">
          <DataManagement />

          <Card>
            <CardHeader title="Scripture data integrity" />
            <CardBody className="space-y-2 text-sm">
              <p className="flex items-center gap-2">
                {integrity.ok ? (
                  <CheckCircle2
                    className="size-4 text-success"
                    aria-hidden="true"
                  />
                ) : (
                  <TriangleAlert
                    className="size-4 text-danger"
                    aria-hidden="true"
                  />
                )}
                <span className="text-ink">
                  {integrity.ok
                    ? `All ${integrity.count} passages match their recorded content hashes.`
                    : `${integrity.issues.length} integrity problem(s) detected.`}
                </span>
              </p>
              <ul className="space-y-1 text-xs text-ink-muted">
                <li>{`Passage count: ${integrity.count} of ${integrity.expectedCount}`}</li>
                <li>{`Order 1\u2013${integrity.expectedCount} consecutive: ${integrity.ordersConsecutive ? 'yes' : 'no'}`}</li>
                <li>{`Identifiers unique: ${integrity.idsUnique ? 'yes' : 'no'}`}</li>
                <li>{`ESV-verified passages: ${integrity.verifiedCount} of ${integrity.count}`}</li>
              </ul>
              {integrity.issues.length > 0 ? (
                <ul className="mt-2 space-y-1 rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">
                  {integrity.issues.slice(0, 10).map((issue) => (
                    <li key={`${issue.verseId}-${issue.kind}`}>
                      {`${issue.reference}: ${issue.detail}`}
                    </li>
                  ))}
                </ul>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Keyboard shortcuts during review" />
            <CardBody>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                <dt className="font-mono text-xs text-ink-subtle">Space / Enter</dt>
                <dd className="text-ink-muted">Reveal the passage</dd>
                <dt className="font-mono text-xs text-ink-subtle">1 – 4</dt>
                <dd className="text-ink-muted">Again, Hard, Good, Easy</dd>
                <dt className="font-mono text-xs text-ink-subtle">H</dt>
                <dd className="text-ink-muted">Hint (Shift+Enter while typing)</dd>
                <dt className="font-mono text-xs text-ink-subtle">D</dt>
                <dd className="text-ink-muted">Toggle the difficult flag</dd>
                <dt className="font-mono text-xs text-ink-subtle">N</dt>
                <dd className="text-ink-muted">Open the note</dd>
                <dt className="font-mono text-xs text-ink-subtle">Escape</dt>
                <dd className="text-ink-muted">Pause and leave the session</dd>
              </dl>
            </CardBody>
          </Card>

          <Card>
            <div id="about" />
            <CardHeader title="About" />
            <CardBody className="space-y-3 text-sm text-ink-muted">
              <p>
                <span className="font-medium text-ink">{appConfig.appName}</span>{' '}
                is a personal Scripture memory workspace for{' '}
                {appConfig.collectionTitle} ({appConfig.collectionSubtitle}). All
                data stays on this device in IndexedDB; there is no account and
                no server.
              </p>
              <p>{appConfig.translationAttribution}</p>
              <p className="text-xs">
                Passage text is treated as immutable canonical content. Each
                passage carries a SHA-256 content hash so an accidental edit is
                detected rather than silently accepted.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

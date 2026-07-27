import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Field, Select, Toggle } from '@/components/ui/Field';
import { StatTile } from '@/components/ui/StatTile';
import { LoadingState } from '@/components/ui/EmptyState';
import { useAllProgress, useReviewLogs } from '@/hooks/useProgressData';
import { useSettings } from '@/hooks/useSettings';
import { appConfig } from '@/config/app';
import {
  computeCollectionStats,
  computeStreak,
} from '@/services/statsService';
import { formatPercent } from '@/utils/format';
import type { ThemePreference } from '@/types';
import { DataManagement } from '@/features/settings/DataManagement';

/**
 * Secondary hub: a few progress stats, theme, backup, and about.
 * Power-user grading/scheduling controls stay on the device defaults.
 */
export function MorePage() {
  const progressList = useAllProgress();
  const logs = useReviewLogs();
  const { settings, loaded, update } = useSettings();

  const stats = useMemo(
    () => (progressList ? computeCollectionStats(progressList) : null),
    [progressList],
  );
  const streak = useMemo(() => computeStreak(logs ?? []), [logs]);

  if (!progressList || !stats || logs === undefined || !loaded) {
    return <LoadingState />;
  }

  return (
    <>
      <PageHeader
        title="More"
        description="Progress, appearance, and data tools."
      />

      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Memorized"
          value={stats.memorized}
          detail={formatPercent(stats.percentMemorized, 1)}
          to="/verses?status=memorized"
          tone="success"
        />
        <StatTile
          label="Learning"
          value={stats.learning}
          to="/verses?status=learning"
          tone="accent"
        />
        <StatTile
          label="Difficult"
          value={stats.difficult}
          tone={stats.difficult > 0 ? 'warning' : 'neutral'}
          to="/practice?filter=difficult"
        />
        <StatTile
          label="Streak"
          value={streak.current}
          detail={streak.current === 1 ? 'day' : 'days'}
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Appearance" />
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
          </CardBody>
        </Card>

        <DataManagement />

        <Card className="lg:col-span-2">
          <CardHeader title="About" />
          <CardBody className="space-y-3 text-sm text-ink-muted">
            <p>
              <span className="font-medium text-ink">{appConfig.appName}</span>{' '}
              is a personal Scripture memory workspace for{' '}
              {appConfig.collectionTitle}. All data stays on this device.
            </p>
            <p>{appConfig.translationAttribution}</p>
            <p>
              <Link to="/practice" className="text-accent hover:underline">
                Back to Practice
              </Link>
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

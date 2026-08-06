import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { Crown, Medal, Target } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/Field';
import {
  buildGroupLeaderboard,
  type LeaderboardPersonInput,
} from '@/services/social/groupLeaderboard';
import type { PublicProgressSummary } from '@/services/social/publicProgressService';
import type { UserProfile } from '@/services/social/profileService';
import type { GroupMember, MemoryGroup } from '@/services/social/groupService';

function displayLabel(profile: UserProfile | null): string {
  if (profile?.displayName) return profile.displayName;
  if (profile?.email) return profile.email;
  return 'Someone';
}

/**
 * Ranked group board: memorized counts, weekly deltas, goal meter, and crowns.
 */
export function GroupLeaderboard({
  members,
  currentUid,
  group,
  isLeader,
  onSaveGoal,
  goalBusy = false,
}: {
  members: Array<{
    member: GroupMember;
    profile: UserProfile | null;
    summary: PublicProgressSummary | null;
  }>;
  currentUid: string;
  group: MemoryGroup | null;
  isLeader: boolean;
  onSaveGoal?: (goal: number | null) => void | Promise<void>;
  goalBusy?: boolean;
}) {
  const people: LeaderboardPersonInput[] = members.map(
    ({ member, profile, summary }) => ({
      uid: member.uid,
      displayName: displayLabel(profile),
      isLeader: member.role === 'leader',
      summary,
    }),
  );
  const entries = buildGroupLeaderboard(people);
  const teamTotal = useMemo(
    () => entries.reduce((sum, entry) => sum + entry.memorizedCount, 0),
    [entries],
  );
  const goal = group?.goalMemorizedTotal ?? null;
  const goalPercent =
    goal && goal > 0 ? Math.min(100, Math.round((teamTotal / goal) * 100)) : 0;

  const [goalDraft, setGoalDraft] = useState(
    goal != null ? String(goal) : '',
  );

  useEffect(() => {
    setGoalDraft(goal != null ? String(goal) : '');
  }, [goal, group?.id]);

  if (entries.length === 0) {
    return <p className="text-sm text-ink-muted">No active members yet.</p>;
  }

  const maxMemorized = Math.max(...entries.map((e) => e.memorizedCount), 1);

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold leading-none text-ink">
          Leaderboard
        </h3>
        <p className="mt-1.5 text-xs leading-snug text-ink-muted">
          Ranked by passages memorized. Crowns mark category leaders — tap any
          name (including yours) to open a Progress Chart.
        </p>
      </div>

      <div className="rounded-lg border border-line bg-surface-muted/60 p-3">
        <div className="flex items-center gap-2">
          <Target className="size-4 shrink-0 text-brand" aria-hidden="true" />
          <p className="text-sm font-medium leading-none text-ink">
            Group goal
          </p>
        </div>
        {goal != null ? (
          <>
            <p className="mt-2 text-sm leading-snug text-ink-muted">
              <span className="font-semibold tabular-nums text-ink">
                {teamTotal}
              </span>
              {' of '}
              <span className="tabular-nums">{goal}</span>
              {' memorized as a team'}
              <span className="text-ink-subtle"> · {goalPercent}%</span>
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-sunken">
              <div
                className="h-full rounded-full bg-brand transition-[width]"
                style={{ width: `${goalPercent}%` }}
              />
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm leading-snug text-ink-muted">
            Team total:{' '}
            <span className="font-semibold tabular-nums text-ink">
              {teamTotal}
            </span>{' '}
            memorized
            {isLeader ? ' — set a shared goal below.' : '.'}
          </p>
        )}

        {isLeader && onSaveGoal ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <TextInput
              type="number"
              min={1}
              inputMode="numeric"
              aria-label="Group memorized goal"
              placeholder="e.g. 200"
              value={goalDraft}
              onChange={(event) => setGoalDraft(event.target.value)}
              disabled={goalBusy}
              className="w-28"
            />
            <Button
              size="sm"
              variant="secondary"
              disabled={goalBusy}
              onClick={() => {
                const trimmed = goalDraft.trim();
                if (!trimmed) {
                  void onSaveGoal(null);
                  return;
                }
                const value = Number(trimmed);
                void onSaveGoal(Number.isFinite(value) ? value : null);
              }}
            >
              Save goal
            </Button>
            {goal != null ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={goalBusy}
                onClick={() => {
                  setGoalDraft('');
                  void onSaveGoal(null);
                }}
              >
                Clear
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <ol className="space-y-2">
        {entries.map((entry) => {
          const isSelf = entry.uid === currentUid;
          const barWidth = Math.max(
            6,
            Math.round((entry.memorizedCount / maxMemorized) * 100),
          );

          const body = (
            <div className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-start gap-x-3">
              <span
                className={clsx(
                  'flex size-8 items-center justify-center rounded-full text-sm font-semibold leading-none',
                  entry.rank === 1 && 'bg-brand text-brand-contrast',
                  entry.rank > 1 && entry.rank <= 3 && 'bg-surface-sunken text-ink',
                  entry.rank > 3 && 'bg-surface-muted text-ink-muted',
                )}
                aria-label={`Rank ${entry.rank}`}
              >
                {entry.rank === 1 ? (
                  <Crown className="size-3.5" aria-hidden="true" />
                ) : entry.rank <= 3 ? (
                  <Medal className="size-3.5" aria-hidden="true" />
                ) : (
                  entry.rank
                )}
              </span>

              <div className="min-w-0 space-y-1.5">
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="truncate text-sm font-medium leading-5 text-ink">
                    {entry.displayName}
                  </p>
                  {isSelf ? (
                    <Badge tone="neutral">you</Badge>
                  ) : null}
                  {entry.isLeader ? (
                    <Badge tone="outline">leader</Badge>
                  ) : null}
                </div>

                <div className="h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                  <div
                    className={clsx(
                      'h-full rounded-full',
                      entry.rank === 1 ? 'bg-brand' : 'bg-accent',
                    )}
                    style={{ width: `${entry.synced ? barWidth : 0}%` }}
                  />
                </div>

                <p className="text-xs leading-4 text-ink-muted">
                  {entry.synced
                    ? `${entry.percent.toFixed(0)}% memorized`
                    : 'Not synced yet'}
                  {entry.synced && entry.needsReviewCount > 0
                    ? ` · ${entry.needsReviewCount} Needs Review`
                    : null}
                </p>

                {entry.badges.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {entry.badges.map((badge) => (
                      <Badge
                        key={badge.id}
                        tone={
                          badge.id === 'collection-crown'
                            ? 'accent'
                            : badge.id.startsWith('king-of-')
                              ? 'warning'
                              : 'success'
                        }
                        title={badge.description}
                      >
                        {badge.label}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col items-end gap-0.5 pt-0.5 text-right">
                <p className="font-serif text-3xl font-semibold leading-none tracking-tight tabular-nums text-ink sm:text-4xl">
                  {entry.synced ? entry.memorizedCount : '—'}
                  <span className="ml-0.5 text-base font-normal text-ink-muted sm:text-lg">
                    /{entry.total}
                  </span>
                </p>
                <p
                  className={clsx(
                    'text-xs leading-4 tabular-nums',
                    entry.weeklyDelta > 0
                      ? 'font-medium text-success'
                      : 'text-ink-subtle',
                  )}
                >
                  {entry.synced
                    ? entry.weeklyDelta > 0
                      ? `+${entry.weeklyDelta} this week`
                      : '±0 this week'
                    : '—'}
                </p>
              </div>
            </div>
          );

          return (
            <li
              key={entry.uid}
              className={clsx(
                'rounded-lg border border-line p-3',
                entry.rank === 1 && 'border-brand/30 bg-brand-soft/35',
              )}
            >
              <Link
                to={
                  isSelf
                    ? '/progress-chart'
                    : `/friends/${entry.uid}/progress-chart`
                }
                className="block outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
              >
                {body}
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

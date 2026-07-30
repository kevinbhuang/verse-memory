import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { ButtonLink } from '@/components/ui/Button';
import { LoadingState, EmptyState } from '@/components/ui/EmptyState';
import { LibraryProgressStrip } from '@/features/library/LibraryProgressStrip';
import { ProgressChart } from '@/features/library/ProgressChart';
import { useAuth } from '@/hooks/useAuth';
import { getUserProfile } from '@/services/social/profileService';
import {
  readPublicProgressSummary,
  summaryToProgressMap,
  type PublicProgressSummary,
} from '@/services/social/publicProgressService';
import { canViewPublicProgress } from '@/services/social/groupService';
import { formatTimeAgo } from '@/utils/format';

/**
 * Read-only Progress Chart for a fellow group member (cloud summary only).
 */
export function FriendProgressChartPage() {
  const { friendUid } = useParams<{ friendUid: string }>();
  const { configured, user, loading: authLoading } = useAuth();
  const [summary, setSummary] = useState<PublicProgressSummary | null>(null);
  const [friendName, setFriendName] = useState<string>('Friend');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!configured || !user) {
      setLoading(false);
      setError('Sign in with Google to view a group member’s Progress Chart.');
      return;
    }
    if (!friendUid) {
      setLoading(false);
      setError('Missing member id.');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const allowed = await canViewPublicProgress(friendUid, user.uid);
        if (!allowed) {
          throw new Error(
            'You don’t have access to this chart yet. Open Join a Group once (as the group creator if you lead it), then try again. Both of you also need to be active members of the same group.',
          );
        }
        const [profile, nextSummary] = await Promise.all([
          getUserProfile(friendUid),
          readPublicProgressSummary(friendUid),
        ]);
        if (cancelled) return;
        setFriendName(
          profile?.displayName ?? profile?.email ?? 'Friend',
        );
        if (!nextSummary) {
          throw new Error(
            'They haven’t synced a shareable chart yet. Ask them to open the app while online.',
          );
        }
        setSummary(nextSummary);
      } catch (err) {
        if (cancelled) return;
        setSummary(null);
        setError(
          err instanceof Error ? err.message : 'Could not load this chart.',
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, configured, friendUid, user]);

  const progressById = useMemo(
    () => (summary ? summaryToProgressMap(summary) : new Map()),
    [summary],
  );

  if (authLoading || loading) {
    return <LoadingState label="Loading their Progress Chart…" />;
  }

  if (error || !summary) {
    return (
      <>
        <PageHeader title="Member’s Progress Chart" />
        <div className="card">
          <EmptyState
            title="Can’t open this chart"
            description={error ?? 'Something went wrong.'}
            action={
              <ButtonLink to="/friends" variant="secondary">
                Back to Join a Group
              </ButtonLink>
            }
          />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={`${friendName}’s Progress Chart`}
        description={
          <>
            Read-only view · Last updated{' '}
            {formatTimeAgo(summary.updatedAt)}
            {' · '}
            <Link to="/friends" className="text-accent hover:underline">
              Groups
            </Link>
          </>
        }
        className="mb-2 flex flex-wrap items-end justify-between gap-3"
      />

      <LibraryProgressStrip
        memorized={summary.memorizedCount}
        total={summary.total}
        percentMemorized={
          summary.total === 0
            ? 0
            : (summary.memorizedCount / summary.total) * 100
        }
        className="mb-2"
      />

      <ProgressChart progressById={progressById} readOnly />
    </>
  );
}

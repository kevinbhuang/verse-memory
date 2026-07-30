import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { onGroupMembershipChanged } from '@/lib/groupMembershipEvents';
import { listMyGroupMemberships } from '@/services/social/groupService';

/**
 * Whether the signed-in user has an active or pending group membership
 * (drives “Join a Group” vs “View Groups” nav copy).
 */
export function useJoinedGroups(): {
  hasJoinedGroup: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const { configured, user, loading: authLoading } = useAuth();
  const [hasJoinedGroup, setHasJoinedGroup] = useState(false);
  const [loading, setLoading] = useState(configured);

  const refresh = useCallback(async () => {
    if (!configured || !user) {
      setHasJoinedGroup(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const mine = await listMyGroupMemberships(user.uid);
      setHasJoinedGroup(
        mine.some(
          (item) => item.status === 'active' || item.status === 'pending',
        ),
      );
    } catch {
      // Keep last known value on transient errors.
    } finally {
      setLoading(false);
    }
  }, [configured, user]);

  useEffect(() => {
    if (authLoading) return;
    void refresh();
  }, [authLoading, refresh]);

  useEffect(() => onGroupMembershipChanged(() => void refresh()), [refresh]);

  return { hasJoinedGroup, loading, refresh };
}

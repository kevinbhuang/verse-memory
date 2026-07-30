import { PageHeader } from '@/components/layout/PageHeader';
import { GroupsCard } from '@/features/friends/GroupsCard';
import { useJoinedGroups } from '@/hooks/useJoinedGroups';

/**
 * Groups hub: create / join with a code, or view your leaderboard when already in.
 */
export function FriendsPage() {
  const { hasJoinedGroup } = useJoinedGroups();

  return (
    <>
      <PageHeader
        title={hasJoinedGroup ? 'Your Groups' : 'Join a Group'}
        description={
          hasJoinedGroup
            ? 'See your group leaderboard, goals, and crowns. Join the A2N group above anytime, or create/join another below.'
            : 'Join the A2N Verse Memory Group with one tap (no code), or create your own group and share a code.'
        }
      />
      <GroupsCard />
    </>
  );
}

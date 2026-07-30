import { PageHeader } from '@/components/layout/PageHeader';
import { GroupsCard } from '@/features/friends/GroupsCard';

/**
 * Groups hub: create a group (access code), join with a code, leader approves.
 */
export function FriendsPage() {
  return (
    <>
      <PageHeader
        title="Join a Group"
        description="Create a group to get an access code, or join with a code. The group creator approves who gets in — then everyone can see names, memorized counts, and read-only Progress Charts."
      />
      <GroupsCard />
    </>
  );
}

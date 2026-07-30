import { PageHeader } from '@/components/layout/PageHeader';
import { FriendsCard } from '@/features/friends/FriendsCard';

/**
 * Friends hub: invite by email, approve requests, view shared progress.
 */
export function FriendsPage() {
  return (
    <>
      <PageHeader
        title="Add Friends"
        description="Invite someone by Google email, approve requests, and view their Progress Chart."
      />
      <FriendsCard />
    </>
  );
}

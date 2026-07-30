import { useCallback, useEffect, useState } from 'react';
import { Copy, LoaderCircle, LogIn, Users } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Field, TextInput } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/hooks/useAuth';
import type { UserProfile } from '@/services/social/profileService';
import {
  approveJoinRequest,
  cancelJoinRequest,
  createGroup,
  leaveGroup,
  listActiveGroupMembers,
  listMyGroupMemberships,
  listPendingJoinRequests,
  rejectJoinRequest,
  repairGroupChartAccess,
  requestJoinWithCode,
  type GroupMembershipIndex,
  type GroupMember,
} from '@/services/social/groupService';

function displayLabel(profile: UserProfile | null): string {
  if (profile?.displayName) return profile.displayName;
  if (profile?.email) return profile.email;
  return 'Someone';
}

type MemberRow = {
  member: GroupMember;
  profile: UserProfile | null;
  memorizedCount: number | null;
  needsReviewCount: number | null;
  total: number | null;
};

/**
 * Create / join memory groups via access code; leader approves joiners.
 */
export function GroupsCard() {
  const { configured, user, loading: authLoading } = useAuth();
  const { notify } = useToast();
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [memberships, setMemberships] = useState<GroupMembershipIndex[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [pending, setPending] = useState<
    Array<{ member: GroupMember; profile: UserProfile | null }>
  >([]);
  const [members, setMembers] = useState<MemberRow[]>([]);

  const selected = memberships.find((m) => m.groupId === selectedGroupId) ?? null;
  const isLeader = selected?.role === 'leader' && selected.status === 'active';

  const reload = useCallback(
    async (focusGroupId?: string | null) => {
      if (!user) return;
      setLoading(true);
      try {
        const mine = await listMyGroupMemberships(user.uid);
        setMemberships(mine);
        const preferred =
          (focusGroupId &&
            mine.find((m) => m.groupId === focusGroupId)?.groupId) ||
          (selectedGroupId &&
            mine.find(
              (m) =>
                m.groupId === selectedGroupId &&
                (m.status === 'active' || m.status === 'pending'),
            )?.groupId) ||
          mine.find((m) => m.status === 'active')?.groupId ||
          mine.find((m) => m.status === 'pending')?.groupId ||
          null;
        setSelectedGroupId(preferred);

        if (preferred) {
          const active = mine.find((m) => m.groupId === preferred);
          if (active?.status === 'active') {
            await repairGroupChartAccess(preferred, user.uid).catch(() => undefined);
            const [memberRows, pendingRows] = await Promise.all([
              listActiveGroupMembers(preferred),
              active.role === 'leader'
                ? listPendingJoinRequests(preferred)
                : Promise.resolve([]),
            ]);
            setMembers(memberRows);
            setPending(pendingRows);
          } else {
            setMembers([]);
            setPending([]);
          }
        } else {
          setMembers([]);
          setPending([]);
        }
      } catch (error) {
        notify(
          error instanceof Error ? error.message : 'Could not load groups.',
          'error',
        );
      } finally {
        setLoading(false);
      }
    },
    [notify, selectedGroupId, user],
  );

  useEffect(() => {
    if (user) void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per signed-in user
  }, [user?.uid]);

  const onCreate = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const group = await createGroup(user.uid, groupName);
      setGroupName('');
      notify(`Group created. Share code ${group.accessCode}.`, 'success');
      await reload(group.id);
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Could not create group.',
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  const onJoin = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const { group } = await requestJoinWithCode(user.uid, joinCode);
      setJoinCode('');
      notify(
        `Requested to join “${group.name}”. Wait for the creator to approve.`,
        'success',
      );
      await reload(group.id);
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Could not join group.',
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      notify('Access code copied.', 'success');
    } catch {
      notify(`Access code: ${code}`, 'success');
    }
  };

  if (!configured) {
    return (
      <Card>
        <CardHeader title="Groups" />
        <CardBody className="text-sm text-ink-muted">
          Sign-in isn’t configured, so groups aren’t available.
        </CardBody>
      </Card>
    );
  }

  if (authLoading) {
    return (
      <Card>
        <CardHeader title="Groups" />
        <CardBody className="flex items-center gap-2 text-sm text-ink-muted">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          Checking account…
        </CardBody>
      </Card>
    );
  }

  if (!user) {
    return (
      <Card>
        <CardHeader
          title="Groups"
          description="Create a group, share an access code, and approve people who want to join."
        />
        <CardBody className="text-sm text-ink-muted">
          Sign in with Google (top right) to create or join a group.
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Create a group"
            description="You’ll get an access code to share. You’re the group leader."
          />
          <CardBody className="space-y-3">
            <Field label="Group name" htmlFor="group-name">
              <TextInput
                id="group-name"
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
                placeholder="e.g. Sunday class"
                disabled={busy}
                maxLength={60}
              />
            </Field>
            <Button
              variant="primary"
              disabled={busy || groupName.trim().length < 2}
              onClick={() => void onCreate()}
            >
              <Users className="size-3.5" aria-hidden="true" />
              Create group
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Join with a code"
            description="Enter the access code from your group leader."
          />
          <CardBody className="space-y-3">
            <Field label="Access code" htmlFor="join-code">
              <TextInput
                id="join-code"
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value)}
                placeholder="e.g. AB12CD"
                disabled={busy}
                autoCapitalize="characters"
                spellCheck={false}
              />
            </Field>
            <Button
              variant="secondary"
              disabled={busy || joinCode.trim().length < 4}
              onClick={() => void onJoin()}
            >
              <LogIn className="size-3.5" aria-hidden="true" />
              Request to join
            </Button>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              Your groups
              {pending.length > 0 && isLeader ? (
                <Badge tone="accent">{pending.length} pending</Badge>
              ) : null}
            </span>
          }
          description="After you’re approved, you’ll see each member’s name and memorized count — tap to open their Progress Chart."
        />
        <CardBody className="space-y-5">
          {loading ? (
            <p className="inline-flex items-center gap-2 text-sm text-ink-muted">
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              Loading…
            </p>
          ) : memberships.filter(
              (m) => m.status === 'active' || m.status === 'pending',
            ).length === 0 ? (
            <p className="text-sm text-ink-muted">
              No groups yet. Create one or join with a code above.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {memberships
                  .filter(
                    (m) => m.status === 'active' || m.status === 'pending',
                  )
                  .map((m) => (
                    <Button
                      key={m.groupId}
                      size="sm"
                      variant={
                        m.groupId === selectedGroupId ? 'primary' : 'secondary'
                      }
                      disabled={busy}
                      onClick={() => {
                        setSelectedGroupId(m.groupId);
                        void (async () => {
                          setLoading(true);
                          try {
                            if (m.status === 'active') {
                              await repairGroupChartAccess(
                                m.groupId,
                                user.uid,
                              ).catch(() => undefined);
                              const [memberRows, pendingRows] =
                                await Promise.all([
                                  listActiveGroupMembers(m.groupId),
                                  m.role === 'leader'
                                    ? listPendingJoinRequests(m.groupId)
                                    : Promise.resolve([]),
                                ]);
                              setMembers(memberRows);
                              setPending(pendingRows);
                            } else {
                              setMembers([]);
                              setPending([]);
                            }
                          } catch (error) {
                            notify(
                              error instanceof Error
                                ? error.message
                                : 'Could not load group.',
                              'error',
                            );
                          } finally {
                            setLoading(false);
                          }
                        })();
                      }}
                    >
                      {m.name}
                      {m.status === 'pending' ? ' (pending)' : null}
                      {m.role === 'leader' ? ' · leader' : null}
                    </Button>
                  ))}
              </div>

              {selected ? (
                <div className="space-y-4">
                  {selected.status === 'active' ? (
                    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface-muted px-3 py-2 text-sm">
                      <span className="text-ink-muted">Access code</span>
                      <span className="font-mono font-semibold tracking-wider text-ink">
                        {selected.accessCode}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void copyCode(selected.accessCode)}
                      >
                        <Copy className="size-3.5" aria-hidden="true" />
                        Copy
                      </Button>
                      {selected.role === 'member' ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-auto"
                          disabled={busy}
                          onClick={() => {
                            setBusy(true);
                            void leaveGroup(selected.groupId, user.uid)
                              .then(() => {
                                notify('Left the group.', 'success');
                                return reload();
                              })
                              .catch((error: unknown) =>
                                notify(
                                  error instanceof Error
                                    ? error.message
                                    : 'Could not leave.',
                                  'error',
                                ),
                              )
                              .finally(() => setBusy(false));
                          }}
                        >
                          Leave group
                        </Button>
                      ) : null}
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
                      Waiting for the group creator to approve you.
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => {
                          setBusy(true);
                          void cancelJoinRequest(selected.groupId, user.uid)
                            .then(() => {
                              notify('Join request cancelled.', 'success');
                              return reload();
                            })
                            .catch((error: unknown) =>
                              notify(
                                error instanceof Error
                                  ? error.message
                                  : 'Could not cancel.',
                                'error',
                              ),
                            )
                            .finally(() => setBusy(false));
                        }}
                      >
                        Cancel request
                      </Button>
                    </div>
                  )}

                  {isLeader && pending.length > 0 ? (
                    <section className="space-y-2">
                      <h3 className="text-sm font-semibold text-ink">
                        Join requests
                      </h3>
                      <ul className="space-y-2">
                        {pending.map(({ member, profile }) => (
                          <li
                            key={member.uid}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2"
                          >
                            <span className="text-sm text-ink">
                              {displayLabel(profile)}
                              {profile?.email ? (
                                <span className="text-ink-muted">
                                  {' '}
                                  · {profile.email}
                                </span>
                              ) : null}
                            </span>
                            <span className="flex gap-2">
                              <Button
                                variant="primary"
                                size="sm"
                                disabled={busy}
                                onClick={() => {
                                  setBusy(true);
                                  void approveJoinRequest(
                                    selected.groupId,
                                    user.uid,
                                    member.uid,
                                  )
                                    .then(() => {
                                      notify('Approved.', 'success');
                                      return reload();
                                    })
                                    .catch((error: unknown) =>
                                      notify(
                                        error instanceof Error
                                          ? error.message
                                          : 'Approve failed.',
                                        'error',
                                      ),
                                    )
                                    .finally(() => setBusy(false));
                                }}
                              >
                                Approve
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={busy}
                                onClick={() => {
                                  setBusy(true);
                                  void rejectJoinRequest(
                                    selected.groupId,
                                    user.uid,
                                    member.uid,
                                  )
                                    .then(() => {
                                      notify('Rejected.', 'success');
                                      return reload();
                                    })
                                    .catch((error: unknown) =>
                                      notify(
                                        error instanceof Error
                                          ? error.message
                                          : 'Reject failed.',
                                        'error',
                                      ),
                                    )
                                    .finally(() => setBusy(false));
                                }}
                              >
                                Reject
                              </Button>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  {selected.status === 'active' ? (
                    <section className="space-y-2">
                      <h3 className="text-sm font-semibold text-ink">
                        Members
                      </h3>
                      {members.length === 0 ? (
                        <p className="text-sm text-ink-muted">
                          No active members yet.
                        </p>
                      ) : (
                        <ul className="space-y-2">
                          {members.map(
                            ({
                              member,
                              profile,
                              memorizedCount,
                              needsReviewCount,
                              total,
                            }) => {
                              const name = displayLabel(profile);
                              const countLabel =
                                memorizedCount === null || total === null
                                  ? 'Chart not synced yet'
                                  : `${memorizedCount} of ${total} memorized`;
                              const isSelf = member.uid === user.uid;
                              return (
                                <li
                                  key={member.uid}
                                  className="rounded-lg border border-line"
                                >
                                  {isSelf ? (
                                    <div className="px-3 py-2.5">
                                      <p className="font-medium text-ink">
                                        {name}
                                        <span className="ml-1 text-xs font-normal text-ink-muted">
                                          (you
                                          {member.role === 'leader'
                                            ? ' · leader'
                                            : ''}
                                          )
                                        </span>
                                      </p>
                                      <p className="text-xs text-ink-muted">
                                        {countLabel}
                                        {needsReviewCount != null &&
                                        needsReviewCount > 0
                                          ? ` · ${needsReviewCount} Needs Review`
                                          : null}
                                      </p>
                                    </div>
                                  ) : (
                                    <ButtonLink
                                      to={`/friends/${member.uid}/progress-chart`}
                                      variant="ghost"
                                      size="md"
                                      className="w-full justify-start rounded-lg px-3 py-2.5 text-left hover:bg-surface-muted"
                                    >
                                      <span className="flex min-w-0 flex-col items-start gap-0.5">
                                        <span className="truncate font-medium text-ink">
                                          {name}
                                          {member.role === 'leader' ? (
                                            <span className="ml-1 text-xs font-normal text-ink-muted">
                                              · leader
                                            </span>
                                          ) : null}
                                        </span>
                                        <span className="text-xs font-normal text-ink-muted">
                                          {countLabel}
                                          {needsReviewCount != null &&
                                          needsReviewCount > 0
                                            ? ` · ${needsReviewCount} Needs Review`
                                            : null}
                                        </span>
                                      </span>
                                    </ButtonLink>
                                  )}
                                </li>
                              );
                            },
                          )}
                        </ul>
                      )}
                    </section>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

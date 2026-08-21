import { useCallback, useEffect, useState } from 'react';
import { Copy, LoaderCircle, LogIn, Pencil, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Field, TextInput } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { appConfig } from '@/config/app';
import { useAuth } from '@/hooks/useAuth';
import { notifyGroupMembershipChanged } from '@/lib/groupMembershipEvents';
import type { UserProfile } from '@/services/social/profileService';
import {
  approveJoinRequest,
  cancelJoinRequest,
  createGroup,
  getGroup,
  leaveGroup,
  listActiveGroupMembers,
  listMyGroupMemberships,
  listPendingJoinRequests,
  rejectJoinRequest,
  renameGroup,
  repairGroupChartAccess,
  requestJoinOfficialGroup,
  requestJoinWithCode,
  resolveOfficialGroup,
  setGroupGoal,
  type GroupMembershipIndex,
  type GroupMember,
  type MemoryGroup,
} from '@/services/social/groupService';
import type { PublicProgressSummary } from '@/services/social/publicProgressService';
import { GroupLeaderboard } from '@/features/friends/GroupLeaderboard';

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
  summary: PublicProgressSummary | null;
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
  const [selectedGroup, setSelectedGroup] = useState<MemoryGroup | null>(null);
  const [officialGroupId, setOfficialGroupId] = useState<string | null>(null);
  const [officialLookupDone, setOfficialLookupDone] = useState(false);
  const [pending, setPending] = useState<
    Array<{ member: GroupMember; profile: UserProfile | null }>
  >([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [goalBusy, setGoalBusy] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameBusy, setRenameBusy] = useState(false);

  const selected = memberships.find((m) => m.groupId === selectedGroupId) ?? null;
  const isLeader = selected?.role === 'leader' && selected.status === 'active';

  const reload = useCallback(
    async (focusGroupId?: string | null) => {
      if (!user) return;
      setLoading(true);
      try {
        const mine = await listMyGroupMemberships(user.uid);
        setMemberships(mine);
        notifyGroupMembershipChanged();
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
          const groupDoc = await getGroup(preferred).catch(() => null);
          setSelectedGroup(groupDoc);
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
          setSelectedGroup(null);
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

  useEffect(() => {
    setRenaming(false);
    setRenameValue('');
  }, [selectedGroupId]);

  useEffect(() => {
    if (!configured || authLoading || !user) {
      setOfficialGroupId(null);
      setOfficialLookupDone(false);
      return;
    }
    let cancelled = false;
    setOfficialLookupDone(false);
    void resolveOfficialGroup()
      .then((group) => {
        if (!cancelled) {
          setOfficialGroupId(group.id);
          setOfficialLookupDone(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOfficialGroupId(null);
          setOfficialLookupDone(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, configured, user]);

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

  const onJoinOfficial = async () => {
    if (!user) {
      notify('Sign in with Google (top right) to join the A2N group.', 'error');
      return;
    }
    setBusy(true);
    try {
      const { group } = await requestJoinOfficialGroup(user.uid);
      notify(
        `Requested to join “${group.name}”. Kevin will approve your request.`,
        'success',
      );
      await reload(group.id);
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Could not join the A2N group.',
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

  const officialMembership = officialGroupId
    ? memberships.find((m) => m.groupId === officialGroupId)
    : null;
  const officialJoined =
    officialMembership?.status === 'active' ||
    officialMembership?.status === 'pending';
  const isOfficialLeaderAccount =
    !!user?.email &&
    user.email.trim().toLowerCase() ===
      appConfig.officialGroup.leaderEmail.trim().toLowerCase();
  const officialNeedsSetup =
    officialLookupDone && !officialGroupId && isOfficialLeaderAccount;

  const officialJoinButton =
    officialNeedsSetup ? (
      <p className="text-xs text-ink-muted">
        To enable one-tap join, create a group named “
        {appConfig.officialGroup.preferredName}” (you’ll approve joiners).
      </p>
    ) : officialJoined ? null : (
      <Button
        variant="primary"
        size="md"
        disabled={
          busy || (!!user && loading) || (!!user && !officialLookupDone)
        }
        onClick={() => void onJoinOfficial()}
        className="shadow-sm"
      >
        {appConfig.officialGroup.buttonLabel}
      </Button>
    );

  if (!user) {
    return (
      <div className="space-y-4">
        {officialJoinButton}
        <Card>
          <CardHeader
            title="Groups"
            description="Create a group, share an access code, and approve people who want to join."
          />
          <CardBody className="text-sm text-ink-muted">
            Sign in with Google (top right) to create or join a group — or tap
            the A2N button above after signing in (no code needed).
          </CardBody>
        </Card>
      </div>
    );
  }

  const visibleMemberships = memberships.filter(
    (m) => m.status === 'active' || m.status === 'pending',
  );
  const hasJoinedGroup = visibleMemberships.length > 0;

  const createJoinForms = (
    <div
      className={
        hasJoinedGroup
          ? 'grid gap-4 sm:grid-cols-2'
          : 'grid gap-5 lg:grid-cols-2'
      }
    >
      <div className={hasJoinedGroup ? 'space-y-2' : undefined}>
        {hasJoinedGroup ? (
          <p className="text-sm font-medium text-ink">Create another group</p>
        ) : null}
        {hasJoinedGroup ? (
          <div className="space-y-2">
            <TextInput
              id="group-name"
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              placeholder="Group name"
              disabled={busy}
              maxLength={60}
              aria-label="Group name"
            />
            <Button
              variant="secondary"
              size="sm"
              disabled={busy || groupName.trim().length < 2}
              onClick={() => void onCreate()}
            >
              Create
            </Button>
          </div>
        ) : (
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
        )}
      </div>

      <div className={hasJoinedGroup ? 'space-y-2' : undefined}>
        {hasJoinedGroup ? (
          <p className="text-sm font-medium text-ink">Join with a code</p>
        ) : null}
        {hasJoinedGroup ? (
          <div className="space-y-2">
            <TextInput
              id="join-code"
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value)}
              placeholder="Access code"
              disabled={busy}
              autoCapitalize="characters"
              spellCheck={false}
              aria-label="Access code"
            />
            <Button
              variant="secondary"
              size="sm"
              disabled={busy || joinCode.trim().length < 4}
              onClick={() => void onJoin()}
            >
              Request to join
            </Button>
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );

  const groupTabs =
    visibleMemberships.length > 1 ? (
      <div
        role="tablist"
        aria-label="Your groups"
        className="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-line bg-surface-muted/40 px-2"
      >
        {visibleMemberships.map((m) => {
          const selected = m.groupId === selectedGroupId;
          return (
            <button
              key={m.groupId}
              type="button"
              role="tab"
              aria-selected={selected}
              disabled={busy}
              onClick={() => {
                void reload(m.groupId);
              }}
              className={
                selected
                  ? '-mb-px shrink-0 border-b-[3px] border-brand px-4 py-3 text-sm font-semibold text-ink'
                  : '-mb-px shrink-0 border-b-[3px] border-transparent px-4 py-3 text-sm font-medium text-ink-muted hover:text-ink'
              }
            >
              {m.name}
              {m.status === 'pending' ? (
                <span className="font-normal text-ink-subtle"> · pending</span>
              ) : null}
            </button>
          );
        })}
      </div>
    ) : null;

  const yourGroupsCard = (
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
        description={
          hasJoinedGroup
            ? 'Leaderboard, weekly progress, and crowns for your group.'
            : 'After you’re approved, you’ll see a leaderboard with memorized counts and crowns.'
        }
      />
      {groupTabs}
      <CardBody className="space-y-5">
        {loading ? (
          <p className="inline-flex items-center gap-2 text-sm text-ink-muted">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            Loading…
          </p>
        ) : !hasJoinedGroup ? (
          <p className="text-sm text-ink-muted">
            No groups yet. Create one or join with a code above.
          </p>
        ) : (
          <>
            {selected ? (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  {renaming && isLeader ? (
                    <form
                      className="flex flex-wrap items-end gap-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (!user || !selected) return;
                        setRenameBusy(true);
                        void renameGroup(
                          selected.groupId,
                          user.uid,
                          renameValue,
                        )
                          .then(async (next) => {
                            setSelectedGroup(next);
                            setRenaming(false);
                            notify(`Renamed to “${next.name}”.`, 'success');
                            await reload(selected.groupId);
                          })
                          .catch((error: unknown) =>
                            notify(
                              error instanceof Error
                                ? error.message
                                : 'Could not rename group.',
                              'error',
                            ),
                          )
                          .finally(() => setRenameBusy(false));
                      }}
                    >
                      <Field
                        label="Group name"
                        htmlFor="group-rename"
                        className="min-w-[12rem] flex-1"
                      >
                        <TextInput
                          id="group-rename"
                          value={renameValue}
                          onChange={(event) =>
                            setRenameValue(event.target.value)
                          }
                          maxLength={60}
                          disabled={renameBusy}
                          autoFocus
                        />
                      </Field>
                      <Button
                        type="submit"
                        size="sm"
                        variant="primary"
                        disabled={
                          renameBusy || renameValue.trim().length < 2
                        }
                      >
                        {renameBusy ? 'Saving…' : 'Save'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={renameBusy}
                        onClick={() => setRenaming(false)}
                      >
                        Cancel
                      </Button>
                    </form>
                  ) : (
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <h3 className="font-serif text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                        {selected.name}
                      </h3>
                      {selected.role === 'leader' ? (
                        <Badge tone="outline">leader</Badge>
                      ) : null}
                      {selected.status === 'pending' ? (
                        <Badge tone="accent">pending</Badge>
                      ) : null}
                      {isLeader ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-1.5"
                          title="Rename group"
                          onClick={() => {
                            setRenameValue(selected.name);
                            setRenaming(true);
                          }}
                        >
                          <Pencil className="size-3.5" aria-hidden="true" />
                          <span className="sr-only">Rename group</span>
                        </Button>
                      ) : null}
                    </div>
                  )}

                  {selected.status === 'active' ? (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-subtle">
                      <span className="inline-flex items-center gap-1.5">
                        <span>Code</span>
                        <span className="font-mono tracking-wider text-ink-muted">
                          {selected.accessCode}
                        </span>
                        <button
                          type="button"
                          onClick={() => void copyCode(selected.accessCode)}
                          className="inline-flex items-center gap-1 text-ink-muted underline-offset-2 hover:text-ink hover:underline"
                        >
                          <Copy className="size-3" aria-hidden="true" />
                          Copy
                        </button>
                      </span>
                      {selected.role === 'member' ? (
                        <button
                          type="button"
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
                          className="text-ink-muted underline-offset-2 hover:text-danger hover:underline disabled:opacity-50"
                        >
                          Leave group
                        </button>
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
                </div>

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
                  <GroupLeaderboard
                    members={members}
                    currentUid={user.uid}
                    group={selectedGroup}
                    isLeader={Boolean(isLeader)}
                    goalBusy={goalBusy}
                    onSaveGoal={async (goal) => {
                      if (!user || !selected) return;
                      setGoalBusy(true);
                      try {
                        const next = await setGroupGoal(
                          selected.groupId,
                          user.uid,
                          goal,
                        );
                        setSelectedGroup(next);
                        notify(
                          goal == null
                            ? 'Group goal cleared.'
                            : `Group goal set to ${goal}.`,
                          'success',
                        );
                      } catch (error) {
                        notify(
                          error instanceof Error
                            ? error.message
                            : 'Could not save goal.',
                          'error',
                        );
                      } finally {
                        setGoalBusy(false);
                      }
                    }}
                  />
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </CardBody>
    </Card>
  );

  return (
    <div className="space-y-5">
      {officialJoinButton}
      {hasJoinedGroup ? (
        <>
          {yourGroupsCard}
          <details className="rounded-lg border border-line bg-surface px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium text-ink-muted hover:text-ink">
              Create or join another group
            </summary>
            <div className="mt-3 border-t border-line pt-3">{createJoinForms}</div>
          </details>
        </>
      ) : (
        <>
          {createJoinForms}
          {yourGroupsCard}
        </>
      )}
    </div>
  );
}

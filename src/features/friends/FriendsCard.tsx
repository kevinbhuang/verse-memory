import { useCallback, useEffect, useState } from 'react';
import { LoaderCircle, UserPlus, Users } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Field, TextInput } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/hooks/useAuth';
import {
  getUserProfile,
  lookupUidByEmail,
  type UserProfile,
} from '@/services/social/profileService';
import {
  approveShareRequest,
  cancelShareRequest,
  declineShareRequest,
  listIncomingPending,
  listMyViewers,
  listOutgoingPending,
  listViewableOwners,
  revokeShareAccess,
  sendShareRequest,
  type ShareRequest,
} from '@/services/social/shareService';

function displayLabel(profile: UserProfile | null, _fallbackUid: string): string {
  if (profile?.displayName) return profile.displayName;
  if (profile?.email) return profile.email;
  return 'Someone';
}

/**
 * Friends: request / approve Progress Chart sharing (cloud-only).
 */
export function FriendsCard() {
  const { configured, user, loading: authLoading } = useAuth();
  const { notify } = useToast();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingLists, setLoadingLists] = useState(false);
  const [incoming, setIncoming] = useState<
    Array<{ request: ShareRequest; profile: UserProfile | null }>
  >([]);
  const [outgoing, setOutgoing] = useState<
    Array<{ request: ShareRequest; profile: UserProfile | null }>
  >([]);
  const [viewable, setViewable] = useState<
    Array<{
      ownerUid: string;
      profile: UserProfile | null;
      memorizedCount: number | null;
      needsReviewCount: number | null;
      total: number | null;
    }>
  >([]);
  const [viewers, setViewers] = useState<
    Array<{ viewerUid: string; profile: UserProfile | null }>
  >([]);
  const [confirmTarget, setConfirmTarget] = useState<{
    uid: string;
    profile: UserProfile | null;
  } | null>(null);

  const reload = useCallback(async () => {
    if (!user) return;
    setLoadingLists(true);
    try {
      const [inReqs, outReqs, owners, myViewers] = await Promise.all([
        listIncomingPending(user.uid),
        listOutgoingPending(user.uid),
        listViewableOwners(user.uid),
        listMyViewers(user.uid),
      ]);

      const incomingWithProfiles = await Promise.all(
        inReqs.map(async (request) => ({
          request,
          profile: await getUserProfile(request.fromUid),
        })),
      );
      const outgoingWithProfiles = await Promise.all(
        outReqs.map(async (request) => ({
          request,
          profile: await getUserProfile(request.toUid),
        })),
      );

      setIncoming(incomingWithProfiles);
      setOutgoing(outgoingWithProfiles);
      setViewable(
        owners.map((item) => ({
          ownerUid: item.ownerUid,
          profile: item.profile,
          memorizedCount: item.memorizedCount,
          needsReviewCount: item.needsReviewCount,
          total: item.total,
        })),
      );
      setViewers(
        myViewers.map((item) => ({
          viewerUid: item.viewerUid,
          profile: item.profile,
        })),
      );
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Could not load friends.',
        'error',
      );
    } finally {
      setLoadingLists(false);
    }
  }, [notify, user]);

  useEffect(() => {
    if (user) void reload();
  }, [reload, user]);

  const onLookup = async () => {
    if (!user) return;
    setBusy(true);
    setConfirmTarget(null);
    try {
      const hit = await lookupUidByEmail(email);
      if (!hit) {
        notify(
          'They haven’t signed in to Verse Memory yet. Ask them to sign in once, then try again.',
          'error',
        );
        return;
      }
      if (hit.uid === user.uid) {
        notify('That’s your own email.', 'error');
        return;
      }
      const profile = await getUserProfile(hit.uid);
      setConfirmTarget({ uid: hit.uid, profile });
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Lookup failed.',
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  const onSend = async () => {
    if (!user || !confirmTarget) return;
    setBusy(true);
    try {
      await sendShareRequest(user.uid, confirmTarget.uid);
      notify('Request sent. They’ll see it under Add Friends.', 'success');
      setEmail('');
      setConfirmTarget(null);
      await reload();
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Could not send request.',
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  if (!configured) {
    return (
      <Card>
        <CardHeader title="Friends" />
        <CardBody className="text-sm text-ink-muted">
          Sign-in isn’t configured, so progress sharing isn’t available.
        </CardBody>
      </Card>
    );
  }

  if (authLoading) {
    return (
      <Card>
        <CardHeader title="Friends" />
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
          title="Friends"
          description="Share Progress Charts with people you trust."
        />
        <CardBody className="text-sm text-ink-muted">
          Sign in with Google (above) to send and accept view requests.
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Users className="size-4" aria-hidden="true" />
            Friends
            {incoming.length > 0 ? (
              <Badge tone="accent">{incoming.length} pending</Badge>
            ) : null}
          </span>
        }
        description="Request to view someone’s progress. After they approve, you’ll see their name and memorized count here — tap to open their read-only Progress Chart."
      />
      <CardBody className="space-y-6">
        <div className="space-y-3">
          <Field
            label="Share progress with…"
            htmlFor="friend-email"
            hint="Use the exact Google email they sign in with."
          >
            <div className="flex flex-col gap-2 sm:flex-row">
              <TextInput
                id="friend-email"
                type="email"
                autoComplete="email"
                placeholder="friend@example.com"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setConfirmTarget(null);
                }}
                disabled={busy}
              />
              <Button
                variant="secondary"
                disabled={busy || !email.trim()}
                onClick={() => void onLookup()}
                className="shrink-0"
              >
                <UserPlus className="size-3.5" aria-hidden="true" />
                Look up
              </Button>
            </div>
          </Field>

          {confirmTarget ? (
            <div className="rounded-lg border border-line bg-surface-muted px-4 py-3">
              <p className="text-sm text-ink">
                Send a view request to{' '}
                <span className="font-medium">
                  {displayLabel(confirmTarget.profile, confirmTarget.uid)}
                </span>
                {confirmTarget.profile?.email ? (
                  <span className="text-ink-muted">
                    {' '}
                    ({confirmTarget.profile.email})
                  </span>
                ) : null}
                ?
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  disabled={busy}
                  onClick={() => void onSend()}
                >
                  Send request
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => setConfirmTarget(null)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        {loadingLists ? (
          <p className="inline-flex items-center gap-2 text-sm text-ink-muted">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            Loading…
          </p>
        ) : (
          <>
            {incoming.length > 0 ? (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-ink">
                  Incoming requests
                </h3>
                <ul className="space-y-2">
                  {incoming.map(({ request, profile }) => (
                    <li
                      key={request.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2"
                    >
                      <span className="text-sm text-ink">
                        {displayLabel(profile, request.fromUid)}
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
                            void approveShareRequest(request.id, user.uid)
                              .then(() => {
                                notify('Approved. They can view your chart.', 'success');
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
                            void declineShareRequest(request.id, user.uid)
                              .then(() => {
                                notify('Declined.', 'success');
                                return reload();
                              })
                              .catch((error: unknown) =>
                                notify(
                                  error instanceof Error
                                    ? error.message
                                    : 'Decline failed.',
                                  'error',
                                ),
                              )
                              .finally(() => setBusy(false));
                          }}
                        >
                          Decline
                        </Button>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {outgoing.length > 0 ? (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-ink">
                  Outgoing requests
                </h3>
                <ul className="space-y-2">
                  {outgoing.map(({ request, profile }) => (
                    <li
                      key={request.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2"
                    >
                      <span className="text-sm text-ink">
                        Waiting on {displayLabel(profile, request.toUid)}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => {
                          setBusy(true);
                          void cancelShareRequest(request.id, user.uid)
                            .then(() => {
                              notify('Request cancelled.', 'success');
                              return reload();
                            })
                            .catch((error: unknown) =>
                              notify(
                                error instanceof Error
                                  ? error.message
                                  : 'Cancel failed.',
                                'error',
                              ),
                            )
                            .finally(() => setBusy(false));
                        }}
                      >
                        Cancel
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-ink">
                Friends’ progress
              </h3>
              {viewable.length === 0 ? (
                <p className="text-sm text-ink-muted">
                  None yet. Send a request above after they sign in once.
                </p>
              ) : (
                <ul className="space-y-2">
                  {viewable.map(
                    ({
                      ownerUid,
                      profile,
                      memorizedCount,
                      needsReviewCount,
                      total,
                    }) => {
                      const name = displayLabel(profile, ownerUid);
                      const countLabel =
                        memorizedCount === null || total === null
                          ? 'Chart not synced yet'
                          : `${memorizedCount} of ${total} memorized`;
                      return (
                        <li
                          key={ownerUid}
                          className="flex flex-wrap items-stretch gap-2 rounded-lg border border-line"
                        >
                          <ButtonLink
                            to={`/friends/${ownerUid}/progress-chart`}
                            variant="ghost"
                            size="md"
                            className="min-w-0 flex-1 justify-start rounded-lg px-3 py-2.5 text-left hover:bg-surface-muted"
                          >
                            <span className="flex min-w-0 flex-col items-start gap-0.5">
                              <span className="truncate font-medium text-ink">
                                {name}
                              </span>
                              <span className="text-xs font-normal text-ink-muted">
                                {countLabel}
                                {needsReviewCount != null && needsReviewCount > 0
                                  ? ` · ${needsReviewCount} Needs Review`
                                  : null}
                              </span>
                            </span>
                          </ButtonLink>
                          <div className="flex items-center pr-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={busy}
                              onClick={() => {
                                setBusy(true);
                                void revokeShareAccess({
                                  ownerUid,
                                  viewerUid: user.uid,
                                  actingUid: user.uid,
                                })
                                  .then(() => {
                                    notify('Access removed.', 'success');
                                    return reload();
                                  })
                                  .catch((error: unknown) =>
                                    notify(
                                      error instanceof Error
                                        ? error.message
                                        : 'Could not remove access.',
                                      'error',
                                    ),
                                  )
                                  .finally(() => setBusy(false));
                              }}
                            >
                              Remove
                            </Button>
                          </div>
                        </li>
                      );
                    },
                  )}
                </ul>
              )}
            </section>

            {viewers.length > 0 ? (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-ink">
                  People who can view your chart
                </h3>
                <ul className="space-y-2">
                  {viewers.map(({ viewerUid, profile }) => (
                    <li
                      key={viewerUid}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2"
                    >
                      <span className="text-sm text-ink">
                        {displayLabel(profile, viewerUid)}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => {
                          setBusy(true);
                          void revokeShareAccess({
                            ownerUid: user.uid,
                            viewerUid,
                            actingUid: user.uid,
                          })
                            .then(() => {
                              notify('Access revoked.', 'success');
                              return reload();
                            })
                            .catch((error: unknown) =>
                              notify(
                                error instanceof Error
                                  ? error.message
                                  : 'Could not revoke.',
                                'error',
                              ),
                            )
                            .finally(() => setBusy(false));
                        }}
                      >
                        Revoke
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        )}
      </CardBody>
    </Card>
  );
}

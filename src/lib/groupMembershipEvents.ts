type Listener = () => void;

const listeners = new Set<Listener>();

/** Notify nav / other UI that group membership list may have changed. */
export function notifyGroupMembershipChanged(): void {
  for (const listener of listeners) listener();
}

export function onGroupMembershipChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

type Listener = () => void;

const listeners = new Set<Listener>();

/** Fired after local progress/settings data changes in a way worth syncing. */
export function notifyLocalDataChanged(): void {
  for (const listener of listeners) listener();
}

export function onLocalDataChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

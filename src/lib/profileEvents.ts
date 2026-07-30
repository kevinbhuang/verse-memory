/** Fired when the signed-in user updates their public profile (e.g. display name). */
const PROFILE_CHANGED = 'verse-memory:profile-changed';

export function notifyProfileChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(PROFILE_CHANGED));
}

export function subscribeProfileChanged(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  window.addEventListener(PROFILE_CHANGED, listener);
  return () => window.removeEventListener(PROFILE_CHANGED, listener);
}

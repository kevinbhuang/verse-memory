import { useEffect } from 'react';

export type HotkeyMap = Record<string, (event: KeyboardEvent) => void>;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return (
    tag === 'input' ||
    tag === 'textarea' ||
    tag === 'select' ||
    target.isContentEditable
  );
}

/**
 * Registers review shortcuts.
 *
 * Shortcuts are suppressed while the reader is typing in a field, except for
 * Escape, which always needs to work.
 */
export function useHotkeys(
  map: HotkeyMap,
  { enabled = true }: { enabled?: boolean } = {},
): void {
  useEffect(() => {
    if (!enabled) return;

    const handler = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const key = event.key === ' ' ? 'space' : event.key.toLowerCase();
      const handlerForKey = map[key];
      if (!handlerForKey) return;

      if (key !== 'escape' && isTypingTarget(event.target)) return;

      event.preventDefault();
      handlerForKey(event);
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [map, enabled]);
}

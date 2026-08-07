import { useEffect } from 'react';

export type HotkeyMap = Record<string, (event: KeyboardEvent) => void>;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  if (tag === 'textarea') {
    const field = target as HTMLTextAreaElement;
    return !field.disabled && !field.readOnly;
  }
  if (tag === 'input') {
    const field = target as HTMLInputElement;
    if (field.disabled || field.readOnly) return false;
    // Checkboxes/radios/buttons are not typing surfaces — shortcuts may run.
    const type = (field.type || 'text').toLowerCase();
    return !['checkbox', 'radio', 'button', 'submit', 'reset', 'file'].includes(
      type,
    );
  }
  return tag === 'select' || target.isContentEditable;
}

/**
 * Registers keyboard shortcuts.
 *
 * Shortcuts are suppressed while the reader is typing in a field, except for
 * Escape (always) and any keys listed in `allowWhileTyping`.
 * Key-repeat events are ignored so holding Enter cannot skip feedback.
 */
export function useHotkeys(
  map: HotkeyMap,
  {
    enabled = true,
    allowWhileTyping = [],
  }: { enabled?: boolean; allowWhileTyping?: readonly string[] } = {},
): void {
  const allowKey = allowWhileTyping.join('\0');

  useEffect(() => {
    if (!enabled) return;

    const allowedWhileTyping = new Set(
      allowKey ? allowKey.split('\0').map((key) => key.toLowerCase()) : [],
    );

    const handler = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.repeat) return;

      const key = event.key === ' ' ? 'space' : event.key.toLowerCase();
      const handlerForKey = map[key];
      if (!handlerForKey) return;

      const typing =
        isTypingTarget(event.target) ||
        isTypingTarget(document.activeElement);
      if (typing && key !== 'escape' && !allowedWhileTyping.has(key)) return;

      event.preventDefault();
      handlerForKey(event);
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [map, enabled, allowKey]);
}

import { useEffect, type RefObject } from 'react';

/**
 * Focus an input after mount / dependency change, waiting until it is
 * enabled (avoids the race where rAF runs before React clears `disabled`).
 */
export function useAutofocus(
  ref: RefObject<HTMLElement | null>,
  deps: ReadonlyArray<unknown>,
  enabled = true,
): void {
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let attempts = 0;

    const focus = () => {
      if (cancelled) return;
      const el = ref.current;
      if (!el) {
        if (attempts < 20) {
          attempts += 1;
          window.requestAnimationFrame(focus);
        }
        return;
      }
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement ||
        el instanceof HTMLButtonElement
      ) {
        if (el.disabled) {
          if (attempts < 20) {
            attempts += 1;
            window.requestAnimationFrame(focus);
          }
          return;
        }
      }
      el.focus({ preventScroll: true });
    };

    // Double rAF: wait for React commit + layout after state resets.
    const outer = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(focus);
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(outer);
    };
    // Caller controls identity via deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional deps array
  }, [enabled, ref, ...deps]);
}

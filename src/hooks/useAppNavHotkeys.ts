import { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useHotkeys } from '@/hooks/useHotkeys';

const NAV_SHORTCUTS: Record<string, string> = {
  '1': '/flashcards',
  '2': '/verses',
  '3': '/progress-chart',
  '4': '/quiz',
  '5': '/print',
  '6': '/more',
  '7': '/dt-chapter-memory',
  '8': '/friends',
  // F / M / N / T / B are reserved on Flash Cards; use digits for those tabs.
  l: '/verses',
  c: '/progress-chart',
  q: '/quiz',
};

/**
 * Global tab shortcuts when not inside a focus-mode session.
 * Digits 1–8 and letters L / C / Q jump between primary tabs.
 * (F / M / N / T / B are reserved for Flash Cards actions.)
 */
export function useAppNavHotkeys() {
  const navigate = useNavigate();
  const location = useLocation();
  const focusMode =
    location.pathname.startsWith('/review/session') ||
    location.pathname.startsWith('/quiz/session') ||
    // DT chapter practice uses query params on the same route; suppress
    // digit/letter nav shortcuts so typing can’t jump away mid-session.
    (location.pathname.startsWith('/dt-chapter-memory') &&
      /[?&]practice=[^&]+/.test(location.search) &&
      /[?&]mode=(first-letter|flashcard)/.test(location.search));

  const hotkeys = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(NAV_SHORTCUTS).map(([key, path]) => [
          key,
          () => {
            if (location.pathname === path) return;
            navigate(path);
          },
        ]),
      ),
    [location.pathname, navigate],
  );

  useHotkeys(hotkeys, { enabled: !focusMode });
}

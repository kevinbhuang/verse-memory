import { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useHotkeys } from '@/hooks/useHotkeys';

const NAV_SHORTCUTS: Record<string, string> = {
  '1': '/flashcards',
  '2': '/verses',
  '3': '/practice',
  '4': '/quiz',
  '5': '/more',
  f: '/flashcards',
  l: '/verses',
  p: '/practice',
  q: '/quiz',
  m: '/more',
};

/**
 * Global tab shortcuts when not inside a focus-mode session.
 * Digits 1–5 and letters L / F / P / Q / M jump between primary tabs.
 */
export function useAppNavHotkeys() {
  const navigate = useNavigate();
  const location = useLocation();
  const focusMode =
    location.pathname.startsWith('/review/session') ||
    location.pathname.startsWith('/quiz/session');

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

import { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useHotkeys } from '@/hooks/useHotkeys';

const NAV_SHORTCUTS: Record<string, string> = {
  '1': '/verses',
  '2': '/practice',
  '3': '/quiz',
  '4': '/more',
  l: '/verses',
  p: '/practice',
  q: '/quiz',
  m: '/more',
};

/**
 * Global tab shortcuts when not inside a focus-mode session.
 * Digits 1–4 and letters L / P / Q / M jump to Library, Practice, Quiz, More.
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

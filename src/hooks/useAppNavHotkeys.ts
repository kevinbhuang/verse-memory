import { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useHotkeys } from '@/hooks/useHotkeys';

/**
 * Global tab shortcuts when not inside a focus-mode session.
 * Digits 1–9 and letters L / C / Q jump between primary tabs.
 * (F / M / N / T / B / P are reserved for Flash Cards / Custom Verses actions.)
 * Hotkey 8 (Add Custom Verses) is only active when signed in with Google.
 */
export function useAppNavHotkeys() {
  const navigate = useNavigate();
  const location = useLocation();
  const { configured, user } = useAuth();
  const showCustomVerses = Boolean(configured && user);

  const focusMode =
    location.pathname.startsWith('/review/session') ||
    location.pathname.startsWith('/quiz/session') ||
    // DT / custom practice or quiz uses query params on the same route.
    (location.pathname.startsWith('/dt-chapter-memory') &&
      /[?&]practice=[^&]+/.test(location.search) &&
      /[?&]mode=(first-letter|flashcard)/.test(location.search)) ||
    (location.pathname.startsWith('/custom-verses') &&
      ((/[?&]practice=[^&]+/.test(location.search) &&
        /[?&]mode=(first-letter|fill-blank)/.test(location.search)) ||
        /[?&]quiz=[^&]+/.test(location.search)));

  const hotkeys = useMemo(() => {
    const shortcuts: Record<string, string> = {
      '1': '/flashcards',
      '2': '/verses',
      '3': '/progress-chart',
      '4': '/quiz',
      '5': '/print',
      '6': '/more',
      '7': '/dt-chapter-memory',
      '9': '/friends',
      l: '/verses',
      c: '/progress-chart',
      q: '/quiz',
    };
    if (showCustomVerses) {
      shortcuts['8'] = '/custom-verses';
    }
    return Object.fromEntries(
      Object.entries(shortcuts).map(([key, path]) => [
        key,
        () => {
          if (location.pathname === path) return;
          navigate(path);
        },
      ]),
    );
  }, [location.pathname, navigate, showCustomVerses]);

  useHotkeys(hotkeys, { enabled: !focusMode });
}

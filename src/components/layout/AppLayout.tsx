import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { BookOpen, ClipboardList, Ellipsis, Repeat2 } from 'lucide-react';
import clsx from 'clsx';
import { appConfig } from '@/config/app';
import { useAppNavHotkeys } from '@/hooks/useAppNavHotkeys';
import { Footer } from './Footer';
import { UpdatePrompt } from './UpdatePrompt';

const NAV_ITEMS = [
  { to: '/verses', label: 'Library', icon: BookOpen, end: false },
  { to: '/practice', label: 'Practice', icon: Repeat2, end: false },
  { to: '/quiz', label: 'Quiz', icon: ClipboardList, end: false },
  { to: '/more', label: 'More', icon: Ellipsis, end: false },
];

export function AppLayout() {
  const location = useLocation();
  useAppNavHotkeys();
  // The active review / quiz screen is deliberately free of navigation chrome.
  const focusMode =
    location.pathname.startsWith('/review/session') ||
    location.pathname.startsWith('/quiz/session');

  if (focusMode) {
    return (
      <div className="min-h-full bg-paper">
        <UpdatePrompt />
        <Outlet />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-paper">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <UpdatePrompt />

      <div className="mx-auto flex w-full max-w-7xl">
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-line px-4 py-6 lg:block">
          <div className="px-2">
            <p className="font-serif text-lg leading-tight font-semibold text-ink">
              {appConfig.appName}
            </p>
            <p className="mt-1 text-xs leading-snug text-ink-muted">
              {appConfig.collectionTitle}
            </p>
          </div>

          <nav aria-label="Main" className="mt-8 space-y-0.5">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-accent-soft font-medium text-accent'
                      : 'text-ink-muted hover:bg-surface-muted hover:text-ink',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon
                      className="size-4 shrink-0"
                      aria-hidden="true"
                      strokeWidth={isActive ? 2.25 : 1.75}
                    />
                    {item.label}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur lg:hidden">
            <p className="font-serif text-base font-semibold text-ink">
              {appConfig.appName}
            </p>
          </header>

          <main id="main" className="flex-1 px-4 pt-5 pb-24 sm:px-6 lg:px-8 lg:pb-10">
            <Outlet />
          </main>

          <Footer />
        </div>
      </div>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <ul className="flex">
          {NAV_ITEMS.map((item) => (
            <li key={item.to} className="flex-1">
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  clsx(
                    'flex flex-col items-center gap-1 py-2.5 text-[0.6875rem]',
                    isActive ? 'text-accent' : 'text-ink-muted',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon
                      className="size-5"
                      aria-hidden="true"
                      strokeWidth={isActive ? 2.25 : 1.75}
                    />
                    {item.label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

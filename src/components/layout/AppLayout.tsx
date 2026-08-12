import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  BookMarked,
  BookOpen,
  ChartColumn,
  ClipboardList,
  Ellipsis,
  Layers,
  ListPlus,
  Printer,
  UserPlus,
  Users,
} from 'lucide-react';
import clsx from 'clsx';
import { appConfig } from '@/config/app';
import { useAppNavHotkeys } from '@/hooks/useAppNavHotkeys';
import { useAuth } from '@/hooks/useAuth';
import { useJoinedGroups } from '@/hooks/useJoinedGroups';
import { Footer } from './Footer';
import { AppBrand } from './AppBrand';
import { NavAccountControl } from './NavAccountControl';
import { UpdatePrompt } from './UpdatePrompt';

type NavItem = {
  to: string;
  label: string;
  shortLabel: string;
  icon: typeof Layers;
};

/** Main collection tabs — Print is the last item before the DT divider. */
const PRIMARY_NAV: NavItem[] = [
  {
    to: '/flashcards',
    label: 'Flash Cards',
    shortLabel: 'Cards',
    icon: Layers,
  },
  { to: '/verses', label: 'Library', shortLabel: 'Library', icon: BookOpen },
  {
    to: '/progress-chart',
    label: 'Progress Chart',
    shortLabel: 'Chart',
    icon: ChartColumn,
  },
  { to: '/quiz', label: 'Quiz', shortLabel: 'Quiz', icon: ClipboardList },
  { to: '/print', label: 'Print', shortLabel: 'Print', icon: Printer },
];

const DT_NAV: NavItem = {
  to: '/dt-chapter-memory',
  label: 'DT Chapter Memory',
  shortLabel: 'DT',
  icon: BookMarked,
};

const CUSTOM_NAV: NavItem = {
  to: '/custom-verses',
  label: 'Add Custom Verses',
  shortLabel: 'Custom',
  icon: ListPlus,
};

const MORE_NAV: NavItem = {
  to: '/more',
  label: 'More',
  shortLabel: 'More',
  icon: Ellipsis,
};

function navLinkClass(isActive: boolean, compact = false) {
  if (compact) {
    return clsx(
      'flex flex-col items-center gap-1 py-2.5 text-[0.6875rem]',
      isActive ? 'text-brand' : 'text-ink-muted',
    );
  }
  return clsx(
    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
    isActive
      ? 'bg-brand-soft font-medium text-brand'
      : 'text-ink-muted hover:bg-surface-muted hover:text-ink',
  );
}

function NavItemLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) => navLinkClass(isActive)}
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
  );
}

export function AppLayout() {
  const location = useLocation();
  const { configured, user } = useAuth();
  const { hasJoinedGroup } = useJoinedGroups();
  useAppNavHotkeys();
  const showCustomVerses = Boolean(configured && user);
  // The active review / quiz screen is deliberately free of navigation chrome.
  const focusMode =
    location.pathname.startsWith('/review/session') ||
    location.pathname.startsWith('/quiz/session') ||
    (location.pathname.startsWith('/dt-chapter-memory') &&
      /[?&]practice=[^&]+/.test(location.search) &&
      /[?&]mode=(first-letter|flashcard)/.test(location.search)) ||
    (location.pathname.startsWith('/custom-verses') &&
      ((/[?&]practice=[^&]+/.test(location.search) &&
        /[?&]mode=(first-letter|fill-blank)/.test(location.search)) ||
        /[?&]quiz=[^&]+/.test(location.search)));

  const groupsNav = hasJoinedGroup
    ? {
        to: '/friends',
        label: 'View Groups',
        shortLabel: 'Groups',
        icon: Users,
      }
    : {
        to: '/friends',
        label: 'Join a Group',
        shortLabel: 'Join',
        icon: UserPlus,
      };

  if (focusMode) {
    return (
      <div className="min-h-full bg-paper">
        <UpdatePrompt />
        <Outlet />
      </div>
    );
  }

  const mobileNav = [
    ...PRIMARY_NAV,
    DT_NAV,
    ...(showCustomVerses ? [CUSTOM_NAV] : []),
    MORE_NAV,
    groupsNav,
  ];

  return (
    <div className="min-h-full bg-paper">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <UpdatePrompt />

      <div className="mx-auto flex w-full max-w-7xl">
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line px-4 py-6 lg:flex">
          <div className="px-1">
            <AppBrand />
          </div>

          <nav aria-label="Main" className="mt-8 flex-1 space-y-0.5">
            {PRIMARY_NAV.map((item) => (
              <NavItemLink key={item.to} item={item} />
            ))}

            <div
              className="my-3 border-t border-line"
              role="separator"
              aria-hidden="true"
            />

            <NavItemLink item={DT_NAV} />
            {showCustomVerses ? <NavItemLink item={CUSTOM_NAV} /> : null}
            <NavItemLink item={MORE_NAV} />
          </nav>

          <nav
            aria-label="Groups"
            className="mt-auto border-t border-line pt-4"
          >
            <NavLink
              to={groupsNav.to}
              className={({ isActive }) => navLinkClass(isActive)}
            >
              {({ isActive }) => (
                <>
                  <groupsNav.icon
                    className="size-4 shrink-0"
                    aria-hidden="true"
                    strokeWidth={isActive ? 2.25 : 1.75}
                  />
                  {groupsNav.label}
                </>
              )}
            </NavLink>
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
            <div className="min-w-0 lg:hidden">
              <AppBrand compact />
            </div>
            <h1 className="hidden min-w-0 truncate font-serif text-xl font-semibold tracking-tight text-ink lg:block xl:text-2xl">
              {appConfig.collectionTitle}
            </h1>
            <div className="ml-auto flex shrink-0 justify-end">
              <NavAccountControl />
            </div>
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
        <ul className="flex overflow-x-auto">
          {mobileNav.map((item) => (
            <li key={item.to} className="min-w-[4.25rem] flex-1">
              <NavLink
                to={item.to}
                className={({ isActive }) => navLinkClass(isActive, true)}
              >
                {({ isActive }) => (
                  <>
                    <item.icon
                      className="size-5"
                      aria-hidden="true"
                      strokeWidth={isActive ? 2.25 : 1.75}
                    />
                    {item.shortLabel}
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

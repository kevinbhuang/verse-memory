import { useRegisterSW } from 'virtual:pwa-register/react';

const HOUR_MS = 60 * 60 * 1000;

/**
 * Registers the service worker in auto-update mode.
 * When Netlify deploys a new build, open tabs pick it up and reload
 * without asking the user to click anything. IndexedDB progress is kept.
 */
export function UpdatePrompt() {
  useRegisterSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      // Tabs left open for a long time still notice new deploys.
      window.setInterval(() => {
        void registration.update();
      }, HOUR_MS);
    },
    onRegisterError(error) {
      console.warn('Service worker registration failed', error);
    },
  });

  return null;
}

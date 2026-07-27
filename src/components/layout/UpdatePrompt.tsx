import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';

/**
 * A quiet banner offering the new version. Updating swaps the app shell only;
 * IndexedDB progress is untouched by a service-worker update.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.warn('Service worker registration failed', error);
    },
  });

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      className="sticky top-0 z-40 flex flex-wrap items-center justify-center gap-3 border-b border-accent/30 bg-accent-soft px-4 py-2 text-sm text-accent"
    >
      <span className="flex items-center gap-2">
        <RefreshCw className="size-4" aria-hidden="true" />
        A new version of the app is ready. Your progress is kept.
      </span>
      <span className="flex gap-2">
        <Button size="sm" variant="primary" onClick={() => void updateServiceWorker(true)}>
          Reload
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setNeedRefresh(false)}>
          Later
        </Button>
      </span>
    </div>
  );
}

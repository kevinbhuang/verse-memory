import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { CheckCircle2, Info, TriangleAlert } from 'lucide-react';

type ToastTone = 'info' | 'success' | 'error';

type Toast = {
  id: number;
  message: string;
  tone: ToastTone;
};

type ToastContextValue = {
  notify: (message: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const icons = {
  info: Info,
  success: CheckCircle2,
  error: TriangleAlert,
} as const;

const tones: Record<ToastTone, string> = {
  info: 'border-line-strong bg-surface text-ink',
  success: 'border-success/30 bg-success-soft text-success',
  error: 'border-danger/30 bg-danger-soft text-danger',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4000);
  }, []);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 sm:bottom-6"
      >
        {toasts.map((toast) => {
          const Icon = icons[toast.tone];
          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex max-w-md items-start gap-2 rounded-lg border px-3.5 py-2.5 text-sm shadow-md ${tones[toast.tone]}`}
            >
              <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{toast.message}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  // Falling back to a no-op keeps components usable in isolated unit tests.
  return context ?? { notify: () => undefined };
}

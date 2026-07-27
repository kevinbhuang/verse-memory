import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import clsx from 'clsx';

const control =
  'w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:opacity-60';

export function Field({
  label,
  hint,
  children,
  htmlFor,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <div className={clsx('space-y-1.5', className)}>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-ink"
      >
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
}

export const TextInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input ref={ref} className={clsx(control, className)} {...props} />
));
TextInput.displayName = 'TextInput';

export const TextArea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={clsx(control, 'min-h-24 resize-y', className)}
    {...props}
  />
));
TextArea.displayName = 'TextArea';

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select ref={ref} className={clsx(control, 'pr-8', className)} {...props} />
));
Select.displayName = 'Select';

export function Checkbox({
  label,
  description,
  className,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: ReactNode;
  description?: ReactNode;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className={clsx('flex items-start gap-2.5', className)}>
      <input
        id={inputId}
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 rounded border-line-strong text-accent accent-[var(--accent)]"
        {...props}
      />
      <label htmlFor={inputId} className="text-sm text-ink">
        {label}
        {description ? (
          <span className="mt-0.5 block text-xs text-ink-muted">
            {description}
          </span>
        ) : null}
      </label>
    </div>
  );
}

export function Toggle({
  label,
  description,
  checked,
  onChange,
  id,
}: {
  label: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <label htmlFor={inputId} className="text-sm text-ink">
        {label}
        {description ? (
          <span className="mt-0.5 block text-xs text-ink-muted">
            {description}
          </span>
        ) : null}
      </label>
      <button
        id={inputId}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors',
          checked
            ? 'border-accent bg-accent'
            : 'border-line-strong bg-surface-sunken',
        )}
      >
        <span className="sr-only">{checked ? 'On' : 'Off'}</span>
        <span
          aria-hidden="true"
          className={clsx(
            'absolute top-0.5 size-4.5 rounded-full bg-white shadow-sm transition-[left]',
            checked ? 'left-[1.375rem]' : 'left-0.5',
          )}
          style={{ height: '1.125rem', width: '1.125rem' }}
        />
      </button>
    </div>
  );
}

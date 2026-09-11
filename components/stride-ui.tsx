'use client';
export { api } from '@/lib/client-api';
import { runDuration } from '@/lib/journal-view';
import { NumericInput } from './numeric-input';
import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  useEffect,
  useRef,
  type ReactNode,
  type ReactElement,
} from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import type { Workout } from '@/lib/engine';
import { workoutDistanceLabel } from '@/lib/engine';
import { prescribedDistanceKm } from '@/lib/run-distance';
export { summaryEffort as workoutEffort } from '@/lib/prescription';

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  wide = false,
  locked = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
  locked?: boolean;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (open) titleRef.current?.focus();
  }, [title, open]);
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !locked) onClose();
      }}
    >
      <DialogContent
        showCloseButton={!locked}
        initialFocus={titleRef}
        className={`stride-modal ${wide ? 'wide' : ''}`}
      >
        <div className="modal-heading">
          <DialogTitle ref={titleRef} tabIndex={-1} className="modal-title">
            {title}
          </DialogTitle>
          <DialogDescription
            className={description ? 'modal-description' : 'sr-only'}
          >
            {description || title}
          </DialogDescription>
        </div>
        {children}
      </DialogContent>
    </Dialog>
  );
}
export function Choice({
  value,
  onChange,
  options,
  label,
  placeholder,
  id,
  'aria-describedby': describedBy,
  'aria-invalid': invalid,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  label: string;
  placeholder?: string;
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}) {
  return (
    <Select
      value={value === '' && placeholder ? null : value}
      onValueChange={(v) => v !== null && onChange(String(v))}
      items={options}
    >
      <SelectTrigger
        id={id}
        aria-label={label}
        aria-describedby={describedBy}
        aria-invalid={invalid}
        className="choice-trigger"
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export function Field({
  label,
  children,
  hint,
  error,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  error?: string | null;
}) {
  const hintId = useId();
  const errorId = useId();
  const fields = Children.map(children, (child) =>
    isValidElement(child) &&
    (typeof child.type === 'string' ||
      child.type === NumericInput ||
      child.type === Choice)
      ? cloneElement(child as ReactElement<Record<string, unknown>>, {
          ...(error ? { 'aria-invalid': true } : {}),
          'aria-describedby':
            [
              child.props && typeof child.props === 'object'
                ? (child.props as Record<string, unknown>)['aria-describedby']
                : undefined,
              hint ? hintId : undefined,
              error ? errorId : undefined,
            ]
              .filter(Boolean)
              .join(' ') || undefined,
        })
      : child,
  );
  return (
    <label className="form-field">
      <span>{label}</span>
      {fields}
      {hint && <small id={hintId}>{hint}</small>}
      {error && (
        <small id={errorId} className="field-error">
          {error}
        </small>
      )}
    </label>
  );
}
export function FormError({ message }: { message: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.scrollIntoView({ block: 'nearest' });
  }, [message]);
  return (
    <div ref={ref} tabIndex={-1} className="notice error" role="alert">
      {message}
    </div>
  );
}
export function EffortGraph({
  workout,
  units = 'km',
}: {
  workout: Workout;
  units?: 'km' | 'mi';
}) {
  const steps =
    workout.steps.length === 1
      ? Array.from({ length: 32 }, () => workout.steps[0])
      : workout.steps;
  return (
    <figure>
      <div
        className="effort-visual"
        aria-hidden="true"
        aria-label={`Workout effort profile, ${workout.steps.length} steps. Full instructions in workout details.`}
      >
        {steps.map((s, i) => (
          <i
            key={i}
            className={s.intensity >= 5 ? 'work' : ''}
            style={{
              height: `${20 + s.intensity * 9}%`,
              flex:
                workout.steps.length === 1 ? 1 : Math.max(1, s.seconds / 60),
            }}
          />
        ))}
      </div>
      <figcaption className="graph-labels">
        <span>Start easy</span>
        <span>
          {prescribedDistanceKm(workout) !== null
            ? workoutDistanceLabel(workout, { units, easyPace: null })
            : runDuration(workout.minutes)}
        </span>
      </figcaption>
    </figure>
  );
}
export function downloadFile(
  content: BlobPart,
  filename: string,
  type: string,
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

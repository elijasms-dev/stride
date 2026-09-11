'use client';
import { useSyncExternalStore, type ComponentProps } from 'react';
import {
  getActionProgress,
  getServerActionProgress,
  subscribeToActionProgress,
} from '@/lib/action-progress';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

export function useActionProgress() {
  return useSyncExternalStore(
    subscribeToActionProgress,
    getActionProgress,
    getServerActionProgress,
  );
}

export function BusyStatus({ label }: { label: string }) {
  return (
    <output className="action-progress" aria-live="polite" aria-atomic="true">
      <span className="action-spinner" aria-hidden="true" />
      <div>
        <strong>{label}</strong>
        <p>Your entries stay in place while this finishes.</p>
      </div>
    </output>
  );
}

export function ActionProgressScreen() {
  const progress = useActionProgress();
  return (
    <Dialog open={!!progress} onOpenChange={() => {}}>
      <DialogContent showCloseButton={false} className="action-progress-modal">
        <span className="action-spinner" aria-hidden="true" />
        <div>
          <DialogTitle>{progress?.label ?? 'Working…'}</DialogTitle>
          <DialogDescription>
            Your entries stay in place while this finishes.
          </DialogDescription>
          <output className="sr-only" aria-live="polite" aria-atomic="true">
            {progress?.label}
          </output>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function BusyButton({
  busy,
  busyLabel,
  disabled,
  children,
  ...props
}: ComponentProps<'button'> & {
  busy: boolean;
  busyLabel: string;
}) {
  return (
    <button
      {...props}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
    >
      {busy ? (
        <>
          <span className="action-spinner small" aria-hidden="true" />
          {busyLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}

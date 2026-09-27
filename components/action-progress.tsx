'use client';
import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ComponentProps,
} from 'react';
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
  const [visibleId, setVisibleId] = useState<number | null>(null);
  const progressId = progress?.id;
  useEffect(() => {
    if (progressId === undefined) return;
    const timer = setTimeout(() => setVisibleId(progressId), 200);
    return () => clearTimeout(timer);
  }, [progressId]);
  if (!progress || visibleId !== progress.id) return null;
  if (!progress.blocking)
    return (
      <output
        className="action-progress-toast"
        aria-live="polite"
        aria-atomic="true"
      >
        <span className="action-spinner small" aria-hidden="true" />
        <span>{progress.label}</span>
      </output>
    );
  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent showCloseButton={false} className="action-progress-modal">
        <span className="action-spinner" aria-hidden="true" />
        <div>
          <DialogTitle>{progress.label}</DialogTitle>
          <DialogDescription>
            Your entries stay in place while this finishes.
          </DialogDescription>
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

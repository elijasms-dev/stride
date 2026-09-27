'use client';
import {
  Component,
  Suspense,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { Modal } from '../stride-ui';
import { Skeleton } from '../ui/skeleton';

const screenNames: Record<string, string> = {
  onboarding: 'Your training plan',
  preferences: 'Training preferences',
  profile: 'Your profile',
  extraRun: 'Your run log',
  workout: 'Workout details',
  day: 'Your daily guide',
  'run-measure': 'Run distance settings',
  targets: 'Workout targets',
  'plan-tools': 'Plan tools',
  'variety-review': 'Workout options',
  event: 'Your next event',
  accountData: 'Your journal data',
  connections: 'Watch connections',
  adjustments: 'Training adjustments',
  'return-review': 'Your return to running',
  'walk-review': 'Your running intervals',
};
export function deferredScreenTitle(screen?: string | null) {
  return screenNames[screen ?? ''] ?? 'Your journal';
}
function DeferredLoading({
  screen,
  onClose,
}: {
  screen?: string | null;
  onClose: () => void;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 200);
    return () => clearTimeout(timer);
  }, []);
  if (!visible) return null;
  return (
    <Modal
      open
      onClose={onClose}
      title={deferredScreenTitle(screen)}
      description="Loading your screen…"
    >
      <div aria-hidden="true" className="grid gap-4">
        <Skeleton className="h-5 w-2/3 motion-reduce:animate-none" />
        <Skeleton className="h-14 w-full motion-reduce:animate-none" />
        <Skeleton className="h-14 w-full motion-reduce:animate-none" />
        <Skeleton className="h-11 w-1/2 justify-self-end motion-reduce:animate-none" />
      </div>
    </Modal>
  );
}

/** Chunk failures require a document reload because React.lazy caches rejections. */
export class DeferredDialog extends Component<
  { children: ReactNode; onClose: () => void; screen?: string | null },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <Modal
          open
          onClose={this.props.onClose}
          title={`${deferredScreenTitle(this.props.screen)} could not open`}
          description="Check your connection, then reload to try again."
        >
          <p>
            Your saved plan and device drafts are kept. Any other unsaved input
            may need entering again.
          </p>
          <div className="modal-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={this.props.onClose}
            >
              Back to journal
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={() => window.location.reload()}
            >
              Reload and retry
            </button>
          </div>
        </Modal>
      );
    return (
      <Suspense
        fallback={
          <DeferredLoading
            screen={this.props.screen}
            onClose={this.props.onClose}
          />
        }
      >
        {this.props.children}
      </Suspense>
    );
  }
}

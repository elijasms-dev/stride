'use client';
/* oxlint-disable next/no-html-link-for-pages -- Authentication transitions require a new document to discard the pinned account session. */
/* oxlint-disable react/react-compiler -- This app hydrates device preferences after SSR; it does not use the React Compiler. */
import { useAppContext } from './app-context';
import { NotificationBar, type AppNotification } from '../notification-bar';
import { TRAINING_POLICY } from '@/lib/engine';
import { needsSessionBalanceReview } from '@/lib/plan/session-balance';

export function AppStatus() {
  const {
    busy,
    isDemo,
    syncingPending,
    draftScope,
    data,
    plan,
    today,
    openModal,
  } = useAppContext();
  // Save feedback remains announced. Errors, offline state and pending saves
  // have actionable notices in the page rather than a duplicate header badge.
  return (
    <>
      <NotificationBar
        key={`${draftScope}:${plan.id}`}
        notifications={[
          ...(data.accountStatus === 'closed'
            ? [
                {
                  id: 'journal-closed',
                  title: 'Your journal is closed',
                  description:
                    'Restore a saved copy or start with an empty journal when you are ready.',
                  actionLabel: 'Open journal options',
                  onAction: () => openModal('accountData'),
                } satisfies AppNotification,
              ]
            : []),
          ...(!isDemo && plan.profile.raceDate < today
            ? [
                {
                  id: 'block-ended',
                  title: 'Your training block has ended',
                  description:
                    'Review your next goal and choose how you would like to continue training.',
                  actionLabel: 'Review next block',
                  onAction: () => openModal('event'),
                } satisfies AppNotification,
              ]
            : []),
          ...(!isDemo &&
          (plan.policyVersion !== TRAINING_POLICY.version ||
            needsSessionBalanceReview(plan))
            ? [
                {
                  id: 'training-update',
                  title: 'Training update available',
                  description:
                    'Your plan uses an earlier version of our training guidance. Preview changes to upcoming runs before applying them. Your recorded runs stay saved.',
                  actionLabel: 'Review training update',
                  onAction: () => openModal('preferences'),
                } satisfies AppNotification,
              ]
            : []),
        ]}
      />
      {!isDemo && (
        <output className="sr-only" aria-live="polite">
          {syncingPending ? 'Syncing pending saves…' : busy ? 'Saving…' : ''}
        </output>
      )}
    </>
  );
}

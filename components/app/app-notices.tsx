'use client';
/* oxlint-disable next/no-html-link-for-pages -- Authentication transitions require a new document to discard the pinned account session. */
import { NotificationBar, type AppNotification } from '../notification-bar';
/* oxlint-disable react/react-compiler -- This app hydrates device preferences after SSR; it does not use the React Compiler. */
import { TRAINING_POLICY } from '@/lib/engine';
import { ArrowUpRight, CloudOff, RotateCcw } from 'lucide-react';
import { useAppContext } from './app-context';

export function AppNotices() {
  const {
    draftScope,
    data,
    loading,
    loadError,
    offline,
    refresh,
    view,
    plan,
    isDemo,
    today,
    openModal,
    showWorkout,
    returnCheck,
    walkCheck,
    unconfirmedRunWalk,
  } = useAppContext();
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
          ...(!isDemo && plan.policyVersion !== TRAINING_POLICY.version
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
      {isDemo && view !== 'settings' && (
        <div className="demo-banner">
          <span>
            {view === 'progress'
              ? 'Your journal · no plan yet'
              : 'Example plan'}{' '}
            <span className="banner-detail">
              {view === 'progress'
                ? 'Recorded runs are saved independently of a training plan.'
                : 'A 10K block to explore. Make it yours with your running history.'}
            </span>
          </span>
          <button
            className="text-button"
            onClick={() => openModal('onboarding')}
            disabled={loading}
          >
            Build my plan <ArrowUpRight size={16} />
          </button>
        </div>
      )}
      {offline && (
        <output className="notice error connection-notice">
          <CloudOff size={18} /> You are offline. Your current view is
          available; reconnect to save changes.
        </output>
      )}
      {loadError && (
        <div className="notice error connection-notice" role="alert">
          <span>{loadError}</span>
          <button
            className="text-button"
            disabled={loading}
            onClick={() => void refresh().catch(() => {})}
          >
            <RotateCcw size={15} /> Retry
          </button>
        </div>
      )}
      {plan.feasibility && plan.feasibility.status !== 'forecast' && (
        <section className="notice" aria-label="Training goal review">
          <div>
            <strong>
              {plan.feasibility.status === 'event-deferred'
                ? 'Event deferred'
                : 'Review your race preparation'}
            </strong>
            {plan.feasibility.reasons.map((reason) => (
              <p key={reason}>{reason}</p>
            ))}
          </div>
          <button
            className="secondary-button"
            onClick={() => openModal('onboarding')}
          >
            Review goal and date
          </button>
        </section>
      )}
      {returnCheck && (
        <section className="notice" aria-label="Return to running">
          <div>
            <strong>
              Return stage {returnCheck.stage} ·{' '}
              {returnCheck.stage === 1
                ? 'Short easy running'
                : 'Easy running and a capped long run'}
            </strong>
            <p>{returnCheck.reason}</p>
          </div>
          {returnCheck.ready && (
            <button
              className="primary-button"
              onClick={() => openModal('return-review')}
            >
              Review next stage
            </button>
          )}
        </section>
      )}
      {walkCheck &&
        (walkCheck.ready || walkCheck.heldForFatigue || unconfirmedRunWalk) && (
          <section className="notice" aria-label="Run-walk progression">
            <div>
              <strong>
                {walkCheck.ready
                  ? 'Your current run-walk stage felt comfortable'
                  : walkCheck.heldForFatigue
                    ? 'Hold your current run-walk stage'
                    : 'Check your run-walk log'}
              </strong>
              <p>
                {walkCheck.ready
                  ? 'Review longer running intervals while holding weekly volume.'
                  : walkCheck.heldForFatigue
                    ? walkCheck.reason
                    : 'A comfortable outing has no running-interval confirmation. If you remember, review that log. Otherwise, keep this stage and log your next scheduled runs.'}
              </p>
            </div>
            {walkCheck.ready && (
              <button
                className="primary-button"
                onClick={() => openModal('walk-review')}
              >
                Review run-walk progression
              </button>
            )}
            {!walkCheck.ready &&
              !walkCheck.heldForFatigue &&
              unconfirmedRunWalk && (
                <button
                  className="secondary-button"
                  onClick={() => showWorkout(unconfirmedRunWalk, 'correctLog')}
                >
                  Review run-walk log
                </button>
              )}
          </section>
        )}
    </>
  );
}

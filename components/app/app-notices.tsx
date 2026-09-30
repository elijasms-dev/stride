'use client';
/* oxlint-disable next/no-html-link-for-pages -- Authentication transitions require a new document to discard the pinned account session. */
/* oxlint-disable react/react-compiler -- This app hydrates device preferences after SSR; it does not use the React Compiler. */
import { ArrowUpRight, CloudOff, RotateCcw } from 'lucide-react';
import { useAppContext } from './app-context';
import { PendingSaves } from './device-journal-settings';

export function AppNotices() {
  const {
    loading,
    loadError,
    offline,
    refresh,
    view,
    plan,
    isDemo,
    openModal,
    showWorkout,
    returnCheck,
    walkCheck,
    unconfirmedRunWalk,
    deviceError,
  } = useAppContext();
  return (
    <>
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
          available. Run logs can be saved on this device and synced later.
        </output>
      )}
      {deviceError && (
        <p className="notice error" role="alert">
          {deviceError}
        </p>
      )}
      <PendingSaves />
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
                  ? plan.beginner
                    ? 'Review the next beginner stage after comfortable, confirmed lessons. Repeat whenever needed.'
                    : 'Review longer running intervals while holding weekly volume.'
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

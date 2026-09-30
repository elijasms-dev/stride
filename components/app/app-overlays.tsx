'use client';
/* oxlint-disable next/no-html-link-for-pages -- Authentication transitions require a new document to discard the pinned account session. */
import { lazy } from 'react';
import { ActionProgressScreen } from '../action-progress';
/* oxlint-disable react/react-compiler -- This app hydrates device preferences after SSR; it does not use the React Compiler. */
import { Modal } from '../stride-ui';
import { useAppContext } from './app-context';
import { DeferredDialog } from './deferred-dialog';

const AccountDataPanel = lazy(() => import('../account-data'));
const DayDetail = lazy(() => import('../day-detail'));
const EventChange = lazy(() => import('../event-change'));
const Onboarding = lazy(() => import('../onboarding'));
const ProfileSettings = lazy(() => import('../profile'));
const RunMeasureSettings = lazy(() => import('../run-measure-settings'));
const Adjustments = lazy(() =>
  import('../plan-adjustments').then((m) => ({ default: m.Adjustments })),
);
const Connections = lazy(() =>
  import('../connections').then((m) => ({ default: m.Connections })),
);
const ExtraRunForm = lazy(() =>
  import('../training/extra-run-form').then((m) => ({
    default: m.ExtraRunForm,
  })),
);
const PlanPreferences = lazy(() =>
  import('../training/plan-preferences').then((m) => ({
    default: m.PlanPreferences,
  })),
);
const TrainingView = lazy(() =>
  import('../training/training-view').then((m) => ({
    default: m.TrainingView,
  })),
);
const TrainingReview = lazy(() => import('../training-review'));
const WorkoutDetail = lazy(() => import('../workout-detail'));
const WorkoutTargetSettings = lazy(() => import('../workout-target-settings'));

export function AppOverlays() {
  const {
    draftScope,
    importCache,
    recordingFocusId,
    importScopeRef,
    account,
    data,
    busy,
    refresh,
    loadImportActivities,
    plan,
    isDemo,
    today,
    journalPlan,
    modal,
    setModal,
    modalKey,
    preferencePatch,
    setPreferencePatch,
    daySelection,
    detailMode,
    imported,
    setImported,
    extraToCorrect,
    setExtraToCorrect,
    importScope,
    setReviewScope,
    clearImportActivities,
    returnToRecordings,
    openModal,
    showWorkout,
    currentDetail,
    act,
    activate,
    toast,
    deliveryFor,
  } = useAppContext();
  return (
    <>
      <ActionProgressScreen />
      <DeferredDialog
        screen={modal}
        key={`${modal}:${modalKey}`}
        onClose={() => setModal(null)}
      >
        {(modal === 'return-review' || modal === 'walk-review') && (
          <TrainingReview
            key={data.version}
            plan={plan}
            version={data.version}
            action={
              modal === 'return-review' ? 'advanceReturn' : 'advanceRunWalk'
            }
            onRefresh={refresh}
            onAction={act}
            onClose={() => setModal(null)}
            busy={busy}
          />
        )}
        {modal === 'profile' && (
          <ProfileSettings
            account={account}
            onClose={() => setModal(null)}
            onSaved={refresh}
          />
        )}
        {modal === 'preferences' && (
          <PlanPreferences
            onPaces={() => openModal('targets')}
            initialPatch={preferencePatch}
            plan={plan}
            today={today}
            version={data.version}
            onClose={() => setModal(null)}
            onAction={act}
            busy={busy}
          />
        )}
        {modal === 'extraRun' && (
          <ExtraRunForm
            draftScope={draftScope}
            plan={journalPlan}
            today={today}
            onClose={() => {
              setModal(null);
              setImported(undefined);
              setReviewScope('');
            }}
            onBackToRecordings={imported ? returnToRecordings : undefined}
            onSaved={imported ? returnToRecordings : undefined}
            onAction={act}
            busy={busy}
            imported={imported}
            existing={extraToCorrect}
          />
        )}
        {modal === 'onboarding' && (
          <Onboarding
            key={modalKey}
            open
            onClose={() => setModal(null)}
            onActivate={activate}
            existing={isDemo ? undefined : plan.profile}
            defaults={
              account.profile
                ? {
                    name: account.profile.display_name,
                    units: account.profile.units,
                    timezone: account.profile.timezone,
                  }
                : undefined
            }
            draftScope={
              isDemo ? draftScope : `${draftScope}:restart:${plan.id}`
            }
            busy={busy}
          />
        )}

        {modal === 'run-measure' && (
          <RunMeasureSettings
            key={modalKey}
            plan={plan}
            version={data.version}
            busy={busy}
            onAction={act}
            onClose={() => setModal(null)}
          />
        )}
        {modal === 'targets' && (
          <WorkoutTargetSettings
            plan={plan}
            version={data.version}
            onAction={act}
            onClose={() => setModal(null)}
            busy={busy}
          />
        )}
        {modal === 'plan-tools' && (
          <Modal
            open
            onClose={() => setModal(null)}
            title="Plan tools"
            description="Compare approaches and review your starting inputs."
            wide
          >
            <TrainingView
              plan={plan}
              today={today}
              isDemo={isDemo}
              onPreferences={(patch = {}) => {
                openModal('preferences');
                setPreferencePatch(patch);
              }}
              onNew={() => openModal('onboarding')}
              onWorkout={showWorkout}
              onExtra={() => {
                setImported(undefined);
                setExtraToCorrect(undefined);
                openModal('extraRun');
              }}
            />
          </Modal>
        )}
        {modal === 'variety-review' && (
          <TrainingReview
            key={data.version}
            plan={plan}
            version={data.version}
            action="variety"
            onRefresh={refresh}
            onAction={act}
            onClose={() => setModal(null)}
            busy={busy}
          />
        )}
        {modal === 'day' && daySelection?.planId === plan.id && (
          <DayDetail
            key={`${plan.id}:${daySelection.date}`}
            plan={plan}
            date={daySelection.date}
            onClose={() => setModal(null)}
            onWorkout={showWorkout}
          />
        )}
        {modal === 'workout' && currentDetail && (
          <WorkoutDetail
            draftScope={draftScope}
            key={modalKey}
            workout={currentDetail}
            plan={plan}
            version={data.version}
            profile={plan.profile}
            open
            onClose={() => setModal(null)}
            onAction={act}
            onConnect={() => openModal('connections')}
            connected={!!data.connection}
            isDemo={isDemo}
            today={today}
            delivery={deliveryFor(currentDetail)}
            busy={busy}
            initialMode={detailMode}
            imported={imported}
          />
        )}
        {modal === 'event' && (
          <EventChange
            plan={plan}
            version={data.version}
            today={today}
            onAction={act}
            onClose={() => setModal(null)}
            busy={busy}
          />
        )}
        {modal === 'accountData' && (
          <AccountDataPanel onClose={() => setModal(null)} onSaved={refresh} />
        )}
        {modal === 'connections' && (
          <Connections
            key={modalKey}
            open
            onClose={() => setModal(null)}
            connection={data.connection}
            deliveries={plan.workouts.flatMap((w) => {
              const receipt = deliveryFor(w);
              return receipt ? [receipt] : [];
            })}
            onWorkout={(w) => showWorkout(w, 'delivery')}
            onRefresh={refresh}
            plan={journalPlan}
            version={data.version}
            isDemo={isDemo}
            reviewCache={
              importCache?.scope === importScope ? importCache : null
            }
            recordingFocusId={recordingFocusId}
            onLoadActivities={loadImportActivities}
            onClearActivities={clearImportActivities}
            onReviewSavedRun={(review) => {
              setImported(undefined);
              setReviewScope('');
              if (review.workout) showWorkout(review.workout, 'view');
              else if (review.extraRun) {
                setExtraToCorrect(review.extraRun);
                openModal('extraRun');
              }
            }}
            onExtraImport={(a) => {
              if (!importScope || importScope !== importScopeRef.current)
                return;
              setExtraToCorrect(undefined);
              setReviewScope(importScope);
              setImported(a);
              openModal('extraRun');
            }}
          />
        )}
        {modal === 'adjustments' && (
          <Adjustments
            key={modalKey}
            open
            onClose={() => setModal(null)}
            plan={plan}
            version={data.version}
            today={today}
            onAction={act}
            busy={busy}
          />
        )}
      </DeferredDialog>
      {toast && <output className="toast-message">{toast}</output>}
    </>
  );
}

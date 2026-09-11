'use client';
import { useEffect, useRef, useState } from 'react';
import { Watch, ChevronRight, Check } from 'lucide-react';
import {
  dateLabel,
  workoutDistanceLabel,
  type Plan,
  type Workout,
} from '@/lib/engine';
import { runDuration } from '@/lib/journal-view';
import {
  upcomingWorkouts,
  watchSyncJobs,
  MAX_WATCH_SYNC_JOBS,
} from '@/lib/upcoming-delivery';
import { GarminHandoff } from './garmin-handoff';
import { deliveryLabel, type DeliveryReceipt } from '@/lib/delivery-policy';
import { api } from './stride-ui';
import { BusyButton } from './action-progress';

type DeliveryProps = {
  plan: Plan;
  version: number;
  connectionIdentity: string;
  deliveries: DeliveryReceipt[];
  onWorkout: (workout: Workout) => void;
  disabled: boolean;
  busy: boolean;
  onBusy: (busy: boolean) => void;
  onRefresh: () => Promise<void>;
};
export default function UpcomingDelivery(props: DeliveryProps) {
  return (
    <DeliveryBatch
      key={`${props.plan.id}:${props.version}:${props.connectionIdentity}:${props.disabled}`}
      {...props}
    />
  );
}
function DeliveryBatch({
  plan,
  version,
  disabled,
  busy,
  onBusy,
  onRefresh,
  deliveries,
  onWorkout,
}: DeliveryProps) {
  const runs = upcomingWorkouts(plan);
  const sendable = runs.filter(
    (w) => !w.steps.some((s) => s.target?.mode === 'heart-rate'),
  );
  const alreadySent = (w: Workout) =>
    deliveries.some(
      (d) =>
        d.workout_id === w.id &&
        d.version === version &&
        ['accepted', 'confirmed'].includes(d.status),
    );
  const checkCount = sendable.filter(alreadySent).length;
  const uploadCount = sendable.length - checkCount;
  const jobs = watchSyncJobs(plan, version, deliveries);
  const calendarCount = jobs.filter((job) => job.kind === 'calendar').length;
  const ready =
    !disabled &&
    sendable.length > 0 &&
    uploadCount === 0 &&
    calendarCount === 0;
  const fitCount = runs.length - sendable.length;
  const allConfirmed =
    ready &&
    sendable.every((w) =>
      deliveries.some(
        (d) =>
          d.workout_id === w.id &&
          d.version === version &&
          d.status === 'confirmed',
      ),
    );
  const [failedId, setFailedId] = useState<string | null>(null);
  const [refreshRequired, setRefreshRequired] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [attemptTotal, setAttemptTotal] = useState(0);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [results, setResults] = useState<Record<string, string>>({});
  const inFlight = useRef(false);
  const [sending, setSending] = useState(false);
  const [refreshed, setRefreshed] = useState(false);
  const lifecycle = useRef({ active: true });
  const verifiedWeek = ready && !sending && !refreshRequired && !error;
  const showHandoff = verifiedWeek && !allConfirmed;
  const failedWorkout = plan.workouts.find((w) => w.id === failedId);
  useEffect(() => {
    const scope = lifecycle.current;
    scope.active = true;
    return () => {
      scope.active = false;
    };
  }, []);

  async function send() {
    if (inFlight.current || busy || disabled || !jobs.length || refreshRequired)
      return;
    inFlight.current = true;
    onBusy(true);
    setSending(true);
    setError('');
    setResults({});
    setFailedId(null);
    setRefreshed(false);
    setCompleted(0);
    const batch = jobs.slice(0, MAX_WATCH_SYNC_JOBS);
    setAttemptTotal(batch.length);
    const scope = lifecycle.current;
    let accepted = 0,
      updated = 0;
    let attemptedId: string | undefined;
    try {
      for (let i = 0; i < batch.length; i++) {
        if (!scope.active) return;
        const job = batch[i];
        attemptedId = job.id;
        const w = plan.workouts.find((w) => w.id === job.id);
        const action = job.action;
        const label =
          job.kind === 'calendar'
            ? `Updating your calendar · ${i + 1} of ${batch.length}`
            : `${action === 'check' ? 'Checking' : 'Sending'} ${w?.title ?? 'workout'} · ${i + 1} of ${batch.length}`;
        setProgress(label);
        const response = await api<{ status: string; message?: string }>(
          '/api/sync',
          {
            method: 'POST',
            body: JSON.stringify({ id: job.id, version, action }),
          },
          false,
        );
        if (!scope.active) return;
        const verified =
          response.status === 'accepted' ||
          response.status === 'confirmed' ||
          (job.kind === 'calendar' &&
            ['removed', 'preserved', 'completed'].includes(response.status));
        setResults((previous) => ({
          ...previous,
          [job.id]: verified ? 'Verified in Intervals' : 'Needs review',
        }));
        if (!verified)
          throw new Error(
            response.message ||
              'Delivery needs review. Open this workout for its status before sending the remaining sessions.',
          );
        if (job.kind === 'workout') accepted++;
        else updated++;
        setCompleted(i + 1);
        attemptedId = undefined;
      }
      setProgress(
        `${accepted} ${accepted === 1 ? 'workout verified' : 'workouts verified'} in Intervals.icu.${updated ? ` ${updated} calendar ${updated === 1 ? 'update' : 'updates'} finished.` : ''}${jobs.length > batch.length ? ' More calendar work remains. Sync again to continue.' : ' Sync Garmin Connect to receive them on your watch.'}`,
      );
    } catch (e) {
      if (scope.active) {
        setProgress(
          `${accepted} of ${sendable.length} workouts verified. Sync paused. Review the delivery below before trying again.`,
        );
        if (attemptedId) {
          const id = attemptedId;
          setResults((previous) => ({
            ...previous,
            [id]: previous[id] ?? 'Check delivery status',
          }));
        }
        setFailedId(attemptedId ?? null);
        setError((e as Error).message);
      }
    } finally {
      if (scope.active) {
        await onRefresh()
          .then(() => {
            if (scope.active) setRefreshed(true);
          })
          .catch(() => {
            if (scope.active) {
              setRefreshRequired(true);
              setError(
                'Delivery attempts finished, but Stride could not refresh their saved status. Refresh status before sending again.',
              );
            }
          });
      }
      inFlight.current = false;
      if (scope.active) setSending(false);
      onBusy(false);
    }
  }

  async function refreshStatus() {
    if (busy || inFlight.current) return;
    inFlight.current = true;
    onBusy(true);
    try {
      await onRefresh();
      if (lifecycle.current.active) {
        setRefreshRequired(false);
        setRefreshed(true);
        setError('');
      }
    } catch {
      if (lifecycle.current.active)
        setError(
          'Status is still unavailable. Try again when your connection returns. No new workouts were sent.',
        );
    } finally {
      inFlight.current = false;
      onBusy(false);
    }
  }
  return (
    <section className="watch-week" aria-label="Upcoming watch workouts">
      <div className="watch-week-heading">
        <div>
          <h3>Your next seven days</h3>
          <p>
            {verifiedWeek
              ? fitCount
                ? `${sendable.length} ${sendable.length === 1 ? 'workout' : 'workouts'} ready in Intervals.icu; ${fitCount} ${fitCount === 1 ? 'needs' : 'need'} a FIT file.`
                : allConfirmed
                  ? 'You’ve confirmed these workouts on your watch.'
                  : 'Your week is ready in Intervals.icu.'
              : 'Send your week and keep moved workouts up to date.'}
          </p>
        </div>
        <Watch size={24} aria-hidden="true" />
      </div>
      <div className="watch-week-summary">
        <strong>
          {sendable.length ? checkCount : fitCount}
          {sendable.length > 0 && <span> / {sendable.length}</span>}
        </strong>
        <span>
          {sendable.length
            ? 'workouts in Intervals.icu'
            : fitCount
              ? 'workouts need a FIT file'
              : 'workouts to send'}
        </span>
        {ready && <Check size={18} aria-hidden="true" />}
      </div>
      {showHandoff && <GarminHandoff />}
      <BusyButton
        className={`${ready ? 'secondary-button' : 'primary-button'} watch-sync-button`}
        disabled={busy || disabled || !jobs.length || refreshRequired}
        onClick={() => void send()}
        busy={sending}
        busyLabel="Syncing your training…"
      >
        <Watch size={18} />
        {ready
          ? 'Check synced workouts'
          : !jobs.length && fitCount
            ? 'Use the FIT files below'
            : 'Sync my training'}
      </BusyButton>
      {!ready && jobs.length > 0 && (
        <p className="watch-sync-explainer">
          {uploadCount} to send · {checkCount} to check
          {calendarCount > 0 ? ` · ${calendarCount} calendar updates` : ''}
        </p>
      )}
      {sending && (
        <div className="watch-sync-progress">
          <progress
            max={attemptTotal || 1}
            value={completed}
            aria-label="Training sync progress"
          />
          <output aria-live="polite">{progress}</output>
        </div>
      )}
      {refreshRequired && (
        <BusyButton
          className="secondary-button"
          busy={busy}
          busyLabel="Refreshing status…"
          disabled={busy}
          onClick={() => void refreshStatus()}
        >
          Refresh status
        </BusyButton>
      )}
      {sendable.length < runs.length && (
        <p className="notice">
          {runs.length - sendable.length} workouts use BPM targets. Open these
          runs to download their Garmin FIT files; they are excluded from direct
          sending.
        </p>
      )}
      {runs.length ? (
        <details
          className="reason-details"
          open={!verifiedWeek || fitCount > 0}
        >
          <summary>
            {runs.length} {runs.length === 1 ? 'workout' : 'workouts'} ·{' '}
            {dateLabel(runs[0].date)}–{dateLabel(runs.at(-1)!.date)}
          </summary>
          <div className="watch-workout-list">
            {runs.map((w) => (
              <button
                type="button"
                key={w.id}
                disabled={busy}
                onClick={() => onWorkout(w)}
              >
                <span>
                  {dateLabel(w.date)}
                  {w.startTime ? ` · ${w.startTime}` : ''}
                </span>
                <strong>
                  {w.title}
                  <small>
                    {w.steps.length > 0 &&
                    w.steps.every((s) => s.metres !== undefined)
                      ? workoutDistanceLabel(w, plan.profile)
                      : runDuration(w.minutes)}
                  </small>
                </strong>
                <span>
                  {w.steps.some((s) => s.target?.mode === 'heart-rate')
                    ? 'FIT download'
                    : refreshed && deliveries.some((d) => d.workout_id === w.id)
                      ? deliveryLabel(
                          deliveries.find((d) => d.workout_id === w.id),
                          version,
                        )
                      : (results[w.id] ??
                        deliveryLabel(
                          deliveries.find((d) => d.workout_id === w.id),
                          version,
                        ))}
                </span>
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            ))}
          </div>
        </details>
      ) : (
        <p>No unfinished workouts scheduled in the next seven days.</p>
      )}
      {progress && !sending && (
        <output className="watch-sync-result">{progress}</output>
      )}
      {error && (
        <div className="watch-review">
          <p role="alert" className="notice error">
            {error}
          </p>
          {failedId && (
            <>
              <strong>
                {failedWorkout
                  ? `${dateLabel(failedWorkout.date)} · ${failedWorkout.title}`
                  : 'Previously sent Stride workout'}
              </strong>
              <div className="row-actions">
                {failedWorkout && (
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={busy}
                    onClick={() => onWorkout(failedWorkout)}
                  >
                    Review this workout
                  </button>
                )}
                <a
                  className="text-button"
                  href="https://intervals.icu/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Review in Intervals.icu
                </a>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

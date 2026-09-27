'use client';
import type { DeliveryReceipt } from '@/lib/delivery-policy';
import type {
  WatchConnectionCheck,
  ConnectionSummary,
} from '@/lib/connection-status';
import {
  linkedActivityReview,
  type Activity,
  type ImportReviewCache,
  type LinkedActivityReview,
} from '@/lib/import-review';
import { runDuration } from '@/lib/journal-view';
import { BusyButton } from './action-progress';
import UpcomingDelivery from './upcoming-delivery';
import { DeliveryQueue } from './delivery-queue';
import { StrideLogo } from './StrideLogo';
import { useEffect, useRef, useState } from 'react';
import {
  Watch,
  ExternalLink,
  Check,
  ArrowUpRight,
  RefreshCw,
  Unplug,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import { Modal, Field, Choice, api } from './stride-ui';
import { dateLabel, kmDisplay, type Plan } from '@/lib/engine';
import { WatchSetupGuide } from './watch-setup-guide';
export function Connections({
  open,
  onClose,
  connection,
  deliveries,
  onWorkout,
  onRefresh,
  plan,
  version,
  isDemo,
  onExtraImport,
  onReviewSavedRun,
  reviewCache,
  recordingFocusId,
  onLoadActivities,
  onClearActivities,
}: {
  open: boolean;
  onClose: () => void;
  connection: ConnectionSummary | null;
  deliveries: DeliveryReceipt[];
  onWorkout: (workout: import('@/lib/engine').Workout) => void;
  onRefresh: () => Promise<void>;
  plan: Plan;
  version: number;
  isDemo: boolean;
  onExtraImport: (a: Activity) => void;
  onReviewSavedRun?: (review: LinkedActivityReview) => void;
  reviewCache: ImportReviewCache | null;
  recordingFocusId?: string;
  onLoadActivities: (older: boolean) => Promise<void>;
  onClearActivities: () => void;
}) {
  const [panel, setPanel] = useState<'workouts' | 'activities'>(
    recordingFocusId ? 'activities' : 'workouts',
  );
  const [key, setKey] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [success, setSuccess] = useState('');
  const [checkedConnection, setWatchCheck] = useState<
    (WatchConnectionCheck & { identity: string }) | null
  >(null);
  const connectionIdentity = `${connection?.generation ?? ''}:${connection?.connected_at ?? ''}`;
  const watchCheck =
    checkedConnection?.identity === connectionIdentity
      ? checkedConnection
      : null;
  const activities = reviewCache?.activities ?? null;
  const nextCursor = reviewCache?.nextCursor ?? null;
  const [fileWorkoutId, setFileWorkoutId] = useState('');
  const recordingRow = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open || !recordingFocusId) return;
    const frame = requestAnimationFrame(() => {
      recordingRow.current?.scrollIntoView({ block: 'center' });
      recordingRow.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [open, recordingFocusId]);
  const checked = connection?.activity_check;
  const attempt = connection?.activity_attempt;
  const when = (at: string) =>
    new Date(at).toLocaleString([], {
      timeZone: plan.profile.timezone,
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  async function loadActivities(older = false) {
    setError('');
    setSuccess('');
    setBusy(true);
    try {
      await onLoadActivities(older);
    } catch (e) {
      setError((e as Error).message);
      await onRefresh().catch(() => {});
    } finally {
      setBusy(false);
    }
  }
  async function connect() {
    setError('');
    setBusy(true);
    try {
      await api('/api/connections', {
        method: 'POST',
        body: JSON.stringify({ key: key.trim() }),
      });
      setKey('');
      onClearActivities();
      await onRefresh();
      setSuccess(
        'Connected. Sync your training below to send your upcoming workouts.',
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Watch & sync"
      description="Garmin workouts via Intervals.icu"
      wide
      locked={busy}
    >
      {connection ? (
        <div className="watch-connected">
          <Check size={16} aria-hidden="true" />
          <span>Intervals connected · {connection.athlete_name}</span>
        </div>
      ) : (
        <>
          <div className="connection-path">
            <span className="path-brand">
              <span className="sr-only">Stride</span>
              <StrideLogo />
            </span>
            <ArrowRight size={18} />
            <span>Intervals.icu</span>
            <ArrowRight size={18} />
            <Watch size={25} />
          </div>
          <div className="notice">
            <strong>Connect once, run with your watch</strong>
            <p>
              Intervals.icu passes structured workouts to Garmin Connect. Your
              compatible watch receives them when it syncs.
            </p>
          </div>
        </>
      )}
      <details className="connection-disclosure" open={!connection}>
        <summary>
          Set up and verify a watch workout{' '}
          <ChevronRight size={16} aria-hidden="true" />
        </summary>
        <WatchSetupGuide
          plan={plan}
          version={version}
          deliveries={deliveries}
          connection={connection}
          onWorkout={onWorkout}
          isDemo={isDemo}
          disabled={busy}
        />
      </details>
      {!connection ? (
        <>
          <ol className="setup-steps">
            <li>
              <span>01</span>
              <div>
                <strong>Set up your bridge</strong>
                <p>
                  Open Intervals.icu, connect Garmin in Settings, and enable
                  planned-workout uploads and activity downloads.
                </p>
                <a
                  className="text-button"
                  href="https://intervals.icu/settings"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open Intervals.icu <ExternalLink size={14} />
                </a>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>Copy your personal API key</strong>
                <p>
                  In Intervals.icu Settings, find Developer settings and create
                  or copy your API key. Stride never needs your Garmin password.
                </p>
              </div>
            </li>
          </ol>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void connect();
            }}
          >
            <Field
              label="Intervals.icu API key"
              hint="Encrypted on the server. Never kept in browser storage."
            >
              <input
                required
                type="password"
                autoComplete="off"
                value={key}
                maxLength={200}
                onInput={(e) => setKey(e.currentTarget.value)}
                placeholder="Paste your personal key"
              />
            </Field>
            <BusyButton
              busy={busy}
              busyLabel="Checking your connection…"
              className="primary-button section-space"
              disabled={busy || !key}
            >
              {busy ? 'Checking your connection…' : 'Connect Intervals.icu'}{' '}
              <Check size={17} />
            </BusyButton>
            {isDemo && (
              <p className="subtle section-space">
                Connect and save recent running before building a plan. Sending
                workouts requires an active personal plan.
              </p>
            )}
          </form>
        </>
      ) : (
        <>
          <div className="watch-segments" aria-label="Watch tools">
            <button
              type="button"
              aria-pressed={panel === 'workouts'}
              disabled={busy}
              onClick={() => {
                setPanel('workouts');
                setError('');
                setSuccess('');
              }}
            >
              Send workouts
            </button>
            <button
              type="button"
              aria-pressed={panel === 'activities'}
              disabled={busy}
              onClick={() => {
                setPanel('activities');
                setError('');
                setSuccess('');
              }}
            >
              Recorded runs
            </button>
          </div>
          <div hidden={panel !== 'workouts'}>
            {!isDemo && (
              <DeliveryQueue
                key={JSON.stringify(deliveries)}
                onRefresh={onRefresh}
                workouts={plan.workouts}
                onWorkout={onWorkout}
              />
            )}
            <UpcomingDelivery
              plan={plan}
              version={version}
              deliveries={deliveries}
              onWorkout={onWorkout}
              connectionIdentity={`${connection.provider_athlete_id ?? ''}:${connection.generation ?? connection.connected_at}`}
              disabled={isDemo}
              busy={busy}
              onBusy={setBusy}
              onRefresh={onRefresh}
            />
            {isDemo && (
              <p className="subtle">
                Create your personal plan to send workouts. Your activity
                connection is ready to check and review runs now.
              </p>
            )}
            <details className="connection-disclosure">
              <summary>
                Help with Garmin sync{' '}
                <ChevronRight size={16} aria-hidden="true" />
              </summary>
              <div className="watch-test">
                <ShieldCheck size={24} />
                <div>
                  <h3>Check Garmin workout delivery</h3>
                  <p>
                    In Intervals.icu Settings, enable uploading planned workouts
                    to Garmin Connect. Then send your upcoming workouts here.
                    Open Garmin Connect and sync your watch. Confirm the
                    warm-up, work, recoveries, and cool-down on the watch before
                    relying on delivery.
                  </p>
                  <a
                    className="text-button"
                    href="https://intervals.icu/settings"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Check Garmin settings <ExternalLink size={14} />
                  </a>
                </div>
              </div>
              <div className="notice">
                “In Intervals” confirms the bridge received your workout. It
                does not confirm delivery to your watch. Send the next seven
                days; later workouts stay in your plan.
              </div>
            </details>
            <details className="connection-disclosure">
              <summary>
                Connection settings{' '}
                <ChevronRight size={16} aria-hidden="true" />
              </summary>
              <section
                className="watch-test"
                aria-label="Watch connection diagnostics"
              >
                <ShieldCheck size={24} />
                <div>
                  <h3>Test your connection</h3>
                  <p>
                    Check your API key and Garmin upload settings directly with
                    Intervals.icu.
                  </p>
                  <BusyButton
                    className="secondary-button"
                    busy={busy}
                    disabled={busy}
                    busyLabel="Checking Garmin connection…"
                    onClick={async () => {
                      setBusy(true);
                      setError('');
                      setWatchCheck(null);
                      try {
                        setWatchCheck({
                          ...(await api<WatchConnectionCheck>(
                            '/api/connections',
                          )),
                          identity: connectionIdentity,
                        });
                      } catch (e) {
                        setError((e as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Check watch connection
                  </BusyButton>
                  {watchCheck && (
                    <output className="section-space watch-check-result">
                      <p>
                        <strong>Intervals API key verified</strong>
                      </p>
                      <p>
                        Garmin training access:{' '}
                        {watchCheck.trainingAccess === null
                          ? 'not reported'
                          : watchCheck.trainingAccess
                            ? 'enabled'
                            : 'not enabled'}
                      </p>
                      <p>
                        Planned workout uploads:{' '}
                        {watchCheck.workoutUploads === null
                          ? 'not reported'
                          : watchCheck.workoutUploads
                            ? 'enabled'
                            : 'not enabled'}
                      </p>
                      {watchCheck.hasUploadFilters && (
                        <p>
                          Upload filters are set in Intervals. Check that
                          running workouts are included.
                        </p>
                      )}
                      {watchCheck.lastUploadAt && (
                        <p>
                          Last Garmin upload reported:{' '}
                          {when(watchCheck.lastUploadAt)}.
                        </p>
                      )}
                      <p className="subtle">
                        Checked {when(watchCheck.checkedAt)}. This verifies the
                        connection settings; sync Garmin Connect and check the
                        workout on your watch to confirm delivery.
                      </p>
                    </output>
                  )}
                </div>
              </section>
            </details>
          </div>
          <div hidden={panel !== 'activities'}>
            <div className="section-heading section-space">
              <h3>Recent activities</h3>
              <BusyButton
                busy={busy}
                busyLabel="Checking for runs…"
                className="text-button"
                disabled={busy}
                onClick={() => void loadActivities()}
              >
                <RefreshCw size={15} /> {busy ? 'Checking…' : 'Check for runs'}
              </BusyButton>
            </div>
            <p className="subtle">
              Review a run before linking it. We never infer completion from the
              date alone.
            </p>
            {activities && activities.length === 0 && (
              <p className="subtle section-space">
                No supported running activities returned in this date window.
                Check Garmin activity downloads in Intervals.icu.
              </p>
            )}
            <details
              className="connection-history"
              aria-label="Activity check and import history"
            >
              <summary>Your activity connection history</summary>
              <p className="subtle">
                Status is saved for this connection and survives reloads.
                Reconnecting starts a new check/import history; your running
                journal stays intact.
              </p>
              {connection?.activity_imported_at ? (
                <p>
                  Last recording saved: {when(connection.activity_imported_at)}{' '}
                  ({plan.profile.timezone}).{' '}
                  {connection.activity_import_count ?? 0} recordings saved or
                  attached since connecting. Corrections do not count as new
                  imports.
                </p>
              ) : (
                <p>
                  No recording has been saved from this connection yet. Checking
                  for activities alone does not import them.
                </p>
              )}
              {attempt?.outcome === 'failed' && (
                <p className="notice">
                  The latest check failed at {when(attempt.at)}:{' '}
                  {attempt.category === 'rate-limited'
                    ? 'the provider asked us to wait before retrying'
                    : attempt.category === 'authorization'
                      ? 'the provider authorization needs attention'
                      : attempt.category === 'connection-changed'
                        ? 'the connection changed'
                        : 'the service was unavailable'}
                  . Your saved runs and last successful check are preserved.
                </p>
              )}
              {attempt?.outcome === 'checking' && (
                <p className="subtle">
                  A check started at {when(attempt.at)}; no finished result has
                  been recorded yet. You can check again if it was interrupted.
                </p>
              )}
              {!checked && (
                <p className="subtle">
                  No successful activity check is recorded for this connection.
                </p>
              )}
              {checked && (
                <output className="notice">
                  Last successful check: {when(checked.at)} (
                  {plan.profile.timezone}). {dateLabel(checked.from)}–
                  {dateLabel(checked.to)}: {checked.count} runs found.
                  {checked.excluded > 0
                    ? ` ${checked.excluded} unsupported or unreadable records omitted.`
                    : ''}
                  {checked.duplicates > 0
                    ? ` ${checked.duplicates} duplicate records collapsed.`
                    : ''}{' '}
                  Checking does not add runs to your journal. Review and link
                  the returned activities, or check for runs again after
                  reloading. A missing recording in this date window does not
                  establish that it was deleted, and never removes a saved run.
                </output>
              )}
            </details>
            {activities && (
              <div className="import-list">
                {activities.length === 0 && (
                  <p className="subtle">
                    No recordings in this checked period.
                  </p>
                )}
                {activities.map((a) => {
                  const linked = linkedActivityReview(a, plan);
                  return (
                    <article
                      key={a.id}
                      ref={a.id === recordingFocusId ? recordingRow : undefined}
                      tabIndex={a.id === recordingFocusId ? -1 : undefined}
                      aria-label={`Recording: ${a.name || 'Run'}`}
                    >
                      <div>
                        <strong>{a.name || 'Run'}</strong>
                        <small>
                          {dateLabel(a.date)}
                          {a.startLocal
                            ? ` · ${a.startLocal.slice(11, 16)}`
                            : ''}{' '}
                          ·{' '}
                          {a.distance == null
                            ? 'Distance unknown'
                            : `${kmDisplay(a.distance / 1000, plan.profile.units)} ${plan.profile.units}`}{' '}
                          · {Math.round(a.movingTime / 60)} min
                        </small>
                        <small>
                          {String(a.source).toUpperCase().includes('GARMIN')
                            ? 'Garmin via Intervals.icu'
                            : a.source}
                        </small>
                        {linked && linked.differences.length > 0 && (
                          <div className="notice">
                            <strong>Differs from saved log</strong>
                            <p>
                              This recording differs in{' '}
                              {linked.differences.join(', ')}. This may reflect
                              a correction you made. Your saved values and notes
                              have not changed.
                            </p>
                            <p>
                              Saved: {dateLabel(linked.saved.date)} ·{' '}
                              {linked.saved.km === null
                                ? 'Distance unknown'
                                : `${kmDisplay(linked.saved.km, plan.profile.units)} ${plan.profile.units}`}{' '}
                              · {runDuration(linked.saved.minutes)}.
                            </p>
                            {onReviewSavedRun && (
                              <button
                                className="text-button"
                                disabled={busy}
                                onClick={() => onReviewSavedRun(linked)}
                              >
                                Review saved log
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      {linked ? (
                        <span className="pill">Linked</span>
                      ) : (
                        <button
                          className="text-button"
                          disabled={busy}
                          onClick={() =>
                            onExtraImport({ ...a, id: String(a.id) })
                          }
                        >
                          Review recording <ArrowUpRight size={15} />
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
            {nextCursor && activities && (
              <BusyButton
                busy={busy}
                busyLabel="Loading earlier runs…"
                className="secondary-button"
                disabled={busy}
                onClick={() => void loadActivities(true)}
              >
                Load earlier six weeks
              </BusyButton>
            )}
          </div>
          <details className="connection-disclosure">
            <summary>
              Manage connection <ChevronRight size={16} aria-hidden="true" />
            </summary>
            <BusyButton
              busy={busy}
              busyLabel="Disconnecting…"
              className="text-button disconnect-button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError('');
                try {
                  await api('/api/connections', {
                    method: 'POST',
                    body: JSON.stringify({ action: 'disconnect' }),
                  });
                  onClearActivities();
                  await onRefresh();
                  setSuccess(
                    'Disconnected. Your training journal is preserved.',
                  );
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Unplug size={15} /> Disconnect Intervals.icu
            </BusyButton>
          </details>
        </>
      )}
      {success && <output className="notice">{success}</output>}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {!isDemo &&
        (!connection || panel === 'workouts') &&
        plan.workouts.length > 0 && (
          <details className="reason-details watch-workout-picker">
            <summary>Find a workout or download a file</summary>
            <Field label="Workout">
              <Choice
                label="Workout"
                value={fileWorkoutId}
                onChange={setFileWorkoutId}
                options={[
                  { value: '', label: 'Choose a workout' },
                  ...plan.workouts
                    .toSorted((a, b) => a.date.localeCompare(b.date))
                    .map((w) => ({
                      value: w.id,
                      label: `${dateLabel(w.date)} · ${w.title}${w.session ? ` · ${w.session}` : ''}`,
                    })),
                ]}
              />
            </Field>
            <button
              className="secondary-button"
              disabled={
                !plan.workouts.some((w) => w.id === fileWorkoutId) || busy
              }
              onClick={() => {
                const selected = plan.workouts.find(
                  (w) => w.id === fileWorkoutId,
                );
                if (selected) onWorkout(selected);
              }}
            >
              Open watch workout
            </button>
          </details>
        )}
      {(!connection || panel === 'workouts') && (
        <details className="reason-details">
          <summary>Prefer a manual transfer?</summary>
          <p>
            {isDemo
              ? 'Create a plan to download individual workout files. '
              : 'Choose a workout under “Find a workout or download a file” above, then download its FIT file. '}
            Garmin documents transferring workouts to a compatible device’s
            Garmin/NewFiles folder over USB. The supported transfer path on your
            computer still needs testing.
          </p>
          <a
            className="text-button"
            href="https://developer.garmin.com/fit/cookbook/encoding-workout-files/"
            target="_blank"
            rel="noreferrer"
          >
            Garmin’s transfer guide <ExternalLink size={14} />
          </a>
        </details>
      )}
    </Modal>
  );
}

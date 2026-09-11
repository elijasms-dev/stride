'use client';
import type { DeliveryReceipt } from '@/lib/delivery-policy';
import type { WatchConnectionCheck } from '@/lib/connection-status';
import { BusyButton } from './action-progress';
import UpcomingDelivery from './upcoming-delivery';
import { StrideLogo } from './StrideLogo';
import { runDuration } from '@/lib/journal-view';
import type { ConnectionSummary } from '@/lib/connection-status';
import type { Activity, ImportReviewCache } from '@/lib/import-review';
export type { Activity } from '@/lib/import-review';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  DEFAULT_HOME_PREFERENCES,
  type HomePreferences,
} from '@/lib/home-preferences';
import {
  Watch,
  ExternalLink,
  Check,
  ArrowUpRight,
  Download,
  RefreshCw,
  Unplug,
  CalendarDays,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  UserRound,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Modal, Field, Choice, api } from './stride-ui';
import { addDays, dateLabel, kmDisplay, type Plan } from '@/lib/engine';
import type { Action } from './workout-detail';
export function Settings({
  homePreferences,
  onHomePreferences,
  homePreferencesTemporary,
  connection,
  onProfile,
  onData,
  onEvent,
  onTargets,
  onRunMeasure,
  runMeasure,
  targetMode,
  onTools,
  onVariety,
  theme,
  onTheme,
  motion,
  onMotion,
  onInputs,
  onConnection,
  isDemo,
  history,
  onUndo,
  busy,
}: {
  homePreferences: HomePreferences;
  onHomePreferences: (patch: Partial<HomePreferences>) => void;
  homePreferencesTemporary: boolean;
  connection: ConnectionSummary | null;
  onProfile: () => void;
  onData: () => void;
  onEvent: () => void;
  onTargets: () => void;
  onRunMeasure: () => void;
  runMeasure: 'distance' | 'time';
  targetMode: string;
  onTools: () => void;
  onVariety: () => void;
  theme: string;
  onTheme: (s: string) => void;
  motion: boolean;
  onMotion: (b: boolean) => void;
  onInputs: () => void;
  onConnection: () => void;
  isDemo: boolean;
  history: { version: number; label: string; created_at: string }[];
  onUndo: () => void;
  busy: boolean;
}) {
  return (
    <div className="settings-page">
      <div className="page-heading">
        <h1>Settings</h1>
      </div>
      <button className="settings-watch-card" onClick={onConnection}>
        <span className="settings-watch-icon">
          <Watch size={30} aria-hidden="true" />
        </span>
        <span className="settings-watch-copy">
          <strong>Watch & sync</strong>
          <span>Your upcoming workouts and recorded runs.</span>
          <small>
            <i className={`status-dot ${connection ? 'connected' : ''}`} />
            {connection
              ? 'Intervals connected'
              : 'Connect Garmin with Intervals.icu'}
          </small>
        </span>
        <ChevronRight size={22} aria-hidden="true" />
      </button>
      <button className="settings-link settings-profile" onClick={onProfile}>
        <UserRound size={22} aria-hidden="true" />
        <span>
          <strong>Your profile</strong>
          <small>Name, units and time zone.</small>
        </span>
        <ChevronRight size={20} aria-hidden="true" />
      </button>
      <section className="settings-section">
        <h2>Appearance</h2>
        <div className="setting-row">
          <div>
            <strong>Theme</strong>
            <small>Light, dark, or in step with your device.</small>
          </div>
          <Choice
            label="Theme"
            value={theme}
            onChange={onTheme}
            options={[
              { value: 'system', label: 'Follow device' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </div>
        <div className="setting-row">
          <div>
            <strong>Motion</strong>
            <small>Gentle transitions between days and weeks.</small>
          </div>
          <Switch
            aria-label="Enable motion"
            checked={motion}
            onCheckedChange={onMotion}
          />
        </div>
      </section>
      <section
        className="settings-section"
        aria-labelledby="home-preferences-heading"
      >
        <h2 id="home-preferences-heading">Your home screen</h2>
        <p
          className="settings-hint"
          role={homePreferencesTemporary ? 'status' : undefined}
        >
          {homePreferencesTemporary
            ? 'These choices apply for this visit. Your browser is not allowing them to be saved.'
            : 'Saved automatically in this browser.'}
        </p>
        <div className="setting-row">
          <div>
            <strong>Open Stride on</strong>
            <small>
              Choose where a fresh visit begins. Direct links still open their
              own page.
            </small>
          </div>
          <Choice
            label="Open Stride on"
            value={homePreferences.openingView}
            onChange={(value) =>
              onHomePreferences({
                openingView: value as HomePreferences['openingView'],
              })
            }
            options={[
              { value: 'today', label: 'Today' },
              { value: 'plan', label: 'Your plan' },
              { value: 'progress', label: 'Progress' },
            ]}
          />
        </div>
        <div className="setting-row">
          <div>
            <strong>Upcoming runs on Today</strong>
            <small>Choose how far ahead to look below your workout.</small>
          </div>
          <Choice
            label="Upcoming runs on Today"
            value={String(homePreferences.upcomingCount)}
            onChange={(value) =>
              onHomePreferences({
                upcomingCount: Number(
                  value,
                ) as HomePreferences['upcomingCount'],
              })
            }
            options={[
              { value: '0', label: 'Hide upcoming runs' },
              { value: '1', label: 'Next run' },
              { value: '3', label: 'Next three runs' },
            ]}
          />
        </div>
        <div className="setting-row">
          <div>
            <strong>Distance estimates on Today</strong>
            <small>
              Hide estimated ranges. Prescribed distances and recorded results
              stay visible.
            </small>
          </div>
          <Switch
            aria-label="Show distance estimates on Today"
            checked={homePreferences.showEstimates}
            onCheckedChange={(value) =>
              onHomePreferences({ showEstimates: value })
            }
          />
        </div>
        <button
          className="text-button settings-reset"
          disabled={Object.keys(DEFAULT_HOME_PREFERENCES).every(
            (key) =>
              homePreferences[key as keyof HomePreferences] ===
              DEFAULT_HOME_PREFERENCES[key as keyof HomePreferences],
          )}
          onClick={() => onHomePreferences(DEFAULT_HOME_PREFERENCES)}
        >
          Reset home preferences
        </button>
      </section>
      <section className="settings-section">
        <h2>Your training</h2>
        <button className="settings-link" onClick={onRunMeasure}>
          <div>
            <strong>Run distance</strong>
            <small>
              {runMeasure === 'distance'
                ? 'Distance targets'
                : 'Switch to distance targets'}{' '}
              · Easy and long runs in kilometres or miles.
            </small>
          </div>
          <ChevronRight size={17} />
        </button>
        <button className="settings-link" onClick={onTargets}>
          <span>
            <strong>Workout targets</strong>
            <small>
              {targetMode === 'pace'
                ? 'Pace'
                : targetMode === 'heart-rate'
                  ? 'Heart rate'
                  : 'Effort'}{' '}
              · Choose effort, pace or heart rate.
            </small>
          </span>
          <ChevronRight size={20} aria-hidden="true" />
        </button>
        <button className="settings-link" onClick={onVariety}>
          <span>
            <strong>Refresh your workout mix</strong>
            <small>Preview new session structures within your routine.</small>
          </span>
          <ChevronRight size={20} aria-hidden="true" />
        </button>
        <button className="settings-link" onClick={onInputs}>
          <span>
            <strong>Plan preferences</strong>
            <small>
              Running days, harder workouts and your weekly schedule.
            </small>
          </span>
          <ArrowUpRight size={18} />
        </button>
        <button className="settings-link" onClick={onEvent}>
          <span>
            <strong>Change event or start a new block</strong>
            <small>Review the full schedule from your recent running.</small>
          </span>
          <CalendarDays size={20} />
        </button>
      </section>
      <section className="settings-section">
        <h2>Explore your plan</h2>
        <button className="settings-link" onClick={onTools}>
          <span>
            <strong>Plan tools & coaching references</strong>
            <small>
              Your starting inputs, alternative approaches and the reasoning
              behind them.
            </small>
          </span>
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      </section>
      <section className="settings-section">
        <h2>Your journal</h2>
        <button className="settings-link" onClick={onData}>
          <span>
            <strong>Backups & account data</strong>
            <small>
              Save a recovery copy, restore your journal or manage deletion.
            </small>
          </span>
          <ShieldCheck size={20} aria-hidden="true" />
        </button>
        <a
          className={`settings-link ${isDemo ? 'disabled-link' : ''}`}
          href={isDemo ? undefined : '/api/export'}
          download
        >
          <span>
            <strong>Download your data</strong>
            <small>
              Runner inputs, workouts, feedback, and plan revisions.
            </small>
          </span>
          <Download size={18} />
        </a>
        {!isDemo && (
          <a
            className="settings-link"
            href="/api/export?format=calendar"
            download
          >
            <span>
              <strong>Download training calendar</strong>
              <small>
                All-day snapshot. Later changes need a fresh export; check for
                duplicate calendar entries.
              </small>
            </span>
            <CalendarDays size={20} />
          </a>
        )}
        {history.length > 0 && (
          <>
            <div className="section-heading section-space">
              <h3>Recent changes</h3>
              <button
                className="text-button"
                disabled={history.length < 2 || busy}
                onClick={onUndo}
              >
                Undo last change
              </button>
            </div>
            <div className="revision-list">
              {history.slice(0, 5).map((h) => (
                <div key={h.version}>
                  <i />
                  <span>
                    {h.label}
                    <small>
                      {new Date(h.created_at).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                      })}{' '}
                      · Revision {h.version}
                    </small>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
        <p className="subtle section-space">
          Completed runs are preserved when restoring a plan. Your data belongs
          to your private account.
        </p>
      </section>
      <details className="reason-details">
        <summary>About the training approach</summary>
        <p>
          Stride uses an independent, versioned rules engine. Current plans
          cover base building, 5K through marathon, runnable ultras up to 100
          miles, and custom distances with preparation requirements. Technical
          mountain plans and precise pace predictions are not enabled. Forecasts
          use provisional policies and require review after interrupted
          training.
        </p>
        <p>
          <a
            href="https://support.runna.com/en/articles/11794078-what-are-mileage-insights"
            target="_blank"
            rel="noreferrer"
          >
            Runna’s published adaptation approach
          </a>{' '}
          informed our research. The exact Runna algorithm is private; Stride’s
          numerical policies still need coaching review.
        </p>
      </details>
      <section className="settings-section">
        <h2>Help & privacy</h2>
        <Link className="settings-link" href="/about" prefetch={false}>
          <span>
            <strong>About Stride</strong>
            <small>How training, watch delivery and your journal work.</small>
          </span>
          <ChevronRight size={20} aria-hidden="true" />
        </Link>
        <Link className="settings-link" href="/login" prefetch={false}>
          <span>
            <strong>Private account access</strong>
            <small>Review how you sign in to your journal.</small>
          </span>
          <ShieldCheck size={20} aria-hidden="true" />
        </Link>
        <div className="settings-policy-links">
          <Link href="/privacy" prefetch={false}>
            Privacy policy
          </Link>
          <Link href="/terms" prefetch={false}>
            Preview terms
          </Link>
        </div>
      </section>
    </div>
  );
}
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
      description="Garmin Forerunner 955 · via Intervals.icu"
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
              955 receives them when it syncs.
            </p>
          </div>
        </>
      )}
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
                    Open Garmin Connect and sync your 955. Confirm the warm-up,
                    work, recoveries, and cool-down on the watch before relying
                    on delivery.
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
                  reloading.
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
                  const linked =
                    plan.extraRuns?.some(
                      (r) => r.activityId === String(a.id),
                    ) ||
                    plan.workouts.some(
                      (w) =>
                        (w.feedback as unknown as { activityId?: string })
                          ?.activityId === String(a.id),
                    );
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
            Garmin/NewFiles folder over USB. The 955 transfer path on your
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
export function Adjustments({
  version,
  open,
  onClose,
  plan,
  today,
  onAction,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  plan: Plan;
  version: number;
  today: string;
  onAction: Action;
  busy: boolean;
}) {
  const [from, setFrom] = useState(today),
    [to, setTo] = useState(addDays(today, 3)),
    [mode, setMode] = useState('easy'),
    [preview, setPreview] = useState<Plan | null>(null),
    [previewVersion, setPreviewVersion] = useState(version),
    [effectiveDate, setEffectiveDate] = useState(today),
    [loading, setLoading] = useState(false),
    [error, setError] = useState('');
  const changed =
    preview?.workouts.filter((s) => {
      const old = plan.workouts.find((w) => w.id === s.id);
      return (
        old &&
        (old.minutes !== s.minutes ||
          old.status !== s.status ||
          old.title !== s.title)
      );
    }) ?? [];
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={preview ? 'A little room to recover' : 'Make room for real life'}
      description={
        preview
          ? 'Review the sessions that change. Everything else stays in place.'
          : 'A lighter stretch, time away, or simply a few days of rest.'
      }
      wide
    >
      {!preview ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError('');
            setLoading(true);
            try {
              const r = await api<{
                plan: Plan;
                version: number;
                effectiveDate: string;
              }>('/api/plan', {
                method: 'POST',
                body: JSON.stringify({
                  action: 'adjustPreview',
                  version,
                  from,
                  to,
                  mode,
                }),
              });
              setPreview(r.plan);
              setPreviewVersion(r.version);
              setEffectiveDate(r.effectiveDate);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setLoading(false);
            }
          }}
        >
          <div className="form-section">
            <Field label="What do you need?">
              <Choice
                value={mode}
                onChange={setMode}
                label="Adjustment type"
                options={[
                  { value: 'easy', label: 'Keep running, but make it easier' },
                  { value: 'rest', label: 'Take a complete break' },
                ]}
              />
            </Field>
            <div className="form-grid">
              <Field label="From">
                <input
                  required
                  type="date"
                  min={plan.profile.startDate}
                  max={plan.profile.raceDate}
                  value={from}
                  onInput={(e) => setFrom(e.currentTarget.value)}
                />
              </Field>
              <Field label="Through">
                <input
                  required
                  type="date"
                  min={from}
                  max={addDays(from, 20)}
                  value={to}
                  onInput={(e) => setTo(e.currentTarget.value)}
                />
              </Field>
            </div>
            <div className="notice">
              The return begins with short easy runs. Logged comfortable running
              unlocks a review of the next stage, including a capped long run
              and later a newly based training block. Rest can include race day;
              the event will be marked for review.
            </div>
          </div>
          <div className="modal-actions">
            <span />
            <BusyButton
              busy={loading}
              busyLabel="Recalculating your sessions…"
              className="primary-button"
              disabled={loading}
            >
              {loading ? 'Preparing…' : 'Preview changes'}{' '}
              <ArrowRight size={17} />
            </BusyButton>
          </div>
        </form>
      ) : (
        <>
          <div className="notice">
            <CalendarDays size={18} />
            <span>
              {dateLabel(from)} — {dateLabel(to)} ·{' '}
              {mode === 'rest' ? 'Rest' : 'Easy running'} · {changed.length}{' '}
              sessions change
            </span>
          </div>
          {preview.feasibility?.reasons.map((reason) => (
            <p className="notice" key={reason}>
              {reason}
            </p>
          ))}
          <div className="change-list">
            {changed.map((s) => {
              const old = plan.workouts.find((w) => w.id === s.id)!;
              return (
                <div key={s.id}>
                  <div>
                    <small>{dateLabel(s.date)}</small>
                    <strong>{s.title}</strong>
                  </div>
                  <span>
                    <del>{runDuration(old.minutes)}</del>{' '}
                    <ArrowRight size={14} />{' '}
                    {s.status === 'skipped'
                      ? 'Rest'
                      : `${runDuration(s.minutes)}`}
                  </span>
                </div>
              );
            })}
          </div>
          {changed.length === 0 && (
            <p className="subtle section-space">
              There are no planned training sessions affected by this period.
            </p>
          )}
          <div className="modal-actions">
            <button className="text-button" onClick={() => setPreview(null)}>
              Edit dates
            </button>
            <BusyButton
              busy={busy}
              busyLabel="Saving your adjusted plan…"
              className="primary-button"
              disabled={busy || !changed.length}
              onClick={async () => {
                setError('');
                try {
                  await onAction('adjust', {
                    from,
                    to,
                    mode,
                    version: previewVersion,
                    effectiveDate,
                  });
                  onClose();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              {busy ? 'Saving…' : 'Save these changes'} <Check size={16} />
            </BusyButton>
          </div>
        </>
      )}
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
    </Modal>
  );
}

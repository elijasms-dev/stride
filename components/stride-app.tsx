'use client';
/* oxlint-disable next/no-html-link-for-pages -- Authentication transitions require a new document to discard the pinned account session. */
import { AppLayout } from './AppLayout';
import { NotificationBar, type AppNotification } from './notification-bar';
import Login from './login';
import {
  subscribeToSession,
  isSessionInvalid,
  isSessionWriting,
  getServerSessionInvalid,
} from '@/lib/client-api';
import { useAppearance } from './use-appearance';
import { targetLabel, mainWorkoutTarget } from '@/lib/workout-targets';
import { DateRail } from './date-rail';
import {
  DEFAULT_HOME_PREFERENCES,
  HOME_PREFERENCES_KEY,
  readHomePreferences,
  openingView,
  type HomePreferences,
} from '@/lib/home-preferences';
import { dayOverview } from '@/lib/daily-guide';
import DayDetail from './day-detail';
import { Moon, ChevronRight } from 'lucide-react';
import { ActionProgressScreen } from './action-progress';
import {
  actionProgressLabel,
  singleFlight,
  withActionProgress,
} from '@/lib/action-progress';
import type { ConnectionSummary } from '@/lib/connection-status';
import {
  importReviewScope,
  mergeImportPage,
  type ImportPage,
  type ImportReviewCache,
} from '@/lib/import-review';
import { runDuration } from '@/lib/journal-view';
import {
  orderedDaySessions,
  focusedSession,
  workoutTone,
} from '@/lib/day-sessions';
import {
  createJournalLoader,
  readJournalSnapshot,
} from '@/lib/journal-loading';
import { trainingDay, relativeDayLabel } from '@/lib/form-values';
import AccountDataPanel from './account-data';
import EventChange from './event-change';
/* oxlint-disable react/react-compiler -- This app hydrates device preferences after SSR; it does not use the React Compiler. */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { ArrowUpRight, Check, CloudOff, RotateCcw } from 'lucide-react';
import { TabsContent } from '@/components/ui/tabs';
import {
  demoPlan,
  dateLabel,
  validDate,
  dayDiff,
  kmDisplay,
  workoutDistanceValue,
  suggestedAdjustment,
  returnReview,
  noviceReview,
  TRAINING_POLICY,
  type Plan,
  type Workout,
  type State,
} from '@/lib/engine';
import { api, workoutEffort, Modal } from './stride-ui';
import { UpcomingSessions } from './journal-panels';
import ProfileSettings, { initials, type AccountData } from './profile';
import type { PreferencePatch } from '@/lib/engine';
import Onboarding from './onboarding';
import TrainingReview from './training-review';
import WorkoutTargetSettings from './workout-target-settings';
import RunMeasureSettings from './run-measure-settings';
import { prescribedDistanceKm } from '@/lib/run-distance';
import WorkoutDetail from './workout-detail';
import { TrainingView, PlanPreferences, ExtraRunForm } from './training';
import { FullPlan, ProgressView } from './plan-views';
import { Settings, Connections, Adjustments, type Activity } from './settings';
type Delivery = {
  workout_id: string;
  version: number;
  status: string;
  message?: string;
};
type AppData = State & {
  connection: ConnectionSummary | null;
  history: { version: number; label: string; created_at: string }[];
  deliveries: Delivery[];
};
const empty: AppData = {
  version: 0,
  plan: null,
  updatedAt: null,
  history: [],
  deliveries: [],
  connection: null,
};
export default function StrideApp() {
  const sessionInvalid = useSyncExternalStore(
    subscribeToSession,
    isSessionInvalid,
    getServerSessionInvalid,
  );
  const [draftScope, setDraftScope] = useState('');
  const [importCache, setImportCache] = useState<ImportReviewCache | null>(
    null,
  );
  const [reviewScope, setReviewScope] = useState('');
  const [recordingFocusId, setRecordingFocusId] = useState<
    string | undefined
  >();
  const importScopeRef = useRef('');
  const journalRevision = useRef(0);
  const importRequest = useRef<AbortController | null>(null);
  const [account, setAccount] = useState<AccountData>({
    profile: null,
    email: null,
  });
  const [preferencePatch, setPreferencePatch] = useState<
    Partial<PreferencePatch>
  >({});
  const [data, setData] = useState<AppData>(empty),
    [hasLoaded, setHasLoaded] = useState(false),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(''),
    [busy, setBusy] = useState(false),
    [offline, setOffline] = useState(false);
  const [view, setViewState] = useState('today'),
    [weekIndex, setWeekIndex] = useState(0),
    [selectedDate, setSelectedDateState] = useState(''),
    [selectedSession, setSelectedSession] = useState(''),
    [modal, setModal] = useState<string | null>(null),
    [modalKey, setModalKey] = useState(0),
    [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null),
    [daySelection, setDaySelection] = useState<{
      planId: string;
      date: string;
    } | null>(null),
    [detailMode, setDetailMode] = useState('view'),
    [imported, setImported] = useState<Activity | undefined>();
  const { theme, setTheme, motion, setMotion } = useAppearance();
  const mainScrollRef = useRef<HTMLElement>(null);
  const [toast, setToast] = useState(''),
    [dismissed, setDismissed] = useState('');
  const [homePreferences, setHomePreferences] = useState<HomePreferences>(
    DEFAULT_HOME_PREFERENCES,
  );
  const [homePreferencesReady, setHomePreferencesReady] = useState(false);
  const [homePreferencesTemporary, setHomePreferencesTemporary] =
    useState(false);
  const openingViewApplied = useRef(false);
  useEffect(() => {
    try {
      setHomePreferences(
        readHomePreferences(localStorage.getItem(HOME_PREFERENCES_KEY)),
      );
    } catch {
      setHomePreferencesTemporary(true);
    }
    setHomePreferencesReady(true);
  }, []);
  const updateHomePreferences = (patch: Partial<HomePreferences>) => {
    const next = { ...homePreferences, ...patch };
    setHomePreferences(next);
    try {
      localStorage.setItem(HOME_PREFERENCES_KEY, JSON.stringify(next));
      setHomePreferencesTemporary(false);
    } catch {
      setHomePreferencesTemporary(true);
    }
  };
  useEffect(() => {
    if (!homePreferencesReady || openingViewApplied.current) return;
    openingViewApplied.current = true;
    const query = new URLSearchParams(window.location.search);
    setViewState(openingView(query, homePreferences.openingView));
    if (['restart', 'training'].includes(query.get('view') ?? '')) {
      const location = new URL(window.location.href);
      location.searchParams.set(
        'view',
        openingView(query, homePreferences.openingView),
      );
      window.history.replaceState(null, '', location);
    }
  }, [homePreferencesReady, homePreferences.openingView]);
  const [deviceZone, setDeviceZone] = useState('UTC');
  const actionFlight = useRef<Promise<void> | null>(null);
  const [clockDay, setClockDay] = useState(() => trainingDay('UTC'));
  const initialDate = useMemo(() => new Date().toISOString().slice(0, 10), []),
    example = useMemo(() => demoPlan(initialDate), [initialDate]);
  const plan = data.plan ?? example,
    isDemo = !data.plan,
    trainingTimezone = isDemo
      ? account.profile?.timezone || deviceZone
      : plan.profile.timezone,
    today = clockDay,
    week = plan.weeks[weekIndex] ?? plan.weeks[0],
    unit = plan.profile.units;
  const journalPlan = isDemo
    ? {
        ...plan,
        profile: {
          ...plan.profile,
          units: account.profile?.units ?? ('km' as const),
          timezone: trainingTimezone,
        },
        workouts: [],
        extraRuns: data.standaloneRuns ?? [],
      }
    : plan;
  const [extraToCorrect, setExtraToCorrect] = useState<
    import('@/lib/engine').ExtraRun | undefined
  >();
  const importScope = importReviewScope(draftScope, data.connection);
  useEffect(() => {
    if (reviewScope && reviewScope !== importScope) {
      setImported(undefined);
      setReviewScope('');
      setModal((current) => (current === 'extraRun' ? null : current));
    }
  }, [importScope, reviewScope]);
  useEffect(() => () => importRequest.current?.abort(), []);
  const currentDate = selectedDate || today,
    dayWorkouts = orderedDaySessions(plan.workouts, currentDate),
    workout = focusedSession(dayWorkouts, selectedSession),
    dayTitle = workout ? '' : dayOverview(plan, currentDate).title,
    currentWeek = Math.max(
      0,
      Math.min(
        plan.weeks.length - 1,
        Math.floor(dayDiff(plan.weeks[0].start, today) / 7),
      ),
    );
  const writeNavigation = (nextView: string, date: string) => {
    const u = new URL(window.location.href);
    u.searchParams.set('view', nextView);
    if (date) u.searchParams.set('day', date);
    else u.searchParams.delete('day');
    u.searchParams.set('block', isDemo ? 'example' : plan.id);
    if (u.href !== window.location.href) window.history.pushState(null, '', u);
  };
  const setSelectedDate = (date: string) => {
    setSelectedSession('');
    setSelectedDateState(date);
    writeNavigation(view, date);
  };
  const setView = (nextView: string) => {
    setViewState(nextView);
    writeNavigation(nextView, selectedDate);
    mainScrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  };
  useEffect(() => {
    setDeviceZone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
    const tick = () => setClockDay(trainingDay(trainingTimezone));
    tick();
    const timer = setInterval(tick, 15000);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [trainingTimezone]);
  useEffect(() => {
    const read = () => {
      const q = new URLSearchParams(window.location.search);
      const date = q.get('day') || '';
      setSelectedDateState(validDate(date) ? date : '');
      setViewState(openingView(q, homePreferences.openingView));
    };
    window.addEventListener('popstate', read);
    return () => window.removeEventListener('popstate', read);
  }, [homePreferences.openingView]);
  useEffect(() => {
    setWeekIndex(
      Math.max(
        0,
        Math.min(
          plan.weeks.length - 1,
          Math.floor(dayDiff(plan.weeks[0].start, currentDate) / 7),
        ),
      ),
    );
  }, [currentDate, plan.id, plan.weeks]);
  const priorScope = useRef('');
  useEffect(() => {
    if (priorScope.current && priorScope.current !== draftScope) {
      try {
        const prefix = `stride-onboarding:${priorScope.current}`;
        for (const key of Object.keys(sessionStorage)) {
          if (key === prefix || key.startsWith(`${prefix}:restart:`))
            sessionStorage.removeItem(key);
        }
      } catch {}
      setModal(null);
    }
    priorScope.current = draftScope;
  }, [draftScope]);
  const suggestion = !isDemo ? suggestedAdjustment(plan) : null;
  const returnCheck = !isDemo ? returnReview(plan, today) : null;
  const walkCheck = !isDemo ? noviceReview(plan, today) : null;
  const unconfirmedRunWalk = plan.workouts.find(
    (w) => w.id === walkCheck?.unconfirmedWorkoutIds[0],
  );
  const loadedPlanId = useRef<string | null>(null);
  const [journalLoader] = useState(() =>
    createJournalLoader(
      (signal) => readJournalSnapshot<AppData, AccountData>(api, signal),
      ({ state, profile, scope }) => {
        const nextImportScope = importReviewScope(scope, state.connection);
        if (nextImportScope !== importScopeRef.current) {
          importRequest.current?.abort();
          setImportCache(null);
          setRecordingFocusId(undefined);
        }
        importScopeRef.current = nextImportScope;
        journalRevision.current++;
        setData(state);
        setAccount(profile);
        setDraftScope(scope);
        setHasLoaded(true);
      },
      (pending, error) => {
        setLoading(pending);
        setLoadError(error);
      },
    ),
  );
  const refresh = useCallback(() => journalLoader.refresh(), [journalLoader]);
  async function loadImportActivities(older: boolean) {
    const expectedScope = importScopeRef.current;
    if (!expectedScope)
      throw new Error(
        'Refresh your connection before checking for recordings.',
      );
    importRequest.current?.abort();
    const controller = new AbortController();
    importRequest.current = controller;
    const cursor =
      older && importCache?.scope === expectedScope
        ? importCache.nextCursor
        : null;
    const page = await api<ImportPage>(
      '/api/activities' +
        (cursor ? '?before=' + encodeURIComponent(cursor) : ''),
      {
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(25000),
        ]),
      },
    );
    const revision = journalRevision.current;
    await refresh();
    if (controller.signal.aborted || importRequest.current !== controller)
      return;
    if (journalRevision.current === revision)
      throw new Error(
        'Your journal refresh was interrupted. Check for recordings again.',
      );
    setImportCache((current) =>
      mergeImportPage(
        current,
        expectedScope,
        importScopeRef.current,
        page.identity,
        page,
        older,
      ),
    );
  }
  function clearImportActivities() {
    importRequest.current?.abort();
    setImportCache(null);
    setImported(undefined);
    setReviewScope('');
    setRecordingFocusId(undefined);
  }
  function returnToRecordings() {
    setRecordingFocusId(
      reviewScope === importScopeRef.current ? imported?.id : undefined,
    );
    setModal(
      reviewScope && reviewScope === importScopeRef.current
        ? 'connections'
        : null,
    );
    setImported(undefined);
    setReviewScope('');
  }
  useEffect(() => {
    if (!sessionInvalid) return;
    journalLoader.cancel();
    importRequest.current?.abort();
    setData(empty);
    setAccount({ profile: null, email: null });
    setDraftScope('');
    setImportCache(null);
    setModal(null);
    setHasLoaded(false);
  }, [sessionInvalid, journalLoader]);
  const setupHandled = useRef(false);
  useEffect(() => {
    if (!hasLoaded || setupHandled.current) return;
    setupHandled.current = true;
    const url = new URL(window.location.href);
    if (url.searchParams.get('setup') !== '1') return;
    url.searchParams.delete('setup');
    window.history.replaceState(null, '', url.pathname + url.search);
    if (!data.plan && data.accountStatus !== 'closed') setModal('onboarding');
  }, [hasLoaded, data.plan, data.accountStatus]);
  useEffect(() => {
    void refresh().catch(() => {});
    const off = () => setOffline(true),
      on = () => {
        setOffline(false);
        void refresh().catch(() => {});
      };
    const recheck = () => {
      if (
        document.visibilityState === 'visible' &&
        !isSessionWriting() &&
        !actionFlight.current &&
        !isSessionInvalid()
      )
        void refresh().catch(() => {});
    };
    window.addEventListener('focus', recheck);
    document.addEventListener('visibilitychange', recheck);
    window.addEventListener('offline', off);
    window.addEventListener('online', on);
    setOffline(!navigator.onLine);
    try {
      setDismissed(localStorage.getItem('stride-dismissed-insight') || '');
    } catch {}
    return () => {
      journalLoader.cancel();
      window.removeEventListener('focus', recheck);
      document.removeEventListener('visibilitychange', recheck);
      window.removeEventListener('offline', off);
      window.removeEventListener('online', on);
    };
  }, [refresh, journalLoader]);
  useEffect(() => {
    if (loadedPlanId.current !== plan.id) {
      loadedPlanId.current = plan.id;
      const q = new URLSearchParams(window.location.search);
      const date = q.get('day') || '';
      const sameBlock =
        !q.has('block') || q.get('block') === (isDemo ? 'example' : plan.id);
      setSelectedDateState(
        sameBlock && validDate(date)
          ? date
          : today >= plan.profile.startDate
            ? ''
            : plan.profile.startDate,
      );
    }
  }, [
    isDemo,
    plan.id,
    currentWeek,
    today,
    plan.profile.startDate,
    plan.profile.raceDate,
  ]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  const openModal = (name: string) => {
    if (name === 'connections') {
      setRecordingFocusId(undefined);
      if (view !== 'settings') setView('settings');
    }
    if (name === 'runner-inputs') name = 'onboarding';
    if (data.accountStatus === 'closed' && name === 'onboarding') {
      setModal('accountData');
      return;
    }
    if (name === 'preferences') setPreferencePatch({});
    setModalKey((k) => k + 1);
    setModal(name);
  };
  const showWorkout = (w: Workout, mode = 'view') => {
    setImported(undefined);
    setDetailMode(mode);
    setSelectedWorkout(w);
    openModal('workout');
  };
  const showDay = (date: string) => {
    setDaySelection({ planId: plan.id, date });
    openModal('day');
  };
  const selectWeek = (index: number) => {
    const n = Math.max(0, Math.min(plan.weeks.length - 1, index));
    setWeekIndex(n);
    setSelectedDate(n === currentWeek ? '' : plan.weeks[n].start);
  };
  async function act(action: string, payload: Record<string, unknown> = {}) {
    return singleFlight(actionFlight, () =>
      withActionProgress(
        ['sync', 'checkDelivery', 'confirmWatch'].includes(action)
          ? null
          : actionProgressLabel('/api/plan', {
              method: 'POST',
              body: JSON.stringify({ action }),
            }),
        async () => {
          if (isDemo && !['freeRun', 'correctExtra'].includes(action)) {
            openModal('onboarding');
            return;
          }
          journalLoader.cancel();
          setLoading(false);
          setBusy(true);
          try {
            if (
              action === 'sync' ||
              action === 'checkDelivery' ||
              action === 'confirmWatch'
            ) {
              const delivery = await api<{ status: string; message?: string }>(
                '/api/sync',
                {
                  method: 'POST',
                  body: JSON.stringify({
                    ...payload,
                    action:
                      action === 'confirmWatch'
                        ? 'confirm'
                        : action === 'checkDelivery'
                          ? 'check'
                          : 'send',
                    version: data.version,
                  }),
                },
                false,
              );
              await refresh();
              setToast(
                delivery.status === 'confirmed'
                  ? 'Your watch confirmation is saved.'
                  : delivery.status === 'review'
                    ? delivery.message ||
                      'Workout delivery needs attention. Open its details.'
                    : delivery.status === 'stale'
                      ? 'Your plan changed during delivery. Send the latest workout again.'
                      : delivery.status === 'preserved'
                        ? 'The historical or completed calendar entry was preserved.'
                        : delivery.status === 'removed'
                          ? 'Workout removed from Intervals.icu.'
                          : delivery.status === 'completed'
                            ? 'This workout is already completed. Nothing was sent.'
                            : delivery.status === 'accepted'
                              ? 'Workout ready in Intervals.icu. Next, sync Garmin Connect.'
                              : 'Delivery is not confirmed. Check the workout status before retrying.',
              );
              return;
            }
            const result = await api<State>('/api/plan', {
              method: 'POST',
              body: JSON.stringify({
                action,
                version: data.version,
                ...payload,
              }),
            });
            setData((d) => ({ ...d, ...result }));
            let syncNote = '';
            if (
              data.connection &&
              ![
                'complete',
                'correctLog',
                'freeRun',
                'correctExtra',
                'attachRecording',
                'variety',
                'targets',
              ].includes(action)
            ) {
              try {
                const synced = await api<{
                  failed: unknown[];
                  remaining: number;
                }>('/api/reconcile', { method: 'POST', body: '{}' });
                if (synced.failed.length || synced.remaining)
                  syncNote = ' Some watch updates need a retry in Settings.';
              } catch {
                syncNote =
                  ' Your plan is saved; retry watch updates in Settings.';
              }
            }
            await refresh().catch(() => {
              syncNote += ' Saved; reload to refresh journal details.';
            });
            setToast((result.lastChange || 'Your plan is saved.') + syncNote);
          } finally {
            setBusy(false);
          }
        },
      ),
    );
  }
  async function activate(candidate: Plan, requestId: string, version: number) {
    return singleFlight(actionFlight, () =>
      withActionProgress('Saving your training plan…', async () => {
        journalLoader.cancel();
        setLoading(false);
        setBusy(true);
        try {
          const result = await api<State>('/api/plan', {
            method: 'POST',
            body: JSON.stringify({
              action: 'activate',
              requestId,
              version,
              profile: candidate.profile,
            }),
          });
          setData((d) => ({ ...d, ...result }));
          await refresh().catch(() =>
            setToast(
              'Your plan was saved. Reload to refresh all journal details.',
            ),
          );
          setModal(null);
          setViewState('today');
          setSelectedDateState('');
          setSelectedSession('');
          mainScrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
          const location = new URL(window.location.href);
          location.searchParams.set('view', 'today');
          location.searchParams.delete('day');
          location.searchParams.set('block', result.plan!.id);
          window.history.replaceState(null, '', location);
          let syncNote = '';
          if (data.connection) {
            try {
              const synced = await api<{
                failed: unknown[];
                remaining: number;
              }>('/api/reconcile', {
                method: 'POST',
                body: '{}',
              });
              if (synced.failed.length || synced.remaining)
                syncNote = ' Retry old workout updates in Settings.';
            } catch {
              syncNote = ' Retry old workout updates in Settings.';
            }
          }
          setToast('Your plan is ready. One run at a time.' + syncNote);
        } finally {
          setBusy(false);
        }
      }),
    );
  }
  const deliveryFor = (w: Workout) => {
    const d = data.deliveries.find((d) => d.workout_id === w.id);
    return d && d.version !== data.version
      ? {
          ...d,
          status: 'stale',
          message:
            'Your plan has changed. Send this workout again to update Intervals.icu.',
        }
      : d;
  };
  const currentDetail = selectedWorkout
    ? (plan.workouts.find((w) => w.id === selectedWorkout.id) ??
      selectedWorkout)
    : null;
  if (sessionInvalid) return <Login mode="expired" />;
  if (!hasLoaded)
    return (
      <AppLayout
        view={view}
        onViewChange={setView}
        scrollRef={mainScrollRef}
        profileInitials="S"
        onProfile={() => {}}
        loading={loading}
        navigationDisabled
      >
        <section className="journal-loading">
          <span className="eyebrow">YOUR RUNNING JOURNAL</span>
          <h1>{loading ? 'Opening your journal' : 'Let’s reconnect'}</h1>
          {loading ? (
            <output>Loading your plan, runs and profile…</output>
          ) : (
            <>
              <p role="alert">{loadError}</p>
              <p>
                We haven’t loaded your saved data yet. Retry before creating or
                changing a plan.
              </p>
              <button
                className="primary-button"
                onClick={() => void refresh().catch(() => {})}
              >
                <RotateCcw size={17} /> Retry loading
              </button>
              <a className="text-button" href="/login" target="_top">
                Sign in again
              </a>
            </>
          )}
        </section>
      </AppLayout>
    );
  return (
    <AppLayout
      view={view}
      onViewChange={setView}
      scrollRef={mainScrollRef}
      profileInitials={initials(
        account.profile?.display_name || plan.profile.name,
      )}
      onProfile={() => openModal('profile')}
      status={
        <>
          {!isDemo && (
            <output className="journal-sync" aria-live="polite">
              {busy || loading ? (
                <span className="action-spinner small" aria-hidden="true" />
              ) : offline || loadError ? (
                <CloudOff size={15} aria-hidden="true" />
              ) : (
                <Check size={15} aria-hidden="true" />
              )}
              <span>
                {busy
                  ? 'Saving…'
                  : loading
                    ? 'Refreshing…'
                    : loadError
                      ? 'Refresh needed'
                      : offline
                        ? 'Offline'
                        : 'Saved'}
              </span>
            </output>
          )}
        </>
      }
      overlays={
        <>
          <ActionProgressScreen />
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
            <AccountDataPanel
              onClose={() => setModal(null)}
              onSaved={refresh}
            />
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
          {toast && <output className="toast-message">{toast}</output>}
        </>
      }
    >
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
      <TabsContent value="today" className="main-panel today-panel">
        <div className="page-heading daily-heading">
          <div>
            <h1 aria-live="polite">{relativeDayLabel(currentDate, today)}</h1>
          </div>
          <div className="daily-controls">
            {currentDate !== today && (
              <button
                className="text-button"
                onClick={() => setSelectedDate('')}
              >
                Back to today
              </button>
            )}
          </div>
        </div>
        {suggestion && dismissed !== suggestion.evidence && (
          <div className="insight-panel">
            <div>
              <span className="eyebrow">Training check-in</span>
              <h3>{suggestion.title}</h3>
              <p>{suggestion.reason}</p>
            </div>
            <div className="row-actions">
              <button
                className="primary-button"
                onClick={() => openModal('adjustments')}
              >
                Review a lighter week
              </button>
              <button
                className="text-button"
                onClick={() => {
                  setDismissed(suggestion.evidence);
                  try {
                    localStorage.setItem(
                      'stride-dismissed-insight',
                      suggestion.evidence,
                    );
                  } catch {}
                }}
              >
                Keep my plan
              </button>
            </div>
          </div>
        )}
        <div className="today-layout today-focus-layout">
          <section className="today-composition">
            <DateRail
              plan={plan}
              selectedDate={currentDate}
              today={today}
              motion={motion}
              onSelect={setSelectedDate}
              onHold={(session) => showWorkout(session, 'actions')}
            />
            {dayWorkouts.length > 1 && (
              <fieldset
                className="session-switcher"
                aria-label="Sessions for this day"
              >
                {dayWorkouts.map((w) => (
                  <button
                    key={w.id}
                    className={workout?.id === w.id ? 'selected' : ''}
                    aria-pressed={workout?.id === w.id}
                    onClick={() => setSelectedSession(w.id)}
                  >
                    {w.session} · {w.startTime} · {runDuration(w.minutes)}
                    <span className="session-state">
                      {w.status === 'completed'
                        ? 'Completed'
                        : w.status === 'skipped'
                          ? 'Skipped'
                          : 'To run'}
                    </span>
                  </button>
                ))}
              </fieldset>
            )}
            {workout ? (
              <article
                className="workout-card"
                data-tone={workoutTone(workout)}
                key={workout.id}
              >
                <div className="card-topline">
                  <span className="eyebrow">
                    {workout.kind === 'race'
                      ? 'Race day'
                      : workout.kind === 'long'
                        ? workout.hard
                          ? 'Long run · quality'
                          : 'Long run'
                        : workout.hard
                          ? 'Quality session'
                          : 'Easy effort'}
                  </span>
                  <div className="workout-status-actions">
                    {workout.status !== 'planned' && (
                      <span className="pill">
                        {workout.status === 'completed' ? (
                          <>
                            <Check size={12} /> Completed
                          </>
                        ) : (
                          'Skipped'
                        )}
                      </span>
                    )}
                  </div>
                </div>
                <div className="session-heading">
                  <h2>{workout.title}</h2>
                  <time className="session-date-stamp" dateTime={workout.date}>
                    <span>{dateLabel(workout.date, { month: 'short' })}</span>
                    <strong>
                      {dateLabel(workout.date, { day: 'numeric' })}
                    </strong>
                  </time>
                </div>
                <div
                  className="workout-stats"
                  data-metrics={
                    homePreferences.showEstimates ||
                    prescribedDistanceKm(workout) !== null ||
                    (workout.status === 'completed' && workout.feedback)
                      ? 3
                      : 2
                  }
                >
                  {(homePreferences.showEstimates ||
                    prescribedDistanceKm(workout) !== null ||
                    (workout.status === 'completed' && workout.feedback)) && (
                    <div>
                      <strong>
                        {workout.status === 'completed' && workout.feedback
                          ? workout.feedback.actualKm === null
                            ? '—'
                            : kmDisplay(workout.feedback.actualKm, unit)
                          : workoutDistanceValue(workout, plan.profile)}
                      </strong>
                      <span>
                        {workout.status === 'completed' && workout.feedback
                          ? workout.feedback.actualKm === null
                            ? 'Distance not recorded'
                            : `${unit} recorded`
                          : prescribedDistanceKm(workout) !== null
                            ? `${unit} target`
                            : plan.profile.easyPace
                              ? `${unit} estimated range`
                              : 'distance not estimated'}
                      </span>
                    </div>
                  )}
                  <div>
                    <strong>
                      {runDuration(
                        workout.status === 'completed' && workout.feedback
                          ? workout.feedback.actualMinutes
                          : workout.minutes,
                      )}
                    </strong>
                    <span>
                      {workout.status === 'completed' && workout.feedback
                        ? 'recorded time'
                        : prescribedDistanceKm(workout) !== null
                          ? 'estimated time'
                          : 'duration'}
                    </span>
                  </div>
                  <div>
                    <strong>
                      {workout.status === 'completed' && workout.feedback
                        ? workout.feedback.effort
                        : mainWorkoutTarget(workout)
                          ? targetLabel(mainWorkoutTarget(workout), unit)
                          : workoutEffort(workout)}
                      {(workout.status === 'completed' ||
                        !mainWorkoutTarget(workout)) && (
                        <span className="stat-small"> / 10</span>
                      )}
                    </strong>
                    <span>
                      {workout.status !== 'completed' &&
                      mainWorkoutTarget(workout)
                        ? mainWorkoutTarget(workout)?.mode === 'pace'
                          ? 'Target pace'
                          : 'Target heart rate'
                        : 'effort'}
                    </span>
                  </div>
                </div>
                <div className="card-footer">
                  <div className="today-run-actions">
                    <button
                      className="primary-button"
                      onClick={() => showWorkout(workout)}
                    >
                      {workout.status === 'completed'
                        ? 'View run'
                        : 'Open workout'}
                    </button>
                  </div>
                </div>
              </article>
            ) : (
              <button
                type="button"
                className="daily-rest-card"
                key={currentDate}
                aria-label={`${dayTitle}, open daily guide`}
                onClick={() => showDay(currentDate)}
              >
                <Moon size={24} aria-hidden="true" />
                <span>{dayTitle}</span>
                <ChevronRight size={20} aria-hidden="true" />
              </button>
            )}
            <UpcomingSessions
              count={homePreferences.upcomingCount}
              showEstimates={homePreferences.showEstimates}
              plan={plan}
              fromDate={currentDate}
              selectedId={workout?.id}
              onWorkout={showWorkout}
              onPlan={() => setView('plan')}
            />
          </section>
        </div>
      </TabsContent>
      <TabsContent value="plan" className="main-panel">
        <FullPlan
          plan={plan}
          today={today}
          onWorkout={showWorkout}
          onDay={showDay}
          onAdjust={() => openModal('adjustments')}
          onVariety={() => openModal('variety-review')}
          selected={week.index}
          onSelect={selectWeek}
          onNew={() => openModal(isDemo ? 'onboarding' : 'runner-inputs')}
          isDemo={isDemo}
        />
      </TabsContent>
      <TabsContent value="progress" className="main-panel">
        <ProgressView
          today={today}
          onCorrectExtra={(r) => {
            setExtraToCorrect(r);
            setImported(undefined);
            openModal('extraRun');
          }}
          plan={journalPlan}
          onWorkout={showWorkout}
          isDemo={isDemo}
          onExtra={() => {
            setImported(undefined);
            setExtraToCorrect(undefined);
            openModal('extraRun');
          }}
        />
      </TabsContent>
      <TabsContent value="settings" className="main-panel">
        <Settings
          homePreferences={homePreferences}
          onHomePreferences={updateHomePreferences}
          homePreferencesTemporary={homePreferencesTemporary}
          connection={data.connection}
          onTargets={() => openModal(isDemo ? 'onboarding' : 'targets')}
          onRunMeasure={() => openModal(isDemo ? 'onboarding' : 'run-measure')}
          runMeasure={plan.profile.runMeasure ?? 'time'}
          targetMode={plan.profile.workoutTargets?.mode ?? 'effort'}
          onTools={() => openModal('plan-tools')}
          onVariety={() => openModal(isDemo ? 'onboarding' : 'variety-review')}
          onProfile={() => openModal('profile')}
          theme={theme}
          onTheme={setTheme}
          motion={motion}
          onMotion={setMotion}
          onInputs={() => openModal(isDemo ? 'onboarding' : 'preferences')}
          onConnection={() => openModal('connections')}
          onData={() => openModal('accountData')}
          onEvent={() => openModal(isDemo ? 'onboarding' : 'event')}
          isDemo={isDemo}
          history={data.history}
          onUndo={() =>
            void act('undo').catch((e) => setToast((e as Error).message))
          }
          busy={busy}
        />
      </TabsContent>
    </AppLayout>
  );
}

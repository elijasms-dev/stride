'use client';
/* oxlint-disable next/no-html-link-for-pages -- Authentication transitions require a new document to discard the pinned account session. */
import { dayOverview } from '@/lib/daily-guide';
import {
  calendarSessions,
  focusedSession,
  orderedCalendarSessions,
} from '@/lib/day-sessions';
import { trainingDay } from '@/lib/form-values';
import {
  DEFAULT_HOME_PREFERENCES,
  HOME_PREFERENCES_KEY,
  openingView,
  readHomePreferences,
  type HomePreferences,
} from '@/lib/home-preferences';
import { useAppearance } from '../use-appearance';
/* oxlint-disable react/react-compiler -- This app hydrates device preferences after SSR; it does not use the React Compiler. */
import { dayDiff, demoPlan, validDate } from '@/lib/engine';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { useTrainingPlan } from './use-training-plan';

export function useAppNavigation({
  data,
  account,
}: Pick<ReturnType<typeof useTrainingPlan>, 'data' | 'account'>) {
  const [view, setViewState] = useState('today'),
    [weekIndex, setWeekIndex] = useState(0),
    [selectedDate, setSelectedDateState] = useState(''),
    [selectedSession, setSelectedSession] = useState('');
  const { theme, setTheme, motion, setMotion } = useAppearance();
  const mainScrollRef = useRef<HTMLElement>(null);
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
  const currentDate = selectedDate || today,
    dayWorkouts = orderedCalendarSessions(calendarSessions(plan), currentDate),
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
  const loadedPlanId = useRef<string | null>(null);
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
  const selectWeek = (index: number) => {
    const n = Math.max(0, Math.min(plan.weeks.length - 1, index));
    setWeekIndex(n);
    setSelectedDate(n === currentWeek ? '' : plan.weeks[n].start);
  };
  return {
    view,
    setViewState,
    weekIndex,
    setWeekIndex,
    selectedDate,
    setSelectedDateState,
    selectedSession,
    setSelectedSession,
    theme,
    setTheme,
    motion,
    setMotion,
    mainScrollRef,
    homePreferences,
    homePreferencesReady,
    homePreferencesTemporary,
    updateHomePreferences,
    plan,
    isDemo,
    today,
    week,
    unit,
    journalPlan,
    currentDate,
    dayWorkouts,
    workout,
    dayTitle,
    currentWeek,
    setSelectedDate,
    setView,
    selectWeek,
  };
}

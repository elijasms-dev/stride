'use client';
/* oxlint-disable next/no-html-link-for-pages -- Authentication transitions require a new document to discard the pinned account session. */
import { importReviewScope } from '@/lib/import-review';
/* oxlint-disable react/react-compiler -- This app hydrates device preferences after SSR; it does not use the React Compiler. */
import type { PreferencePatch } from '@/lib/engine';
import { type Workout } from '@/lib/engine';
import { useEffect, useRef, useState } from 'react';
import { type Activity } from '../settings';
import type { useAppNavigation } from './use-app-navigation';
import type { useTrainingPlan } from './use-training-plan';

export function useAppDialogs(
  server: ReturnType<typeof useTrainingPlan>,
  navigation: ReturnType<typeof useAppNavigation>,
) {
  const {
    data,
    sessionInvalid,
    hasLoaded,
    draftScope,
    importScopeRef,
    importRequest,
    setImportCache,
    setRecordingFocusId,
  } = server;
  const { plan, view, setView } = navigation;
  const [reviewScope, setReviewScope] = useState('');
  const [preferencePatch, setPreferencePatch] = useState<
    Partial<PreferencePatch>
  >({});
  const [modal, setModal] = useState<string | null>(null),
    [modalKey, setModalKey] = useState(0),
    [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null),
    [daySelection, setDaySelection] = useState<{
      planId: string;
      date: string;
    } | null>(null),
    [detailMode, setDetailMode] = useState('view'),
    [imported, setImported] = useState<Activity | undefined>();
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
    if (sessionInvalid) setModal(null);
  }, [sessionInvalid]);
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
  const currentDetail = selectedWorkout
    ? (plan.workouts.find((w) => w.id === selectedWorkout.id) ??
      selectedWorkout)
    : null;
  return {
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
    showDay,
    currentDetail,
  };
}

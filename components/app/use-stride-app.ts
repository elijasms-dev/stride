'use client';
/* oxlint-disable next/no-html-link-for-pages -- Authentication transitions require a new document to discard the pinned account session. */
/* oxlint-disable react/react-compiler -- This app hydrates device preferences after SSR; it does not use the React Compiler. */
import {
  noviceReview,
  returnReview,
  suggestedAdjustment,
  type Workout,
} from '@/lib/engine';
import { useEffect, useState } from 'react';
import { useAppDialogs } from './use-app-dialogs';
import { useAppNavigation } from './use-app-navigation';
import { usePlanActions } from './use-plan-actions';
import { useTrainingPlan } from './use-training-plan';

export function useStrideApp() {
  const server = useTrainingPlan();
  const navigation = useAppNavigation(server);
  const dialogs = useAppDialogs(server, navigation);
  const { data } = server;
  const { plan, isDemo, today } = navigation;
  const [toast, setToast] = useState(''),
    [dismissed, setDismissed] = useState('');
  useEffect(() => {
    try {
      setDismissed(localStorage.getItem('stride-dismissed-insight') || '');
    } catch {}
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  const actions = usePlanActions(server, navigation, dialogs, setToast);
  const suggestion = !isDemo ? suggestedAdjustment(plan) : null;
  const returnCheck = !isDemo ? returnReview(plan, today) : null;
  const walkCheck = !isDemo ? noviceReview(plan, today) : null;
  const unconfirmedRunWalk = plan.workouts.find(
    (w) => w.id === walkCheck?.unconfirmedWorkoutIds[0],
  );
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
  return {
    ...server,
    ...navigation,
    ...dialogs,
    ...actions,
    toast,
    setToast,
    dismissed,
    setDismissed,
    suggestion,
    returnCheck,
    walkCheck,
    unconfirmedRunWalk,
    deliveryFor,
  };
}

'use client';
/* oxlint-disable next/no-html-link-for-pages -- Authentication transitions require a new document to discard the pinned account session. */
import {
  actionProgressLabel,
  singleFlight,
  withActionProgress,
} from '@/lib/action-progress';
/* oxlint-disable react/react-compiler -- This app hydrates device preferences after SSR; it does not use the React Compiler. */
import { type Plan, type State } from '@/lib/engine';
import type { Dispatch, SetStateAction } from 'react';
import { api } from '../stride-ui';
import type { useAppDialogs } from './use-app-dialogs';
import type { useAppNavigation } from './use-app-navigation';
import type { useTrainingPlan } from './use-training-plan';

export function usePlanActions(
  server: ReturnType<typeof useTrainingPlan>,
  navigation: ReturnType<typeof useAppNavigation>,
  dialogs: ReturnType<typeof useAppDialogs>,
  setToast: Dispatch<SetStateAction<string>>,
) {
  const {
    actionFlight,
    journalLoader,
    setLoading,
    setBusy,
    data,
    setData,
    refresh,
  } = server;
  const {
    isDemo,
    setViewState,
    setSelectedDateState,
    setSelectedSession,
    mainScrollRef,
  } = navigation;
  const { openModal, setModal } = dialogs;
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
  return { act, activate };
}

'use client';
/* oxlint-disable next/no-html-link-for-pages -- Authentication transitions require a new document to discard the pinned account session. */
import {
  actionProgressLabel,
  singleFlight,
  withActionProgress,
} from '@/lib/action-progress';
/* oxlint-disable react/react-compiler -- This app hydrates device preferences after SSR; it does not use the React Compiler. */
import { type Plan, type State } from '@/lib/engine';
import { ApiRequestError, isRetryableRequest } from '@/lib/client-api';
import {
  offlineJournal,
  queueableActions,
  type PendingSave,
} from '@/lib/offline-journal';
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
                  : delivery.status === 'queued'
                    ? delivery.message ||
                      'Delivery is saved for retry. Resume it in Connections when connected.'
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
            const queueable = queueableActions.has(action);
            const id = crypto.randomUUID();
            let command: PendingSave = {
              id,
              createdAt: new Date().toISOString(),
              status: 'pending',
              body: {
                ...payload,
                action,
                version: data.version,
                mutationId: id,
              },
            };
            let durable = false;
            if (queueable) {
              try {
                const local = await offlineJournal.read();
                const pending =
                  local?.scope === server.draftScope ? local.pending : [];
                // Reopening a form after a lost response must reuse its exact intent.
                const content = (body: PendingSave['body']) =>
                  JSON.stringify({
                    ...body,
                    mutationId: undefined,
                    version: undefined,
                  });
                command =
                  pending?.find(
                    (item) => content(item.body) === content(command.body),
                  ) ?? command;
                await offlineJournal.enqueue(server.draftScope, command);
                durable = true;
                await server.reloadDevice();
              } catch (error) {
                server.setDeviceError((error as Error).message);
                if (!navigator.onLine) throw error;
              }
            }
            if (
              queueable &&
              durable &&
              (!navigator.onLine || command.status === 'review')
            ) {
              setToast(
                command.status === 'review'
                  ? 'This saved entry needs review in Pending saves.'
                  : 'Saved on this device. It will sync when you reconnect.',
              );
              return;
            }
            let result: State;
            try {
              result = await api<State & { acknowledgedMutationId?: string }>(
                '/api/plan',
                {
                  method: 'POST',
                  body: JSON.stringify(
                    queueable
                      ? command.body
                      : { ...payload, action, version: data.version },
                  ),
                },
              );
              if (durable) {
                if (
                  (result as State & { acknowledgedMutationId?: string })
                    .acknowledgedMutationId !== command.id
                )
                  throw new Error(
                    'The server did not acknowledge this entry. Review Pending saves before retrying.',
                  );
                await offlineJournal.acknowledge(
                  server.draftScope,
                  command.id,
                  result.version,
                );
                await server.reloadDevice();
              }
            } catch (error) {
              if (!durable) throw error;
              if (
                error instanceof ApiRequestError &&
                error.status < 500 &&
                error.status !== 409
              ) {
                // Definitively rejected input remains in the open form for correction.
                await offlineJournal.acknowledge(server.draftScope, command.id);
                await server.reloadDevice();
                throw error;
              }
              if (!isRetryableRequest(error))
                await offlineJournal.review(
                  server.draftScope,
                  command.id,
                  (error as Error).message,
                );
              await server.reloadDevice();
              setToast(
                isRetryableRequest(error)
                  ? 'Saved on this device; waiting to confirm with the server.'
                  : 'Your entry is saved on this device and needs review in Pending saves.',
              );
              return;
            }
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

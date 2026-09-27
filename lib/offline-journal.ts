import { deviceJournal } from '../public/journal-store.js';

export type PendingSave = {
  id: string;
  createdAt: string;
  body: Record<string, unknown> & {
    action: string;
    version: number;
    mutationId: string;
  };
  status: 'pending' | 'review';
  error?: string;
};
export type DeviceJournal = {
  scope: string;
  enabled: boolean;
  savedAt: string;
  snapshot: unknown;
  pending: PendingSave[];
};
export type JournalStore = (
  change?: (current: DeviceJournal | null) => DeviceJournal | null,
) => Promise<DeviceJournal | null>;
export const journalStore = deviceJournal as JournalStore;
export const queueableActions = new Set([
  'freeRun',
  'complete',
  'correctLog',
  'correctExtra',
  'attachRecording',
  'skip',
]);
const empty = (scope: string): DeviceJournal => ({
  scope,
  enabled: false,
  savedAt: '',
  snapshot: null,
  pending: [],
});
const requireScope = (value: DeviceJournal | null, scope: string) => {
  if (!scope || value?.scope !== scope)
    throw new Error('Refresh this account before saving on this device.');
  return value;
};

/** A single account vault; account/epoch changes erase the previous local copy. */
export function createOfflineJournal(store: JournalStore = journalStore) {
  return {
    read: () => store(),
    clear: () => store(() => null),
    invalidateScope: (scope: string) =>
      store((value) => (scope && value?.scope === scope ? null : value)),
    bind: (scope: string, expectedPreviousScope?: string | null) =>
      store((value) => {
        if (value?.scope === scope) return value;
        if (
          expectedPreviousScope !== undefined &&
          (value?.scope ?? null) !== expectedPreviousScope
        )
          throw new Error(
            'Another account opened on this device. Refresh before changing its saved journal.',
          );
        return empty(scope);
      }),
    snapshot: (scope: string, snapshot: unknown) =>
      store((value) => {
        const current = requireScope(value, scope);
        return current.enabled
          ? { ...current, snapshot, savedAt: new Date().toISOString() }
          : current;
      }),
    enable: (scope: string, snapshot: unknown) =>
      store((value) => ({
        ...requireScope(value, scope),
        enabled: true,
        snapshot,
        savedAt: new Date().toISOString(),
      })),
    disable: (scope: string) =>
      store((value) => ({
        ...requireScope(value, scope),
        enabled: false,
        snapshot: null,
        savedAt: '',
      })),
    enqueue: (scope: string, command: PendingSave) =>
      store((value) => {
        const current = requireScope(value, scope);
        if (!queueableActions.has(command.body.action))
          throw new Error('This change requires a connection.');
        if (command.id !== command.body.mutationId)
          throw new Error('Invalid save identity.');
        const duplicate = current.pending.find(
          (item) => item.id === command.id,
        );
        if (
          duplicate &&
          JSON.stringify(duplicate.body) !== JSON.stringify(command.body)
        )
          throw new Error('A pending save cannot be changed.');
        if (duplicate) return current;
        if (current.pending.length >= 100)
          throw new Error('Sync your pending saves before adding more.');
        return { ...current, pending: [...current.pending, command] };
      }),
    acknowledge: (scope: string, id: string, version?: number) =>
      store((value) => {
        const current = requireScope(value, scope);
        const accepted = current.pending.find((item) => item.id === id);
        return {
          ...current,
          pending: current.pending
            .filter((item) => item.id !== id)
            .map((item) =>
              accepted &&
              version === accepted.body.version + 1 &&
              item.status === 'pending' &&
              item.body.version === accepted.body.version
                ? { ...item, body: { ...item.body, version } }
                : item,
            ),
        };
      }),
    review: (scope: string, id: string, error: string) =>
      store((value) => ({
        ...requireScope(value, scope),
        pending: value!.pending.map((item) =>
          item.id === id ? { ...item, status: 'review' as const, error } : item,
        ),
      })),
    retryReviewed: (scope: string, id: string, version: number) =>
      store((value) => ({
        ...requireScope(value, scope),
        pending: value!.pending.map((item) =>
          item.id === id && item.status === 'review'
            ? {
                ...item,
                status: 'pending' as const,
                error: undefined,
                body: { ...item.body, version },
              }
            : item,
        ),
      })),
  };
}
export const offlineJournal = createOfflineJournal();

/** Never replay into a different account or epoch, including after a recovery. */
export async function replayPending(
  journal: ReturnType<typeof createOfflineJournal>,
  scope: string,
  request: <T>(
    path: string,
    init?: RequestInit,
    progress?: false,
  ) => Promise<T>,
  networkFailure: (error: unknown) => boolean,
) {
  const account = await request<{ accountId: string; accountEpoch: number }>(
    '/api/account',
    undefined,
    false,
  );
  if (`${account.accountId}:${account.accountEpoch}` !== scope)
    throw new Error('Pending saves belong to a different account or journal.');
  const current = requireScope(await journal.read(), scope);
  let saved = 0;
  for (const original of current.pending) {
    const command = requireScope(await journal.read(), scope).pending.find(
      (item) => item.id === original.id,
    );
    if (!command) continue;
    // Preserve ordering. A rejected edit needs review before later commands run.
    if (command.status === 'review') break;
    try {
      const result = await request<{
        acknowledgedMutationId?: string;
        version?: number;
      }>(
        '/api/plan',
        {
          method: 'POST',
          body: JSON.stringify(command.body),
        },
        false,
      );
      if (result.acknowledgedMutationId !== command.id)
        throw new Error(
          'The server did not acknowledge this saved run. Keep it pending and contact support.',
        );
      await journal.acknowledge(scope, command.id, result.version);
      saved++;
    } catch (error) {
      if (networkFailure(error)) break;
      await journal.review(
        scope,
        command.id,
        error instanceof Error
          ? error.message
          : 'Review this save before retrying.',
      );
      break;
    }
  }
  return saved;
}

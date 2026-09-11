type AccountStamp = { accountId?: string; accountEpoch?: number };
type Identity = { accountId: string; accountEpoch: number };

/** Publish a complete account view only after all required reads succeed. */
export async function readJournalSnapshot<
  State extends AccountStamp,
  Profile extends AccountStamp,
>(
  read: <T>(path: string, init: RequestInit) => Promise<T>,
  signal: AbortSignal,
) {
  const [state, profile, identity] = await Promise.all([
    read<State>('/api/state', { signal }),
    read<Profile>('/api/profile', { signal }),
    read<Identity>('/api/account', { signal }),
  ]);
  if (
    !identity.accountId ||
    !Number.isInteger(identity.accountEpoch) ||
    [state, profile].some(
      (part) =>
        part.accountId !== identity.accountId ||
        part.accountEpoch !== identity.accountEpoch,
    )
  )
    throw new Error(
      'Your account changed while loading. Retry to open the current journal.',
    );
  return {
    state,
    profile,
    scope: `${identity.accountId}:${identity.accountEpoch}`,
  };
}

/** A newer refresh owns both the result and its loading/error state. */
export function createJournalLoader<T>(
  read: (signal: AbortSignal) => Promise<T>,
  commit: (result: T) => void,
  status: (pending: boolean, error: string) => void,
) {
  let generation = 0;
  let controller: AbortController | undefined;
  return {
    cancel() {
      generation++;
      controller?.abort();
    },
    async refresh() {
      const current = ++generation;
      controller?.abort();
      const request = new AbortController();
      controller = request;
      status(true, '');
      try {
        const result = await read(
          AbortSignal.any([request.signal, AbortSignal.timeout(25000)]),
        );
        if (current !== generation || request.signal.aborted) return;
        commit(result);
        status(false, '');
      } catch (e) {
        if (current !== generation || request.signal.aborted) return;
        const error =
          e instanceof Error
            ? e
            : new Error('Your journal could not be refreshed. Try again.');
        status(false, error.message);
        throw error;
      }
    },
  };
}

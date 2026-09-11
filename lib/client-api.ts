import { actionProgressLabel, withActionProgress } from './action-progress';

type Stamp = { accountId: string; accountEpoch: number };
type Payload = {
  error?: string;
  code?: string;
  requestId?: string;
  accountId?: unknown;
  accountEpoch?: unknown;
};
export class SessionChangedError extends Error {
  constructor() {
    super(
      'Your sign-in changed or expired. Reopen your journal before saving.',
    );
  }
}
export class StaleResponseError extends Error {
  constructor() {
    super(
      'Your journal changed while loading. Refresh to see the saved result.',
    );
  }
}
/** One identity per document. Only a completed recovery initiated here can advance it. */
export function createApiClient(
  transport: typeof fetch = (...args) => fetch(...args),
) {
  let stamp: Stamp | undefined;
  let generation = 0;
  let invalid = false;
  let writes = 0;
  const listeners = new Set<() => void>();
  function invalidate(): never {
    if (!invalid) {
      invalid = true;
      for (const listener of listeners) listener();
    }
    throw new SessionChangedError();
  }
  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    if (invalid) throw new SessionChangedError();
    const method = (init?.method ?? 'GET').toUpperCase();
    const writing = !['GET', 'HEAD'].includes(method);
    if (writing && !stamp) {
      await request('/api/account');
      if (!stamp) invalidate();
    }
    const expected = stamp,
      dispatched = generation;
    const headers = new Headers(init?.headers);
    headers.set('Content-Type', 'application/json');
    if (writing && expected) {
      headers.set('x-stride-account', expected.accountId);
      headers.set('x-stride-epoch', String(expected.accountEpoch));
    }
    let recovery = false;
    if (
      path === '/api/recovery' &&
      method === 'POST' &&
      typeof init?.body === 'string'
    ) {
      try {
        const body = JSON.parse(init.body);
        recovery =
          body.action === 'commit' &&
          ['restore', 'delete', 'reopen'].includes(body.kind);
      } catch {
        /* The endpoint reports invalid JSON. */
      }
    }
    if (writing) writes++;
    try {
      let response: Response;
      try {
        response = await transport(path, {
          ...init,
          headers,
          credentials: 'same-origin',
          cache: 'no-store',
          signal: init?.signal ?? AbortSignal.timeout(25000),
        });
      } catch {
        if (invalid) throw new SessionChangedError();
        throw new Error(
          'The request did not finish. Your input is still here. Check the connection, refresh saved data, and try again.',
        );
      }
      if (invalid) throw new SessionChangedError();
      if (
        response.status === 401 ||
        response.redirected ||
        !response.headers.get('content-type')?.includes('application/json')
      )
        invalidate();
      const data = (await response.json()) as Payload;
      if (!response.ok) {
        if (dispatched !== generation) throw new StaleResponseError();
        if (data.code === 'ACCOUNT_CONTEXT_CHANGED') invalidate();
        throw new Error(
          (data.error || 'That request did not go through. Try again.') +
            (data.requestId ? ' Reference: ' + data.requestId : ''),
        );
      }
      const hasStamp =
        data.accountId !== undefined || data.accountEpoch !== undefined;
      if (hasStamp) {
        if (
          typeof data.accountId !== 'string' ||
          !data.accountId.trim() ||
          !Number.isSafeInteger(data.accountEpoch) ||
          (data.accountEpoch as number) < 0
        )
          invalidate();
        if (stamp && stamp.accountId !== data.accountId) invalidate();
      }
      // A response started before our completed recovery may never roll the UI back.
      if (dispatched !== generation) throw new StaleResponseError();
      if (hasStamp) {
        const received = data as Stamp;
        if (!stamp)
          stamp = {
            accountId: received.accountId,
            accountEpoch: received.accountEpoch,
          };
        else if (stamp.accountEpoch !== received.accountEpoch) {
          if (
            recovery &&
            expected === stamp &&
            received.accountEpoch === expected.accountEpoch + 1
          ) {
            stamp = {
              accountId: received.accountId,
              accountEpoch: received.accountEpoch,
            };
            generation++;
          } else invalidate();
        }
      }
      if (path === '/api/account' && !hasStamp) invalidate();
      return data as T;
    } finally {
      if (writing) writes--;
    }
  }
  return {
    api<T = Record<string, unknown>>(
      this: void,
      path: string,
      init?: RequestInit,
      progressLabel?: string | false,
    ): Promise<T> {
      return withActionProgress(
        progressLabel === false
          ? null
          : (progressLabel ?? actionProgressLabel(path, init)),
        () => request<T>(path, init),
      );
    },
    subscribe(this: void, listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    isInvalid: () => invalid,
    isWriting: () => writes > 0,
  };
}
const client = createApiClient();
export const api = client.api;
export const subscribeToSession = client.subscribe;
export const isSessionInvalid = client.isInvalid;
export const isSessionWriting = client.isWriting;
export const getServerSessionInvalid = () => false;

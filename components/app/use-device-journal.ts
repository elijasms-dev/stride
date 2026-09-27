'use client';
/* oxlint-disable react/react-compiler -- Device storage and account fences synchronize browser state after hydration. */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { api, isRetryableRequest, isSessionInvalid } from '@/lib/client-api';
import {
  offlineJournal,
  replayPending,
  type DeviceJournal,
} from '@/lib/offline-journal';
import {
  purgeDurableDrafts,
  purgeScopeDurableDrafts,
} from '@/lib/durable-draft';
import type { AppData } from './types';
import { prepareOfflineShell } from '@/lib/offline-shell';

export function useDeviceJournal(
  scope: string,
  data: AppData,
  sessionInvalid: boolean,
  refresh: () => Promise<void>,
  actionFlight: RefObject<Promise<void> | null>,
  setBusy: Dispatch<SetStateAction<boolean>>,
) {
  const [device, setDevice] = useState<DeviceJournal | null>(null);
  const [deviceError, setDeviceError] = useState('');
  const [syncingPending, setSyncingPending] = useState(false);
  const [preparingOffline, setPreparingOffline] = useState(false);
  const flight = useRef<Promise<void> | null>(null);
  const fence = useRef({ scope, sessionInvalid });
  if (
    fence.current.scope !== scope ||
    fence.current.sessionInvalid !== sessionInvalid
  )
    fence.current = { scope, sessionInvalid };
  const initialized = useRef<Promise<unknown>>(Promise.resolve());
  const snapshot = useRef(data);
  snapshot.current = data;
  const reloadDevice = useCallback(async () => {
    const captured = fence.current;
    await initialized.current;
    const value = await offlineJournal.read();
    if (
      captured === fence.current &&
      captured.scope === scope &&
      !captured.sessionInvalid
    )
      setDevice(value?.scope === scope ? value : null);
    return value;
  }, [scope]);
  const cacheSnapshot = useCallback(() => {
    const { plan, version, updatedAt, standaloneRuns } = snapshot.current;
    // Never cache connection credentials, deliveries, email or arbitrary API payloads.
    return { plan, version, updatedAt, standaloneRuns };
  }, []);
  useEffect(() => {
    if ('serviceWorker' in navigator)
      void navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);
  useEffect(() => {
    setSyncingPending(false);
    setDeviceError('');
    if (sessionInvalid) {
      setDevice(null);
      purgeScopeDurableDrafts(scope);
      initialized.current = offlineJournal
        .invalidateScope(scope)
        .catch(() => {});
      return;
    }
    if (!scope) return;
    let current = true;
    const captured = fence.current;
    initialized.current = offlineJournal
      .read()
      .then(async (prior) => {
        if (!current || captured !== fence.current || isSessionInvalid())
          return;
        const account = await api<{ accountId: string; accountEpoch: number }>(
          '/api/account',
          undefined,
          false,
        );
        if (!current || captured !== fence.current || isSessionInvalid())
          return;
        if (`${account.accountId}:${account.accountEpoch}` !== scope) return;
        const value = await offlineJournal.bind(scope, prior?.scope ?? null);
        if (current && captured === fence.current) {
          purgeDurableDrafts(scope);
          setDevice(value);
        }
      })
      .catch((error) => {
        if (current) setDeviceError(error.message);
      });
    return () => {
      current = false;
    };
  }, [scope, sessionInvalid]);
  useEffect(() => {
    if (!scope || sessionInvalid) return;
    const captured = fence.current;
    let current = true;
    void initialized.current
      .then(async () => {
        if (!current || captured !== fence.current) return;
        await offlineJournal.snapshot(scope, cacheSnapshot());
        if (current && captured === fence.current) await reloadDevice();
      })
      .catch((error) => {
        if (current && captured === fence.current)
          setDeviceError(error.message);
      });
    return () => {
      current = false;
    };
  }, [scope, data, sessionInvalid, cacheSnapshot, reloadDevice]);
  const flushPending = useCallback(async () => {
    if (flight.current) return flight.current;
    if (
      !scope ||
      !navigator.onLine ||
      isSessionInvalid() ||
      actionFlight.current
    )
      return;
    const captured = fence.current;
    const stillCurrent = () =>
      captured === fence.current && !captured.sessionInvalid;
    const job = (async () => {
      setSyncingPending(true);
      setBusy(true);
      try {
        await initialized.current;
        if (!stillCurrent()) return;
        const current = await offlineJournal.read();
        if (
          !stillCurrent() ||
          current?.scope !== scope ||
          !current.pending.length
        )
          return;
        const saved = await replayPending(
          offlineJournal,
          scope,
          api,
          isRetryableRequest,
        );
        if (!stillCurrent()) return;
        if (saved) await refresh();
        if (stillCurrent()) await reloadDevice();
      } catch (error) {
        if (stillCurrent() && !isRetryableRequest(error))
          setDeviceError((error as Error).message);
      } finally {
        if (stillCurrent()) setSyncingPending(false);
      }
    })();
    flight.current = job;
    actionFlight.current = job;
    try {
      await job;
    } finally {
      if (flight.current === job) flight.current = null;
      if (actionFlight.current === job) {
        actionFlight.current = null;
        setBusy(false);
      }
    }
  }, [scope, refresh, reloadDevice, actionFlight, setBusy]);
  useEffect(() => {
    const sync = () => {
      if (document.visibilityState === 'visible') void flushPending();
    };
    // A reconnect/focus triggers a bounded replay. No battery-draining retry loop.
    window.addEventListener('online', sync);
    window.addEventListener('focus', sync);
    if (scope) void flushPending();
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('focus', sync);
    };
  }, [scope, flushPending]);
  async function enableOffline() {
    const captured = fence.current;
    if (!scope || captured.sessionInvalid || preparingOffline) return;
    setPreparingOffline(true);
    try {
      await prepareOfflineShell(
        'serviceWorker' in navigator ? navigator.serviceWorker : undefined,
      );
      await initialized.current;
      if (captured !== fence.current) return;
      const value = await offlineJournal.enable(scope, cacheSnapshot());
      if (captured !== fence.current) return;
      setDevice(value);
      setDeviceError('');
      // Persistence is best-effort: a denied request does not undo a successful write.
      if (navigator.storage?.persist)
        void navigator.storage.persist().catch(() => {});
    } catch (error) {
      if (captured === fence.current) setDeviceError((error as Error).message);
    } finally {
      setPreparingOffline(false);
    }
  }
  async function disableOffline() {
    const captured = fence.current;
    if (!scope || captured.sessionInvalid) return;
    try {
      await initialized.current;
      if (captured !== fence.current) return;
      const value = await offlineJournal.disable(scope);
      if (captured === fence.current) setDevice(value);
    } catch (error) {
      if (captured === fence.current) setDeviceError((error as Error).message);
    }
  }
  async function discardPending(id: string) {
    const captured = fence.current;
    if (!scope || captured.sessionInvalid) return;
    try {
      await initialized.current;
      if (captured !== fence.current) return;
      await offlineJournal.acknowledge(scope, id);
      if (captured === fence.current) await reloadDevice();
    } catch (error) {
      if (captured === fence.current) setDeviceError((error as Error).message);
    }
  }
  return {
    device: !sessionInvalid && device?.scope === scope ? device : null,
    deviceError,
    setDeviceError,
    reloadDevice,
    syncingPending:
      !sessionInvalid && fence.current.scope === scope && syncingPending,
    flushPending,
    enableOffline,
    preparingOffline,
    disableOffline,
    discardPending,
  };
}

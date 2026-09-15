'use client';
/* oxlint-disable next/no-html-link-for-pages -- Authentication transitions require a new document to discard the pinned account session. */
import {
  getServerSessionInvalid,
  isSessionInvalid,
  isSessionWriting,
  subscribeToSession,
} from '@/lib/client-api';
import {
  importReviewScope,
  mergeImportPage,
  type ImportPage,
  type ImportReviewCache,
} from '@/lib/import-review';
import {
  createJournalLoader,
  readJournalSnapshot,
} from '@/lib/journal-loading';
/* oxlint-disable react/react-compiler -- This app hydrates device preferences after SSR; it does not use the React Compiler. */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { type AccountData } from '../profile';
import { api } from '../stride-ui';
import { empty, type AppData } from './types';

export function useTrainingPlan() {
  const sessionInvalid = useSyncExternalStore(
    subscribeToSession,
    isSessionInvalid,
    getServerSessionInvalid,
  );
  const [draftScope, setDraftScope] = useState('');
  const [importCache, setImportCache] = useState<ImportReviewCache | null>(
    null,
  );
  const [recordingFocusId, setRecordingFocusId] = useState<
    string | undefined
  >();
  const importScopeRef = useRef('');
  const journalRevision = useRef(0);
  const importRequest = useRef<AbortController | null>(null);
  useEffect(() => () => importRequest.current?.abort(), []);
  const [account, setAccount] = useState<AccountData>({
    profile: null,
    email: null,
  });
  const [data, setData] = useState<AppData>(empty),
    [hasLoaded, setHasLoaded] = useState(false),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(''),
    [busy, setBusy] = useState(false),
    [offline, setOffline] = useState(false);
  const actionFlight = useRef<Promise<void> | null>(null);
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
  useEffect(() => {
    if (!sessionInvalid) return;
    journalLoader.cancel();
    importRequest.current?.abort();
    setData(empty);
    setAccount({ profile: null, email: null });
    setDraftScope('');
    setImportCache(null);
    setHasLoaded(false);
  }, [sessionInvalid, journalLoader]);
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
    return () => {
      journalLoader.cancel();
      window.removeEventListener('focus', recheck);
      document.removeEventListener('visibilitychange', recheck);
      window.removeEventListener('offline', off);
      window.removeEventListener('online', on);
    };
  }, [refresh, journalLoader]);
  return {
    sessionInvalid,
    draftScope,
    importCache,
    setImportCache,
    recordingFocusId,
    setRecordingFocusId,
    importScopeRef,
    journalRevision,
    importRequest,
    account,
    data,
    setData,
    hasLoaded,
    loading,
    setLoading,
    loadError,
    busy,
    setBusy,
    offline,
    actionFlight,
    journalLoader,
    refresh,
    loadImportActivities,
  };
}

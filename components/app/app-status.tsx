'use client';
/* oxlint-disable next/no-html-link-for-pages -- Authentication transitions require a new document to discard the pinned account session. */
/* oxlint-disable react/react-compiler -- This app hydrates device preferences after SSR; it does not use the React Compiler. */
import { Check, CloudOff } from 'lucide-react';
import { useAppContext } from './app-context';

export function AppStatus() {
  const { loading, loadError, busy, offline, isDemo } = useAppContext();
  return (
    <>
      {!isDemo && (
        <output className="journal-sync" aria-live="polite">
          {busy || loading ? (
            <span className="action-spinner small" aria-hidden="true" />
          ) : offline || loadError ? (
            <CloudOff size={15} aria-hidden="true" />
          ) : (
            <Check size={15} aria-hidden="true" />
          )}
          <span>
            {busy
              ? 'Saving…'
              : loading
                ? 'Refreshing…'
                : loadError
                  ? 'Refresh needed'
                  : offline
                    ? 'Offline'
                    : 'Saved'}
          </span>
        </output>
      )}
    </>
  );
}

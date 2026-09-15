'use client';
/* oxlint-disable next/no-html-link-for-pages -- Authentication transitions require a new document to discard the pinned account session. */
import { AppLayout } from '../AppLayout';
/* oxlint-disable react/react-compiler -- This app hydrates device preferences after SSR; it does not use the React Compiler. */
import { RotateCcw } from 'lucide-react';
import { useAppContext } from './app-context';

export function LoadingRoute() {
  const { loading, loadError, refresh, view, mainScrollRef, setView } =
    useAppContext();
  return (
    <AppLayout
      view={view}
      onViewChange={setView}
      scrollRef={mainScrollRef}
      profileInitials="S"
      onProfile={() => {}}
      loading={loading}
      navigationDisabled
    >
      <section className="journal-loading">
        <span className="eyebrow">YOUR RUNNING JOURNAL</span>
        <h1>{loading ? 'Opening your journal' : 'Let’s reconnect'}</h1>
        {loading ? (
          <output>Loading your plan, runs and profile…</output>
        ) : (
          <>
            <p role="alert">{loadError}</p>
            <p>
              We haven’t loaded your saved data yet. Retry before creating or
              changing a plan.
            </p>
            <button
              className="primary-button"
              onClick={() => void refresh().catch(() => {})}
            >
              <RotateCcw size={17} /> Retry loading
            </button>
            <a className="text-button" href="/login" target="_top">
              Sign in again
            </a>
          </>
        )}
      </section>
    </AppLayout>
  );
}

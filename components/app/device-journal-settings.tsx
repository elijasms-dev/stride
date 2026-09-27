'use client';
import { useState } from 'react';
import { offlineJournal } from '@/lib/offline-journal';
import { useAppContext } from './app-context';

function EntryDetails({ body }: { body: Record<string, unknown> }) {
  const run = (body.run ?? body.feedback ?? {}) as Record<string, unknown>;
  const values = [
    ['Date', run.date ?? run.actualDate],
    ['Duration (minutes)', run.minutes ?? run.actualMinutes],
    ['Distance (km)', run.km ?? run.actualKm],
    ['Effort out of 10', run.effort],
    ['Feeling', run.feeling],
    ['Notes', run.note],
    ['Correction reason', body.correctionReason],
    ['Reason', body.reason],
  ].filter(
    ([, value]) => value !== undefined && value !== null && value !== '',
  );
  return (
    <dl>
      {values.map(([label, value]) => (
        <div key={String(label)}>
          <dt>{String(label)}</dt>
          <dd>{String(value)}</dd>
        </div>
      ))}
    </dl>
  );
}
const actionNames: Record<string, string> = {
  freeRun: 'Run log',
  complete: 'Workout log',
  correctLog: 'Log correction',
  correctExtra: 'Run correction',
  attachRecording: 'Recording match',
  skip: 'Skipped workout',
};

export function PendingSaves() {
  const {
    device,
    data,
    draftScope,
    discardPending,
    flushPending,
    syncingPending,
    refresh,
    reloadDevice,
    setToast,
  } = useAppContext();
  const [reviewed, setReviewed] = useState('');
  if (!device?.pending.length) return null;
  return (
    <section className="notice device-journal" aria-label="Pending saves">
      <div>
        <h2>Pending saves · {device.pending.length}</h2>
        <p>
          These entries are stored on this device. They are not yet confirmed in
          your journal.
        </p>
      </div>
      <button
        className="secondary-button"
        disabled={syncingPending}
        onClick={() => void flushPending()}
      >
        {' '}
        {syncingPending ? 'Checking…' : 'Try syncing'}
      </button>
      {device.pending.map((item) => (
        <details key={item.id}>
          <summary>
            {actionNames[item.body.action] ?? 'Journal entry'} ·{' '}
            {new Date(item.createdAt).toLocaleString()} ·{' '}
            {item.status === 'review' ? 'Review needed' : 'Waiting to sync'}
          </summary>
          {item.error && <output>{item.error}</output>}
          <EntryDetails body={item.body} />
          <p>
            Check this entry against your latest journal before retrying. Export
            a copy before removing any entry you still need.
          </p>
          <button
            className="secondary-button"
            onClick={() => {
              const url = URL.createObjectURL(
                new Blob([JSON.stringify(item, null, 2)], {
                  type: 'application/json',
                }),
              );
              const a = document.createElement('a');
              a.href = url;
              a.download = `stride-pending-${item.id}.json`;
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}
          >
            Export entry
          </button>
          {item.status === 'review' && (
            <button
              className="secondary-button"
              disabled={syncingPending}
              onClick={() => {
                void (async () => {
                  if (reviewed !== item.id) {
                    await refresh();
                    setReviewed(item.id);
                    return;
                  }
                  await offlineJournal.retryReviewed(
                    draftScope,
                    item.id,
                    data.version,
                  );
                  await reloadDevice();
                  setReviewed('');
                  await flushPending();
                })().catch((error) => setToast(error.message));
              }}
            >
              {reviewed === item.id
                ? 'Apply this entry to the refreshed journal'
                : 'Refresh journal before retrying'}
            </button>
          )}
          <button
            className="text-button"
            onClick={() => {
              if (
                window.confirm(
                  'Remove this local entry? This does not undo any run already saved on the server.',
                )
              )
                void discardPending(item.id).catch((error) =>
                  setToast(error.message),
                );
            }}
          >
            Remove local entry
          </button>
        </details>
      ))}
    </section>
  );
}

export function DeviceJournalSettings() {
  const {
    device,
    deviceError,
    enableOffline,
    disableOffline,
    preparingOffline,
  } = useAppContext();
  return (
    <section className="card device-journal" aria-label="Offline access">
      <h2>Offline access on this device</h2>
      <p>
        Keep a local copy of your plan and log runs without a connection. Anyone
        using this browser can open the saved copy. Enable this only on a
        private device. Your browser may remove local data when storage is low.
      </p>
      <button
        className="secondary-button"
        disabled={preparingOffline}
        onClick={() =>
          void (device?.enabled ? disableOffline() : enableOffline())
        }
      >
        {preparingOffline
          ? 'Preparing offline access…'
          : device?.enabled
            ? 'Remove offline plan copy'
            : 'Enable offline access'}
      </button>
      {device?.enabled && (
        <p>
          Offline access enabled. Open Stride as usual without a connection to
          view your saved plan and add a run log. Reconnect to sync. This does
          not record GPS.
        </p>
      )}
      {deviceError && <p role="alert">{deviceError}</p>}
    </section>
  );
}

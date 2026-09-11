'use client';
import { withActionProgress } from '@/lib/action-progress';
import { BusyButton } from './action-progress';
import { useEffect, useRef, useState } from 'react';
import { Modal, Field, api, downloadFile } from './stride-ui';
type Kind = 'restore' | 'delete' | 'reopen';
type Review = {
  id: string;
  kind: Kind;
  warning: string;
  expiresAt: string;
  current: { planned: number; completed: number; extraRuns: number };
  replacement: { planned: number; completed: number; extraRuns: number };
  profileName: string | null;
};
export default function AccountData({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [account, setAccount] = useState<{
      status: string;
      accountId: string;
      storage?: {
        journalBytes: number;
        journalLimit: number;
        preplanBytes: number;
        preplanLimit: number;
      };
    } | null>(null),
    [file, setFile] = useState<unknown>(null),
    [filename, setFilename] = useState(''),
    [review, setReview] = useState<Review | null>(null),
    [confirm, setConfirm] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [historyCursor, setHistoryCursor] = useState<number | null | undefined>(
      undefined,
    );
  const selection = useRef(0),
    reviewHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (review) reviewHeading.current?.focus();
  }, [review]);
  const [reading, setReading] = useState(false);
  useEffect(() => {
    let active = true;
    api<{ status: string; accountId: string }>('/api/account')
      .then((a) => {
        if (active) setAccount(a);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  async function preview(kind: Kind) {
    setBusy(true);
    setError('');
    setMessage('');
    setConfirm('');
    try {
      setReview(
        await api<Review>('/api/recovery', {
          method: 'POST',
          body: JSON.stringify({
            action: 'preview',
            kind,
            ...(kind === 'restore' ? { file } : {}),
          }),
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open
      locked={busy && !!review}
      onClose={onClose}
      title="Your account data"
      description="Keep a recovery copy and control the journal stored by Stride."
      wide
    >
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {message && <output className="notice">{message}</output>}
      {!review ? (
        <>
          {account?.storage && (
            <p className="notice">
              Journal storage: {Math.ceil(account.storage.journalBytes / 1000)}{' '}
              / 1,500 KB. Running saved before a plan:{' '}
              {Math.ceil(account.storage.preplanBytes / 1000)} / 500 KB. Keep
              regular recovery copies. This release has a bounded journal; years
              of history will need the planned separate activity store before
              these limits are reached.
            </p>
          )}
          <section className="form-section">
            <h3>Keep a recovery copy</h3>
            <p>
              The file contains your current plan, completed and extra runs,
              notes, and profile. Connection keys and watch delivery claims are
              excluded.
            </p>
            <a
              className="primary-button"
              href="/api/export?format=recovery"
              download
            >
              Download recovery copy
            </a>
            <details className="reason-details">
              <summary>Revision history</summary>
              <p>
                Older plan snapshots download in pages of up to 20, with a size
                limit for large journals. The recovery copy contains your
                current running journal; these separate pages are for audit.
              </p>
              <BusyButton
                busy={busy}
                busyLabel="Preparing your download…"
                className="secondary-button"
                disabled={busy || historyCursor === null}
                onClick={async () => {
                  setBusy(true);
                  setError('');
                  try {
                    const data = await api<{
                      historyPage: { nextBefore: number | null };
                    }>(
                      '/api/export' +
                        (historyCursor ? '?before=' + historyCursor : ''),
                    );
                    downloadFile(
                      JSON.stringify(data, null, 2),
                      `stride-revisions-${historyCursor ?? 'latest'}.json`,
                      'application/json',
                    );
                    setHistoryCursor(data.historyPage.nextBefore);
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {historyCursor === null
                  ? 'All revision pages downloaded'
                  : historyCursor
                    ? 'Download earlier revisions'
                    : 'Download recent revisions'}
              </BusyButton>
            </details>
          </section>
          <section className="form-section">
            <h3>Restore a copy</h3>
            <p>
              Choose a Stride recovery file or an earlier journal export. Review
              its recorded running before replacing your current journal.
            </p>
            <Field label="Recovery file">
              <input
                type="file"
                accept=".json,application/json"
                disabled={busy}
                onChange={async (e) => {
                  const generation = ++selection.current;
                  setError('');
                  setReview(null);
                  setFile(null);
                  setFilename('');
                  setReading(false);
                  const selected = e.target.files?.[0];
                  if (!selected) return;
                  setFilename(selected.name);
                  if (selected.size > 2100000) {
                    setError(
                      'Choose a recovery file smaller than 2 MB. Larger files need an assisted recovery.',
                    );
                    return;
                  }
                  setReading(true);
                  try {
                    const contents = await withActionProgress(
                      'Reading your recovery copy…',
                      async () => JSON.parse(await selected.text()),
                    );
                    if (generation === selection.current) setFile(contents);
                  } catch {
                    if (generation === selection.current)
                      setError(
                        'This is not a readable JSON recovery file. Your journal is unchanged.',
                      );
                  } finally {
                    if (generation === selection.current) setReading(false);
                  }
                }}
              />
            </Field>
            {filename && <p className="subtle recovery-filename">{filename}</p>}
            <BusyButton
              busy={busy}
              busyLabel="Checking this recovery copy…"
              className="secondary-button"
              disabled={busy || reading || !file}
              onClick={() => void preview('restore')}
            >
              {busy ? 'Checking…' : 'Review this recovery copy'}
            </BusyButton>
          </section>
          <section className="form-section">
            <h3>
              {account?.status === 'closed'
                ? 'Journal closed'
                : 'Delete Stride journal'}
            </h3>
            <p>
              Deletion removes your training records, profile, stored connection
              key and revisions. It does not delete your ChatGPT account or
              workouts already held by another provider. Minimal account
              metadata remains to prevent stale requests from restoring deleted
              records.
            </p>
            <button
              className="secondary-button"
              disabled={busy || !account}
              onClick={() =>
                void preview(account?.status === 'closed' ? 'reopen' : 'delete')
              }
            >
              {account?.status === 'closed'
                ? 'Open an empty journal'
                : 'Review journal deletion'}
            </button>
          </section>
        </>
      ) : (
        <>
          <h3 ref={reviewHeading} tabIndex={-1}>
            Review account change
          </h3>
          <p className="notice">{review.warning}</p>
          <div className="recovery-metrics">
            <div>
              <strong>
                {review.current.completed + review.current.extraRuns}
              </strong>
              <span>currently recorded runs</span>
            </div>
            <div>
              <strong>
                {review.replacement.completed + review.replacement.extraRuns}
              </strong>
              <span>recorded runs after this change</span>
            </div>
            <div>
              <strong>{review.replacement.planned}</strong>
              <span>planned sessions after this change</span>
            </div>
          </div>
          {review.profileName && <p>Restored profile: {review.profileName}</p>}
          <Field
            label={`Type ${review.kind === 'delete' ? 'DELETE' : review.kind === 'restore' ? 'REPLACE' : 'OPEN'} to confirm`}
          >
            <input
              disabled={busy}
              autoComplete="off"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>
          <p className="subtle">
            Review expires in ten minutes. Any new journal, profile or
            connection change requires a fresh review.
          </p>
          <div className="modal-actions">
            <button
              className="text-button"
              disabled={busy}
              onClick={() => setReview(null)}
            >
              Keep current journal
            </button>
            <BusyButton
              busy={busy}
              busyLabel="Updating your journal…"
              className="primary-button"
              disabled={
                busy ||
                confirm !==
                  (review.kind === 'delete'
                    ? 'DELETE'
                    : review.kind === 'restore'
                      ? 'REPLACE'
                      : 'OPEN')
              }
              onClick={async () => {
                setBusy(true);
                setError('');
                try {
                  await api('/api/recovery', {
                    method: 'POST',
                    body: JSON.stringify({
                      action: 'commit',
                      kind: review.kind,
                      id: review.id,
                      confirm,
                      ...(review.kind === 'restore' ? { file } : {}),
                    }),
                  });
                  const kind = review.kind;
                  setReview(null);
                  setConfirm('');
                  setFile(null);
                  setFilename('');
                  setHistoryCursor(undefined);
                  setMessage(
                    kind === 'delete'
                      ? 'Your local journal is deleted.'
                      : kind === 'restore'
                        ? 'Your recovery copy is restored. Review external calendar copies before reconnecting.'
                        : 'Your empty journal is open. You can build a new plan.',
                  );
                  try {
                    await onSaved();
                    setAccount(await api('/api/account'));
                  } catch {
                    setError(
                      'The change was saved, but the refreshed journal could not be loaded. Close this panel and reload before making another change.',
                    );
                  }
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy
                ? 'Saving…'
                : review.kind === 'delete'
                  ? 'Delete my local journal'
                  : review.kind === 'restore'
                    ? 'Restore this copy'
                    : 'Open journal'}
            </BusyButton>
          </div>
        </>
      )}
    </Modal>
  );
}

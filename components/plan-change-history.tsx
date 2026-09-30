'use client';
import { useEffect, useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { api } from '@/lib/client-api';
import { dateLabel } from '@/lib/plan/calendar';
import {
  revisionLabel,
  type RevisionMetadata,
  type RevisionReview,
} from '@/lib/revision-review';
import type { WorkoutComparisonRow } from '@/lib/plan-change-summary';

function Comparison({
  label,
  rows,
}: {
  label: string;
  rows: WorkoutComparisonRow[];
}) {
  return (
    <table className="prescription-comparison" aria-label={label}>
      <thead>
        <tr className="prescription-comparison-head">
          <th scope="col">Change</th>
          <th scope="col">Before</th>
          <th scope="col">After</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr
            key={`${row.label}-${i}`}
            className="prescription-comparison-row"
            data-changed={row.changed}
          >
            <th scope="row">{row.label}</th>
            <td>{row.before}</td>
            <td>{row.after}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function RevisionComparison({ review }: { review: RevisionReview }) {
  return (
    <>
      <p>{review.explanation}</p>
      {review.preferences.length > 0 ? (
        <Comparison
          label="Saved preferences before and after"
          rows={review.preferences}
        />
      ) : (
        !review.boundary && (
          <p className="subtle">
            Your saved training preferences did not change.
          </p>
        )
      )}
      {!review.boundary && (
        <p className="subtle">
          {review.totalSessions}{' '}
          {review.totalSessions === 1 ? 'session changed' : 'sessions changed'}.
          {review.recordedChanges > 0 &&
            ` Recorded details changed for ${review.recordedChanges} ${review.recordedChanges === 1 ? 'run' : 'runs'}; private notes remain in your journal.`}
        </p>
      )}
      <div className="session-change-list">
        {review.sessions.map((session) => (
          <article className="session-change" key={session.id}>
            <header className="session-change-heading">
              <div>
                <span>{dateLabel(session.date)}</span>
                <h4>{session.title}</h4>
              </div>
              <span className="session-change-kind" data-kind={session.kind}>
                {session.kind}
              </span>
            </header>
            <Comparison
              label={`${dateLabel(session.date)} ${session.title} changes`}
              rows={session.rows}
            />
          </article>
        ))}
      </div>
      <details className="reason-details">
        <summary>Saved training rules</summary>
        <p className="subtle">
          {review.versions.before
            ? `Before: engine ${review.versions.before.engine}, policy ${review.versions.before.policy}. `
            : 'No previous training rules recorded. '}
          {review.versions.after
            ? `After: engine ${review.versions.after.engine}, policy ${review.versions.after.policy}.`
            : 'No plan saved in this revision.'}
        </p>
      </details>
    </>
  );
}

export type PlanChangeHistoryProps = {
  history: RevisionMetadata[];
  currentVersion: number;
  onUndo: () => void;
  busy: boolean;
};

export function PlanChangeHistory({
  history,
  currentVersion,
  onUndo,
  busy,
}: PlanChangeHistoryProps) {
  const [selected, setSelected] = useState<number | null>(null),
    [review, setReview] = useState<RevisionReview | null>(null),
    [offset, setOffset] = useState(0),
    [attempt, setAttempt] = useState(0),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(''),
    [showAll, setShowAll] = useState(false);
  const id = useId();
  useEffect(() => {
    if (selected === null) return;
    let active = true;
    const controller = new AbortController();
    api<RevisionReview>(
      `/api/history?version=${selected}&offset=${offset}`,
      { signal: controller.signal },
      false,
    )
      .then((result) => {
        if (!active) return;
        setReview((previous) =>
          offset > 0 && previous?.revision.version === result.revision.version
            ? {
                ...result,
                sessions: [
                  ...new Map(
                    [...previous.sessions, ...result.sessions].map((s) => [
                      s.id,
                      s,
                    ]),
                  ).values(),
                ],
              }
            : result,
        );
      })
      .catch((e: unknown) => {
        if (active)
          setError(
            e instanceof Error
              ? e.message
              : 'This change could not be loaded. Try again.',
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [selected, offset, attempt, currentVersion]);
  if (!history.length) return null;
  const latest = history[0],
    previous = history[1];
  const recoveryBoundary =
    latest.label.startsWith('Restored a recovery') ||
    latest.label === 'Opened an empty journal' ||
    previous?.label === 'Opened an empty journal';
  return (
    <section className="plan-change-history" aria-label="Plan change history">
      <div className="section-heading section-space">
        <h3>Recent changes</h3>
        <button
          className="text-button"
          disabled={
            !previous ||
            latest.version !== currentVersion ||
            busy ||
            recoveryBoundary
          }
          onClick={onUndo}
        >
          Undo last change
        </button>
      </div>
      <p className="subtle">
        Review what changed in your saved plan. Undo restores the previous plan
        while preserving recorded runs. Workouts already copied to a watch or
        calendar may need an update.
      </p>
      {recoveryBoundary && (
        <p className="subtle">
          Undo does not cross a recovery boundary. Use Account data to restore
          another copy.
        </p>
      )}
      {(showAll ? history : history.slice(0, 5)).map((item) => {
        const expanded = selected === item.version;
        return (
          <div className="plan-change-item" key={item.version}>
            <button
              type="button"
              className="plan-change-toggle"
              aria-expanded={expanded}
              aria-controls={`${id}-${item.version}`}
              onClick={() => {
                setSelected(expanded ? null : item.version);
                setReview(null);
                setOffset(0);
                setError('');
                setLoading(!expanded);
              }}
            >
              <span className="plan-change-copy">
                <strong>{revisionLabel(item.label)}</strong>
                <small>
                  {new Date(item.created_at).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                  })}{' '}
                  · Revision {item.version}
                </small>
              </span>
              <ChevronDown size={18} aria-hidden="true" />
            </button>
            {expanded && (
              <div
                id={`${id}-${item.version}`}
                className="plan-change-content preference-inspection"
                aria-busy={loading}
              >
                {loading && <output>Loading saved changes…</output>}
                {error && (
                  <div className="notice error" role="alert">
                    <p>{error}</p>
                    <button
                      className="text-button"
                      disabled={loading}
                      onClick={() => {
                        setLoading(true);
                        setError('');
                        setAttempt((n) => n + 1);
                      }}
                    >
                      Try again
                    </button>
                  </div>
                )}
                {review?.revision.version === item.version && (
                  <>
                    <RevisionComparison review={review} />
                    {review.nextOffset !== null && (
                      <button
                        className="secondary-button"
                        disabled={loading || !!error}
                        onClick={() => {
                          setLoading(true);
                          setOffset(review.nextOffset!);
                        }}
                      >
                        Show more session changes ({review.sessions.length} of{' '}
                        {review.totalSessions})
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
      {history.length > 5 && (
        <button className="text-button" onClick={() => setShowAll(!showAll)}>
          {showAll
            ? 'Show fewer changes'
            : `Show all ${history.length} recent changes`}
        </button>
      )}
    </section>
  );
}

'use client';
import { duration, mainSetSummary, recoverySummary } from '@/lib/workout-names';
import { BusyButton } from './action-progress';
import { runDuration } from '@/lib/journal-view';
import { useEffect, useState } from 'react';
import { Modal, api } from './stride-ui';
import { dateLabel, type Plan, type Workout } from '@/lib/engine';
import type { Action } from './workout-detail';
export default function TrainingReview({
  plan,
  version,
  action,
  onAction,
  onClose,
  onRefresh,
  busy,
}: {
  plan: Plan;
  version: number;
  action: 'advanceReturn' | 'advanceRunWalk' | 'variety';
  onAction: Action;
  onClose: () => void;
  onRefresh: () => Promise<unknown>;
  busy: boolean;
}) {
  const [preview, setPreview] = useState<{
      plan: Plan;
      version: number;
      effectiveDate: string;
      fingerprint?: string;
    } | null>(null),
    [error, setError] = useState(''),
    [reviewAttempt, setReviewAttempt] = useState(0),
    [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    let active = true;
    api<{
      plan: Plan;
      version: number;
      effectiveDate: string;
      fingerprint?: string;
    }>('/api/plan', {
      method: 'POST',
      body: JSON.stringify({
        action:
          action === 'variety'
            ? 'varietyPreview'
            : action === 'advanceReturn'
              ? 'returnPreview'
              : 'runWalkPreview',
        version,
      }),
    })
      .then((r) => {
        if (active) setPreview(r);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [action, version, reviewAttempt]);
  const changes =
    preview?.plan.workouts.filter((w) => {
      const old = plan.workouts.find((s) => s.id === w.id);
      return (
        !old ||
        old.minutes !== w.minutes ||
        old.title !== w.title ||
        old.status !== w.status ||
        JSON.stringify(old.steps) !== JSON.stringify(w.steps)
      );
    }) ?? [];
  const longestStep = (workouts: Workout[], movement: 'run' | 'walk') =>
    workouts.reduce(
      (maximum, w) =>
        w.steps.reduce(
          (value, step) =>
            step.movement === movement ? Math.max(value, step.seconds) : value,
          maximum,
        ),
      0,
    );
  const walkChanges =
    action === 'advanceRunWalk'
      ? changes.filter((w) => w.status === 'planned')
      : [];
  const previousWalks = plan.workouts.filter((w) =>
    walkChanges.some((next) => next.id === w.id),
  );
  return (
    <Modal
      open
      onClose={onClose}
      title={
        action === 'variety'
          ? 'Fresh sessions, same routine'
          : 'Review the next training stage'
      }
      description={
        action === 'variety'
          ? 'Explore different workout structures for your goal, with the same running days and training time.'
          : 'Based on completed running. Review the changes before applying them.'
      }
      wide
      locked={busy || (!preview && !error)}
    >
      {error && (
        <div>
          <p className="notice error" role="alert">
            {error}
          </p>
          <BusyButton
            className="secondary-button"
            busy={refreshing}
            busyLabel="Refreshing your plan…"
            disabled={refreshing}
            onClick={async () => {
              setRefreshing(true);
              try {
                await onRefresh();
                setPreview(null);
                setError('');
                setReviewAttempt((value) => value + 1);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setRefreshing(false);
              }
            }}
          >
            Review again
          </BusyButton>
        </div>
      )}
      {!preview && !error && (
        <output>
          {action === 'variety'
            ? 'Preparing your workout mix…'
            : 'Preparing your next stage…'}
        </output>
      )}
      {preview && (
        <>
          {walkChanges.length > 0 && (
            <section className="notice" aria-label="Run-walk stage change">
              <strong>Longer running intervals, with walking breaks</strong>
              <p>
                Longest running interval:{' '}
                {duration(longestStep(previousWalks, 'run'))}
                {' → '}
                {duration(longestStep(walkChanges, 'run'))}. Walking recoveries:
                up to {duration(longestStep(walkChanges, 'walk'))}.
              </p>
              <p>
                Your running days stay the same. Each session keeps its time
                limit.
              </p>
            </section>
          )}
          <p className="notice">
            {action === 'variety'
              ? `Updates begin ${dateLabel(preview.effectiveDate)}. The next seven days, logged runs and workouts already sent through Intervals stay as they are.`
              : (preview.plan.baselineEvidence?.explanation ??
                'The next stage stays within your previous training ceilings.')}
          </p>
          {action !== 'variety' &&
            preview.plan.feasibility?.reasons.map((reason) => (
              <p className="notice" key={reason}>
                {reason}
              </p>
            ))}
          {action === 'variety' && !changes.length && (
            <p>
              Your eligible sessions already use the current workout mix. Easy,
              recovery and race-week runs keep their familiar structure.
            </p>
          )}
          <div
            className={`changed-runs${action === 'variety' ? ' variety-review-list' : ''}`}
          >
            {changes.map((w) => (
              <div key={w.id}>
                <span>{dateLabel(w.date)}</span>
                <strong>
                  {w.title}
                  {action === 'variety' && (
                    <small className="subtle">
                      {mainSetSummary(w)}
                      <span className="variety-recovery">
                        {recoverySummary(w)}
                      </span>
                    </small>
                  )}
                </strong>
                <span>
                  {w.status === 'skipped'
                    ? 'Rest'
                    : `${runDuration(w.minutes)}`}
                </span>
              </div>
            ))}
          </div>

          <div className="form-actions">
            <button className="secondary-button" onClick={onClose}>
              {action === 'variety' ? 'Keep my workouts' : 'Keep current stage'}
            </button>
            <BusyButton
              busy={busy}
              busyLabel={
                action === 'variety'
                  ? 'Saving your workout mix…'
                  : 'Saving your next stage…'
              }
              className="primary-button"
              disabled={busy || (action === 'variety' && !changes.length)}
              onClick={async () => {
                setError('');
                try {
                  await onAction(action, {
                    version: preview.version,
                    effectiveDate: preview.effectiveDate,
                    fingerprint: preview.fingerprint,
                  });
                  onClose();
                } catch (e) {
                  setPreview(null);
                  setError((e as Error).message);
                }
              }}
            >
              {busy
                ? 'Saving…'
                : action === 'variety'
                  ? 'Use these workouts'
                  : 'Apply this stage'}
            </BusyButton>
          </div>
        </>
      )}
    </Modal>
  );
}

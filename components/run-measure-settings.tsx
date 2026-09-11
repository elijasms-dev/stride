'use client';
import { useState } from 'react';
import { type Plan, dateLabel, workoutDistanceLabel } from '@/lib/engine';
import { prescribedDistanceKm } from '@/lib/run-distance';
import { runDuration } from '@/lib/journal-view';
import { Modal, Choice, Field, api } from './stride-ui';
import { BusyButton } from './action-progress';
import type { Action } from './workout-detail';

type Preview = {
  plan: Plan;
  version: number;
  effectiveDate: string;
  fingerprint: string;
  protectedCount: number;
};
export default function RunMeasureSettings({
  plan,
  version,
  busy,
  onAction,
  onClose,
}: {
  plan: Plan;
  version: number;
  busy: boolean;
  onAction: Action;
  onClose: () => void;
}) {
  const [measure, setMeasure] = useState<'distance' | 'time'>('distance');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const locked = busy || loading;
  const changed =
    preview?.plan.workouts.filter(
      (w) =>
        JSON.stringify(w.steps) !==
        JSON.stringify(plan.workouts.find((old) => old.id === w.id)?.steps),
    ) ?? [];
  async function review() {
    setLoading(true);
    setError('');
    try {
      setPreview(
        await api<Preview>(
          '/api/plan',
          {
            method: 'POST',
            body: JSON.stringify({
              action: 'runMeasurePreview',
              measure,
              version,
            }),
          },
          false,
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <Modal
      open
      title={preview ? 'Your run targets' : 'Run by distance'}
      onClose={onClose}
      locked={locked}
      description="A clear distance to cover, with time kept as a planning estimate."
    >
      {!preview ? (
        <>
          <Field label="Easy and long runs">
            <Choice
              label="Easy and long runs"
              value={measure}
              onChange={(v) => setMeasure(v as 'distance' | 'time')}
              options={[
                { value: 'distance', label: 'Distance targets · e.g. 20 km' },
                { value: 'time', label: 'Time targets · e.g. 100 min' },
              ]}
            />
          </Field>
          <p className="subtle">
            Keep your running days and workout structure. Distances are rounded
            down within your existing training allowance. Run-walk sessions,
            recoveries and timed quality repetitions keep their intended format.
          </p>
          <BusyButton
            className="primary-button"
            disabled={locked}
            busy={loading}
            busyLabel="Preparing your targets…"
            onClick={() => void review()}
          >
            Preview my runs
          </BusyButton>
        </>
      ) : (
        <>
          <p>
            <strong>
              {changed.length} upcoming{' '}
              {changed.length === 1 ? 'run changes' : 'runs change'}.
            </strong>{' '}
            Your schedule and recorded history stay in place.
          </p>
          {preview.protectedCount > 0 && (
            <p className="notice">
              {preview.protectedCount} workouts already have a watch-delivery
              record and keep their saved targets. Manually edited runs also
              stay as you set them.
            </p>
          )}
          {measure === 'distance' && (
            <p className="subtle">
              Distance is the finish point. Follow the effort cues, and stop
              earlier if you reach your available time limit.
            </p>
          )}
          <div className="target-preview-list">
            {changed.slice(0, 8).map((w) => (
              <article className="target-sample" key={w.id}>
                <small>{dateLabel(w.date)}</small>
                <strong>{w.title}</strong>
                <p>
                  {workoutDistanceLabel(w, preview.plan.profile)} ·{' '}
                  {runDuration(w.minutes)}{' '}
                  {prescribedDistanceKm(w) !== null
                    ? 'estimated'
                    : 'prescribed'}
                </p>
              </article>
            ))}
          </div>
          {changed.length > 8 && (
            <p className="subtle">
              And {changed.length - 8} later runs in this block.
            </p>
          )}
          {!changed.length && (
            <p className="subtle">
              This preference will apply to new runs. No eligible upcoming
              sessions need changing.
            </p>
          )}
          <div className="form-actions">
            <button
              className="secondary-button"
              disabled={locked}
              onClick={() => setPreview(null)}
            >
              Back
            </button>
            <BusyButton
              className="primary-button"
              disabled={locked}
              busy={busy}
              busyLabel="Saving run targets…"
              onClick={async () => {
                setError('');
                try {
                  if (version !== preview.version)
                    throw new Error(
                      'Your plan changed. Preview the targets again.',
                    );
                  await onAction('runMeasure', {
                    measure,
                    version: preview.version,
                    effectiveDate: preview.effectiveDate,
                    fingerprint: preview.fingerprint,
                  });
                  onClose();
                } catch (e) {
                  setError((e as Error).message);
                  setPreview(null);
                }
              }}
            >
              Use {measure} targets
            </BusyButton>
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
    </Modal>
  );
}

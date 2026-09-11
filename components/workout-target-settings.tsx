'use client';
import { useState } from 'react';
import { type Plan, dateLabel } from '@/lib/engine';
import {
  TARGET_BANDS,
  targetBandLabels,
  paceText,
  parsePace,
  targetLabel,
  validateWorkoutTargets,
  type WorkoutTargets,
  type TargetBand,
} from '@/lib/workout-targets';
import { Modal, Field, api } from './stride-ui';
import { BusyButton } from './action-progress';
import type { Action } from './workout-detail';
type Values = Record<TargetBand, { low: string; high: string }>;
type Preview = {
  plan: Plan;
  version: number;
  effectiveDate: string;
  fingerprint: string;
  protectedCount: number;
};
export default function WorkoutTargetSettings({
  plan,
  version,
  onAction,
  onClose,
  busy,
}: {
  plan: Plan;
  version: number;
  onAction: Action;
  onClose: () => void;
  busy: boolean;
}) {
  const saved = plan.profile.workoutTargets ?? { mode: 'effort' };
  const unit = plan.profile.units;
  const [mode, setMode] = useState<WorkoutTargets['mode']>(saved.mode);
  const values = (kind: 'pace' | 'heartRate'): Values =>
    Object.fromEntries(
      TARGET_BANDS.map((band) => {
        const range = saved[kind]?.[band];
        return [
          band,
          {
            low: range
              ? kind === 'pace'
                ? paceText(range.low, unit)
                : String(range.low)
              : '',
            high: range
              ? kind === 'pace'
                ? paceText(range.high, unit)
                : String(range.high)
              : '',
          },
        ];
      }),
    ) as Values;
  const [pace, setPace] = useState(() => values('pace'));
  const [hr, setHr] = useState(() => values('heartRate'));
  const [preview, setPreview] = useState<Preview | null>(null);
  const [config, setConfig] = useState<WorkoutTargets | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const changed =
    preview?.plan.workouts
      .filter(
        (w) =>
          JSON.stringify(w.steps) !==
          JSON.stringify(plan.workouts.find((old) => old.id === w.id)?.steps),
      )
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          (a.startTime ?? '').localeCompare(b.startTime ?? ''),
      ) ?? [];
  async function review() {
    setError('');
    setLoading(true);
    try {
      const next: WorkoutTargets = { ...saved, mode };
      if (mode !== 'effort') {
        const key = mode === 'pace' ? 'pace' : 'heartRate';
        next[key] = {};
        for (const band of TARGET_BANDS) {
          const raw = (mode === 'pace' ? pace : hr)[band];
          if (!raw.low.trim() && !raw.high.trim()) continue;
          const savedRange = saved[key]?.[band];
          const low =
            mode === 'pace'
              ? savedRange && raw.low === paceText(savedRange.low, unit)
                ? savedRange.low
                : parsePace(raw.low, unit)
              : raw.low.trim()
                ? Number(raw.low)
                : null;
          const high =
            mode === 'pace'
              ? savedRange && raw.high === paceText(savedRange.high, unit)
                ? savedRange.high
                : parsePace(raw.high, unit)
              : raw.high.trim()
                ? Number(raw.high)
                : null;
          if (low === null || high === null)
            throw new Error(
              `${targetBandLabels[band]}: enter both ends of the range${mode === 'pace' ? ' as minutes:seconds' : ''}.`,
            );
          next[key]![band] = { low, high };
        }
      }
      const targets = validateWorkoutTargets(next);
      const result = await api<Preview>('/api/plan', {
        method: 'POST',
        body: JSON.stringify({ action: 'targetsPreview', version, targets }),
      });
      setConfig(targets);
      setPreview(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={preview ? 'Review your targets' : 'Workout targets'}
      description={
        preview
          ? 'Your schedule and workout duration stay the same.'
          : 'Choose how you want your runs guided.'
      }
      locked={busy || loading}
    >
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {!preview ? (
        <>
          <div className="target-mode-picker" aria-label="Workout target mode">
            {(
              [
                ['effort', 'Effort', 'How it feels'],
                ['pace', 'Pace', `Time per ${unit}`],
                ['heart-rate', 'Heart rate', 'Beats per minute'],
              ] as const
            ).map(([value, label, hint]) => (
              <button
                key={value}
                aria-pressed={mode === value}
                onClick={() => {
                  setMode(value);
                  setError('');
                }}
              >
                {label}
                <small>{hint}</small>
              </button>
            ))}
          </div>
          {mode === 'effort' ? (
            <p>
              Follow the breathing and effort cues in each step. No pace or
              heart-rate alerts are prescribed.
            </p>
          ) : (
            <>
              <p>
                Use ranges from your recent training or coach. Start with easy
                running; leave any other range blank to keep those sessions on
                effort.
              </p>
              {mode === 'pace' && (
                <p className="subtle">
                  Pace ranges round outward to whole seconds per kilometre for
                  consistent watch targets. Review shows the exact range in your
                  units.
                </p>
              )}
              {TARGET_BANDS.map((band, index) => (
                <div className="target-range-row" key={band}>
                  <h3>
                    {targetBandLabels[band]}{' '}
                    {index === 0 ? (
                      ''
                    ) : (
                      <span className="subtle">· optional</span>
                    )}
                  </h3>
                  {band === 'race' && (
                    <p className="subtle">
                      Use the pace or heart rate for this block’s goal. Review
                      this range when changing race distance.
                    </p>
                  )}
                  <div className="target-range-fields">
                    {(['low', 'high'] as const).map((bound) => (
                      <Field
                        key={bound}
                        label={`${mode === 'pace' ? (bound === 'low' ? 'Faster' : 'Slower') : bound === 'low' ? 'Lower' : 'Upper'} ${mode === 'pace' ? `/${unit}` : 'bpm'}`}
                      >
                        <input
                          aria-label={`${targetBandLabels[band]} ${bound === 'low' ? 'lower' : 'upper'} ${mode === 'pace' ? 'pace' : 'heart rate'}`}
                          inputMode={mode === 'pace' ? 'text' : 'numeric'}
                          autoComplete="off"
                          placeholder={mode === 'pace' ? 'm:ss' : 'bpm'}
                          value={(mode === 'pace' ? pace : hr)[band][bound]}
                          onChange={(e) => {
                            const value = e.target.value;
                            (mode === 'pace' ? setPace : setHr)((old) => ({
                              ...old,
                              [band]: { ...old[band], [bound]: value },
                            }));
                            setError('');
                          }}
                        />
                      </Field>
                    ))}
                  </div>
                </div>
              ))}
              <p className="subtle">
                Hills, walking, recovery steps and double-threshold sessions
                keep their existing effort cues. Short efforts use effort in
                heart-rate mode; don’t speed up just to chase a reading.
              </p>
              {mode === 'heart-rate' && (
                <p className="notice">
                  BPM targets work in Stride and Garmin FIT downloads. Direct
                  sending of BPM targets through Intervals is not supported yet;
                  use a FIT download or choose effort or pace for direct
                  sending.
                </p>
              )}
            </>
          )}
          <div className="form-actions target-form-actions">
            <button
              className="secondary-button"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <BusyButton
              className="primary-button"
              busy={loading}
              busyLabel="Preparing your targets…"
              disabled={loading}
              onClick={() => void review()}
            >
              Review targets
            </BusyButton>
          </div>
        </>
      ) : (
        <>
          <p>
            {changed.length} upcoming{' '}
            {changed.length === 1 ? 'workout' : 'workouts'} will use your{' '}
            {mode === 'heart-rate' ? 'heart-rate' : mode} settings.
          </p>
          {changed.some(
            (w) =>
              !w.steps.some((s) => s.metres !== undefined) &&
              plan.workouts
                .find((old) => old.id === w.id)
                ?.steps.some((s) => s.metres !== undefined),
          ) && (
            <p className="target-note">
              Some distance sets need more time at your new pace. Their preview
              uses timed repetitions to keep your existing session length and
              recoveries.
            </p>
          )}
          {preview.protectedCount > 0 && (
            <p className="notice">
              {preview.protectedCount} upcoming workouts have a watch-delivery
              record and keep their existing targets. Recorded and past runs
              also stay unchanged.
            </p>
          )}
          {!changed.length && (
            <p className="subtle">
              These preferences will be saved for future workouts. There are no
              eligible step targets to change in this block.
            </p>
          )}
          {changed.slice(0, 3).map((w) => (
            <article className="target-sample" key={w.id}>
              <small>{dateLabel(w.date)}</small>
              <strong>{w.title}</strong>
              <ul>
                {w.steps.map((s, index) => (
                  <li key={index}>
                    {s.label} · {targetLabel(s.target, unit)}
                  </li>
                ))}
              </ul>
            </article>
          ))}
          {changed.length > 3 && (
            <p className="subtle">
              The same rules apply to the remaining {changed.length - 3}{' '}
              workouts.
            </p>
          )}
          <div className="form-actions target-form-actions">
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => {
                setPreview(null);
                setError('');
              }}
            >
              Edit ranges
            </button>
            <BusyButton
              className="primary-button"
              busy={busy}
              busyLabel="Saving your targets…"
              disabled={busy}
              onClick={async () => {
                setError('');
                try {
                  if (version !== preview.version)
                    throw new Error(
                      'Your plan changed. Review your targets again.',
                    );
                  await onAction('targets', {
                    targets: config,
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
              Save targets
            </BusyButton>
          </div>
        </>
      )}
    </Modal>
  );
}

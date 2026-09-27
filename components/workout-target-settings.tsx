'use client';
import { useState } from 'react';
import { type Plan, dateLabel } from '@/lib/engine';
import {
  TARGET_BANDS,
  targetBandLabels,
  targetLabel,
  benchmarkWorkoutTargets,
  type WorkoutTargets,
} from '@/lib/workout-targets';
import { Modal, Field, api } from './stride-ui';
import { BusyButton } from './action-progress';
import type { Action } from './workout-detail';
import { pacingEvidence } from '@/lib/fitness-pacing';
import { todayInZone, eventDistanceDisplay } from '@/lib/engine';
import { elapsedTimeText } from '@/lib/benchmark-input';
import {
  initialTargetSettings,
  targetSettingsConfig,
} from '@/lib/workout-target-form';
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
  const unit = plan.profile.units;
  const initial = initialTargetSettings(plan.profile);
  const [mode, setMode] = useState(initial.mode);
  const [pace, setPace] = useState(initial.pace);
  const [hr, setHr] = useState(initial.heartRate);
  const automaticTargets = benchmarkWorkoutTargets(plan.profile);
  const evidence = pacingEvidence(
    plan.profile,
    todayInZone(plan.profile.timezone),
  );
  const [preview, setPreview] = useState<Preview | null>(null);
  const [config, setConfig] = useState<WorkoutTargets | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const changed =
    preview?.plan.workouts
      .filter(
        (w) =>
          JSON.stringify(w) !==
          JSON.stringify(plan.workouts.find((old) => old.id === w.id)),
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
      const targets = targetSettingsConfig(plan.profile, {
        mode,
        pace,
        heartRate: hr,
      });
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
          <div
            className="target-mode-picker"
            aria-label="Workout target mode"
            style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}
          >
            {(
              [
                [
                  'automatic',
                  'Automatic',
                  plan.profile.recentRace
                    ? 'From your benchmark'
                    : 'Effort until a benchmark',
                ],
                ['effort', 'Effort', 'How it feels'],
                ['pace', 'Manual pace', `Time per ${unit}`],
                ['heart-rate', 'Manual heart rate', 'Beats per minute'],
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
          {mode === 'automatic' ? (
            <section aria-label="Automatic target source">
              {automaticTargets ? (
                <>
                  <p>
                    Your{' '}
                    {eventDistanceDisplay(
                      plan.profile.recentRace!.distanceKm,
                      unit,
                    )}{' '}
                    {unit} result in{' '}
                    {elapsedTimeText(plan.profile.recentRace!.timeMinutes)}{' '}
                    supplies estimated training paces. These are coaching
                    estimates, not measured zones or guaranteed race times.
                  </p>
                  <dl className="target-range-row">
                    {TARGET_BANDS.map((band) => {
                      const range = automaticTargets.pace?.[band];
                      return range ? (
                        <div key={band}>
                          <dt>{targetBandLabels[band]}</dt>
                          <dd>
                            {targetLabel({ ...range, mode: 'pace' }, unit)}
                          </dd>
                        </div>
                      ) : null;
                    })}
                  </dl>
                  <p className="subtle">
                    Controlled tempo, threshold and repetitions have separate
                    ranges. Walking, recoveries, run/walk sessions, hills and
                    short strides retain their effort cues. These are estimated
                    training ranges, not a measure of prediction confidence.
                  </p>
                  {evidence.notices.map((notice) => (
                    <p className="subtle" key={notice}>
                      {notice}
                    </p>
                  ))}
                  <p className="subtle">
                    If this result does not reflect current conditions or
                    fitness, choose effort or review manual ranges.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    {plan.profile.recentRace
                      ? 'This benchmark is outside the supported training-pace model. Runs keep their effort cues.'
                      : 'No benchmark is saved. Runs use effort cues until you add a recent race or time trial in plan preferences. Automatic mode will then use its estimated paces.'}
                  </p>
                  {plan.profile.recentRace &&
                    evidence.notices.map((notice) => (
                      <p className="subtle" key={notice}>
                        {notice}
                      </p>
                    ))}
                </>
              )}
            </section>
          ) : mode === 'effort' ? (
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
              {evidence.notices
                .filter(
                  (notice) =>
                    notice.startsWith('Your manual') ||
                    notice.startsWith('Your declared') ||
                    notice.startsWith('Your easy pace'),
                )
                .map((notice) => (
                  <p className="subtle" key={notice}>
                    {notice}
                  </p>
                ))}
              {plan.profile.workoutTargets?.bandsVersion === undefined &&
                (plan.profile.workoutTargets?.pace?.tempo ||
                  plan.profile.workoutTargets?.pace?.interval ||
                  plan.profile.workoutTargets?.heartRate?.tempo ||
                  plan.profile.workoutTargets?.heartRate?.interval) && (
                  <p className="subtle">
                    Previously shared ranges are shown separately so you can
                    review threshold and repetition targets for each effort.
                  </p>
                )}
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
                Hills, run/walk sessions, recovery steps, short strides and
                double-threshold sessions keep their effort cues. Short efforts
                use effort in heart-rate mode; don’t speed up just to chase a
                reading.
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
            {mode === 'automatic'
              ? automaticTargets
                ? 'automatic benchmark'
                : 'automatic effort'
              : mode === 'heart-rate'
                ? 'heart-rate'
                : mode}{' '}
            settings.
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
              {JSON.stringify(preview.plan.profile.workoutTargets) ===
              JSON.stringify(plan.profile.workoutTargets)
                ? 'Your target preferences are unchanged. Saving will not rewrite your plan.'
                : 'The target source will be saved for future workouts. No eligible step targets change in this block.'}
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
              Edit target choice
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

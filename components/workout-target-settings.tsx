'use client';
import { useState } from 'react';
import { type Plan, type Profile, type Step, dateLabel } from '@/lib/engine';
import { targetLabel, type WorkoutTargets } from '@/lib/workout-targets';
import { validateRecentRace } from '@/lib/fitness-pacing';
import { todayInZone } from '@/lib/engine';
import { duration } from '@/lib/workout-names';
import { parseElapsedTime } from '@/lib/benchmark-input';
import {
  paceSettingsRows,
  initialPaceSettings,
  paceSettingsConfig,
  canOverridePacingRole,
  type PaceRowDraft,
} from '@/lib/pace-settings';
import { type PacingRole } from '@/lib/source-pacing';
import { Modal, Field, api } from './stride-ui';
import { BusyButton } from './action-progress';
import { RecentRaceFields } from './recent-race-fields';
import { DrawnUnderline, DrawnBracket } from './drawn-ui';
import type { Action } from './workout-detail';

type Preview = {
  plan: Plan;
  version: number;
  effectiveDate: string;
  fingerprint: string;
  protectedCount: number;
  qualityReview?: { title: string; message: string; nextSteps: string[] };
};
const inherited: PaceRowDraft = { mode: 'source', low: '', high: '' };
const origin = (step: Pick<Step, 'pacing' | 'target'>) =>
  step.pacing?.method === 'explicit-goal'
    ? 'Your race goal'
    : step.pacing?.method === 'same-distance-benchmark'
      ? 'Your reference result'
      : step.pacing?.method === 'manual-override' ||
          step.target?.source === 'manual'
        ? 'Your personal target'
        : step.pacing
          ? 'Programme guidance'
          : 'Previously saved guidance';

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
  const [profile, setProfile] = useState<Profile>(() =>
    structuredClone(plan.profile),
  );
  const [draft, setDraft] = useState(() =>
    initialPaceSettings(
      plan.profile,
      plan.workouts.filter((w) => w.week >= 0),
    ),
  );
  const [preview, setPreview] = useState<Preview | null>(null);
  const [config, setConfig] = useState<WorkoutTargets | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const goal = draft.goalTime.trim()
    ? parseElapsedTime(draft.goalTime)
    : undefined;
  const automaticProfile: Profile = {
    ...profile,
    workoutTargets: {
      mode: 'automatic',
      ...(goal && Number.isFinite(goal) ? { goalTimeMinutes: goal } : {}),
      raceScope: `${profile.goal}:${profile.raceDistanceKm ?? ''}`,
    },
  };
  const rows = paceSettingsRows(
    automaticProfile,
    plan.workouts.filter((w) => w.week >= 0),
  );
  const usesGoal =
    rows.some((row) => row.role === 'goal-race') || Boolean(draft.goalTime);
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
  const updateRow = (role: PacingRole, patch: Partial<PaceRowDraft>) => {
    setDraft((old) => ({
      ...old,
      rows: {
        ...old.rows,
        [role]: { ...(old.rows[role] ?? inherited), ...patch },
      },
    }));
    setError('');
  };
  const evidencePatch = () => ({
    recentRace: profile.recentRace
      ? validateRecentRace(profile.recentRace, todayInZone(profile.timezone))
      : null,
  });
  async function review() {
    setError('');
    setLoading(true);
    try {
      const targets = paceSettingsConfig(profile, draft);
      const pacing = evidencePatch();
      const result = await api<Preview>('/api/plan', {
        method: 'POST',
        body: JSON.stringify({
          action: 'targetsPreview',
          version,
          targets,
          pacing,
        }),
      });
      setConfig(targets);
      setPreview(result);
      setShowAll(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={preview ? 'Review your training paces' : 'Your training paces'}
      description={
        preview
          ? 'Review each change before it reaches your upcoming runs.'
          : 'Your current running, interpreted through your programme.'
      }
      locked={busy || loading}
    >
      <div className="pace-settings">
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        {!preview ? (
          <>
            <div className="pace-settings-layout">
              <aside className="pace-reference">
                <h3 className="ink-heading">
                  Start with your running
                  <DrawnUnderline />
                </h3>
                <RecentRaceFields profile={profile} onChange={setProfile} />
                {usesGoal && (
                  <Field
                    label="Your intended race time"
                    hint="Only sessions that explicitly ask for goal race pace use this. It does not change your current fitness. Enter h:mm:ss or m:ss."
                  >
                    <input
                      value={draft.goalTime}
                      placeholder="h:mm:ss"
                      autoComplete="off"
                      aria-label="Goal finish time"
                      onChange={(e) =>
                        setDraft((old) => ({
                          ...old,
                          goalTime: e.target.value,
                        }))
                      }
                    />
                  </Field>
                )}
                <p className="pace-reference-note">
                  A result supplies evidence. Your programme decides where a
                  numerical target belongs. Comfortable running can stay guided
                  by feel.
                </p>
              </aside>
              <section
                className="pace-prescriptions"
                aria-labelledby="pace-guidance-heading"
              >
                <h3 id="pace-guidance-heading">How your runs are guided</h3>
                <p className="subtle">
                  These are the instructions used in your plan. Personal changes
                  apply only to the row you edit.
                </p>
                {rows.map((row) => {
                  const choice = draft.rows[row.role] ?? inherited;
                  const editable =
                    canOverridePacingRole(row.role) && !plan.beginner;
                  const sourceSelected = !editable || choice.mode === 'source';
                  return (
                    <article className="pace-prescription" key={row.role}>
                      <div className="pace-prescription-heading">
                        <h4>{row.label}</h4>
                        <span className="pace-origin">
                          {sourceSelected
                            ? origin({ pacing: row, target: row.target })
                            : choice.mode === 'effort'
                              ? 'Your effort choice'
                              : 'Your personal target'}
                        </span>
                      </div>
                      {sourceSelected ? (
                        <>
                          <div
                            className={`pace-value ${row.target && row.target.low !== row.target.high ? 'ink-bracketed' : ''}`}
                          >
                            {row.target
                              ? targetLabel(row.target, unit)
                              : 'By effort'}
                            {row.target &&
                              row.target.low !== row.target.high && (
                                <DrawnBracket />
                              )}
                          </div>
                          <p>{row.guidance}</p>
                        </>
                      ) : choice.mode === 'effort' ? (
                        <p>{row.guidance}</p>
                      ) : (
                        <div className="pace-override-fields">
                          <Field
                            label={
                              choice.mode === 'pace'
                                ? `Pace /${unit}`
                                : 'Heart rate (bpm)'
                            }
                          >
                            <input
                              aria-label={`${row.label} target`}
                              value={choice.low}
                              placeholder={
                                choice.mode === 'pace' ? 'm:ss' : 'bpm'
                              }
                              inputMode={
                                choice.mode === 'pace' ? 'text' : 'numeric'
                              }
                              onChange={(e) =>
                                updateRow(row.role, { low: e.target.value })
                              }
                            />
                          </Field>
                          <Field
                            label={
                              choice.mode === 'pace'
                                ? 'Slower end (optional)'
                                : 'Upper end (optional)'
                            }
                          >
                            <input
                              aria-label={`${row.label} upper target`}
                              value={choice.high}
                              placeholder="Single target if blank"
                              inputMode={
                                choice.mode === 'pace' ? 'text' : 'numeric'
                              }
                              onChange={(e) =>
                                updateRow(row.role, { high: e.target.value })
                              }
                            />
                          </Field>
                        </div>
                      )}
                      <details className="pace-explanation">
                        <summary>Why this pace?</summary>
                        <p>{row.reason}</p>
                        <p>
                          {row.source.url ? (
                            <a
                              href={row.source.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {row.source.title}
                            </a>
                          ) : (
                            row.source.title
                          )}
                        </p>
                        {!sourceSelected && (
                          <p>
                            Your personal choice overrides this instruction for
                            this role. It is not a pace endorsed by the
                            programme.
                          </p>
                        )}
                      </details>
                      {editable && (
                        <div className="pace-row-controls">
                          <label>
                            <span className="sr-only">
                              Guidance for {row.label}
                            </span>
                            <select
                              value={choice.mode}
                              aria-label={`Guidance for ${row.label}`}
                              onChange={(e) =>
                                updateRow(row.role, {
                                  mode: e.target.value as PaceRowDraft['mode'],
                                })
                              }
                            >
                              <option value="source">Programme guidance</option>
                              <option value="effort">Use effort</option>
                              <option value="pace">Set my pace</option>
                              <option value="heart-rate">
                                Set my heart rate
                              </option>
                            </select>
                          </label>
                          {choice.mode !== 'source' && (
                            <button
                              type="button"
                              className="text-button"
                              onClick={() =>
                                updateRow(row.role, { ...inherited })
                              }
                            >
                              Reset this target
                            </button>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
                {Object.values(draft.rows).some(
                  (row) => row?.mode === 'heart-rate',
                ) && (
                  <p className="notice">
                    Personal heart-rate targets are available in Garmin FIT
                    downloads. Direct sending through Intervals currently
                    requires pace or effort targets.
                  </p>
                )}
                {rows.length === 0 && (
                  <p>
                    Your next programme will show its applicable pace
                    instructions here.
                  </p>
                )}
              </section>
            </div>
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
                busyLabel="Preparing your paces…"
                disabled={loading}
                onClick={() => void review()}
              >
                Review changes
              </BusyButton>
            </div>
          </>
        ) : (
          <>
            <section className="pace-review-heading">
              <h3 className="ink-heading">
                See what changes
                <DrawnUnderline />
              </h3>
              <p>
                {changed.length} upcoming{' '}
                {changed.length === 1 ? 'workout' : 'workouts'} will receive
                updated guidance from {dateLabel(preview.effectiveDate)}.
              </p>
              <p className="subtle">
                Running days, prescribed distances, timed steps and recoveries
                stay the same. Fixed-distance runs may have a different
                estimated duration.
              </p>
              <p className="subtle">
                Past and recorded runs, the next seven days and workouts already
                sent to your watch retain their saved instructions.
              </p>
              {preview.protectedCount > 0 && (
                <p>{preview.protectedCount} upcoming workouts are protected.</p>
              )}
            </section>
            {preview.qualityReview && (
              <section className="pace-readiness">
                <h3>{preview.qualityReview.title}</h3>
                <p>{preview.qualityReview.message}</p>
                <ul>
                  {preview.qualityReview.nextSteps.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            )}
            {!changed.length && (
              <p>
                The reference and personal choices will be saved. No eligible
                workout prescriptions change.
              </p>
            )}
            {(showAll ? changed : changed.slice(0, 3)).map((workout) => {
              const before = plan.workouts.find(
                (old) => old.id === workout.id,
              )!;
              return (
                <article className="pace-change" key={workout.id}>
                  <div>
                    <time dateTime={workout.date}>
                      {dateLabel(workout.date)}
                    </time>
                    <h4>{workout.title}</h4>
                  </div>
                  {before.minutes !== workout.minutes && (
                    <p className="pace-duration-change">
                      Estimated duration: {duration(before.minutes * 60)} →{' '}
                      {duration(workout.minutes * 60)}. The prescribed distance
                      stays the same.
                    </p>
                  )}
                  <dl>
                    {workout.steps.map((step, index) => {
                      const old = before.steps[index];
                      if (
                        JSON.stringify([step.target, step.pacing]) ===
                        JSON.stringify([old?.target, old?.pacing])
                      )
                        return null;
                      return (
                        <div className="pace-change-row" key={index}>
                          <dt>{step.label}</dt>
                          <dd>
                            <span>
                              <small>Before</small>
                              {old?.target
                                ? targetLabel(old.target, unit)
                                : (old?.pacing?.guidance ??
                                  old?.effort ??
                                  'Effort guidance')}
                              <small>
                                {old ? origin(old) : 'Saved instruction'}
                              </small>
                            </span>
                            <span>
                              <small>After</small>
                              {step.target
                                ? targetLabel(step.target, unit)
                                : (step.pacing?.guidance ?? step.effort)}
                              <small>{origin(step)}</small>
                            </span>
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                </article>
              );
            })}
            {changed.length > 3 && (
              <button
                className="secondary-button"
                onClick={() => setShowAll((value) => !value)}
              >
                {showAll
                  ? 'Show fewer changes'
                  : `View all ${changed.length} changes`}
              </button>
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
                Edit paces
              </button>
              <BusyButton
                className="primary-button"
                busy={busy}
                busyLabel="Saving your paces…"
                disabled={busy}
                onClick={async () => {
                  setError('');
                  try {
                    if (version !== preview.version)
                      throw new Error(
                        'Your plan changed. Review your paces again.',
                      );
                    await onAction('targets', {
                      targets: config,
                      pacing: evidencePatch(),
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
                Save training paces
              </BusyButton>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

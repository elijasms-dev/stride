import { qualityWorkMinutes, stepDurationRange } from './prescription.ts';
import { PLAN_LOAD_LIMITS } from './plan/policy-constants.ts';
import type { Step, Workout } from './plan/types.ts';
import { validEffortRole, validStepTarget } from './workout-targets.ts';
import { validPaceInstruction, validStepPacing } from './source-pacing.ts';

const bounded = (value: unknown, minimum: number, maximum: number) =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= minimum &&
  value <= maximum;

function validSavedStep(value: unknown): value is Step {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const step = value as Step;
  if (
    Object.keys(step).some(
      (key) =>
        ![
          'label',
          'seconds',
          'metres',
          'planningPaceSecondsPerKm',
          'effort',
          'intensity',
          'kind',
          'movement',
          'effortRole',
          'target',
          'paceInstruction',
          'pacing',
        ].includes(key),
    ) ||
    typeof step.label !== 'string' ||
    step.label.length > 250 ||
    typeof step.effort !== 'string' ||
    step.effort.length > 500 ||
    !bounded(step.seconds, 0.1, 90000) ||
    !bounded(step.intensity, 0, 10) ||
    !['warmup', 'aerobic', 'work', 'recovery', 'cooldown'].includes(
      step.kind,
    ) ||
    (step.movement !== undefined && !['run', 'walk'].includes(step.movement)) ||
    (step.metres !== undefined && !bounded(step.metres, 0.1, 250000)) ||
    (step.target !== undefined && !validStepTarget(step.target)) ||
    (step.effortRole !== undefined && !validEffortRole(step.effortRole)) ||
    (step.paceInstruction !== undefined &&
      !validPaceInstruction(step.paceInstruction)) ||
    (step.pacing !== undefined && !validStepPacing(step.pacing, step.target))
  )
    return false;
  if (
    step.planningPaceSecondsPerKm !== undefined &&
    (!bounded(step.planningPaceSecondsPerKm, 120, 1200) ||
      step.metres === undefined ||
      (step.metres * step.planningPaceSecondsPerKm) / 1000 > step.seconds + 1)
  )
    return false;
  return (
    step.metres === undefined ||
    step.target?.mode !== 'pace' ||
    (step.metres * step.target.high) / 1000 <= step.seconds + 1
  );
}

const runningWorkMinutes = (steps: Step[]) =>
  steps.reduce(
    (minutes, step) =>
      minutes +
      (step.kind === 'work' && step.intensity >= 4 && step.movement !== 'walk'
        ? stepDurationRange(step).upperSeconds / 60
        : 0),
    0,
  );

/** A reviewed faster pace can shorten a distance repetition's estimated time.
 * Its existing quality-session eligibility survives only with the entire saved
 * prescription intact. This evidence never supplies minutes to load accounting. */
export function validReviewedQualityProvenance(workout: Workout): boolean {
  const saved = workout.paceReviewEligibility;
  if (
    !saved ||
    typeof saved !== 'object' ||
    Array.isArray(saved) ||
    Object.keys(saved).some(
      (key) =>
        !['version', 'kind', 'stimulus', 'templateId', 'steps'].includes(key),
    ) ||
    saved.version !== 'fixed-endpoints-v1' ||
    !workout.hard ||
    !['tempo', 'intervals', 'fartlek'].includes(workout.kind) ||
    ['aerobic', 'economy'].includes(workout.stimulus ?? '') ||
    saved.kind !== workout.kind ||
    saved.stimulus !== workout.stimulus ||
    saved.templateId !== workout.templateId ||
    !Array.isArray(saved.steps) ||
    saved.steps.length < 1 ||
    saved.steps.length > 1000 ||
    !Array.isArray(workout.steps) ||
    saved.steps.length !== workout.steps.length ||
    !saved.steps.every(validSavedStep) ||
    !workout.steps.every(validSavedStep)
  )
    return false;
  if (saved.steps.reduce((sum, step) => sum + step.seconds, 0) > 90000)
    return false;
  if (
    !saved.steps.some(
      (step) =>
        step.kind === 'work' &&
        step.intensity >= 4 &&
        step.movement !== 'walk' &&
        step.metres !== undefined &&
        step.target?.mode === 'pace',
    )
  )
    return false;
  if (
    saved.steps.some((step, index) => {
      const current = workout.steps[index];
      return (
        step.kind !== current.kind ||
        step.intensity !== current.intensity ||
        step.movement !== current.movement ||
        step.effortRole !== current.effortRole ||
        (['sourceId', 'sourceVersion', 'kind', 'distanceKm'] as const).some(
          (key) =>
            step.paceInstruction?.[key] !== current.paceInstruction?.[key],
        ) ||
        (step.metres !== undefined
          ? step.metres !== current.metres
          : current.metres !== undefined || step.seconds !== current.seconds)
      );
    })
  )
    return false;
  // Derive the original dose from the saved endpoints and original valid paces,
  // never from a caller-supplied quality-minutes scalar or an old time allowance.
  return (
    runningWorkMinutes(saved.steps) >=
      PLAN_LOAD_LIMITS.minimumTempoWorkMinutes - 1e-6 &&
    runningWorkMinutes(workout.steps) > 0 &&
    qualityWorkMinutes(workout) > 0
  );
}

/** For session-count eligibility only; use qualityWorkMinutes for actual load. */
export function reviewedQualityMinutes(workout: Workout): number | undefined {
  return validReviewedQualityProvenance(workout)
    ? runningWorkMinutes(workout.paceReviewEligibility!.steps)
    : undefined;
}

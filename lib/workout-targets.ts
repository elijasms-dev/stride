import { firstRaceFeasibility } from './plan/first-race.ts';
import { validateRecentRace, type RecentRace } from './fitness-pacing.ts';
import {
  PACING_ROLES,
  resolveStepPacing,
  type PacingRole,
} from './source-pacing.ts';
import {
  executableDistanceRange,
  qualityWorkMinutes,
  resolvePrescription,
} from './prescription.ts';
import {
  withSpecificWorkoutName,
  withSteadyRaceInstructions,
  stepLength,
} from './workout-names.ts';
import {
  type Plan,
  type Profile,
  type Step,
  type Workout,
} from './plan/types.ts';
import {
  checkPrescriptionTimeLimits,
  refreshDistanceTotals,
  withRunDistance,
  withPrescribedDistanceTitle,
} from './run-distance.ts';
import { withWorkoutEventContext } from './workout-event-context.ts';
import { PLAN_LOAD_LIMITS } from './plan/policy-constants.ts';
import { validReviewedQualityProvenance } from './pace-review-eligibility.ts';

export const TARGET_BANDS = [
  'easy',
  'steady',
  'tempo',
  'threshold',
  'interval',
  'repetition',
  'race',
] as const;
export type TargetBand = (typeof TARGET_BANDS)[number];
export type EffortRole = TargetBand | 'effort';
export type TargetRange = { low: number; high: number };
export type StepTarget = TargetRange & {
  mode: 'pace' | 'heart-rate';
  /** Absent on historical snapshots whose original source was not recorded. */
  source?: 'manual' | 'benchmark' | 'goal';
  model?: string;
};
export type TargetOverride =
  | { mode: 'effort' }
  | (TargetRange & { mode: 'pace' | 'heart-rate' });
export type WorkoutTargets = {
  mode: 'automatic' | 'effort' | 'pace' | 'heart-rate';
  overrides?: Partial<Record<PacingRole, TargetOverride>>;
  goalTimeMinutes?: number;
  /** Version 1/omitted used a shared tempo/threshold and interval/repetition band. */
  bandsVersion?: 2;
  pace?: Partial<Record<TargetBand, TargetRange>>;
  heartRate?: Partial<Record<TargetBand, TargetRange>>;
  raceScope?: string;
};
export const targetBandLabels: Record<TargetBand, string> = {
  easy: 'Easy running',
  steady: 'Steady running',
  tempo: 'Controlled tempo',
  threshold: 'Threshold running',
  interval: 'Faster intervals',
  repetition: 'Repetitions',
  race: 'Race-specific running',
};
export function validStepTarget(value: unknown): value is StepTarget {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const t = value as StepTarget;
  const pace = t.mode === 'pace';
  return (
    (pace || t.mode === 'heart-rate') &&
    typeof t.low === 'number' &&
    typeof t.high === 'number' &&
    Number.isFinite(t.low) &&
    Number.isFinite(t.high) &&
    t.low <= t.high &&
    t.low >= (pace ? 120 : 40) &&
    t.high <= (pace ? 1200 : 230) &&
    Number.isInteger(t.low) &&
    Number.isInteger(t.high) &&
    (t.source === undefined ||
      ['manual', 'benchmark', 'goal'].includes(t.source)) &&
    (t.model === undefined ||
      (typeof t.model === 'string' &&
        t.model.length > 0 &&
        t.model.length <= 80))
  );
}
export function validateWorkoutTargets(value: unknown): WorkoutTargets {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Choose effort, pace or heart rate.');
  const input = value as WorkoutTargets;
  if (!['automatic', 'effort', 'pace', 'heart-rate'].includes(input.mode))
    throw new Error('Choose effort, pace or heart rate.');
  const result: WorkoutTargets = { mode: input.mode };
  if (input.goalTimeMinutes !== undefined) {
    if (
      !Number.isFinite(input.goalTimeMinutes) ||
      input.goalTimeMinutes <= 0 ||
      input.goalTimeMinutes > 100 * 20
    )
      throw new Error(
        'Enter a positive goal finish time of at most 2,000 minutes.',
      );
    result.goalTimeMinutes = input.goalTimeMinutes;
  }
  if (input.overrides !== undefined) {
    if (
      !input.overrides ||
      typeof input.overrides !== 'object' ||
      Array.isArray(input.overrides) ||
      Object.keys(input.overrides).some(
        (key) => !PACING_ROLES.includes(key as PacingRole),
      )
    )
      throw new Error('Check the pacing roles in your overrides.');
    result.overrides = {};
    for (const role of PACING_ROLES) {
      const value = input.overrides[role];
      if (value === undefined) continue;
      if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('Check your pacing override.');
      if (value.mode === 'effort') {
        result.overrides[role] = { mode: 'effort' };
        continue;
      }
      if (
        !Number.isFinite(value.low) ||
        !Number.isFinite(value.high) ||
        value.low > value.high ||
        value.low < (value.mode === 'pace' ? 120 : 40) ||
        value.high > (value.mode === 'pace' ? 1200 : 230)
      )
        throw new Error(
          'Enter an ordered pace or heart-rate target within supported limits.',
        );
      const range =
        value.mode === 'pace' &&
        Number.isFinite(value.low) &&
        Number.isFinite(value.high)
          ? value.low === value.high
            ? { low: Math.round(value.low), high: Math.round(value.high) }
            : { low: Math.floor(value.low), high: Math.ceil(value.high) }
          : value;
      if (!validStepTarget({ ...range, mode: value.mode }))
        throw new Error(
          'Enter an ordered pace or heart-rate target within supported limits.',
        );
      result.overrides[role] = {
        mode: value.mode,
        low: range.low,
        high: range.high,
      };
    }
  }
  if (input.bandsVersion !== undefined) {
    if (input.bandsVersion !== 2)
      throw new Error('Check your workout target version.');
    result.bandsVersion = 2;
  }
  if (input.raceScope !== undefined) {
    if (typeof input.raceScope !== 'string' || input.raceScope.length > 100)
      throw new Error('Check the race target.');
    result.raceScope = input.raceScope;
  }
  for (const key of ['pace', 'heartRate'] as const) {
    if (input[key] === undefined) continue;
    const ranges = input[key];
    if (
      !ranges ||
      typeof ranges !== 'object' ||
      Array.isArray(ranges) ||
      Object.keys(ranges).some((k) => !TARGET_BANDS.includes(k as TargetBand))
    )
      throw new Error('Check your workout target ranges.');
    result[key] = {};
    for (const band of TARGET_BANDS) {
      const raw = ranges[band];
      if (raw === undefined) continue;
      // One canonical, outward-rounded pace range for UI, native Intervals and FIT.
      const range =
        key === 'pace' &&
        typeof raw?.low === 'number' &&
        typeof raw?.high === 'number' &&
        raw.low <= raw.high
          ? raw.low === raw.high
            ? { low: Math.round(raw.low), high: Math.round(raw.high) }
            : { low: Math.floor(raw.low), high: Math.ceil(raw.high) }
          : raw;
      if (
        !validStepTarget({
          ...range,
          mode: key === 'pace' ? 'pace' : 'heart-rate',
        })
      )
        throw new Error(
          `${targetBandLabels[band]}: enter an ordered ${key === 'pace' ? 'pace range between 2:00 and 20:00 per km' : 'whole-number range between 40 and 230 bpm'}.`,
        );
      result[key]![band] = { low: range.low, high: range.high };
    }
    // Adjacent bands may overlap, but a harder effort must not be wholly
    // below an easier one in HR, or wholly slower in pace. Compare every
    // supplied pair so leaving a middle band blank cannot hide an inversion.
    // Race-specific targets are deliberately independent of this ordering.
    const ordered = [
      'easy',
      'steady',
      'tempo',
      'threshold',
      'interval',
      'repetition',
    ] as const;
    for (let i = 0; i < ordered.length; i++) {
      const easier = result[key]![ordered[i]];
      if (!easier) continue;
      for (const harderBand of ordered.slice(i + 1)) {
        const harder = result[key]![harderBand];
        if (!harder) continue;
        const reversed =
          key === 'pace' ? easier.high < harder.low : easier.low > harder.high;
        if (reversed)
          throw new Error(
            `${targetBandLabels[harderBand]} should not be entirely ${key === 'pace' ? 'slower' : 'lower in heart rate'} than ${targetBandLabels[ordered[i]].toLowerCase()}. Check whether the ranges were swapped; overlapping ranges are allowed.`,
          );
      }
    }
  }
  if (
    (result.mode === 'pace' || result.mode === 'heart-rate') &&
    !result[result.mode === 'pace' ? 'pace' : 'heartRate']?.easy
  )
    throw new Error(
      'Add your easy-running range first. Other ranges can stay on effort.',
    );
  return result;
}
export function paceText(secondsPerKm: number, unit: 'km' | 'mi' = 'km') {
  const seconds = Math.round(secondsPerKm * (unit === 'mi' ? 1.609344 : 1));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
export function parsePace(text: string, unit: 'km' | 'mi'): number | null {
  const match = /^(\d{1,2}):([0-5]\d)$/.exec(text.trim());
  return match
    ? (Number(match[1]) * 60 + Number(match[2])) /
        (unit === 'mi' ? 1.609344 : 1)
    : null;
}
export function targetLabel(
  target: StepTarget | undefined,
  unit: 'km' | 'mi' = 'km',
): string {
  return !target
    ? 'By effort'
    : target.mode === 'pace'
      ? `${paceText(target.low, unit)}${target.low === target.high ? '' : `–${paceText(target.high, unit)}`} /${unit}`
      : `${target.low}${target.low === target.high ? '' : `–${target.high}`} bpm`;
}
type TargetWorkout = Pick<
  Workout,
  | 'kind'
  | 'stimulus'
  | 'templateId'
  | 'pairType'
  | 'beginnerLesson'
  | 'eventDistanceKm'
> & { steps?: Pick<Step, 'movement'>[] };
type TargetStep = Pick<
  Step,
  | 'kind'
  | 'intensity'
  | 'seconds'
  | 'metres'
  | 'movement'
  | 'effortRole'
  | 'paceInstruction'
> & { effort?: string };
type TargetProfile = Pick<Profile, 'goal' | 'raceDistanceKm'>;

export function validEffortRole(value: unknown): value is EffortRole {
  return value === 'effort' || TARGET_BANDS.includes(value as TargetBand);
}

function roadSteadyReplacement(profile: TargetProfile) {
  return (
    ['5k', '10k', 'half'].includes(profile.goal) ||
    (profile.goal === 'custom' &&
      profile.raceDistanceKm !== undefined &&
      profile.raceDistanceKm >= 5 &&
      profile.raceDistanceKm <= 30)
  );
}

/** Resolve legacy prescriptions structurally; never interpret user-facing prose. */
export function resolveEffortRole(
  workout: TargetWorkout,
  step: TargetStep,
  profile: TargetProfile,
): EffortRole {
  if (
    step.movement === 'walk' ||
    step.kind === 'recovery' ||
    (['easy', 'long'].includes(workout.kind) &&
      workout.steps?.some((s) => s.movement === 'walk')) ||
    workout.pairType === 'double-threshold' ||
    /hill/i.test(workout.templateId ?? '') ||
    (workout.stimulus === 'economy' &&
      step.kind === 'work' &&
      (step.seconds <= 60 || (step.metres !== undefined && step.metres <= 200)))
  )
    return 'effort';
  if (step.effortRole && validEffortRole(step.effortRole))
    return step.effortRole;
  if (step.kind !== 'work' || step.intensity < 4) return 'easy';
  if (workout.kind === 'race') return 'race';
  if (workout.stimulus === 'race-rhythm')
    return step.intensity <= 5 && roadSteadyReplacement(profile)
      ? 'steady'
      : 'race';
  if (step.intensity <= 5) return 'steady';
  if (workout.stimulus === 'threshold') return 'threshold';
  if (workout.stimulus === 'economy') return 'repetition';
  if (workout.stimulus === 'aerobic-power') return 'interval';
  return 'tempo';
}

/** Old saved configurations deliberately keep their original shared bands. */
export function manualTargetRange(
  config: WorkoutTargets,
  kind: 'pace' | 'heartRate',
  band: TargetBand,
): TargetRange | undefined {
  const ranges = config[kind];
  return (
    ranges?.[band] ??
    (config.bandsVersion === undefined
      ? band === 'threshold'
        ? ranges?.tempo
        : band === 'repetition'
          ? ranges?.interval
          : undefined
      : undefined)
  );
}
/** Compatibility introspection: automatic has no global derived pace bands. */
export function benchmarkWorkoutTargets(
  _profile: Pick<Profile, 'goal' | 'raceDistanceKm' | 'recentRace'>,
  _stimulus?: Workout['stimulus'],
): WorkoutTargets | undefined {
  return undefined;
}
/** Per-step meaning determines the target; universal fitness zones are not applied. */
export function workoutStepTarget(
  workout: TargetWorkout,
  step: TargetStep,
  profile: Pick<
    Profile,
    'goal' | 'raceDistanceKm' | 'workoutTargets' | 'recentRace'
  >,
): StepTarget | undefined {
  return resolveStepPacing(workout, step, profile).target;
}
/** Snapshot explicit or benchmark ranges, never derive them from a distance estimate. */
export function withWorkoutTargets(
  input: Workout,
  profile: Profile,
  options: { allocation?: boolean } = {},
): Workout {
  if (input.beginnerLesson) {
    const next = structuredClone(input);
    next.steps = next.steps.map((step) => ({
      ...step,
      pacing: resolveStepPacing(next, step, profile),
    }));
    return next;
  }
  const finish = (w: Workout) => {
    const resolved = withPrescribedDistanceTitle(
      resolvePrescription(w, profile, options.allocation ?? false),
      profile,
    );
    if (
      resolved.paceReviewEligibility &&
      !validReviewedQualityProvenance(resolved)
    )
      delete resolved.paceReviewEligibility;
    return resolved;
  };
  const workout = withSteadyRaceInstructions(
    withWorkoutEventContext(input, profile),
  );
  const steps: Step[] = workout.steps.map((step) => {
    const { target: _previous, pacing: _pacing, ...plain } = step;
    const pacing = resolveStepPacing(workout, step, profile);
    const target = pacing.target;
    const resolved = {
      ...plain,
      effortRole: resolveEffortRole(workout, step, profile),
      pacing,
    };
    return target ? { ...resolved, target } : resolved;
  });
  // Reviewed prescriptions retain their endpoints, independently of the
  // profile's default measurement mode. Only new allocations may convert them.
  if (!options.allocation) {
    return finish({ ...workout, steps });
  }

  if (
    steps.length &&
    steps.every((s) => s.metres !== undefined) &&
    Math.abs(
      steps.reduce((n, s) => n + s.metres!, 0) / 1000 - workout.estimatedKm,
    ) < 0.000001
  )
    return finish({ ...workout, steps });
  const distanceRun = withRunDistance({ ...workout, steps }, profile);
  if (distanceRun.steps !== steps)
    return finish({
      ...distanceRun,
      steps: distanceRun.steps.map((s) => {
        if (
          s.target?.mode !== 'heart-rate' ||
          s.kind !== 'work' ||
          (s.seconds > 120 && (s.metres === undefined || s.metres >= 1000))
        )
          return s;
        const { target: _target, pacing: _pacing, ...plain } = s;
        return {
          ...plain,
          pacing: resolveStepPacing(distanceRun, plain, profile),
        };
      }),
    });
  if (
    options.allocation &&
    workout.kind !== 'race' &&
    steps.some(
      (s) =>
        s.metres !== undefined &&
        s.target?.mode === 'pace' &&
        Math.ceil((s.metres * s.target.high) / 1000) > s.seconds + 1,
    )
  ) {
    const timed = steps.map((s) => {
      if (s.metres === undefined) return s;
      const { metres: _metres, planningPaceSecondsPerKm: _basis, ...plain } = s;
      return {
        ...plain,
        label:
          s.kind === 'aerobic'
            ? 'Easy off block'
            : `${stepLength(plain)} controlled effort`,
      };
    });
    return finish(
      withSpecificWorkoutName({
        ...workout,
        steps: timed,
        templateId: undefined,
        varietyVersion: undefined,
        purpose:
          'Run controlled timed repetitions at your target, using the easy recoveries to reset before the next effort.',
        reason:
          'The pace range needs longer for the distance repetitions. This timed alternative fits the available session time and keeps the recoveries.',
      }),
    );
  }
  return finish({ ...workout, steps });
}

/** Generators own unfixed time allowances; fund the selected kilometres before
 * saving a timed prescription. Saved workouts use withWorkoutTargets instead. */
export function withAllocatedWorkoutTargets(
  input: Workout,
  profile: Profile,
): Workout {
  let w = withWorkoutTargets(input, profile, { allocation: true });
  const range = executableDistanceRange(w.steps);
  if (
    !range ||
    w.kind === 'race' ||
    (w.estimatedKm >= range.lowerKm - 0.001 &&
      w.estimatedKm <= range.upperKm + 0.001)
  )
    return w;
  const steps = w.steps.map((s) => ({ ...s }));
  const reducing = w.estimatedKm < range.lowerKm;
  let difference = w.estimatedKm - (reducing ? range.lowerKm : range.upperKm);
  const adjustable = steps.filter(
    (s) =>
      s.metres === undefined && s.intensity <= 3 && s.target?.mode === 'pace',
  );
  for (const s of adjustable.sort((a, b) => b.seconds - a.seconds)) {
    if (s.target?.mode !== 'pace') continue;
    const pace = reducing ? s.target.high : s.target.low;
    const minimum = s.kind === 'warmup' || s.kind === 'cooldown' ? 300 : 60;
    const change = reducing
      ? Math.max(minimum - s.seconds, Math.floor(difference * pace))
      : Math.min(
          Math.round(input.minutes * 60) -
            steps.reduce((n, step) => n + step.seconds, 0),
          Math.ceil(difference * pace),
        );
    s.seconds += change;
    difference -= change / pace;
    if (Math.abs(difference) <= 0.002) break;
  }
  w = { ...w, steps, minutes: steps.reduce((n, s) => n + s.seconds, 0) / 60 };
  // If fixed quality/warm-up minima exhaust the allowance, expose the actual
  // executable allocation so the week reconciler can fund it from easy running.
  return resolvePrescription(w, profile);
}

export function updateWorkoutTargets(
  plan: Plan,
  config: WorkoutTargets | null,
  from: string,
  protectedIds: readonly string[] = [],
  evidence: { recentRace?: RecentRace | null } = {},
): Plan {
  const next = structuredClone(plan);
  if (evidence.recentRace === null) delete next.profile.recentRace;
  else if (evidence.recentRace !== undefined)
    next.profile.recentRace = validateRecentRace(evidence.recentRace);
  const evidenceChanged =
    JSON.stringify(next.profile.recentRace) !==
    JSON.stringify(plan.profile.recentRace);
  let unchangedChoice = false;
  if (config === null) {
    unchangedChoice = !next.profile.workoutTargets;
    delete next.profile.workoutTargets;
  } else {
    const targets = validateWorkoutTargets(config);
    const raceScope = `${plan.profile.goal}:${plan.profile.raceDistanceKm ?? ''}`;
    const previous = next.profile.workoutTargets;
    // A transported setting still tied to another event is not consent to
    // reuse that event's goal or generic race override. A new reviewed setting
    // may omit scope (legacy callers) or explicitly name the current event.
    if (targets.raceScope !== undefined && targets.raceScope !== raceScope) {
      delete targets.goalTimeMinutes;
      if (targets.pace) delete targets.pace.race;
      if (targets.heartRate) delete targets.heartRate.race;
      if (targets.overrides)
        for (const role of ['race', 'current-race', 'goal-race'] as const)
          delete targets.overrides[role];
    }
    targets.raceScope = raceScope;
    const hasEventTargets = (value: WorkoutTargets) =>
      value.goalTimeMinutes !== undefined ||
      !!value.pace?.race ||
      !!value.heartRate?.race ||
      ['race', 'current-race', 'goal-race'].some(
        (role) => value.overrides?.[role as PacingRole] !== undefined,
      );
    // Keep unchanged numeric targets and historical snapshots intact. An
    // explicit review can still repair old labels that contradict their saved
    // steady effort, without re-deriving pace or changing the prescription.
    const comparable = (value: WorkoutTargets) => ({
      mode: value.mode,
      bandsVersion: value.bandsVersion,
      pace: value.pace,
      heartRate: value.heartRate,
      raceScope: hasEventTargets(value) ? value.raceScope : undefined,
      overrides: value.overrides,
      goalTimeMinutes: value.goalTimeMinutes,
    });
    unchangedChoice =
      !!previous &&
      JSON.stringify(comparable(validateWorkoutTargets(previous))) ===
        JSON.stringify(comparable(targets));
    if (!unchangedChoice)
      next.profile.workoutTargets = { ...targets, raceScope };
  }
  const protectedSet = new Set(protectedIds);
  const needsSourceReview = next.workouts.some(
    (w) =>
      w.status === 'planned' &&
      w.week >= 0 &&
      w.date >= from &&
      !protectedSet.has(w.id) &&
      !w.beginnerLesson &&
      w.steps.some((step) => !step.pacing),
  );
  if (unchangedChoice && !evidenceChanged && !needsSourceReview) {
    next.workouts = next.workouts.map((workout) =>
      workout.status === 'planned' &&
      workout.week >= 0 &&
      workout.date >= from &&
      !protectedSet.has(workout.id)
        ? withSteadyRaceInstructions(workout)
        : workout,
    );
    return next;
  }
  let changedDistance = false;
  next.workouts = next.workouts.map((w) => {
    if (
      w.status !== 'planned' ||
      w.week < 0 ||
      w.date < from ||
      protectedSet.has(w.id)
    )
      return w;
    const updated = withWorkoutTargets(w, next.profile);
    if (
      !w.paceReviewEligibility &&
      w.hard &&
      ['tempo', 'intervals', 'fartlek'].includes(w.kind) &&
      qualityWorkMinutes(w) >=
        PLAN_LOAD_LIMITS.minimumTempoWorkMinutes - 1e-6 &&
      qualityWorkMinutes(updated) <
        PLAN_LOAD_LIMITS.minimumTempoWorkMinutes - 1e-6 &&
      w.kind === updated.kind &&
      w.stimulus === updated.stimulus &&
      w.hard === updated.hard &&
      w.templateId === updated.templateId &&
      w.steps.length === updated.steps.length &&
      w.steps.some(
        (s) =>
          s.kind === 'work' &&
          s.metres !== undefined &&
          s.target?.mode === 'pace',
      ) &&
      w.steps.every((s, i) => {
        const after = updated.steps[i];
        return (
          s.kind === after.kind &&
          s.intensity === after.intensity &&
          s.movement === after.movement &&
          s.effortRole === after.effortRole &&
          s.metres === after.metres &&
          (s.metres !== undefined || s.seconds === after.seconds)
        );
      })
    )
      updated.paceReviewEligibility = {
        version: 'fixed-endpoints-v1',
        kind: w.kind,
        ...(w.stimulus === undefined ? {} : { stimulus: w.stimulus }),
        ...(w.templateId === undefined ? {} : { templateId: w.templateId }),
        steps: structuredClone(w.steps),
      };
    if (updated.estimatedKm !== w.estimatedKm) {
      changedDistance = true;
      updated.changed = true;
      updated.changeSource =
        w.changeSource === 'manual' ? 'manual' : 'preferences';
      if (
        updated.prescriptionVersion === 'pace-resolved-v1' &&
        w.steps.some((step) => step.metres === undefined)
      )
        updated.distanceRevision = 'pace-edited-time';
    }
    return updated;
  });
  if (changedDistance) {
    next.constraintsFrom = from;
    // Pace review retains fixed time/distance endpoints. A forecast-normalization
    // pass would silently shorten saved timed long runs.
  }
  checkPrescriptionTimeLimits(plan, next);
  refreshDistanceTotals(next);
  if (next.firstRace) next.feasibility = firstRaceFeasibility(next, from);
  return next;
}
export function mainWorkoutTarget(workout: Workout) {
  return workout.steps.find((s) => s.kind === 'work')?.target;
}

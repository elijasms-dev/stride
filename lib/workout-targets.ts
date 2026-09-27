import { firstRaceFeasibility } from './plan/first-race.ts';
import {
  calculateTrainingPaceRanges,
  FITNESS_MODEL_VERSION,
  RACE_EQUIVALENCE_MODEL_VERSION,
  fitnessPaceRange,
  predictRaceTime,
} from './fitness-pacing.ts';
import {
  executableDistanceRange,
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
  source?: 'manual' | 'benchmark';
  model?: string;
};
export type WorkoutTargets = {
  mode: 'effort' | 'pace' | 'heart-rate';
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
    t.low < t.high &&
    t.low >= (pace ? 120 : 40) &&
    t.high <= (pace ? 1200 : 230) &&
    Number.isInteger(t.low) &&
    Number.isInteger(t.high) &&
    (t.source === undefined || ['manual', 'benchmark'].includes(t.source)) &&
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
  if (!['effort', 'pace', 'heart-rate'].includes(input.mode))
    throw new Error('Choose effort, pace or heart rate.');
  const result: WorkoutTargets = { mode: input.mode };
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
        raw.low < raw.high
          ? { low: Math.floor(raw.low), high: Math.ceil(raw.high) }
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
    result.mode !== 'effort' &&
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
      ? `${paceText(target.low, unit)}–${paceText(target.high, unit)} /${unit}`
      : `${target.low}–${target.high} bpm`;
}
type TargetWorkout = Pick<
  Workout,
  'kind' | 'stimulus' | 'templateId' | 'pairType'
> & { steps?: Pick<Step, 'movement'>[] };
type TargetStep = Pick<
  Step,
  'kind' | 'intensity' | 'seconds' | 'metres' | 'movement' | 'effortRole'
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
/** The same derived ranges used by prescriptions and the target review. */
export function benchmarkWorkoutTargets(
  profile: Pick<Profile, 'goal' | 'raceDistanceKm' | 'recentRace'>,
  _stimulus?: Workout['stimulus'],
): WorkoutTargets | undefined {
  const fitness = profile.recentRace
    ? calculateTrainingPaceRanges(profile.recentRace)
    : undefined;
  if (!fitness) return undefined;
  const distances = {
    '5k': 5,
    '10k': 10,
    half: 21.0975,
    marathon: 42.195,
    ultra: 50,
    custom: 42.195,
    base: 5,
  };
  const distance = ['custom', 'ultra'].includes(profile.goal)
    ? (profile.raceDistanceKm ?? distances[profile.goal])
    : distances[profile.goal];
  const racePace =
    (predictRaceTime(profile.recentRace!, distance) * 60) / distance;
  const race =
    racePace >= 120 && racePace <= 1200
      ? fitnessPaceRange(racePace)
      : undefined;
  // A gentle road replacement cannot be faster than the event work it replaces.
  // This applies equally to custom road distances using those same recipes.
  const steady =
    roadSteadyReplacement(profile) && race
      ? {
          low: Math.max(fitness.steady.low, race.low),
          high: Math.max(fitness.steady.high, race.high),
        }
      : fitness.steady;
  return {
    mode: 'pace',
    bandsVersion: 2,
    raceScope: `${profile.goal}:${profile.raceDistanceKm ?? ''}`,
    pace: { ...fitness, steady, race },
  };
}
/** Resolve explicit targets first, otherwise use the current fitness benchmark. */
export function workoutStepTarget(
  workout: TargetWorkout,
  step: TargetStep,
  profile: Pick<
    Profile,
    'goal' | 'raceDistanceKm' | 'workoutTargets' | 'recentRace'
  >,
): StepTarget | undefined {
  const config =
    profile.workoutTargets ??
    benchmarkWorkoutTargets(profile, workout.stimulus);
  if (
    !config ||
    config.mode === 'effort' ||
    step.movement === 'walk' ||
    step.kind === 'recovery' ||
    workout.pairType === 'double-threshold' ||
    /hill/i.test(workout.templateId ?? '') ||
    (config.mode === 'heart-rate' &&
      step.kind === 'work' &&
      workout.kind !== 'race' &&
      (step.seconds <= 120 ||
        (step.metres !== undefined && step.metres < 1000)))
  )
    return undefined;
  const band = resolveEffortRole(workout, step, profile);
  if (band === 'effort') return undefined;
  if (
    band === 'race' &&
    config.raceScope !== `${profile.goal}:${profile.raceDistanceKm ?? ''}`
  )
    return undefined;
  const range = manualTargetRange(
    config,
    config.mode === 'pace' ? 'pace' : 'heartRate',
    band,
  );
  return range
    ? {
        ...range,
        mode: config.mode,
        source: profile.workoutTargets ? 'manual' : 'benchmark',
        ...(!profile.workoutTargets
          ? {
              model:
                band === 'race'
                  ? RACE_EQUIVALENCE_MODEL_VERSION
                  : band === 'steady' && roadSteadyReplacement(profile)
                    ? `${FITNESS_MODEL_VERSION}+${RACE_EQUIVALENCE_MODEL_VERSION}`
                    : FITNESS_MODEL_VERSION,
            }
          : {}),
      }
    : undefined;
}
/** Snapshot explicit or benchmark ranges, never derive them from a distance estimate. */
export function withWorkoutTargets(
  input: Workout,
  profile: Profile,
  options: { allocation?: boolean } = {},
): Workout {
  if (input.beginnerLesson) return structuredClone(input);
  const finish = (w: Workout) =>
    withPrescribedDistanceTitle(
      resolvePrescription(w, profile, options.allocation ?? false),
      profile,
    );
  const workout = withSteadyRaceInstructions(
    withWorkoutEventContext(input, profile),
  );
  const steps: Step[] = workout.steps.map((step) => {
    const { target: _previous, ...plain } = step;
    const target = workoutStepTarget(workout, step, profile);
    const resolved = {
      ...plain,
      effortRole: resolveEffortRole(workout, step, profile),
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
        const { target: _target, ...plain } = s;
        return plain;
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
): Plan {
  const next = structuredClone(plan);
  let unchangedChoice = false;
  if (config === null) {
    unchangedChoice = !next.profile.workoutTargets;
    delete next.profile.workoutTargets;
  } else {
    const targets = validateWorkoutTargets(config);
    const raceScope = `${plan.profile.goal}:${plan.profile.raceDistanceKm ?? ''}`;
    const previous = next.profile.workoutTargets;
    // Keep unchanged numeric targets and historical snapshots intact. An
    // explicit review can still repair old labels that contradict their saved
    // steady effort, without re-deriving pace or changing the prescription.
    const comparable = (value: WorkoutTargets) => ({
      mode: value.mode,
      bandsVersion: value.bandsVersion,
      pace: value.pace,
      heartRate: value.heartRate,
      raceScope,
    });
    unchangedChoice =
      !!previous &&
      (previous.raceScope === raceScope ||
        (!targets.pace?.race && !targets.heartRate?.race)) &&
      JSON.stringify(comparable(validateWorkoutTargets(previous))) ===
        JSON.stringify(comparable(targets));
    if (!unchangedChoice)
      next.profile.workoutTargets = { ...targets, raceScope };
  }
  const protectedSet = new Set(protectedIds);
  if (unchangedChoice) {
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

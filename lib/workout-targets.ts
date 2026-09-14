import {
  calculateTrainingPaces,
  fitnessPaceRange,
  predictRaceTime,
} from './fitness-pacing.ts';
import { distanceEstimate } from './prescription.ts';
import {
  withSpecificWorkoutName,
  withSteadyRaceInstructions,
  stepLength,
} from './workout-names.ts';
import type { Plan, Profile, Step, Workout } from './engine.ts';
import { refreshDistanceTotals, withRunDistance } from './run-distance.ts';
import { withWorkoutEventContext } from './workout-event-context.ts';

export const TARGET_BANDS = [
  'easy',
  'steady',
  'tempo',
  'interval',
  'race',
] as const;
export type TargetBand = (typeof TARGET_BANDS)[number];
export type TargetRange = { low: number; high: number };
export type StepTarget = TargetRange & { mode: 'pace' | 'heart-rate' };
export type WorkoutTargets = {
  mode: 'effort' | 'pace' | 'heart-rate';
  pace?: Partial<Record<TargetBand, TargetRange>>;
  heartRate?: Partial<Record<TargetBand, TargetRange>>;
  raceScope?: string;
};
export const targetBandLabels: Record<TargetBand, string> = {
  easy: 'Easy running',
  steady: 'Steady running',
  tempo: 'Tempo / threshold',
  interval: 'Faster intervals',
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
    Number.isInteger(t.high)
  );
}
export function validateWorkoutTargets(value: unknown): WorkoutTargets {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Choose effort, pace or heart rate.');
  const input = value as WorkoutTargets;
  if (!['effort', 'pace', 'heart-rate'].includes(input.mode))
    throw new Error('Choose effort, pace or heart rate.');
  const result: WorkoutTargets = { mode: input.mode };
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
>;
type TargetStep = Pick<
  Step,
  'kind' | 'intensity' | 'effort' | 'seconds' | 'metres' | 'movement'
>;
function targetBand(workout: TargetWorkout, step: TargetStep): TargetBand {
  if (step.kind !== 'work' || step.intensity < 4) return 'easy';
  if (step.effort.startsWith('Steady and comfortable')) return 'steady';
  if (workout.kind === 'race' || workout.stimulus === 'race-rhythm')
    return 'race';
  if (workout.stimulus === 'threshold')
    return step.intensity <= 5 ? 'steady' : 'tempo';
  if (workout.stimulus === 'aerobic-power' || workout.stimulus === 'economy')
    return step.intensity <= 5 ? 'steady' : 'interval';
  return step.intensity <= 5 ? 'steady' : 'tempo';
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
  let config = profile.workoutTargets;
  const fitness =
    !config && profile.recentRace
      ? calculateTrainingPaces(profile.recentRace)
      : undefined;
  if (fitness) {
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
    config = {
      mode: 'pace',
      raceScope: `${profile.goal}:${profile.raceDistanceKm ?? ''}`,
      pace: {
        easy: fitnessPaceRange(fitness.easy),
        steady: fitnessPaceRange(fitness.tempo),
        tempo: fitnessPaceRange(
          workout.stimulus === 'threshold' ? fitness.threshold : fitness.tempo,
        ),
        interval: fitnessPaceRange(fitness.interval),
        race:
          racePace >= 120 && racePace <= 1200
            ? fitnessPaceRange(racePace)
            : undefined,
      },
    };
  }
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
  const band = targetBand(workout, step);
  if (
    band === 'race' &&
    config.raceScope !== `${profile.goal}:${profile.raceDistanceKm ?? ''}`
  )
    return undefined;
  const range = config[config.mode === 'pace' ? 'pace' : 'heartRate']?.[band];
  return range ? { ...range, mode: config.mode } : undefined;
}
/** Snapshot explicit or benchmark ranges, never derive them from a distance estimate. */
export function withWorkoutTargets(input: Workout, profile: Profile): Workout {
  const workout = withSteadyRaceInstructions(
    withWorkoutEventContext(input, profile),
  );
  const steps: Step[] = workout.steps.map((step) => {
    const { target: _previous, ...plain } = step;
    const target = workoutStepTarget(workout, step, profile);
    return target ? { ...plain, target } : plain;
  });
  // A slower pace may no longer fit the allocated time for a distance repeat.
  // Keep the time and recoveries, and show the timed alternative in the same review.
  const distanceRun = withRunDistance({ ...workout, steps }, profile);
  if (distanceRun.steps !== steps)
    return {
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
    };
  if (
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
    return withSpecificWorkoutName({
      ...workout,
      steps: timed,
      distanceEstimate: distanceEstimate(timed, profile),
      templateId: undefined,
      varietyVersion: undefined,
      purpose:
        'Run controlled timed repetitions at your updated target, using the easy recoveries to reset before the next effort.',
      reason:
        'Your new pace range needs longer for the distance repetitions. This timed alternative keeps your session time, work allowance and recoveries.',
    });
  }
  return { ...workout, steps };
}
export function updateWorkoutTargets(
  plan: Plan,
  config: WorkoutTargets,
  from: string,
  protectedIds: readonly string[] = [],
): Plan {
  const next = structuredClone(plan);
  next.profile.workoutTargets = {
    ...validateWorkoutTargets(config),
    raceScope: `${plan.profile.goal}:${plan.profile.raceDistanceKm ?? ''}`,
  };
  const protectedSet = new Set(protectedIds);
  next.workouts = next.workouts.map((w) =>
    w.status === 'planned' &&
    w.week >= 0 &&
    w.date >= from &&
    !protectedSet.has(w.id)
      ? withWorkoutTargets(w, next.profile)
      : w,
  );
  return refreshDistanceTotals(next);
}
export function mainWorkoutTarget(workout: Workout) {
  return workout.steps.find((s) => s.kind === 'work')?.target;
}

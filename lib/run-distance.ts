import type { Plan, Profile, Step, Workout } from './engine.ts';
import { distanceEstimate } from './prescription.ts';
import { withSpecificWorkoutName } from './workout-names.ts';

export const runMeasureNote = (measure: 'distance' | 'time') =>
  measure === 'distance'
    ? 'Easy and long runs use distance targets when their structure supports them. Time estimates help you plan; run-walk, recoveries and timed quality sessions keep their prescribed durations.'
    : 'Training duration and effort are prescribed. Distance estimates are uncertain; event distance is exact and race duration is not a prediction.';

export function prescribedDistanceKm(
  workout: Pick<Workout, 'steps'>,
): number | null {
  return workout.steps.length > 0 &&
    workout.steps.every((s) => Number.isFinite(s.metres) && s.metres! > 0)
    ? workout.steps.reduce((total, step) => total + step.metres!, 0) / 1000
    : null;
}

function eligibleRun(w: Workout) {
  return (
    ['easy', 'long'].includes(w.kind) &&
    !w.returnRole &&
    w.pairType !== 'double-threshold' &&
    w.steps.length > 0 &&
    !w.steps.some((s) => s.movement === 'walk' || s.kind === 'recovery') &&
    !/hill/i.test(w.templateId ?? '')
  );
}

const baseTitle = (title: string) =>
  title.replace(/^\d+(?:\.\d+)? (?:km|mi) · /, '');
function distanceTitle(w: Workout, profile: Profile, km: number) {
  const value = Number(
    (profile.units === 'mi' ? km / 1.609344 : km).toFixed(1),
  );
  return `${value} ${profile.units} · ${baseTitle(w.title)}`;
}

/** Distance ends the running steps; seconds retain the existing planning allowance.
 * Round down within each step and the existing distance/time allocation, never add load. */
export function withRunDistance(workout: Workout, profile: Profile): Workout {
  if (profile.runMeasure !== 'distance' || !eligibleRun(workout))
    return workout;
  const pace = workout.steps.map((s) =>
    Math.ceil(
      Math.max(
        (profile.easyPace ?? 7) * 60,
        s.planningPaceSecondsPerKm ?? 0,
        s.target?.mode === 'pace' ? s.target.high : 0,
      ),
    ),
  );
  const capacities = workout.steps.map(
    (s, i) =>
      Math.floor(
        Math.min((s.seconds * 1000) / pace[i], s.metres ?? Infinity) / 100,
      ) * 100,
  );
  if (capacities.some((metres) => metres < 100)) return workout;
  const capacity = Math.min(
    capacities.reduce((sum, m) => sum + m, 0),
    Math.floor((workout.estimatedKm * 1000 + 0.001) / 100) * 100,
  );
  // Keep the funded distance. Whole/half-kilometre flooring silently removed
  // mileage from every run after the weekly allocation had already been set.
  const quantum = 100;
  const target = Math.floor(capacity / quantum) * quantum;
  if (target < capacities.length * 100) return workout;
  const totalSeconds = workout.steps.reduce((sum, s) => sum + s.seconds, 0);
  const metres = capacities.map((cap, i) =>
    Math.min(
      cap,
      Math.max(
        100,
        Math.floor((target * workout.steps[i].seconds) / totalSeconds / 100) *
          100,
      ),
    ),
  );
  let remaining = target - metres.reduce((sum, m) => sum + m, 0);
  // Remove rounding overshoot from the largest blocks; distribute spare distance only
  // where that step has room at the conservative planning pace.
  while (remaining !== 0) {
    const candidates = metres
      .map((m, i) => ({ i, room: remaining > 0 ? capacities[i] - m : m - 100 }))
      .filter((c) => c.room >= 100)
      .sort((a, b) => b.room - a.room);
    if (!candidates.length) return workout;
    const adjustment = remaining > 0 ? 100 : -100;
    metres[candidates[0].i] += adjustment;
    remaining -= adjustment;
  }
  const steps = workout.steps.map(
    (s, i): Step => ({
      ...s,
      metres: metres[i],
      planningPaceSecondsPerKm: pace[i],
      label:
        s.kind === 'work' && s.intensity >= 4
          ? `${metres[i] / 1000} km race rhythm`
          : s.label,
    }),
  );
  const km = target / 1000;
  const renamed = withSpecificWorkoutName({
    ...workout,
    steps,
    title: baseTitle(workout.title),
  });
  return {
    ...renamed,
    estimatedKm: km,
    title: distanceTitle(renamed, profile, km),
    distanceEstimate: distanceEstimate(steps, profile),
  };
}

/** Explicit, versioned migration of future runs; never invoked while loading a plan. */
export function updateRunMeasure(
  plan: Plan,
  measure: 'distance' | 'time',
  from: string,
  protectedIds: readonly string[] = [],
): Plan {
  const next = structuredClone(plan);
  next.profile.runMeasure = measure;
  const protectedSet = new Set(protectedIds);
  next.workouts = next.workouts.map((w) => {
    if (
      w.status !== 'planned' ||
      w.week < 0 ||
      w.date < from ||
      protectedSet.has(w.id) ||
      (w.changed && w.changeSource !== 'preferences') ||
      !eligibleRun(w)
    )
      return w;
    if (measure === 'distance') return withRunDistance(w, next.profile);
    if (prescribedDistanceKm(w) === null) return w;
    const steps = w.steps.map(
      ({ metres: _distance, planningPaceSecondsPerKm: _pace, ...s }) => ({
        ...s,
        label:
          s.kind === 'work' && s.intensity >= 4
            ? `${Number((s.seconds / 60).toFixed(1))} min race rhythm`
            : s.label,
      }),
    );
    return withSpecificWorkoutName({
      ...w,
      steps,
      title: baseTitle(w.title),
      estimatedKm:
        Math.round((w.minutes / (next.profile.easyPace ?? 7)) * 1000) / 1000,
      distanceEstimate: distanceEstimate(steps, next.profile),
    });
  });
  const noteIndex = next.notes.findIndex(
    (note) =>
      note.startsWith('Training duration and effort are prescribed.') ||
      note.startsWith('Easy and long runs use distance targets'),
  );
  if (noteIndex >= 0) next.notes[noteIndex] = runMeasureNote(measure);
  return refreshDistanceTotals(next);
}

/** Pace-target edits can reduce a distance prescription without changing its time allowance. */
export function refreshDistanceTotals(plan: Plan): Plan {
  for (const week of plan.weeks) {
    const sessions = plan.workouts.filter(
      (w) =>
        w.week === week.index && w.status !== 'skipped' && w.kind !== 'race',
    );
    week.targetKm =
      Math.round(sessions.reduce((n, w) => n + w.estimatedKm, 0) * 10) / 10;
    week.longKm =
      Math.round(
        Math.max(
          0,
          ...sessions
            .filter((w) => w.kind === 'long')
            .map((w) => w.estimatedKm),
        ) * 10,
      ) / 10;
  }
  return plan;
}

import { schedulingEasyPace } from './fitness-pacing.ts';
import type { Plan, Profile, Step, Workout } from './engine.ts';
import { distanceEstimate, qualityWorkMinutes } from './prescription.ts';
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

function isMarathonDistance(profile: Profile) {
  return (
    profile.goal === 'marathon' ||
    (['custom', 'ultra'].includes(profile.goal) &&
      (profile.raceDistanceKm ?? 0) > 30 &&
      (profile.raceDistanceKm ?? 0) <= 45)
  );
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
  const marathon = isMarathonDistance(profile);
  const wholeLong = workout.kind === 'long' && marathon;
  const stepQuantum = wholeLong ? 1 : 100;
  const pace = workout.steps.map((s) =>
    Math.ceil(
      Math.max(
        schedulingEasyPace(profile) * 60,
        s.planningPaceSecondsPerKm ?? 0,
        s.target?.mode === 'pace' ? s.target.high : 0,
      ) - 1e-9,
    ),
  );
  // A saved whole-distance run already funded within the one-second export tolerance
  // must be stable under repeated target/variety refreshes.
  const savedKm = prescribedDistanceKm(workout);
  if (
    wholeLong &&
    savedKm !== null &&
    Number.isInteger(savedKm) &&
    savedKm <= 35 &&
    savedKm === workout.estimatedKm &&
    workout.steps.every(
      (step, i) => (step.metres! * pace[i]) / 1000 <= step.seconds + 1,
    )
  )
    return workout;
  const capacities = workout.steps.map(
    (s, i) =>
      (wholeLong ? Math.ceil : Math.floor)(
        (Math.min((s.seconds * 1000) / pace[i], s.metres ?? Infinity) +
          (wholeLong ? -1e-6 : 1e-6)) /
          stepQuantum,
      ) * stepQuantum,
  );
  if (capacities.some((metres) => metres < stepQuantum)) return workout;
  const capacity = Math.min(
    wholeLong
      ? workout.steps.reduce(
          (sum, step, i) =>
            sum +
            Math.min((step.seconds * 1000) / pace[i], step.metres ?? Infinity),
          0,
        ) + 1e-6
      : capacities.reduce((sum, m) => sum + m, 0),
    Math.floor((workout.estimatedKm * 1000 + 0.001) / 100) * 100,
  );
  // Keep the funded distance. Whole/half-kilometre flooring silently removed
  // mileage from every run after the weekly allocation had already been set.
  const quantum = wholeLong ? 1000 : 100;
  const target = Math.floor(capacity / quantum) * quantum;
  if (target < capacities.length * stepQuantum) return workout;
  const totalSeconds = workout.steps.reduce((sum, s) => sum + s.seconds, 0);
  const metres = capacities.map((cap, i) =>
    Math.min(
      cap,
      Math.max(
        stepQuantum,
        Math.floor(
          (target * workout.steps[i].seconds) / totalSeconds / stepQuantum,
        ) * stepQuantum,
      ),
    ),
  );
  let remaining = target - metres.reduce((sum, m) => sum + m, 0);
  // Remove rounding overshoot from the largest blocks; distribute spare distance only
  // where that step has room at the conservative planning pace.
  while (remaining !== 0) {
    const candidates = metres
      .map((m, i) => ({
        i,
        room: remaining > 0 ? capacities[i] - m : m - stepQuantum,
      }))
      .filter((c) => c.room >= stepQuantum)
      .sort((a, b) => b.room - a.room);
    if (!candidates.length) return workout;
    const adjustment = remaining > 0 ? stepQuantum : -stepQuantum;
    metres[candidates[0].i] += adjustment;
    remaining -= adjustment;
  }
  // Distances end these steps; keep complete work durations and their time allowances.
  // Ceil-to-metre capacities fit within the existing one-second export tolerance.
  const steps = workout.steps.map(
    (s, i): Step => ({
      ...s,
      metres: metres[i],
      seconds: s.seconds,
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
    ...(wholeLong
      ? { qualityMinutes: qualityWorkMinutes({ ...workout, steps }) }
      : {}),
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
        w.kind === 'long' && isMarathonDistance(next.profile)
          ? Math.min(35, Math.floor(w.estimatedKm + 1e-6))
          : Math.round((w.minutes / schedulingEasyPace(next.profile)) * 1000) /
            1000,
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

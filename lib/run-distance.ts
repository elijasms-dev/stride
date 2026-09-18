import { schedulingEasyPace } from './fitness-pacing.ts';
import {
  type Plan,
  type Profile,
  type Step,
  type Workout,
} from './plan/types.ts';
import { distanceEstimate, qualityWorkMinutes } from './prescription.ts';
import { withSpecificWorkoutName } from './workout-names.ts';
import { clockMinutes, runningDayLimit } from './runner-customization.ts';
import { addDays, dayDiff, weekday } from './plan/calendar.ts';
import { PlanError } from './plan/errors.ts';
import { TAPER_POLICY } from './plan/generation-constants.ts';
import { PLAN_LOAD_LIMITS } from './plan/policy-constants.ts';
import {
  isLongUltra,
  LONG_ULTRA_POLICY,
  longUltraOpeningBaselineMessage,
} from './ultra-policy.ts';

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
export function withRunDistance(
  workout: Workout,
  profile: Profile,
  options: { preserveFundedDistance?: boolean } = {},
): Workout {
  if (profile.runMeasure !== 'distance' || !eligibleRun(workout))
    return workout;
  // Generation owns long-run progression and event ceilings. Conversion keeps
  // any funded target, including a fractional starting run, to metre precision.
  const savedKm = prescribedDistanceKm(workout);
  const exactDistance =
    workout.kind === 'long' ||
    savedKm !== null ||
    options.preserveFundedDistance;
  const stepQuantum = exactDistance ? 1 : 100;
  const pace = workout.steps.map((s) =>
    Math.ceil(
      Math.max(
        schedulingEasyPace(profile) * 60,
        s.planningPaceSecondsPerKm ?? 0,
        s.target?.mode === 'pace' ? s.target.high : 0,
      ) - 1e-9,
    ),
  );
  // A saved distance run already funded within the one-second export tolerance
  // must be stable under repeated target/variety refreshes.
  if (
    savedKm !== null &&
    Math.abs(savedKm * 1000 - Math.round(savedKm * 1000)) < 1e-6 &&
    savedKm === workout.estimatedKm &&
    workout.steps.every(
      (step, i) => (step.metres! * pace[i]) / 1000 <= step.seconds + 1,
    )
  ) {
    const renamed = withSpecificWorkoutName({
      ...workout,
      title: baseTitle(workout.title),
    });
    return {
      ...renamed,
      // Target refresh uses the step-array identity to retain conversion metadata.
      steps: [...renamed.steps],
      title: distanceTitle(renamed, profile, savedKm),
      distanceEstimate: distanceEstimate(workout.steps, profile),
    };
  }
  const capacities = workout.steps.map((s, i) =>
    exactDistance
      ? Math.min(
          options.preserveFundedDistance
            ? Infinity
            : Math.ceil((s.seconds * 1000) / pace[i] - 1e-6),
          Math.floor(((s.seconds + 1) * 1000) / pace[i] + 1e-6),
          Math.floor((s.metres ?? Infinity) + 1e-6),
        )
      : Math.floor(
          (Math.min((s.seconds * 1000) / pace[i], s.metres ?? Infinity) +
            1e-6) /
            stepQuantum,
        ) * stepQuantum,
  );
  if (capacities.some((metres) => metres < stepQuantum)) return workout;
  const capacity = Math.min(
    exactDistance
      ? options.preserveFundedDistance
        ? // Restoring a saved allocation retains the same one-second per-step
          // rounding allowance used when that distance was first prescribed.
          capacities.reduce((sum, metres) => sum + metres, 0)
        : workout.steps.reduce(
            (sum, step, i) =>
              sum +
              Math.min(
                (step.seconds * 1000) / pace[i],
                step.metres ?? Infinity,
              ),
            0,
          ) + 1e-6
      : capacities.reduce((sum, m) => sum + m, 0),
    Math.floor((workout.estimatedKm * 1000 + 0.001) / stepQuantum) *
      stepQuantum,
  );
  // Keep the funded distance. Whole/half-kilometre flooring silently removed
  // mileage from every run after the weekly allocation had already been set.
  const target = Math.floor(capacity / stepQuantum) * stepQuantum;
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
    ...(exactDistance
      ? { qualityMinutes: qualityWorkMinutes({ ...workout, steps }) }
      : {}),
    title: distanceTitle(renamed, profile, km),
    distanceEstimate: distanceEstimate(steps, profile),
  };
}

const MEASUREMENT_CAPACITY_ERROR =
  'The existing distances cannot fit the current pace targets and running-time limits. Review the pace or available time before changing measurement mode.';

/** A measurement change preserves the funded metres. If a slower explicit pace
 * needs more planning time, only relaxed running can receive that allowance;
 * complete quality repetitions and all protected prescriptions remain intact. */
function migrateFundedDistance(workout: Workout, profile: Profile): Workout {
  const targetMetres = Math.round(workout.estimatedKm * 1000);
  const funded = { ...workout, estimatedKm: targetMetres / 1000 };
  const converted = withRunDistance(funded, profile, {
    preserveFundedDistance: true,
  });
  if (prescribedDistanceKm(converted) === targetMetres / 1000) return converted;
  const pace = workout.steps.map((step) =>
    Math.ceil(
      Math.max(
        schedulingEasyPace(profile) * 60,
        step.planningPaceSecondsPerKm ?? 0,
        step.target?.mode === 'pace' ? step.target.high : 0,
      ) - 1e-9,
    ),
  );
  const capacityMetres = workout.steps.reduce(
    (sum, step, i) =>
      sum + Math.floor(((step.seconds + 1) * 1000) / pace[i] + 1e-6),
    0,
  );
  const relaxed = workout.steps
    .map((step, i) => ({ step, i }))
    .filter(({ step }) => step.intensity <= 3)
    .sort((a, b) => b.step.seconds - a.step.seconds)[0];
  if (!relaxed || targetMetres <= 0)
    throw new PlanError(MEASUREMENT_CAPACITY_ERROR);
  const extraSeconds = Math.max(
    0,
    Math.ceil(((targetMetres - capacityMetres) * pace[relaxed.i]) / 1000),
  );
  const steps = workout.steps.map((step, i) => {
    const { metres: _metres, planningPaceSecondsPerKm: _pace, ...timed } = step;
    return {
      ...timed,
      seconds: timed.seconds + (i === relaxed.i ? extraSeconds : 0),
    };
  });
  const result = withRunDistance(
    {
      ...funded,
      steps,
      minutes: steps.reduce((sum, step) => sum + step.seconds, 0) / 60,
    },
    profile,
    { preserveFundedDistance: true },
  );
  if (prescribedDistanceKm(result) !== targetMetres / 1000)
    throw new PlanError(MEASUREMENT_CAPACITY_ERROR);
  return result;
}

/** Check only newly added planning time. Older saved violations and truthful
 * historical overruns are not retroactively rewritten by a measurement edit. */
function checkMigrationTimeLimits(before: Plan, after: Plan) {
  const increased = after.workouts.filter((workout) => {
    const prior = before.workouts.find((w) => w.id === workout.id);
    return prior && workout.minutes > prior.minutes + 1e-6;
  });
  const running = after.workouts.filter(
    (w) => w.week >= 0 && w.kind !== 'race' && w.status !== 'skipped',
  );
  const sumMinutes = (runs: Workout[]) =>
    runs.reduce((sum, w) => sum + w.minutes, 0);
  const first = after.weeks[0];
  // In a fresh complete long-ultra week, recorded recent minutes are a second
  // baseline, even when the runner's availability leaves more room to train.
  if (
    isLongUltra(after.profile) &&
    first?.start === after.profile.startDate &&
    !after.baselineEvidence &&
    !after.returnState &&
    (!after.constraintsFrom || after.constraintsFrom === first.start) &&
    !['Recovery', 'Taper', 'Race week'].includes(first.phase) &&
    dayDiff(addDays(first.start, 6), after.profile.raceDate) >
      TAPER_POLICY.thirdWeekDays
  ) {
    const opening = after.workouts.filter(
      (w) => w.week === first.index && w.kind !== 'race',
    );
    if (
      opening.every(
        (w) => w.status === 'planned' && !w.changed && !w.returnRole,
      ) &&
      increased.some((w) => w.week === first.index)
    ) {
      const conflict = longUltraOpeningBaselineMessage(
        after.profile,
        sumMinutes(opening),
        opening.find((w) => w.kind === 'long')?.minutes ?? 0,
      );
      if (conflict) throw new PlanError(conflict);
    }
  }
  for (const run of increased) {
    const sessionLimit =
      run.kind === 'long'
        ? Math.min(
            after.profile.longMinutes,
            isLongUltra(after.profile)
              ? LONG_ULTRA_POLICY.longMinutes
              : Infinity,
          )
        : after.profile.weekdayMinutes;
    const sameDay = running.filter((w) => w.date === run.date);
    if (
      run.minutes > sessionLimit + 1e-6 ||
      sumMinutes(sameDay) >
        runningDayLimit(after.profile, weekday(run.date)) + 1e-6 ||
      sumMinutes(running.filter((w) => w.week === run.week)) >
        (after.profile.weeklyMinutesLimit ?? Infinity) + 1e-6 ||
      (run.startTime !== undefined &&
        clockMinutes(run.startTime) + run.minutes > 1440)
    )
      throw new PlanError(MEASUREMENT_CAPACITY_ERROR);
    if (run.pairId) {
      const pair = sameDay.filter((w) => w.pairId === run.pairId);
      const am = pair.find((w) => w.session === 'AM');
      const pm = pair.find((w) => w.session === 'PM');
      if (
        sumMinutes(pair) > after.profile.weekdayMinutes + 1e-6 ||
        (am?.startTime &&
          pm?.startTime &&
          clockMinutes(pm.startTime) - clockMinutes(am.startTime) - am.minutes <
            PLAN_LOAD_LIMITS.pairedRecoveryMinutes)
      )
        throw new PlanError(MEASUREMENT_CAPACITY_ERROR);
    }
  }
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
    if (measure === 'distance') return migrateFundedDistance(w, next.profile);
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
      estimatedKm: w.estimatedKm,
      distanceEstimate: distanceEstimate(steps, next.profile),
    });
  });
  checkMigrationTimeLimits(plan, next);
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
    week.trainingMinutes = sessions.reduce((sum, w) => sum + w.minutes, 0);
    week.qualityMinutes = sessions.reduce(
      (sum, w) => sum + qualityWorkMinutes(w),
      0,
    );
  }
  return plan;
}

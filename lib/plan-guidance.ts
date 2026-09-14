import type { Plan, Workout } from './engine';
import { usesMarathonRhythm } from './training-structure.ts';
import { usesMarathonBook } from './marathon-book.ts';
import { qualityWorkMinutes } from './prescription.ts';
import { isSteadyRaceAdaptation } from './steady-race-workout.ts';

/** Read saved prescriptions, never infer completed fitness from a forecast or
 * assume that requested quality slots survived the runner's actual limits. */
export function marathonScheduleFacts(workouts: Workout[]) {
  const training = workouts.filter(
    (w) => w.week >= 0 && w.status !== 'skipped' && w.kind !== 'race',
  );
  const quality = training.filter(
    (w) => w.stimulus !== 'economy' && qualityWorkMinutes(w) > 0,
  );
  const steady = (w: Workout) =>
    isSteadyRaceAdaptation(w) ||
    (w.stimulus === 'threshold' &&
      w.steps
        .filter((s) => s.kind === 'work' && s.intensity >= 4)
        .every((s) => s.intensity <= 5));
  const byWeek = new Map<number, number>();
  for (const w of quality) byWeek.set(w.week, (byWeek.get(w.week) ?? 0) + 1);
  return {
    training,
    quality,
    maximumQuality: Math.max(0, ...byWeek.values()),
    steady: quality.some(steady),
    tempo: quality.some((w) => w.stimulus === 'threshold' && !steady(w)),
    repetitions: quality.some(
      (w) => w.stimulus === 'aerobic-power' && !steady(w),
    ),
    marathonPace: quality.some(
      (w) => w.kind === 'long' && w.stimulus === 'race-rhythm' && !steady(w),
    ),
    strides: training.some(
      (w) => w.stimulus === 'economy' && qualityWorkMinutes(w) > 0,
    ),
    midweek: training.filter(
      (w) => w.role === 'medium-long' && !w.hard && qualityWorkMinutes(w) === 0,
    ),
  };
}

export function marathonPlanDescription(plan: Plan) {
  const weeks = new Set(plan.weeks.map((w) => w.index));
  const f = marathonScheduleFacts(
    plan.workouts.filter((w) => weeks.has(w.week)),
  );
  if (!f.training.length)
    return 'This remaining block contains no training runs before race day. It does not represent a complete marathon preparation.';
  const standard =
    usesMarathonRhythm(plan.profile) && plan.engineVersion === 'stride-0.10.0';
  const count = standard
    ? Math.max(
        0,
        ...[...weeks].map(
          (index) =>
            f.training.filter(
              (w) => w.week === index && (w.hard || w.kind === 'long'),
            ).length,
        ),
      )
    : f.maximumQuality;
  const structure =
    standard && count === 2
      ? `Standard build weeks contain two quality sessions: one ${f.steady && !f.tempo ? 'controlled steady' : 'tempo or threshold'} workout and one long run. Recovery and taper weeks reduce the workload.`
      : count
        ? `This block schedules up to ${count} main ${count === 1 ? 'workout' : 'workouts'} per week, with lighter weeks for recovery and taper.`
        : 'This block schedules easy running, with no hard training sessions.';
  const work = [
    f.steady ? 'Steady, comfortable efforts keep the work controlled.' : '',
    f.tempo ? 'Controlled tempo develops threshold endurance.' : '',
    f.repetitions ? 'Selected weeks include faster repetitions.' : '',
    f.marathonPace
      ? 'Selected long runs include sustained marathon effort; those weeks use the same quality-work allowance.'
      : '',
    f.strides ? 'Relaxed strides add short changes of rhythm.' : '',
  ];
  return [structure, ...work].filter(Boolean).join(' ');
}

/** Used at read time so old plans, substitutions, skips and previews cannot
 * retain a promise about a workout that is no longer in the saved week. */
export function planWeekFocus(plan: Plan, week: Plan['weeks'][number]) {
  if (!usesMarathonBook(plan.profile) || week.phase === 'Maintenance')
    return week.focus;
  const runs = plan.workouts.filter((w) => w.week === week.index);
  const f = marathonScheduleFacts(runs);
  if (!f.training.length)
    return runs.some((w) => w.kind === 'race' && w.status !== 'skipped')
      ? 'Race day is the only scheduled run in this week. Use familiar pacing, fuel and equipment; missed preparation is not added.'
      : 'No training runs remain scheduled this week. Skipped sessions are not made up.';
  const purpose = {
    Foundation: 'Develop a repeatable endurance routine.',
    Build: 'Build endurance and hold new mileage long enough to absorb it.',
    'Race preparation':
      'Practise patient pacing, familiar fuel and race-day kit.',
    Recovery: 'Use this lighter week to absorb the preceding training.',
    Taper:
      'Reduce running toward race day; keep only the familiar work shown in your schedule.',
    'Race week':
      'Keep the final training runs controlled. Use the pacing, fuel and equipment you have rehearsed.',
  }[week.phase];
  const quality = [
    f.steady ? 'Steady, comfortable efforts are included this week.' : '',
    f.tempo ? 'Controlled tempo is included this week.' : '',
    f.repetitions
      ? 'Faster repetitions are included this week; follow the targets in the saved workout.'
      : '',
    f.marathonPace ? 'The long run includes sustained marathon effort.' : '',
    !f.quality.length
      ? f.strides
        ? 'Easy running and relaxed strides are the only training prescribed.'
        : 'All scheduled training is at easy effort.'
      : '',
  ];
  const midweek = [...f.midweek].sort(
    (a, b) => b.estimatedKm - a.estimatedKm,
  )[0];
  let endurance = '';
  if (midweek) {
    const exact = midweek.steps.every((s) => s.metres != null);
    const km = exact
      ? midweek.steps.reduce((n, s) => n + s.metres!, 0) / 1000
      : midweek.estimatedKm;
    const distance = Number(
      (plan.profile.units === 'mi' ? km / 1.609344 : km).toFixed(1),
    );
    endurance = `Midweek running: ${exact ? '' : 'about '}${distance} ${plan.profile.units}. ${km >= 18 ? 'This medium-long outing supports your long run.' : 'This shorter outing contributes easy volume; it is not a full medium-long run.'}`;
  }
  return [purpose, ...quality, endurance].filter(Boolean).join(' ');
}

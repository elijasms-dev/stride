import { createHash } from 'node:crypto';

/** Keep prescription content exact while ignoring identity/version metadata. */
export function canonicalPrescription(value) {
  if (Array.isArray(value)) return value.map(canonicalPrescription);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .filter(
          (key) =>
            !['id', 'createdAt', 'engineVersion', 'policyVersion'].includes(
              key,
            ),
        )
        .sort()
        .map((key) => [key, canonicalPrescription(value[key])]),
    );
  }
  return value;
}

export function prescriptionHash(value) {
  return createHash('sha256')
    .update(JSON.stringify(canonicalPrescription(value)))
    .digest('hex');
}

export function marathonSnapshot(plan) {
  return {
    profile: prescriptionHash(plan.profile),
    notes: prescriptionHash(plan.notes),
    feasibility: prescriptionHash(plan.feasibility),
    weeks: plan.weeks.map((week) => ({
      index: week.index,
      start: week.start,
      phase: week.phase,
      trainingKm: week.targetKm,
      longKm: week.longKm,
      hash: prescriptionHash({
        week,
        workouts: plan.workouts.filter((w) => w.week === week.index),
      }),
    })),
    complete: prescriptionHash(plan),
  };
}

export const dayAfter = (date, days) =>
  new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000)
    .toISOString()
    .slice(0, 10);

/** Independent classification: relaxed strides do not count as a workout. */
export function weekdayQuality(workout) {
  return (
    !['race', 'long'].includes(workout.kind) &&
    workout.status !== 'skipped' &&
    workout.stimulus !== 'economy' &&
    workout.steps.some((step) => step.kind === 'work' && step.intensity >= 4)
  );
}

/** Independent reviewed opening contract. Do not import the allocator's target
 * helper: the runner's history stays fixed, and a lower plan requires truthful
 * disclosure plus an actual supporting-run capacity constraint. */
export function roadOpeningFailures(plan, input = plan.profile) {
  const failures = [];
  const check = (condition, message) => {
    if (!condition) failures.push(message);
  };
  check(
    plan.profile.weeklyKm === input.weeklyKm,
    'Saved weekly baseline changed',
  );
  check(
    plan.profile.longestKm === input.longestKm,
    'Saved longest-run baseline changed',
  );
  const week = plan.weeks[0];
  const taperDays =
    input.goal === 'marathon' ? 21 : input.goal === 'half' ? 14 : 7;
  const daysToRace = (date) =>
    (Date.parse(`${input.raceDate}T12:00:00Z`) -
      Date.parse(`${date}T12:00:00Z`)) /
    86400000;
  if (
    !week ||
    week.start < input.startDate ||
    ['Recovery', 'Taper', 'Race week'].includes(week.phase) ||
    daysToRace(dayAfter(week.start, 6)) <= taperDays
  )
    return failures;
  const opening = plan.workouts.filter(
    (w) => w.week === week.index && w.kind !== 'race' && w.status !== 'skipped',
  );
  const total = opening.reduce((sum, w) => sum + w.estimatedKm, 0);
  const long = opening.find((w) => w.kind === 'long');
  if ((input.runsPerWeek ?? input.days.length) >= 3)
    check(
      Math.abs((long?.estimatedKm ?? -1) - input.longestKm) <= 0.00101,
      'Opening long run differs from the declared familiar long run',
    );
  check(
    total > 0 && total <= input.weeklyKm + 0.00101,
    'Opening load exceeds declared volume or is empty',
  );
  const reduced = total < input.weeklyKm - 0.011;
  const notes = plan.notes.filter((note) =>
    note.startsWith('Opening-week balance ·'),
  );
  if (!reduced) {
    check(
      Math.abs(total - input.weeklyKm) <= 0.011,
      'Opening baseline has unexplained numerical drift',
    );
    check(
      notes.length === 0,
      'An unchanged opening must not claim a volume reduction',
    );
    return failures;
  }
  check(
    plan.sessionBalanceVersion === 'distinct-long-v1',
    'Opening reduction requires the reviewed road-balance contract',
  );
  check(
    notes.length === 1,
    'A lower opening requires exactly one clear balance disclosure',
  );
  const amounts = notes[0]?.match(
    /You reported ([\d.]+) km\/week and a long run of ([\d.]+) km\. This plan starts at ([\d.]+) km/,
  );
  check(
    !!amounts &&
      Number(amounts[1]) === input.weeklyKm &&
      Number(amounts[2]) === input.longestKm &&
      Math.abs(Number(amounts[3]) - total) <= 0.011,
    'Opening balance disclosure must state the actual plan and unchanged history',
  );
  let constrainedSupport = false;
  const day = (date) => (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
  for (const ordinary of plan.weeks.filter(
    (w) =>
      w.start >= input.startDate &&
      !['Recovery', 'Taper', 'Race week'].includes(w.phase) &&
      daysToRace(dayAfter(w.start, 6)) > taperDays,
  )) {
    const runs = plan.workouts.filter(
      (w) => w.week === ordinary.index && w.status !== 'skipped',
    );
    const longRun = runs.find((w) => w.kind === 'long');
    if (!longRun) continue;
    for (const run of runs.filter(
      (w) => w.kind === 'easy' && !w.hard && !w.pairId && !w.returnRole,
    )) {
      const gap = (day(run.date) - day(longRun.date) + 7) % 7;
      const shortSupport =
        gap === 1 ||
        gap === 6 ||
        plan.profile.days.includes((day(run.date) + 1) % 7);
      const cap = longRun.estimatedKm * (shortSupport ? 0.65 : 0.8);
      const minimumOuting = run.minutes <= 5 + 1 / 60;
      check(
        run.estimatedKm <= cap + 0.00101 || minimumOuting,
        `${run.date}: supporting run exceeds its independently specified long-run role`,
      );
      if (
        minimumOuting ||
        (run.estimatedKm <= cap + 0.00101 && cap - run.estimatedKm < 0.101)
      )
        constrainedSupport = true;
    }
  }
  check(
    constrainedSupport,
    'A reduced opening must be justified by a supporting-run role limit, not arbitrary underfilling',
  );
  return failures;
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, demoProfile, makePlan, validatePlan } from '../lib/engine.ts';
import { PlanError } from '../lib/plan/errors.ts';
import { prescribedDistanceKm, updateRunMeasure } from '../lib/run-distance.ts';
import { withWorkoutTargets } from '../lib/workout-targets.ts';

const start = '2026-09-21';
const manualPaces = {
  mode: 'pace',
  pace: {
    easy: { low: 350, high: 390 },
    tempo: { low: 280, high: 310 },
    interval: { low: 240, high: 270 },
    race: { low: 310, high: 340 },
  },
};
const cases = [
  { goal: 'base', weeklyKm: 30, longestKm: 8, count: 4, span: 111 },
  { goal: '5k', weeklyKm: 30, longestKm: 8, count: 4, span: 111 },
  { goal: '10k', weeklyKm: 40, longestKm: 12, count: 4, span: 111 },
  { goal: 'half', weeklyKm: 45, longestKm: 16, count: 4, span: 139 },
  { goal: 'marathon', weeklyKm: 70, longestKm: 25, count: 5, span: 167 },
  {
    goal: 'ultra',
    raceDistanceKm: 50,
    weeklyKm: 75,
    longestKm: 26,
    count: 5,
    span: 195,
  },
  {
    goal: 'custom',
    raceDistanceKm: 100,
    weeklyKm: 90,
    longestKm: 30,
    count: 5,
    span: 223,
  },
];
function input(c, patch = {}) {
  const { count, span, ...event } = c;
  return {
    ...demoProfile(start),
    ...event,
    startDate: start,
    raceDate: addDays(start, span),
    currentRuns: count,
    runsPerWeek: count,
    days: count === 4 ? [0, 2, 4, 6] : [0, 1, 2, 4, 6],
    availableDays: [0, 1, 2, 3, 4, 5, 6],
    longDay: 6,
    weekdayMinutes: 120,
    longMinutes: 240,
    easyPace: 6,
    experience: 'established',
    difficulty: 'balanced',
    intent: 'improve',
    volume: 'gradual',
    qualityMode: 'custom',
    qualitySessions: c.goal === 'base' ? 0 : 1,
    recentQualitySessions: 1,
    recentQualityMinutes: 25,
    stableWeeks: 16,
    ultraWeeklyMinutes: 600,
    ultraLongestMinutes: 210,
    runMeasure: 'time',
    workoutTargets: manualPaces,
    ...patch,
  };
}
const running = (plan, index = 0) =>
  plan.workouts.filter(
    (w) => w.week === index && w.kind !== 'race' && w.status !== 'skipped',
  );
const totalKm = (runs) => runs.reduce((sum, w) => sum + w.estimatedKm, 0);
const snapshot = (plan) =>
  plan.workouts.map(({ id, date, minutes, estimatedKm, steps }) => ({
    id,
    date,
    minutes,
    estimatedKm,
    steps,
  }));
function checkDistances(before, after) {
  assert.deepEqual(validatePlan(after), []);
  assert.deepEqual(validatePlan(JSON.parse(JSON.stringify(after))), []);
  for (const old of before.workouts) {
    const run = after.workouts.find((w) => w.id === old.id);
    assert.ok(
      Math.abs(run.estimatedKm - old.estimatedKm) <= 0.0005 + 1e-9,
      `${run.id} lost funded distance`,
    );
    assert.deepEqual(
      run.steps.filter((s) => s.intensity > 3).map((s) => s.seconds),
      old.steps.filter((s) => s.intensity > 3).map((s) => s.seconds),
      'measurement changes retain complete quality work',
    );
    if (
      ['easy', 'long'].includes(run.kind) &&
      prescribedDistanceKm(run) !== null
    ) {
      assert.equal(prescribedDistanceKm(run), run.estimatedKm);
      assert.ok(
        run.steps.every(
          (s) =>
            (s.metres * s.planningPaceSecondsPerKm) / 1000 <=
            s.seconds + 1 + 1e-9,
        ),
        'every distance endpoint fits its pace and time allowance',
      );
    }
  }
  assert.ok(
    Math.abs(totalKm(running(after)) - before.profile.weeklyKm) <= 0.001,
  );
  assert.equal(
    running(after).find((w) => w.kind === 'long').estimatedKm,
    before.profile.longestKm,
  );
  for (const week of after.weeks)
    assert.ok(
      Math.abs(
        week.trainingMinutes -
          running(after, week.index).reduce((sum, w) => sum + w.minutes, 0),
      ) < 1e-6,
    );
}

function legacyOpening(c, patch = {}) {
  // Saved timed plans budgeted at 6:00/km even with a manual 6:30/km band.
  // Recreate that executable opening week independently of current generation.
  const plan = makePlan(
    input(c, { workoutTargets: { mode: 'effort' } }),
    start,
    false,
  );
  plan.profile = { ...plan.profile, workoutTargets: manualPaces, ...patch };
  plan.weeks = [plan.weeks[0]];
  plan.workouts = running(plan).map((w) => withWorkoutTargets(w, plan.profile));
  return plan;
}

void test('a saved timed opening receives the missing manual-pace allowance without losing distance', () => {
  const original = legacyOpening(cases[3]);
  const untouched = structuredClone(original);
  const after = updateRunMeasure(original, 'distance', start);
  checkDistances(original, after);
  assert.equal(original.workouts.find((w) => w.kind === 'long').minutes, 96);
  assert.ok(after.workouts.find((w) => w.kind === 'long').minutes > 103.9);
  assert.deepEqual(original, untouched);
});

for (const c of cases) {
  void test(`${c.goal} manual-pace migration preserves the opening baseline and all funded runs`, () => {
    const original = makePlan(input(c), start, false);
    const untouched = structuredClone(original);
    const migrated = updateRunMeasure(original, 'distance', start);
    assert.deepEqual(original, untouched);
    checkDistances(original, migrated);
    assert.ok(
      running(migrated).find((w) => w.kind === 'long').minutes >
        c.longestKm * 6,
      'slower manual pace receives enough planning time',
    );
    let result = migrated;
    for (let round = 0; round < 3; round++) {
      const timed = updateRunMeasure(
        JSON.parse(JSON.stringify(result)),
        'time',
        start,
      );
      checkDistances(original, timed);
      result = updateRunMeasure(timed, 'distance', start);
      checkDistances(original, result);
      assert.deepEqual(
        snapshot(result),
        snapshot(migrated),
        'round trips must not repeatedly add time or lose metres',
      );
    }
  });
}

for (const { c, measure, pacing } of [
  { c: cases[4], measure: 'distance', pacing: 'manual' },
  ...['distance', 'time'].flatMap((measure) =>
    ['effort', 'benchmark'].map((pacing) => ({ c: cases[6], measure, pacing })),
  ),
]) {
  void test(`${c.goal} ${measure}/${pacing} round trips retain every funded metre`, () => {
    const p = input(c, { runMeasure: measure });
    if (pacing === 'effort') p.workoutTargets = { mode: 'effort' };
    if (pacing === 'benchmark') {
      p.recentRace = { distanceKm: 10, timeMinutes: 45 };
      delete p.workoutTargets;
    }
    const original = makePlan(p, start, false);
    let result = original;
    for (let round = 0; round < 3; round++) {
      result = updateRunMeasure(
        result,
        measure === 'distance' ? 'time' : 'distance',
        start,
      );
      checkDistances(original, result);
      result = updateRunMeasure(
        JSON.parse(JSON.stringify(result)),
        measure,
        start,
      );
      checkDistances(original, result);
      assert.deepEqual(
        result.workouts.map((w) => w.minutes),
        original.workouts.map((w) => w.minutes),
      );
      assert.ok(
        Math.abs(totalKm(running(result)) - c.weeklyKm) < 1e-9,
        'one-metre drift is not hidden by validator tolerance',
      );
    }
  });
}

for (const { label, patch } of [
  { label: 'long-session limit', patch: { longMinutes: 96 } },
  {
    label: 'long-day limit',
    patch: { dayPreferences: [{ day: 6, maxMinutes: 96 }] },
  },
  { label: 'weekly limit', patch: { weeklyMinutesLimit: 270 } },
]) {
  void test(`a manual-pace measurement change rejects an incompatible ${label} atomically`, () => {
    const original = legacyOpening(cases[3], patch);
    assert.deepEqual(validatePlan(original), []);
    const untouched = structuredClone(original);
    assert.throws(
      () => updateRunMeasure(original, 'distance', start),
      (error) => error instanceof PlanError && /cannot fit/.test(error.message),
    );
    assert.deepEqual(original, untouched);
  });
}

for (const { label, patch } of [
  { label: 'recent weekly minutes', patch: { ultraWeeklyMinutes: 540 } },
  { label: 'recent longest minutes', patch: { ultraLongestMinutes: 180 } },
]) {
  void test(`long-ultra mode changes also respect ${label}`, () => {
    const original = legacyOpening(cases[6], patch);
    assert.deepEqual(validatePlan(original), []);
    const untouched = structuredClone(original);
    assert.throws(
      () => updateRunMeasure(original, 'distance', start),
      (error) =>
        error instanceof PlanError &&
        /recent weekly or longest-run minutes/.test(error.message),
    );
    assert.deepEqual(original, untouched);
  });
}

void test('conversion preserves historical, manual, delivered and archived prescriptions byte for byte', () => {
  const plan = makePlan(input(cases[3]), start, false);
  const selected = plan.workouts.filter((w) => w.kind === 'easy').slice(0, 5);
  selected[0].status = 'completed';
  selected[0].feedback = {
    actualDate: selected[0].date,
    actualMinutes: selected[0].minutes,
    actualKm: selected[0].estimatedKm,
    effort: 3,
    feeling: 'good',
    execution: 'as-planned',
    note: 'Preserved fact',
    recordedAt: `${selected[0].date}T18:00:00Z`,
  };
  selected[1].status = 'skipped';
  selected[1].skipReason = 'Rest';
  selected[2].changed = true;
  selected[2].changeSource = 'manual';
  selected[4].week = -1;
  const untouched = structuredClone(plan);
  const after = updateRunMeasure(plan, 'distance', start, [selected[3].id]);
  for (const old of selected)
    assert.deepEqual(
      after.workouts.find((w) => w.id === old.id),
      old,
    );
  assert.deepEqual(plan, untouched);
  assert.ok(after.workouts.some((w) => prescribedDistanceKm(w) !== null));
});

void test('a longer pace allowance cannot push a saved start time past midnight', () => {
  const original = legacyOpening(cases[3]);
  const run = original.workouts.find((w) => w.kind === 'easy');
  const minute = Math.floor(1440 - run.minutes);
  run.startTime = `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
  assert.deepEqual(validatePlan(original), []);
  const untouched = structuredClone(original);
  assert.throws(() => updateRunMeasure(original, 'distance', start), PlanError);
  assert.deepEqual(original, untouched);
});

void test('extra planning time cannot consume a paired day’s six-hour recovery gap', () => {
  const original = legacyOpening(cases[0]);
  original.profile = {
    ...original.profile,
    days: [0, 2],
    weeklyKm: 10,
    longestKm: 0,
  };
  const easy = original.workouts.find((w) => w.kind === 'easy');
  original.workouts = ['AM', 'PM'].map((session, index) => ({
    ...easy,
    id: `paired-${session}`,
    date: start,
    originalDate: start,
    minutes: 30,
    estimatedKm: 5,
    pairId: 'paired-day',
    pairType: 'easy-doubles',
    session,
    startTime: index === 0 ? '06:00' : '12:30',
    steps: [{ ...easy.steps[0], seconds: 1800 }],
  }));
  original.weeks[0] = {
    ...original.weeks[0],
    targetKm: 10,
    longKm: 0,
    trainingMinutes: 60,
    qualityMinutes: 0,
  };
  assert.deepEqual(validatePlan(original), []);
  const untouched = structuredClone(original);
  assert.throws(() => updateRunMeasure(original, 'distance', start), PlanError);
  assert.deepEqual(original, untouched);
});

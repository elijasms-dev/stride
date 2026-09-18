import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateTrainingPaces,
  predictRaceTime,
  validateRecentRace,
} from '../lib/fitness-pacing.ts';
import {
  makePlan,
  demoProfile,
  addDays,
  validatePlan,
  validateProfile,
  refreshWorkoutVariety,
  revisePreferences,
  taperFactor,
  shortenWorkout,
} from '../lib/engine.ts';
import { validateRecovery } from '../lib/recovery.ts';
import {
  workoutStepTarget,
  validStepTarget,
  withWorkoutTargets,
} from '../lib/workout-targets.ts';
import { prescribedDistanceKm } from '../lib/run-distance.ts';
import { allocateRunningMinutes } from '../lib/training-structure.ts';
import {
  generateTrainingPlan,
  TrainingEngineError,
} from '../lib/trainingEngine.ts';

const start = '2026-09-14';
const profile = (patch = {}) => ({
  ...demoProfile(start),
  goal: 'marathon',
  raceDate: addDays(start, 125),
  weeklyKm: 70,
  longestKm: 23,
  currentRuns: 5,
  days: [0, 1, 2, 4, 6],
  longDay: 6,
  weekdayMinutes: 120,
  longMinutes: 300,
  easyPace: 6,
  qualityMode: 'automatic',
  recentQualitySessions: 2,
  recentQualityMinutes: 30,
  ...patch,
});
const build = (patch) => makePlan(profile(patch), start, false);
function assertRhythm(plan) {
  assert.deepEqual(validatePlan(plan), []);
  let previous = 0;
  for (const week of plan.weeks) {
    const runs = plan.workouts.filter(
      (w) => w.week === week.index && w.kind !== 'race',
    );
    const long = runs.find((w) => w.kind === 'long');
    if (long) {
      assert.ok(
        Number.isInteger(long.estimatedKm),
        `week ${week.index + 1}: ${long.estimatedKm}`,
      );
      assert.ok(long.estimatedKm <= 35);
      if (plan.profile.runMeasure === 'distance')
        assert.equal(prescribedDistanceKm(long), long.estimatedKm);
    }
    if (
      ['Recovery', 'Taper', 'Race week'].includes(week.phase) ||
      taperFactor(plan.profile, addDays(week.start, 6)) < 1 ||
      week.start < plan.profile.startDate
    )
      continue;
    assert.equal(
      runs.filter((w) => w.hard || w.kind === 'long').length,
      2,
      `quality week ${week.index + 1}`,
    );
    assert.equal(
      runs.filter(
        (w) => w.hard && w.kind !== 'long' && w.stimulus === 'threshold',
      ).length,
      1,
    );
    assert.ok(
      long.estimatedKm >= previous,
      `unmarked dip in week ${week.index + 1}: ${previous} -> ${long.estimatedKm}`,
    );
    previous = long.estimatedKm;
  }
  const plain = JSON.parse(JSON.stringify(plan));
  assert.deepEqual(validatePlan(plain), []);
}

test('Riegel identity, known distance prediction, scaling and ordered finite training paces', () => {
  const race = { distanceKm: 10, timeMinutes: 50 };
  assert.equal(predictRaceTime(race, 10), 50);
  assert.ok(
    Math.abs(predictRaceTime(race, 42.195) - 50 * (42.195 / 10) ** 1.06) <
      1e-10,
  );
  assert.equal(
    predictRaceTime({ ...race, timeMinutes: 100 }, 5),
    2 * predictRaceTime(race, 5),
  );
  for (const benchmark of [
    race,
    { distanceKm: 5, timeMinutes: 15 },
    { distanceKm: 5, timeMinutes: 70 },
  ]) {
    const p = calculateTrainingPaces(benchmark);
    assert.ok(
      p.interval < p.threshold && p.threshold < p.tempo && p.tempo < p.easy,
    );
    assert.ok(Object.values(p).every(Number.isFinite));
  }
});

test('malformed benchmarks produce controlled errors and normalize only their data', () => {
  for (const recentRace of [
    [],
    '5k',
    {},
    { distanceKm: 0, timeMinutes: 20 },
    { distanceKm: 5, timeMinutes: NaN },
    { distanceKm: Infinity, timeMinutes: 25 },
    { distanceKm: 5, timeMinutes: -1 },
  ]) {
    assert.throws(() => validateProfile(profile({ recentRace })), {
      name: 'PlanError',
    });
  }
  assert.deepEqual(
    validateRecentRace({ distanceKm: 5, timeMinutes: 25, extra: Infinity }),
    { distanceKm: 5, timeMinutes: 25 },
  );
  assert.equal(
    validateProfile(profile({ recentRace: null })).recentRace,
    undefined,
  );
});

for (const days of [4, 5, 6, 7])
  for (const weeks of [6, 12, 18, 26])
    for (const benchmark of [false, true]) {
      test(`${days} days, ${weeks} weeks, benchmark ${benchmark}: integer monotone long runs and two quality sessions`, () => {
        const plan = build({
          runsPerWeek: days,
          currentRuns: days,
          availableDays: [0, 1, 2, 3, 4, 5, 6],
          raceDate: addDays(start, weeks * 7 - 1),
          ...(benchmark
            ? { recentRace: { distanceKm: 10, timeMinutes: 50 } }
            : {}),
        });
        assertRhythm(plan);
        assertRhythm(refreshWorkoutVariety(plan, start));
        if (weeks === 18 && days === 5)
          assert.equal(Math.max(...plan.weeks.map((w) => w.longKm)), 35);
      });
    }

test('short blocks scale to available build weeks without jumping from 12 to 35', () => {
  const plan = build({ longestKm: 12, raceDate: addDays(start, 41) });
  assertRhythm(plan);
  assert.ok(Math.max(...plan.weeks.map((w) => w.longKm)) <= 18);
});

test('manual easy pace funds the declared weekly distance and integer long runs', () => {
  const plan = build({
    longestKm: 25,
    raceDate: addDays(start, 139),
    runsPerWeek: 5,
    availableDays: [0, 1, 2, 3, 4, 5, 6],
    longDay: 5,
    longMinutes: 210,
    recentQualityMinutes: 40,
    workoutTargets: {
      mode: 'pace',
      pace: {
        easy: { low: 330, high: 390 },
        tempo: { low: 270, high: 300 },
        interval: { low: 240, high: 270 },
        race: { low: 300, high: 330 },
      },
      raceScope: 'marathon:',
    },
  });
  assertRhythm(plan);
  const longs = plan.workouts.filter((w) => w.kind === 'long');
  assert.equal(longs[0].estimatedKm, 25);
  assert.equal(
    plan.workouts
      .filter((w) => w.week === 0 && w.kind !== 'race')
      .reduce((sum, w) => sum + w.minutes, 0),
    70 * 6.5,
  );
  assert.equal(plan.weeks[0].targetKm, 70);
  assert.equal(Math.max(...longs.map((w) => w.estimatedKm)), 32);
  for (const run of longs) {
    assert.ok(run.minutes >= run.estimatedKm * 6.5);
    assert.ok(run.minutes <= 210);
  }
  assertRhythm(refreshWorkoutVariety(plan, start));
});

test('busy days are capped before allocation and cannot cause unmarked long-run dips', () => {
  const plan = build({
    longestKm: 28,
    runsPerWeek: 6,
    currentRuns: 6,
    availableDays: [0, 1, 2, 3, 4, 5, 6],
    longDay: 5,
    difficulty: 'gentle',
    marathonApproach: 'endurance',
    dayPreferences: [{ day: 2, maxMinutes: 15 }],
  });
  assertRhythm(plan);
  assert.ok(
    plan.workouts
      .filter((w) => new Date(w.date + 'T12:00:00Z').getUTCDay() === 3)
      .every((w) => w.minutes <= 15),
  );
});

test('a maintained weekly distance retains its familiar long run at the manual pace', () => {
  const plan = build({
    weeklyKm: 60,
    longestKm: 26,
    volume: 'maintain',
    workoutTargets: {
      mode: 'pace',
      pace: { easy: { low: 330, high: 390 } },
    },
  });
  assert.equal(plan.weeks[0].targetKm, 60);
  assert.equal(plan.weeks[0].longKm, 26);
  assertRhythm(plan);
});

test('explicit frequency choices are retained while one weekday workout uses the standard rhythm', () => {
  for (const qualitySessions of [0, 1, 2]) {
    const plan = build({ qualityMode: 'custom', qualitySessions });
    assert.equal(plan.profile.qualitySessions, qualitySessions);
    assert.deepEqual(validatePlan(plan), []);
    if (qualitySessions === 1) assertRhythm(plan);
    if (qualitySessions === 0)
      assert.ok(
        plan.workouts.every(
          (w) => !w.hard || ['long', 'race'].includes(w.kind),
        ),
      );
  }
});

test('benchmark targets use current fitness and preserve explicit effort/HR/manual targets', () => {
  const p = profile({ recentRace: { distanceKm: 10, timeMinutes: 50 } });
  const work = {
    kind: 'work',
    seconds: 300,
    effort: 'Controlled',
    intensity: 6,
  };
  const tempo = { kind: 'tempo', stimulus: 'threshold' };
  const target = workoutStepTarget(tempo, work, p);
  assert.ok(validStepTarget(target));
  const exact = calculateTrainingPaces(p.recentRace).threshold;
  assert.ok(target.low < exact && target.high > exact);
  assert.equal(
    workoutStepTarget(tempo, work, {
      ...p,
      workoutTargets: { mode: 'effort' },
    }),
    undefined,
  );
  const manual = { low: 300, high: 320 };
  assert.deepEqual(
    workoutStepTarget(tempo, work, {
      ...p,
      workoutTargets: {
        mode: 'pace',
        pace: { easy: { low: 360, high: 390 }, tempo: manual },
      },
    }),
    { ...manual, mode: 'pace' },
  );
  assert.deepEqual(
    workoutStepTarget(tempo, work, {
      ...p,
      workoutTargets: {
        mode: 'heart-rate',
        heartRate: {
          easy: { low: 120, high: 140 },
          tempo: { low: 150, high: 165 },
        },
      },
    }),
    { mode: 'heart-rate', low: 150, high: 165 },
  );
  const plan = build({ recentRace: p.recentRace });
  assert.ok(
    plan.workouts
      .filter((w) => w.hard && w.kind === 'tempo')
      .every((w) => w.steps.some((s) => validStepTarget(s.target))),
  );
});

test('benchmark preference edits, clearing and shortening preserve serialization and protected history', () => {
  const plan = build({ recentRace: { distanceKm: 10, timeMinutes: 50 } });
  const asOf = addDays(start, 14);
  const history = plan.workouts.filter((w) => w.date < asOf);
  const next = revisePreferences(
    plan,
    { recentRace: { distanceKm: 10, timeMinutes: 48 } },
    asOf,
  );
  assert.deepEqual(
    next.workouts.filter((w) => w.date < asOf),
    history,
  );
  assert.deepEqual(validatePlan(JSON.parse(JSON.stringify(next))), []);
  const cleared = revisePreferences(plan, { recentRace: null }, start);
  assert.equal(cleared.profile.recentRace, undefined);
  const workout = plan.workouts.find((w) => w.hard && w.kind !== 'race');
  assert.deepEqual(
    validatePlan(shortenWorkout(plan, workout.id, 20, start)),
    [],
  );
});

test('allocator never manufactures volume or returns nonfinite values for a small budget', () => {
  for (const total of [0, 1, 16, 20, NaN, Infinity]) {
    const allocation = allocateRunningMinutes(
      total,
      [0, 1, 2, 3].map((key) => ({ key: String(key), weight: 1, cap: 60 })),
    );
    assert.ok(
      [...allocation.values()].every((n) => Number.isFinite(n) && n >= 0),
    );
    assert.ok(
      [...allocation.values()].reduce((a, b) => a + b, 0) <=
        (Number.isFinite(total) ? total : 0),
    );
  }
});

test('standalone API shares integer marathon progression, targets and bounded timelines', () => {
  for (const daysPerWeek of [3, 4, 5, 6, 7]) {
    const p = generateTrainingPlan({
      goal: 'marathon',
      currentLongRun: 23,
      currentWeeklyVolume: 70,
      daysPerWeek,
      weeksUntilRace: 18,
      recentRace: { distanceKm: 10, timeMinutes: 50 },
    });
    assert.equal(p.peakLongRunAchievedKm, 35);
    for (const week of p.weeks) {
      assert.ok(Number.isInteger(week.longRunKm) && week.longRunKm <= 35);
      assert.equal(
        week.dailySplits.filter((w) => w.type !== 'recovery').length,
        2,
      );
      assert.ok(
        week.dailySplits.every((w) => Number.isFinite(w.paceSecondsPerKm)),
      );
      assert.ok(
        Math.abs(
          week.dailySplits.reduce((n, w) => n + w.km, 0) -
            week.weeklyTotalVolume,
        ) <= 0.001,
      );
    }
    assert.deepEqual(
      JSON.parse(JSON.stringify(p)),
      JSON.parse(JSON.stringify(structuredClone(p))),
    );
  }
  assert.throws(
    () =>
      generateTrainingPlan({
        goal: 'marathon',
        currentLongRun: 23,
        daysPerWeek: 5,
        weeksUntilRace: 1e9,
      }),
    TrainingEngineError,
  );
});

test('benchmark and whole-distance prescriptions round-trip through the recovery reader', () => {
  const plan = build({ recentRace: { distanceKm: 10, timeMinutes: 50 } });
  const restored = validateRecovery({
    format: 'stride-recovery-2',
    exportedAt: start + 'T18:00:00Z',
    profile: null,
    plan: JSON.parse(JSON.stringify(plan)),
  });
  assert.deepEqual(restored.plan.profile.recentRace, plan.profile.recentRace);
  assert.deepEqual(validatePlan(restored.plan), []);
});

test('reapplying unchanged fitness targets preserves mixed long-run distance and duration', () => {
  const plan = build({ recentRace: { distanceKm: 10, timeMinutes: 50 } });
  for (const long of plan.workouts.filter((w) => w.kind === 'long')) {
    const again = withWorkoutTargets(long, plan.profile);
    assert.deepEqual(again, long);
    assert.ok(
      Math.abs(
        again.steps.reduce((n, s) => n + s.seconds, 0) - again.minutes * 60,
      ) < 1e-6,
    );
  }
  for (const recentRace of [
    { distanceKm: 1, timeMinutes: 15 },
    { distanceKm: 100, timeMinutes: 200 },
  ])
    assert.throws(() => validateProfile(profile({ recentRace })), {
      name: 'PlanError',
    });
});

test('a fixed marathon ignores stale custom distance when predicting race targets', () => {
  const p = profile({
    recentRace: { distanceKm: 10, timeMinutes: 50 },
    raceDistanceKm: 10,
  });
  const step = {
    kind: 'work',
    seconds: 1800,
    intensity: 6,
    effort: 'Marathon effort',
  };
  const target = workoutStepTarget(
    { kind: 'long', stimulus: 'race-rhythm' },
    step,
    p,
  );
  const expected = (predictRaceTime(p.recentRace, 42.195) * 60) / 42.195;
  assert.ok(target.low < expected && target.high > expected);
});

test('decimal planning paces retain the same whole long allocation in distance and time modes', () => {
  const distance = build({ easyPace: 7.17, runMeasure: 'distance' });
  const time = build({ easyPace: 7.17, runMeasure: 'time' });
  assertRhythm(distance);
  assertRhythm(time);
  assert.equal(distance.weeks[0].longKm, 23);
  assert.equal(Math.max(...distance.weeks.map((w) => w.longKm)), 35);
  assert.deepEqual(
    distance.weeks.map((w) => w.longKm),
    time.weeks.map((w) => w.longKm),
  );
});

test('switching measurement retains whole long allocations and complete work durations', async () => {
  const { updateRunMeasure } = await import('../lib/run-distance.ts');
  const plan = build({ recentRace: { distanceKm: 10, timeMinutes: 50 } });
  const time = updateRunMeasure(plan, 'time', start);
  const distance = updateRunMeasure(time, 'distance', start);
  for (const next of [time, distance]) {
    assertRhythm(next);
    assert.deepEqual(
      next.weeks.map((w) => w.longKm),
      plan.weeks.map((w) => w.longKm),
    );
    assert.deepEqual(
      next.workouts.map((w) => w.steps.map((s) => s.seconds)),
      plan.workouts.map((w) => w.steps.map((s) => s.seconds)),
    );
  }
});

test('a constrained long-run day produces a monotone build within its final capacity', () => {
  const constraints = [
    { day: 1, maxMinutes: 35 },
    { day: 2, maxMinutes: 45 },
    { day: 3, maxMinutes: 75 },
    { day: 5, maxMinutes: 180 },
  ];
  const settings = {
    weeklyMinutesLimit: 480,
    longDay: 5,
    longestKm: 25,
    runsPerWeek: 5,
    availableDays: [0, 1, 2, 3, 4, 5, 6],
    raceDate: addDays(start, 139),
    workoutTargets: {
      mode: 'pace',
      pace: {
        easy: { low: 330, high: 390 },
        tempo: { low: 270, high: 300 },
        interval: { low: 240, high: 270 },
      },
    },
  };
  assert.throws(
    () => build({ ...settings, dayPreferences: constraints }),
    /starting weekly distance/,
  );
  const plan = revisePreferences(
    build(settings),
    { dayPreferences: constraints },
    start,
  );
  assertRhythm(plan);
  assert.ok(
    plan.workouts
      .filter((w) => w.kind === 'long')
      .every((w) => w.minutes <= 180),
  );
});

test('out-of-range short-event race predictions retain effort without breaking other targets', () => {
  const p = profile({
    goal: 'custom',
    raceDistanceKm: 1,
    recentRace: { distanceKm: 5, timeMinutes: 11 },
  });
  const work = {
    kind: 'work',
    seconds: 300,
    effort: 'Controlled',
    intensity: 6,
  };
  assert.ok(
    validStepTarget(
      workoutStepTarget({ kind: 'tempo', stimulus: 'threshold' }, work, p),
    ),
  );
  assert.equal(
    workoutStepTarget({ kind: 'race', stimulus: 'race-rhythm' }, work, p),
    undefined,
  );
});

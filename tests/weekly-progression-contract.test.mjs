import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  demoProfile,
  makePlan,
  taperFactor,
  validatePlan,
} from '../lib/engine.ts';
import { TRAINING_POLICY } from '../lib/plan/policy.ts';
import { PlanError } from '../lib/plan/errors.ts';
import { reconcileOrdinaryWeeklyProgression } from '../lib/plan/generation-baseline.ts';

const start = '2026-09-21';
const total = (plan, index) =>
  plan.workouts
    .filter((run) => run.week === index && run.kind !== 'race')
    .reduce((sum, run) => sum + run.estimatedKm, 0);
const ordinary = (plan) =>
  plan.weeks.filter(
    (week) =>
      !['Recovery', 'Taper', 'Race week'].includes(week.phase) &&
      addDays(week.start, 6) <= plan.profile.raceDate &&
      taperFactor(plan.profile, addDays(week.start, 6)) === 1,
  );

for (const [goal, weeklyKm, longestKm, span, patch] of [
  ['5k', 30, 8, 83, {}],
  ['10k', 40, 12, 83, {}],
  ['half', 45, 16, 111, {}],
  [
    'marathon',
    70,
    30,
    139,
    {
      currentRuns: 5,
      days: [0, 1, 2, 4, 6],
      weekdayMinutes: 120,
      longMinutes: 240,
    },
  ],
  [
    'ultra',
    70,
    30,
    181,
    {
      raceDistanceKm: 50,
      currentRuns: 5,
      days: [0, 1, 2, 4, 6],
      weekdayMinutes: 120,
      longMinutes: 300,
    },
  ],
  [
    'custom',
    50,
    21,
    139,
    {
      raceDistanceKm: 30,
      currentRuns: 5,
      days: [0, 1, 3, 4, 6],
      weekdayMinutes: 100,
      longMinutes: 210,
    },
  ],
]) {
  assert.equal(typeof goal, 'string');
  if (typeof goal !== 'string') throw new Error('Expected a goal name');
  void test(`${goal}: maintaining weekly volume preserves the exact opening baseline across ordinary weeks`, () => {
    const plan = makePlan(
      {
        ...demoProfile(start),
        goal,
        weeklyKm,
        longestKm,
        raceDate: addDays(start, span),
        currentRuns: 4,
        days: [0, 2, 4, 6],
        longDay: 6,
        weekdayMinutes: 90,
        longMinutes: 180,
        easyPace: 6,
        qualityMode: 'custom',
        qualitySessions: 1,
        recentQualitySessions: 1,
        recentQualityMinutes: 20,
        volume: 'maintain',
        ...patch,
      },
      start,
      false,
    );
    const protectedRuns = plan.workouts
      .filter((run) => run.hard || run.kind === 'long')
      .map((run) => structuredClone(run));
    reconcileOrdinaryWeeklyProgression(plan);
    for (const week of ordinary(plan))
      assert.ok(Math.abs(total(plan, week.index) - weeklyKm) <= 0.00101);
    assert.deepEqual(
      plan.workouts.filter((run) => run.hard || run.kind === 'long'),
      protectedRuns,
    );
    assert.deepEqual(validatePlan(plan), []);
    const once = structuredClone(plan);
    reconcileOrdinaryWeeklyProgression(plan);
    assert.deepEqual(plan, once);
  });
}

function forecastFixture() {
  const profile = {
    ...demoProfile(start),
    goal: 'half',
    raceDate: addDays(start, 83),
    weeklyKm: 50,
    longestKm: 18,
    days: [0, 2, 4, 6],
    currentRuns: 4,
    longDay: 6,
    weekdayMinutes: 90,
    longMinutes: 180,
    easyPace: 6,
    runMeasure: 'distance',
    volume: 'gradual',
  };
  const weeks = Array.from({ length: 3 }, (_, index) => ({
    index,
    start: addDays(start, index * 7),
    phase: 'Build',
    targetKm: 0,
    longKm: 0,
    focus: 'Synthetic capacity check',
  }));
  const distances = [
    [11, 10, 11, 18],
    [14.333, 13.333, 14.334, 18],
    [15, 8.333, 15, 20],
  ];
  const workouts = weeks.flatMap((week) =>
    distances[week.index].map((estimatedKm, index) => {
      const kind = index === 1 ? 'tempo' : index === 3 ? 'long' : 'easy';
      const seconds = Math.round(estimatedKm * 360);
      const date = addDays(week.start, profile.days[index]);
      return {
        id: `${week.index}-${index}`,
        date,
        originalDate: date,
        week: week.index,
        title: kind,
        kind,
        estimatedKm,
        minutes: seconds / 60,
        hard: kind === 'tempo',
        purpose: 'Synthetic immutable prescription',
        reason: 'Capacity fixture',
        status: 'planned',
        steps: [
          {
            kind: 'work',
            label: kind,
            seconds,
            intensity: kind === 'tempo' ? 6 : 3,
            effort: kind === 'tempo' ? 'Controlled' : 'Easy',
            movement: 'run',
            metres: Math.round(estimatedKm * 1000),
            planningPaceSecondsPerKm: 360,
          },
        ],
      };
    }),
  );
  return {
    id: 'capacity-fixture',
    engineVersion: 'test',
    policyVersion: TRAINING_POLICY.version,
    profile,
    weeks,
    workouts,
    notes: [],
    createdAt: start,
  };
}

void test('future feasible capacity trims earlier easy-volume excess while preserving the opening baseline and fixed work', () => {
  const plan = forecastFixture();
  // Bind the overall time budget: aerobic space inside quality sessions is now
  // usable, so an easy-only capacity assumption is no longer a real ceiling.
  plan.profile.weeklyMinutesLimit = 350;
  const fixed = structuredClone(
    plan.workouts.filter((run) => run.hard || run.kind === 'long'),
  );
  reconcileOrdinaryWeeklyProgression(plan);
  assert.equal(total(plan, 0), 50);
  assert.ok(total(plan, 1) < 60);
  assert.ok(total(plan, 1) >= 50 && total(plan, 1) <= total(plan, 2) + 0.00101);
  assert.deepEqual(
    plan.workouts.filter((run) => run.hard || run.kind === 'long'),
    fixed,
  );
  for (const run of plan.workouts)
    assert.ok(run.minutes <= (run.kind === 'long' ? 180 : 90));
  const once = structuredClone(plan);
  reconcileOrdinaryWeeklyProgression(plan);
  assert.deepEqual(plan, once);
});

void test('maintain mode trims tiny rounding excess instead of treating it as a new weekly baseline', () => {
  const plan = forecastFixture();
  plan.profile.volume = 'maintain';
  const runs = plan.workouts.filter((run) => run.week === 1);
  runs[0].estimatedKm -= 9.998;
  reconcileOrdinaryWeeklyProgression(plan);
  for (const week of plan.weeks)
    assert.ok(Math.abs(total(plan, week.index) - 50) <= 0.00101);
});

void test('weekly funding preserves run/walk jogging bouts and adjusts walking recovery only', () => {
  const plan = forecastFixture();
  plan.weeks = plan.weeks.slice(0, 2);
  const opening = plan.workouts.filter((run) => run.week === 0);
  const next = opening.map((run) => ({
    ...structuredClone(run),
    id: `next-${run.id}`,
    week: 1,
    date: addDays(run.date, 7),
  }));
  const runWalk = next[0];
  runWalk.estimatedKm = 10.8;
  runWalk.minutes = 64.8;
  runWalk.steps = [
    {
      kind: 'work',
      label: 'Jog',
      seconds: 3600,
      intensity: 3,
      effort: 'Easy',
      movement: 'run',
    },
    {
      kind: 'recovery',
      label: 'Walk',
      seconds: 288,
      intensity: 1,
      effort: 'Relaxed',
      movement: 'walk',
    },
  ];
  plan.workouts = [...opening, ...next];
  const jogging = structuredClone(runWalk.steps[0]);
  reconcileOrdinaryWeeklyProgression(plan);
  assert.ok(Math.abs(total(plan, 1) - 50) <= 0.00101);
  assert.deepEqual(runWalk.steps[0], jogging);
  assert.equal(runWalk.steps[1].seconds, 360);
});

void test('an unfundable opening baseline raises a controlled error naming the affected week', () => {
  const plan = forecastFixture();
  plan.profile.easyLimitKm = 5;
  assert.throws(
    () => reconcileOrdinaryWeeklyProgression(plan),
    (error) =>
      error instanceof PlanError &&
      /Week 3 cannot maintain 50 km/.test(error.message),
  );
});

for (const [name, protect] of [
  [
    'recorded history',
    (plan) => {
      plan.workouts[0].status = 'completed';
    },
  ],
  [
    'manual change',
    (plan) => {
      plan.workouts[0].changed = true;
      plan.workouts[0].changeSource = 'manual';
    },
  ],
  [
    'return stage',
    (plan) => {
      plan.returnState = {
        from: start,
        to: addDays(start, 7),
        stage: 1,
        stageStarted: start,
        baselineKm: 50,
        longestKm: 18,
        reason: 'Synthetic return',
      };
    },
  ],
  [
    'later constraints',
    (plan) => {
      plan.constraintsFrom = addDays(start, 7);
    },
  ],
  [
    'earlier policy',
    (plan) => {
      plan.policyVersion = 'older-policy';
    },
  ],
]) {
  if (typeof name !== 'string') throw new Error('Expected a safeguard name');
  void test(`${name} prevents automatic weekly progression funding`, () => {
    const plan = forecastFixture();
    protect(plan);
    const before = structuredClone(plan);
    reconcileOrdinaryWeeklyProgression(plan, true);
    assert.deepEqual(plan, before);
  });
}

void test('recovery and taper prescriptions are untouched by backward trimming and ordinary funding', () => {
  const plan = forecastFixture();
  const recovery = structuredClone(plan.weeks[1]);
  recovery.index = 3;
  recovery.start = addDays(start, 21);
  recovery.phase = 'Recovery';
  const taper = {
    ...recovery,
    index: 4,
    start: addDays(start, 28),
    phase: 'Taper',
  };
  plan.weeks.push(recovery, taper);
  for (const week of [recovery, taper])
    plan.workouts.push(
      ...plan.workouts
        .filter((run) => run.week === 0)
        .map((run) => ({
          ...structuredClone(run),
          id: `${week.index}-${run.id}`,
          date: addDays(run.date, week.index * 7),
          originalDate: addDays(run.date, week.index * 7),
          week: week.index,
        })),
    );
  const protectedRuns = structuredClone(
    plan.workouts.filter((run) => run.week >= 3),
  );
  reconcileOrdinaryWeeklyProgression(plan);
  assert.deepEqual(
    plan.workouts.filter((run) => run.week >= 3),
    protectedRuns,
  );
});

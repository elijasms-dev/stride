import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, demoProfile, makePlan, validatePlan } from '../lib/engine.ts';
import {
  reconcileOpeningBaseline,
  reconcileOrdinaryWeeklyProgression,
} from '../lib/plan/generation-baseline.ts';
import { TRAINING_POLICY } from '../lib/plan/policy.ts';
import { PlanError } from '../lib/plan/errors.ts';

const start = '2026-09-21';
function fundingFixture(runMeasure = 'distance') {
  const profile = {
    ...demoProfile(start),
    goal: 'half',
    raceDate: addDays(start, 111),
    weeklyKm: 52,
    longestKm: 18,
    currentRuns: 4,
    days: [0, 2, 4, 6],
    longDay: 6,
    weekdayMinutes: 90,
    longMinutes: 180,
    easyPace: 6,
    easyLimitKm: 11,
    qualityLimitKm: 12,
    weeklyMinutesLimit: 296,
    runMeasure,
  };
  const workouts = [11, 10, 11, 18].map((km, index) => {
    const kind = index === 1 ? 'tempo' : index === 3 ? 'long' : 'easy';
    const seconds = Math.round(km * 360);
    const date = addDays(start, profile.days[index]);
    return {
      id: `quality-funding-${index}`,
      week: 0,
      date,
      originalDate: date,
      kind,
      hard: kind === 'tempo',
      title: kind,
      status: 'planned',
      purpose: 'Synthetic funding invariant',
      reason: 'Synthetic funding invariant',
      estimatedKm: km,
      minutes: seconds / 60,
      steps: [
        {
          kind: 'aerobic',
          label: 'Easy',
          intensity: 3,
          effort: 'Easy',
          movement: 'run',
          seconds,
          metres: km * 1000,
          planningPaceSecondsPerKm: 360,
        },
      ],
    };
  });
  const quality = workouts[1];
  quality.minutes = 44;
  quality.steps = [
    {
      kind: 'warmup',
      label: 'Warm up',
      intensity: 2,
      effort: 'Easy',
      movement: 'run',
      seconds: 360,
      metres: 1000,
      planningPaceSecondsPerKm: 360,
    },
    {
      kind: 'work',
      label: 'Controlled fast running',
      intensity: 6,
      effort: 'Controlled',
      movement: 'run',
      seconds: 1920,
      metres: 8000,
      planningPaceSecondsPerKm: 240,
      target: { mode: 'pace', low: 230, high: 250 },
    },
    {
      kind: 'cooldown',
      label: 'Cool down',
      intensity: 2,
      effort: 'Easy',
      movement: 'run',
      seconds: 360,
      metres: 1000,
      planningPaceSecondsPerKm: 360,
    },
  ];
  return {
    id: 'quality-funding-plan',
    engineVersion: 'test',
    policyVersion: TRAINING_POLICY.version,
    createdAt: start,
    profile,
    weeks: [
      {
        index: 0,
        start,
        phase: 'Build',
        targetKm: 50,
        longKm: 18,
        focus: 'Synthetic funding invariant',
      },
    ],
    workouts,
    notes: [],
  };
}

for (const measure of ['time', 'distance'])
  void test(`${measure}: binding easy caps fund aerobic time around immutable faster distance work`, () => {
    const plan = fundingFixture(measure);
    const quality = plan.workouts[1];
    const originalSteps = structuredClone(quality.steps);
    reconcileOpeningBaseline(plan);
    assert.equal(
      plan.workouts.reduce((sum, run) => sum + run.estimatedKm, 0),
      52,
    );
    assert.equal(
      plan.workouts.reduce((sum, run) => sum + run.minutes, 0),
      296,
    );
    assert.equal(quality.estimatedKm, 12);
    assert.equal(quality.minutes, 56);
    assert.deepEqual(
      quality.steps.filter((step) => step.kind !== 'aerobic'),
      originalSteps,
    );
    assert.equal(
      quality.steps.find((step) => step.kind === 'aerobic').seconds,
      720,
    );
    assert.deepEqual(
      plan.workouts
        .filter((run) => run.kind === 'easy')
        .map((run) => run.estimatedKm),
      [11, 11],
    );
    assert.equal(
      plan.workouts.find((run) => run.kind === 'long').estimatedKm,
      18,
    );
    assert.equal(
      quality.steps.reduce((sum, step) => sum + step.seconds, 0),
      quality.minutes * 60,
    );
    const once = structuredClone(plan);
    reconcileOpeningBaseline(plan);
    assert.deepEqual(plan, once);
  });

for (const limit of ['quality-distance', 'weekly-time'])
  void test(`${limit}: padding respects the selected ceiling`, () => {
    const plan = fundingFixture();
    if (limit === 'quality-distance') plan.profile.qualityLimitKm = 11;
    else plan.profile.weeklyMinutesLimit = 295;
    assert.throws(() => reconcileOpeningBaseline(plan), PlanError);
  });

void test('time-based padding uses the slow edge of explicit easy pace while preserving faster work', () => {
  const plan = fundingFixture('time');
  plan.profile.weeklyMinutesLimit = 338;
  plan.profile.workoutTargets = {
    mode: 'pace',
    pace: {
      easy: { low: 400, high: 420 },
      tempo: { low: 230, high: 250 },
    },
  };
  const quality = plan.workouts[1];
  const original = structuredClone(quality.steps);
  reconcileOpeningBaseline(plan);
  assert.equal(quality.minutes, 58);
  assert.equal(
    quality.steps.find((step) => step.kind === 'aerobic').seconds,
    840,
  );
  assert.deepEqual(
    quality.steps.filter((step) => step.kind !== 'aerobic'),
    original,
  );
  assert.equal(
    plan.workouts.reduce((sum, run) => sum + run.minutes, 0),
    338,
  );
  assert.equal(
    plan.workouts.reduce((sum, run) => sum + run.estimatedKm, 0),
    52,
  );
});

void test('slow 50 km preparation can preserve a funded baseline with two requested workouts', () => {
  const input = {
    ...demoProfile(start),
    goal: 'ultra',
    raceDistanceKm: 50,
    raceDate: addDays(start, 223),
    weeklyKm: 70,
    longestKm: 28,
    currentRuns: 5,
    runsPerWeek: 5,
    days: [0, 1, 3, 4, 6],
    availableDays: [0, 1, 2, 3, 4, 5, 6],
    longDay: 6,
    weekdayMinutes: 120,
    longMinutes: 300,
    easyPace: 8.25,
    volume: 'gradual',
    qualityMode: 'custom',
    qualitySessions: 2,
    recentQualitySessions: 2,
    recentQualityMinutes: 40,
    runMeasure: 'distance',
  };
  const plan = makePlan(input, start, false);
  const opening = plan.workouts.filter(
    (run) => run.week === 0 && run.kind !== 'race',
  );
  assert.ok(
    Math.abs(opening.reduce((sum, run) => sum + run.estimatedKm, 0) - 70) <=
      0.00101,
  );
  assert.equal(opening.find((run) => run.kind === 'long').estimatedKm, 28);
  assert.equal(opening.filter((run) => run.hard).length, 2);
  assert.ok(
    opening.every(
      (run) => run.minutes <= (run.kind === 'long' ? 300 : 120) + 1 / 60,
    ),
  );
  assert.deepEqual(validatePlan(JSON.parse(JSON.stringify(plan))), []);
});

void test('two quality sessions cannot manufacture zero-second metres in the future capacity forecast', () => {
  const profile = {
    ...fundingFixture().profile,
    weeklyKm: 49.9,
    currentRuns: 5,
    days: [0, 1, 3, 4, 6],
    easyLimitKm: 10,
    weeklyMinutesLimit: 288,
    qualitySessions: 2,
    recentQualitySessions: 2,
  };
  const weeks = [0, 1, 2].map((index) => ({
    index,
    start: addDays(start, index * 7),
    phase: 'Build',
    targetKm: 0,
    longKm: 18,
    focus: 'Synthetic rounded-capacity invariant',
  }));
  const workouts = weeks.flatMap((week) => {
    const qualityKm = [5.95, 6.05, 5.999][week.index];
    return [10, qualityKm, qualityKm, 10, 18].map((km, index) => {
      const hard = index === 1 || index === 2;
      const pace = hard ? (week.index === 2 ? 300 : 240) : 360;
      const seconds = Math.round(km * pace);
      const date = addDays(week.start, profile.days[index]);
      return {
        id: `rounding-${week.index}-${index}`,
        week: week.index,
        date,
        originalDate: date,
        kind: index === 4 ? 'long' : hard ? 'tempo' : 'easy',
        hard,
        status: 'planned',
        title: 'Synthetic prescription',
        purpose: 'Rounded-capacity invariant',
        reason: 'Rounded-capacity invariant',
        estimatedKm: km,
        minutes: seconds / 60,
        steps: [
          {
            kind: 'work',
            label: 'Run',
            seconds,
            metres: Math.round(km * 1000),
            planningPaceSecondsPerKm: pace,
            intensity: hard ? 6 : 3,
            effort: 'Controlled',
            movement: 'run',
          },
        ],
      };
    });
  });
  const plan = {
    profile,
    weeks,
    workouts,
    policyVersion: TRAINING_POLICY.version,
    engineVersion: 'test',
    notes: [],
    createdAt: start,
  };
  const fixed = structuredClone(
    workouts.filter((run) => run.hard || run.kind === 'long'),
  );
  reconcileOrdinaryWeeklyProgression(plan);
  const totals = weeks.map((week) =>
    workouts
      .filter((run) => run.week === week.index)
      .reduce((sum, run) => sum + run.estimatedKm, 0),
  );
  assert.equal(totals[0], 49.9);
  assert.ok(Math.abs(totals[1] - 49.998) <= 0.00101);
  assert.equal(totals[2], 49.998);
  assert.deepEqual(
    workouts.filter((run) => run.hard || run.kind === 'long'),
    fixed,
  );
  assert.ok(
    workouts
      .filter((run) => run.week === 2)
      .reduce((sum, run) => sum + run.minutes, 0) <= 288,
  );
});

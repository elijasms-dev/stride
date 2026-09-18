import test from 'node:test';
import assert from 'node:assert/strict';
import { demoProfile } from '../lib/engine.ts';
import {
  prescribedDistanceKm,
  updateRunMeasure,
  withRunDistance,
} from '../lib/run-distance.ts';
import { withWorkoutTargets } from '../lib/workout-targets.ts';

const start = '2026-09-21';
const profile = (goal, easyPace = 6) => ({
  ...demoProfile(start),
  goal,
  easyPace,
  longMinutes: 240,
  runMeasure: 'distance',
  workoutTargets: { mode: 'effort' },
});
const longRun = (km, seconds) => ({
  id: 'funded-baseline-long',
  date: start,
  originalDate: start,
  week: 0,
  kind: 'long',
  title: 'Long aerobic run',
  status: 'planned',
  minutes: seconds / 60,
  estimatedKm: km,
  hard: false,
  stimulus: 'aerobic',
  purpose: 'Existing long-run distance',
  reason: 'Funded by the existing session allowance.',
  steps: [
    {
      kind: 'work',
      label: 'Easy running',
      seconds,
      intensity: 3,
      effort: 'Conversational',
      movement: 'run',
    },
  ],
});
const planFor = (p, run) => ({
  profile: p,
  workouts: [run],
  weeks: [
    {
      index: 0,
      start,
      phase: 'Build',
      targetKm: run.estimatedKm,
      longKm: run.estimatedKm,
      focus: 'Existing routine',
    },
  ],
  notes: [],
});

for (const [goal, km, pace] of [
  ['half', 20, 6],
  ['half', 10.5, 6],
  ['marathon', 10.5, 6],
  ['half', 10.543, 6],
  ['ultra', 40.5, 5],
]) {
  void test(`${goal} preserves its funded ${km} km long target across refreshes and measurement changes`, () => {
    const p = profile(goal, pace);
    // A time allowance can include a little spare time; it must not redefine
    // the supplied distance when switching to time measurement and back.
    const original = longRun(km, Math.ceil(km * pace * 60) + 30);
    let run = withWorkoutTargets(original, p);
    for (let i = 0; i < 5; i++)
      run = withWorkoutTargets(JSON.parse(JSON.stringify(run)), p);
    assert.equal(run.estimatedKm, km);
    assert.equal(prescribedDistanceKm(run), km);
    assert.equal(run.minutes, original.minutes);
    assert.ok(run.minutes <= p.longMinutes);
    assert.deepEqual(
      run.steps.map((s) => s.seconds),
      original.steps.map((s) => s.seconds),
    );
    assert.equal(original.steps[0].metres, undefined);

    let plan = planFor(p, run);
    for (let i = 0; i < 3; i++) {
      plan = updateRunMeasure(plan, 'time', start);
      assert.equal(plan.workouts[0].estimatedKm, km);
      assert.equal(prescribedDistanceKm(plan.workouts[0]), null);
      plan = updateRunMeasure(plan, 'distance', start);
      assert.equal(prescribedDistanceKm(plan.workouts[0]), km);
      assert.equal(plan.workouts[0].minutes, original.minutes);
    }
  });
}

void test('slower targets reduce a long distance to the funded metre without adding seconds', () => {
  const p = {
    ...profile('half'),
    workoutTargets: {
      mode: 'pace',
      pace: { easy: { low: 360, high: 390 } },
    },
  };
  const before = longRun(20, 7200);
  const after = withWorkoutTargets(before, p);
  assert.equal(prescribedDistanceKm(after), 18.461);
  assert.equal(after.minutes, 120);
  assert.equal(after.steps[0].seconds, 7200);
  assert.ok((after.steps[0].metres * 390) / 1000 <= 7200);
  assert.deepEqual(withWorkoutTargets(after, p), after);
});

void test('multi-step long conversion preserves total funding and each step capacity', () => {
  const p = profile('half', 6.5);
  const before = longRun(20, 7800);
  before.steps = [1235, 6565].map((seconds) => ({
    ...before.steps[0],
    seconds,
  }));
  const after = withRunDistance(before, p);
  assert.equal(prescribedDistanceKm(after), 20);
  assert.equal(
    after.steps.reduce((sum, step) => sum + step.seconds, 0),
    7800,
  );
  assert.ok(
    after.steps.every(
      (step) =>
        (step.metres * step.planningPaceSecondsPerKm) / 1000 <=
        step.seconds + 1,
    ),
  );
  assert.deepEqual(withRunDistance(after, p), after);
});

void test('metre apportionment respects the one-second tolerance even at a very slow pace', () => {
  const p = profile('half', 20);
  const before = longRun(0.02, 24);
  before.steps = [0.1, 23.9].map((seconds) => ({
    ...before.steps[0],
    seconds,
  }));
  const after = withRunDistance(before, p);
  // A step too short to fund even one metre remains timed; no invalid endpoint
  // is created to manufacture the requested distance.
  assert.equal(prescribedDistanceKm(after), null);
  assert.deepEqual(after, before);
});

void test('ordinary easy runs retain their existing 100-metre rounding', () => {
  const before = { ...longRun(5.543, 2100), kind: 'easy' };
  const after = withRunDistance(before, profile('half'));
  assert.equal(prescribedDistanceKm(after), 5.5);
  assert.equal(after.minutes, before.minutes);
});

void test('an explicitly funded easy distance survives target refreshes and time round trips', () => {
  const p = profile('half');
  const run = {
    ...longRun(3.743, 1350),
    kind: 'easy',
    title: '3.5 km · Easy run',
  };
  run.steps[0].metres = 3743;
  run.steps[0].planningPaceSecondsPerKm = 360;
  // Opening-week reconciliation may inherit an earlier estimate and title.
  run.distanceEstimate = {
    lowerKm: 3.5,
    upperKm: 3.5,
    basis: 'Earlier allocation',
  };
  let refreshed = run;
  for (let i = 0; i < 5; i++) refreshed = withWorkoutTargets(refreshed, p);
  assert.equal(prescribedDistanceKm(refreshed), 3.743);
  assert.equal(refreshed.estimatedKm, 3.743);
  assert.equal(refreshed.minutes, 22.5);
  assert.equal(refreshed.distanceEstimate.lowerKm, 3.743);
  assert.equal(refreshed.distanceEstimate.upperKm, 3.743);
  assert.match(refreshed.title, /^3\.7 km ·/);

  let plan = planFor(p, refreshed);
  for (let i = 0; i < 3; i++) {
    plan = updateRunMeasure(plan, 'time', start);
    assert.equal(plan.workouts[0].estimatedKm, 3.743);
    assert.equal(prescribedDistanceKm(plan.workouts[0]), null);
    plan = updateRunMeasure(plan, 'distance', start);
    assert.equal(prescribedDistanceKm(plan.workouts[0]), 3.743);
    assert.equal(plan.workouts[0].minutes, 22.5);
  }
});

void test('a saved easy distance shrinks to its pace-funded capacity without increasing time', () => {
  const p = {
    ...profile('half'),
    workoutTargets: {
      mode: 'pace',
      pace: { easy: { low: 360, high: 390 } },
    },
  };
  const run = { ...longRun(3.743, 1350), kind: 'easy' };
  run.steps[0].metres = 3743;
  const after = withWorkoutTargets(run, p);
  assert.equal(prescribedDistanceKm(after), 3.461);
  assert.equal(after.minutes, run.minutes);
  assert.ok(
    after.steps.every((step) => (step.metres * 390) / 1000 <= step.seconds),
  );
  assert.equal(after.distanceEstimate.lowerKm, 3.461);
  assert.deepEqual(withWorkoutTargets(after, p), after);
});

void test('measurement round trips retain the existing one-second funding tolerance', () => {
  const p = profile('half', 398 / 60);
  const run = { ...longRun(7.654, 3046), kind: 'easy' };
  Object.assign(run.steps[0], { metres: 7654, planningPaceSecondsPerKm: 398 });
  const initial = planFor(p, withWorkoutTargets(run, p));
  const time = updateRunMeasure(initial, 'time', start);
  const restored = updateRunMeasure(time, 'distance', start);
  assert.equal(prescribedDistanceKm(restored.workouts[0]), 7.654);
  assert.equal(restored.workouts[0].minutes, run.minutes);
  assert.equal(restored.workouts[0].steps[0].seconds, 3046);
  assert.ok((7654 * 398) / 1000 <= 3047);
});

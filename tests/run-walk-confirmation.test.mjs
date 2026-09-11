import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makePlan,
  demoProfile,
  noviceReview,
  advanceRunWalk,
  validatePlan,
} from '../lib/engine.ts';
import { trainingRecords } from '../lib/run-records.ts';
import { isRunWalkWorkout } from '../lib/run-walk.ts';
import { validateRecovery, prepareRestoredPlan } from '../lib/recovery.ts';

const start = '2026-08-31';
const asOf = '2026-09-11';
function completedPlan(execution = 'as-planned') {
  const plan = makePlan(
    {
      ...demoProfile(start),
      name: 'Synthetic confirmation check',
      goal: 'base',
      startDate: start,
      raceDate: '2026-11-29',
      experience: 'new',
      weeklyKm: 8,
      longestKm: 2,
      currentRuns: 2,
      runsPerWeek: 2,
      days: [1, 5],
      availableDays: [0, 1, 2, 3, 4, 5, 6],
      longDay: 5,
      weekdayMinutes: 40,
      longMinutes: 60,
      easyPace: null,
      qualitySessions: 0,
      recentQualitySessions: 0,
      recentQualityMinutes: 0,
      volume: 'maintain',
    },
    start,
  );
  for (const w of plan.workouts.filter((w) => w.date < asOf)) {
    w.status = 'completed';
    w.feedback = {
      actualDate: w.date,
      actualMinutes: w.minutes,
      actualKm: null,
      effort: 3,
      feeling: 'good',
      note: 'Synthetic outing',
      recordedAt: w.date + 'T18:00:00Z',
      ...(execution === 'missing' ? {} : { execution }),
    };
  }
  return plan;
}
const logs = (p) => p.workouts.filter((w) => w.feedback);

for (const execution of [
  'missing',
  'unknown',
  'partial',
  'easy-substitute',
  'not-attempted',
]) {
  test(`${execution} cannot certify running intervals from total outing time`, () => {
    const plan = completedPlan(execution),
      before = structuredClone(plan);
    const review = noviceReview(plan, asOf);
    assert.equal(review.ready, false);
    assert.equal(review.completed, 0);
    assert.equal(
      review.unconfirmedWorkoutIds.length,
      ['missing', 'unknown'].includes(execution) ? 3 : 0,
    );
    assert.throws(
      () => advanceRunWalk(plan, asOf),
      /confirming that you completed the running intervals/,
    );
    assert.equal(trainingRecords(plan).length, 3);
    assert.equal(
      trainingRecords(plan).reduce((n, r) => n + r.minutes, 0),
      logs(plan).reduce((n, w) => n + w.minutes, 0),
    );
    assert.deepEqual(plan, before);
  });
}

test('explicit interval confirmation allows review while preserving completed logs and frequency', () => {
  const plan = completedPlan(),
    before = structuredClone(plan);
  assert.equal(noviceReview(plan, asOf).ready, true);
  const next = advanceRunWalk(plan, asOf);
  assert.equal(next.profile.runWalkStage, 1);
  assert.equal(next.profile.runsPerWeek, 2);
  assert.deepEqual(logs(next), logs(before));
  assert.deepEqual(plan, before);
  assert.deepEqual(validatePlan(next), []);
});

test('correcting an unknown log changes readiness and evidence without changing its prescription', () => {
  const plan = completedPlan(),
    w = logs(plan).at(-1);
  w.feedback.execution = 'unknown';
  const before = noviceReview(plan, asOf),
    prescription = structuredClone(w.steps);
  assert.equal(before.completed, 2);
  assert.deepEqual(before.unconfirmedWorkoutIds, [w.id]);
  w.feedback.execution = 'as-planned';
  const after = noviceReview(plan, asOf);
  assert.equal(after.ready, true);
  assert.deepEqual(after.unconfirmedWorkoutIds, []);
  assert.notEqual(after.evidence, before.evidence);
  assert.deepEqual(w.steps, prescription);
  w.feedback.execution = 'partial';
  assert.equal(noviceReview(plan, asOf).ready, false);
  assert.deepEqual(noviceReview(plan, asOf).unconfirmedWorkoutIds, []);
  w.feedback.execution = 'as-planned';
  w.feedback.actualMinutes = 1;
  assert.notEqual(noviceReview(plan, asOf).evidence, after.evidence);
  assert.equal(noviceReview(plan, asOf).ready, false);
});

for (const execution of ['missing', 'unknown']) {
  test(`restoring ${execution} execution never invents interval confirmation`, () => {
    const plan = completedPlan(execution);
    const restored = prepareRestoredPlan(
      validateRecovery({
        format: 'stride-recovery-2',
        exportedAt: asOf + 'T18:00:00Z',
        profile: null,
        plan,
      }).plan,
    );
    assert.equal(noviceReview(restored, asOf).ready, false);
    assert.equal(noviceReview(restored, asOf).completed, 0);
    assert.equal(noviceReview(restored, asOf).unconfirmedWorkoutIds.length, 3);
    assert.deepEqual(
      logs(restored).map((w) => w.feedback.execution),
      logs(plan).map((w) => w.feedback.execution),
    );
  });
}

for (const canonicalExecution of ['unknown', 'as-planned']) {
  test(`duplicate provider copy cannot override canonical ${canonicalExecution} evidence`, () => {
    const plan = completedPlan(),
      w = logs(plan)[0];
    w.feedback.execution = canonicalExecution;
    w.feedback.activityId = 'one-activity';
    const copy = structuredClone(w);
    copy.id += ':copy';
    copy.feedback.execution =
      canonicalExecution === 'unknown' ? 'as-planned' : 'unknown';
    plan.workouts.push(copy);
    const review = noviceReview(plan, asOf);
    assert.equal(review.completed, canonicalExecution === 'unknown' ? 2 : 3);
    assert.deepEqual(
      review.unconfirmedWorkoutIds,
      canonicalExecution === 'unknown' ? [w.id] : [],
    );
    assert.equal(trainingRecords(plan).length, 3);
  });
}

test('another confirmed session on the same date does not need an unknown log corrected', () => {
  const plan = completedPlan(),
    w = logs(plan)[0];
  const copy = structuredClone(w);
  copy.id += ':separate-outing';
  copy.feedback.execution = 'unknown';
  plan.workouts.push(copy);
  assert.equal(noviceReview(plan, asOf).completed, 3);
  assert.deepEqual(noviceReview(plan, asOf).unconfirmedWorkoutIds, []);
});

for (const [name, change] of [
  [
    'today',
    (w) => {
      w.feedback.actualDate = asOf;
    },
  ],
  [
    'future',
    (w) => {
      w.feedback.actualDate = '2026-09-12';
    },
  ],
  [
    'stale',
    (w) => {
      w.feedback.actualDate = '2026-08-01';
    },
  ],
  [
    'prior stage',
    (w) => {
      for (const s of w.steps) if (s.movement === 'run') s.seconds = 30;
    },
  ],
  [
    'shortened outing',
    (w) => {
      w.feedback.actualMinutes = w.minutes * 0.8;
    },
  ],
  [
    'tired',
    (w) => {
      w.feedback.feeling = 'tired';
    },
  ],
  [
    'hard effort',
    (w) => {
      w.feedback.effort = 7;
    },
  ],
]) {
  test(`${name} cannot appear as an eligible missing-confirmation correction`, () => {
    const plan = completedPlan(),
      w = logs(plan).at(-1);
    w.feedback.execution = 'unknown';
    change(w);
    const review = noviceReview(plan, asOf);
    assert.equal(review.ready, false);
    assert.deepEqual(review.unconfirmedWorkoutIds, []);
    if (name === 'tired' || name === 'hard effort')
      assert.equal(review.heldForFatigue, true);
  });
}

test('unconfirmed extra running still holds progression through fatigue', () => {
  const plan = completedPlan();
  plan.extraRuns = [
    {
      id: 'extra-tired',
      date: asOf,
      minutes: 15,
      km: null,
      effort: 8,
      feeling: 'tired',
      note: '',
      recordedAt: asOf + 'T12:00:00Z',
    },
  ];
  const review = noviceReview(plan, asOf);
  assert.equal(review.completed, 3);
  assert.equal(review.ready, false);
  assert.equal(review.heldForFatigue, true);
});

test('run-walk detection uses the saved movement steps regardless of workout name', () => {
  const w = structuredClone(logs(completedPlan())[0]);
  w.title = 'My comfortable outing';
  assert.equal(isRunWalkWorkout(w), true);
  w.hard = true;
  assert.equal(isRunWalkWorkout(w), false);
  w.hard = false;
  w.kind = 'race';
  assert.equal(isRunWalkWorkout(w), false);
  w.kind = 'easy';
  w.steps = w.steps.filter((s) => s.movement !== 'walk');
  assert.equal(isRunWalkWorkout(w), false);
});

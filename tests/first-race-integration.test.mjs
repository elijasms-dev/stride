import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  adjustPlan,
  advanceReturn,
  advanceRunWalk,
  demoProfile,
  makePlan,
  moveWorkout,
  rebalanceFutureQuality,
  refreshWorkoutVariety,
  returnReview,
  revisePreferences,
  shortenWorkout,
  validatePlan,
  workoutAlternatives,
} from '../lib/engine.ts';
import { changeEvent, avoidRecordedOverlap } from '../lib/event-transition.ts';
import { assessFeasibility } from '../lib/plan/feasibility.ts';
import { qualityWorkMinutes } from '../lib/prescription.ts';
import { validateRecovery, prepareRestoredPlan } from '../lib/recovery.ts';
import { updateRunMeasure } from '../lib/run-distance.ts';
import { updateWorkoutTargets } from '../lib/workout-targets.ts';

const start = '2026-01-05';
const cases = {
  '5k': { weeklyKm: 8, longestKm: 3, currentRuns: 3, weeks: 8 },
  '10k': { weeklyKm: 15, longestKm: 5, currentRuns: 3, weeks: 10 },
  half: { weeklyKm: 20, longestKm: 7, currentRuns: 3, weeks: 14 },
  marathon: { weeklyKm: 28, longestKm: 10, currentRuns: 4, weeks: 20 },
};
function fixture(goal = 'half', patch = {}) {
  const { weeks, ...baseline } = cases[goal];
  const days = baseline.currentRuns === 4 ? [0, 2, 4, 6] : [0, 2, 6];
  const profile = {
    ...demoProfile(start),
    ...baseline,
    goal,
    raceName: `First ${goal}`,
    planLevel: 'beginner',
    experience: 'established',
    days,
    availableDays: days,
    runsPerWeek: days.length,
    longDay: 6,
    weekdayMinutes: 90,
    longMinutes: 300,
    easyPace: 7,
    qualityMode: 'automatic',
    qualitySessions: 0,
    recentQualitySessions: 0,
    recentQualityMinutes: 0,
    method: 'balanced',
    intent: 'finish',
    runMeasure: 'distance',
    raceDate: addDays(start, weeks * 7 - 1),
    ...patch,
  };
  return makePlan(profile, start, false);
}
function complete(workout, patch = {}) {
  workout.status = 'completed';
  workout.feedback = {
    actualDate: workout.date,
    actualMinutes: workout.minutes,
    actualKm: workout.estimatedKm,
    effort: 3,
    feeling: 'good',
    execution: 'as-planned',
    executionSource: 'self-report',
    completedQualityMinutes: 0,
    note: 'Synthetic first-race integration evidence',
    recordedAt: `${workout.date}T18:00:00Z`,
    ...patch,
  };
}
function completeBefore(plan, asOf) {
  plan.workouts
    .filter((w) => w.date < asOf && w.kind !== 'race' && w.status === 'planned')
    .forEach((w) => complete(w));
}
function assertFirstRace(plan, goal = plan.profile.goal) {
  assert.equal(plan.profile.planLevel, 'beginner');
  assert.deepEqual(plan.firstRace, { program: 'first-race-v1', goal });
  assert.equal(
    plan.beginner,
    undefined,
    'An existing runner is not a zero-base course',
  );
  assert.equal(plan.profile.qualitySessions, 0);
  for (const w of plan.workouts.filter(
    (w) => w.week >= 0 && w.kind !== 'race' && w.status === 'planned',
  )) {
    assert.ok(['easy', 'long'].includes(w.kind), `${w.date}: ${w.kind}`);
    assert.equal(w.hard, false, `${w.date} gained a hard-session flag`);
    assert.equal(
      qualityWorkMinutes(w),
      0,
      `${w.date} gained executable quality`,
    );
    assert.ok(
      w.steps.every((s) => s.intensity <= 3),
      `${w.date} exceeds easy effort`,
    );
  }
  assert.deepEqual(validatePlan(plan), []);
  assert.deepEqual(validatePlan(JSON.parse(JSON.stringify(plan))), []);
}
function recover(plan) {
  return prepareRestoredPlan(
    validateRecovery(
      JSON.parse(
        JSON.stringify({
          format: 'stride-recovery-2',
          exportedAt: '2026-09-01T12:00:00Z',
          profile: null,
          plan,
          standaloneRuns: [],
        }),
      ),
    ).plan,
  );
}
function restoredFacts(workout) {
  const copy = JSON.parse(JSON.stringify(workout));
  delete copy.id;
  if (copy.feedback) delete copy.feedback.source;
  return copy;
}

for (const goal of Object.keys(cases)) {
  test(`${goal} first-race: recipe preferences and measurement changes retain the easy programme`, () => {
    const plan = fixture(goal);
    const before = structuredClone(plan);
    const varied = refreshWorkoutVariety(plan, start);
    assert.deepEqual(varied.workouts, plan.workouts);
    for (const next of [
      varied,
      revisePreferences(plan, { workoutVariety: 'familiar' }, start),
      revisePreferences(plan, { workoutFormat: 'time' }, start),
      updateRunMeasure(plan, 'time', start),
      updateWorkoutTargets(
        plan,
        { mode: 'pace', pace: { easy: { low: 360, high: 420 } } },
        start,
      ),
    ]) {
      assertFirstRace(next, goal);
      assert.equal(next.profile.weeklyKm, cases[goal].weeklyKm);
      assert.equal(next.profile.longestKm, cases[goal].longestKm);
      const assessment = assessFeasibility(next, start);
      assert.equal(assessment.asOf, start);
      assert.ok(['forecast', 'review-required'].includes(assessment.status));
    }
    for (const workout of plan.workouts.filter((w) => w.kind !== 'race'))
      assert.deepEqual(workoutAlternatives(plan, workout.id), []);
    assert.deepEqual(
      plan,
      before,
      'Reviewing preferences must not mutate its input',
    );
  });

  test(`${goal} first-race: logged history and deliberate moved/shortened runs survive a rebuild and recovery`, () => {
    const asOf = addDays(start, 7);
    let plan = fixture(goal);
    completeBefore(plan, asOf);
    const recorded = structuredClone(
      plan.workouts.filter((w) => w.status === 'completed'),
    );
    const upcoming = plan.workouts.find(
      (w) => w.week === 1 && w.kind === 'easy',
    );
    assert.ok(upcoming);
    const movedDate = addDays(upcoming.date, 1);
    plan = moveWorkout(plan, upcoming.id, movedDate, asOf);
    plan = shortenWorkout(
      plan,
      upcoming.id,
      Math.max(5, Math.floor(upcoming.minutes * 0.7)),
      asOf,
    );
    const manual = structuredClone(
      plan.workouts.find((w) => w.id === upcoming.id),
    );
    const before = structuredClone(plan);
    const rebuilt = revisePreferences(plan, { weekdayMinutes: 120 }, asOf);
    assertFirstRace(rebuilt, goal);
    assert.deepEqual(
      rebuilt.workouts.filter((w) => w.status === 'completed'),
      recorded,
    );
    assert.deepEqual(
      rebuilt.workouts.find((w) => w.id === upcoming.id),
      manual,
    );
    assert.equal(
      rebuilt.workouts.find((w) => w.id === upcoming.id).date,
      movedDate,
    );
    const restored = recover(rebuilt);
    assertFirstRace(restored, goal);
    assert.deepEqual(
      restored.workouts.map(restoredFacts),
      rebuilt.workouts.map(restoredFacts),
    );
    assert.deepEqual(restored.firstRace, rebuilt.firstRace);
    assert.deepEqual(
      plan,
      before,
      'Rebuild must leave the original journal untouched',
    );
  });

  test(`${goal} first-race: extending the event retains the variant and recorded facts`, () => {
    const plan = fixture(goal);
    const asOf = addDays(start, 14);
    completeBefore(plan, asOf);
    const recorded = plan.workouts.filter((w) => w.status === 'completed');
    const next = changeEvent(
      plan,
      {
        goal,
        raceName: `Later first ${goal}`,
        raceDate: addDays(plan.profile.raceDate, 28),
        raceTerrain: 'road',
      },
      asOf,
    );
    assertFirstRace(next, goal);
    for (const saved of recorded) {
      const retained = next.workouts.find((w) => w.id === saved.id);
      assert.deepEqual(retained, { ...saved, week: -1 });
    }
    assert.equal(
      next.workouts.filter((w) => w.week >= 0 && w.kind === 'race').length,
      1,
    );
    assert.equal(
      next.workouts.find((w) => w.week >= 0 && w.kind === 'race').date,
      addDays(plan.profile.raceDate, 28),
    );
    assert.equal(next.feasibility.asOf, asOf);
    assert.deepEqual(next.feasibility, assessFeasibility(next, asOf));
  });
}

test('first-race: logging/skip reconciliation refreshes preparation without adding quality or rewriting history', () => {
  const plan = fixture('half');
  const asOf = addDays(start, 7);
  completeBefore(plan, asOf);
  const saved = structuredClone(
    plan.workouts.filter((w) => w.status === 'completed'),
  );
  for (const w of plan.workouts.filter(
    (w) => w.date >= asOf && w.kind !== 'race',
  )) {
    w.status = 'skipped';
    w.skipReason = 'Synthetic preparation-gap test';
  }
  rebalanceFutureQuality(plan, asOf);
  assertFirstRace(plan);
  assert.deepEqual(
    plan.workouts.filter((w) => w.status === 'completed'),
    saved,
  );
  assert.equal(plan.feasibility.asOf, asOf);
  assert.equal(plan.feasibility.status, 'review-required');
  assert.ok(plan.feasibility.reasons.length > 0);
  assert.deepEqual(plan.feasibility, assessFeasibility(plan, asOf));
});

test('first-race: a rest break and both evidence-based return reviews retain zero quality', () => {
  let plan = fixture('half', { raceDate: addDays(start, 20 * 7 - 1) });
  const breakAt = addDays(start, 14);
  completeBefore(plan, breakAt);
  const saved = structuredClone(
    plan.workouts.filter((w) => w.status === 'completed'),
  );
  plan = adjustPlan(plan, breakAt, addDays(breakAt, 6), 'rest', breakAt);
  assertFirstRace(plan);
  assert.equal(plan.returnState.stage, 1);
  assert.ok(
    plan.workouts
      .filter((w) => w.date >= breakAt && w.date <= addDays(breakAt, 6))
      .every((w) => w.status === 'skipped'),
  );
  const firstReview = addDays(breakAt, 14);
  completeBefore(plan, firstReview);
  assert.equal(returnReview(plan, firstReview).ready, true);
  plan = advanceReturn(plan, firstReview);
  assertFirstRace(plan);
  assert.equal(plan.returnState.stage, 2);
  const secondReview = addDays(firstReview, 7);
  completeBefore(plan, secondReview);
  assert.equal(returnReview(plan, secondReview).ready, true);
  plan = advanceReturn(plan, secondReview);
  assertFirstRace(plan);
  assert.equal(plan.returnState.stage, 3);
  for (const workout of saved)
    assert.deepEqual(
      plan.workouts.find((w) => w.id === workout.id),
      workout,
    );
  assertFirstRace(recover(plan));
});

test('first-race: activation overlap reconciliation updates feasibility and keeps recorded days clear', () => {
  const plan = fixture('10k');
  const date = plan.workouts.find((w) => w.date > start).date;
  const extra = {
    id: 'first-race-overlap',
    date,
    minutes: 20,
    km: 2.8,
    effort: 3,
    feeling: 'good',
    note: 'Synthetic run before activation',
    recordedAt: `${date}T08:00:00Z`,
  };
  const next = avoidRecordedOverlap(plan, null, [extra], date);
  assertFirstRace(next);
  assert.ok(next.workouts.every((w) => w.week < 0 || w.date !== date));
  assert.equal(next.feasibility.asOf, date);
  assert.deepEqual(next.feasibility, assessFeasibility(next, date));
});

test('first-race: corrupt programme metadata cannot bypass validation or recovery', () => {
  const plan = fixture('half');
  plan.firstRace = { program: 'first-race-v1', goal: 'marathon' };
  assert.ok(
    validatePlan(plan).length > 0,
    'A mismatched programme goal must fail',
  );
  assert.throws(() => recover(plan));
  const missing = fixture('half');
  delete missing.firstRace;
  assert.ok(
    validatePlan(missing).length > 0,
    'The beginner selector requires its programme metadata',
  );
});

test('first-race: maintained volume retains the familiar long run as well as the weekly baseline', () => {
  const plan = fixture('half', { volume: 'maintain' });
  assertFirstRace(plan);
  const longest = Math.max(
    ...plan.workouts.filter((w) => w.kind === 'long').map((w) => w.estimatedKm),
  );
  assert.ok(
    longest <= plan.profile.longestKm + 0.001,
    `Maintained ${plan.profile.weeklyKm} km/week grew the familiar ${plan.profile.longestKm} km long run to ${longest} km`,
  );
});

test('first-race: choosing a base block clears the race-only variant', () => {
  const plan = fixture('half');
  const next = changeEvent(
    plan,
    {
      goal: 'base',
      raceName: 'Build a foundation',
      raceDate: addDays(start, 83),
    },
    start,
  );
  assert.equal(next.profile.goal, 'base');
  assert.notEqual(next.profile.planLevel, 'beginner');
  assert.equal(next.firstRace, undefined);
  assert.ok(next.workouts.every((w) => w.kind !== 'race'));
  assert.deepEqual(validatePlan(next), []);
});

for (const signal of ['unlogged', 'skipped', 'tired', 'partial']) {
  test(`first-race: recent ${signal} training requires review despite an adequate remaining forecast`, () => {
    const plan = fixture('half');
    const asOf = addDays(start, 14);
    assert.equal(plan.feasibility.status, 'forecast');
    const comfortable = structuredClone(plan);
    completeBefore(comfortable, asOf);
    assert.equal(assessFeasibility(comfortable, asOf).status, 'forecast');
    for (const workout of plan.workouts.filter((w) => w.date < asOf)) {
      if (signal === 'skipped') {
        workout.status = 'skipped';
        workout.skipReason = 'Missed during the recent fortnight';
      } else if (signal === 'tired') {
        complete(workout, { effort: 7, feeling: 'tired' });
      } else if (signal === 'partial') {
        complete(workout, {
          actualKm: workout.estimatedKm * 0.4,
          actualMinutes: workout.minutes * 0.4,
          execution: 'partial',
        });
      }
    }
    const journal = structuredClone(plan.workouts);
    const upcoming = plan.workouts.filter((w) => w.date >= asOf);
    assert.deepEqual(
      upcoming,
      comfortable.workouts.filter((w) => w.date >= asOf),
      'The adverse signal changes recorded evidence, not the remaining forecast',
    );
    rebalanceFutureQuality(plan, asOf);
    assertFirstRace(plan);
    assert.equal(plan.feasibility.status, 'review-required');
    assert.equal(plan.feasibility.asOf, asOf);
    assert.ok(plan.feasibility.checks.length > 0);
    assert.deepEqual(plan.feasibility, assessFeasibility(plan, asOf));
    assert.deepEqual(
      plan.workouts,
      journal,
      'Assessing a recent gap must not rewrite history or add catch-up running',
    );
  });
}

test('first-race: slower distance targets retain prescribed kilometres and refresh duration without rewriting history', () => {
  const plan = fixture('half', { weekdayMinutes: 120 });
  const asOf = addDays(start, 7);
  completeBefore(plan, asOf);
  const recorded = structuredClone(
    plan.workouts.filter((w) => w.status === 'completed'),
  );
  assert.equal(assessFeasibility(plan, asOf).status, 'forecast');
  const next = updateWorkoutTargets(
    plan,
    { mode: 'pace', pace: { easy: { low: 480, high: 540 } } },
    asOf,
  );
  assertFirstRace(next);
  assert.equal(next.profile.weeklyKm, plan.profile.weeklyKm);
  assert.equal(next.profile.longestKm, plan.profile.longestKm);
  assert.deepEqual(
    next.workouts.filter((w) => w.status === 'completed'),
    recorded,
  );
  for (const workout of next.workouts.filter(
    (w) => w.status === 'planned' && w.kind !== 'race',
  )) {
    const original = plan.workouts.find((w) => w.id === workout.id);
    assert.ok(workout.minutes >= original.minutes);
    assert.equal(workout.estimatedKm, original.estimatedKm);
    assert.equal(
      workout.estimatedKm,
      workout.steps.reduce((total, step) => total + step.metres, 0) / 1000,
    );
    assert.equal(workout.distanceEstimate.lowerKm, workout.estimatedKm);
    assert.equal(workout.distanceEstimate.upperKm, workout.estimatedKm);
    for (const step of workout.steps)
      assert.ok(
        (step.metres * step.target.high) / 1000 <= step.seconds + 1,
        'The slower target must have enough planning duration for the fixed distance',
      );
  }
  assert.equal(next.feasibility.status, 'forecast');
  assert.deepEqual(next.feasibility, assessFeasibility(next, asOf));
});

test('first-race: a slower distance target that exceeds a selected day limit is rejected without deleting preparation', () => {
  const plan = fixture('half');
  const before = structuredClone(plan);
  assert.throws(
    () =>
      updateWorkoutTargets(
        plan,
        { mode: 'pace', pace: { easy: { low: 480, high: 540 } } },
        start,
      ),
    { name: 'PlanError', message: /distances cannot fit.*time limits/ },
  );
  assert.deepEqual(plan, before);
});

test('first-race: measurement roundtrips preserve exact allocations, logged facts and deliberate manual runs', () => {
  const asOf = addDays(start, 7);
  let plan = fixture('half', {
    workoutTargets: { mode: 'pace', pace: { easy: { low: 390, high: 450 } } },
  });
  completeBefore(plan, asOf);
  const upcoming = plan.workouts.find((w) => w.week === 1 && w.kind === 'easy');
  plan = moveWorkout(plan, upcoming.id, addDays(upcoming.date, 1), asOf);
  plan = shortenWorkout(plan, upcoming.id, 25, asOf);
  const manual = structuredClone(
    plan.workouts.find((w) => w.id === upcoming.id),
  );
  const recorded = structuredClone(
    plan.workouts.filter((w) => w.status === 'completed'),
  );
  const saved = new Map(plan.workouts.map((w) => [w.id, w]));
  for (const measure of ['time', 'distance', 'time', 'distance']) {
    plan = updateRunMeasure(plan, measure, asOf);
    assertFirstRace(plan);
    assert.equal(plan.profile.weeklyKm, cases.half.weeklyKm);
    assert.equal(plan.profile.longestKm, cases.half.longestKm);
    assert.deepEqual(
      plan.workouts.find((w) => w.id === manual.id),
      manual,
    );
    assert.deepEqual(
      plan.workouts.filter((w) => w.status === 'completed'),
      recorded,
    );
    for (const workout of plan.workouts.filter((w) => w.status === 'planned')) {
      const original = saved.get(workout.id);
      assert.equal(workout.estimatedKm, original.estimatedKm);
      assert.equal(workout.minutes, original.minutes);
      if (
        measure === 'distance' ||
        workout.id === manual.id ||
        workout.kind === 'race'
      )
        assert.equal(
          workout.steps.reduce((total, step) => total + step.metres, 0) / 1000,
          workout.estimatedKm,
        );
    }
    assert.deepEqual(plan.feasibility, assessFeasibility(plan, asOf));
  }
  const restored = recover(plan);
  assertFirstRace(restored);
  assert.deepEqual(
    restored.workouts.map(restoredFacts),
    plan.workouts.map(restoredFacts),
  );
});

test('beginner goal changes retain the reviewed zero-base foundation before a longer first-race aspiration', () => {
  const asOf = addDays(start, 7);
  let plan = makePlan(
    {
      ...demoProfile(start),
      planLevel: 'beginner',
      goal: '5k',
      experience: 'new',
      weeklyKm: 0,
      longestKm: 0,
      currentRuns: 0,
      days: [0, 2, 4],
      availableDays: [0, 2, 4],
      runsPerWeek: 3,
      longDay: 5,
      weekdayMinutes: 40,
      easyPace: null,
      qualityMode: 'automatic',
      raceDate: addDays(start, 62),
    },
    start,
  );
  for (const workout of plan.workouts.slice(0, 3))
    complete(workout, { actualKm: null });
  plan = advanceRunWalk(plan, asOf);
  assert.equal(plan.beginner.stage, 1);
  const savedStage = structuredClone(plan.beginner);
  const recorded = structuredClone(
    plan.workouts.filter((w) => w.status === 'completed'),
  );
  const next = changeEvent(
    plan,
    {
      goal: 'half',
      raceName: 'Future first half marathon',
      raceDate: addDays(start, 139),
    },
    asOf,
  );
  assert.equal(next.profile.goal, 'half');
  assert.deepEqual(next.beginner, savedStage);
  assert.equal(next.firstRace, undefined);
  assert.equal(next.profile.weeklyKm, 0);
  assert.equal(next.profile.longestKm, 0);
  assert.deepEqual(
    next.workouts.filter((w) => w.status === 'completed'),
    recorded,
  );
  assert.ok(
    next.workouts.every((w) => w.kind === 'easy' && w.estimatedKm === 0),
  );
  assert.ok(
    next.workouts.every((w) =>
      w.steps.every((step) => step.metres === undefined),
    ),
  );
  assert.equal(next.feasibility.status, 'review-required');
  assert.deepEqual(validatePlan(next), []);
  assert.deepEqual(recover(next).beginner, savedStage);
});

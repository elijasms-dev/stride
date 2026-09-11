import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makePlan,
  demoProfile,
  addDays,
  revisePreferences,
  validatePlan,
  TRAINING_POLICY,
} from '../lib/engine.ts';

const start = '2026-09-07';
const profile = (patch = {}) => ({
  ...demoProfile(start),
  goal: 'base',
  raceDate: addDays(start, 55),
  weeklyKm: 30,
  longestKm: 10,
  currentRuns: 3,
  availableDays: [0, 1, 2, 3, 4, 5, 6],
  runsPerWeek: 2,
  qualityMode: 'automatic',
  weekdayMinutes: 60,
  longMinutes: 100,
  easyPace: null,
  ...patch,
});
const runs = (plan, index) =>
  plan.workouts.filter(
    (w) => w.week === index && w.kind !== 'race' && w.status !== 'skipped',
  );
const minutes = (ws) =>
  ws.reduce(
    (n, w) => n + w.steps.reduce((total, step) => total + step.seconds, 0) / 60,
    0,
  );
function checkRecovery(plan) {
  for (const week of plan.weeks.filter((w) => w.phase === 'Recovery')) {
    const previous = runs(plan, week.index - 1);
    const current = runs(plan, week.index);
    assert.ok(
      minutes(current) <=
        minutes(previous) * TRAINING_POLICY.recoveryVolumeFactor + 0.01,
      `Week ${week.index + 1}: ${minutes(current)} recovery minutes after ${minutes(previous)} minutes`,
    );
    assert.ok(current.every((w) => w.minutes >= 5 && !w.hard));
    assert.ok(current.every((w) => Math.abs(minutes([w]) - w.minutes) < 0.01));
    assert.ok(Math.abs(week.trainingMinutes - minutes(current)) < 0.01);
  }
  assert.deepEqual(validatePlan(plan), []);
}

void test('time-capped two-day blocks genuinely reduce the executable recovery workload', () => {
  const input = profile(),
    before = structuredClone(input);
  const plan = makePlan(input, start);
  assert.equal(minutes(runs(plan, 2)), 120);
  checkRecovery(plan);
  assert.equal(runs(plan, 3).length, 2);
  assert.deepEqual(input, before);
});

for (const recoveryWeeks of [3, 4]) {
  for (const volume of ['maintain', 'gradual']) {
    void test(`distance-capped recovery remains lighter: ${recoveryWeeks}-week rhythm, ${volume}`, () => {
      const plan = makePlan(
        profile({
          weekdayMinutes: 120,
          easyPace: 6,
          easyLimitKm: 5,
          recoveryWeeks,
          volume,
        }),
        start,
      );
      checkRecovery(plan);
    });
  }
}

void test('uncapped maintained recovery is not reduced twice', () => {
  const plan = makePlan(
    profile({
      currentRuns: 2,
      weeklyKm: 20,
      longestKm: 8,
      weekdayMinutes: 120,
      easyPace: 6,
      volume: 'maintain',
    }),
    start,
  );
  const reference = minutes(runs(plan, 2));
  const recovery = minutes(runs(plan, 3));
  assert.ok(recovery <= reference * 0.82);
  assert.ok(recovery >= reference * 0.82 - 2);
});

void test('a partial opening week does not become the full recovery reference', () => {
  const plan = makePlan(
    profile({ startDate: addDays(start, 6), recoveryWeeks: 3 }),
    start,
  );
  assert.equal(runs(plan, 0).length, 1);
  assert.equal(minutes(runs(plan, 1)), 120);
  assert.ok(minutes(runs(plan, 2)) > 90);
  checkRecovery(plan);
});

void test('recovery reductions preserve walking for low-mileage returning runners', () => {
  const plan = makePlan(
    profile({
      experience: 'returning',
      weeklyKm: 9,
      longestKm: 3,
      currentRuns: 2,
      weekdayMinutes: 20,
      volume: 'maintain',
    }),
    start,
  );
  checkRecovery(plan);
  for (const week of plan.weeks.filter((w) => w.phase === 'Recovery')) {
    assert.ok(
      runs(plan, week.index).every((w) =>
        w.steps.some((s) => s.movement === 'walk'),
      ),
    );
  }
});

void test('a local ceiling review preserves completed running and does not compound recovery cuts', () => {
  const plan = makePlan(profile({ weekdayMinutes: 120 }), start);
  const asOf = addDays(start, 7);
  for (const w of plan.workouts.filter((w) => w.date < asOf)) {
    w.status = 'completed';
    w.feedback = {
      actualMinutes: w.minutes,
      actualKm: w.estimatedKm,
      effort: 3,
      feeling: 'good',
      note: '',
      recordedAt: w.date + 'T18:00:00Z',
    };
  }
  const before = structuredClone(plan);
  const revised = revisePreferences(plan, { weekdayMinutes: 60 }, asOf);
  checkRecovery(revised);
  assert.deepEqual(
    revised.workouts.filter((w) => w.date < asOf),
    before.workouts.filter((w) => w.date < asOf),
  );
  const again = revisePreferences(revised, { terrain: 'hills' }, asOf);
  assert.deepEqual(
    again.workouts.map((w) => w.minutes),
    revised.workouts.map((w) => w.minutes),
  );
  assert.deepEqual(plan, before);
});

for (const count of [2, 3, 4, 5, 6, 7]) {
  void test(`capped base plans preserve ${count} running days during recovery`, () => {
    const plan = makePlan(
      profile({
        runsPerWeek: count,
        currentRuns: count,
        weeklyKm: 60,
        longestKm: 15,
        weekdayMinutes: 35,
        longMinutes: 60,
      }),
      start,
    );
    checkRecovery(plan);
    assert.equal(new Set(runs(plan, 3).map((w) => w.date)).size, count);
  });
}

for (const method of ['balanced', 'easy-doubles', 'double-threshold']) {
  void test(`recovery remains lighter with established ${method} training`, () => {
    const plan = makePlan(
      profile({
        goal: '10k',
        raceDate: addDays(start, 139),
        weeklyKm: 80,
        longestKm: 16,
        currentRuns: 6,
        runsPerWeek: 6,
        weekdayMinutes: 120,
        easyPace: 6,
        qualitySessions: 2,
        recentQualitySessions: 2,
        recentQualityMinutes: 40,
        method,
        stableWeeks: 12,
        easyDoubleWeeks: 4,
        recentSessionsPerWeek: 7,
        doubleDays: [1],
        doubleGapHours: 8,
        thresholdControl: 'heart-rate',
        thresholdCeiling: 150,
        volume: 'maintain',
      }),
      start,
    );
    checkRecovery(plan);
    if (method !== 'balanced') {
      assert.ok(plan.workouts.some((w) => w.pairId));
      assert.ok(
        plan.weeks
          .filter((w) => w.phase === 'Recovery')
          .every((week) => runs(plan, week.index).every((w) => !w.pairId)),
      );
    }
  });
}

void test('full replanning before recovery uses retained history without rewriting it', () => {
  const plan = makePlan(profile(), start);
  const asOf = addDays(start, 21);
  for (const w of plan.workouts.filter((w) => w.date < asOf)) {
    w.status = 'completed';
    w.feedback = {
      actualDate: w.date,
      actualMinutes: w.minutes,
      actualKm: w.estimatedKm,
      effort: 3,
      feeling: 'good',
      execution: 'as-planned',
      note: '',
      recordedAt: w.date + 'T18:00:00Z',
    };
  }
  const before = structuredClone(plan);
  const revised = revisePreferences(plan, { difficulty: 'gentle' }, asOf);
  assert.ok(
    minutes(runs(revised, 3)) <= minutes(runs(revised, 2)) * 0.82 + 0.01,
  );
  assert.deepEqual(
    revised.workouts.filter((w) => w.date < asOf),
    before.workouts.filter((w) => w.date < asOf),
  );
  assert.deepEqual(plan, before);
  assert.deepEqual(validatePlan(revised), []);
});

void test('a conflicting deliberate recovery edit is rejected without mutation', () => {
  const plan = makePlan(profile({ weekdayMinutes: 120 }), start);
  const edited = runs(plan, 3)[0];
  edited.changed = true;
  edited.changeSource = 'manual';
  const before = structuredClone(plan);
  assert.throws(
    () => revisePreferences(plan, { weekdayMinutes: 45 }, start),
    /deliberate edit/i,
  );
  assert.deepEqual(plan, before);
});

void test('a valid manual recovery session stays pinned while the other session shrinks', () => {
  const plan = makePlan(profile(), start);
  const asOf = addDays(start, 21);
  const edited = runs(plan, 3)[0];
  edited.changed = true;
  edited.changeSource = 'manual';
  const before = structuredClone(plan);
  const revised = revisePreferences(plan, { difficulty: 'gentle' }, asOf);
  assert.deepEqual(
    revised.workouts.find((w) => w.id === edited.id),
    edited,
  );
  assert.ok(
    minutes(runs(revised, 3)) <= minutes(runs(revised, 2)) * 0.82 + 0.01,
  );
  assert.deepEqual(validatePlan(revised), []);
  assert.deepEqual(plan, before);
});

void test('all-manual future recovery above its budget is rejected, not silently accepted', () => {
  const plan = makePlan(profile({ weekdayMinutes: 120 }), start);
  const asOf = addDays(start, 21);
  for (const w of runs(plan, 3)) {
    w.changed = true;
    w.changeSource = 'manual';
  }
  // Model a previously reviewed lower surrounding workload with retained manual runs.
  for (const w of runs(plan, 2)) {
    w.minutes = 30;
    w.steps = [
      {
        kind: 'work',
        label: 'Easy run',
        effort: 'Easy',
        intensity: 3,
        seconds: 1800,
      },
    ];
    w.estimatedKm = 30 / 7;
  }
  const before = structuredClone(plan);
  assert.throws(
    () => revisePreferences(plan, { terrain: 'hills' }, asOf),
    /recovery.*deliberate edits/i,
  );
  assert.deepEqual(plan, before);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  demoProfile,
  makePlan,
  refreshWorkoutVariety,
  revisePreferences,
  taperFactor,
  validatePlan,
} from '../lib/engine.ts';
import { prescribedDistanceKm, updateRunMeasure } from '../lib/run-distance.ts';

const start = '2026-09-21';
const profile = (patch = {}) => ({
  ...demoProfile(start),
  name: 'Synthetic declared-baseline runner',
  goal: 'half',
  raceDate: addDays(start, 111),
  weeklyKm: 45,
  longestKm: 16,
  currentRuns: 4,
  days: [0, 2, 4, 6],
  longDay: 6,
  weekdayMinutes: 90,
  longMinutes: 180,
  experience: 'established',
  difficulty: 'balanced',
  intent: 'improve',
  volume: 'gradual',
  easyPace: 6,
  qualityMode: 'custom',
  qualitySessions: 1,
  recentQualitySessions: 1,
  recentQualityMinutes: 20,
  runMeasure: 'distance',
  ...patch,
});
const make = (patch = {}) => makePlan(profile(patch), start, false);
const runs = (plan, index) =>
  plan.workouts.filter(
    (w) => w.week === index && w.kind !== 'race' && w.status !== 'skipped',
  );
const long = (plan, index) => runs(plan, index).find((w) => w.kind === 'long');
const longSnapshot = (plan) =>
  plan.workouts
    .filter((w) => w.kind === 'long')
    .map(({ id, date, estimatedKm }) => ({ id, date, estimatedKm }));
const ordinary = (plan, week) =>
  week.start >= plan.profile.startDate &&
  !['Recovery', 'Taper', 'Race week'].includes(week.phase) &&
  taperFactor(plan.profile, addDays(week.start, 6)) === 1;
function assertCleanProgression(plan) {
  let previous;
  for (const week of plan.weeks) {
    const session = long(plan, week.index);
    if (!session) continue;
    if (week.index !== 0)
      assert.ok(
        Number.isInteger(session.estimatedKm),
        `${plan.profile.goal}: week ${week.index + 1} has a fractional generated long run`,
      );
    if (!ordinary(plan, week)) continue;
    if (previous !== undefined)
      assert.ok(
        session.estimatedKm >= previous,
        `${plan.profile.goal}: unmarked long-run decline ${previous} -> ${session.estimatedKm} in week ${week.index + 1}`,
      );
    previous = session.estimatedKm;
  }
  assert.deepEqual(validatePlan(plan), []);
}

for (const [goal, weeklyKm, longestKm, span, schedule] of [
  ['5k', 30, 8, 83, {}],
  ['10k', 40, 12, 83, {}],
  ['half', 45, 16, 111, {}],
  [
    'ultra',
    70,
    26,
    139,
    {
      raceDistanceKm: 50,
      currentRuns: 5,
      days: [0, 1, 2, 4, 6],
      weekdayMinutes: 120,
      longMinutes: 300,
    },
  ],
]) {
  void test(`${JSON.stringify(goal)}: the ordinary opening week uses the entered weekly and long-run distances`, () => {
    const input = profile({
      goal,
      weeklyKm,
      longestKm,
      raceDate: addDays(start, span),
      ...schedule,
    });
    const original = structuredClone(input);
    const plan = makePlan(input, start, false);
    assert.deepEqual(
      input,
      original,
      'generation must not rewrite the answers',
    );
    assert.equal(plan.profile.weeklyKm, weeklyKm);
    assert.equal(plan.profile.longestKm, longestKm);
    assert.equal(plan.weeks[0].targetKm, weeklyKm);
    assert.equal(long(plan, 0)?.estimatedKm, longestKm);
    assert.equal(prescribedDistanceKm(long(plan, 0)), longestKm);
    assert.ok(plan.weeks[0].trainingMinutes <= weeklyKm * input.easyPace);
    assertCleanProgression(plan);
    assert.deepEqual(validatePlan(JSON.parse(JSON.stringify(plan))), []);
  });
}

void test('a familiar 20 km long run does not inflate a declared 30 km half-marathon baseline', () => {
  const plan = make({ weeklyKm: 30, longestKm: 20 });
  assert.equal(plan.weeks[0].targetKm, 30);
  assert.equal(plan.weeks[0].trainingMinutes, 180);
  assert.equal(long(plan, 0)?.estimatedKm, 20);
  assert.equal(prescribedDistanceKm(long(plan, 0)), 20);
  assertCleanProgression(plan);
});

void test('feasible weekly, session and day ceilings retain the familiar opening long run', () => {
  const plan = make({
    weeklyKm: 30,
    longestKm: 20,
    weeklyMinutesLimit: 180,
    longMinutes: 120,
    dayPreferences: [{ day: 6, maxMinutes: 120 }],
  });
  assert.equal(plan.weeks[0].targetKm, 30);
  assert.equal(long(plan, 0)?.estimatedKm, 20);
  for (const week of plan.weeks) {
    assert.ok(week.trainingMinutes <= 180);
    for (const w of runs(plan, week.index))
      assert.ok(w.minutes <= (w.kind === 'long' ? 120 : 90));
  }
  assert.deepEqual(validatePlan(plan), []);
});

void test('a fractional user-entered long baseline is preserved before clean generated progression', () => {
  const plan = make({ longestKm: 16.5 });
  assert.equal(plan.profile.longestKm, 16.5);
  assert.equal(long(plan, 0)?.estimatedKm, 16.5);
  assert.equal(prescribedDistanceKm(long(plan, 0)), 16.5);
  assert.equal(plan.weeks[0].targetKm, 45);
  assertCleanProgression(plan);
});

void test('variety and an unchanged preference review retain the accepted opening allocation', () => {
  const plan = make({ weeklyKm: 30, longestKm: 20 });
  const original = structuredClone(plan);
  const varied = refreshWorkoutVariety(plan, start);
  const unchanged = revisePreferences(plan, {}, start);
  for (const next of [varied, unchanged]) {
    assert.equal(next.weeks[0].targetKm, 30);
    assert.deepEqual(longSnapshot(next), longSnapshot(plan));
    assert.deepEqual(validatePlan(next), []);
  }
  assert.deepEqual(plan, original);
});

void test('a non-binding limit review does not silently shrink the accepted long-run baseline', () => {
  const plan = make({ weeklyKm: 30, longestKm: 20 });
  const next = revisePreferences(plan, { weeklyMinutesLimit: 900 }, start);
  assert.equal(next.weeks[0].targetKm, 30);
  assert.equal(long(next, 0)?.estimatedKm, 20);
  assert.deepEqual(longSnapshot(next), longSnapshot(plan));
  assert.deepEqual(validatePlan(next), []);
});

void test('distance/time presentation changes preserve accepted clean long-run allocations', () => {
  const plan = make({ longestKm: 16.5 });
  const timed = updateRunMeasure(plan, 'time', start);
  const back = updateRunMeasure(timed, 'distance', start);
  assert.deepEqual(longSnapshot(timed), longSnapshot(plan));
  assert.deepEqual(longSnapshot(back), longSnapshot(plan));
  assert.equal(prescribedDistanceKm(long(back, 0)), 16.5);
  assert.deepEqual(validatePlan(timed), []);
  assert.deepEqual(validatePlan(back), []);
});

void test('a partial opening week does not manufacture the missing days of a full baseline', () => {
  const plan = make({ startDate: addDays(start, 3) });
  const opening = runs(plan, 0);
  assert.ok(opening.length > 0 && opening.length < plan.profile.days.length);
  assert.ok(plan.weeks[0].trainingMinutes < 45 * 6);
  assert.ok(plan.weeks[0].targetKm < 45);
  assert.ok(opening.every((w) => w.date >= plan.profile.startDate));
  assert.ok(long(plan, 0).estimatedKm <= 16);
  assert.deepEqual(validatePlan(plan), []);
});

void test('a start already inside taper does not force the full declared weekly or long-run load', () => {
  const plan = make({ raceDate: addDays(start, 13) });
  assert.ok(plan.weeks[0].targetKm < 45);
  assert.ok(plan.weeks[0].trainingMinutes < 45 * 6);
  assert.ok(!long(plan, 0) || long(plan, 0).estimatedKm < 16);
  assert.ok(plan.workouts.every((w) => w.date <= plan.profile.raceDate));
  assert.deepEqual(validatePlan(plan), []);
});

void test('an ordinary full opening rejects limits that cannot contain the declared baseline', () => {
  for (const patch of [
    { weeklyKm: 30, longestKm: 20, longMinutes: 90 },
    { weeklyKm: 45, longestKm: 16, weeklyMinutesLimit: 240 },
    { weeklyKm: 45, longestKm: 16, longLimitKm: 15 },
  ])
    assert.throws(
      () => make(patch),
      (error) =>
        error.name === 'PlanError' &&
        /baseline|starting|long|limit|minute|distance|ceiling/i.test(
          error.message,
        ),
      'Conflicting answers need a controlled review instead of a silently rewritten baseline',
    );
});

void test('a fresh returning runner keeps positive declared inputs until an explicit recovery adjustment', () => {
  const plan = make({ experience: 'returning' });
  assert.equal(plan.weeks[0].targetKm, 45);
  assert.equal(long(plan, 0)?.estimatedKm, 16);
  assert.deepEqual(validatePlan(plan), []);
});

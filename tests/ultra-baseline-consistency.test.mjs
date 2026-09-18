import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, demoProfile, makePlan, validatePlan } from '../lib/engine.ts';
import { schedulingEasyPace } from '../lib/fitness-pacing.ts';

const start = '2026-09-21';
const profile = (patch = {}) => ({
  ...demoProfile(start),
  goal: 'ultra',
  raceDistanceKm: 100,
  raceDate: addDays(start, 223),
  weeklyKm: 90,
  longestKm: 30,
  currentRuns: 6,
  days: [0, 1, 2, 3, 4, 6],
  longDay: 6,
  weekdayMinutes: 120,
  longMinutes: 240,
  easyPace: 6,
  volume: 'gradual',
  qualityMode: 'automatic',
  recentQualitySessions: 2,
  recentQualityMinutes: 40,
  method: 'balanced',
  experience: 'established',
  stableWeeks: 16,
  ultraWeeklyMinutes: 540,
  ultraLongestMinutes: 180,
  ...patch,
});
for (const distance of [80.4673, 100, 120, 160.9344])
  for (const measure of ['time', 'distance']) {
    void test(`${distance} km ${measure}: conflicting recent minutes cannot silently inflate the opening baseline`, () => {
      const p = profile({
        raceDistanceKm: distance,
        runMeasure: measure,
        ultraWeeklyMinutes: 500,
      });
      const before = structuredClone(p);
      assert.throws(
        () => makePlan(p, start, false),
        (error) =>
          error.name === 'PlanError' &&
          /long-ultra distance baseline.*recent weekly or longest-run minutes/.test(
            error.message,
          ),
      );
      assert.deepEqual(p, before);
    });
  }
void test('long-ultra long-run minutes are independent evidence, even when weekly minutes fit', () => {
  assert.throws(
    () => makePlan(profile({ ultraLongestMinutes: 175 }), start, false),
    /long-ultra distance baseline/,
  );
});
void test('consistent long-ultra evidence preserves both kilometre baselines and time', () => {
  const p = profile();
  const plan = makePlan(p, start, false);
  assert.equal(plan.weeks[0].targetKm, 90);
  assert.equal(plan.weeks[0].longKm, 30);
  assert.ok(plan.weeks[0].trainingMinutes <= 540 + 1 / 60);
  assert.deepEqual(validatePlan(JSON.parse(JSON.stringify(plan))), []);
  const conflicting = structuredClone(plan);
  conflicting.profile.ultraWeeklyMinutes = 500;
  assert.ok(
    validatePlan(conflicting).some((error) =>
      /long-ultra distance baseline/.test(error),
    ),
  );
});
void test('manual easy targets fund the same kilometre baseline consistently in time and distance modes', () => {
  const p = {
    ...demoProfile(start),
    goal: 'half',
    raceDate: addDays(start, 111),
    weeklyKm: 45,
    longestKm: 16,
    weekdayMinutes: 120,
    longMinutes: 180,
    qualityMode: 'custom',
    qualitySessions: 1,
    recentQualitySessions: 1,
    recentQualityMinutes: 20,
    workoutTargets: { mode: 'pace', pace: { easy: { low: 350, high: 390 } } },
  };
  assert.equal(schedulingEasyPace(p), 6.5);
  for (const runMeasure of ['time', 'distance']) {
    const plan = makePlan({ ...p, runMeasure }, start, false);
    assert.equal(plan.weeks[0].targetKm, 45);
    assert.equal(plan.weeks[0].longKm, 16);
    assert.ok(Math.abs(plan.weeks[0].trainingMinutes - 292.5) < 1 / 60);
    assert.deepEqual(validatePlan(plan), []);
  }
});

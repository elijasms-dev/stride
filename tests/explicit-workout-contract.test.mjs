import { roadOpeningFailures } from './road-overhaul-helpers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makePlan,
  demoProfile,
  addDays,
  validatePlan,
  refreshWorkoutVariety,
  revisePreferences,
} from '../lib/engine.ts';
import { qualityWorkMinutes } from '../lib/prescription.ts';
import {
  explicitQualityFrequencyErrors,
  roadQualityFrequencyErrors,
} from '../lib/plan/generation-rhythm.ts';
const start = '2026-09-14';
const profile = (patch = {}) => ({
  ...demoProfile(start),
  goal: 'custom',
  raceDistanceKm: 15,
  startDate: start,
  raceDate: addDays(start, 111),
  weeklyKm: 55,
  longestKm: 16,
  currentRuns: 5,
  runsPerWeek: 5,
  days: [0, 1, 2, 4, 6],
  availableDays: [0, 1, 2, 3, 4, 5, 6],
  longDay: 6,
  weekdayMinutes: 120,
  longMinutes: 300,
  easyPace: 6,
  qualityMode: 'custom',
  qualitySessions: 2,
  recentQualitySessions: 2,
  recentQualityMinutes: 40,
  recentRace: { distanceKm: 10, timeMinutes: 50 },
  ...patch,
});
function ordinary(p) {
  return p.weeks.filter(
    (w) => !['Recovery', 'Taper', 'Race week'].includes(w.phase),
  );
}
function weekdayQuality(p, week) {
  return p.workouts.filter(
    (w) =>
      w.week === week.index &&
      w.kind !== 'long' &&
      w.kind !== 'race' &&
      w.hard &&
      qualityWorkMinutes(w) > 0,
  );
}
for (const runMeasure of ['distance', 'time'])
  for (const difficulty of ['balanced', 'gentle'])
    for (const workoutVariety of ['familiar', 'varied'])
      test(`${runMeasure}/${difficulty}/${workoutVariety}: two real workouts persist through ordinary maintenance weeks`, () => {
        const input = profile({ runMeasure, difficulty, workoutVariety });
        const before = JSON.stringify(input);
        const p = makePlan(input, start, false);
        assert.ok(p.weeks.some((w) => w.phase === 'Maintenance'));
        for (const w of ordinary(p))
          assert.equal(weekdayQuality(p, w).length, 2, `Week ${w.index + 1}`);
        const first = p.workouts.filter(
          (w) => w.week === 0 && w.kind !== 'race',
        );
        assert.ok(
          Math.abs(first.reduce((n, w) => n + w.estimatedKm, 0) - 55) < 0.00101,
        );
        assert.equal(first.find((w) => w.kind === 'long').estimatedKm, 16);
        for (const w of p.workouts.filter((w) => w.kind !== 'race'))
          assert.ok(
            w.minutes <=
              (w.kind === 'long' ? input.longMinutes : input.weekdayMinutes) +
                0.001,
          );
        assert.deepEqual(validatePlan(p), []);
        assert.equal(JSON.stringify(input), before);
        const refreshed = refreshWorkoutVariety(p, start);
        const revised = revisePreferences(
          refreshed,
          { carbsPerHour: 45 },
          start,
        );
        for (const w of ordinary(revised))
          assert.equal(weekdayQuality(revised, w).length, 2);
        assert.equal(revised.profile.qualitySessions, 2);
      });

test('zero and one remain distinct explicit choices rather than receiving extra workouts', () => {
  for (const qualitySessions of [0, 1]) {
    const p = makePlan(profile({ qualitySessions }), start, false);
    for (const w of ordinary(p))
      assert.equal(weekdayQuality(p, w).length, qualitySessions);
  }
});

test('validator catches a missing selected workout without blocking deliberate changes or recovery', () => {
  const p = makePlan(profile(), start, false);
  const maintenance = p.weeks.find((w) => w.phase === 'Maintenance');
  const w = weekdayQuality(p, maintenance)[1];
  w.hard = false;
  w.kind = 'easy';
  w.stimulus = 'aerobic';
  w.templateId = undefined;
  w.steps = w.steps.map((s) => ({ ...s, kind: 'aerobic', intensity: 2 }));
  assert.ok(validatePlan(p).some((e) => /selected 2 weekday workouts/.test(e)));
  w.changed = true;
  w.changeSource = 'manual';
  assert.deepEqual(explicitQualityFrequencyErrors(p), []);
  w.changed = false;
  maintenance.phase = 'Recovery';
  assert.deepEqual(explicitQualityFrequencyErrors(p), []);
});

test('time or availability constraints cannot silently lower an explicit two-workout choice', () => {
  for (const patch of [
    { qualityLimitKm: 1 },
    { availableDays: [0, 1, 2, 3, 4], longDay: 1 },
  ])
    assert.throws(
      () => makePlan(profile(patch), start, false),
      (error) =>
        error.name === 'PlanError' &&
        /selected 2 weekday workouts|30-minute quality workout/.test(
          error.message,
        ),
    );
});

test('returning foundation keeps declared mileage and saved choice; later build still enforces that choice', () => {
  const input = profile({
    goal: 'half',
    raceDistanceKm: undefined,
    experience: 'returning',
    weeklyKm: 45,
    longestKm: 16,
    currentRuns: 4,
    runsPerWeek: 4,
    days: [0, 2, 4, 6],
    availableDays: [0, 2, 4, 6],
    qualitySessions: 1,
    recentQualitySessions: 1,
    recentQualityMinutes: 20,
  });
  const p = makePlan(input, start, false);
  const opening = p.workouts.filter((w) => w.week === 0);
  assert.deepEqual(roadOpeningFailures(p, input), []);
  assert.equal(opening.find((w) => w.kind === 'long').estimatedKm, 16);
  const openingQuality = weekdayQuality(p, p.weeks[0]);
  assert.equal(openingQuality.length, 1);
  assert.ok(openingQuality[0].qualityMinutes >= 6);
  assert.ok(openingQuality[0].qualityMinutes <= 10);
  assert.ok(
    openingQuality[0].steps
      .filter((s) => s.kind === 'work')
      .every((s) => s.intensity <= 5),
  );
  assert.equal(p.profile.qualityMode, 'custom');
  assert.equal(p.profile.qualitySessions, 1);
  assert.deepEqual(validatePlan(p), []);
  const later = ordinary(p).find((w) => w.phase !== 'Foundation');
  assert.ok(
    later,
    'the return foundation is followed by an ordinary workout phase',
  );
  assert.equal(weekdayQuality(p, later).length, 1);
  const w = weekdayQuality(p, later)[0];
  w.hard = false;
  w.kind = 'easy';
  w.stimulus = 'aerobic';
  w.templateId = undefined;
  w.steps = w.steps.map((s) => ({ ...s, kind: 'aerobic', intensity: 2 }));
  assert.ok(
    roadQualityFrequencyErrors(p).some((e) =>
      e.includes(`Week ${later.index + 1}`),
    ),
  );
});

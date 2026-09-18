import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  demoProfile,
  makePlan,
  taperFactor,
  validatePlan,
} from '../lib/engine.ts';
import { applyActualTrainingEnvelope } from '../lib/plan/allocate.ts';

const start = '2026-09-21';
const smallBase = (patch = {}) => ({
  ...demoProfile(start),
  goal: 'base',
  startDate: start,
  raceDate: addDays(start, 55),
  weeklyKm: 5,
  longestKm: 1,
  easyPace: 6,
  currentRuns: 3,
  runsPerWeek: 3,
  days: [1, 3, 5],
  availableDays: [1, 3, 5],
  longDay: 5,
  weekdayMinutes: 60,
  longMinutes: 60,
  qualitySessions: 0,
  experience: 'established',
  volume: 'maintain',
  runMeasure: 'time',
  ...patch,
});

void test('a maintained one-kilometre base run never becomes a zero-distance recovery run', () => {
  for (const easyPace of [6, 10]) {
    const profile = smallBase({ easyPace });
    const before = structuredClone(profile);
    const plan = makePlan(profile, start, false);
    assert.deepEqual(profile, before);
    const longs = plan.workouts.filter((w) => w.kind === 'long');
    assert.ok(longs.some((w) => plan.weeks[w.week].phase === 'Recovery'));
    assert.ok(longs.every((w) => w.estimatedKm > 0 && w.minutes >= 5));
    assert.ok(longs.every((w) => w.estimatedKm <= 1));
    assert.deepEqual(validatePlan(JSON.parse(JSON.stringify(plan))), []);
  }
});

void test('maintain volume retains a funded sub-kilometre starting long run', () => {
  for (const [longestKm, easyPace] of [
    [0.5, 10],
    [0.9, 6],
  ]) {
    const plan = makePlan(smallBase({ longestKm, easyPace }), start, false);
    for (const week of plan.weeks) {
      const long = plan.workouts.find(
        (w) => w.week === week.index && w.kind === 'long',
      );
      assert.ok(long);
      assert.ok(long.estimatedKm > 0 && long.estimatedKm <= longestKm);
      if (week.phase !== 'Recovery') assert.equal(long.estimatedKm, longestKm);
    }
    assert.deepEqual(validatePlan(plan), []);
  }
});

void test('maintain volume keeps a familiar fractional long run without rounding it down', () => {
  const plan = makePlan(
    smallBase({
      weeklyKm: 40,
      longestKm: 16.5,
      weekdayMinutes: 90,
      longMinutes: 150,
    }),
    start,
    false,
  );
  for (const week of plan.weeks.filter((w) => w.phase !== 'Recovery'))
    assert.equal(
      plan.workouts.find((w) => w.week === week.index && w.kind === 'long')
        .estimatedKm,
      16.5,
    );
  assert.deepEqual(validatePlan(plan), []);
});

const sevenDayHalf = (patch = {}) =>
  smallBase({
    goal: 'half',
    raceDate: addDays(start, 139),
    weeklyKm: 45,
    longestKm: 20,
    currentRuns: 7,
    runsPerWeek: 7,
    days: [0, 1, 2, 3, 4, 5, 6],
    availableDays: [0, 1, 2, 3, 4, 5, 6],
    longDay: 6,
    weekdayMinutes: 120,
    longMinutes: 180,
    easyPace: 6.25,
    qualitySessions: undefined,
    qualityMode: 'automatic',
    recentQualitySessions: 2,
    recentQualityMinutes: 40,
    method: 'balanced',
    intent: 'improve',
    terrain: 'flat',
    ...patch,
  });

void test('rounded supporting runs cannot cut a funded familiar long run in an ordinary seven-day half week', () => {
  for (const easyPace of [6.25, 7.7])
    for (const runMeasure of ['time', 'distance'])
      for (const volume of ['maintain', 'gradual'])
        for (const longMinutes of [180, 300]) {
          const plan = makePlan(
            sevenDayHalf({ easyPace, runMeasure, volume, longMinutes }),
            start,
            false,
          );
          let precedingLong = 20;
          for (const week of plan.weeks) {
            if (
              ['Recovery', 'Taper', 'Race week'].includes(week.phase) ||
              taperFactor(plan.profile, addDays(week.start, 6)) < 1
            )
              continue;
            const runs = plan.workouts.filter(
              (w) => w.week === week.index && w.kind !== 'race',
            );
            const long = runs.find((w) => w.kind === 'long');
            assert.ok(long.estimatedKm >= precedingLong - 1e-6);
            precedingLong = long.estimatedKm;
            if (volume === 'maintain') {
              assert.ok(
                Math.abs(runs.reduce((n, w) => n + w.estimatedKm, 0) - 45) <=
                  0.00101,
              );
              assert.ok(
                runs.reduce((n, w) => n + w.minutes, 0) <=
                  45 * easyPace + 1 / 60,
              );
            }
          }
          assert.deepEqual(validatePlan(JSON.parse(JSON.stringify(plan))), []);
        }
});

void test('protecting familiar long-run share still obeys a revised hard weekly time ceiling', () => {
  const plan = makePlan(sevenDayHalf(), start, false);
  plan.profile.weeklyMinutesLimit = 240;
  const originalMinutes = new Map(plan.workouts.map((w) => [w.id, w.minutes]));
  applyActualTrainingEnvelope(plan, start);
  for (const week of plan.weeks) {
    const runs = plan.workouts.filter(
      (w) => w.week === week.index && w.kind !== 'race',
    );
    assert.ok(runs.reduce((n, w) => n + w.minutes, 0) <= 240 + 1e-6);
    assert.ok(runs.every((w) => w.minutes <= originalMinutes.get(w.id) + 1e-6));
  }
  assert.ok(plan.workouts.find((w) => w.kind === 'long').estimatedKm < 20);
});

void test('marathon staging allows the next whole kilometre above a fractional familiar baseline', () => {
  for (const days of [5, 7])
    for (const easyPace of [5, 6.25])
      for (const runMeasure of ['time', 'distance']) {
        const plan = makePlan(
          sevenDayHalf({
            goal: 'marathon',
            weeklyKm: 100,
            longestKm: 30.5,
            currentRuns: days,
            runsPerWeek: days,
            days: [0, 1, 2, 3, 4, 5, 6].slice(0, days),
            longDay: days - 1,
            longMinutes: 300,
            easyPace,
            runMeasure,
            volume: 'gradual',
          }),
          start,
          false,
        );
        const ordinaryLongs = plan.workouts.filter(
          (w) =>
            w.kind === 'long' &&
            !['Recovery', 'Taper', 'Race week'].includes(
              plan.weeks[w.week].phase,
            ) &&
            taperFactor(plan.profile, addDays(plan.weeks[w.week].start, 6)) >=
              1,
        );
        assert.equal(ordinaryLongs[0].estimatedKm, 30.5);
        assert.ok(ordinaryLongs[1].estimatedKm >= 31);
        assert.ok(
          ordinaryLongs
            .slice(1)
            .every(
              (w) => Number.isInteger(w.estimatedKm) && w.estimatedKm <= 35,
            ),
        );
        assert.deepEqual(validatePlan(plan), []);
      }
});

void test('reviewed fractional long-run evidence remains a maintained anchor at the supplied easy pace', () => {
  for (const preserveProgression of [true, false])
    for (const runMeasure of ['time', 'distance'])
      for (const manualPace of [false, true]) {
        const pace = manualPace ? 6.5 : 6;
        const baseline = {
          from: start,
          asOf: addDays(start, 28),
          coverage: 100,
          known: 12,
          due: 12,
          weeklyKm: 40,
          weeklyMinutes: 40 * pace,
          longestKm: 13.5,
          longestMinutes: 13.5 * pace,
          supportsProgression: preserveProgression,
          source: 'recorded-plan-history',
          explanation: 'Synthetic reviewed baseline',
        };
        const plan = makePlan(
          smallBase({
            raceDate: addDays(start, 83),
            weeklyKm: 40,
            longestKm: 16.5,
            weekdayMinutes: 90,
            longMinutes: 150,
            runMeasure,
            workoutTargets: manualPace
              ? {
                  mode: 'pace',
                  pace: { easy: { low: 360, high: 390 } },
                }
              : undefined,
          }),
          start,
          false,
          {
            from: baseline.asOf,
            baseline,
            preserveProgression,
            history: [],
            referenceRuns: 3,
          },
        );
        const ordinaryLongs = plan.workouts.filter(
          (w) =>
            w.kind === 'long' &&
            w.date >= baseline.asOf &&
            plan.weeks[w.week].phase !== 'Recovery',
        );
        assert.ok(ordinaryLongs.length > 0);
        assert.ok(
          ordinaryLongs.every(
            (w) =>
              w.estimatedKm === 13.5 &&
              w.minutes <= baseline.longestMinutes + 1 / 60,
          ),
        );
        assert.deepEqual(validatePlan(JSON.parse(JSON.stringify(plan))), []);
      }
});

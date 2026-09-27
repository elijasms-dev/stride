import test from 'node:test';
import assert from 'node:assert/strict';
import { demoProfile, makePlan, validatePlan } from '../lib/engine.ts';

const start = '2026-09-28';
for (const goal of ['5k', '10k', 'half']) {
  for (const runMeasure of ['time', 'distance']) {
    test(`${goal} ${runMeasure}: five-minute rounding cannot reject a funded 30 km / 20 km opening`, () => {
      const input = {
        ...demoProfile(start),
        goal,
        raceDate: '2027-01-17',
        weeklyKm: 30,
        longestKm: 20,
        currentRuns: 6,
        runsPerWeek: 6,
        days: [0, 1, 2, 3, 4, 6],
        availableDays: [0, 1, 2, 3, 4, 5, 6],
        longDay: 6,
        weekdayMinutes: 120,
        longMinutes: 300,
        easyPace: 6,
        qualityMode: 'custom',
        qualitySessions: 1,
        recentQualitySessions: 1,
        recentQualityMinutes: 20,
        runMeasure,
      };
      const plan = makePlan(input, start, false);
      const opening = plan.workouts.filter((w) => w.week === 0);
      assert.equal(opening.length, 6);
      assert.equal(opening.find((w) => w.kind === 'long').estimatedKm, 20);
      assert.ok(
        Math.abs(opening.reduce((n, w) => n + w.estimatedKm, 0) - 30) < 0.002,
      );
      assert.equal(
        opening.filter((w) => w.hard && w.kind !== 'long').length,
        1,
      );
      assert.ok(opening.every((w) => w.minutes >= 5));
      assert.deepEqual(validatePlan(plan), []);
      assert.deepEqual(validatePlan(JSON.parse(JSON.stringify(plan))), []);
    });
  }
}

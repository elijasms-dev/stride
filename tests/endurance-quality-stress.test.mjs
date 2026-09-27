import assert from 'node:assert/strict';
import test from 'node:test';
import { addDays, demoProfile, makePlan, validatePlan } from '../lib/engine.ts';

const start = '2026-09-28';
const manualTargets = {
  mode: 'pace',
  bandsVersion: 2,
  raceScope: 'marathon:',
  pace: {
    easy: { low: 253, high: 270 },
    steady: { low: 232, high: 249 },
    tempo: { low: 218, high: 235 },
    threshold: { low: 207, high: 225 },
    interval: { low: 191, high: 208 },
    repetition: { low: 178, high: 195 },
    race: { low: 216, high: 233 },
  },
};
const workMinutes = (workout) =>
  workout.steps.reduce(
    (sum, step) =>
      sum +
      (step.kind === 'work' &&
      step.intensity >= 4 &&
      workout.stimulus !== 'aerobic'
        ? (step.metres !== undefined && step.target?.mode === 'pace'
            ? (step.metres * step.target.high) / 1000
            : step.seconds) / 60
        : 0),
    0,
  );

for (const [weeklyKm, longestKm, runs, weeks] of [
  [45, 16, 5, 12],
  [70, 23, 5, 26],
  [90, 28, 6, 26],
]) {
  for (const mode of ['effort', 'automatic', 'manual'])
    for (const runMeasure of ['time', 'distance']) {
      test(`marathon ${weeklyKm}/${longestKm}, ${mode}/${runMeasure}: preserve two complete weekday workouts inside the funded week`, () => {
        const p = {
          ...demoProfile(start),
          goal: 'marathon',
          weeklyKm,
          longestKm,
          currentRuns: runs,
          runsPerWeek: runs,
          days: runs === 5 ? [0, 1, 2, 4, 6] : [0, 1, 2, 3, 4, 6],
          availableDays: [0, 1, 2, 3, 4, 5, 6],
          longDay: 6,
          weekdayMinutes: 120,
          longMinutes: 300,
          raceDate: addDays(start, weeks * 7 - 1),
          easyPace: 4.5,
          experience: 'established',
          intent: 'improve',
          qualityMode: 'custom',
          qualitySessions: 2,
          recentQualitySessions: 2,
          recentQualityMinutes: 40,
          runMeasure,
          workoutFormat: 'time',
          workoutVariety: 'varied',
          ...(mode !== 'effort'
            ? {
                recentRace: {
                  distanceKm: 10,
                  timeMinutes: 38,
                  date: '2026-09-01',
                  source: 'race',
                  course: 'road',
                },
              }
            : {}),
          ...(mode === 'manual'
            ? { workoutTargets: structuredClone(manualTargets) }
            : mode === 'effort'
              ? { workoutTargets: { mode: 'effort' } }
              : {}),
        };
        const plan = makePlan(p, start, false);
        assert.deepEqual(validatePlan(plan), []);
        assert.equal(plan.profile.qualitySessions, 2);
        const opening = plan.workouts.filter(
          (w) => w.week === 0 && w.kind !== 'race',
        );
        assert.ok(
          Math.abs(opening.reduce((n, w) => n + w.estimatedKm, 0) - weeklyKm) <
            0.002,
        );
        assert.equal(
          opening.find((w) => w.kind === 'long').estimatedKm,
          longestKm,
        );
        for (const week of plan.weeks) {
          if (
            ['Recovery', 'Taper', 'Race week'].includes(week.phase) ||
            Date.parse(p.raceDate) - Date.parse(addDays(week.start, 6)) <=
              21 * 86400000
          )
            continue;
          const runs = plan.workouts.filter(
            (w) => w.week === week.index && w.kind !== 'race',
          );
          const quality = runs.filter(
            (w) =>
              w.kind !== 'long' &&
              w.hard &&
              w.stimulus !== 'economy' &&
              workMinutes(w) >= 6 - 1e-6,
          );
          assert.equal(
            quality.length,
            2,
            `week ${week.index + 1} retains both complete main sets`,
          );
          const minutes = runs.reduce((n, w) => n + w.minutes, 0);
          assert.ok(
            runs.reduce((n, w) => n + workMinutes(w), 0) <=
              minutes * 0.22 + 0.02,
            'the long-run faster segment shares the work allowance',
          );
          assert.ok(
            runs.reduce((n, w) => n + w.estimatedKm, 0) <=
              weeklyKm * 1.4 + 0.002,
            'repair cannot add a higher weekly forecast',
          );
          for (const w of runs) {
            assert.ok(w.minutes <= (w.kind === 'long' ? 300 : 120) + 1 / 60);
            assert.ok(
              Math.abs(
                w.minutes * 60 - w.steps.reduce((n, s) => n + s.seconds, 0),
              ) <= 1,
            );
          }
        }
      });
    }
}

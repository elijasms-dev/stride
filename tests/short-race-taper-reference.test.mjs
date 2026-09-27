import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  makePlan,
  taperFactor,
  trainingPhaseOn,
  validatePlan,
} from '../lib/engine.ts';
import { mandatoryTaperWeeks } from '../lib/progression-engine.ts';
import { roadTaperDays } from '../lib/road-training-policy.ts';
import { profile, start } from './short-race-reference-fixtures.mjs';

// Acceptance source: the user's TRAINING_REFERENCE.md, supplied 2026-09-27.
// Higdon 5K week 7 still has its full long run; only week 8 tapers. Therefore
// the seven-day window includes race day (D6..D0), leaving D7 untapered.
// Apply the same inclusive-race counting to the requested two-week 10K taper:
// D13..D0, with D14 still outside. Half/marathon/ultra remain out of scope.
for (const { goal, weeks, days } of [
  { goal: '5k', weeks: 1, days: 7 },
  { goal: '10k', weeks: 2, days: 14 },
]) {
  void test(`${goal}: the supplied reference requires ${weeks} taper week(s) in the public progression helper`, () => {
    for (const blockWeeks of [8, 10, 12, 16, 20])
      assert.equal(mandatoryTaperWeeks(goal, blockWeeks, goal), weeks);
  });

  void test(`${goal}: the actual road policy uses the supplied ${days}-day taper, not just the exported helper`, () => {
    assert.equal(roadTaperDays({ goal }), days);
  });

  void test(`${goal}: the Sunday before the ${weeks}-week taper retains its full long run in a generated eight-week plan`, () => {
    const input = profile(goal, 1);
    const plan = makePlan(input, start, false);
    const date = addDays(input.raceDate, -days);
    const long = plan.workouts.find(
      (workout) => workout.date === date && workout.kind === 'long',
    );
    assert.ok(long, `Expected the full long-run slot on ${date}`);
    assert.equal(taperFactor(input, long.date), 1);
    assert.notEqual(
      trainingPhaseOn(input, plan.weeks[long.week].phase, long.date),
      'Taper',
    );
    const previousLong = plan.workouts
      .filter((workout) => workout.kind === 'long' && workout.date < date)
      .at(-1);
    assert.ok(previousLong);
    assert.ok(
      long.estimatedKm >= previousLong.estimatedKm,
      'The table retains its full final pre-taper long run, not an early reduction.',
    );
    assert.deepEqual(validatePlan(plan), []);
  });

  for (let raceWeekday = 0; raceWeekday < 7; raceWeekday++) {
    void test(`${goal}: race weekday ${raceWeekday} tapers the final ${days} days including race day`, () => {
      const input = profile(goal, 1, {
        raceDate: addDays('2026-11-23', raceWeekday),
      });
      for (let before = days; before <= days + 7; before++) {
        const date = addDays(input.raceDate, -before);
        assert.equal(taperFactor(input, date), 1, date);
        assert.notEqual(trainingPhaseOn(input, 'Build', date), 'Taper');
      }
      for (let before = 0; before < days; before++) {
        const date = addDays(input.raceDate, -before);
        assert.ok(taperFactor(input, date) < 1, date);
        assert.equal(trainingPhaseOn(input, 'Build', date), 'Taper');
      }
    });
  }
}

void test('half, marathon and ultra retain the protected 2–3 week taper branch; base has no race taper', () => {
  for (const goal of ['half', 'marathon', 'ultra']) {
    assert.equal(mandatoryTaperWeeks(goal, 8, goal), 2);
    for (const blockWeeks of [10, 12, 16, 20])
      assert.equal(mandatoryTaperWeeks(goal, blockWeeks, goal), 3);
  }
  for (const family of ['5k', '10k', 'half', 'marathon', 'ultra', 'base'])
    assert.equal(mandatoryTaperWeeks(family, 12, 'base'), 0);
});

void test('the named 5K reference does not change the existing custom/ultra short-distance taper contract', () => {
  // The supplied fix is for the named 5K programme. A custom event classified
  // into its preparation family still uses the existing generic daily taper;
  // its week-level helper must stay consistent with that unchanged pathway.
  for (const goal of ['custom', 'ultra'])
    for (const blockWeeks of [8, 10, 12, 16, 20])
      assert.equal(mandatoryTaperWeeks('5k', blockWeeks, goal), 2);

  const input = profile('5k', 1, { goal: 'custom', raceDistanceKm: 5 });
  const plan = makePlan(input, start, false);
  const penultimateWeek = plan.weeks.at(-2);
  assert.equal(penultimateWeek.phase, 'Taper');
  assert.ok(taperFactor(input, penultimateWeek.start) < 1);
  assert.equal(
    trainingPhaseOn(input, penultimateWeek.phase, penultimateWeek.start),
    'Taper',
  );
  assert.deepEqual(validatePlan(plan), []);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { makePlan, validatePlan, addDays, PlanError } from '../lib/engine.ts';
import { assessFeasibility } from '../lib/plan/feasibility.ts';
import { FIRST_RACE_CASES, firstRaceProfile } from './first-race-cases.mjs';
const sum = (runs) => runs.reduce((n, w) => n + w.estimatedKm, 0);

for (const c of FIRST_RACE_CASES) {
  test(`${c.goal}: adequate first-race forecast has a real endurance build, exact baseline, easy support and taper`, () => {
    const profile = firstRaceProfile(c);
    const plan = makePlan(profile, profile.startDate);
    assert.equal(plan.firstRace.goal, c.goal);
    assert.equal(plan.firstRace.program, 'first-race-v1');
    assert.deepEqual(validatePlan(plan), []);
    const training = plan.workouts.filter((w) => w.kind !== 'race');
    const opening = training.filter((w) => w.week === 0);
    assert.ok(Math.abs(sum(opening) - c.weeklyKm) < 0.011);
    assert.equal(
      opening.find((w) => w.kind === 'long').estimatedKm,
      c.longestKm,
    );
    assert.ok(training.every((w) => !w.hard && !(w.qualityMinutes > 0)));
    assert.ok(
      training.every((w) =>
        w.steps.every((s) => s.intensity < 4 && s.movement !== 'walk'),
      ),
    );
    const longs = training.filter((w) => w.kind === 'long');
    assert.ok(Math.max(...longs.map((w) => w.estimatedKm)) >= c.requiredLong);
    const volume = plan.weeks.map((week) =>
      sum(training.filter((w) => w.week === week.index)),
    );
    assert.ok(
      volume.filter((km) => km >= c.requiredWeek).length >= 2,
      JSON.stringify(volume),
    );
    let lastBuild = c.longestKm;
    for (const week of plan.weeks) {
      const runs = training.filter((w) => w.week === week.index);
      const long = runs.find((w) => w.kind === 'long');
      if (['Recovery', 'Taper', 'Race week'].includes(week.phase)) continue;
      assert.equal(runs.length, c.runs);
      if (long) {
        assert.ok(
          long.estimatedKm >= lastBuild,
          `${week.index}: ${long.estimatedKm} < ${lastBuild}`,
        );
        if (long.estimatedKm > c.longestKm)
          assert.ok(Number.isInteger(long.estimatedKm));
        lastBuild = long.estimatedKm;
      }
    }
    assert.equal(assessFeasibility(plan, profile.startDate).status, 'forecast');
    assert.deepEqual(validatePlan(JSON.parse(JSON.stringify(plan))), []);
    assert.equal(plan.workouts.filter((w) => w.kind === 'race').length, 1);
  });
  for (const q of [1, 2])
    test(`${c.goal}: requested quality ${q} is clearly rejected, never silently erased`, () => {
      const profile = firstRaceProfile(c, {
        qualityMode: 'custom',
        qualitySessions: q,
      });
      assert.throws(
        () => makePlan(profile, profile.startDate),
        (e) =>
          e instanceof PlanError &&
          /easy|quality|speed|beginner/i.test(e.message),
      );
    });
  test(`${c.goal}: zero history starts a timed foundation, not a fictional race block`, () => {
    const profile = firstRaceProfile(c, {
      weeklyKm: 0,
      longestKm: 0,
      currentRuns: 0,
      days: [0, 2, 4],
      longDay: 6,
      weekdayMinutes: 40,
      easyPace: null,
    });
    const plan = makePlan(profile, profile.startDate);
    assert.ok(plan.beginner);
    assert.equal(plan.firstRace, undefined);
    assert.ok(
      plan.workouts.every((w) => w.kind === 'easy' && w.estimatedKm === 0),
    );
    assert.ok(
      plan.workouts.every((w) => w.steps.every((s) => !s.metres && !s.target)),
    );
    assert.equal(plan.feasibility.status, 'review-required');
    assert.deepEqual(validatePlan(plan), []);
  });
  test(`${c.goal}: short calendar cannot be classified as adequate preparation`, () => {
    const profile = firstRaceProfile(c, {
      raceDate: addDays('2026-09-28', 27),
    });
    const plan = makePlan(profile, profile.startDate);
    assert.deepEqual(validatePlan(plan), []);
    assert.equal(
      assessFeasibility(plan, profile.startDate).status,
      'review-required',
    );
  });
  test(`${c.goal}: below-entry nonzero history is not silently inflated`, () => {
    const profile = firstRaceProfile(c, {
      weeklyKm: 3,
      longestKm: 1,
      currentRuns: 2,
    });
    assert.throws(
      () => makePlan(profile, profile.startDate),
      (e) =>
        e instanceof PlanError &&
        /base|foundation|recent|beginner/i.test(e.message),
    );
  });
}

test('beginner programme rejects unsupported event categories and corrupt variant state', () => {
  const profile = firstRaceProfile(FIRST_RACE_CASES[0]);
  for (const goal of ['ultra', 'custom', 'base'])
    assert.throws(
      () =>
        makePlan({ ...profile, goal, raceDistanceKm: 50 }, profile.startDate),
      PlanError,
    );
  const plan = makePlan(profile, profile.startDate);
  plan.firstRace.goal = 'marathon';
  assert.ok(validatePlan(plan).length);
});

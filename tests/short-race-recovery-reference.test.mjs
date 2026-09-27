import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  dayDiff,
  makePlan,
  validatePlan,
  weekday,
} from '../lib/engine.ts';
import { FIRST_RACE_CASES, firstRaceProfile } from './first-race-cases.mjs';
import { roadQualityFrequencyErrors } from '../lib/plan/generation-rhythm.ts';
import {
  profile,
  qualityByWeek,
  start,
} from './short-race-reference-fixtures.mjs';

// Acceptance source: the user's TRAINING_REFERENCE.md, supplied 2026-09-27.
// Higdon Intermediate 5K/10K retain quality in every week, including the
// mid-block cutback and race week. These tests check the requested properties,
// not reproduction of any provider's entire schedule. The separate half
// reference explicitly retains periodic fourth-week recovery.
for (const goal of ['5k', '10k']) {
  for (const requested of [1, 2]) {
    void test(`${goal} q${requested}: supplied reference retains actual quality in all eight weeks, including week 4 and race week`, () => {
      const input = profile(goal, requested);
      const plan = makePlan(input, start, false);
      assert.equal(plan.weeks.length, 8);
      const missing = qualityByWeek(plan)
        .map((sessions, index) => (sessions.length ? null : index + 1))
        .filter((week) => week !== null);
      assert.deepEqual(
        missing,
        [],
        'The supplied short-race schedules never replace all quality with easy/long running.',
      );
      assert.equal(plan.weeks.at(-1).phase, 'Race week');
      assert.deepEqual(validatePlan(plan), []);
    });

    void test(`${goal} q${requested}: supplied reference forbids periodic full recovery weeks`, () => {
      const plan = makePlan(profile(goal, requested), start, false);
      assert.deepEqual(
        plan.weeks
          .filter((week) => week.phase === 'Recovery')
          .map((week) => week.index + 1),
        [],
      );
    });
  }

  void test(`${goal}: the supplied short-race back-off mechanism reduces two quality outings to one, never zero`, () => {
    const plan = makePlan(profile(goal, 2), start, false);
    const quality = qualityByWeek(plan);
    // The existing default back-off cadence is week four. The request changes
    // its mechanism, not the cadence: preserve one of the selected workouts.
    assert.equal(quality[2].length, 2);
    assert.equal(quality[3].length, 1);
    assert.equal(quality[4].length, 2);
    assert.notEqual(plan.weeks[3].phase, 'Recovery');
    assert.deepEqual(validatePlan(plan), []);
  });

  void test(`${goal}: removing actual work from a race-week session violates the supplied every-week reference`, () => {
    const plan = makePlan(profile(goal, 1), start, false);
    const finalQuality = qualityByWeek(plan).at(-1);
    assert.ok(finalQuality.length > 0);
    for (const workout of finalQuality) {
      workout.steps = workout.steps.map((step) =>
        step.kind === 'work'
          ? { ...step, kind: 'aerobic', intensity: 2, effortRole: 'easy' }
          : step,
      );
      workout.qualityMinutes = 0;
    }
    assert.ok(
      roadQualityFrequencyErrors(plan).some((error) =>
        /must retain a running quality session/.test(error),
      ),
      'A hard flag, workout title or the race itself cannot replace executable training work.',
    );
  });

  for (const recoveryWeeks of [3, 4]) {
    void test(`${goal}: reducing the workout count every ${recoveryWeeks} weeks retains a familiar slot without creating adjacent hard days`, () => {
      // The reference changes the NUMBER of quality sessions during back-off.
      // Removing a session must not move the retained session onto Monday
      // immediately after the preceding week's Sunday quality workout.
      const plan = makePlan(
        profile(goal, 2, {
          longDay: 4,
          days: [0, 1, 3, 4, 6],
          availableDays: [0, 1, 3, 4, 6],
          recoveryWeeks,
        }),
        start,
        false,
      );
      const quality = qualityByWeek(plan);
      const normal = quality[recoveryWeeks - 2];
      const reduced = quality[recoveryWeeks - 1];
      assert.equal(normal.length, 2);
      assert.equal(reduced.length, 1);
      assert.ok(
        normal.some((run) => weekday(run.date) === weekday(reduced[0].date)),
        'The back-off week removes an existing quality slot instead of moving it to a new day.',
      );
      const hardRuns = quality
        .flat()
        .sort((a, b) => a.date.localeCompare(b.date));
      for (let i = 1; i < hardRuns.length; i++)
        assert.ok(
          dayDiff(hardRuns[i - 1].date, hardRuns[i].date) >= 2,
          `Back-off must retain an easy or rest day between ${hardRuns[i - 1].date} and ${hardRuns[i].date}.`,
        );
      assert.deepEqual(validatePlan(plan), []);
    });
  }

  void test(`${goal}: explicit zero-quality choice is outside the intermediate reference and stays easy`, () => {
    const plan = makePlan(profile(goal, 0), start, false);
    assert.ok(qualityByWeek(plan).every((sessions) => sessions.length === 0));
    assert.ok(
      plan.workouts
        .filter((workout) => workout.kind !== 'race')
        .every((workout) => !workout.hard),
    );
    assert.deepEqual(validatePlan(plan), []);
  });

  void test(`${goal}: an automatic developing routine is not upgraded to intermediate quality`, () => {
    const plan = makePlan(
      profile(goal, 0, {
        qualityMode: 'automatic',
        weeklyKm: goal === '10k' ? 18 : 15,
        longestKm: 6,
        currentRuns: 3,
        runsPerWeek: 3,
        days: [1, 3, 6],
        experience: 'new',
        intent: 'finish',
      }),
      start,
      false,
    );
    assert.ok(qualityByWeek(plan).every((sessions) => sessions.length === 0));
    assert.deepEqual(validatePlan(plan), []);
  });

  void test(`${goal}: beginner first-race and zero-experience foundation remain outside the intermediate reference`, () => {
    const beginner = FIRST_RACE_CASES.find(
      (scenario) => scenario.goal === goal,
    );
    for (const patch of [
      {},
      {
        weeklyKm: 0,
        longestKm: 0,
        currentRuns: 0,
        days: [0, 2, 4],
        weekdayMinutes: 40,
        easyPace: null,
      },
    ]) {
      const input = firstRaceProfile(beginner, patch);
      const plan = makePlan(input, input.startDate, false);
      assert.ok(plan.beginner || plan.firstRace);
      assert.ok(qualityByWeek(plan).every((sessions) => sessions.length === 0));
      assert.deepEqual(validatePlan(plan), []);
    }
  });
}

for (const blockWeeks of [12, 16]) {
  void test(`half: supplied reference preserves fourth-week recovery through a ${blockWeeks}-week block`, () => {
    const plan = makePlan(
      profile('half', 1, {
        raceDate: addDays(start, blockWeeks * 7 - 1),
        weeklyKm: 45,
        longestKm: 16,
      }),
      start,
      false,
    );
    const expected = Array.from(
      { length: blockWeeks },
      (_, index) => index,
    ).filter((index) => (index + 1) % 4 === 0 && index < blockWeeks - 3);
    assert.deepEqual(
      plan.weeks
        .filter((week) => week.phase === 'Recovery')
        .map((week) => week.index),
      expected,
    );
    assert.deepEqual(validatePlan(plan), []);
  });
}

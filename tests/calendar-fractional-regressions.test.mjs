import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  dayDiff,
  demoProfile,
  makePlan,
  revisePreferences,
  taperFactor,
  validatePlan,
  weekday,
} from '../lib/engine.ts';
import { normalizeGeneratedLongRuns } from '../lib/plan/generation-reconcile.ts';

const monday = '2026-09-21';
const ordinary = (plan) =>
  plan.weeks.filter(
    (week) =>
      week.start >= plan.profile.startDate &&
      addDays(week.start, 6) <= plan.profile.raceDate &&
      !['Recovery', 'Taper', 'Race week'].includes(week.phase) &&
      taperFactor(plan.profile, addDays(week.start, 6)) === 1,
  );
const weekRuns = (plan, week) =>
  plan.workouts.filter((run) => run.week === week.index && run.kind !== 'race');
const weeklyKm = (plan, week) =>
  weekRuns(plan, week).reduce((sum, run) => sum + run.estimatedKm, 0);

function marathon(patch = {}) {
  return {
    ...demoProfile(monday),
    goal: 'marathon',
    raceDate: addDays(monday, 55),
    weeklyKm: 40,
    longestKm: 14.5,
    currentRuns: 4,
    runsPerWeek: 4,
    days: [0, 2, 4, 6],
    availableDays: [0, 2, 4, 6],
    longDay: 6,
    weekdayMinutes: 120,
    longMinutes: 300,
    easyPace: 5,
    qualityMode: 'automatic',
    recentQualitySessions: 2,
    recentQualityMinutes: 40,
    runMeasure: 'distance',
    volume: 'maintain',
    method: 'balanced',
    intent: 'improve',
    ...patch,
  };
}

for (const [name, patch] of [
  ['eight-week fractional baseline', {}],
  [
    'eight-week slower high volume',
    { weeklyKm: 70, longestKm: 23, easyPace: 7 },
  ],
  [
    'Tuesday start twelve-week block',
    {
      startDate: addDays(monday, 1),
      raceDate: addDays(monday, 84),
      weeklyKm: 70,
      longestKm: 25,
      currentRuns: 5,
      runsPerWeek: 5,
      days: [0, 1, 2, 4, 6],
      availableDays: [0, 1, 2, 4, 6],
      easyPace: 6,
      volume: 'gradual',
      qualityMode: 'custom',
      qualitySessions: 1,
      recentQualitySessions: 1,
      recentQualityMinutes: 20,
    },
  ],
]) {
  if (typeof name !== 'string') throw new Error('Expected calendar case label');
  test(`${name}: ordinary load remains feasible before actual taper`, () => {
    const input = marathon(patch);
    const plan = makePlan(input, input.startDate, false);
    let previous = input.weeklyKm;
    for (const week of ordinary(plan)) {
      const km = weeklyKm(plan, week);
      assert.ok(km >= previous - 0.00101);
      if (input.volume === 'maintain')
        assert.ok(Math.abs(km - input.weeklyKm) <= 0.00101);
      previous = Math.max(previous, km);
    }
    // The familiar-day guard still constrains the actual taper; it does not
    // extend the taper into a calendar week the event model calls ordinary.
    const reference = [...ordinary(plan)]
      .reverse()
      .find((week) => dayDiff(addDays(week.start, 6), input.raceDate) >= 21);
    assert.ok(reference);
    const familiar = new Map(
      weekRuns(plan, reference).map((run) => [weekday(run.date), run.minutes]),
    );
    const tapered = plan.workouts.filter(
      (run) => run.kind !== 'race' && taperFactor(plan.profile, run.date) < 1,
    );
    assert.ok(tapered.length > 0);
    for (const run of tapered) {
      const cap = familiar.get(weekday(run.date));
      if (cap !== undefined) assert.ok(run.minutes <= cap + 1 / 60);
    }
    assert.deepEqual(validatePlan(JSON.parse(JSON.stringify(plan))), []);
    const revised = revisePreferences(
      plan,
      { weeklyMinutesLimit: 900 },
      input.startDate,
    );
    assert.deepEqual(
      revised.workouts.map((run) => run.steps),
      plan.workouts.map((run) => run.steps),
    );
  });
}

function fractionalProfile(goal, runMeasure, raceDistanceKm) {
  return {
    ...demoProfile(monday),
    goal,
    raceDistanceKm,
    raceDate: addDays(monday, 223),
    weeklyKm: 60,
    longestKm: 16.5,
    currentRuns: 5,
    runsPerWeek: 5,
    days: [0, 1, 3, 4, 6],
    availableDays: [0, 1, 2, 3, 4, 5, 6],
    longDay: 6,
    weekdayMinutes: 120,
    longMinutes: 300,
    easyPace: 6.25,
    runMeasure,
    volume: 'gradual',
    qualityMode: 'automatic',
    recentQualitySessions: 2,
    recentQualityMinutes: 40,
    method: 'balanced',
    experience: 'established',
    intent: 'improve',
  };
}

for (const goal of ['5k', '10k']) {
  for (const mode of ['time', 'distance']) {
    test(`${goal} ${mode}: a familiar fractional long above the family peak is retained`, () => {
      assertFractionalHold(fractionalProfile(goal, mode));
    });
  }
}
for (const distance of [7.5001, 10, 14.9999, 15])
  test(`custom ${distance} km: the fractional familiar long is retained`, () => {
    assertFractionalHold(fractionalProfile('custom', 'distance', distance));
  });

function assertFractionalHold(input) {
  const plan = makePlan(input, monday, false);
  for (const week of ordinary(plan)) {
    const long = weekRuns(plan, week).find((run) => run.kind === 'long');
    assert.ok(long);
    assert.equal(long.estimatedKm, 16.5);
    assert.ok(weeklyKm(plan, week) >= input.weeklyKm - 0.00101);
  }
  assert.ok(
    plan.workouts
      .filter((run) => run.kind === 'long')
      .every((run) => run.estimatedKm <= 16.5),
  );
  const before = structuredClone(plan.workouts);
  normalizeGeneratedLongRuns(plan, monday);
  assert.deepEqual(plan.workouts, before);
  assert.deepEqual(validatePlan(JSON.parse(JSON.stringify(plan))), []);
}

test('below-family fractional opening still advances to a whole kilometre', () => {
  const input = { ...fractionalProfile('5k', 'distance'), longestKm: 10.5 };
  const plan = makePlan(input, monday, false);
  const longs = ordinary(plan).map((week) =>
    weekRuns(plan, week).find((run) => run.kind === 'long'),
  );
  assert.equal(longs[0].estimatedKm, 10.5);
  assert.ok(
    longs
      .slice(1)
      .every(
        (long) => Number.isInteger(long.estimatedKm) && long.estimatedKm >= 11,
      ),
  );
  assert.deepEqual(validatePlan(plan), []);
});

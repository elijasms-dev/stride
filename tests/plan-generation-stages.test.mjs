import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, demoProfile, validateProfile } from '../lib/engine.ts';
import { resolveGenerationPolicy } from '../lib/plan/generation-policy.ts';
import { calculateWeekLoad } from '../lib/plan/generation-load.ts';
import { allocateGenerationWeek } from '../lib/plan/generation-allocation.ts';
import { generatePlanWeeks } from '../lib/plan/generation-weeks.ts';
import { taperFactor } from '../lib/plan/generation-calendar.ts';

const start = '2026-09-14';
const profile = (patch = {}) =>
  validateProfile(
    {
      ...demoProfile(start),
      goal: 'marathon',
      raceDate: addDays(start, 125),
      weeklyKm: 70,
      longestKm: 23,
      currentRuns: 5,
      days: [0, 1, 2, 4, 6],
      longDay: 6,
      weekdayMinutes: 120,
      longMinutes: 240,
      easyPace: 6,
      recentQualitySessions: 2,
      recentQualityMinutes: 30,
      ...patch,
    },
    start,
  );
function freeze(value) {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
}
function forecast(context) {
  let previous = context.initialLoad;
  return Array.from({ length: context.count }, (_, index) => {
    const week = calculateWeekLoad(context, index, previous);
    previous = week.load;
    return week;
  });
}

test('load forecasts stay within every absolute, declared-distance, and declared-time ceiling', () => {
  // Exercise intersecting ceilings across phase boundaries rather than one fixture peak.
  for (const goal of ['5k', '10k', 'half', 'marathon', 'ultra', 'base']) {
    for (const weeks of [6, 12, 18, 30, 48]) {
      for (const weeklyMinutesLimit of [300, 420, 600]) {
        const context = resolveGenerationPolicy(
          profile({
            goal,
            raceDistanceKm: goal === 'ultra' ? 50 : undefined,
            raceDate: addDays(start, weeks * 7 - 1),
            weeklyKm: goal === 'ultra' || goal === 'marathon' ? 70 : 35,
            longestKm: goal === 'ultra' ? 28 : goal === 'marathon' ? 23 : 10,
            peakWeeklyKm: goal === 'ultra' || goal === 'marathon' ? 85 : 45,
            weeklyMinutesLimit,
          }),
        );
        const ceiling = Math.min(
          context.absoluteCeiling,
          context.p.peakWeeklyKm,
          weeklyMinutesLimit / context.pace,
        );
        const values = [
          context.initialLoad,
          ...forecast(context).map((week) => week.load),
        ];
        assert.ok(
          values.every(
            (value) =>
              Number.isFinite(value) && value >= 0 && value <= ceiling + 1e-9,
          ),
          `${goal}: ${weeks} weeks, ${weeklyMinutesLimit} minutes`,
        );
      }
    }
  }
});

test('maintaining volume and recovery/taper weeks never add forecast load', () => {
  for (const volume of ['maintain', 'gradual']) {
    for (const recoveryWeeks of [3, 4]) {
      const context = resolveGenerationPolicy(
        profile({ volume, recoveryWeeks, raceDate: addDays(start, 209) }),
      );
      let previous = context.initialLoad;
      for (const week of forecast(context)) {
        if (
          volume === 'maintain' ||
          week.recovery ||
          week.taper ||
          week.maintenance
        )
          assert.equal(week.load, previous);
        previous = week.load;
      }
    }
  }
});

test('the long-run forecast respects duration and distance caps independently of weekly load', () => {
  for (const longMinutes of [150, 180, 210, 240]) {
    for (const longLimitKm of [26, 29, 32, 35]) {
      const context = resolveGenerationPolicy(
        profile({ longMinutes, longLimitKm }),
      );
      for (const week of forecast(context)) {
        assert.ok(week.long <= longMinutes / context.longPace + 1e-9);
        assert.ok(week.long <= longLimitKm + 1e-9);
        assert.ok(
          week.long <=
            Math.max(context.startLong, context.policy.longCeilingKm),
        );
      }
    }
  }
});

test('conservative manual pace funds the same declared weekly distance', () => {
  const ordinary = resolveGenerationPolicy(
    profile({ longestKm: 25, longMinutes: 210 }),
  );
  const manual = resolveGenerationPolicy(
    profile({
      longestKm: 25,
      longMinutes: 210,
      workoutTargets: { mode: 'pace', pace: { easy: { low: 330, high: 390 } } },
    }),
  );
  assert.equal(ordinary.initialLoad * ordinary.pace, 420);
  assert.equal(manual.initialLoad, ordinary.initialLoad);
  assert.equal(manual.initialLoad * manual.pace, 70 * 6.5);
  assert.equal(manual.longPace, 6.5);
  assert.equal(manual.startLong, 25);
  assert.ok(manual.peakLong <= 210 / 6.5);
});

test('taper fractions follow race-relative day boundaries for short road and half-marathon blocks', () => {
  for (const goal of ['5k', '10k', 'half']) {
    const p = profile({ goal, longestKm: 10, weeklyKm: 35 });
    const expected =
      goal === 'half'
        ? [
            [22, 1],
            [21, 0.85],
            [15, 0.85],
            [14, 0.65],
            [8, 0.65],
            [7, 0.4],
            [0, 0.4],
          ]
        : [
            [22, 1],
            [21, 1],
            [15, 1],
            [14, 0.65],
            [8, 0.65],
            [7, 0.4],
            [0, 0.4],
          ];
    for (const [daysBeforeRace, fraction] of expected)
      assert.equal(
        taperFactor(p, addDays(p.raceDate, -daysBeforeRace)),
        fraction,
      );
  }
});

test('a partially tapered week suppresses growth without relabeling the earlier training days', () => {
  const context = resolveGenerationPolicy(
    profile({
      goal: 'half',
      weeklyKm: 35,
      longestKm: 10,
      raceDate: addDays(start, 82),
    }),
  );
  const boundary = forecast(context).find(
    (week) => week.taper && !week.taperAtWeekStart,
  );
  assert.ok(boundary, 'fixture must straddle the day-specific taper boundary');
  assert.equal(boundary.phase, 'Race preparation');
});

test('week allocation cannot spend more than its resolved weekly minutes', () => {
  const context = freeze(resolveGenerationPolicy(profile()));
  let previous = context.initialLoad;
  for (let index = 0; index < context.count; index++) {
    const week = calculateWeekLoad(context, index, previous);
    previous = week.load;
    const allocation = allocateGenerationWeek(
      context,
      week,
      index,
      freeze([]),
      freeze([]),
    );
    const regularMinutes = [...allocation.allocation.values()].reduce(
      (sum, minutes) => sum + minutes,
      0,
    );
    const longMinutes = allocation.longDate
      ? Math.ceil(allocation.longDistance * context.longPace)
      : 0;
    assert.ok(
      regularMinutes + longMinutes <=
        Math.floor(allocation.desired * context.pace),
    );
    assert.ok(
      [...allocation.allocation.values()].every(
        (minutes) => Number.isInteger(minutes) && minutes >= 5,
      ),
    );
  }
});

test('generation stages accept frozen inputs and return independent deterministic schedules', () => {
  const p = freeze(profile());
  const context = freeze(resolveGenerationPolicy(p));
  const before = JSON.stringify(context);
  const first = generatePlanWeeks(context);
  const second = generatePlanWeeks(context);
  assert.deepEqual(first, second);
  assert.notEqual(first.workouts, second.workouts);
  assert.notEqual(first.weeks, second.weeks);
  assert.equal(JSON.stringify(context), before);
  assert.ok(first.workouts.length > 0);
});

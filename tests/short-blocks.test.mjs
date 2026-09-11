import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  dayDiff,
  demoProfile,
  makePlan,
  MAX_EVENT_KM,
  preparationRequirements,
  raceDistance,
  revisePreferences,
  validatePlan,
  weekday,
} from '../lib/engine.ts';
import { validateRecovery } from '../lib/recovery.ts';
import { avoidRecordedOverlap } from '../lib/event-transition.ts';

const monday = '2026-09-07';
function profile(goal, startDate, span, patch = {}) {
  return {
    ...demoProfile(startDate),
    goal,
    startDate,
    raceDate: addDays(startDate, span),
    raceDistanceKm:
      goal === 'ultra' ? MAX_EVENT_KM : goal === 'custom' ? 50 : undefined,
    weeklyKm: 70,
    longestKm: 28,
    currentRuns: 5,
    runsPerWeek: 5,
    availableDays: [0, 1, 2, 3, 4, 5, 6],
    days: [0, 1, 2, 3, 5],
    longDay: 5,
    weekdayMinutes: 120,
    longMinutes: 240,
    easyPace: 6,
    recentQualitySessions: 2,
    qualityMode: 'automatic',
    stableWeeks: 16,
    ultraWeeklyMinutes: 420,
    ultraLongestMinutes: 180,
    ...patch,
  };
}

for (const goal of ['base', '5k', '10k', 'half', 'marathon', 'ultra', 'custom'])
  void test(`${goal} accepts short windows on every start weekday, without out-of-range or extra sessions`, () => {
    for (let offset = 0; offset < 7; offset++)
      for (const span of [0, 1, 6, 13, 20, 22, 27, 40]) {
        const start = addDays(monday, offset),
          p = profile(goal, start, span);
        const plan = makePlan(p, start, false);
        assert.equal(plan.profile.startDate, start);
        assert.equal(plan.profile.raceDate, addDays(start, span));
        assert.ok(plan.weeks.length >= 1);
        assert.deepEqual(validatePlan(plan), []);
        const training = plan.workouts.filter((w) => w.kind !== 'race');
        assert.ok(
          plan.workouts.every(
            (w) =>
              w.date >= start &&
              w.date <= p.raceDate &&
              w.status === 'planned' &&
              !w.feedback,
          ),
        );
        assert.ok(
          training.every(
            (w) =>
              w.minutes >= 5 &&
              w.minutes <=
                (w.kind === 'long' ? p.longMinutes : p.weekdayMinutes),
          ),
        );
        assert.ok(
          training.every((w) => !w.hard || dayDiff(w.date, p.raceDate) >= 3),
        );
        for (const week of plan.weeks) {
          const runs = plan.workouts.filter((w) => w.week === week.index);
          assert.ok(new Set(runs.map((w) => w.date)).size <= p.runsPerWeek);
          assert.ok(
            runs
              .filter((w) => w.kind !== 'race')
              .reduce((n, w) => n + w.minutes, 0) <=
              p.weeklyKm * p.easyPace * 1.25,
          );
        }
        const races = plan.workouts.filter((w) => w.kind === 'race');
        assert.equal(races.length, goal === 'base' ? 0 : 1);
        if (races.length) {
          assert.equal(races[0].date, p.raceDate);
          assert.equal(races[0].estimatedKm, raceDistance(plan.profile));
        }
      }
  });

void test('same-day rest and race-only blocks round-trip through recovery without invented running', () => {
  const sunday = addDays(monday, 6);
  const rest = makePlan(
    profile('base', sunday, 0, {
      availableDays: [0, 1, 2, 3, 4, 5],
      runsPerWeek: 5,
    }),
    sunday,
    false,
  );
  assert.equal(rest.workouts.length, 0);
  for (const plan of [
    rest,
    makePlan(profile('marathon', monday, 0), monday, false),
  ]) {
    assert.doesNotThrow(() =>
      validateRecovery({
        format: 'stride-recovery-2',
        exportedAt: monday + 'T12:00:00Z',
        profile: null,
        plan,
      }),
    );
  }
});

void test('partial pre-taper weeks use the starting baseline instead of collapsing later runs to five minutes', () => {
  const start = addDays(monday, 6);
  const plan = makePlan(profile('marathon', start, 16), start, false);
  const tapered = plan.workouts.filter((w) => w.kind !== 'race' && w.week > 0);
  assert.ok(tapered.length > 1);
  assert.ok(tapered.some((w) => w.minutes >= 20));
  for (const [bucket, factor] of [
    [1, 0.4],
    [2, 0.6],
    [3, 1],
  ]) {
    const runs = tapered.filter(
      (w) =>
        dayDiff(w.date, plan.profile.raceDate) >= (bucket - 1) * 7 &&
        dayDiff(w.date, plan.profile.raceDate) < bucket * 7,
    );
    assert.ok(
      runs.reduce((n, w) => n + w.minutes, 0) <=
        70 *
          6 *
          factor *
          Math.min(
            1,
            new Set(runs.map((w) => w.date)).size /
              (bucket === 1
                ? plan.profile.days.filter(
                    (d) => d !== weekday(plan.profile.raceDate),
                  ).length
                : 5),
          ) +
          0.1,
    );
  }
});

void test('preference edits preserve the short-block taper instead of repeatedly shrinking runs', () => {
  let plan = makePlan(profile('marathon', monday, 24), monday, false);
  const prescription = (p) =>
    p.workouts.map((w) => ({
      date: w.date,
      kind: w.kind,
      minutes: w.minutes,
      steps: w.steps,
    }));
  const original = prescription(plan);
  for (const weeklyMinutesLimit of [900, 950, 900]) {
    plan = revisePreferences(plan, { weeklyMinutesLimit }, monday);
    assert.deepEqual(prescription(plan), original);
    assert.deepEqual(validatePlan(plan), []);
  }
});

void test('short ultra blocks retain capacity advice without requiring a longer plan', () => {
  for (const raceDistanceKm of [50, MAX_EVENT_KM]) {
    const plan = makePlan(
      profile('ultra', monday, 40, { raceDistanceKm, longestKm: 30 }),
      monday,
      false,
    );
    assert.equal(plan.feasibility.status, 'review-required');
    assert.ok(
      plan.feasibility.reasons.some((reason) =>
        /six-hour|six weeks|nine-hour/.test(reason),
      ),
    );
    assert.deepEqual(validatePlan(plan), []);
  }
});

void test('short advanced blocks keep singles when no paired-session phase fits', () => {
  for (const method of ['easy-doubles', 'double-threshold']) {
    const p = profile('marathon', monday, 6, {
      method,
      weeklyKm: 90,
      longestKm: 28,
      currentRuns: 6,
      runsPerWeek: 6,
      days: [0, 1, 2, 3, 4, 5],
      doubleDays: [1],
      doubleGapHours: 8,
      recentSessionsPerWeek: 7,
      recentQualityMinutes: 40,
      easyDoubleWeeks: 8,
      thresholdCeiling: 2.5,
      thresholdControl: 'lactate',
      volume: 'maintain',
    });
    const plan = makePlan(p, monday, false);
    assert.equal(plan.profile.method, method);
    assert.ok(plan.workouts.every((w) => !w.pairId));
    assert.ok(
      plan.notes.some((note) => note.startsWith('No paired sessions fit')),
    );
  }
});

void test('date order and workload eligibility still apply, while preparation duration is a recommendation', () => {
  assert.ok(
    preparationRequirements(profile('marathon', monday, 0)).recommendedDays > 0,
  );
  assert.throws(
    () => makePlan(profile('base', monday, -1), monday, false),
    /on or after/,
  );
  assert.throws(
    () => makePlan(profile('base', monday, 364), monday, false),
    /52 weeks/,
  );
  assert.throws(
    () =>
      makePlan(
        profile('marathon', monday, 6, { weeklyKm: 10, longestKm: 5 }),
        monday,
        false,
      ),
    /baseline|recent|base|requires/i,
  );
  assert.throws(
    () =>
      makePlan(profile('ultra', monday, 6, { stableWeeks: 1 }), monday, false),
    /12 weeks/,
  );
});

void test('a short historical restart outside current recovery is valid; overlapping dates retain recovery', () => {
  const previous = makePlan(profile('ultra', monday, 0), monday, false);
  const race = previous.workouts[0];
  race.status = 'completed';
  race.feedback = {
    actualDate: monday,
    actualMinutes: 1800,
    actualKm: MAX_EVENT_KM,
    effort: 8,
    feeling: 'tired',
    note: '',
    recordedAt: monday + 'T20:00:00Z',
  };
  const asOf = addDays(monday, 4);
  const old = makePlan(profile('base', addDays(monday, -7), 2), asOf, false);
  const restored = avoidRecordedOverlap(old, previous, [], asOf);
  assert.ok(restored.workouts.every((w) => w.status === 'planned'));
  const upcoming = makePlan(profile('base', asOf, 2), asOf, false);
  const recovery = avoidRecordedOverlap(upcoming, previous, [], asOf);
  assert.ok(recovery.workouts.every((w) => w.status === 'skipped'));
  assert.equal(recovery.returnState.to, addDays(monday, 20));
});

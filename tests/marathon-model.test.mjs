import { assertMarathonWeek } from './marathon-contract.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makePlan,
  demoProfile,
  addDays,
  dayDiff,
  validatePlan,
  taperFactor,
  trainingPhaseOn,
  refreshWorkoutVariety,
  shortenWorkout,
} from '../lib/engine.ts';
import { qualityWorkMinutes } from '../lib/prescription.ts';
import { mainSetSummary } from '../lib/workout-names.ts';
import { encodeWorkout } from '../lib/fit.ts';

const start = '2026-09-07';
const input = (patch = {}) => ({
  ...demoProfile(start),
  goal: 'marathon',
  raceDate: addDays(start, 139),
  weeklyKm: 70,
  longestKm: 25,
  currentRuns: 5,
  runsPerWeek: 5,
  availableDays: [0, 1, 2, 3, 4, 5, 6],
  longDay: 5,
  weekdayMinutes: 120,
  longMinutes: 210,
  qualityMode: 'automatic',
  recentQualitySessions: 2,
  recentQualityMinutes: 40,
  intent: 'improve',
  method: 'balanced',
  ...patch,
});
const runs = (plan, week) =>
  plan.workouts.filter(
    (w) => w.kind !== 'race' && (week === undefined || w.week === week),
  );
const work = (w) =>
  w.steps.filter((s) => s.kind === 'work' && s.intensity >= 4);
const longest = (w) => Math.max(0, ...work(w).map((s) => s.seconds));

for (const weeks of [16, 20, 24])
  for (const days of [4, 5, 6, 7])
    for (const recent of [0, 1, 2])
      void test(`${weeks} weeks / ${days} days / ${recent} prior workouts: marathon capacity and frequency hold`, () => {
        const p = makePlan(
          input({
            raceDate: addDays(start, weeks * 7 - 1),
            currentRuns: days,
            runsPerWeek: days,
            recentQualitySessions: recent,
            recentQualityMinutes: recent * 20,
          }),
          start,
        );
        assert.deepEqual(validatePlan(p), []);
        for (const week of p.weeks) {
          const ss = runs(p, week.index);
          assert.ok(
            new Set(
              p.workouts
                .filter((w) => w.week === week.index)
                .map((w) => w.date),
            ).size <= days,
          );
          if (week.phase !== 'Race week') assert.equal(ss.length, days);
          assertMarathonWeek(p, week);
          assert.ok(
            ss.reduce((n, w) => n + qualityWorkMinutes(w), 0) <=
              ss.reduce((n, w) => n + w.minutes, 0) * 0.22 + 0.1,
          );
        }
        for (const w of runs(p)) {
          assert.equal(
            w.minutes * 60,
            w.steps.reduce((n, s) => n + s.seconds, 0),
          );
          assert.ok(w.minutes <= (w.kind === 'long' ? 210 : 120));
          if (taperFactor(p.profile, w.date) < 1) assert.ok(longest(w) <= 600);
        }
      });

void test('sustained tempo and marathon long work develop together throughout the build', () => {
  const p = makePlan(input({ weeklyKm: 80, recentQualityMinutes: 50 }), start);
  const tempo = runs(p).filter(
    (w) =>
      w.stimulus === 'threshold' &&
      !['Taper', 'Race week'].includes(p.weeks[w.week].phase),
  );
  assert.ok(tempo.some((w) => longest(w) >= 1200));
  assert.ok(tempo.some((w) => longest(w) >= 1800));
  assert.ok(
    tempo.some((w) => w.steps.filter((s) => s.kind === 'work').length === 1),
  );
  const specific = runs(p).filter(
    (w) => w.stimulus === 'race-rhythm' && w.kind === 'long',
  );
  assert.ok(specific.length >= 2);
  assert.ok(longest(specific.at(-1)) > longest(specific[0]));
  assert.ok(
    specific.every(
      (w) => w.steps.filter((s) => s.kind === 'work').length === 1,
    ),
  );
  assert.match(mainSetSummary(specific.at(-1)), /km/);
  assert.ok(specific.at(-1).steps.find((s) => s.kind === 'work').metres > 0);
  assert.ok(!runs(p).some((w) => w.stimulus === 'aerobic-power'));
  for (const week of p.weeks) assertMarathonWeek(p, week);
});

void test('developing runner alternates tempo and marathon work despite a second strides slot', () => {
  const p = makePlan(
    input({ weeklyKm: 65, recentQualitySessions: 1, recentQualityMinutes: 20 }),
    start,
  );
  assert.ok(
    runs(p).some(
      (w) =>
        w.week >= 4 &&
        p.weeks[w.week].phase === 'Build' &&
        w.stimulus === 'threshold',
    ),
  );
  assert.ok(
    runs(p).some(
      (w) =>
        w.week >= 4 &&
        p.weeks[w.week].phase === 'Build' &&
        w.stimulus === 'race-rhythm',
    ),
  );
});
void test('marathon variety advances through feasible recipes without repeating the same main set', () => {
  const p = makePlan(input(), start);
  const tempo = runs(p).filter(
    (w) =>
      w.stimulus === 'threshold' &&
      ['Build', 'Race preparation'].includes(p.weeks[w.week].phase),
  );
  const shapes = tempo.map(mainSetSummary);
  // Weekly threshold work still rotates complete feasible main sets.
  assert.ok(
    new Set(shapes).size >= Math.min(7, Math.ceil(shapes.length * 0.8)),
    shapes.join('; '),
  );
  for (let i = 1; i < shapes.length; i++)
    assert.notEqual(shapes[i], shapes[i - 1]);
});

void test('completion and gentle marathon plans do not inherit the demanding recipe progression', () => {
  const finish = makePlan(
    input({
      intent: 'finish',
      recentQualitySessions: 0,
      recentQualityMinutes: 0,
    }),
    start,
  );
  for (const week of finish.weeks) assertMarathonWeek(finish, week);
  const gentle = makePlan(input({ difficulty: 'gentle' }), start);
  assert.ok(
    runs(gentle).every(
      (w) =>
        !/marathon-(tempo|twelve|sixteen|continuous-rehearsal|long-split|long-finish)/.test(
          w.templateId ?? '',
        ),
    ),
  );
});

void test('long-run peaks wait for race preparation and recovery reduces the executable long run', () => {
  const p = makePlan(
    input({ raceDate: addDays(start, 167), longestKm: 24 }),
    start,
  );
  const longs = runs(p).filter((w) => w.kind === 'long');
  for (const [i, w] of longs.entries()) {
    const gap = dayDiff(w.date, p.profile.raceDate);
    if (gap > 84) assert.ok(w.estimatedKm <= 26.001);
    else if (gap > 56) assert.ok(w.estimatedKm <= 28.001);
    assert.ok(Number.isInteger(w.estimatedKm));
    assert.ok(w.estimatedKm <= 35);
    const prior = longs
      .slice(0, i)
      .filter((s) => p.weeks[s.week].phase !== 'Recovery');
    if (p.weeks[w.week].phase === 'Recovery' && prior.length)
      assert.ok(w.minutes <= prior.at(-1).minutes * 0.8 + 0.01);
  }
  assert.ok(longs.some((w) => w.estimatedKm >= 30));
  const ordinary = longs.filter(
    (w) =>
      !['Recovery', 'Taper', 'Race week'].includes(p.weeks[w.week].phase) &&
      taperFactor(p.profile, w.date) === 1,
  );
  for (let i = 1; i < ordinary.length; i++)
    assert.ok(ordinary[i].estimatedKm >= ordinary[i - 1].estimatedKm);
});

void test('post-allocation long-run growth uses the recent executable prescription', () => {
  for (const weekdayMinutes of [60, 90, 120]) {
    const p = makePlan(
      input({ weeklyKm: 85, longestKm: 30, weekdayMinutes, longMinutes: 240 }),
      start,
    );
    const longs = runs(p).filter((w) => w.kind === 'long');
    for (const [i, w] of longs.entries()) {
      const recent = longs
        .slice(0, i)
        .filter((s) => dayDiff(s.date, w.date) <= 30);
      const base = dayDiff(start, w.date) <= 30 ? 30 : 0;
      const prior = Math.max(base, 0, ...recent.map((s) => s.estimatedKm));
      assert.ok(w.estimatedKm <= Math.min(35, Math.floor(prior) + 2) + 0.01);
    }
  }
});

void test('a taper boundary does not reduce or relabel sessions before the 21-day window', () => {
  const p = makePlan(input(), start);
  const boundary = p.weeks.find(
    (w) => dayDiff(w.start, p.profile.raceDate) === 27,
  );
  assert.equal(boundary.phase, 'Race preparation');
  assert.equal(
    trainingPhaseOn(p.profile, boundary.phase, boundary.start),
    'Race preparation',
  );
  assert.equal(
    trainingPhaseOn(
      p.profile,
      boundary.phase,
      addDays(p.profile.raceDate, -20),
    ),
    'Taper',
  );
  assert.equal(taperFactor(p.profile, addDays(p.profile.raceDate, -20)), 0.75);
  const refreshed = refreshWorkoutVariety(p, start);
  for (const w of runs(p).filter((w) => taperFactor(p.profile, w.date) < 1))
    assert.deepEqual(
      refreshed.workouts.find((s) => s.id === w.id),
      w,
    );
});

void test('continuous marathon long-run recipes export and shorten without losing endurance identity', () => {
  const p = makePlan(
    input({ raceDate: addDays(start, 125), weeklyKm: 80 }),
    start,
  );
  const split = p.workouts.find((w) => w.kind === 'long' && w.hard);
  assert.ok(split);
  assert.ok(split.steps.some((s) => s.kind === 'aerobic'));
  assert.equal(split.steps.filter((s) => s.kind === 'work').length, 1);
  assert.ok(!split.steps.some((s) => s.kind === 'recovery'));
  assert.ok(encodeWorkout(split).length > 100);
  for (const minutes of [120, 80, 30]) {
    const next = shortenWorkout(p, split.id, minutes, start);
    const w = next.workouts.find((s) => s.id === split.id);
    assert.equal(w.kind, 'long');
    assert.ok(qualityWorkMinutes(w) <= qualityWorkMinutes(split));
    assert.ok(w.minutes <= minutes);
    assert.ok(encodeWorkout(w).length > 100);
    assert.deepEqual(validatePlan(next), []);
  }
});

void test('inadequate baseline explains why more available time cannot make this model fit', () => {
  assert.throws(
    () =>
      makePlan(
        input({
          weeklyKm: 32,
          longestKm: 12,
          currentRuns: 4,
          runsPerWeek: 4,
          intent: 'finish',
          weekdayMinutes: 120,
          longMinutes: 300,
        }),
        start,
      ),
    /current baseline.*volume limits.*base-building plan/i,
  );
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makePlan,
  demoProfile,
  addDays,
  TRAINING_POLICY,
  revisePreferences,
  ENGINE_VERSION,
} from '../lib/engine.ts';
import { suggestedSessionLimits } from '../lib/training-structure.ts';
import { weeklyRhythm } from '../lib/weekly-rhythm.ts';
import {
  validWorkoutEnjoyment,
  mergeWorkoutEnjoyment,
} from '../lib/workout-enjoyment.ts';
import { validateRecovery } from '../lib/recovery.ts';
const start = '2026-09-07';
const base = {
  ...demoProfile(start),
  goal: 'marathon',
  raceDate: addDays(start, 139),
  weeklyKm: 70,
  longestKm: 30,
  currentRuns: 5,
  days: [0, 1, 2, 4, 6],
  longDay: 6,
  easyPace: 5.5,
  weekdayMinutes: 90,
  longMinutes: 200,
  recentQualitySessions: 2,
  recentQualityMinutes: 40,
  qualitySessions: 2,
};
void test('suggested limits accommodate the declared routine and future race preparation without adding volume', () => {
  assert.deepEqual(suggestedSessionLimits(base, 32), {
    weekdayMinutes: 65,
    longMinutes: 180,
  });
  assert.deepEqual(
    suggestedSessionLimits({
      weeklyKm: 0,
      longestKm: 0,
      currentRuns: 0,
      easyPace: null,
    }),
    { weekdayMinutes: 20, longMinutes: 30 },
  );
  for (const [goal, weeklyKm, longestKm] of [
    ['half', 30, 10],
    ['marathon', 45, 18],
  ]) {
    const p = {
      ...base,
      goal,
      weeklyKm,
      longestKm,
      easyPace: 6,
      qualitySessions: 1,
      recentQualitySessions: 1,
      recentQualityMinutes: 20,
    };
    const limits = suggestedSessionLimits(
      p,
      TRAINING_POLICY.family[goal].longCeilingKm,
    );
    assert.doesNotThrow(() => makePlan({ ...p, ...limits }, start));
    assert.ok(limits.longMinutes > longestKm * 6);
  }
});
void test('weekly rhythm counts actual days, strides, mixed longs, doubles and races without double counting', () => {
  const p = makePlan(base, start),
    mixed = p.workouts.find((w) => w.kind === 'long' && w.hard);
  assert.ok(mixed);
  const r = weeklyRhythm(p, mixed.week);
  assert.equal(r.days, 5);
  assert.equal(r.sessions, 5);
  assert.equal(r.quality, 1);
  assert.equal(r.long, 1);
  assert.equal(r.easy, 3);
  assert.equal(r.keySessions.length, 2);
  assert.equal(new Set(r.keySessions.map((w) => w.id)).size, 2);
  assert.equal(r.marathonMinutes, mixed.qualityMinutes);
  const copy = structuredClone(p),
    extra = structuredClone(
      copy.workouts.find((w) => w.week === mixed.week && w.kind === 'easy'),
    );
  extra.id += ':pm';
  copy.workouts.push(extra);
  assert.equal(weeklyRhythm(copy, mixed.week).days, 5);
  assert.equal(weeklyRhythm(copy, mixed.week).sessions, 6);
  extra.status = 'skipped';
  assert.equal(weeklyRhythm(copy, mixed.week).sessions, 5);
  const race = copy.workouts.find((w) => w.kind === 'race');
  assert.equal(weeklyRhythm(copy, race.week).race, 1);
  assert.equal(
    weeklyRhythm(copy, race.week).minutes,
    copy.workouts
      .filter((w) => w.week === race.week && w.kind !== 'race')
      .reduce((n, w) => n + w.minutes, 0),
  );
});
void test('optional enjoyment is explicit, preserves old-client corrections, and allows deliberate clearing', () => {
  for (const value of ['yes', 'maybe', 'no'])
    assert.equal(validWorkoutEnjoyment(value), true);
  for (const value of [true, 1, {}, [], null, 'great', ''])
    assert.equal(validWorkoutEnjoyment(value), false);
  assert.equal(mergeWorkoutEnjoyment(undefined, 'yes'), 'yes');
  assert.equal(mergeWorkoutEnjoyment(null, 'yes'), undefined);
  assert.equal(mergeWorkoutEnjoyment('no', 'yes'), 'no');
  assert.throws(() => mergeWorkoutEnjoyment('great'));
});
void test('enjoyment survives recovery and malformed ratings are rejected without mutating the backup', () => {
  const plan = makePlan(base, start),
    w = plan.workouts[0];
  w.status = 'completed';
  w.feedback = {
    effort: 3,
    feeling: 'tired',
    actualMinutes: w.minutes,
    actualKm: w.estimatedKm,
    note: 'Synthetic feedback',
    recordedAt: start + 'T18:00:00Z',
    actualDate: start,
    enjoyment: 'yes',
  };
  const file = {
    format: 'stride-recovery-2',
    exportedAt: start + 'T19:00:00Z',
    profile: null,
    plan,
  };
  assert.equal(
    validateRecovery(file).plan.workouts[0].feedback.enjoyment,
    'yes',
  );
  const bad = structuredClone(file);
  bad.plan.workouts[0].feedback.enjoyment = 'garbage';
  const before = structuredClone(bad);
  assert.throws(() => validateRecovery(bad), /enjoyment/);
  assert.deepEqual(bad, before);
  delete file.plan.workouts[0].feedback.enjoyment;
  assert.doesNotThrow(() => validateRecovery(file));
});

void test('reviewing unchanged preferences upgrades a legacy policy and preserves completed and past runs', () => {
  const plan = makePlan(base, start);
  plan.policyVersion = 'provisional-2026-09-08-v9';
  plan.engineVersion = 'stride-0.6.1';
  const first = plan.workouts[0];
  first.status = 'completed';
  first.feedback = {
    effort: 3,
    feeling: 'good',
    actualMinutes: first.minutes,
    actualKm: first.estimatedKm,
    note: 'Synthetic preserved history',
    recordedAt: start + 'T18:00:00Z',
    actualDate: start,
  };
  const asOf = addDays(start, 2),
    before = structuredClone(plan);
  const past = plan.workouts.filter((w) => w.date < asOf);
  const next = revisePreferences(plan, {}, asOf);
  assert.equal(next.policyVersion, TRAINING_POLICY.version);
  assert.equal(next.engineVersion, ENGINE_VERSION);
  assert.equal(next.id, plan.id);
  assert.deepEqual(
    next.workouts.filter((w) => w.date < asOf),
    past,
  );
  assert.ok(
    next.workouts.some(
      (w) => w.date >= asOf && w.changeSource === 'preferences',
    ),
  );
  assert.deepEqual(plan, before);
});
void test('unchanged preferences on the current policy remain a true no-op', () => {
  const plan = makePlan(base, start);
  assert.deepEqual(revisePreferences(plan, {}, start), plan);
  plan.engineVersion = 'stride-0.7.0';
  assert.deepEqual(
    revisePreferences(plan, {}, start),
    plan,
    'A runtime-only patch does not require rebuilding the same training policy',
  );
});

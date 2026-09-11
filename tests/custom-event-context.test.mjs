import test from 'node:test';
import assert from 'node:assert/strict';
import { Decoder, Stream } from '@garmin/fitsdk';
import {
  makePlan,
  demoProfile,
  addDays,
  validatePlan,
  shortenWorkout,
  workoutAlternatives,
  substituteWorkout,
  refreshWorkoutVariety,
} from '../lib/engine.ts';
import { specificWorkoutName, customRaceName } from '../lib/workout-names.ts';
import { withWorkoutEventContext } from '../lib/workout-event-context.ts';
import {
  withWorkoutTargets,
  updateWorkoutTargets,
} from '../lib/workout-targets.ts';
import { intervalsWorkoutText } from '../lib/intervals-workout.ts';
import { encodeWorkout } from '../lib/fit.ts';
import { validateRecovery } from '../lib/recovery.ts';

const start = '2026-09-11';
const config = (distance, mode = 'pace') => ({
  mode,
  raceScope: `custom:${distance}`,
  pace: {
    easy: { low: 360, high: 420 },
    steady: { low: 320, high: 340 },
    race: { low: 290, high: 310 },
  },
  heartRate: {
    easy: { low: 130, high: 145 },
    steady: { low: 145, high: 155 },
    race: { low: 155, high: 165 },
  },
});
const profile = (distance, mode = 'pace') => ({
  ...demoProfile(start),
  goal: 'custom',
  raceDistanceKm: distance,
  weeklyKm: 60,
  longestKm: 22,
  currentRuns: 5,
  runsPerWeek: 5,
  availableDays: [0, 1, 2, 3, 4, 5, 6],
  days: [0, 1, 2, 3, 5],
  longDay: 5,
  recentQualitySessions: 2,
  recentQualityMinutes: 32,
  intent: 'improve',
  weekdayMinutes: 90,
  longMinutes: 210,
  easyPace: 6,
  raceDate: addDays(start, 125),
  runMeasure: 'time',
  workoutFormat: 'time',
  workoutTargets: config(distance, mode),
});
const customPlan = (d = 15, mode = 'pace') =>
  makePlan(profile(d, mode), start, false);
const specific = (p) =>
  p.workouts.filter((w) => w.stimulus === 'race-rhythm' && w.kind !== 'race');
const numerical = (w) => ({
  date: w.date,
  minutes: w.minutes,
  estimatedKm: w.estimatedKm,
  qualityMinutes: w.qualityMinutes,
  targetWorkMinutes: w.targetWorkMinutes,
  steps: w.steps.map(({ label, effort, ...numbers }) => numbers),
});

for (const distance of [
  5, 7.5, 7.5001, 8, 10, 14.9999, 15, 15.0001, 16.0934, 21.0975, 30,
]) {
  test(`${distance} km keeps the exact event identity across preparation-family boundaries`, () => {
    const plan = customPlan(distance);
    assert.deepEqual(validatePlan(plan), []);
    assert.ok(specific(plan).length > 0);
    for (const w of specific(plan)) {
      assert.equal(w.eventDistanceKm, distance);
      assert.equal(w.title, specificWorkoutName(w));
      assert.ok(
        w.title.toLowerCase().includes(customRaceName(distance).toLowerCase()),
        w.title,
      );
      const work = w.steps.filter((s) => s.kind === 'work');
      assert.ok(work.length);
      for (const s of work)
        assert.deepEqual(s.target, { mode: 'pace', low: 290, high: 310 });
      if (![10, 21.0975].includes(distance))
        assert.doesNotMatch(
          JSON.stringify([
            w.title,
            w.purpose,
            w.reason,
            ...work.map((s) => s.effort),
          ]),
          /\b10K\b|half-marathon/,
        );
    }
    assert.equal(
      plan.workouts.find((w) => w.kind === 'race').steps[0].metres,
      Math.round(distance * 10000) / 10,
    );
  });
}

test('custom context changes instructions, never executable dose or known target ranges', () => {
  const plan = customPlan(),
    w = structuredClone(specific(plan)[0]);
  delete w.eventDistanceKm;
  w.title = '2 × 5 min 10K effort';
  w.purpose = 'Rehearse 10K effort in repeatable blocks.';
  w.reason = 'Familiar 10K rhythm with easy recovery.';
  w.steps = w.steps.map((s) =>
    s.kind === 'work'
      ? { ...s, effort: 'Your sustainable 10K effort · comfortably hard' }
      : s,
  );
  const before = structuredClone(w);
  const next = withWorkoutEventContext(w, plan.profile);
  assert.deepEqual(w, before);
  assert.deepEqual(numerical(next), numerical(before));
  assert.deepEqual(withWorkoutEventContext(next, plan.profile), next);
  assert.match(next.purpose, /15K/);
  assert.ok(
    next.steps
      .filter((s) => s.kind === 'work')
      .every((s) => s.effort.includes('15K')),
  );
  const changed = withWorkoutTargets(next, {
    ...plan.profile,
    raceDistanceKm: 16.0934,
  });
  assert.match(changed.title, /10-mile effort/);
  assert.doesNotMatch(
    JSON.stringify([changed.purpose, changed.reason, changed.steps]),
    /15K|half-marathon/,
  );
  assert.ok(
    changed.steps.filter((s) => s.kind === 'work').every((s) => !s.target),
    'the old custom-race target scope must not transfer to a different event',
  );
});

for (const mode of ['effort', 'pace', 'heart-rate']) {
  test(`${mode} custom instructions and Garmin export agree without guessing a target`, () => {
    const plan = customPlan(15, mode),
      w = specific(plan)[0];
    const decoded = new Decoder(Stream.fromByteArray(encodeWorkout(w))).read();
    assert.deepEqual(decoded.errors, []);
    assert.match(decoded.messages.workoutMesgs[0].wktName, /15K effort/);
    for (let i = 0; i < w.steps.length; i++) {
      const step = w.steps[i],
        exported = decoded.messages.workoutStepMesgs[i];
      assert.equal(exported.durationTime, step.seconds);
      assert.equal(exported.notes, step.effort);
      assert.equal(
        exported.targetType,
        mode === 'effort' || !step.target
          ? 'open'
          : mode === 'pace'
            ? 'speed'
            : 'heartRate',
      );
      if (step.kind === 'work' && mode === 'heart-rate') {
        assert.equal(exported.customTargetHeartRateLow, 255);
        assert.equal(exported.customTargetHeartRateHigh, 265);
      }
    }
    if (mode !== 'heart-rate') {
      const text = intervalsWorkoutText(w);
      assert.doesNotMatch(text, /10K|half-marathon/);
      assert.match(text, /15K effort/);
      assert.match(text, mode === 'pace' ? /4:50-5:10\/km Pace/ : /freeride/);
    }
  });
}

test('shortening, substitution and workout refresh retain custom identity', () => {
  const plan = customPlan(16.0934),
    w = specific(plan).find((w) => workoutAlternatives(plan, w.id).length);
  assert.ok(w);
  const options = workoutAlternatives(plan, w.id);
  assert.ok(
    options.every((t) => !/half-marathon/i.test(t.title + t.purpose + t.cue)),
  );
  const alternative = substituteWorkout(
    plan,
    w.id,
    options[0].id,
    start,
  ).workouts.find((x) => x.id === w.id);
  assert.match(alternative.title, /10-mile effort/);
  assert.equal(alternative.title, specificWorkoutName(alternative));
  const shortened = shortenWorkout(
    plan,
    w.id,
    Math.floor(w.minutes - 2),
    start,
  ).workouts.find((x) => x.id === w.id);
  assert.match(shortened.title, /10-mile effort/);
  assert.ok(shortened.minutes <= w.minutes);
  const refreshed = refreshWorkoutVariety(plan, start);
  for (const session of specific(refreshed)) {
    assert.equal(session.eventDistanceKm, 16.0934);
    assert.ok(session.title.includes('10-mile'));
    assert.doesNotMatch(
      JSON.stringify([session.purpose, session.steps]),
      /half-marathon/,
    );
  }
});

test('explicit target review preserves completed, elapsed and delivery-protected snapshots', () => {
  const plan = customPlan(),
    runs = specific(plan);
  runs[0].status = 'completed';
  const from = runs[2].date,
    protectedId = runs[3].id;
  const before = structuredClone(plan);
  const next = updateWorkoutTargets(plan, config(15, 'effort'), from, [
    protectedId,
  ]);
  assert.deepEqual(plan, before);
  for (const w of next.workouts)
    if (w.status === 'completed' || w.date < from || w.id === protectedId)
      assert.deepEqual(
        w,
        before.workouts.find((x) => x.id === w.id),
      );
});

test('gentle custom work stays steady instead of receiving the race target', () => {
  const plan = customPlan(),
    w = structuredClone(specific(plan)[0]);
  w.steps = w.steps.map((s) =>
    s.kind === 'work'
      ? {
          ...s,
          intensity: 5,
          effort: 'Steady and comfortable · 5–6 / 10',
        }
      : s,
  );
  const next = withWorkoutTargets(w, plan.profile);
  assert.match(next.title, /steady efforts/);
  for (const s of next.steps.filter((s) => s.kind === 'work'))
    assert.deepEqual(s.target, { mode: 'pace', low: 320, high: 340 });
});

test('standard events and ultra guidance keep their existing instructions', () => {
  const w = structuredClone(specific(customPlan())[0]);
  delete w.eventDistanceKm;
  for (const goal of ['5k', '10k', 'half', 'marathon', 'ultra', 'base'])
    assert.deepEqual(withWorkoutEventContext(w, { ...profile(15), goal }), w);
  for (const distance of [1, 4.9999, 30.0001, 42.195, 45, 45.0001, 50])
    assert.deepEqual(withWorkoutEventContext(w, profile(distance)), w);
});

test('automatic-format generation and measured alternatives work on both sides of the custom scope', () => {
  for (const distance of [
    1, 4.9999, 5, 8, 15, 16.0934, 30, 30.0001, 42.195, 45, 45.0001,
  ]) {
    const plan = makePlan(
      {
        ...profile(distance, 'effort'),
        weeklyKm: 70,
        longestKm: 25,
        raceDate: addDays(start, 167),
        longMinutes: 270,
        workoutFormat: 'automatic',
      },
      start,
      false,
    );
    assert.deepEqual(validatePlan(plan), []);
    for (const w of specific(plan)) {
      assert.doesNotThrow(() => workoutAlternatives(plan, w.id));
      assert.equal(
        w.eventDistanceKm,
        distance >= 5 && distance <= 30 ? distance : undefined,
      );
    }
  }
});

test('backup validation retains exact event context and rejects malformed context', () => {
  const plan = customPlan();
  const file = {
    format: 'stride-recovery-2',
    exportedAt: start + 'T18:00:00Z',
    profile: null,
    plan,
  };
  const restored = validateRecovery(file);
  assert.deepEqual(
    specific(restored.plan).map((w) => w.eventDistanceKm),
    specific(plan).map((w) => w.eventDistanceKm),
  );
  for (const bad of [NaN, -1, 100, '15']) {
    const invalid = structuredClone(file);
    specific(invalid.plan)[0].eventDistanceKm = bad;
    assert.throws(() => validateRecovery(invalid), /workout event distance/);
  }
});

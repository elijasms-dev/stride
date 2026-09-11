import test from 'node:test';
import assert from 'node:assert/strict';
import { Decoder, Stream } from '@garmin/fitsdk';
import {
  demoProfile,
  makePlan,
  validatePlan,
  workoutDistanceLabel,
  workoutDistanceValue,
} from '../lib/engine.ts';
import {
  prescribedDistanceKm,
  withRunDistance,
  updateRunMeasure,
} from '../lib/run-distance.ts';
import {
  withWorkoutTargets,
  updateWorkoutTargets,
} from '../lib/workout-targets.ts';
import { resizeWorkout } from '../lib/workout-library.ts';
import { intervalsWorkoutText } from '../lib/intervals-workout.ts';
import { encodeWorkout } from '../lib/fit.ts';

const start = '2026-09-07';
const profile = { ...demoProfile(start), runMeasure: 'distance' };
function longRun(km = 23, patch = {}) {
  return {
    id: 'synthetic-distance',
    date: '2026-09-12',
    originalDate: '2026-09-12',
    week: 0,
    kind: 'long',
    title: 'Long aerobic run',
    status: 'planned',
    minutes: km * 6,
    estimatedKm: km,
    hard: false,
    purpose: 'Aerobic endurance',
    reason: 'Keep the effort comfortable.',
    steps: [
      {
        kind: 'work',
        label: 'Long run',
        seconds: km * 360,
        intensity: 3,
        effort: 'Conversational · 2–3 / 10',
      },
    ],
    ...patch,
  };
}
for (const km of [20, 23]) {
  void test(`${km} km long runs have real distance endpoints in the app, Intervals and FIT`, () => {
    const original = longRun(km),
      run = withRunDistance(original, profile);
    assert.equal(prescribedDistanceKm(run), km);
    assert.equal(run.estimatedKm, km);
    assert.equal(workoutDistanceLabel(run, profile), `${km} km`);
    assert.match(run.title, new RegExp(`^${km} km · Long`));
    assert.match(intervalsWorkoutText(run), new RegExp(`${km * 1000}mtr`));
    const decoded = new Decoder(
      Stream.fromByteArray(encodeWorkout(run)),
    ).read();
    assert.deepEqual(decoded.errors, []);
    assert.equal(decoded.messages.workoutStepMesgs[0].durationType, 'distance');
    assert.equal(
      decoded.messages.workoutStepMesgs[0].durationDistance,
      km * 1000,
    );
    assert.equal(original.steps[0].metres, undefined);
  });
}
void test('only wholly prescribed, positive finite step distances count as exact', () => {
  for (const steps of [
    [],
    [{ seconds: 60 }],
    [{ metres: 1000 }, { seconds: 60 }],
    [{ metres: NaN }],
    [{ metres: Infinity }],
    [{ metres: 0 }],
    [{ metres: -1 }],
  ])
    assert.equal(prescribedDistanceKm({ steps }), null);
  assert.equal(
    prescribedDistanceKm({ steps: [{ metres: 2000 }, { metres: 3000 }] }),
    5,
  );
});
void test('rounding fits every step, never adds distance or time, and is idempotent', () => {
  for (let minutes = 15; minutes <= 210; minutes += 7) {
    const before = longRun(minutes / 6, {
      minutes,
      steps: [
        {
          kind: 'work',
          label: 'Long run',
          seconds: minutes * 60,
          intensity: 3,
          effort: 'Easy',
        },
      ],
    });
    const after = withRunDistance(before, profile);
    assert.ok(after.estimatedKm <= before.estimatedKm);
    assert.equal(after.minutes, before.minutes);
    assert.ok(
      after.steps.every(
        (s) => (s.metres * s.planningPaceSecondsPerKm) / 1000 <= s.seconds,
      ),
    );
    assert.deepEqual(withRunDistance(after, profile), after);
  }
});
void test('new plans default to distance without changing running dates or prescribed intensity', () => {
  const timed = makePlan({ ...profile, runMeasure: 'time' }, start);
  const automatic = makePlan(demoProfile(start), start);
  assert.equal(automatic.profile.runMeasure, 'distance');
  assert.deepEqual(validatePlan(automatic), []);
  assert.deepEqual(
    automatic.workouts.map((w) => [w.date, w.kind, w.minutes, w.hard]),
    timed.workouts.map((w) => [w.date, w.kind, w.minutes, w.hard]),
  );
  assert.ok(
    automatic.workouts.some(
      (w) => w.kind === 'long' && prescribedDistanceKm(w) !== null,
    ),
  );
  assert.ok(
    timed.workouts
      .filter((w) => w.kind !== 'race')
      .every((w) => w.steps.every((s) => s.metres === undefined)),
  );
});
void test('a distance target needs no invented numerical pace alert', () => {
  const p = { ...profile, easyPace: null, workoutTargets: { mode: 'effort' } };
  const run = withWorkoutTargets(longRun(20), p);
  assert.ok(prescribedDistanceKm(run) > 0);
  assert.ok(run.steps.every((s) => !s.target));
  const plan = makePlan(p, start);
  assert.deepEqual(validatePlan(plan), []);
  assert.ok(
    plan.workouts
      .filter((w) => prescribedDistanceKm(w) === null)
      .every((w) => w.distanceEstimate.lowerKm === null),
  );
});
void test('run-walk, returns, recoveries, hills and double threshold retain their format', () => {
  for (const patch of [
    { kind: 'interval' },
    { returnRole: 'long' },
    { pairType: 'double-threshold' },
    { templateId: 'hill-long' },
    {
      steps: [
        {
          seconds: 120,
          metres: undefined,
          kind: 'recovery',
          intensity: 1,
          effort: 'Walk',
        },
      ],
    },
    {
      steps: [
        {
          seconds: 120,
          kind: 'work',
          movement: 'walk',
          intensity: 1,
          effort: 'Walk',
        },
      ],
    },
  ]) {
    const before = longRun(20, patch);
    assert.deepEqual(withRunDistance(before, profile), before);
  }
});
void test('slower pace targets shrink distance, preserve time and refresh weekly totals', () => {
  const before = makePlan(profile, start);
  const after = updateWorkoutTargets(
    before,
    { mode: 'pace', pace: { easy: { low: 570, high: 600 } } },
    start,
  );
  assert.deepEqual(validatePlan(after), []);
  for (const week of after.weeks) {
    const sum = after.workouts
      .filter(
        (w) =>
          w.week === week.index && w.kind !== 'race' && w.status !== 'skipped',
      )
      .reduce((n, w) => n + w.estimatedKm, 0);
    assert.equal(week.targetKm, Math.round(sum * 10) / 10);
  }
  for (const w of after.workouts.filter(
    (w) => prescribedDistanceKm(w) !== null && w.kind !== 'race',
  )) {
    const old = before.workouts.find((s) => s.id === w.id);
    assert.equal(w.minutes, old.minutes);
    assert.ok(w.estimatedKm <= old.estimatedKm);
    assert.ok(
      w.steps.every(
        (s) => (s.metres * s.planningPaceSecondsPerKm) / 1000 <= s.seconds,
      ),
    );
  }
});
void test('short easy runs assign the same HR alerts on repeated target updates', () => {
  const p = {
    ...profile,
    easyPace: 7,
    workoutTargets: {
      mode: 'heart-rate',
      heartRate: { easy: { low: 130, high: 150 } },
    },
  };
  const run = longRun(5 / 7, {
    kind: 'easy',
    minutes: 5,
    steps: [
      {
        kind: 'work',
        label: 'Easy run',
        seconds: 300,
        intensity: 3,
        effort: 'Easy',
      },
    ],
  });
  const first = withWorkoutTargets(run, p);
  assert.deepEqual(withWorkoutTargets(first, p), first);
});
void test('shortening a distance run keeps a shorter distance endpoint', () => {
  const before = withRunDistance(longRun(23), profile);
  const after = resizeWorkout(before, profile, 'Build', 90);
  assert.ok(prescribedDistanceKm(after) > 0);
  assert.ok(prescribedDistanceKm(after) < prescribedDistanceKm(before));
  assert.equal(after.minutes, 90);
  assert.equal(after.estimatedKm, prescribedDistanceKm(after));
});
void test('structured long-run names follow the actual distance and timed work steps', () => {
  const w = longRun(20, {
    templateId: 'marathon-long-finish',
    stimulus: 'race-rhythm',
    hard: true,
    title: 'Progression long run · 20 min marathon effort',
    steps: [
      {
        kind: 'aerobic',
        label: 'Easy',
        seconds: 6000,
        intensity: 3,
        effort: 'Easy',
      },
      {
        kind: 'work',
        label: 'Race rhythm',
        seconds: 1200,
        intensity: 5,
        effort: 'Marathon effort',
      },
    ],
  });
  const measured = withRunDistance(w, profile);
  assert.match(
    measured.title,
    /[\d.]+ km · Progression long run · [\d.]+ km marathon effort/,
  );
  assert.doesNotMatch(measured.title, /min/);
  const plan = { profile, workouts: [measured], weeks: [], notes: [] };
  const timed = updateRunMeasure(plan, 'time', start).workouts[0];
  assert.match(timed.title, /20 min marathon effort/);
  assert.doesNotMatch(timed.title, /km/);
});
void test('time conversion restores duration-based mileage without cumulative rounding loss', () => {
  const original = longRun(119 / 6);
  const plan = { profile, workouts: [original], weeks: [], notes: [] };
  const distance = updateRunMeasure(plan, 'distance', start);
  const timed = updateRunMeasure(distance, 'time', start);
  assert.equal(timed.workouts[0].estimatedKm, 19.833);
  assert.deepEqual(updateRunMeasure(timed, 'distance', start), distance);
});
void test('migration preserves past, manual, recorded, archived and delivered sessions', () => {
  const original = makePlan({ ...profile, runMeasure: 'time' }, start);
  const eligible = original.workouts.filter((w) =>
    ['easy', 'long'].includes(w.kind),
  );
  eligible[1].changed = true;
  eligible[1].changeSource = 'manual';
  eligible[2].status = 'completed';
  eligible[3].week = -1;
  const protectedIds = [eligible[4].id];
  const snapshot = structuredClone(original);
  const after = updateRunMeasure(
    original,
    'distance',
    eligible[1].date,
    protectedIds,
  );
  assert.deepEqual(original, snapshot);
  for (const old of eligible.slice(0, 5))
    assert.deepEqual(
      after.workouts.find((w) => w.id === old.id),
      old,
    );
  assert.ok(
    after.workouts.some(
      (w) => w.kind === 'long' && prescribedDistanceKm(w) !== null,
    ),
  );
  assert.deepEqual(
    updateRunMeasure(after, 'distance', eligible[1].date, protectedIds),
    after,
  );
});
void test('exact distance survives JSON restore and mile display has no estimated range', () => {
  const run = JSON.parse(JSON.stringify(withRunDistance(longRun(23), profile)));
  assert.equal(prescribedDistanceKm(run), 23);
  assert.equal(workoutDistanceValue(run, { units: 'mi' }), '14.3');
  assert.equal(workoutDistanceLabel(run, { units: 'mi' }), '14.3 mi');
});
void test('invalid run measurement inputs are rejected', () => {
  for (const runMeasure of ['yards', '', 1])
    assert.throws(() => makePlan({ ...profile, runMeasure }, start));
});

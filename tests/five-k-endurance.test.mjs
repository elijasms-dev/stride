import test from 'node:test';
import assert from 'node:assert/strict';
import { Decoder, Stream } from '@garmin/fitsdk';
import {
  addDays,
  demoProfile,
  makePlan,
  revisePreferences,
  validatePlan,
  weekday,
} from '../lib/engine.ts';
import { fiveKEnduranceCeiling } from '../lib/five-k-endurance.ts';
import { longRunShareLimit } from '../lib/training-structure.ts';
import { encodeWorkout } from '../lib/fit.ts';

const start = '2026-09-14';
const inputs = (patch = {}) => ({
  ...demoProfile(start),
  name: 'Synthetic 5K endurance runner',
  goal: '5k',
  raceDate: addDays(start, 83),
  weeklyKm: 60,
  longestKm: 16,
  currentRuns: 5,
  runsPerWeek: 5,
  availableDays: [0, 1, 2, 3, 4, 5, 6],
  days: [0, 1, 2, 3, 5],
  longDay: 5,
  easyPace: 5.5,
  weekdayMinutes: 90,
  longMinutes: 120,
  recentQualitySessions: 2,
  recentQualityMinutes: 35,
  volume: 'maintain',
  ...patch,
});
const make = (patch = {}) => makePlan(inputs(patch), start);
const longs = (plan) => plan.workouts.filter((w) => w.kind === 'long');
const running = (plan, index) =>
  plan.workouts.filter((w) => w.week === index && w.kind !== 'race');
const total = (runs) => runs.reduce((n, w) => n + w.minutes, 0);

test('established 5K runners retain familiar endurance within their existing weekly workload', () => {
  const profile = inputs();
  const before = structuredClone(profile);
  const plan = makePlan(profile, start);
  assert.deepEqual(profile, before);
  assert.deepEqual(validatePlan(plan), []);
  assert.equal(longs(plan)[0].estimatedKm, 16);
  assert.equal(longs(plan)[0].minutes, 88);
  assert.match(longs(plan)[0].title, /^16 km/);
  assert.match(longs(plan)[0].purpose, /5K/);
  assert.match(longs(plan)[0].purpose, /without a fast finish/);
  assert.ok(plan.notes.some((n) => n.startsWith('5K endurance keeps')));
  for (const week of plan.weeks) {
    const runs = running(plan, week.index);
    assert.ok(total(runs) <= profile.weeklyKm * profile.easyPace);
    assert.ok(new Set(runs.map((w) => w.date)).size <= 5);
    for (const w of longs(plan).filter((w) => w.week === week.index)) {
      assert.ok(w.minutes <= total(runs) * longRunShareLimit(plan.profile));
      assert.ok(!w.hard && w.qualityMinutes === 0);
      assert.ok(w.steps.every((s) => s.intensity <= 3));
    }
  }
});

test('a longer block or gradual volume does not extend the retained allowance beyond the familiar run', () => {
  for (const days of [20, 55, 83, 195, 363]) {
    const plan = make({ raceDate: addDays(start, days), volume: 'gradual' });
    assert.deepEqual(validatePlan(plan), []);
    assert.ok(longs(plan).every((w) => w.estimatedKm <= 16 && w.minutes <= 88));
  }
});

test('a declared familiar long distance is retained without extending it toward a generic time target', () => {
  for (const [easyPace, longestKm, maximum] of [
    [5, 18, 90],
    [6, 14, 84],
    [6.5, 16, 104],
    [5, 12, 60],
  ]) {
    const plan = make({ easyPace, longestKm, runMeasure: 'time' });
    assert.equal(longs(plan)[0].estimatedKm, longestKm);
    assert.equal(longs(plan)[0].minutes, maximum);
    assert.ok(longs(plan).every((w) => w.minutes <= maximum));
  }
});

test('unknown pace, new or returning runners and other event families do not gain the extension', () => {
  const baseline = { longestKm: 16, longestMinutes: 88, currentRuns: 5 };
  for (const patch of [
    { easyPace: null },
    { easyPace: NaN },
    { easyPace: 0 },
    { experience: 'new' },
    { experience: 'returning' },
    ...['base', '10k', 'half', 'marathon', 'ultra'].map((goal) => ({ goal })),
    ...[4.9999, 5, 7.5, 7.5001, 15].map((raceDistanceKm) => ({
      goal: 'custom',
      raceDistanceKm,
    })),
  ])
    assert.equal(fiveKEnduranceCeiling(inputs(patch), 11, baseline), 11);
  for (const patch of [{ easyPace: null }, { experience: 'returning' }]) {
    const plan = make(patch);
    assert.equal(longs(plan)[0].estimatedKm, 16);
    assert.ok(longs(plan).every((w) => w.estimatedKm <= 16));
  }
});

test('availability changes preserve the declared long baseline without manufacturing current running history', () => {
  const plan = make({ currentRuns: 3, runsPerWeek: 4 });
  assert.equal(plan.profile.currentRuns, 3);
  assert.equal(longs(plan)[0].estimatedKm, 16);
  assert.ok(longs(plan).every((w) => w.estimatedKm <= 16));
  plan.policyVersion = 'provisional-2026-09-10-v16';
  const reviewed = revisePreferences(plan, {}, addDays(start, 2));
  assert.ok(longs(reviewed).every((w) => w.estimatedKm <= 16));
  assert.equal(reviewed.profile.currentRuns, 3);
  assert.equal(
    fiveKEnduranceCeiling(inputs({ currentRuns: 3 }), 11, {
      longestKm: 16,
      longestMinutes: 88,
      currentRuns: 3,
    }),
    11,
  );
  for (const runsPerWeek of [2, 3]) {
    assert.throws(() => make({ runsPerWeek }), /starting weekly distance/);
    const p = revisePreferences(make(), { runsPerWeek }, start);
    assert.ok(longs(p).every((w) => w.estimatedKm <= 16));
    assert.ok(
      p.workouts.every(
        (w) => w.kind === 'race' || p.profile.days.includes(weekday(w.date)),
      ),
    );
    if (runsPerWeek === 2) assert.equal(longs(p).length, 0);
  }
});

test('a shorter baseline retains the ordinary progression ceiling rather than inheriting an advanced target', () => {
  const plan = make({ longestKm: 8, volume: 'gradual' });
  assert.equal(longs(plan)[0].estimatedKm, 8);
  assert.ok(longs(plan).every((w) => w.estimatedKm <= 11));
  assert.ok(!plan.notes.some((n) => n.startsWith('5K endurance keeps')));
});

test('session, weekly, per-day and distance limits constrain executable long runs', () => {
  for (const patch of [
    { longMinutes: 60 },
    { longLimitKm: 10 },
    { weeklyMinutesLimit: 180 },
    { dayPreferences: [{ day: 5, maxMinutes: 55 }] },
    { weekdayMinutes: 30 },
  ]) {
    assert.throws(() => make(patch), /starting weekly distance/);
    const plan = revisePreferences(make(), patch, start);
    assert.deepEqual(validatePlan(plan), []);
    for (const w of longs(plan)) {
      assert.ok(w.minutes <= (patch.longMinutes ?? 120));
      assert.ok(w.estimatedKm <= (patch.longLimitKm ?? 16));
      if (patch.dayPreferences) assert.ok(w.minutes <= 55);
      const sum = total(running(plan, w.week));
      assert.ok(sum <= (patch.weeklyMinutesLimit ?? 330));
      assert.ok(w.minutes <= sum * longRunShareLimit(plan.profile));
    }
  }
});

test('recovery, atypical race weekdays and partial starts retain lower allocations', () => {
  for (let day = 0; day < 7; day++) {
    const plan = make({
      startDate: addDays(start, day),
      raceDate: addDays(start, 77 + day),
    });
    assert.deepEqual(validatePlan(plan), []);
    assert.ok(plan.workouts.every((w) => w.date >= plan.profile.startDate));
    for (const w of longs(plan)) {
      if (plan.weeks[w.week].phase === 'Recovery')
        assert.ok(w.minutes <= 88 * 0.8);
      const remaining =
        (Date.parse(plan.profile.raceDate) - Date.parse(w.date)) / 86400000;
      if (remaining <= 14) assert.ok(w.minutes <= 60);
      assert.ok(remaining >= 8);
    }
  }
  const partial = make({ startDate: addDays(start, 3) });
  assert.ok(longs(partial)[0].minutes < 88);
});

test('same-day and short blocks do not add endurance to compensate for missing preparation', () => {
  for (const days of [0, 1, 4, 7, 13]) {
    const plan = make({ raceDate: addDays(start, days) });
    assert.deepEqual(validatePlan(plan), []);
    assert.ok(plan.workouts.every((w) => w.date <= plan.profile.raceDate));
    assert.ok(longs(plan).every((w) => w.minutes <= 60));
  }
});

test('reviewed recent distance and time supersede the old declaration even when progression is retained', () => {
  for (const preserveProgression of [true, false]) {
    const baseline = {
      from: start,
      asOf: addDays(start, 28),
      coverage: 100,
      known: 20,
      due: 20,
      weeklyKm: 60,
      weeklyMinutes: 330,
      longestKm: 13,
      longestMinutes: 71.5,
      supportsProgression: preserveProgression,
      source: 'recorded-plan-history',
      explanation: 'Synthetic reviewed baseline',
    };
    const plan = makePlan(inputs(), start, false, {
      from: baseline.asOf,
      baseline,
      preserveProgression,
      history: [],
      referenceRuns: 5,
    });
    assert.ok(longs(plan).length > 0);
    assert.ok(
      longs(plan).every((w) => w.estimatedKm <= 13 && w.minutes <= 71.5),
    );
  }
  assert.equal(
    fiveKEnduranceCeiling(inputs(), 11, {
      longestKm: 18,
      longestMinutes: 66,
      currentRuns: 5,
    }),
    12,
    'Faster actual distance does not invent more tolerated minutes',
  );
});

test('policy review preserves completed, past and manually edited workout snapshots', () => {
  const plan = make();
  plan.policyVersion = 'provisional-2026-09-10-v16';
  const completed = plan.workouts[0];
  completed.status = 'completed';
  completed.feedback = {
    effort: 3,
    feeling: 'good',
    actualMinutes: completed.minutes,
    actualKm: completed.estimatedKm,
    note: 'Synthetic saved record',
    recordedAt: start + 'T18:00:00Z',
    actualDate: start,
  };
  const manual = longs(plan)[1];
  manual.changed = true;
  manual.changeSource = 'manual';
  const before = structuredClone(plan);
  const asOf = addDays(start, 2);
  const next = revisePreferences(plan, {}, asOf);
  for (const w of before.workouts.filter(
    (w) => w.date < asOf || w.id === manual.id,
  ))
    assert.deepEqual(
      next.workouts.find((n) => n.id === w.id),
      w,
    );
  assert.deepEqual(plan, before);
  assert.deepEqual(revisePreferences(next, {}, asOf), next);
  const reduced = revisePreferences(next, { longMinutes: 100 }, asOf);
  assert.ok(longs(reduced).every((w) => w.minutes <= 88));
});

test('distance-first watch export retains the exact familiar easy distance and supplied target', () => {
  const p = make({
    workoutTargets: { mode: 'pace', pace: { easy: { low: 310, high: 330 } } },
  });
  const w = longs(p)[0];
  const { errors, messages } = new Decoder(
    Stream.fromByteArray(encodeWorkout(w)),
  ).read();
  assert.deepEqual(errors, []);
  assert.equal(
    messages.workoutStepMesgs.reduce((n, s) => n + s.durationDistance, 0),
    16000,
  );
  assert.ok(
    w.steps.every(
      (s) =>
        s.target.mode === 'pace' &&
        s.target.low === 310 &&
        s.target.high === 330,
    ),
  );
  const slower = make({
    workoutTargets: { mode: 'pace', pace: { easy: { low: 360, high: 420 } } },
  });
  assert.equal(longs(slower)[0].estimatedKm, 16);
  assert.equal(longs(slower)[0].minutes, 112);
  assert.ok(
    longs(slower).every((w) => w.minutes <= 112 && w.estimatedKm <= 16),
  );
});

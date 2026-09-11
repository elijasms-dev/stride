import test from 'node:test';
import assert from 'node:assert/strict';
import { Decoder, Stream } from '@garmin/fitsdk';
import {
  makePlan,
  demoProfile,
  shortenWorkout,
  revisePreferences,
  workoutAlternatives,
  substituteWorkout,
  validatePlan,
  rebalanceFutureQuality,
} from '../lib/engine.ts';
import {
  WORKOUT_LIBRARY,
  scaleTemplate,
  resizeWorkout,
} from '../lib/workout-library.ts';
import { withWorkoutTargets } from '../lib/workout-targets.ts';
import { qualityWorkMinutes } from '../lib/prescription.ts';
import { encodeWorkout } from '../lib/fit.ts';
import { intervalsWorkoutText } from '../lib/intervals-workout.ts';

const start = '2026-09-07';
const profile = (patch = {}) => ({
  ...demoProfile(start),
  difficulty: 'gentle',
  weeklyKm: 40,
  longestKm: 12,
  weekdayMinutes: 90,
  longMinutes: 120,
  volume: 'maintain',
  recentQualitySessions: 1,
  recentQualityMinutes: 20,
  workoutTargets: {
    mode: 'pace',
    raceScope: '10k:',
    pace: { easy: { low: 350, high: 390 }, steady: { low: 320, high: 340 } },
  },
  ...patch,
});
const make = (patch) => makePlan(profile(patch), start);
const work = (w) =>
  w.steps.filter((s) => s.kind === 'work' && s.intensity >= 4);
const target = (p) =>
  p.workouts.find(
    (w) => w.templateId === 'race-rhythm-10' && w.qualityMinutes === 10,
  );
const session = (id, cap, minutes = 60, p = profile()) => {
  const t = WORKOUT_LIBRARY.find((t) => t.id === id);
  const dose = scaleTemplate(t, minutes, true, 'Build', cap, cap, p);
  assert.ok(dose);
  return withWorkoutTargets(
    {
      id: 'synthetic-cap',
      date: '2026-10-21',
      originalDate: '2026-10-21',
      week: 6,
      status: 'planned',
      kind: t.kind,
      title: t.title,
      purpose: t.purpose,
      reason: 'Synthetic test',
      hard: t.stimulus !== 'economy',
      stimulus: t.stimulus,
      templateId: id,
      estimatedKm: dose.minutes / 6,
      ...dose,
    },
    p,
  );
};

test('a new allocation gets the gentle reduction, even when it has existing distance-resolution steps', () => {
  const t = WORKOUT_LIBRARY.find((t) => t.id === 'race-rhythm-10');
  assert.equal(
    scaleTemplate(t, 47, true, 'Race preparation', 10, 10, profile()),
    null,
  );
  const p = make(),
    w = target(p);
  assert.ok(w);
  assert.equal(
    scaleTemplate(t, 47, true, 'Race preparation', 10, 10, p.profile, w.steps),
    null,
  );
  const saved = scaleTemplate(
    t,
    47,
    true,
    'Race preparation',
    10,
    10,
    p.profile,
    w.steps,
    { capBasis: 'prescribed' },
  );
  assert.equal(saved.qualityMinutes, 10);
  assert.ok(
    saved.steps
      .filter((s) => s.kind === 'work')
      .every((s) => s.intensity === 5),
  );
});

test('unchanged and one-minute-shorter limits keep the familiar two-by-five-minute set', () => {
  const p = make(),
    w = target(p),
    before = structuredClone(w);
  assert.equal(w.minutes, 47);
  const same = resizeWorkout(w, p.profile, 'Race preparation', 47);
  assert.deepEqual(same.steps, w.steps);
  assert.equal(same.qualityMinutes, 10);
  const shorter = resizeWorkout(w, p.profile, 'Race preparation', 46);
  assert.equal(shorter.minutes, 46);
  assert.equal(shorter.qualityMinutes, 10);
  assert.deepEqual(work(shorter), work(w));
  assert.deepEqual(
    shorter.steps.filter((s) => s.kind === 'recovery'),
    w.steps.filter((s) => s.kind === 'recovery'),
  );
  assert.equal(
    shorter.steps.find((s) => s.kind === 'aerobic').seconds,
    w.steps.find((s) => s.kind === 'aerobic').seconds - 60,
  );
  assert.deepEqual(w, before);
});

test('repeated shortening keeps complete work until the whole set no longer fits', () => {
  const p = make();
  let w = target(p);
  for (const limit of [46, 45, 40, 35, 30, 27]) {
    w = resizeWorkout(w, p.profile, 'Race preparation', limit);
    assert.equal(w.minutes, limit);
    assert.equal(w.qualityMinutes, 10);
    assert.deepEqual(
      work(w).map((s) => s.seconds),
      [300, 300],
    );
    const again = resizeWorkout(w, p.profile, 'Race preparation', limit);
    assert.deepEqual(again.steps, w.steps);
    assert.equal(again.qualityMinutes, w.qualityMinutes);
  }
  const easy = resizeWorkout(w, p.profile, 'Race preparation', 26);
  assert.equal(easy.kind, 'easy');
  assert.equal(easy.qualityMinutes, 0);
  assert.ok(easy.minutes <= 26);
});

test('a lower explicit work budget still removes full repetitions and cannot increase later', () => {
  const p = profile(),
    w = session('threshold-cruise', 20, 60, p);
  assert.equal(w.qualityMinutes, 16);
  const lower = resizeWorkout(w, p, 'Build', w.minutes, 12);
  assert.equal(lower.qualityMinutes, 12);
  assert.deepEqual(
    work(lower).map((s) => s.seconds),
    [240, 240, 240],
  );
  assert.equal(
    resizeWorkout(lower, p, 'Build', lower.minutes, 16).qualityMinutes,
    12,
  );
  assert.equal(
    resizeWorkout(lower, p, 'Build', lower.minutes, 7).qualityMinutes,
    0,
  );
});

test('taper retains its smaller saved dose, never the original full template dose', () => {
  const p = make(),
    w = p.workouts.find(
      (w) => w.templateId === 'race-rhythm-10' && w.qualityMinutes === 5,
    );
  assert.ok(w);
  const next = resizeWorkout(w, p.profile, 'Taper', w.minutes - 1);
  assert.equal(next.qualityMinutes, 5);
  assert.deepEqual(work(next), work(w));
  assert.ok(next.minutes < w.minutes);
});

test('public shorten and lower-limit preference edits preserve history, schedule and time ceilings', () => {
  const p = make(),
    w = target(p);
  p.workouts[0].status = 'completed';
  const before = structuredClone(p);
  const next = shortenWorkout(p, w.id, 46, '2026-09-11');
  assert.deepEqual(validatePlan(next), []);
  assert.equal(next.workouts.find((s) => s.id === w.id).qualityMinutes, 10);
  for (const old of before.workouts.filter((s) => s.id !== w.id))
    assert.deepEqual(
      next.workouts.find((s) => s.id === old.id),
      old,
    );
  assert.deepEqual(p, before);
  const limited = revisePreferences(p, { weekdayMinutes: 46 }, '2026-09-11');
  assert.deepEqual(validatePlan(limited), []);
  assert.equal(limited.workouts.find((s) => s.id === w.id).qualityMinutes, 10);
  assert.deepEqual(
    limited.workouts.find((s) => s.id === p.workouts[0].id),
    p.workouts[0],
  );
  assert.deepEqual(
    revisePreferences(limited, { weekdayMinutes: 46 }, '2026-09-11'),
    limited,
  );
});

test('alternatives can use a full saved gentle allowance without exceeding it', () => {
  const p = make(),
    w = target(p);
  const option = workoutAlternatives(p, w.id).find(
    (t) => t.id === 'race-rhythm-10-short',
  );
  assert.ok(option);
  assert.match(option.title, /3 × 3 min steady/);
  const next = substituteWorkout(p, w.id, option.id, start),
    s = next.workouts.find((s) => s.id === w.id);
  assert.equal(s.qualityMinutes, 9);
  assert.equal(s.title, option.title);
  assert.ok(s.minutes <= w.minutes);
  assert.deepEqual(validatePlan(next), []);
});

for (const distance of [50, 80.4672, 100, 160.9344]) {
  test(`${distance}km runnable ultra steady session survives an unchanged or shorter time limit`, () => {
    const p = make({
      goal: 'ultra',
      raceDistanceKm: distance,
      weeklyKm: distance === 50 ? 90 : 110,
      longestKm: 32,
      currentRuns: 5,
      runsPerWeek: 5,
      days: [0, 1, 2, 3, 5],
      longDay: 5,
      weekdayMinutes: 120,
      longMinutes: 240,
      raceDate: '2027-02-21',
      stableWeeks: 16,
      ultraWeeklyMinutes: distance === 50 ? 540 : 660,
      ultraLongestMinutes: 180,
      workoutTargets: { mode: 'effort' },
    });
    const w = p.workouts.find((w) => w.templateId === 'ultra-steady');
    assert.ok(w);
    for (const cap of [w.minutes, w.minutes - 1]) {
      const s = resizeWorkout(w, p.profile, p.weeks[w.week].phase, cap);
      assert.equal(s.qualityMinutes, w.qualityMinutes);
      assert.deepEqual(work(s), work(w));
      assert.ok(s.minutes <= cap);
    }
    assert.deepEqual(validatePlan(p), []);
  });
}

test('shortened distance repeats retain exact endpoints, recoveries and FIT/Intervals target snapshots', () => {
  const p = profile({
    workoutTargets: {
      mode: 'pace',
      pace: { easy: { low: 350, high: 390 }, steady: { low: 320, high: 340 } },
    },
  });
  const w = session('threshold-800-metres', 20, 60, p);
  const next = resizeWorkout(w, p, 'Build', w.minutes - 1);
  assert.deepEqual(work(next), work(w));
  assert.ok(work(next).every((s) => s.metres === 800));
  const { messages, errors } = new Decoder(
    Stream.fromByteArray(encodeWorkout(next)),
  ).read();
  assert.deepEqual(errors, []);
  next.steps.forEach((s, i) => {
    const out = messages.workoutStepMesgs[i];
    assert.equal(
      s.metres !== undefined ? out.durationDistance : out.durationTime,
      s.metres ?? s.seconds,
    );
    assert.equal(out.notes, s.effort);
    if (s.kind === 'work') {
      assert.equal(out.customTargetSpeedLow, 2.941);
      assert.equal(out.customTargetSpeedHigh, 3.125);
    }
  });
  assert.match(intervalsWorkoutText(next), /5:20-5:40\/km Pace/);
});

test('weekly rebalancing still enforces the real work fraction without a second difficulty reduction', () => {
  const p = make(),
    w = target(p),
    runs = p.workouts.filter((s) => s.week === w.week && s.id !== w.id);
  runs.forEach((s) => {
    s.status = 'skipped';
  });
  rebalanceFutureQuality(p, start);
  assert.deepEqual(validatePlan(p), []);
  assert.ok(qualityWorkMinutes(w) <= w.minutes * 0.22 + 0.1);
  assert.ok(w.qualityMinutes <= 10);
});

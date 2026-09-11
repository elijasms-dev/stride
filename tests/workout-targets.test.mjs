import test from 'node:test';
import assert from 'node:assert/strict';
import { Decoder, Stream } from '@garmin/fitsdk';
import {
  makePlan,
  demoProfile,
  addDays,
  shortenWorkout,
  substituteWorkout,
  workoutAlternatives,
} from '../lib/engine.ts';
import { encodeWorkout } from '../lib/fit.ts';
import {
  validateWorkoutTargets,
  updateWorkoutTargets,
  withWorkoutTargets,
  targetLabel,
  parsePace,
} from '../lib/workout-targets.ts';
import { specificWorkoutName } from '../lib/workout-names.ts';
const config = {
  mode: 'pace',
  pace: {
    easy: { low: 330, high: 390 },
    steady: { low: 310, high: 330 },
    tempo: { low: 285, high: 300 },
    interval: { low: 255, high: 275 },
    race: { low: 300, high: 315 },
  },
};
const hr = {
  mode: 'heart-rate',
  heartRate: { easy: { low: 130, high: 150 }, tempo: { low: 160, high: 170 } },
};
function plan() {
  const start = '2026-09-07';
  return makePlan({
    ...demoProfile(start),
    weeklyKm: 70,
    longestKm: 25,
    currentRuns: 5,
    runsPerWeek: 5,
    days: [0, 1, 2, 3, 5],
    longDay: 5,
    intent: 'improve',
    recentQualitySessions: 2,
    weekdayMinutes: 90,
    longMinutes: 200,
    raceDate: addDays(start, 139),
  });
}
void test('target validation rejects invalid modes, missing easy range, inverted or malformed ranges', () => {
  for (const value of [
    null,
    {},
    { mode: 'speed' },
    { mode: 'pace' },
    { ...config, pace: { easy: { low: 400, high: 300 } } },
    { ...hr, heartRate: { easy: { low: 150, high: 250 } } },
    { ...hr, heartRate: { easy: { low: 130.5, high: 150 } } },
  ])
    assert.throws(() => validateWorkoutTargets(value));
  assert.deepEqual(validateWorkoutTargets(config), config);
  assert.deepEqual(validateWorkoutTargets({ mode: 'effort' }), {
    mode: 'effort',
  });
});
void test('mile inputs round-trip to seconds/km and display explicit units', () => {
  const p = parsePace('8:03', 'mi');
  assert.ok(Math.abs(p - 300.123) < 0.01);
  assert.equal(
    targetLabel({ mode: 'pace', low: p, high: parsePace('8:51', 'mi') }, 'mi'),
    '8:03–8:51 /mi',
  );
  assert.equal(parsePace('5:99', 'km'), null);
  assert.equal(parsePace('5.0', 'km'), null);
});
void test('targets preserve schedule, duration, recorded/past runs and every protected receipt', () => {
  const p = plan(),
    original = structuredClone(p),
    protectedId = p.workouts[4].id;
  p.workouts[2].status = 'completed';
  const before = structuredClone(p);
  const next = updateWorkoutTargets(p, config, '2026-09-09', [protectedId]);
  assert.deepEqual(p, before);
  for (const w of next.workouts) {
    const old = before.workouts.find((s) => s.id === w.id);
    assert.equal(w.date, old.date);
    assert.equal(w.minutes, old.minutes);
    if (
      w.id === protectedId ||
      w.date < '2026-09-09' ||
      w.status === 'completed'
    )
      assert.deepEqual(w, old);
  }
  assert.ok(
    next.workouts.some((w) => w.steps.some((s) => s.target?.mode === 'pace')),
  );
  const effort = updateWorkoutTargets(next, { mode: 'effort' }, '2026-09-09', [
    protectedId,
  ]);
  assert.ok(
    effort.workouts
      .filter(
        (w) =>
          w.status === 'planned' &&
          w.date >= '2026-09-09' &&
          w.id !== protectedId,
      )
      .every((w) => w.steps.every((s) => !s.target)),
  );
  assert.equal(original.workouts.length, next.workouts.length);
});
void test('short HR efforts, walking, recoveries and hills retain effort; gentle work gets steady targets', () => {
  const base = plan().workouts.find((w) => w.hard);
  const steps = [
    {
      label: 'Short rep',
      seconds: 90,
      effort: 'Fast',
      intensity: 7,
      kind: 'work',
    },
    {
      label: 'Tempo',
      seconds: 300,
      effort: 'Controlled',
      intensity: 6,
      kind: 'work',
    },
    {
      label: 'Walk',
      seconds: 300,
      effort: 'Walk',
      intensity: 2,
      kind: 'aerobic',
      movement: 'walk',
    },
    {
      label: 'Recover',
      seconds: 180,
      effort: 'Easy',
      intensity: 2,
      kind: 'recovery',
    },
  ];
  const p = { ...plan().profile, workoutTargets: hr };
  const w = withWorkoutTargets({ ...base, stimulus: 'threshold', steps }, p);
  assert.equal(w.steps[0].target, undefined);
  assert.deepEqual(w.steps[1].target, {
    mode: 'heart-rate',
    low: 160,
    high: 170,
  });
  assert.equal(w.steps[2].target, undefined);
  assert.equal(w.steps[3].target, undefined);
  assert.ok(
    withWorkoutTargets({ ...w, templateId: 'hills-short' }, p).steps.every(
      (s) => !s.target,
    ),
  );
  const gentle = withWorkoutTargets(
    {
      ...base,
      stimulus: 'race-rhythm',
      steps: [
        {
          ...steps[1],
          intensity: 5,
          effort: 'Steady and comfortable · 5–6 / 10',
        },
      ],
    },
    { ...p, workoutTargets: config },
  );
  assert.equal(gentle.steps[0].target.low, 310);
});
void test('FIT encodes mixed effort, pace and absolute BPM and preserves durations', () => {
  const w = plan().workouts[0];
  w.steps = [
    {
      label: 'Easy',
      seconds: 600,
      effort: 'Comfortable',
      intensity: 3,
      kind: 'warmup',
    },
    {
      label: 'Pace',
      seconds: 300,
      effort: 'Controlled',
      intensity: 6,
      kind: 'work',
      target: { mode: 'pace', low: 300, high: 330 },
    },
    {
      label: 'HR',
      seconds: 600,
      effort: 'Relaxed',
      intensity: 3,
      kind: 'work',
      target: { mode: 'heart-rate', low: 135, high: 155 },
    },
  ];
  const bytes = encodeWorkout(w),
    decoder = new Decoder(Stream.fromByteArray(bytes));
  assert.equal(decoder.checkIntegrity(), true);
  const { messages, errors } = decoder.read();
  assert.deepEqual(errors, []);
  const [open, pace, heart] = messages.workoutStepMesgs;
  assert.equal(open.targetType, 'open');
  assert.equal(pace.targetType, 'speed');
  assert.equal(pace.customTargetSpeedLow, 3.03);
  assert.equal(pace.customTargetSpeedHigh, 3.333);
  assert.equal(heart.customTargetHeartRateLow, 235);
  assert.equal(heart.customTargetHeartRateHigh, 255);
  w.steps[1].target.low = 500;
  assert.throws(() => encodeWorkout(w), /FIT_TARGET/);
});
void test('specific names distinguish ultra and hills and follow repeated shortening and substitutions', () => {
  const p = updateWorkoutTargets(plan(), config, '2026-09-07');
  const base = p.workouts.find(
    (w) => w.hard && w.steps.filter((s) => s.kind === 'work').length >= 3,
  );
  assert.match(
    specificWorkoutName({
      ...base,
      stimulus: 'race-rhythm',
      templateId: 'ultra-steady',
    }),
    /ultra steady/i,
  );
  assert.match(
    specificWorkoutName({
      ...base,
      stimulus: 'economy',
      templateId: 'hills-short',
    }),
    /hill efforts/i,
  );
  let short = shortenWorkout(
    p,
    base.id,
    Math.floor(base.minutes) - 2,
    '2026-09-07',
  );
  short = shortenWorkout(
    short,
    base.id,
    Math.floor(short.workouts.find((w) => w.id === base.id).minutes) - 2,
    '2026-09-07',
  );
  const w = short.workouts.find((w) => w.id === base.id);
  assert.equal(w.title, specificWorkoutName(w));
  const alternatives = workoutAlternatives(p, base.id);
  assert.ok(alternatives.length);
  const alt = substituteWorkout(
    p,
    base.id,
    alternatives[0].id,
    '2026-09-07',
  ).workouts.find((w) => w.id === base.id);
  assert.equal(alt.title, specificWorkoutName(alt));
  assert.ok(alt.steps.some((s) => s.target));
});
void test('race targets do not carry over to a different race distance', () => {
  const p = updateWorkoutTargets(plan(), config, '2026-09-07');
  const w = p.workouts.find((w) => w.stimulus === 'race-rhythm');
  assert.ok(w.steps.some((s) => s.kind === 'work' && s.target));
  const changed = withWorkoutTargets(w, { ...p.profile, goal: 'half' });
  assert.ok(
    changed.steps.filter((s) => s.kind === 'work').every((s) => !s.target),
  );
});
void test('tight mile ranges remain a range in the canonical watch prescription', () => {
  const result = validateWorkoutTargets({
    mode: 'pace',
    pace: {
      easy: { low: parsePace('8:04', 'mi'), high: parsePace('8:05', 'mi') },
    },
  });
  assert.deepEqual(result.pace.easy, { low: 300, high: 302 });
});
void test('explicit race HR survives distance-ended race steps', () => {
  const p = updateWorkoutTargets(
    plan(),
    {
      mode: 'heart-rate',
      heartRate: {
        easy: { low: 130, high: 150 },
        race: { low: 155, high: 165 },
      },
    },
    '2026-09-07',
  );
  const race = p.workouts.find((w) => w.kind === 'race');
  assert.ok(race.steps[0].metres);
  assert.deepEqual(race.steps[0].target, {
    mode: 'heart-rate',
    low: 155,
    high: 165,
  });
});
void test('custom-distance variety uses the original goal scope for numeric race targets', async () => {
  const { refreshWorkoutVariety } = await import('../lib/engine.ts');
  const { readFileSync } = await import('node:fs');
  const p = JSON.parse(
    readFileSync(
      new URL('fixtures/variety-legacy.json', import.meta.url),
      'utf8',
    ),
  );
  p.profile.goal = 'custom';
  p.profile.raceDistanceKm = 42.195;
  p.profile.raceTerrain = 'road';
  const targeted = updateWorkoutTargets(p, config, '2026-09-07');
  for (const w of targeted.workouts) delete w.varietyVersion;
  const next = refreshWorkoutVariety(targeted, '2026-09-17');
  const changed = next.workouts.filter(
    (w) => w.varietyVersion && w.stimulus === 'race-rhythm',
  );
  assert.ok(changed.length);
  for (const w of changed)
    assert.ok(w.steps.some((s) => s.kind === 'work' && s.target?.low === 300));
});
void test('session names group repeated durations into memorable sets', () => {
  const base = plan().workouts.find((w) => w.hard);
  const work = base.steps.find((s) => s.kind === 'work');
  assert.equal(
    specificWorkoutName({
      ...base,
      kind: 'tempo',
      stimulus: 'threshold',
      steps: [180, 180, 120, 120].map((seconds) => ({
        ...work,
        seconds,
        intensity: 6,
      })),
    }),
    '2 × 3 min + 2 × 2 min tempo',
  );
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { Decoder, Stream } from '@garmin/fitsdk';
import {
  makePlan,
  demoProfile,
  refreshWorkoutVariety,
  validatePlan,
  workoutAlternatives,
  substituteWorkout,
} from '../lib/engine.ts';
import { isSteadyRaceAdaptation } from '../lib/steady-race-workout.ts';
import { withSteadyRaceInstructions } from '../lib/workout-names.ts';
import { updateWorkoutTargets } from '../lib/workout-targets.ts';
import { encodeWorkout } from '../lib/fit.ts';
import { intervalsWorkoutText } from '../lib/intervals-workout.ts';

const start = '2026-09-07';
const config = (mode = 'pace') => ({
  mode,
  raceScope: '10k:',
  pace: {
    easy: { low: 350, high: 390 },
    steady: { low: 320, high: 340 },
    tempo: { low: 290, high: 310 },
    interval: { low: 260, high: 280 },
    race: { low: 280, high: 300 },
  },
  heartRate: {
    easy: { low: 130, high: 145 },
    steady: { low: 145, high: 155 },
    race: { low: 160, high: 170 },
  },
});
const plan = (patch = {}) =>
  makePlan(
    {
      ...demoProfile(start),
      goal: '10k',
      difficulty: 'gentle',
      weeklyKm: 40,
      longestKm: 12,
      currentRuns: 4,
      days: [0, 2, 4, 6],
      weekdayMinutes: 90,
      longMinutes: 120,
      volume: 'maintain',
      recentQualitySessions: 1,
      recentQualityMinutes: 20,
      workoutTargets: config(),
      ...patch,
    },
    start,
  );
const adapted = (p) => p.workouts.filter(isSteadyRaceAdaptation);
const dose = (w) => {
  const { title, purpose, reason, ...saved } = w;
  return { ...saved, steps: w.steps.map(({ label, ...s }) => s) };
};

test('gentler 10K blocks agree across title, instructions and actual steady targets', () => {
  const p = plan();
  assert.deepEqual(validatePlan(p), []);
  assert.ok(adapted(p).length > 0);
  for (const w of adapted(p)) {
    assert.match(w.title, /steady efforts/);
    assert.match(w.purpose, /gentler session/);
    assert.match(w.reason, /steady aerobic work/);
    for (const s of w.steps.filter((s) => s.kind === 'work')) {
      assert.match(s.label, /steady/);
      assert.equal(s.intensity, 5);
      assert.deepEqual(s.target, { mode: 'pace', low: 320, high: 340 });
    }
  }
});

test('normalization is idempotent and changes no executable workload or targets', () => {
  const w = structuredClone(adapted(plan())[0]);
  w.title = '2 × 5 min 10K effort';
  w.purpose = 'Rehearse race-day rhythm.';
  w.reason = 'Race preparation: rehearse race-day rhythm.';
  w.steps.forEach((s) => {
    if (s.kind === 'work') s.label = '5 min race rhythm';
  });
  const before = structuredClone(w),
    corrected = withSteadyRaceInstructions(w);
  assert.deepEqual(w, before);
  assert.deepEqual(dose(corrected), dose(before));
  assert.deepEqual(withSteadyRaceInstructions(corrected), corrected);
});

for (const mode of ['effort', 'pace', 'heart-rate']) {
  test(`${mode} export keeps the steady instruction and exact saved endpoints`, () => {
    const p = plan({ workoutTargets: config(mode) }),
      w = adapted(p)[0];
    const { messages, errors } = new Decoder(
      Stream.fromByteArray(encodeWorkout(w)),
    ).read();
    assert.deepEqual(errors, []);
    assert.match(messages.workoutMesgs[0].wktName, /steady efforts/);
    w.steps.forEach((s, i) => {
      const out = messages.workoutStepMesgs[i];
      assert.equal(out.wktStepName, s.label.slice(0, 32));
      assert.equal(out.notes, s.effort);
      assert.equal(
        s.metres !== undefined ? out.durationDistance : out.durationTime,
        s.metres ?? s.seconds,
      );
      if (s.kind !== 'work') return;
      assert.equal(
        out.targetType,
        mode === 'pace'
          ? 'speed'
          : mode === 'heart-rate'
            ? 'heartRate'
            : 'open',
      );
      if (mode === 'pace') {
        assert.equal(out.customTargetSpeedLow, 2.941);
        assert.equal(out.customTargetSpeedHigh, 3.125);
      }
      if (mode === 'heart-rate') {
        assert.equal(out.customTargetHeartRateLow, 245);
        assert.equal(out.customTargetHeartRateHigh, 255);
      }
    });
    if (mode !== 'heart-rate') {
      const exported = intervalsWorkoutText(w);
      assert.doesNotMatch(exported, /race rhythm|10K effort/);
      assert.match(
        exported,
        mode === 'pace' ? /5:20-5:40\/km Pace/ : /freeride/,
      );
    }
  });
}

test('explicit target review corrects future instructions while preserving protected history', () => {
  const p = plan(),
    runs = [p.workouts[0], p.workouts[1], ...adapted(p)];
  assert.ok(runs.length >= 4);
  runs.forEach((w) => {
    w.title = 'Legacy 10K effort';
    w.purpose = 'Rehearse race pace.';
  });
  runs[1].status = 'completed';
  const from = runs[1].date,
    protectedId = runs[2].id,
    before = structuredClone(p);
  const next = updateWorkoutTargets(p, config(), from, [protectedId]);
  assert.deepEqual(p, before);
  for (const w of next.workouts) {
    const old = before.workouts.find((x) => x.id === w.id);
    if (w.date < from || w.status === 'completed' || w.id === protectedId)
      assert.deepEqual(w, old);
    assert.deepEqual(dose(w), dose(old));
  }
  assert.match(next.workouts.find((w) => w.id === runs[3].id).title, /steady/);
});

test('native and custom races share the correction without treating normal half effort as softened', () => {
  const w = adapted(plan())[0];
  for (const templateId of [
    'race-rhythm-5',
    'race-rhythm-10',
    'half-rhythm',
    'marathon-steady',
  ]) {
    for (const eventDistanceKm of [undefined, 15, 16.0934]) {
      const next = withSteadyRaceInstructions({
        ...w,
        templateId,
        eventDistanceKm,
      });
      assert.match(next.title, /steady efforts/);
      assert.deepEqual(dose(next), dose({ ...w, templateId, eventDistanceKm }));
    }
  }
  const normal = {
    ...w,
    steps: w.steps.map((s) =>
      s.kind === 'work'
        ? {
            ...s,
            intensity: 4,
            effort: 'Measured half-marathon effort · 5–6 / 10',
          }
        : s,
    ),
  };
  for (const patch of [
    { kind: 'race' },
    { pairType: 'double-threshold' },
    { returnRole: 'easy' },
  ]) {
    const excluded = { ...w, ...patch };
    assert.equal(isSteadyRaceAdaptation(excluded), false);
    assert.deepEqual(withSteadyRaceInstructions(excluded), excluded);
  }
  assert.equal(isSteadyRaceAdaptation(normal), false);
  assert.deepEqual(withSteadyRaceInstructions(normal), normal);
  const mixed = {
    ...w,
    steps: [
      ...w.steps,
      {
        ...w.steps.find((s) => s.kind === 'work'),
        intensity: 6,
        effort: '10K effort',
      },
    ],
  };
  assert.equal(isSteadyRaceAdaptation(mixed), false);
});

test('normal 10K training retains race pace and explicit variety keeps gentle cues aligned', () => {
  const normal = plan({ difficulty: 'balanced' });
  const specific = normal.workouts.filter(
    (w) => w.stimulus === 'race-rhythm' && w.kind !== 'race',
  );
  assert.ok(specific.length > 0);
  for (const w of specific) {
    assert.match(w.title, /10K effort/);
    assert.ok(
      w.steps
        .filter((s) => s.kind === 'work')
        .every((s) => s.target?.low === 280),
    );
  }
  const p = plan(),
    next = refreshWorkoutVariety(p, start);
  assert.deepEqual(validatePlan(next), []);
  for (const w of adapted(next)) {
    assert.match(w.title, /steady efforts/);
    assert.ok(
      w.steps
        .filter((s) => s.kind === 'work')
        .every((s) => /steady/.test(s.label)),
    );
  }
});

test('an alternative menu describes the steady session that will actually be applied', () => {
  const p = plan(),
    w = adapted(p).find((w) => workoutAlternatives(p, w.id).length);
  assert.ok(w);
  const before = structuredClone(p);
  for (const option of workoutAlternatives(p, w.id)) {
    assert.match(option.title, /steady/);
    assert.match(option.cue, /Steady and comfortable/);
    const next = substituteWorkout(p, w.id, option.id, start);
    const saved = next.workouts.find((x) => x.id === w.id);
    assert.equal(saved.title, option.title);
    assert.ok(saved.qualityMinutes <= w.qualityMinutes);
    assert.ok(saved.minutes <= w.minutes);
    assert.deepEqual(validatePlan(next), []);
  }
  assert.deepEqual(p, before);
});

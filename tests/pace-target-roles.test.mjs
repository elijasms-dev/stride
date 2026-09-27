import test from 'node:test';
import assert from 'node:assert/strict';
import {
  benchmarkWorkoutTargets,
  manualTargetRange,
  resolveEffortRole,
  validateWorkoutTargets,
  validStepTarget,
  workoutStepTarget,
  withWorkoutTargets,
} from '../lib/workout-targets.ts';
import {
  initialTargetSettings,
  targetSettingsConfig,
} from '../lib/workout-target-form.ts';
import { FITNESS_MODEL_VERSION } from '../lib/fitness-pacing.ts';
import { addDays, demoProfile, makePlan } from '../lib/engine.ts';
import { exportProgram } from '../lib/program-export.ts';

const profile = {
  goal: 'half',
  units: 'km',
  recentRace: { distanceKm: 5, timeMinutes: 40 },
};
const step = { kind: 'work', intensity: 6, seconds: 300, effort: 'Controlled' };
const threshold = { kind: 'tempo', stimulus: 'threshold' };
const rhythm = { kind: 'tempo', stimulus: 'race-rhythm' };
const ranges = {
  easy: { low: 600, high: 660 },
  steady: { low: 530, high: 550 },
  tempo: { low: 510, high: 530 },
  threshold: { low: 480, high: 500 },
  interval: { low: 450, high: 470 },
  repetition: { low: 420, high: 440 },
};

test('role and target selection are independent of cue wording', () => {
  for (const effort of [
    'Steady and comfortable',
    'Comfortable and steady',
    '',
    'Run hard',
  ]) {
    const gentle = { ...step, intensity: 5, effort };
    assert.equal(resolveEffortRole(rhythm, gentle, profile), 'steady');
    assert.deepEqual(
      workoutStepTarget(rhythm, gentle, profile),
      workoutStepTarget(rhythm, { ...gentle, effort: 'Reference' }, profile),
    );
  }
  assert.equal(resolveEffortRole(threshold, step, profile), 'threshold');
  assert.equal(
    resolveEffortRole(threshold, { ...step, effortRole: 'tempo' }, profile),
    'tempo',
  );
  assert.equal(
    resolveEffortRole(rhythm, { ...step, intensity: 5 }, { goal: 'marathon' }),
    'race',
  );
});

test('automatic threshold and tempo use independent explicit bands', () => {
  const config = benchmarkWorkoutTargets(profile);
  assert.ok(config.pace.threshold);
  assert.ok(config.pace.repetition);
  const actual = workoutStepTarget(threshold, step, profile);
  assert.deepEqual(
    { low: actual.low, high: actual.high },
    config.pace.threshold,
  );
  assert.equal(actual.source, 'benchmark');
  assert.equal(actual.model, FITNESS_MODEL_VERSION);
  assert.equal(workoutStepTarget(rhythm, step, profile).model, 'riegel-1.06');
});

test('manual threshold, tempo and repetition remain separately configurable', () => {
  const config = validateWorkoutTargets({
    mode: 'pace',
    bandsVersion: 2,
    pace: ranges,
  });
  for (const effortRole of ['tempo', 'threshold', 'interval', 'repetition']) {
    const actual = workoutStepTarget(
      threshold,
      { ...step, effortRole },
      { ...profile, workoutTargets: config },
    );
    assert.deepEqual(actual, {
      ...ranges[effortRole],
      mode: 'pace',
      source: 'manual',
    });
  }
  assert.throws(
    () =>
      validateWorkoutTargets({
        mode: 'pace',
        bandsVersion: 2,
        pace: {
          easy: ranges.easy,
          threshold: { low: 400, high: 420 },
          repetition: { low: 450, high: 470 },
        },
      }),
    /Repetitions should not/,
  );
});

test('legacy merged ranges preserve old meaning and migrate on review without unit drift', () => {
  const legacy = {
    mode: 'pace',
    pace: {
      easy: ranges.easy,
      tempo: ranges.threshold,
      interval: ranges.interval,
    },
  };
  assert.deepEqual(
    manualTargetRange(legacy, 'pace', 'threshold'),
    ranges.threshold,
  );
  assert.deepEqual(
    manualTargetRange(legacy, 'pace', 'repetition'),
    ranges.interval,
  );
  const oldProfile = { ...profile, units: 'mi', workoutTargets: legacy };
  const draft = initialTargetSettings(oldProfile);
  assert.equal(draft.pace.threshold.low, draft.pace.tempo.low);
  assert.equal(draft.pace.repetition.high, draft.pace.interval.high);
  const reviewed = targetSettingsConfig(oldProfile, draft);
  assert.equal(reviewed.bandsVersion, 2);
  assert.deepEqual(reviewed.pace.threshold, legacy.pace.tempo);
  assert.deepEqual(reviewed.pace.repetition, legacy.pace.interval);
  assert.deepEqual(reviewed.pace.easy, legacy.pace.easy);
  draft.pace.threshold = { low: '', high: '' };
  const cleared = targetSettingsConfig(oldProfile, draft);
  assert.equal(manualTargetRange(cleared, 'pace', 'threshold'), undefined);
  assert.equal(
    workoutStepTarget(threshold, step, { ...profile, workoutTargets: cleared }),
    undefined,
  );
});

test('legacy heart-rate threshold also uses its saved shared tempo band', () => {
  const config = validateWorkoutTargets({
    mode: 'heart-rate',
    heartRate: {
      easy: { low: 130, high: 145 },
      tempo: { low: 155, high: 170 },
    },
  });
  assert.deepEqual(
    workoutStepTarget(threshold, step, { ...profile, workoutTargets: config }),
    { mode: 'heart-rate', low: 155, high: 170, source: 'manual' },
  );
});

for (const raceDistanceKm of [25, 30]) {
  test(`gentle custom ${raceDistanceKm}K replacement is never faster than event work`, () => {
    const custom = { ...profile, goal: 'custom', raceDistanceKm };
    const balanced = workoutStepTarget(rhythm, step, custom);
    const gentle = workoutStepTarget(rhythm, { ...step, intensity: 5 }, custom);
    assert.equal(
      resolveEffortRole(rhythm, { ...step, intensity: 5 }, custom),
      'steady',
    );
    assert.ok(gentle.low >= balanced.low);
    assert.ok(gentle.high >= balanced.high);
    const start = '2026-09-28';
    const actual = ['balanced', 'gentle'].map((difficulty) => {
      const p = {
        ...demoProfile(start),
        goal: 'custom',
        raceDistanceKm,
        raceDate: addDays(start, 125),
        weeklyKm: 50,
        longestKm: 18,
        currentRuns: 5,
        days: [0, 1, 2, 4, 6],
        weekdayMinutes: 120,
        longMinutes: 300,
        recentRace: profile.recentRace,
        easyPace: 10,
        qualityMode: 'custom',
        qualitySessions: 1,
        recentQualitySessions: 1,
        recentQualityMinutes: 20,
        intent: 'improve',
        difficulty,
        runMeasure: 'distance',
      };
      return makePlan(p, start)
        .workouts.find((w) => w.stimulus === 'race-rhythm')
        .steps.find((s) => s.kind === 'work');
    });
    assert.equal(actual[0].effortRole, 'race');
    assert.equal(actual[1].effortRole, 'steady');
    assert.ok(actual[1].target.low >= actual[0].target.low);
    assert.ok(actual[1].target.high >= actual[0].target.high);
  });
}

test('effort, run/walk and short strides cannot acquire numeric alerts', () => {
  assert.equal(
    workoutStepTarget(threshold, step, {
      ...profile,
      workoutTargets: { mode: 'effort' },
    }),
    undefined,
  );
  assert.equal(
    workoutStepTarget(threshold, { ...step, effortRole: 'effort' }, profile),
    undefined,
  );
  assert.equal(
    workoutStepTarget(
      {
        ...threshold,
        kind: 'easy',
        steps: [{ movement: 'run' }, { movement: 'walk' }],
      },
      step,
      profile,
    ),
    undefined,
  );
  assert.equal(
    workoutStepTarget(
      { kind: 'intervals', stimulus: 'economy' },
      { ...step, seconds: 20 },
      profile,
    ),
    undefined,
  );
  assert.equal(
    workoutStepTarget(
      { kind: 'intervals', stimulus: 'economy' },
      { ...step, seconds: 120, metres: 200 },
      profile,
    ),
    undefined,
  );
  assert.equal(
    workoutStepTarget(threshold, { ...step, kind: 'recovery' }, profile),
    undefined,
  );
});

test('portable program exports preserve benchmark, manual and unknown provenance', () => {
  const p = { ...demoProfile('2026-09-28'), runMeasure: 'time' };
  const plan = makePlan(p, p.startDate);
  const original = plan.workouts[0];
  const targeted = withWorkoutTargets(
    { ...original, stimulus: 'threshold', steps: [step] },
    { ...p, recentRace: profile.recentRace },
  );
  assert.equal(targeted.steps[0].target.source, 'benchmark');
  const cases = [
    [targeted.steps[0].target, 'benchmark', /Estimated from a recorded/],
    [
      { mode: 'pace', low: 480, high: 500, source: 'manual' },
      'manual',
      /runner-supplied/,
    ],
    [
      { mode: 'pace', low: 480, high: 500 },
      'unknown',
      /original source was not recorded/,
    ],
  ];
  for (const [target, source, basis] of cases) {
    const saved = structuredClone(plan);
    saved.workouts = [{ ...targeted, steps: [{ ...step, target }] }];
    const exported = exportProgram(saved);
    const session = exported.weeks.flatMap((w) =>
      w.days.flatMap((d) => d.sessions),
    )[0];
    const metrics = session.main_set[0].target_metrics;
    assert.equal(metrics.source, source);
    assert.match(metrics.basis, basis);
    assert.equal(
      metrics.model,
      source === 'benchmark' ? FITNESS_MODEL_VERSION : null,
    );
    assert.equal(session.main_set[0].effort_role, 'threshold');
  }
  assert.equal(
    validStepTarget({ mode: 'pace', low: 300, high: 330, source: 'invented' }),
    false,
  );
});

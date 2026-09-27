import test from 'node:test';
import assert from 'node:assert/strict';
import { makePlan } from '../lib/engine.ts';
import { calculateTrainingPaceRanges } from '../lib/fitness-pacing.ts';
import {
  benchmarkWorkoutTargets,
  workoutStepTarget,
} from '../lib/workout-targets.ts';
import { roadProfile } from './road-overhaul-cases.mjs';

for (const goal of ['5k', '10k', 'half']) {
  for (const timeMinutes of [20, 30, 40, 50]) {
    test(`${goal} benchmark steady is never faster than race effort: 5K in ${timeMinutes} minutes`, () => {
      const target = benchmarkWorkoutTargets({
        goal,
        recentRace: { distanceKm: 5, timeMinutes },
      });
      if (timeMinutes === 50) {
        assert.equal(
          target,
          undefined,
          'Unsupported fitness keeps effort targets',
        );
        return;
      }
      assert.ok(target.pace.steady.low >= target.pace.race.low);
      assert.ok(target.pace.steady.high >= target.pace.race.high);
    });
  }
}

test('gentle half-marathon repetitions cannot prescribe faster paces than balanced race effort', () => {
  const input = roadProfile('half', 'established', 1, 12, {
    weeklyKm: 35,
    longestKm: 12,
    currentRuns: 4,
    runsPerWeek: 4,
    easyPace: 10,
    recentRace: { distanceKm: 5, timeMinutes: 40 },
  });
  const plans = ['balanced', 'gentle'].map((difficulty) =>
    makePlan({ ...input, difficulty }, input.startDate),
  );
  const work = plans.map((plan) =>
    plan.workouts.find((w) => w.stimulus === 'race-rhythm'),
  );
  assert.equal(work[0].date, work[1].date);
  const [ordinary, gentle] = work.map((w) =>
    w.steps.find((s) => s.kind === 'work'),
  );
  assert.equal(ordinary.intensity, 6);
  assert.equal(gentle.intensity, 5);
  assert.ok(gentle.target.low >= ordinary.target.low);
  assert.ok(gentle.target.high >= ordinary.target.high);
  assert.ok(work[1].qualityMinutes <= work[0].qualityMinutes);
});

test('explicit steady zones remain the runners selected targets', () => {
  const profile = {
    goal: 'half',
    recentRace: { distanceKm: 5, timeMinutes: 40 },
    workoutTargets: {
      mode: 'pace',
      pace: { easy: { low: 600, high: 660 }, steady: { low: 490, high: 510 } },
    },
  };
  const actual = workoutStepTarget(
    { kind: 'tempo', stimulus: 'race-rhythm' },
    {
      kind: 'work',
      intensity: 5,
      seconds: 180,
      effort: 'Steady and comfortable · 5 / 10',
    },
    profile,
  );
  assert.deepEqual(actual, {
    mode: 'pace',
    low: 490,
    high: 510,
    source: 'manual',
  });
});

test('marathon and non-road automatic steady uses the shared fitness range', () => {
  const recentRace = { distanceKm: 5, timeMinutes: 40 };
  const expected = calculateTrainingPaceRanges(recentRace).steady;
  for (const goal of ['marathon', 'ultra', 'custom', 'base']) {
    assert.deepEqual(
      benchmarkWorkoutTargets({ goal, recentRace }).pace.steady,
      expected,
    );
  }
});

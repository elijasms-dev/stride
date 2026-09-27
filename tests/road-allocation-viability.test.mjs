import { roadOpeningFailures } from './road-overhaul-helpers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makePlan,
  validatePlan,
  refreshWeekTotals,
  refreshWorkoutVariety,
} from '../lib/engine.ts';
import { assessFeasibility } from '../lib/plan/feasibility.ts';
import { weekIncludesTaper } from '../lib/plan/generation-calendar.ts';
import { roadProfile } from './road-overhaul-cases.mjs';

for (const goal of ['5k', '10k', 'half'])
  for (const count of [0, 1, 2]) {
    test(`${goal} q${count}: every ordinary easy run stays within the actual long-run allocation`, () => {
      const input = roadProfile(goal, 'advanced', count, 12);
      const plan = makePlan(input, input.startDate, false);
      for (const candidate of [
        plan,
        refreshWorkoutVariety(plan, input.startDate),
        JSON.parse(JSON.stringify(plan)),
      ]) {
        assert.deepEqual(validatePlan(candidate), []);
        for (const week of candidate.weeks) {
          if (
            ['Recovery', 'Taper', 'Race week'].includes(week.phase) ||
            weekIncludesTaper(candidate.profile, week.start)
          )
            continue;
          const runs = candidate.workouts.filter((w) => w.week === week.index);
          const long = runs.find((w) => w.kind === 'long');
          assert.ok(long);
          for (const run of runs.filter((w) => w.kind === 'easy' && !w.hard)) {
            assert.ok(
              run.estimatedKm <= long.estimatedKm + 0.001,
              `${run.date}: ${run.estimatedKm} > ${long.estimatedKm}`,
            );
            assert.ok(!/Recovery run/.test(run.title));
          }
        }
        assert.deepEqual(roadOpeningFailures(candidate, input), []);
        assert.equal(candidate.weeks[0].longKm, input.longestKm);
      }
    });
  }

test('a declared 60 km 10K routine retains its 14 km long run and discloses supporting-run limits', () => {
  const input = roadProfile('10k', 'advanced', 2, 12, { longestKm: 14 });
  const plan = makePlan(input, input.startDate, false);
  const opening = plan.workouts.filter((w) => w.week === 0);
  assert.deepEqual(roadOpeningFailures(plan, input), []);
  assert.equal(plan.profile.weeklyKm, 60);
  assert.equal(plan.weeks[0].longKm, 14);
  assert.ok(
    opening.filter((w) => w.kind === 'easy').every((w) => w.estimatedKm <= 14),
  );
  assert.equal(opening.filter((w) => w.hard && w.kind !== 'long').length, 2);
});

test('validator catches a hidden long outing even when the weekly total has not changed', () => {
  const input = roadProfile('5k', 'advanced', 0, 12);
  const plan = makePlan(input, input.startDate, false);
  const runs = plan.workouts.filter((w) => w.week === 1 && w.kind === 'easy');
  const long = plan.workouts.find((w) => w.week === 1 && w.kind === 'long');
  const delta = long.estimatedKm + 1 - runs[0].estimatedKm;
  for (const [run, change] of [
    [runs[0], delta],
    [runs[1], -delta],
  ]) {
    run.estimatedKm += change;
    run.minutes = run.estimatedKm * 6;
    run.steps = [
      {
        kind: 'aerobic',
        label: 'Easy',
        intensity: 2,
        effort: 'Easy',
        seconds: run.minutes * 60,
      },
    ];
  }
  refreshWeekTotals(plan);
  assert.ok(
    validatePlan(plan).some((message) =>
      /easy run longer than its designated long run/.test(message),
    ),
  );
});

for (const weeks of [12, 26, 52])
  test(`half: ${weeks} weeks cannot disguise a starting-capacity limit`, () => {
    const input = roadProfile('half', 'developing', 0, weeks, {
      weeklyKm: 18,
      longestKm: 6,
      experience: 'new',
      easyPace: 8,
    });
    const plan = makePlan(input, input.startDate, false);
    assert.equal(plan.feasibility.status, 'review-required');
    assert.ok(
      plan.feasibility.reasons.some((r) =>
        /Extra calendar weeks alone/.test(r),
      ),
    );
    const refreshed = assessFeasibility(plan, input.startDate);
    assert.equal(refreshed.status, 'review-required');
    assert.ok(refreshed.reasons.some((r) => /Build and log a base/.test(r)));
  });

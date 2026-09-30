import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SEED,
  runTrainingContracts,
  trainingContractCases,
} from '../scripts/verify-training-contracts.mjs';
import { makePlan, revisePreferences, validatePlan } from '../lib/engine.ts';
import { distanceEstimate, qualityWorkMinutes } from '../lib/prescription.ts';

test('seeded production plans preserve baselines, explicit frequency and history through release operations', () => {
  const report = runTrainingContracts();
  assert.equal(report.summary.acceptedCases, 48);
  assert.equal(
    report.summary.failures,
    0,
    JSON.stringify(
      [...report.results, ...report.rejected].filter(
        (r) => r.status === 'failed',
      ),
      null,
      2,
    ),
  );
  assert.equal(report.summary.passedCases, 48);
  assert.equal(report.summary.operations, 576);
  assert.equal(report.summary.rejectedCases, 4);
});

test('release scenarios are reproducible by case and seed, while another seed changes operation ordering', () => {
  const caseId = 'marathon-q2-distance';
  const first = runTrainingContracts({ seed: DEFAULT_SEED, caseId });
  assert.deepEqual(runTrainingContracts({ seed: DEFAULT_SEED, caseId }), first);
  const second = runTrainingContracts({ seed: DEFAULT_SEED + 1, caseId });
  assert.equal(second.summary.failures, 0, JSON.stringify(second.results));
  assert.notDeepEqual(
    second.results[0].operations,
    first.results[0].operations,
  );
  assert.ok(trainingContractCases().some((c) => c.id === 'ultra-50k-q2-time'));
  assert.throws(() => runTrainingContracts({ seed: -1 }), /unsigned/);
  assert.throws(
    () => runTrainingContracts({ caseId: 'not-a-case' }),
    /Unknown case/,
  );
});

test('recipe preferences change runnable sets without rebuilding mileage, history or taper anchors', () => {
  const c = trainingContractCases().find(
    (item) => item.id === 'marathon-q2-distance',
  );
  const original = makePlan(
    {
      ...c.profile,
      workoutFormat: 'distance',
      // Exact-distance sets need an explicit pace basis. The saved 10K result
      // alone does not prescribe marathon/threshold paces in every source.
      workoutTargets: {
        mode: 'pace',
        raceScope: 'marathon:',
        pace: {
          easy: { low: 360, high: 360 },
          tempo: { low: 300, high: 320 },
          interval: { low: 270, high: 290 },
          race: { low: 330, high: 340 },
        },
      },
    },
    c.profile.startDate,
    false,
  );
  const from = '2026-09-28';
  const manual = original.workouts.find(
    (w) => w.date >= from && w.hard && w.kind !== 'race',
  );
  manual.changed = true;
  manual.changeSource = 'manual';
  const snapshot = structuredClone(original);
  const after = revisePreferences(original, { workoutFormat: 'time' }, from);
  assert.deepEqual(original, snapshot);
  assert.deepEqual(validatePlan(after), []);
  assert.equal(after.profile.qualitySessions, 2);
  assert.ok(
    after.workouts.some(
      (w) =>
        JSON.stringify(w.steps) !==
        JSON.stringify(original.workouts.find((old) => old.id === w.id).steps),
    ),
    'A format edit updates at least one compatible future set',
  );
  for (const old of original.workouts) {
    const next = after.workouts.find((w) => w.id === old.id);
    assert.equal(next.date, old.date);
    assert.equal(next.minutes, old.minutes);
    assert.equal(next.estimatedKm, old.estimatedKm);
    if (JSON.stringify(next.steps) !== JSON.stringify(old.steps))
      assert.deepEqual(
        next.distanceEstimate,
        distanceEstimate(next.steps, after.profile),
        `Display estimate must match saved steps: ${next.id}`,
      );
    assert.ok(qualityWorkMinutes(next) <= qualityWorkMinutes(old) + 1e-6);
    if (
      old.date < from ||
      old.id === manual.id ||
      ['long', 'easy', 'race'].includes(old.kind) ||
      ['Recovery', 'Taper', 'Race week'].includes(
        original.weeks[old.week].phase,
      )
    )
      assert.deepEqual(next, old);
  }
  assert.deepEqual(
    revisePreferences(after, { workoutFormat: 'time' }, from),
    after,
    'Reapplying the same preference is a no-op',
  );
});

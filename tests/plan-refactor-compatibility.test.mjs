import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as engine from '../lib/engine.ts';
import { independentRoadChecks } from './road-overhaul-contract.mjs';
import { assertMarathonTraining } from './marathon-variety-contract.mjs';

// Preserve the original v32 fixture. v33 road scenarios retain their independent
// contracts; the pace model has a separate fixture for the 18 successful numeric
// base/marathon/custom cases. Effort-only behavior still uses the original SHA,
// normalizing only additive prescription metadata and estimate wording. Named
// marathon recipes and distinct-long session balance are separately versioned in
// marathonVariety, after independent executable and protected-history review.
// The one documented exception is the newly derived, date-aware assessment for
// the revise operation: assert its evidence independently, then retain the old
// assessment solely for hashing every other value against the unchanged v32 SHA.
const baseline = JSON.parse(
  readFileSync(
    new URL('./fixtures/plan-policy-v32.json', import.meta.url),
    'utf8',
  ),
);
const paceBaseline = JSON.parse(
  readFileSync(
    new URL('./fixtures/plan-policy-pace-v1.json', import.meta.url),
    'utf8',
  ),
);
const marathonVariety = JSON.parse(
  readFileSync(
    new URL('./fixtures/plan-policy-marathon-variety-v1.json', import.meta.url),
    'utf8',
  ),
);

function canonical(value, legacy = true) {
  if (Array.isArray(value)) return value.map((item) => canonical(item, legacy));
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .filter(
          (key) =>
            !legacy ||
            !(
              [
                'effortRole',
                'prescriptionVersion',
                'prescriptionPaceBasis',
              ].includes(key) ||
              (value.kind === 'race' &&
                ['distanceEstimate', 'qualityMinutes'].includes(key))
            ),
        )
        .sort()
        .map((key) => [
          key,
          key === 'engineVersion'
            ? 'stride-0.10.1'
            : key === 'policyVersion'
              ? baseline.policyVersion
              : legacy &&
                  key === 'basis' &&
                  value[key] ===
                    'Broad estimate from the current easy-pace basis; effort-only running, recoveries and walking are uncertain.'
                ? 'Broad estimate from declared easy pace; faster work, recoveries and walking are uncertain.'
                : canonical(value[key], legacy),
        ]),
    );
  return value;
}
function hash(value, legacy = true) {
  return createHash('sha256')
    .update(JSON.stringify(canonical(value, legacy)))
    .digest('hex');
}
// Frozen from the pre-pace implementation, not regenerated from the new model.
// Pace changes may alter durations and recipes, but never the declared baseline,
// selected frequency, scheduled IDs/dates, or training-history status.
function historyAndFrequency(plan) {
  const p = plan.profile;
  return {
    profile: {
      weeklyKm: p.weeklyKm,
      longestKm: p.longestKm,
      currentRuns: p.currentRuns,
      runsPerWeek: p.runsPerWeek,
      qualityMode: p.qualityMode,
      qualitySessions: p.qualitySessions,
    },
    workouts: plan.workouts.map((w) => ({
      id: w.id,
      date: w.date,
      originalDate: w.originalDate,
      week: w.week,
      status: w.status,
    })),
    extraRuns: plan.extraRuns,
  };
}
function assertExecutablePacePlan(plan) {
  assert.deepEqual(engine.validatePlan(plan), []);
  assert.equal(plan.weeks[0].targetKm, 70);
  assert.equal(plan.weeks[0].longKm, 23);
  for (const w of plan.workouts.filter((w) => w.kind !== 'race')) {
    assert.equal(
      w.minutes,
      w.steps.reduce((sum, step) => sum + step.seconds, 0) / 60,
    );
    for (const step of w.steps) {
      if (step.metres !== undefined && step.target?.mode === 'pace')
        assert.ok(
          Math.abs(step.seconds - (step.metres * step.target.high) / 1000) <= 1,
          `${w.id}: distance-step time must use its prescribed pace`,
        );
    }
  }
}
function resultFor(c, reviewed = false) {
  try {
    const plan = engine.makePlan(c.profile, baseline.date, false);
    if (reviewed) assertMarathonTraining(plan, c.profile);
    const selected = plan.workouts.find(
      (w) => w.date >= c.asOf && w.kind === 'easy' && w.minutes >= 10,
    );
    let value;
    switch (c.operation) {
      case 'generate':
        value = plan;
        break;
      case 'refresh':
        value = engine.refreshWorkoutVariety(plan, c.asOf);
        break;
      case 'revise':
        value = engine.revisePreferences(
          plan,
          { weekdayMinutes: 60, longMinutes: 180 },
          c.asOf,
        );
        assert.equal(c.name, 'public operation revise');
        assert.deepEqual(value.feasibility, {
          status: 'forecast',
          asOf: '2026-09-28',
          reasons: [],
          checks: [],
          evidence: {
            unit: 'km',
            required: 26,
            phase: 'active',
            recorded: {
              sessions: 0,
              longest: 0,
              unknownDistanceSessions: 0,
              longestEstimatedKm: 0,
            },
            remaining: { sessions: 15, longest: 30 },
            unresolved: { sessions: 2 },
          },
        });
        // Replacing this field alone reproduces the historical SHA. This keeps
        // the complete prescription, profile, frequency, IDs and logs protected.
        value = { ...value, feasibility: plan.feasibility };
        break;
      case 'easy':
      case 'rest':
        value = engine.adjustPlan(
          plan,
          c.asOf,
          engine.addDays(c.asOf, 3),
          c.operation,
          c.asOf,
        );
        break;
      case 'shorten':
        value = engine.shortenWorkout(
          plan,
          selected.id,
          Math.max(5, Math.floor(selected.minutes / 2)),
          c.asOf,
        );
        break;
      case 'return-review':
        value = engine.returnReview(plan, c.asOf);
        break;
      case 'novice-review':
        value = engine.noviceReview(plan, c.asOf);
        break;
      case 'alternatives':
        value = engine.workoutAlternatives(plan, selected.id);
        break;
      default:
        throw new Error(`Unknown baseline operation: ${c.operation}`);
    }
    if (reviewed && value?.workouts) {
      assert.deepEqual(engine.validatePlan(value), []);
      assert.deepEqual(
        value.workouts.filter((w) => w.date < c.asOf),
        plan.workouts.filter((w) => w.date < c.asOf),
        'Public edits preserve historical prescriptions',
      );
      assert.equal(value.profile.weeklyKm, c.profile.weeklyKm);
      assert.equal(value.profile.longestKm, c.profile.longestKm);
      assert.equal(value.profile.qualitySessions, plan.profile.qualitySessions);
      assert.equal(value.profile.runsPerWeek, plan.profile.runsPerWeek);
    }
    return {
      sha256: hash(value, !reviewed),
    };
  } catch (error) {
    return { error: { name: error.name, message: error.message } };
  }
}

test('engine barrel preserves the complete runtime public API', () => {
  assert.equal(engine.TRAINING_POLICY.version, 'provisional-2026-09-27-v35');
  assert.deepEqual(Object.keys(engine).sort(), baseline.exports);
});
test('pace fixture only versions the 18 numeric base, marathon and custom cases', () => {
  assert.equal(paceBaseline.modelVersion, 'stride-daniels-1');
  assert.equal(paceBaseline.date, baseline.date);
  const intended = baseline.cases
    .filter(
      (c) =>
        ['base', 'marathon', 'custom'].includes(c.profile.goal) &&
        !c.expected.error &&
        (c.profile.recentRace || c.profile.workoutTargets?.mode === 'pace'),
    )
    .map((c) => c.name);
  assert.equal(intended.length, 18);
  assert.deepEqual(
    paceBaseline.cases.map((c) => c.name),
    intended,
  );
});
test('the marathon recipe/balance fixture versions only successful named-marathon plans and plan edits', () => {
  const intended = baseline.cases.filter(
    (c) =>
      c.profile.goal === 'marathon' &&
      !c.expected.error &&
      ['generate', 'refresh', 'revise', 'easy', 'rest', 'shorten'].includes(
        c.operation,
      ),
  );
  assert.deepEqual(
    marathonVariety.cases.map((c) => c.name),
    intended.map((c) => c.name),
  );
  for (const c of intended) {
    const previous = paceBaseline.cases.find((p) => p.name === c.name);
    const reviewed = marathonVariety.cases.find((p) => p.name === c.name);
    assert.deepEqual(
      reviewed.previousExpected,
      previous?.expected ?? c.expected,
    );
    assert.equal(
      reviewed.previousFixture,
      previous ? 'plan-policy-pace-v1.json' : 'plan-policy-v32.json',
    );
  }
});
for (const c of baseline.cases)
  test(`declared-baseline policy behavior: ${c.name}`, () => {
    if (['5k', '10k', 'half'].includes(c.profile.goal)) {
      assert.equal(c.operation, 'generate');
      const input = structuredClone(c.profile);
      const plan = engine.makePlan(input, baseline.date, false);
      assert.deepEqual(input, c.profile);
      assert.deepEqual(independentRoadChecks(plan, c.profile).failures, []);
      // These automatic profiles selected one weekday workout in v32. The new
      // plan must still preserve that choice and their familiar 23 km long run.
      assert.equal(plan.profile.qualityMode, 'automatic');
      assert.equal(plan.profile.qualitySessions, 1);
      assert.equal(plan.weeks[0].targetKm, 70);
      assert.equal(plan.weeks[0].longKm, 23);
    } else {
      const paceCase = paceBaseline.cases.find(
        (entry) => entry.name === c.name,
      );
      const reviewed = marathonVariety.cases.find(
        (entry) => entry.name === c.name,
      );
      if (reviewed) {
        if (paceCase) {
          const plan = engine.makePlan(c.profile, baseline.date, false);
          assert.equal(
            hash(historyAndFrequency(plan), false),
            paceCase.historyAndFrequencySha256,
          );
        }
        return assert.deepEqual(resultFor(c, true), reviewed.expected);
      }
      if (!paceCase) return assert.deepEqual(resultFor(c), c.expected);
      const input = structuredClone(c.profile);
      const plan = engine.makePlan(input, baseline.date, false);
      assert.deepEqual(input, c.profile);
      assert.equal(
        hash(historyAndFrequency(plan), false),
        paceCase.historyAndFrequencySha256,
      );
      assertExecutablePacePlan(plan);
      assert.deepEqual({ sha256: hash(plan, false) }, paceCase.expected);
    }
  });

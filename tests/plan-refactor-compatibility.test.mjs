import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as engine from '../lib/engine.ts';

// Versioned regression snapshot for the declared-baseline policy. The original
// refactor snapshots remain alongside it as the v30/v31 policy records. Compare every
// serialized value, allowing only irrelevant object-key insertion order to vary.
const baseline = JSON.parse(
  readFileSync(
    new URL('./fixtures/plan-policy-v32.json', import.meta.url),
    'utf8',
  ),
);
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  return value;
}
function resultFor(c) {
  try {
    const plan = engine.makePlan(c.profile, baseline.date, false);
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
    return {
      sha256: createHash('sha256')
        .update(JSON.stringify(canonical(value)))
        .digest('hex'),
    };
  } catch (error) {
    return { error: { name: error.name, message: error.message } };
  }
}

test('engine barrel preserves the complete runtime public API', () => {
  assert.equal(baseline.policyVersion, engine.TRAINING_POLICY.version);
  assert.deepEqual(Object.keys(engine).sort(), baseline.exports);
});
for (const c of baseline.cases)
  test(`declared-baseline policy behavior: ${c.name}`, () => {
    assert.deepEqual(resultFor(c), c.expected);
  });

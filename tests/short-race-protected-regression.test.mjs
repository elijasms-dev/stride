/** User-requested regression guard: half/marathon/ultra are outside these fixes.
 * Snapshots preserve their pre-change behavior; they do not establish coaching
 * correctness. Short-race correctness is asserted by separate reference tests.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { makePlan, validatePlan } from '../lib/engine.ts';

const baseline = JSON.parse(
  readFileSync(
    new URL(
      '../docs/verification/2026-09-27/short-race-reference/before.json',
      import.meta.url,
    ),
    'utf8',
  ),
);
const protectedCases = baseline.records.filter((record) =>
  ['half', 'marathon', 'ultra'].includes(record.input.goal),
);

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .filter((key) => !['engineVersion', 'policyVersion'].includes(key))
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  return value;
}
function hash(value) {
  return createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');
}

void test('protected baseline was captured before the two short-race edits', () => {
  assert.equal(
    baseline.summary.commit,
    '00416a6355cd6734732eb43b2f7f69bd68bd76ad',
  );
  assert.equal(
    baseline.summary.sourceSha256,
    '5421e89f012490ef32b09c0e2740f1d79fd21f07d430a0cfbf5eb92656ad1cea',
  );
  assert.equal(
    protectedCases.filter((record) => record.status === 'generated').length,
    90,
  );
  assert.equal(
    protectedCases.filter((record) => record.status === 'rejected').length,
    42,
  );
});

for (const record of protectedCases) {
  void test(`${record.id}: protected ${record.status === 'generated' ? 'complete prescription' : 'explicit refusal'} is unchanged`, () => {
    const input = structuredClone(record.input);
    const before = structuredClone(input);
    if (record.status === 'rejected') {
      assert.throws(
        () => makePlan(input, input.startDate, false),
        (error) => {
          assert.equal(error.name, record.error.name);
          assert.equal(error.message, record.error.message);
          return true;
        },
      );
    } else {
      const plan = makePlan(input, input.startDate, false);
      assert.deepEqual(validatePlan(plan), []);
      assert.equal(plan.weeks.length, record.weeks.length);
      for (const week of plan.weeks) {
        assert.equal(
          hash({
            week,
            workouts: plan.workouts.filter(
              (workout) => workout.week === week.index,
            ),
          }),
          record.weeks[week.index].prescriptionHash,
          `Week ${week.index + 1} prescription changed`,
        );
      }
      assert.equal(
        hash(plan),
        record.protectedHash,
        'Full plan/profile/notes/feasibility changed',
      );
    }
    assert.deepEqual(input, before, 'Generation mutated profile input');
  });
}

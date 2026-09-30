/** The original short-race regression fixture stays immutable. Its benchmark
 * cases now have an explicit source-pacing successor: new generation retires
 * universal numeric zones, while dates and ordinary frequency remain protected.
 * Snapshots do not establish coaching correctness.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { makePlan, validatePlan } from '../lib/engine.ts';
import { assertSourcePacingMigration } from './source-pacing-migration-contract.mjs';
const sourcePacing = JSON.parse(
  readFileSync(
    new URL('./fixtures/source-pacing-v1-migrations.json', import.meta.url),
    'utf8',
  ),
);

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
        // Source pacing adds explanation metadata only in these effort-based
        // baselines. Keep every executable endpoint, target and schedule field.
        .filter(
          (key) =>
            ![
              'engineVersion',
              'policyVersion',
              'pacing',
              'paceInstruction',
            ].includes(key),
        )
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
  void test(`${record.id}: ${record.status === 'generated' ? 'source-pacing migration is explicit' : 'explicit refusal is unchanged'}`, () => {
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
      const migration = sourcePacing.protected.find((c) => c.id === record.id);
      assert.ok(
        migration,
        'A benchmark prescription change needs an explicit versioned migration',
      );
      assert.equal(migration.previousHash, record.protectedHash);
      assertSourcePacingMigration(plan, input, record.weeks);
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
          migration.weeks[week.index].expectedHash,
          `Week ${week.index + 1} prescription changed`,
        );
      }
      assert.equal(
        hash(plan),
        migration.expectedHash,
        'Full plan/profile/notes/feasibility changed',
      );
    }
    assert.deepEqual(input, before, 'Generation mutated profile input');
  });
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makePlan } from '../lib/engine.ts';
import { marathonSnapshot } from './road-overhaul-helpers.mjs';
import { assertMarathonTraining } from './marathon-variety-contract.mjs';
import { marathonExecutionHash } from './pacing-marathon-contract.mjs';
import { assertSourcePacingMigration } from './source-pacing-migration-contract.mjs';
const sourcePacing = JSON.parse(
  readFileSync(
    new URL('./fixtures/source-pacing-v1-migrations.json', import.meta.url),
    'utf8',
  ),
);

// Every earlier fixture remains immutable. The new snapshot has an explicit
// link to the pacing baseline and reviewed executable differences, with separate
// semantic checks for the input, frequency, dose, targets, progression and caps.
const baseline = JSON.parse(
  readFileSync(
    new URL('./fixtures/road-overhaul-marathon.json', import.meta.url),
    'utf8',
  ),
);
const pacing = JSON.parse(
  readFileSync(
    new URL('./fixtures/pacing-v1-marathon.json', import.meta.url),
    'utf8',
  ),
);

const variety = JSON.parse(
  readFileSync(
    new URL('./fixtures/marathon-variety-v1.json', import.meta.url),
    'utf8',
  ),
);

test('the marathon variety fixture versions all prior cases without replacing their evidence', () => {
  assert.equal(variety.previousFixture, 'pacing-v1-marathon.json');
  assert.deepEqual(
    variety.cases.map((c) => c.name),
    baseline.cases.map((c) => c.name),
  );
});

for (const scenario of baseline.cases) {
  test(`marathon variety and session balance preserve the reviewed contract: ${scenario.name}`, () => {
    const input = structuredClone(scenario.input);
    const before = structuredClone(input);
    const plan = makePlan(input, input.startDate, false);
    assert.deepEqual(input, before, 'generation must not mutate input');
    const migration = pacing.cases.find((c) => c.name === scenario.name);
    assert.ok(migration, 'Every original case must remain represented');
    assert.equal(migration.originalSnapshot, scenario.expected.complete);
    const reviewed = variety.cases.find((c) => c.name === scenario.name);
    assert.equal(reviewed.previousSnapshot, migration.expected.complete);
    if (!migration.paceModelChanged)
      assert.equal(reviewed.previousExecution, migration.originalExecution);
    assertMarathonTraining(plan, input);
    const sourceMigration = sourcePacing.marathon.find(
      (c) => c.name === scenario.name,
    );
    if (sourceMigration) {
      assert.equal(
        sourceMigration.previousSnapshot,
        reviewed.expected.complete,
      );
      assert.equal(
        sourceMigration.previousExecution,
        reviewed.expectedExecution,
      );
      assertSourcePacingMigration(plan, input);
    }
    // Preserve the exact older snapshots for all legacy fields. New provenance
    // is independently validated; it must not hide endpoint/target changes.
    for (const workout of plan.workouts)
      for (const step of workout.steps) {
        delete step.pacing;
        delete step.paceInstruction;
      }
    if (sourceMigration) {
      assert.equal(
        marathonExecutionHash(plan),
        sourceMigration.expectedExecution,
      );
      return assert.deepEqual(marathonSnapshot(plan), sourceMigration.expected);
    }
    if (reviewed.executionUnchanged)
      assert.equal(marathonExecutionHash(plan), reviewed.previousExecution);
    assert.equal(marathonExecutionHash(plan), reviewed.expectedExecution);
    assert.deepEqual(marathonSnapshot(plan), reviewed.expected);
  });
}

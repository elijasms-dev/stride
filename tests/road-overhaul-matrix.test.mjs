import test from 'node:test';
import assert from 'node:assert/strict';
import { taperFactor } from '../lib/engine.ts';
import { roadOverhaulCases, roadProfile } from './road-overhaul-cases.mjs';
import { executeRoadScenario } from './road-overhaul-contract.mjs';
import { dayAfter } from './road-overhaul-helpers.mjs';

for (const scenario of roadOverhaulCases()) {
  test(`road overhaul contract: ${scenario.id}`, () => {
    const result = executeRoadScenario(scenario);
    assert.deepEqual(result.failures, []);
  });
}

for (const [goal, taperDays] of [
  ['5k', 7],
  ['10k', 7],
  ['half', 14],
]) {
  test(`${goal} taper begins exactly ${taperDays} days before the race`, () => {
    const p = roadProfile(goal, 'advanced', 2);
    for (let days = taperDays + 1; days <= taperDays + 14; days++)
      assert.equal(taperFactor(p, dayAfter(p.raceDate, -days)), 1);
    for (let days = 1; days <= taperDays; days++)
      assert.ok(taperFactor(p, dayAfter(p.raceDate, -days)) < 1);
  });
}

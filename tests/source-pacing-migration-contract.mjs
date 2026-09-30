import assert from 'node:assert/strict';

/** Independent arithmetic and history checks for the explicit retirement of
 * universal pace zones. These establish migration consistency, not coaching
 * validation or equivalence to a complete external training programme. */
export function assertSourcePacingMigration(plan, input, priorWeeks) {
  for (const key of [
    'weeklyKm',
    'longestKm',
    'currentRuns',
    'raceDate',
    'recentRace',
  ])
    assert.deepEqual(plan.profile[key], input[key], `Declared ${key} changed`);
  const sourceSteps = plan.workouts.flatMap((w) => w.steps);
  assert.ok(sourceSteps.length > 0);
  for (const step of sourceSteps) {
    assert.equal(
      step.target,
      undefined,
      'An unconfirmed result cannot prescribe numerical pace',
    );
    assert.equal(step.pacing?.method, 'effort');
    assert.equal(step.pacing?.target, undefined);
    assert.ok(Number.isFinite(step.seconds) && step.seconds > 0);
    if (step.metres !== undefined)
      assert.ok(Number.isFinite(step.metres) && step.metres > 0);
  }
  for (const week of plan.weeks) {
    const all = plan.workouts.filter((w) => w.week === week.index);
    const runs = all.filter((w) => w.kind !== 'race' && w.status !== 'skipped');
    assert.ok(
      Math.abs(week.targetKm - runs.reduce((n, w) => n + w.estimatedKm, 0)) <=
        0.051,
    );
    assert.ok(
      Math.abs(
        week.trainingMinutes -
          runs.reduce(
            (n, w) => n + w.steps.reduce((m, s) => m + s.seconds / 60, 0),
            0,
          ),
      ) < 1e-6,
    );
    for (const run of runs)
      assert.ok(
        Math.abs(
          run.minutes - run.steps.reduce((n, s) => n + s.seconds / 60, 0),
        ) < 1e-6,
      );
    if (!priorWeeks) continue;
    const previous = priorWeeks[week.index];
    assert.equal(week.phase, previous.phase);
    assert.deepEqual(
      all.map((w) => w.date),
      previous.runs.map((w) => w.date),
      'Pace migration cannot move dates or add sessions',
    );
    if (!['Taper', 'Race week', 'Recovery'].includes(week.phase)) {
      const quality = runs.filter(
        (w) => w.kind !== 'long' && w.hard && w.stimulus !== 'economy',
      );
      assert.equal(
        quality.length,
        previous.weekdayQuality,
        'Ordinary-week frequency changed',
      );
    }
  }
}

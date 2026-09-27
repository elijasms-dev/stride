import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makePlan,
  validatePlan,
  refreshWeekTotals,
  demoProfile,
  addDays,
} from '../lib/engine.ts';
const start = '2026-09-21';
function input(goal = 'marathon', qualitySessions = 1) {
  return {
    ...demoProfile(start),
    goal,
    weeklyKm: 65,
    longestKm: 23,
    currentRuns: 5,
    runsPerWeek: 5,
    availableDays: [0, 1, 2, 3, 4, 5, 6],
    days: [0, 1, 2, 4, 6],
    longDay: 6,
    weekdayMinutes: 120,
    longMinutes: 300,
    qualityMode: 'custom',
    qualitySessions,
    recentQualitySessions: qualitySessions,
    recentQualityMinutes: 40,
    runMeasure: 'distance',
  };
}
function mutate(profile, operation) {
  const plan = makePlan(profile, start, false);
  operation(plan);
  refreshWeekTotals(plan);
  return plan;
}
for (const quality of [0, 1, 2])
  test(`an untouched marathon cannot lose a selected running day at q${quality}`, () => {
    const plan = mutate(input('marathon', quality), (p) => {
      const victim = p.workouts.find(
        (w) =>
          w.week === 1 &&
          (quality ? w.hard && w.kind !== 'long' : w.kind === 'easy'),
      );
      p.workouts = p.workouts.filter((w) => w !== victim);
    });
    assert.ok(
      validatePlan(plan).some((e) =>
        /retain all.*selected running days/.test(e),
      ),
    );
  });
for (const quality of [1, 2])
  test(`an untouched marathon cannot hide selected quality behind an easy label at q${quality}`, () => {
    const plan = mutate(input('marathon', quality), (p) => {
      const victim = p.workouts.find(
        (w) => w.week === 1 && w.hard && w.kind !== 'long',
      );
      victim.kind = 'easy';
      victim.hard = false;
      victim.steps = victim.steps.map((s) => ({
        ...s,
        kind: 'aerobic',
        intensity: 2,
      }));
    });
    assert.ok(
      validatePlan(plan).some((e) =>
        /exactly.*complete weekday workouts/.test(e),
      ),
    );
  });
test('a zero-workout marathon rejects sustained work hidden behind easy flags', () => {
  const plan = mutate(input('marathon', 0), (p) => {
    const victim = p.workouts.find((w) => w.week === 1 && w.kind === 'easy');
    victim.steps = [
      {
        label: 'Hidden tempo',
        seconds: 600,
        kind: 'work',
        intensity: 4,
        effort: 'Tempo',
      },
      {
        label: 'Easy',
        seconds: victim.minutes * 60 - 600,
        kind: 'aerobic',
        intensity: 2,
        effort: 'Easy',
      },
    ];
  });
  assert.ok(
    validatePlan(plan).some((e) =>
      /exactly 0 complete weekday workouts/.test(e),
    ),
  );
});
test('an untouched marathon rejects a large long-run jump without relying on adjacent sessions', () => {
  const plan = mutate(input('marathon', 0), (p) => {
    for (const w of p.workouts) {
      if (
        w.week < 1 ||
        w.kind !== 'long' ||
        ['Recovery', 'Taper', 'Race week'].includes(p.weeks[w.week].phase)
      )
        continue;
      w.estimatedKm += 8;
      w.minutes += 48;
      w.steps.push({
        label: 'Extra easy',
        kind: 'aerobic',
        intensity: 2,
        seconds: 2880,
        metres: 8000,
        effort: 'Easy',
      });
    }
  });
  assert.ok(
    validatePlan(plan).some((e) => /long run by more than 2 km/.test(e)),
  );
  assert.ok(validatePlan(plan).some((e) => /event long-run ceiling/.test(e)));
});
for (const goal of ['5k', 'half'])
  test(`${goal} rejects a weekly load spike that stays within per-run time limits`, () => {
    const profile = {
      ...input(goal, 0),
      weeklyKm: goal === '5k' ? 55 : 65,
      longestKm: goal === '5k' ? 12 : 18,
    };
    const plan = mutate(profile, (p) => {
      for (const w of p.workouts) {
        if (
          w.week < 1 ||
          w.kind !== 'easy' ||
          ['Recovery', 'Taper', 'Race week'].includes(p.weeks[w.week].phase)
        )
          continue;
        w.estimatedKm += 5;
        w.minutes += 30;
        w.steps.push({
          label: 'Extra easy',
          kind: 'aerobic',
          intensity: 2,
          seconds: 1800,
          metres: 5000,
          effort: 'Easy',
        });
      }
    });
    assert.ok(
      validatePlan(plan).some((e) =>
        /forecast ceiling|weekly progression allowance/.test(e),
      ),
    );
  });
test('reviewed history, manual changes and old policies retain their validation scope', () => {
  for (const mode of ['history', 'manual', 'old-policy']) {
    const p = makePlan(input('marathon', 0), start, false);
    const victim = p.workouts.find((w) => w.week === 1 && w.kind === 'easy');
    p.workouts = p.workouts.filter((w) => w !== victim);
    if (mode === 'history')
      p.baselineEvidence = {
        source: 'recorded-plan-history',
        weeklyKm: 65,
        weeklyMinutes: 390,
        longestKm: 23,
        longestMinutes: 138,
        supportsProgression: false,
      };
    if (mode === 'manual') p.workouts.find((w) => w.week === 1).changed = true;
    if (mode === 'old-policy') p.policyVersion = 'old-policy';
    refreshWeekTotals(p);
    assert.ok(
      !validatePlan(p).some((e) =>
        /selected running days|forecast ceiling|weekly progression allowance/.test(
          e,
        ),
      ),
      mode,
    );
  }
});

test('sustained work must retain its demanding flag instead of escaping spacing through easy metadata', () => {
  const plan = mutate(input('marathon', 1), (p) => {
    const victim = p.workouts.find(
      (w) => w.week === 1 && w.hard && w.kind !== 'long',
    );
    victim.hard = false;
    victim.kind = 'easy';
  });
  assert.ok(
    validatePlan(plan).some((e) => /complete weekday workouts/.test(e)),
  );
});

test('a one-second fast fragment cannot satisfy a selected complete marathon workout', () => {
  const plan = mutate(input('marathon', 1), (p) => {
    const victim = p.workouts.find(
      (w) => w.week === 1 && w.hard && w.kind !== 'long',
    );
    victim.steps = [
      {
        label: 'Fast fragment',
        seconds: 1,
        kind: 'work',
        intensity: 6,
        effort: 'Hard',
      },
      {
        label: 'Easy',
        seconds: victim.minutes * 60 - 1,
        kind: 'aerobic',
        intensity: 2,
        effort: 'Easy',
      },
    ];
    victim.qualityMinutes = 1 / 60;
  });
  assert.ok(
    validatePlan(plan).some((e) => /complete weekday workouts/.test(e)),
  );
});

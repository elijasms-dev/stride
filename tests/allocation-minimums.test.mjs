// Portable isolated regressions: source execution only; no provider, database, or saved-state writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
const lib = existsSync(new URL('./stride/lib/engine.ts', import.meta.url))
  ? new URL('./stride/lib/', import.meta.url)
  : new URL('../lib/', import.meta.url);
const { makePlan, demoProfile, addDays, revisePreferences } = await import(
  new URL('engine.ts', lib)
);
const { currentTrainingBaseline } = await import(
  new URL('training-history.ts', lib)
);
const { allocateRunningMinutes } = await import(
  new URL('training-structure.ts', lib)
);
const start = '2026-09-07';
const slots = Object.freeze(
  [0, 1, 2, 3].map((n) =>
    Object.freeze({ key: String(n), weight: 1, cap: 100 }),
  ),
);

void test('underfunded allocation remains bounded without a RangeError', () => {
  const before = structuredClone(slots);
  const values = [...allocateRunningMinutes(16, slots).values()];
  assert.ok(values.every((n) => Number.isInteger(n) && n >= 0 && n <= 5));
  assert.equal(
    values.reduce((total, n) => total + n, 0),
    16,
  );
  assert.deepEqual(slots, before);
});

void test('exact and fractional feasible allocation budgets never invent minutes', () => {
  for (const budget of [20, 20.9, 21, 26.7, 34.9]) {
    const values = [...allocateRunningMinutes(budget, slots).values()];
    assert.equal(values.length, slots.length);
    assert.ok(values.every((n) => Number.isInteger(n) && n >= 5));
    assert.equal(
      values.reduce((n, v) => n + v, 0),
      Math.floor(budget),
    );
  }
});

function lowDurationHistory(easyMinutes, longMinutes) {
  const plan = makePlan(
    {
      ...demoProfile(start),
      goal: 'base',
      raceDate: addDays(start, 111),
      weeklyKm: 30,
      longestKm: 10,
      currentRuns: 5,
      days: [0, 1, 3, 4, 6],
      longDay: 6,
      qualitySessions: 0,
      volume: 'maintain',
    },
    start,
  );
  const asOf = addDays(start, 28);
  for (const w of plan.workouts.filter((w) => w.date < asOf)) {
    const minutes = w.kind === 'long' ? longMinutes : easyMinutes;
    w.status = 'completed';
    w.feedback = {
      actualDate: w.date,
      actualMinutes: minutes,
      actualKm: minutes / 6,
      effort: 3,
      feeling: 'good',
      note: 'Synthetic recorded running',
      recordedAt: w.date + 'T18:00:00Z',
    };
  }
  return { plan, asOf, baseline: currentTrainingBaseline(plan, asOf) };
}

void test('a real 26-minute recorded baseline rejects a recovery week that cannot fit five running days, without journal mutation', () => {
  const { plan, asOf, baseline } = lowDurationHistory(4, 10),
    before = structuredClone(plan);
  assert.equal(baseline.weeklyMinutes, 26);
  assert.equal(baseline.longestMinutes, 10);
  assert.equal(baseline.supportsProgression, false);
  assert.throws(
    () => revisePreferences(plan, { difficulty: 'gentle' }, asOf),
    /minimum|five|5|review|minutes|budget/i,
  );
  assert.deepEqual(
    plan,
    before,
    'Failed replanning must leave every original workout and feedback record intact',
  );
});

void test('when every week can fit minima, ordinary sessions and the long run share the recorded budget', () => {
  const { plan, asOf, baseline } = lowDurationHistory(5, 15),
    before = structuredClone(plan);
  assert.equal(baseline.weeklyMinutes, 35);
  const revised = revisePreferences(plan, { difficulty: 'gentle' }, asOf);
  for (const w of revised.weeks.filter(
    (w) => w.start >= asOf && addDays(w.start, 6) <= plan.profile.raceDate,
  )) {
    const runs = revised.workouts.filter(
      (r) => r.week === w.index && r.status === 'planned' && r.kind !== 'race',
    );
    const total = runs.reduce(
      (n, r) => n + r.steps.reduce((n, s) => n + s.seconds, 0) / 60,
      0,
    );
    const ceiling =
      baseline.weeklyMinutes * (w.phase === 'Recovery' ? 0.82 : 1);
    assert.equal(runs.length, 5);
    assert.ok(runs.every((r) => r.minutes >= 5));
    assert.ok(
      total <= ceiling + 0.01,
      `${w.phase}: ${total} exceeds recorded allocation ${ceiling}`,
    );
    assert.ok(
      runs
        .filter((r) => r.kind === 'long')
        .every((r) => r.minutes <= baseline.longestMinutes),
    );
  }
  assert.deepEqual(plan, before);
  assert.deepEqual(
    revised.workouts.filter((w) => w.status === 'completed'),
    plan.workouts.filter((w) => w.status === 'completed'),
  );
});

void test('unknown to confirmed zero quality history is saved while actual completed runs remain byte-identical', () => {
  const plan = makePlan(demoProfile(start), start),
    asOf = addDays(start, 7);
  assert.equal(Object.hasOwn(plan.profile, 'recentQualitySessions'), false);
  for (const w of plan.workouts.filter((w) => w.date < asOf)) {
    w.status = 'completed';
    w.feedback = {
      actualDate: w.date,
      actualMinutes: w.minutes,
      actualKm: w.estimatedKm,
      effort: 3,
      feeling: 'good',
      execution: 'as-planned',
      note: 'Synthetic completed session',
      recordedAt: w.date + 'T18:00:00Z',
    };
  }
  const before = structuredClone(plan),
    actual = JSON.stringify(
      plan.workouts.filter((w) => w.status === 'completed'),
    );
  const revised = revisePreferences(plan, { recentQualitySessions: 0 }, asOf);
  assert.equal(
    Object.hasOwn(revised.profile, 'recentQualitySessions'),
    true,
    'Confirmed none must be stored, not treated as missing',
  );
  assert.equal(revised.profile.recentQualitySessions, 0);
  assert.equal(
    revised.profile.recentQualityMinutes,
    undefined,
    'Do not invent an associated work duration',
  );
  assert.equal(
    JSON.stringify(revised.workouts.filter((w) => w.status === 'completed')),
    actual,
  );
  assert.deepEqual(
    plan,
    before,
    'Reviewing inputs does not mutate the original snapshot',
  );
  const repeated = revisePreferences(
    revised,
    { recentQualitySessions: 0 },
    asOf,
  );
  assert.deepEqual(
    repeated,
    revised,
    'Repeated confirmed-zero submission is a stable no-op',
  );
});

void test('an unrelated or empty preference review leaves unknown quality history absent', () => {
  const plan = makePlan(demoProfile(start), start);
  const next = revisePreferences(plan, {}, start);
  assert.equal(Object.hasOwn(next.profile, 'recentQualitySessions'), false);
  assert.deepEqual(next, plan);
});

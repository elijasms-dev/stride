// Isolated source-executing midweek review regressions. No APIs or user data.
// Portable unchanged from work/ into stride/tests/.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
const lib = existsSync(new URL('./stride/lib/engine.ts', import.meta.url))
  ? new URL('./stride/lib/', import.meta.url)
  : new URL('../lib/', import.meta.url);
const {
  makePlan,
  demoProfile,
  revisePreferences,
  validatePlan,
  addDays,
  TRAINING_POLICY,
} = await import(new URL('engine.ts', lib));
const start = '2026-09-08';
const inputs = (patch = {}) => ({
  ...demoProfile(start),
  startDate: start,
  name: 'Synthetic midweek runner',
  goal: 'marathon',
  raceDate: '2026-12-28',
  weeklyKm: 70,
  longestKm: 30,
  currentRuns: 5,
  days: [0, 1, 2, 3, 4, 5],
  runsPerWeek: 6,
  availableDays: [0, 1, 2, 3, 4, 5],
  longDay: 5,
  weekdayMinutes: 120,
  longMinutes: 180,
  easyPace: 6,
  recentQualitySessions: 2,
  qualityMode: 'custom',
  qualitySessions: 2,
  recentQualityMinutes: undefined,
  ...patch,
});
const source = (patch = {}) => {
  const p = makePlan(inputs(patch), start);
  p.policyVersion = 'provisional-2026-09-08-v9';
  p.engineVersion = 'stride-0.6.1';
  return p;
};
const completed = (w, minutes = w.minutes, actualDate = w.date) => {
  w.status = 'completed';
  w.feedback = {
    actualMinutes: minutes,
    actualKm: minutes / 6,
    actualDate,
    effort: 3,
    feeling: 'good',
    note: 'Synthetic recorded history',
    recordedAt: actualDate + 'T18:00:00Z',
  };
};
const sum = (ws) => ws.reduce((n, w) => n + w.minutes, 0);
const week = (p, index = 0) =>
  p.workouts.filter((w) => w.week === index && w.kind !== 'race');
const future = (p, asOf, index = 0) =>
  week(p, index).filter((w) => w.date >= asOf && w.status === 'planned');
const immutable = (p, asOf, index = 0) =>
  week(p, index).filter((w) => w.date < asOf || w.status === 'completed');
const reservation = (ws) =>
  ws.reduce(
    (n, w) =>
      n +
      Math.max(
        w.minutes,
        w.status === 'completed'
          ? (w.feedback?.actualMinutes ?? w.minutes)
          : w.minutes,
      ),
    0,
  );
function verify(before, next, snapshot, asOf) {
  assert.deepEqual(
    before,
    snapshot,
    'Review must never mutate its input journal',
  );
  assert.equal(next.id, before.id);
  assert.equal(next.policyVersion, TRAINING_POLICY.version);
  assert.deepEqual(validatePlan(next), []);
  assert.equal(
    new Set(next.workouts.map((w) => w.id)).size,
    next.workouts.length,
    'No duplicate retained workout identity',
  );
  assert.equal(
    new Set(next.workouts.map((w) => w.date)).size,
    next.workouts.length,
    'No generated replacement on an immutable date',
  );
  for (const old of before.workouts.filter(
    (w) => w.date < asOf || w.status === 'completed',
  ))
    assert.deepEqual(
      next.workouts.find((w) => w.id === old.id),
      old,
      'Completed and elapsed prescriptions remain byte-for-byte intact',
    );
  for (const w of next.workouts) {
    assert.ok(w.steps.every((s) => s.seconds > 0));
    assert.ok(
      Math.abs(w.steps.reduce((n, s) => n + s.seconds, 0) - w.minutes * 60) <
        0.01,
    );
  }
  assert.equal(next.workouts.filter((w) => w.kind === 'race').length, 1);
}

for (const status of ['unlogged', 'completed']) {
  for (const offset of [0, 1, 2, 3]) {
    void test(`${status} retained prefix: review ${addDays(start, offset)} does not progressively erase Saturday's long run`, () => {
      const p = source(),
        asOf = addDays(start, offset);
      for (const w of immutable(p, asOf))
        if (status === 'completed') completed(w);
      const before = structuredClone(p);
      const next = revisePreferences(p, {}, asOf);
      verify(p, next, before, asOf);
      const originalLong = p.workouts.find((w) => w.date === '2026-09-12');
      const long = next.workouts.find((w) => w.date === '2026-09-12');
      assert.ok(
        long.minutes >= originalLong.minutes - 1 &&
          long.minutes <= originalLong.minutes + 1,
        `${asOf}: unchanged active-week context changed the long run from ${originalLong.minutes} to ${long.minutes}`,
      );
      assert.ok(
        reservation(immutable(next, asOf)) + sum(future(next, asOf)) <= 350.01,
        'Opening five-of-six-day week remains within its 350-minute allocation',
      );
      assert.equal(
        week(next, 1).length,
        6,
        'Next full week preserves requested frequency',
      );
      if (status === 'unlogged')
        assert.ok(
          immutable(next, asOf).every(
            (w) => w.status === 'planned' && !w.feedback,
          ),
          'Allocation context must not become invented completed evidence',
        );
    });
  }
}

for (const status of ['skipped', 'shorter', 'longer']) {
  void test(`${status} prefix does not fund catch-up or double-count recorded time`, () => {
    const asOf = '2026-09-10',
      p = source();
    for (const w of immutable(p, asOf)) {
      if (status === 'skipped') {
        w.status = 'skipped';
        w.skipReason = 'Synthetic missed run';
      } else completed(w, w.minutes * (status === 'longer' ? 1.5 : 0.5));
    }
    const before = structuredClone(p),
      untouched = revisePreferences(source(), {}, asOf);
    const next = revisePreferences(p, {}, asOf);
    verify(p, next, before, asOf);
    assert.ok(
      sum(future(next, asOf)) <= sum(future(untouched, asOf)) + 0.01,
      'Missed or shorter running must not create extra future minutes; extra actual time also reduces room',
    );
    assert.ok(
      reservation(immutable(next, asOf)) + sum(future(next, asOf)) <= 350.01,
    );
    assert.ok(
      next.baselineEvidence.weeklyKm <= 70 &&
        next.baselineEvidence.weeklyMinutes <= 420,
      'A few recorded outings are not proof of a higher weekly baseline',
    );
  });
}

for (const actualMinutes of [90, 150]) {
  void test(`completed today reserves ${actualMinutes} actual minutes before remaining work is allocated`, () => {
    const asOf = '2026-09-09',
      p = source();
    const done = p.workouts.find((w) => w.date === asOf);
    completed(done, actualMinutes);
    const before = structuredClone(p),
      next = revisePreferences(p, {}, asOf);
    verify(p, next, before, asOf);
    assert.equal(next.workouts.filter((w) => w.date === asOf).length, 1);
    assert.ok(
      reservation(immutable(next, asOf)) + sum(future(next, asOf)) <= 350.01,
      'A completed-today workout must not replace a cheaper draft after the weekly budget is spent',
    );
    assert.ok(
      next.baselineEvidence.weeklyKm <= 70 &&
        next.baselineEvidence.weeklyMinutes <= 420,
      'Completed-today reservation is not capacity-progression evidence',
    );
  });
}

void test('a completed prescription dated later in the active week is retained once and debited before allocation', () => {
  const asOf = '2026-09-09',
    p = source();
  const done = p.workouts.find((w) => w.date === '2026-09-10');
  completed(done, 100, '2026-09-09');
  const before = structuredClone(p),
    next = revisePreferences(p, {}, asOf);
  verify(p, next, before, asOf);
  assert.equal(next.workouts.filter((w) => w.date === done.date).length, 1);
  assert.ok(
    reservation(immutable(next, asOf)) + sum(future(next, asOf)) <= 350.01,
  );
});

for (const patch of [
  { runsPerWeek: 5 },
  { runsPerWeek: 4, qualitySessions: 1 },
  { runsPerWeek: 5, days: [0, 2, 3, 4, 5], availableDays: [0, 2, 3, 4, 5] },
]) {
  void test(`midweek schedule revision ${JSON.stringify(patch)} preserves history and funds only the revised week`, () => {
    const asOf = '2026-09-09',
      p = source();
    completed(p.workouts.find((w) => w.date === start));
    const before = structuredClone(p),
      next = revisePreferences(p, patch, asOf);
    verify(p, next, before, asOf);
    const ordinaryWeekMinutes =
      420 * Math.min(1, next.profile.days.length / p.profile.days.length);
    const openingDays = next.profile.days.filter((d) => d >= 1).length; // Plan starts Tuesday.
    const openingBudget =
      (ordinaryWeekMinutes * openingDays) / next.profile.days.length;
    assert.ok(
      reservation(immutable(next, asOf)) + sum(future(next, asOf)) <=
        openingBudget + 0.01,
      'Changing requested days must not double-count the old prefix against the new week',
    );
    for (const w of future(next, asOf))
      assert.ok(
        next.profile.days.includes(
          new Date(w.date + 'T12:00:00Z').getUTCDay() === 0
            ? 6
            : new Date(w.date + 'T12:00:00Z').getUTCDay() - 1,
        ),
      );
    assert.equal(week(next, 1).length, patch.runsPerWeek);
  });
}

void test('newly enabling an already elapsed running day cannot move its nominal time into future workouts', () => {
  const p = source({
    days: [0, 1, 3, 4, 5],
    availableDays: [0, 1, 3, 4, 5],
    runsPerWeek: 5,
  });
  const asOf = '2026-09-10'; // Wednesday was unavailable and has passed.
  const before = structuredClone(p);
  const next = revisePreferences(
    p,
    { runsPerWeek: 6, availableDays: [0, 1, 2, 3, 4, 5] },
    asOf,
  );
  verify(p, next, before, asOf);
  const ordinaryNewDay = 420 / 6;
  const immutableReserve = reservation(immutable(next, asOf));
  assert.ok(
    immutableReserve + sum(future(next, asOf)) + ordinaryNewDay <= 350.01,
    'The newly enabled elapsed Wednesday is reserved, not redistributed into the remaining long run',
  );
  assert.equal(
    next.workouts.filter((w) => w.date === '2026-09-09').length,
    0,
    'Do not fabricate a past Wednesday prescription',
  );
  assert.equal(week(next, 1).length, 6);
});

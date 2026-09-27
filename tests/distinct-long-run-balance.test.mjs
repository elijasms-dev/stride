import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makePlan,
  revisePreferences,
  validatePlan,
  shortenWorkout,
  addDays,
} from '../lib/engine.ts';
import { savedQualityExamples } from '../scripts/audit-plan-quality.mjs';
import { needsSessionBalanceReview } from '../lib/plan/session-balance.ts';

const example = (id, patch = {}) => {
  const input = {
    ...savedQualityExamples().find((e) => e.id === id).input,
    ...patch,
  };
  return makePlan(input, input.startDate, false);
};
const runs = (plan, week) =>
  plan.workouts.filter((w) => w.week === week && w.kind !== 'race');
const snapshot = (p) =>
  p.workouts.map((w) => [w.date, w.kind, w.minutes, w.estimatedKm, w.steps]);

void test('the reported 30/8 km four-day 5K example has distinct roles and a disclosed 26 km opening', () => {
  const p = example('5k-q0');
  assert.deepEqual(
    runs(p, 0).map((w) => w.estimatedKm),
    [5.2, 6.4, 6.4, 8],
  );
  assert.equal(p.openingWeekKm, 26);
  assert.equal(p.profile.weeklyKm, 30);
  assert.equal(p.profile.longestKm, 8);
  assert.equal(
    p.notes.filter((n) => n.startsWith('Opening-week balance ·')).length,
    1,
  );
  assert.match(p.notes[0], /30 km\/week.*8 km.*26 km/);
  assert.deepEqual(validatePlan(p), []);
});

void test('half-marathon recovery retains distinct supporting roles beside its reduced long run', () => {
  // The supplied reference retains recovery for half and removes it from 5K.
  const p = example('half-q0');
  assert.equal(p.weeks[3].phase, 'Recovery');
  const recoveryLong = runs(p, 3).find((w) => w.kind === 'long');
  const previousLong = runs(p, 2).find((w) => w.kind === 'long');
  assert.ok(recoveryLong.estimatedKm < previousLong.estimatedKm);
  assert.ok(
    runs(p, 3)
      .filter((w) => w.kind === 'easy')
      .every((w) => w.estimatedKm <= recoveryLong.estimatedKm * 0.8 + 0.001),
  );
  const mutated = structuredClone(p);
  const easy = runs(mutated, 3).find((w) => w.kind === 'easy');
  easy.estimatedKm = recoveryLong.estimatedKm * 0.99;
  assert.ok(validatePlan(mutated).some((e) => /crowds the long run/.test(e)));
});

void test('a 13 km 5K long-run plateau cannot inflate ordinary easy runs to 11.9 km', () => {
  const p = example('5k-q2');
  for (const week of p.weeks) {
    const list = runs(p, week.index),
      long = list.find((w) => w.kind === 'long');
    if (!long) continue;
    for (const w of list.filter((w) => w.kind === 'easy'))
      assert.ok(
        w.estimatedKm <= long.estimatedKm * 0.8 + 0.001,
        `${w.date}: ${w.estimatedKm}/${long.estimatedKm}`,
      );
  }
});

void test('weekday support cannot rebound when taper removes the long-run slot', () => {
  const p = example('5k-q0');
  const lastLong = p.workouts.filter((w) => w.kind === 'long').at(-1);
  for (const w of p.workouts.filter(
    (w) => w.kind === 'easy' && w.date > lastLong.date,
  ))
    assert.ok(w.estimatedKm <= lastLong.estimatedKm * 0.8 + 0.001);
});

void test('weekly growth is bounded by the actual balanced week after a long-run step', () => {
  const p = example('5k-q0');
  const ordinary = p.weeks.filter(
    (w) =>
      !['Recovery', 'Taper', 'Race week'].includes(w.phase) &&
      runs(p, w.index).some((r) => r.kind === 'long'),
  );
  for (let i = 1; i < ordinary.length; i++) {
    const before = runs(p, ordinary[i - 1].index).reduce(
      (s, w) => s + w.estimatedKm,
      0,
    );
    const after = runs(p, ordinary[i].index).reduce(
      (s, w) => s + w.estimatedKm,
      0,
    );
    assert.ok(after >= before - 0.001);
    assert.ok(after <= before + Math.min(1.5, before * 0.06) + 0.001);
  }
});

void test('repeated full reviews do not ratchet down the disclosed opening allocation', () => {
  let p = example('5k-q1');
  const original = snapshot(p);
  for (let i = 0; i < 3; i++) {
    p = revisePreferences(p, {}, p.profile.startDate, true);
    assert.deepEqual(snapshot(p), original);
    assert.deepEqual(validatePlan(p), []);
  }
});

void test('a midweek entry does not repeatedly shrink two remaining outings toward zero', () => {
  const start = '2026-09-30';
  const p = example('5k-q1', {
    startDate: start,
    raceDate: addDays(start, 83),
  });
  const long = runs(p, 0).find((w) => w.kind === 'long');
  assert.ok(long.estimatedKm >= 4);
  assert.deepEqual(validatePlan(p), []);
});

void test('the low-long-run marathon profile also keeps supporting easy runs distinctly shorter', () => {
  const p = example('marathon-q0', {
    weeklyKm: 45,
    longestKm: 12,
    runsPerWeek: 4,
    currentRuns: 4,
    days: [0, 2, 4, 6],
  });
  const first = runs(p, 0),
    long = first.find((w) => w.kind === 'long');
  assert.equal(long.estimatedKm, 12);
  assert.ok(
    first
      .filter((w) => w.kind === 'easy' && w.role !== 'medium-long')
      .every((w) => w.estimatedKm <= 9.6 + 0.001),
  );
  assert.ok(p.openingWeekKm <= 45);
  assert.deepEqual(validatePlan(p), []);
});

void test('a deliberate shorter long run is an override and does not erase other saved sessions', () => {
  const p = example('5k-q0');
  const long = p.workouts.find((w) => w.kind === 'long' && w.week === 2);
  const shorter = shortenWorkout(p, long.id, 20, p.profile.startDate);
  assert.equal(shorter.workouts.find((w) => w.id === long.id).minutes, 20);
  assert.deepEqual(
    shorter.workouts.filter((w) => w.id !== long.id),
    p.workouts.filter((w) => w.id !== long.id),
  );
  assert.deepEqual(validatePlan(shorter), []);
});

void test('a forged lower opening allocation cannot bypass fresh-plan validation', () => {
  const p = example('5k-q0');
  p.openingWeekKm = 10;
  assert.ok(
    validatePlan(p).some((e) => /opening allocation must reflect/.test(e)),
  );
  p.openingWeekKm = NaN;
  assert.ok(
    validatePlan(p).some((e) => /Invalid opening weekly allocation/.test(e)),
  );
});

void test('old standard plans offer a review while new and foundation plans keep their own contract', () => {
  const p = example('5k-q0');
  assert.equal(needsSessionBalanceReview(p), false);
  delete p.sessionBalanceVersion;
  delete p.openingWeekKm;
  assert.equal(needsSessionBalanceReview(p), true);
  p.firstRace = { program: 'first-race-v1', goal: '5k' };
  assert.equal(needsSessionBalanceReview(p), false);
});

for (const goal of ['5k', '10k', 'half'])
  for (const qualitySessions of [1, 2])
    void test(`${goal} q${qualitySessions}: shorter timed support uses the executable pace even when declared easy pace is slower`, () => {
      const p = example(`${goal}-q${qualitySessions}`, {
        weeklyKm: goal === 'half' ? 60 : 50,
        longestKm: goal === '5k' ? 12 : goal === '10k' ? 14 : 18,
        currentRuns: 5,
        runsPerWeek: 5,
        days: [0, 1, 2, 4, 6],
        recentQualitySessions: 2,
        recentQualityMinutes: 40,
        easyPace: 6,
        runMeasure: 'time',
        recentRace: {
          distanceKm: 5,
          timeMinutes: 20,
          date: '2026-09-20',
          source: 'race',
          course: 'road',
        },
      });
      assert.deepEqual(validatePlan(p), []);
      for (const w of p.workouts.filter((w) => w.kind === 'easy')) {
        const step = w.steps.length === 1 ? w.steps[0] : undefined;
        if (step?.target?.mode === 'pace' && step.metres === undefined) {
          assert.ok(
            w.estimatedKm >= step.seconds / step.target.high - 0.0011,
            w.date,
          );
          assert.ok(
            w.estimatedKm <= step.seconds / step.target.low + 0.0011,
            w.date,
          );
        }
      }
    });

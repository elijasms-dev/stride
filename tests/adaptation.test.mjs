import test from 'node:test';
import assert from 'node:assert/strict';
import {
  demoProfile,
  makePlan,
  addDays,
  revisePreferences,
  adjustPlan,
  returnReview,
  advanceReturn,
  noviceReview,
  advanceRunWalk,
  shortenWorkout,
  validatePlan,
} from '../lib/engine.ts';
import { currentTrainingBaseline } from '../lib/training-history.ts';
const start = '2026-09-07',
  demo = demoProfile(start),
  gen = (p) => makePlan(p, p.startDate);
const complete = (w, patch = {}) =>
  Object.assign(w, {
    status: 'completed',
    feedback: {
      actualDate: w.date,
      actualMinutes: w.minutes,
      actualKm: w.estimatedKm,
      effort: 3,
      feeling: 'good',
      execution: 'as-planned',
      note: '',
      recordedAt: w.date + 'T18:00:00Z',
      ...patch,
    },
  });
const novice = {
  ...demo,
  goal: 'base',
  weeklyKm: 8,
  longestKm: 2,
  currentRuns: 4,
  days: [0, 2, 4, 6],
  longDay: 6,
  experience: 'new',
  weekdayMinutes: 40,
  longMinutes: 60,
};
void test('unknown or sparse logs do not certify projected progression; resolved rest lowers the baseline', () => {
  for (const mode of ['none', 'partial', 'skipped']) {
    const p = gen(demo),
      asOf = addDays(start, 28),
      past = p.workouts.filter((w) => w.date < asOf);
    if (mode === 'partial') past.slice(0, 2).forEach((w) => complete(w));
    if (mode === 'skipped') past.forEach((w) => (w.status = 'skipped'));
    const before = JSON.stringify(past),
      baseline = currentTrainingBaseline(p, asOf);
    if (mode === 'skipped') {
      assert.ok(baseline.weeklyKm < demo.weeklyKm);
      const saved = structuredClone(p);
      assert.throws(
        () => revisePreferences(p, { difficulty: 'gentle' }, asOf),
        /recent recorded running is too limited/,
      );
      assert.deepEqual(
        p,
        saved,
        'Resolved rest cannot be inflated into a minimum-sized running schedule',
      );
      continue;
    }
    const next = revisePreferences(p, { difficulty: 'gentle' }, asOf);
    assert.equal(
      JSON.stringify(next.workouts.filter((w) => w.date < asOf)),
      before,
    );
    assert.equal(baseline.weeklyKm, demo.weeklyKm);
    assert.equal(baseline.source, 'declared-baseline');
    assert.ok(next.weeks[4].targetKm <= demo.weeklyKm + 1);
  }
});
void test('return needs recent comfortable runs on distinct days and restores duration in stages', () => {
  const p = adjustPlan(gen(demo), start, addDays(start, 6), 'rest', start),
    asOf = addDays(start, 14);
  p.workouts
    .filter((w) => w.status === 'planned' && w.date < asOf)
    .slice(0, 3)
    .forEach((w) => complete(w));
  assert.equal(returnReview(p, asOf).ready, true);
  assert.equal(returnReview(p, addDays(asOf, 28)).ready, false);
  const next = advanceReturn(p, asOf);
  assert.equal(next.returnState.stage, 2);
  assert.ok(
    !next.workouts.some((w) => w.date >= asOf && w.hard && w.kind !== 'race'),
  );
  const long = next.workouts.find((w) => w.date >= asOf && w.kind === 'long');
  assert.ok(long.minutes > p.workouts.find((w) => w.id === long.id).minutes);
  assert.throws(() => advanceReturn(next, asOf), /comfortable|stage/);
  const edit = revisePreferences(next, { weekdayMinutes: 90 }, asOf);
  assert.equal(edit.returnState.stage, 2);
  assert.deepEqual(validatePlan(edit), []);
});
void test('race can be deferred for rest and stays deferred through ordinary preferences', () => {
  const p = gen(demo),
    from = addDays(p.profile.raceDate, -3),
    rest = adjustPlan(p, from, p.profile.raceDate, 'rest', from);
  const next = revisePreferences(rest, { weekdayMinutes: 60 }, from);
  assert.equal(next.workouts.find((w) => w.kind === 'race').status, 'skipped');
  assert.equal(next.feasibility.status, 'event-deferred');
});
void test('run walk holds its current running interval across the forecast and shortening retains walks', () => {
  const p = gen(novice);
  assert.ok(
    p.workouts.every(
      (w) =>
        Math.max(
          ...w.steps.filter((s) => s.movement === 'run').map((s) => s.seconds),
        ) <= 60,
    ),
  );
  const original = p.workouts.find((w) => w.date === addDays(start, 7)),
    next = shortenWorkout(p, original.id, 9, start).workouts.find(
      (w) => w.id === original.id,
    );
  assert.ok(next.steps.some((s) => s.movement === 'walk'));
  assert.ok(
    next.steps
      .filter((s) => s.movement === 'run')
      .reduce((n, s) => n + s.seconds, 0) <=
      original.steps
        .filter((s) => s.movement === 'run')
        .reduce((n, s) => n + s.seconds, 0),
  );
});
void test('a tired fourth run holds novice progression even with three comfortable logs', () => {
  const p = gen(novice),
    asOf = addDays(start, 7);
  p.workouts
    .filter((w) => w.date < asOf)
    .forEach((w) =>
      complete(
        w,
        w.date === addDays(start, 6) ? { effort: 8, feeling: 'tired' } : {},
      ),
    );
  assert.equal(noviceReview(p, asOf).ready, false);
  assert.throws(() => advanceRunWalk(p, asOf), /recovery/);
  const tired = p.workouts.find((w) => w.feedback?.feeling === 'tired');
  tired.feedback.feeling = 'good';
  tired.feedback.effort = 3;
  assert.equal(noviceReview(p, asOf).ready, true);
  const advanced = advanceRunWalk(p, asOf);
  assert.equal(advanced.profile.runWalkStage, 1);
  assert.ok(advanced.weeks[1].targetKm <= p.weeks[1].targetKm + 1);
});

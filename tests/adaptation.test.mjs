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
import { savedQualityExamples } from '../scripts/audit-plan-quality.mjs';
import { validateRecovery } from '../lib/recovery.ts';
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

const balancedInput = (id = '5k-q0', patch = {}) => ({
  ...savedQualityExamples().find((example) => example.id === id).input,
  ...patch,
});
const prescriptions = (plan) =>
  plan.workouts.map((w) => ({
    id: w.id,
    date: w.date,
    kind: w.kind,
    status: w.status,
    minutes: w.minutes,
    estimatedKm: w.estimatedKm,
    steps: w.steps,
  }));

for (const id of ['5k-q0', '5k-q1', 'marathon-q0', 'marathon-q2']) {
  for (const offset of [1, 3, 7, 10, 17]) {
    void test(`${id}: three reviews ${offset} days after starting cannot compound shorter supporting runs`, () => {
      const input = balancedInput(id),
        asOf = addDays(input.startDate, offset);
      let plan = makePlan(input, input.startDate, false);
      const past = plan.workouts.filter((w) => w.date < asOf);
      if (past[0]) complete(past[0]);
      if (past[1]) past[1].status = 'skipped';
      const history = structuredClone(past),
        original = structuredClone(plan);
      plan = revisePreferences(plan, {}, asOf, true);
      const first = prescriptions(plan),
        firstBudget = structuredClone(plan.allocationBaseline);
      for (let i = 0; i < 2; i++) {
        plan = revisePreferences(plan, {}, asOf, true);
        assert.deepEqual(prescriptions(plan), first);
        assert.deepEqual(plan.allocationBaseline, firstBudget);
        assert.deepEqual(
          plan.workouts.filter((w) => w.date < asOf),
          history,
        );
        assert.equal(plan.profile.weeklyKm, input.weeklyKm);
        assert.equal(plan.profile.longestKm, input.longestKm);
        assert.equal(plan.baselineEvidence.supportsProgression, false);
        assert.deepEqual(validatePlan(plan), []);
      }
      assert.deepEqual(
        original.workouts.filter((w) => w.date < asOf),
        history,
      );
    });
  }
}

void test('five-to-four-day reviews apply the frequency reduction once without restoring the old workload', () => {
  const input = balancedInput('5k-q0', {
      currentRuns: 5,
      runsPerWeek: 5,
      days: [0, 1, 3, 4, 6],
      availableDays: [0, 1, 2, 3, 4, 5, 6],
    }),
    asOf = addDays(input.startDate, 7),
    initial = makePlan(input, input.startDate, false);
  const history = structuredClone(
    initial.workouts.filter((w) => w.date < asOf),
  );
  let plan = revisePreferences(initial, { runsPerWeek: 4 }, asOf);
  const first = prescriptions(plan);
  for (let i = 0; i < 3; i++) {
    assert.equal(currentTrainingBaseline(plan, asOf).weeklyKm, 24);
    assert.equal(plan.allocationBaseline.weeklyKm, 24);
    assert.equal(plan.profile.weeklyKm, 30);
    assert.equal(plan.profile.currentRuns, 5);
    assert.equal(plan.profile.runsPerWeek, 4);
    assert.deepEqual(
      plan.workouts.filter((w) => w.date < asOf),
      history,
    );
    plan = revisePreferences(plan, {}, asOf, true);
    assert.deepEqual(prescriptions(plan), first);
    assert.deepEqual(validatePlan(plan), []);
  }
});

void test('repeated full reviews retain lower weekday and weekly time ceilings', () => {
  const input = balancedInput(),
    asOf = addDays(input.startDate, 7);
  let plan = makePlan(input, input.startDate, false);
  plan = revisePreferences(
    plan,
    { weekdayMinutes: 35, weeklyMinutesLimit: 160 },
    asOf,
  );
  plan = revisePreferences(plan, {}, asOf, true);
  const first = prescriptions(plan);
  for (let i = 0; i < 3; i++) {
    const upcoming = plan.workouts.filter(
      (w) => w.date >= asOf && w.kind !== 'race',
    );
    assert.ok(
      upcoming.filter((w) => w.kind !== 'long').every((w) => w.minutes <= 35),
    );
    for (const week of plan.weeks.filter((w) => w.start >= asOf))
      assert.ok(
        upcoming
          .filter((w) => w.week === week.index)
          .reduce((sum, w) => sum + w.minutes, 0) <=
          160 + 0.001,
      );
    assert.equal(plan.allocationBaseline.weeklyMinutes, 160);
    plan = revisePreferences(plan, {}, asOf, true);
    assert.deepEqual(prescriptions(plan), first);
    assert.deepEqual(validatePlan(plan), []);
  }
});

void test('returning-runner caution does not compound on repeated reviews of the same evidence', () => {
  const input = balancedInput('5k-q0', { experience: 'returning' }),
    asOf = addDays(input.startDate, 7);
  let plan = revisePreferences(
    makePlan(input, input.startDate, false),
    {},
    asOf,
    true,
  );
  const first = prescriptions(plan);
  assert.ok(
    plan.weeks[1].targetKm < 26,
    'The returning forecast still receives an initial reduction',
  );
  for (let i = 0; i < 3; i++) {
    plan = revisePreferences(plan, {}, asOf, true);
    assert.deepEqual(prescriptions(plan), first);
    assert.deepEqual(validatePlan(plan), []);
  }
});

void test('recorded lower training still supersedes the stored allocation budget', () => {
  const input = balancedInput(),
    asOf = addDays(input.startDate, 28);
  let plan = revisePreferences(
    makePlan(input, input.startDate, false),
    {},
    addDays(input.startDate, 1),
    true,
  );
  for (const w of plan.workouts.filter((w) => w.date < asOf))
    complete(w, {
      actualMinutes: w.minutes * 0.5,
      actualKm: w.estimatedKm * 0.5,
    });
  const history = structuredClone(plan.workouts.filter((w) => w.date < asOf)),
    evidence = currentTrainingBaseline(plan, asOf);
  assert.equal(evidence.source, 'recorded-plan-history');
  assert.equal(evidence.supportsProgression, false);
  assert.ok(evidence.weeklyKm < plan.allocationBaseline.weeklyKm * 0.6);
  assert.ok(
    evidence.weeklyMinutes < plan.allocationBaseline.weeklyMinutes * 0.6,
  );
  plan = revisePreferences(plan, {}, asOf, true);
  assert.ok(plan.allocationBaseline.weeklyKm <= evidence.weeklyKm);
  assert.deepEqual(
    plan.workouts.filter((w) => w.date < asOf),
    history,
  );
  assert.deepEqual(validatePlan(plan), []);
});

void test('recovery rejects malformed allocation budgets rather than using them as evidence', () => {
  const input = balancedInput(),
    plan = revisePreferences(
      makePlan(input, input.startDate, false),
      {},
      addDays(input.startDate, 1),
      true,
    );
  for (const allocationBaseline of [
    { weeklyKm: NaN, weeklyMinutes: 217 },
    { weeklyKm: 30, weeklyMinutes: -1 },
    { weeklyKm: '30', weeklyMinutes: 217 },
    { weeklyKm: 30 },
  ])
    assert.throws(
      () =>
        validateRecovery({
          format: 'stride-recovery-2',
          exportedAt: `${input.startDate}T18:00:00Z`,
          profile: null,
          plan: { ...structuredClone(plan), allocationBaseline },
        }),
      /recovery file/,
    );
});

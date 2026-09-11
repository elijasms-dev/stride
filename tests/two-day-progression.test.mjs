import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  demoProfile,
  makePlan,
  noviceReview,
  advanceRunWalk,
  adjustPlan,
  returnReview,
  advanceReturn,
  revisePreferences,
  validatePlan,
} from '../lib/engine.ts';
import { dailyGuide } from '../lib/daily-guide.ts';
import { validateRecovery } from '../lib/recovery.ts';

const start = '2026-08-31';
const asOf = '2026-09-11';
const profile = (patch = {}) => ({
  ...demoProfile(start),
  name: 'Synthetic two-day runner',
  goal: 'base',
  startDate: start,
  raceDate: '2026-11-29',
  experience: 'new',
  weeklyKm: 8,
  longestKm: 2,
  currentRuns: 2,
  runsPerWeek: 2,
  availableDays: [0, 1, 2, 3, 4, 5, 6],
  days: [1, 5],
  longDay: 5,
  weekdayMinutes: 40,
  longMinutes: 60,
  easyPace: null,
  qualitySessions: 0,
  recentQualitySessions: 0,
  recentQualityMinutes: 0,
  volume: 'maintain',
  ...patch,
});
const complete = (workout, patch = {}) =>
  Object.assign(workout, {
    status: 'completed',
    feedback: {
      actualDate: workout.date,
      actualMinutes: workout.minutes,
      actualKm: null,
      effort: 3,
      feeling: 'good',
      execution: 'as-planned',
      note: 'Synthetic progression check',
      recordedAt: workout.date + 'T18:00:00Z',
      ...patch,
    },
  });
const runWalk = () => makePlan(profile(), start);
function returning() {
  const before = addDays(start, -7);
  const plan = makePlan(
    profile({
      startDate: before,
      experience: 'established',
      weeklyKm: 20,
      longestKm: 8,
      easyPace: 6,
    }),
    before,
  );
  return adjustPlan(plan, before, addDays(start, -1), 'rest', before);
}
const logBefore = (plan, date) => {
  plan.workouts
    .filter((w) => w.status === 'planned' && w.date < date)
    .forEach((w) => complete(w));
  return plan;
};

for (const [name, create, review, advance] of [
  ['run-walk', runWalk, noviceReview, advanceRunWalk],
  ['return', returning, returnReview, advanceReturn],
]) {
  test(`${name}: following two runs a week can unlock an explicit review without extra runs`, () => {
    const plan = logBefore(create(), asOf);
    const before = structuredClone(plan);
    const result = review(plan, asOf);
    assert.equal(result.ready, true);
    assert.equal(result.windowDays, 14);
    assert.equal(result.completed, 3);
    assert.match(result.reason, /two weeks/);
    const next = advance(plan, asOf);
    assert.equal(
      name === 'return' ? next.returnState.stage : next.profile.runWalkStage,
      name === 'return' ? 2 : 1,
    );
    assert.deepEqual(
      next.workouts.filter((w) => w.date < asOf),
      plan.workouts.filter((w) => w.date < asOf),
    );
    assert.deepEqual(plan, before);
    assert.deepEqual(validatePlan(next), []);
    assert.ok(
      next.weeks.every(
        (week) =>
          new Set(
            next.workouts
              .filter((w) => w.week === week.index && w.status !== 'skipped')
              .map((w) => w.date),
          ).size <= 2,
      ),
    );
    assert.equal(review(next, asOf).ready, false);
  });

  test(`${name}: two logs, unlogged sessions and stale records cannot qualify`, () => {
    const p = create();
    assert.equal(review(p, asOf).ready, false);
    logBefore(p, '2026-09-07');
    assert.equal(review(p, asOf).ready, false);
    assert.throws(() => advance(p, asOf), /three|comfortable|stage/);
    logBefore(p, asOf);
    assert.equal(review(p, addDays(asOf, 20)).ready, false);
  });

  test(`${name}: actual dates, distinct days and today's fatigue override scheduling labels`, () => {
    const p = logBefore(create(), asOf);
    const logs = p.workouts.filter((w) => w.feedback);
    const last = logs.at(-1);
    last.feedback.actualDate = logs[0].date;
    assert.equal(review(p, asOf).ready, false);
    last.feedback.actualDate = asOf;
    assert.equal(review(p, asOf).ready, false);
    last.feedback.actualDate = last.date;
    assert.equal(review(p, asOf).ready, true);
    p.extraRuns = [
      {
        id: 'synthetic-extra',
        date: asOf,
        minutes: 10,
        km: null,
        effort: 8,
        feeling: 'tired',
        note: '',
        recordedAt: asOf + 'T12:00:00Z',
      },
    ];
    assert.equal(review(p, asOf).ready, false);
    assert.match(review(p, asOf).reason, /tired|recovery/);
  });

  test(`${name}: duplicate provider activities and short completions cannot establish three exposures`, () => {
    const p = logBefore(create(), asOf);
    const logs = p.workouts.filter((w) => w.feedback);
    for (const w of logs) w.feedback.activityId = 'same-synthetic-activity';
    assert.equal(review(p, asOf).ready, false);
    for (const w of logs) delete w.feedback.activityId;
    logs[0].feedback.actualMinutes = 1;
    assert.equal(review(p, asOf).ready, false);
  });

  test(`${name}: advancing cannot reuse preceding-stage logs seven days later`, () => {
    const p = logBefore(create(), asOf);
    const next = advance(p, asOf);
    const second = logBefore(next, addDays(asOf, 7));
    assert.equal(review(second, addDays(asOf, 7)).ready, false);
    assert.equal(review(second, addDays(asOf, 7)).completed, 2);
  });
}

test('three-day routines retain their seven-day review and cannot use older logs', () => {
  const p = makePlan(
    profile({
      currentRuns: 3,
      runsPerWeek: 3,
      days: [0, 2, 4],
      availableDays: [0, 2, 4],
      longDay: 4,
    }),
    start,
  );
  logBefore(p, addDays(start, 7));
  assert.equal(noviceReview(p, addDays(start, 7)).ready, true);
  assert.equal(noviceReview(p, addDays(start, 7)).windowDays, 7);
  assert.equal(noviceReview(p, addDays(start, 14)).ready, false);
});

test('a run completed before advancing on the transition date cannot certify the next interval stage', () => {
  const p = makePlan(
    profile({
      currentRuns: 3,
      runsPerWeek: 3,
      days: [0, 2, 4],
      availableDays: [0, 2, 4],
      longDay: 4,
    }),
    start,
  );
  const changeAt = addDays(start, 7);
  logBefore(p, addDays(changeAt, 1));
  const prior = structuredClone(p.workouts.find((w) => w.date === changeAt));
  const next = advanceRunWalk(p, changeAt);
  logBefore(next, addDays(changeAt, 7));
  assert.deepEqual(
    next.workouts.find((w) => w.date === changeAt),
    prior,
  );
  assert.equal(noviceReview(next, addDays(changeAt, 7)).ready, false);
  assert.equal(noviceReview(next, addDays(changeAt, 7)).completed, 2);
});

test('a frequency review starts a fresh observation window rather than inheriting old-stage evidence', () => {
  const reviewAt = addDays(start, 14);
  const p = logBefore(
    makePlan(
      profile({ currentRuns: 3, runsPerWeek: 3, days: [0, 2, 4] }),
      start,
    ),
    reviewAt,
  );
  const next = revisePreferences(p, { runsPerWeek: 2 }, reviewAt);
  assert.equal(noviceReview(next, reviewAt).ready, false);
  assert.equal(noviceReview(next, reviewAt).completed, 0);
});

test('return reviews exclude a completed prior-stage run on the transition date, but allow a new-stage run that day', () => {
  const changeAt = '2026-09-12';
  const reviewAt = '2026-09-21';
  for (const beforeAdvance of [true, false]) {
    const p = logBefore(returning(), changeAt);
    if (beforeAdvance) complete(p.workouts.find((w) => w.date === changeAt));
    const original = structuredClone(
      p.workouts.find((w) => w.date === changeAt),
    );
    const next = advanceReturn(p, changeAt);
    logBefore(next, reviewAt);
    if (beforeAdvance)
      assert.deepEqual(
        next.workouts.find((w) => w.date === changeAt),
        original,
      );
    assert.equal(returnReview(next, reviewAt).completed, beforeAdvance ? 2 : 3);
    assert.equal(returnReview(next, reviewAt).ready, !beforeAdvance);
    const legacy = structuredClone(next);
    for (const w of legacy.workouts) {
      delete w.returnStage;
      delete w.returnStageStarted;
    }
    assert.equal(returnReview(legacy, reviewAt).ready, false);
  }
});

test('return stage identity survives recovery exports and malformed partial stamps are rejected', () => {
  const p = logBefore(returning(), asOf);
  const exportFile = () =>
    JSON.parse(
      JSON.stringify({
        format: 'stride-recovery-2',
        exportedAt: new Date().toISOString(),
        profile: null,
        plan: p,
        standaloneRuns: [],
      }),
    );
  const restored = validateRecovery(exportFile()).plan;
  assert.equal(returnReview(restored, asOf).ready, true);
  assert.equal(
    restored.workouts.find((w) => w.returnStage)?.returnStageStarted,
    start,
  );
  for (const patch of [
    { returnStage: 3 },
    { returnStage: '1' },
    { returnStage: undefined },
    { returnStageStarted: 'not-a-date' },
    { returnStageStarted: undefined },
  ]) {
    const file = exportFile(),
      w = file.plan.workouts.find((w) => w.returnStage);
    Object.assign(w, patch);
    assert.throws(() => validateRecovery(file), /return stage/);
  }
});

test('daily guidance recognizes easy run/walk recoveries without treating speed-session walking as beginner training', () => {
  const p = runWalk(),
    w = p.workouts[0],
    before = structuredClone(w);
  const guide = dailyGuide(p, w.date, w);
  assert.equal(guide.sections[0].title, 'Keep the walking breaks');
  assert.match(
    guide.sections[0].paragraphs.join(' '),
    /repeating the current stage/,
  );
  assert.deepEqual(w, before);
  const quality = {
    ...w,
    hard: true,
    kind: 'intervals',
    steps: w.steps.map((s) => ({
      ...s,
      intensity: s.movement === 'run' ? 7 : 1,
    })),
  };
  assert.equal(
    dailyGuide(p, w.date, quality).sections[0].title,
    'Give the warm-up its space',
  );
});

import './ui-render-loader.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const { demoPlan, addDays } = await import('../lib/engine.ts');
const { weeklyTrainingReview } = await import('../lib/weekly-review.ts');
const { planPreferenceRows, comparePlanPreferences } =
  await import('../lib/plan-preferences-summary.ts');
const { PlanPreferencesSummary } =
  await import('../components/plan/plan-preferences-summary.tsx');
const { WeeklyReview } = await import('../components/plan/weekly-review.tsx');
const { PlanFit } = await import('../components/plan-fit.tsx');
const fixture = () => structuredClone(demoPlan('2026-09-21'));
const feedback = (date, extra = {}) => ({
  actualDate: date,
  actualMinutes: 40,
  actualKm: 7,
  effort: 3,
  feeling: 'good',
  note: '',
  recordedAt: `${date}T12:00:00Z`,
  ...extra,
});

test('routine exposes explicit two-workout choice separately from long run, even in taper', () => {
  const plan = fixture();
  plan.profile.qualityMode = 'custom';
  plan.profile.qualitySessions = 2;
  const html = renderToStaticMarkup(
    createElement(PlanPreferencesSummary, {
      profile: plan.profile,
      onEdit: () => {},
    }),
  );
  assert.match(html, /2 workouts · your choice/);
  assert.match(html, /separate from the long run/);
  assert.match(html, /Edit preferences/);
  const next = { ...plan.profile, units: 'mi', workoutVariety: 'familiar' };
  assert.equal(
    comparePlanPreferences(plan.profile, next).find(
      (r) => r.label === 'Weekday workouts',
    ).changed,
    false,
  );
  assert.equal(next.qualitySessions, 2);
});

test('zero workout choice and partial manual target priority are represented honestly', () => {
  const p = fixture().profile;
  p.qualityMode = 'custom';
  p.qualitySessions = 0;
  p.recentRace = { distanceKm: 5, timeMinutes: 25 };
  p.workoutTargets = { mode: 'pace', pace: { easy: { low: 350, high: 370 } } };
  const rows = planPreferenceRows(p);
  assert.match(
    rows.find((r) => r.label === 'Weekday workouts').value,
    /0 workouts/,
  );
  assert.match(
    rows.find((r) => r.label === 'Target source').value,
    /Saved pace ranges/,
  );
  assert.doesNotMatch(
    rows.find((r) => r.label === 'Target source').value,
    /benchmark/,
  );
  assert.equal(
    comparePlanPreferences(p, { ...p, qualitySessions: 2 }).find(
      (r) => r.label === 'Weekday workouts',
    ).changed,
    true,
  );
});

test('unit-only comparison does not claim a benchmark changed, while metadata remains visible', () => {
  const p = {
    ...fixture().profile,
    recentRace: {
      distanceKm: 21.0975,
      timeMinutes: 100,
      date: '2026-08-01',
      source: 'race',
      course: 'road',
    },
  };
  assert.equal(
    comparePlanPreferences(p, { ...p, units: 'mi' }).find(
      (r) => r.label === 'Benchmark',
    ).changed,
    false,
  );
  const row = comparePlanPreferences(p, {
    ...p,
    recentRace: { ...p.recentRace, date: '2026-08-08' },
  }).find((r) => r.label === 'Benchmark');
  assert.equal(row.changed, true);
  assert.match(row.before, /1 Aug 2026/);
  assert.match(row.after, /8 Aug 2026/);
});

test('weekly review uses actual dates, deduplicates imports, and does not invent unknown distances', () => {
  const p = fixture(),
    start = p.weeks[0].start,
    source = p.workouts[0];
  p.workouts = [
    {
      ...source,
      id: 'logged',
      week: -1,
      date: addDays(start, -7),
      status: 'completed',
      feedback: feedback(start, { activityId: 'a' }),
    },
    {
      ...source,
      id: 'unlogged',
      week: 0,
      date: addDays(start, 1),
      status: 'planned',
      estimatedKm: 100,
    },
    {
      ...source,
      id: 'moved',
      week: 0,
      date: start,
      status: 'completed',
      feedback: feedback(addDays(start, 8), { actualKm: 30 }),
    },
  ];
  p.extraRuns = [
    {
      id: 'duplicate',
      date: start,
      minutes: 40,
      km: 7,
      effort: 3,
      feeling: 'good',
      note: '',
      recordedAt: `${start}T12:00:00Z`,
      activityId: 'a',
    },
    {
      id: 'extra',
      date: addDays(start, 2),
      minutes: 20,
      km: null,
      effort: 3,
      feeling: 'good',
      note: '',
      recordedAt: `${start}T12:00:00Z`,
    },
  ];
  const snapshot = JSON.stringify(p),
    review = weeklyTrainingReview(p, 0, addDays(start, 3));
  assert.equal(review.records.length, 2);
  assert.equal(review.recordedMinutes, 60);
  assert.equal(review.knownKm, 7);
  assert.equal(review.unknownDistances, 1);
  assert.deepEqual(
    review.unresolved.map((w) => w.id),
    ['unlogged'],
  );
  assert.match(review.nextStep, /unknown/);
  const html = renderToStaticMarkup(
    createElement(WeeklyReview, {
      plan: p,
      weekIndex: 0,
      today: addDays(start, 3),
      onWorkout: () => {},
    }),
  );
  assert.match(html, /At least/);
  assert.match(html, /Records to review/);
  assert.equal(JSON.stringify(p), snapshot);
});

test('future weeks do not invite completion and today is not treated as missing', () => {
  const p = fixture(),
    start = p.weeks[0].start;
  assert.equal(weeklyTrainingReview(p, 0, addDays(start, -1)), null);
  assert.equal(weeklyTrainingReview(p, 0, start).unresolved.length, 0);
  assert.equal(weeklyTrainingReview(p, 0, addDays(start, 7)).finished, true);
});

test('race records stay separate and a completion flag without feedback creates no actual mileage', () => {
  const p = fixture(),
    start = p.weeks[0].start,
    source = p.workouts[0];
  p.extraRuns = [];
  p.workouts = [
    {
      ...source,
      id: 'race',
      kind: 'race',
      date: start,
      week: 0,
      status: 'completed',
      feedback: feedback(start, { actualKm: 42.195 }),
    },
    {
      ...source,
      id: 'missing',
      date: start,
      week: 0,
      status: 'completed',
      feedback: undefined,
    },
    {
      ...source,
      id: 'skipped',
      date: addDays(start, 1),
      week: 0,
      status: 'skipped',
    },
  ];
  const review = weeklyTrainingReview(p, 0, addDays(start, 3));
  assert.equal(review.recordedMinutes, 0);
  assert.equal(review.knownKm, 0);
  assert.equal(review.skipped, 1);
  assert.equal(review.missingFeedback.length, 1);
  assert.equal(review.qualityComplete, 0);
});

test('quality review requires explicit main-set execution and dose rather than whole-run duration', () => {
  const p = fixture(),
    start = p.weeks[0].start,
    source = p.workouts.find((w) => w.hard && w.kind !== 'race');
  assert.ok(source);
  p.extraRuns = [];
  p.workouts = [
    {
      ...source,
      id: 'quality',
      date: start,
      week: 0,
      status: 'completed',
      feedback: feedback(start, { actualMinutes: 200 }),
    },
  ];
  let review = weeklyTrainingReview(p, 0, addDays(start, 1));
  assert.equal(review.qualityComplete, 0);
  assert.equal(review.quality[0].status, 'execution-unknown');
  p.workouts[0].feedback.execution = 'as-planned';
  p.workouts[0].feedback.completedQualityMinutes = 200;
  review = weeklyTrainingReview(p, 0, addDays(start, 1));
  assert.equal(review.qualityComplete, 1);
});

test('race activity aliases never become training totals or completed main sets', () => {
  const p = fixture(),
    start = p.weeks[0].start;
  const source = p.workouts.find((w) => w.hard && w.kind !== 'race');
  const shared = feedback(start, {
    activityId: 'race-recording',
    actualMinutes: 90,
    actualKm: 21.0975,
    execution: 'as-planned',
    completedQualityMinutes: 90,
  });
  p.workouts = [
    {
      ...source,
      id: 'alias-first',
      date: start,
      status: 'completed',
      feedback: shared,
    },
    {
      ...source,
      id: 'race-last',
      kind: 'race',
      date: start,
      status: 'completed',
      feedback: { ...shared },
    },
  ];
  p.extraRuns = [
    {
      id: 'extra-alias',
      date: start,
      minutes: 90,
      km: 21.0975,
      activityId: 'race-recording',
    },
  ];
  const review = weeklyTrainingReview(p, 0, addDays(start, 1));
  assert.equal(review.records.length, 0);
  assert.equal(review.recordedMinutes, 0);
  assert.equal(review.knownKm, 0);
  assert.equal(review.quality.length, 0);
  assert.equal(review.qualityComplete, 0);
});

test('plan fit describes an explicit finish-goal routine and separates evidence from forecasts', () => {
  const plan = fixture();
  Object.assign(plan.profile, {
    goal: 'custom',
    raceDistanceKm: 15,
    intent: 'finish',
    qualityMode: 'custom',
    qualitySessions: 2,
  });
  for (const w of plan.workouts) {
    w.status = 'planned';
    delete w.feedback;
  }
  const asOf = addDays(plan.profile.startDate, 14);
  const html = renderToStaticMarkup(createElement(PlanFit, { plan, asOf }));
  assert.match(
    html,
    /requests 2 weekday quality workouts, separate from the long run/,
  );
  assert.doesNotMatch(html, /Your focus is easy endurance/);
  assert.match(html, /Longest logged preparation run/);
  assert.match(html, /0 recorded sessions/);
  assert.match(html, /upcoming sessions; not yet completed/);
  assert.match(html, /unlogged and remain unknown/);
  assert.match(html, /not a prediction of race readiness/);
});

import './ui-render-loader.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const { recordedTrainingInsights } =
  await import('../lib/recorded-insights.ts');
const { PlanTrainingInsights } =
  await import('../components/plan/training-insights.tsx');
const { FullPlan } = await import('../components/plan/plan-explorer.tsx');
const { ProgressView } = await import('../components/plan-views.tsx');
const { ProgressionChart } =
  await import('../components/plan/progression-chart.tsx');
const { demoPlan } = await import('../lib/engine.ts');
const today = '2026-09-30';
const base = demoPlan('2026-09-01');
const noop = () => {};
const render = (Component, props) =>
  renderToStaticMarkup(createElement(Component, props));
const props = {
  today,
  isDemo: false,
  onWorkout: noop,
  onDay: noop,
  onAdjust: noop,
  onNew: noop,
  onVariety: noop,
  selected: 0,
  onSelect: noop,
  onExtra: noop,
  onCorrectExtra: noop,
};
function fixture() {
  return { ...structuredClone(base), workouts: [], extraRuns: [] };
}
function run(id, date, patch = {}) {
  return {
    id,
    date,
    minutes: 30,
    km: 5,
    effort: 3,
    feeling: 'good',
    note: '',
    recordedAt: `${date}T12:00:00Z`,
    ...patch,
  };
}
function workout(id, date, feedback = {}) {
  return {
    ...structuredClone(base.workouts[0]),
    id,
    week: 0,
    date,
    hard: true,
    stimulus: 'threshold',
    status: 'completed',
    steps: [
      {
        kind: 'work',
        intensity: 5,
        seconds: 1200,
        effort: 'Controlled',
        label: 'Main set',
      },
    ],
    feedback: {
      actualDate: date,
      actualMinutes: 40,
      actualKm: 6,
      effort: 6,
      feeling: 'okay',
      note: '',
      recordedAt: `${date}T12:00:00Z`,
      ...feedback,
    },
  };
}

test('insights use four completed weeks and canonical actual dates, not the plan or duplicate imports', () => {
  const plan = fixture();
  plan.workouts = [
    workout('delayed', '2026-08-15', {
      actualDate: '2026-09-10',
      activityId: 'provider:1',
    }),
  ];
  plan.extraRuns = [
    run('duplicate', '2026-09-10', { activityId: 'provider:1', km: 200 }),
    run('same-day-extra', '2026-09-10', { km: null }),
    run('zero-distance', '2026-09-25', { km: 0 }),
    run('too-old', '2026-09-01'),
    run('today', today),
    run('future', '2026-10-01'),
  ];
  const before = structuredClone(plan);
  const result = recordedTrainingInsights(plan, today);
  assert.equal(result.start, '2026-09-02');
  assert.equal(result.end, '2026-09-29');
  assert.equal(result.records.length, 3);
  assert.equal(result.recordedDays, 2);
  assert.equal(result.recordedWeeks, 2);
  assert.equal(result.km, 6);
  assert.equal(result.minutes, 100);
  assert.equal(result.missingDistances, 1);
  assert.equal(result.periods[1].runs, 2);
  assert.equal(result.periods[1].days, 1);
  assert.equal(result.periods[3].km, 0);
  assert.equal(result.periods[0].km, null);
  assert.equal(result.periods[0].minutes, null);
  assert.equal(result.longest.id, 'delayed');
  assert.deepEqual(plan, before);
});

test('empty and unknown totals remain unknown; valid recorded zero stays zero', () => {
  const plan = fixture();
  let result = recordedTrainingInsights(plan, today);
  assert.equal(result.km, null);
  assert.equal(result.minutes, null);
  assert.equal(result.longest, null);
  assert.equal(result.effort.mean, null);
  plan.extraRuns = [
    run('unknown', '2026-09-10', { km: null, effort: 0, feeling: undefined }),
  ];
  result = recordedTrainingInsights(plan, today);
  assert.equal(result.km, null);
  assert.equal(result.missingDistances, 1);
  assert.equal(result.effort.count, 0);
  assert.equal(result.feelingCount, 0);
  plan.extraRuns[0].km = 0;
  result = recordedTrainingInsights(plan, today);
  assert.equal(result.km, 0);
  assert.equal(result.longest.km, 0);
});

test('effort uses valid self-reports only and quality work never comes from total run minutes', () => {
  const plan = fixture();
  plan.workouts = [
    workout('as-planned', '2026-09-04', {
      execution: 'as-planned',
      completedQualityMinutes: 20,
      effort: 4,
    }),
    workout('substitute', '2026-09-11', {
      execution: 'easy-substitute',
      completedQualityMinutes: 0,
      effort: 2,
    }),
    workout('unknown', '2026-09-18', { effort: undefined, feeling: undefined }),
  ];
  plan.extraRuns = [
    run('invalid-effort', '2026-09-19', { effort: 11, feeling: undefined }),
  ];
  const result = recordedTrainingInsights(plan, today);
  assert.equal(result.effort.count, 2);
  assert.equal(result.effort.mean, 3);
  assert.equal(result.feelingCount, 2);
  assert.equal(result.quality.count, 3);
  assert.equal(result.quality.asPlanned, 1);
  assert.equal(result.quality.changed, 1);
  assert.equal(result.quality.knownMinutes, 20);
  assert.equal(result.quality.missingMinutes, 1);
  assert.deepEqual(
    result.quality.missingExecution.map((w) => w.id),
    ['unknown'],
  );
  const html = render(PlanTrainingInsights, { ...props, plan });
  assert.match(html, /Known work-interval time/);
  assert.match(html, /20m/);
  assert.match(html, /Total run time does not confirm/);
  assert.match(html, /2 without an effort rating/);
  assert.doesNotMatch(html, /Heart-rate zone [1-5]/);
});

test('Plan owns insights once below the schedule; Progress keeps its charts and no duplicate insights', () => {
  const plan = structuredClone(base);
  const html = render(FullPlan, { ...props, plan, initialView: 'full' });
  assert.equal((html.match(/id="plan-insights-heading"/g) ?? []).length, 1);
  assert.ok(
    html.indexOf('id="plan-insights-heading"') >
      html.lastIndexOf('class="pe-week-footnote"'),
  );
  assert.doesNotMatch(html, /plan-event-eyebrow|Week so far|Week in review/);
  const progress = render(ProgressView, { ...props, plan });
  assert.doesNotMatch(progress, /Training insights/);
  assert.match(progress, /Your training progression/);
  assert.match(progress, /All-time/);
});

test('selected progression week is accessible and no drawn loop crosses its values', () => {
  const plan = structuredClone(base);
  const html = render(ProgressionChart, { plan, selected: 1, onSelect: noop });
  assert.match(html, /pe-chart-week is-selected/);
  assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, 1);
  assert.match(html, /aria-label="Week 2,/);
  assert.doesNotMatch(html, /drawn-selection/);
  assert.match(html, /Planned estimates, not recorded runs/);
});

test('measured heart-rate insights use validated recording fields with honest coverage, never prescribed targets', () => {
  const plan = fixture();
  plan.workouts = [
    workout('measured', '2026-09-10', {
      averageHeartRate: 142.5,
      maxHeartRate: 181,
      activityId: 'hr:1',
    }),
  ];
  plan.workouts[0].steps[0].target = {
    mode: 'heart-rate',
    low: 190,
    high: 200,
  };
  plan.extraRuns = [
    run('duplicate-sensor', '2026-09-10', {
      activityId: 'hr:1',
      averageHeartRate: 200,
      maxHeartRate: 250,
    }),
    run('average-only', '2026-09-15', { averageHeartRate: 151 }),
    run('max-only', '2026-09-20', { maxHeartRate: 188 }),
    run('no-sensor', '2026-09-23'),
    run('invalid-pair', '2026-09-24', {
      averageHeartRate: 160,
      maxHeartRate: 140,
    }),
  ];
  const result = recordedTrainingInsights(plan, today);
  assert.equal(result.records.length, 5);
  assert.deepEqual(result.heartRate, {
    count: 3,
    averageCount: 2,
    averageLow: 142.5,
    averageHigh: 151,
    highest: { bpm: 188, date: '2026-09-20' },
  });
  const html = render(PlanTrainingInsights, { ...props, plan });
  assert.match(html, /3 of 5 runs/);
  assert.match(html, /142.5–151 bpm/);
  assert.match(html, /188 bpm/);
  assert.match(html, /cannot show time spent in heart-rate zones/);
  assert.doesNotMatch(html, /250 bpm|200 bpm/);
});

test('unknown, corrupt and out-of-period heart rate cannot become measured insight', () => {
  const plan = fixture();
  plan.workouts = [workout('prescribed-only', '2026-09-10')];
  plan.workouts[0].steps[0].target = {
    mode: 'heart-rate',
    low: 130,
    high: 150,
  };
  plan.extraRuns = [
    run('zero', '2026-09-11', { averageHeartRate: 0, maxHeartRate: 0 }),
    run('corrupt', '2026-09-12', {
      averageHeartRate: Number.NaN,
      maxHeartRate: 301,
    }),
    run('today', today, { averageHeartRate: 145, maxHeartRate: 175 }),
  ];
  const result = recordedTrainingInsights(plan, today);
  assert.deepEqual(result.heartRate, {
    count: 0,
    averageCount: 0,
    averageLow: null,
    averageHigh: null,
    highest: null,
  });
  const html = render(PlanTrainingInsights, { ...props, plan });
  assert.match(html, /No measured heart rate is saved for these runs/);
  assert.doesNotMatch(html, /130 bpm|150 bpm|145 bpm|175 bpm|301 bpm/);
});

test('an empty insight period keeps a quick-log action and names the rolling window', () => {
  const html = render(PlanTrainingInsights, {
    ...props,
    plan: fixture(),
    onQuickLog: noop,
  });
  assert.match(html, /No runs recorded in this period/);
  assert.match(html, /Log a run/);
  assert.match(html, /last 28 completed days, in four seven-day periods/);
});

test('Plan insights accept all-block journal records without replacing the active schedule', () => {
  const active = structuredClone(base);
  active.extraRuns = [];
  const journal = structuredClone(active);
  journal.extraRuns = [
    run('outside-current-block', '2026-09-21', { minutes: 37, km: 6.2 }),
  ];
  const html = render(FullPlan, {
    ...props,
    plan: active,
    insightsPlan: journal,
  });
  assert.equal((html.match(/class="pe-date"/g) ?? []).length, 7);
  assert.match(html, /37m/);
  assert.match(html, /6.2 km/);
  assert.match(html, /1 recorded run/);
  assert.equal(active.extraRuns.length, 0);
});

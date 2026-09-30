import './ui-render-loader.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const { demoPlan, addDays } = await import('../lib/engine.ts');
const { planCalendarDays, planWeekSummary, nearestPlanWeek } =
  await import('../lib/plan-explorer.ts');
const { FullPlan, PlanWeekSchedule } =
  await import('../components/plan/plan-explorer.tsx');
const { WeekRhythm } = await import('../components/week-rhythm.tsx');
const { ProgressionChart } =
  await import('../components/plan/progression-chart.tsx');
const { ProgressView } = await import('../components/plan-views.tsx');
const { trainingPlanHtml } = await import('../lib/plan-print.ts');
const noop = () => {};

function fixture() {
  const plan = structuredClone(demoPlan('2026-09-21'));
  plan.weeks = plan.weeks.slice(0, 12);
  plan.profile.startDate = plan.weeks[0].start;
  plan.profile.raceDate = addDays(plan.weeks.at(-1).start, 6);
  plan.workouts = plan.workouts.filter((run) => run.week >= 0 && run.week < 12);
  plan.extraRuns = [];
  return plan;
}
const props = (plan) => ({
  plan,
  today: plan.profile.startDate,
  onWorkout: noop,
  onDay: noop,
  onAdjust: noop,
  onNew: noop,
  onVariety: noop,
  selected: 0,
  onSelect: noop,
  isDemo: false,
});
const render = (Component, options) =>
  renderToStaticMarkup(createElement(Component, options));
const feedback = (date, extra = {}) => ({
  actualDate: date,
  actualMinutes: 43,
  actualKm: null,
  effort: 3,
  feeling: 'good',
  note: '',
  recordedAt: `${date}T12:00:00Z`,
  ...extra,
});

test('full plan renders all 84 calendar days, while week view renders seven', () => {
  const plan = fixture();
  const full = render(FullPlan, { ...props(plan), initialView: 'full' });
  const week = render(FullPlan, props(plan));
  assert.equal((full.match(/class="pe-date"/g) ?? []).length, 84);
  assert.equal((week.match(/class="pe-date"/g) ?? []).length, 7);
  assert.match(full, new RegExp(`dateTime="${plan.profile.raceDate}"`, 'i'));
  assert.match(full, /Rest day/);
  assert.match(full, /Jump to plan week/);
  assert.match(full, /More plan options/);
  assert.match(full, /View steps/);
});

test('calendar preserves partial boundary dates, skips and AM/PM order', () => {
  const plan = fixture();
  plan.profile.startDate = addDays(plan.weeks[0].start, 2);
  const source = plan.workouts[0];
  const date = plan.profile.startDate;
  plan.workouts = [
    { ...source, id: 'pm', date, week: 0, session: 'PM', startTime: '17:30' },
    { ...source, id: 'am', date, week: 0, session: 'AM', startTime: '07:00' },
    {
      ...source,
      id: 'skipped',
      date: addDays(date, 1),
      week: 0,
      status: 'skipped',
    },
  ];
  const days = planCalendarDays(plan, 0);
  assert.equal(days.length, 7);
  assert.equal(days[0].inBlock, false);
  assert.equal(days[1].inBlock, false);
  assert.deepEqual(
    days[2].sessions.map((run) => run.id),
    ['am', 'pm'],
  );
  assert.equal(days[3].sessions[0].status, 'skipped');
  assert.equal(planWeekSummary(plan, 0).runningDays, 1);
  assert.equal(planWeekSummary(plan, 0).sessions, 2);
});

test('completed history uses the recorded day, and imported extras are deduplicated', () => {
  const plan = fixture();
  const source = plan.workouts[0];
  const date = addDays(plan.weeks[0].start, 3);
  const historical = {
    ...source,
    id: 'history',
    week: -1,
    date: '2026-09-01',
    status: 'completed',
    feedback: feedback(date, { activityId: 'import-1' }),
  };
  const extra = {
    id: 'extra',
    date,
    minutes: 25,
    km: null,
    effort: 3,
    feeling: 'good',
    note: '',
    recordedAt: `${date}T12:00:00Z`,
  };
  plan.workouts = [historical];
  plan.extraRuns = [
    { ...extra, id: 'duplicate', activityId: 'import-1' },
    extra,
    { ...extra },
  ];
  const day = planCalendarDays(plan, 0)[3];
  assert.deepEqual(
    day.sessions.map((run) => run.id),
    ['history'],
  );
  assert.deepEqual(
    day.extras.map((run) => run.id),
    ['extra'],
  );
  assert.equal(planWeekSummary(plan, 0).trainingKm, 0);
  const html = render(PlanWeekSchedule, { ...props(plan), weekIndex: 0 });
  assert.match(html, /Completed · previous plan/);
  assert.match(html, /43m/);
  assert.equal((html.match(/Extra run recorded/g) ?? []).length, 1);
  assert.match(html, /class="pe-workout-distance">43m<\/strong>/);
});

test('weekly summary excludes race, skips and records from the forecast totals', () => {
  const plan = fixture();
  const source = plan.workouts[0];
  const start = plan.weeks[0].start;
  plan.workouts = [
    {
      ...source,
      id: 'easy',
      date: start,
      week: 0,
      kind: 'easy',
      hard: false,
      minutes: 30,
      estimatedKm: 5,
    },
    {
      ...source,
      id: 'long',
      date: addDays(start, 1),
      week: 0,
      kind: 'long',
      hard: false,
      minutes: 120,
      estimatedKm: 20,
    },
    {
      ...source,
      id: 'race',
      date: addDays(start, 6),
      week: 0,
      kind: 'race',
      hard: true,
      minutes: 240,
      estimatedKm: 42.195,
    },
    {
      ...source,
      id: 'skipped',
      date: addDays(start, 2),
      week: 0,
      minutes: 60,
      estimatedKm: 10,
      status: 'skipped',
    },
    {
      ...source,
      id: 'historical',
      date: start,
      week: -1,
      status: 'completed',
      feedback: feedback(start),
    },
  ];
  const summary = planWeekSummary(plan, 0);
  assert.equal(summary.trainingKm, 25);
  assert.equal(summary.trainingMinutes, 150);
  assert.equal(summary.longKm, 20);
  assert.equal(summary.runningDays, 3);
  assert.equal(summary.raceKm, 42.195);
  assert.equal(summary.skipped, 1);
  assert.deepEqual(
    summary.keySessions.map((run) => run.id),
    ['long'],
  );
  const html = render(PlanWeekSchedule, { ...props(plan), weekIndex: 0 });
  assert.match(html, /Race distance target/);
  assert.doesNotMatch(html, /4h estimated/);
  assert.match(html, /Running days include race day/);
});

test('completed rows with missing feedback never pretend planned values were recorded', () => {
  const plan = fixture();
  plan.workouts = [
    { ...plan.workouts[0], week: 0, status: 'completed', feedback: undefined },
  ];
  const html = render(PlanWeekSchedule, { ...props(plan), weekIndex: 0 });
  assert.match(html, /Not recorded/);
  assert.match(html, /Open run to review its record/);
  assert.doesNotMatch(html, /\dm recorded/);
});

test('Progress owns the planned chart with both distances and mile units', () => {
  const plan = fixture();
  plan.profile.units = 'mi';
  const html = render(ProgressView, {
    plan,
    today: plan.profile.startDate,
    onWorkout: noop,
    onExtra: noop,
    onCorrectExtra: noop,
    isDemo: false,
  });
  assert.match(html, /aria-label="Week 1,[^"]+mi training,[^"]+mi long run/);
  assert.match(html, /Planned training/);
  assert.doesNotMatch(render(FullPlan, props(plan)), /class="pe-chart-week/);
  assert.equal(
    (html.match(/class="pe-chart-week[^"]*" aria-label=/g) ?? []).length,
    12,
  );
  assert.match(html, /aria-pressed="true"/);
});

test('selected plan chart summary shows saved prescriptions and phase without substituting actual results', () => {
  const plan = fixture();
  const source = plan.workouts[0];
  plan.workouts = [
    {
      ...source,
      kind: 'long',
      week: 1,
      estimatedKm: 12,
      status: 'completed',
      feedback: feedback(plan.weeks[1].start, { actualKm: 7 }),
    },
  ];
  const html = render(ProgressionChart, { plan, selected: 1, onSelect: noop });
  const summary = html.slice(html.indexOf('class="chart-week-summary"'));
  assert.match(summary, /Week 2 · Foundation/);
  assert.match(summary, /Planned training<\/dt><dd>12 km/);
  assert.match(summary, /Planned long run<\/dt><dd>12 km/);
  assert.doesNotMatch(summary, />7 km/);
});

test('recorded weekly chart uses actual dates, excludes unlogged prescriptions and flags partial distance totals', () => {
  const plan = fixture();
  const source = plan.workouts[0];
  const secondWeek = plan.weeks[1].start;
  plan.workouts = [
    {
      ...source,
      id: 'logged',
      week: 0,
      estimatedKm: 30,
      status: 'completed',
      feedback: feedback(secondWeek, { actualKm: 7 }),
    },
    {
      ...source,
      id: 'unlogged',
      week: 1,
      estimatedKm: 40,
      status: 'planned',
      feedback: undefined,
    },
    {
      ...source,
      id: 'missing',
      week: 1,
      estimatedKm: 20,
      status: 'completed',
      feedback: feedback(addDays(secondWeek, 1), { actualKm: null }),
    },
  ];
  const progressProps = {
    plan,
    today: secondWeek,
    onWorkout: noop,
    onExtra: noop,
    onCorrectExtra: noop,
    isDemo: false,
  };
  const html = render(ProgressView, progressProps);
  assert.match(
    html,
    /<svg[^>]+class="progression-plot"[^>]+role="img"[^>]+aria-labelledby="[^"]+-title [^"]+-description"/,
  );
  assert.match(html, /<title[^>]*>Weekly distance<\/title>/);
  assert.match(html, /Hatched bars show recorded totals/);
  assert.match(html, /<select aria-label="Progression week">/);
  assert.match(html, /<option value="1" selected="">Week 2/);
  assert.equal(
    (html.match(/class="progression-recorded-bar"/g) ?? []).length,
    1,
    'Only the actual second week receives a recorded-distance bar',
  );
  const summary = html
    .split('class="progression-week-detail"')[1]
    .split('</section>')[0];
  assert.doesNotMatch(summary, /Planned estimate|Planned training/);
  const plannedSummary = html
    .split('class="chart-week-summary"')[1]
    .split('</section>')[0];
  assert.match(plannedSummary, /Planned training<\/dt><dd>60 km/);
  assert.doesNotMatch(plannedSummary, />7 km/);
  assert.match(summary, /Known recorded distance<\/dt><dd>7 km/);
  assert.match(
    summary,
    /1 run has no distance recorded. This total is incomplete/,
  );
  assert.doesNotMatch(
    summary,
    /Known recorded distance<\/dt><dd>(?:30|40|20|60) km/,
  );
  const stats = html
    .split('class="journal-lifetime-stats"')[1]
    .split('</dl>')[0];
  assert.match(stats, /Runs logged<\/dt><dd>2/);
  assert.match(stats, /Time running<\/dt><dd>1h 26m/);
  assert.ok(
    html.indexOf('class="pe-progression"') <
      html.indexOf('class="journal-lifetime"'),
  );
  const firstWeek = render(ProgressView, {
    ...progressProps,
    today: plan.weeks[0].start,
  });
  const firstWeekSummary = firstWeek
    .split('class="progression-week-detail"')[1]
    .split('</section>')[0];
  assert.match(firstWeekSummary, /<option value="0" selected="">Week 1/);
  assert.match(firstWeekSummary, /Recorded total<\/dt><dd>Not recorded/);
  assert.doesNotMatch(firstWeekSummary, /Recorded total<\/dt><dd>0 km/);
});

test('Today lookup works before, inside and after a saved block without changing it', () => {
  const plan = fixture();
  const before = JSON.stringify(plan);
  assert.equal(nearestPlanWeek(plan, addDays(plan.weeks[0].start, -40)), 0);
  assert.equal(nearestPlanWeek(plan, addDays(plan.weeks[5].start, 3)), 5);
  assert.equal(nearestPlanWeek(plan, addDays(plan.weeks.at(-1).start, 70)), 11);
  planCalendarDays(plan, 4);
  planWeekSummary(plan, 4);
  render(FullPlan, { ...props(plan), initialView: 'full' });
  assert.equal(JSON.stringify(plan), before);
});

test('legacy taper labels resolve consistently in the schedule, chart and export', () => {
  const plan = fixture();
  plan.profile.goal = '5k';
  plan.profile.method = 'balanced';
  plan.weeks[0].phase = 'Taper';
  const html = render(FullPlan, props(plan));
  const chart = render(ProgressionChart, { plan, selected: 0, onSelect: noop });
  assert.match(chart, /aria-label="Week 1, Foundation,/);
  assert.match(html, /class="pe-phase ">Foundation<\/span>/);
  assert.match(trainingPlanHtml(plan), /Week 1 · Foundation<\/h2>/);
  assert.equal(plan.weeks[0].phase, 'Taper');
});

test('weekly rhythm describes actual saved runs for any engine version', () => {
  const plan = fixture();
  const source = plan.workouts[0];
  plan.engineVersion = 'stride-future-version';
  plan.workouts = [
    {
      ...source,
      id: 'quality',
      week: 0,
      hard: true,
      kind: 'tempo',
      stimulus: 'threshold',
    },
    {
      ...source,
      id: 'long',
      week: 0,
      kind: 'long',
      hard: false,
      stimulus: 'race-rhythm',
      qualityMinutes: 30,
    },
  ];
  const html = render(WeekRhythm, { plan, week: 0 });
  assert.match(html, /1 quality workout · 1 long run/);
  assert.match(html, /included in the long-run distance and time/);
  assert.doesNotMatch(html, /replaces a weekday quality/);
});

test('Plan leads with the supplied event identity and date without duplicated construction panels', () => {
  const plan = fixture();
  plan.profile.raceName = 'Autumn City Half';
  const html = render(FullPlan, props(plan));
  assert.match(html, /<h1>Autumn City Half<\/h1>/);
  assert.match(html, new RegExp(`dateTime="${plan.profile.raceDate}"`));
  assert.match(html, /Race day/);
  assert.match(html, /Adjust plan/);
  assert.match(html, /More plan options/);
  assert.match(html, /class="pe-weeks"/);
  assert.doesNotMatch(
    html,
    /Your routine and progression|Built around your running|class="pe-plan-notes"|class="pe-progression"/,
  );
  plan.profile.raceName = '';
  assert.match(render(FullPlan, props(plan)), /<h1>10K training<\/h1>/);
});

test('planned Progress bars leave unsupported distances blank rather than treating them as zero', () => {
  const plan = fixture();
  const source = plan.workouts[0];
  plan.workouts = [
    {
      ...source,
      week: 0,
      kind: 'long',
      distanceEstimate: {
        lowerKm: null,
        upperKm: null,
        basis: 'No supported pace.',
      },
      steps: [
        {
          kind: 'aerobic',
          seconds: 1800,
          intensity: 2,
          label: 'Easy running',
          effort: 'Conversational',
        },
      ],
    },
  ];
  const html = render(ProgressionChart, { plan, selected: 0, onSelect: noop });
  assert.match(
    html,
    /training distance not estimated, long-run distance not estimated/,
  );
  assert.match(html, /Planned training<\/dt><dd>Not estimated/);
  assert.match(html, /Planned long run<\/dt><dd>Not estimated/);
});

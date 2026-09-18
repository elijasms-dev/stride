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
  assert.match(full, /Print plan/);
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

test('chart controls expose both distances and preserve mile units', () => {
  const plan = fixture();
  plan.profile.units = 'mi';
  const html = render(FullPlan, props(plan));
  assert.match(html, /aria-label="Week 1,[^"]+mi training,[^"]+mi long run/);
  assert.match(html, /Estimated training/);
  assert.equal(
    (html.match(/class="pe-chart-week[^"]*" aria-label=/g) ?? []).length,
    12,
  );
  assert.match(html, /aria-pressed="true"/);
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

import './ui-render-loader.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { demoPlan } from '../lib/engine.ts';
import {
  calendarSessions,
  orderedCalendarSessions,
} from '../lib/day-sessions.ts';
const { TodayWorkoutCard } =
  await import('../components/app/today-workout-card.tsx');
const { DateRail } = await import('../components/date-rail.tsx');
const { UpcomingSessions } = await import('../components/journal-panels.tsx');

const plan = demoPlan('2026-09-21');
const source = plan.workouts.find((w) => w.kind !== 'race');
const noop = () => {};
const render = (component, props) =>
  renderToStaticMarkup(createElement(component, props));
const card = (workout, patch = {}) =>
  render(TodayWorkoutCard, {
    workout,
    profile: plan.profile,
    showEstimates: true,
    onOpen: noop,
    motion: false,
    ...patch,
  });
const feedback = (actualDate) => ({
  actualDate,
  actualMinutes: 37,
  actualKm: null,
  effort: 4,
  feeling: 'good',
  note: '',
  recordedAt: `${actualDate}T12:00:00Z`,
});

test('Today keeps the exact event distance visible without inventing a finish time', () => {
  const race = {
    ...source,
    kind: 'race',
    title: 'Marathon',
    estimatedKm: 42.195,
    minutes: 999,
    steps: [],
  };
  const html = card(race, { showEstimates: false });
  assert.match(html, /42\.195/);
  assert.match(html, /today-distance-unit"> km<\/span><\/strong><span>target/);
  assert.doesNotMatch(html, /16h 39m|estimated time|duration/);
  assert.doesNotMatch(html, /By feel<span/);
});

test('Today labels mixed distance and timed sessions as estimated time', () => {
  const mixed = {
    ...source,
    minutes: 52,
    steps: [
      { kind: 'warmup', seconds: 600, effort: 'easy', label: 'Warm up' },
      {
        kind: 'work',
        seconds: 2520,
        metres: 8000,
        effort: 'tempo',
        label: 'Steady running',
      },
    ],
  };
  const html = card(mixed);
  assert.match(html, /52m/);
  assert.match(html, /estimated time/);
  const upcoming = render(UpcomingSessions, {
    plan: { ...plan, workouts: [mixed] },
    fromDate: mixed.date,
    onWorkout: noop,
    onPlan: noop,
  });
  assert.match(upcoming, /52m<\/span>/);
});

test('completed Today cards show actuals and never use prescribed distance or pace as recorded data', () => {
  const completed = {
    ...source,
    title: '10 km · Recovery run',
    minutes: 99,
    status: 'completed',
    feedback: feedback('2026-09-26'),
    steps: [
      {
        ...source.steps[0],
        metres: 10000,
        target: { mode: 'pace', low: 330, high: 360 },
      },
    ],
  };
  const html = card(completed);
  assert.match(html, /<span class="today-hero-kind">Recorded run<\/span>/);
  assert.match(html, /37m/);
  assert.match(html, /Distance not recorded/);
  assert.match(html, /recorded effort/);
  assert.match(html, /dateTime="2026-09-26"/);
  assert.match(html, /<h2>Recovery run<\/h2>/);
  assert.doesNotMatch(html, /1h 39m|5:30|km target/);
});

test('a completed workout without feedback does not display prescribed numbers as actuals', () => {
  const html = card({
    ...source,
    status: 'completed',
    minutes: 99,
    feedback: undefined,
  });
  assert.match(html, /Recorded distance, time and effort are unavailable/);
  assert.doesNotMatch(html, /1h 39m|today-session-stats|recorded time/);
});

test('Today excludes distance estimates but retains exact distance targets when estimates are hidden', () => {
  const timed = {
    ...source,
    steps: [{ ...source.steps[0], metres: undefined }],
  };
  const measured = {
    ...source,
    title: '10 km · Easy run',
    steps: [{ ...source.steps[0], metres: 10000 }],
  };
  assert.doesNotMatch(
    card(timed, { showEstimates: false }),
    /today-distance-metric/,
  );
  assert.match(
    card(measured, { showEstimates: false }),
    /today-distance-unit"> km<\/span><\/strong><span>target/,
  );
});

test('a recorded zero distance is shown as zero rather than replaced with a prescribed estimate', () => {
  const html = card({
    ...source,
    status: 'completed',
    feedback: { ...feedback(source.date), actualKm: 0 },
  });
  assert.match(
    html,
    /<strong>0<span class="today-distance-unit"> km<\/span><\/strong><span>recorded distance<\/span>/,
  );
  assert.doesNotMatch(html, /Distance not recorded|km target|estimated range/);
});

test('the Today hero summarizes mixed work paces instead of promoting the first work target', () => {
  const html = card({
    ...source,
    steps: [
      { kind: 'warmup', seconds: 600, effort: 'Comfortable', label: 'Warm up' },
      {
        kind: 'work',
        seconds: 300,
        effort: 'Fast',
        label: 'First work segment',
        target: { mode: 'pace', low: 300, high: 310 },
      },
      {
        kind: 'work',
        seconds: 300,
        effort: 'Controlled',
        label: 'Second work segment',
        target: { mode: 'pace', low: 330, high: 340 },
      },
    ],
  });
  assert.match(html, /Varied paces/);
  assert.doesNotMatch(html, /5:00–5:10|5:30–5:40/);
  assert.doesNotMatch(
    html,
    /Session details below|href="#today-workout-details"/,
  );
});

test('Today puts only saved pace or heart-rate targets below the stats', () => {
  const workout = {
    ...source,
    steps: [
      {
        kind: 'aerobic',
        seconds: 1800,
        metres: 5000,
        effort: 'Easy',
        label: 'Easy run',
      },
    ],
  };
  assert.doesNotMatch(card(workout), /today-saved-target/);
  for (const [target, expected] of [
    [{ mode: 'pace', low: 350, high: 380 }, '5:50–6:20'],
    [{ mode: 'heart-rate', low: 130, high: 145 }, '130–145'],
  ]) {
    const html = card({ ...workout, steps: [{ ...workout.steps[0], target }] });
    assert.ok(
      html.indexOf('today-saved-target') > html.indexOf('today-target-metric'),
    );
    assert.ok(html.includes(expected));
    assert.match(html, /<span>effort<\/span>/);
  }
});

test('Up next shows its distance only once and keeps its existing workout action', () => {
  const workout = {
    ...source,
    title: '9.5 km · Recovery run',
    steps: [
      {
        kind: 'aerobic',
        seconds: 3420,
        metres: 9500,
        effort: 'Easy',
        label: 'Easy run',
      },
    ],
    minutes: 57,
  };
  const html = render(UpcomingSessions, {
    plan: { ...plan, workouts: [workout] },
    fromDate: workout.date,
    onWorkout: noop,
    onPlan: noop,
  });
  assert.match(html, /<strong>Recovery run<\/strong>/);
  assert.match(html, /9\.5 km · 57m/);
  assert.equal((html.match(/9\.5 km/g) ?? []).length, 1);
});

test('Today calendar and date rail put retained completed workouts on their recorded day, deduplicated', () => {
  const actualDate = '2026-09-10';
  const completed = {
    ...source,
    id: 'recorded',
    date: '2026-09-09',
    week: -1,
    status: 'completed',
    feedback: { ...feedback(actualDate), activityId: 'same-import' },
  };
  const duplicate = { ...completed, id: 'duplicate' };
  const saved = {
    ...plan,
    workouts: [completed, duplicate, { ...source, id: 'retired', week: -1 }],
    extraRuns: [],
  };
  const before = JSON.stringify(saved);
  const sessions = calendarSessions(saved);
  assert.deepEqual(orderedCalendarSessions(sessions, actualDate), [completed]);
  assert.deepEqual(orderedCalendarSessions(sessions, completed.date), []);
  const html = render(DateRail, {
    plan: saved,
    today: '2026-09-21',
    selectedDate: actualDate,
    motion: false,
    onSelect: noop,
    onHold: noop,
  });
  assert.match(html, /data-date="2026-09-10"[^>]*data-day-state="completed"/);
  assert.match(html, /data-date="2026-09-09"[^>]*data-day-state="rest"/);
  assert.equal((html.match(/data-day-state="completed"/g) ?? []).length, 1);
  assert.equal((html.match(/tabindex="0"/g) ?? []).length, 1);
  assert.equal(JSON.stringify(saved), before);
});

test('historical dates suggest only current-block workouts in Up next', () => {
  const saved = {
    ...plan,
    workouts: [
      {
        ...source,
        id: 'retired',
        date: '2026-09-11',
        week: -1,
        status: 'planned',
        title: 'Retired old-plan session',
      },
      {
        ...source,
        id: 'current',
        date: '2026-09-21',
        week: 0,
        status: 'planned',
        title: 'Current block session',
      },
    ],
  };
  const html = render(UpcomingSessions, {
    plan: saved,
    fromDate: '2026-09-10',
    onWorkout: noop,
    onPlan: noop,
  });
  assert.match(html, /Current block session/);
  assert.doesNotMatch(html, /Retired old-plan session/);
});

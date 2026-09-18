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
  assert.match(html, /km target/);
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
  assert.match(upcoming, /52m estimated/);
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
  assert.doesNotMatch(html, /1h 39m|workout-stats|recorded time/);
});

test('Today target-only cards use two columns and retain exact distance when estimates are hidden', () => {
  const timed = {
    ...source,
    steps: [{ ...source.steps[0], metres: undefined }],
  };
  const measured = {
    ...source,
    title: '10 km · Easy run',
    steps: [{ ...source.steps[0], metres: 10000 }],
  };
  assert.match(card(timed, { showEstimates: false }), /data-metrics="2"/);
  assert.match(card(measured, { showEstimates: false }), /km target/);
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
  assert.doesNotMatch(html, /data-date="2026-09-09"/);
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

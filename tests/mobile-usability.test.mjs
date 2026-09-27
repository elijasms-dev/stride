import './ui-render-loader.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { dateRailWindow, dateRailTarget } from '../lib/date-rail-window.ts';
import { millisecondsUntilTrainingDay } from '../lib/training-day-clock.ts';
import { trainingDay } from '../lib/form-values.ts';
import {
  DRAFT_LIFETIME_MS,
  durableDraftKey,
  readDurableDraft,
  purgeDurableDrafts,
  purgeScopeDurableDrafts,
} from '../lib/durable-draft.ts';
const { DateRail } = await import('../components/date-rail.tsx');
const { FullPlan } = await import('../components/plan/plan-explorer.tsx');
const { default: WorkoutDetail } =
  await import('../components/workout-detail.tsx');
const { demoPlan, addDays } = await import('../lib/engine.ts');
const noop = () => {};
const plan = demoPlan('2026-09-21');

test('a long plan exposes seven calendar days, one Tab stop and a full date picker', () => {
  const selected = plan.workouts[20].date;
  const html = renderToStaticMarkup(
    createElement(DateRail, {
      plan,
      selectedDate: selected,
      today: plan.profile.startDate,
      motion: false,
      onSelect: noop,
      onHold: noop,
    }),
  );
  assert.equal((html.match(/data-date=/g) ?? []).length, 7);
  assert.equal((html.match(/tabindex="0"/g) ?? []).length, 1);
  assert.match(html, /Choose any date/);
  assert.match(html, /Previous seven days/);
  assert.match(html, /Next seven days/);
  assert.match(html, /Skip to workout/);
  assert.ok(html.includes(`data-date="${selected}"`));
});

test('windowing and week navigation never lose boundary or separate recorded dates', () => {
  const dates = [
    '2025-12-01',
    ...Array.from({ length: 161 }, (_, day) => addDays('2026-09-21', day)),
    '2027-12-01',
  ];
  for (const selected of dates) {
    const result = dateRailWindow(dates, selected);
    assert.equal(result.dates.length, 7);
    assert.ok(result.dates.includes(selected));
    assert.equal(result.dates[0], dates[result.start]);
  }
  assert.equal(dateRailTarget(dates, dates[0], -7), dates[0]);
  assert.equal(dateRailTarget(dates, dates.at(-1), 7), dates.at(-1));
  assert.equal(dateRailTarget(dates, dates[4], 7), dates[11]);
  assert.deepEqual(dateRailWindow([], '2026-09-21').dates, []);
});

test('day rollover scheduling follows DST and timezone boundaries without frequent polling', () => {
  for (const [zone, instant, expectedHours] of [
    ['Europe/Dublin', '2026-03-29T00:00:00Z', 23],
    ['Europe/Dublin', '2026-10-24T23:00:00Z', 25],
    ['America/New_York', '2026-03-08T05:00:00Z', 23],
    ['Asia/Kathmandu', '2026-09-23T18:15:00Z', 24],
    ['Pacific/Kiritimati', '2026-09-23T10:00:00Z', 24],
  ]) {
    const now = new Date(instant),
      delay = millisecondsUntilTrainingDay(zone, now);
    assert.ok(
      Math.abs(delay / 3_600_000 - expectedHours) < 0.001,
      `${zone}: ${delay}`,
    );
    assert.notEqual(
      trainingDay(zone, now),
      trainingDay(zone, new Date(now.getTime() + delay)),
    );
    assert.equal(
      trainingDay(zone, now),
      trainingDay(zone, new Date(now.getTime() + delay - 2000)),
    );
  }
});

test('drafts are bounded, expiring and separated by account epoch and record', () => {
  const now = Date.now(),
    value = { note: 'Felt steady', minutes: 40 };
  const valid = (v) =>
    v && typeof v.note === 'string' && Number.isFinite(v.minutes);
  const raw = (savedAt, patch = {}) =>
    JSON.stringify({ version: 1, savedAt, value, ...patch });
  assert.deepEqual(readDurableDraft(raw(now), valid, now), value);
  for (const input of [
    null,
    '{broken',
    raw(now - DRAFT_LIFETIME_MS - 1),
    raw(now + 120_000),
    raw(now, { version: 2 }),
    raw(now, { value: { minutes: '40' } }),
    'x'.repeat(65_537),
  ]) {
    assert.equal(readDurableDraft(input, valid, now), null);
  }
  const keys = ['runner:1', 'runner:2', 'other:1'].flatMap((scope) =>
    ['run:one', 'run:two'].map((key) => durableDraftKey(scope, key)),
  );
  assert.equal(new Set(keys).size, 6);
  assert.notEqual(durableDraftKey('a:b', 'c'), durableDraftKey('a', 'b:c'));
});

test('the actual week schedule precedes collapsed routine and progression details', () => {
  const html = renderToStaticMarkup(
    createElement(FullPlan, {
      plan,
      today: plan.profile.startDate,
      selected: 0,
      onSelect: noop,
      onWorkout: noop,
      onDay: noop,
      onAdjust: noop,
      onPreferences: noop,
      onNew: noop,
      onVariety: noop,
      isDemo: false,
    }),
  );
  assert.ok(
    html.indexOf('class="pe-weeks"') <
      html.indexOf('Your routine and progression'),
  );
  assert.match(html, /<details class="pe-plan-context">/);
  assert.match(html, /More plan options/);
});

test('workout instructions and primary action are separate so scrolling cannot bury logging', () => {
  const workout = plan.workouts.find(
    (w) => w.status === 'planned' && w.kind !== 'race',
  );
  const html = renderToStaticMarkup(
    createElement(WorkoutDetail, {
      workout,
      plan,
      profile: plan.profile,
      version: 1,
      open: true,
      onClose: noop,
      onAction: async () => {},
      onConnect: noop,
      isDemo: false,
      connected: false,
      today: workout.date,
      busy: false,
    }),
  );
  assert.match(html, /class="workout-detail-scroll"/);
  assert.match(html, /aria-label="Workout instructions"/);
  assert.match(html, /class="modal-actions workout-detail-footer"/);
  assert.match(html, /Log this run/);
});

test('account switching removes every other account draft and logout removes all feedback', () => {
  const active = durableDraftKey('runner:2', 'run:one');
  const stale = durableDraftKey('runner:1', 'run:one');
  const other = durableDraftKey('other:1', 'run:two');
  const values = new Map([
    [active, 'keep'],
    [stale, 'old'],
    [other, 'private'],
    ['stride-theme', 'dark'],
  ]);
  const storage = {
    get length() {
      return values.size;
    },
    key(index) {
      return [...values.keys()][index] ?? null;
    },
    removeItem(key) {
      values.delete(key);
    },
  };
  assert.equal(purgeDurableDrafts('runner:2', storage), true);
  assert.deepEqual([...values.keys()], [active, 'stride-theme']);
  assert.equal(purgeDurableDrafts(undefined, storage), true);
  assert.deepEqual([...values.keys()], ['stride-theme']);
  assert.equal(
    purgeDurableDrafts(undefined, {
      get length() {
        throw new Error('Storage denied');
      },
    }),
    false,
  );
});

test('stale-tab invalidation removes only its own drafts', () => {
  const old = durableDraftKey('runner-A:1', 'one'),
    current = durableDraftKey('runner-B:1', 'two');
  const values = new Map([
    [old, 'old'],
    [current, 'new'],
  ]);
  const storage = {
    get length() {
      return values.size;
    },
    key: (index) => [...values.keys()][index],
    removeItem: (key) => values.delete(key),
  };
  assert.equal(purgeScopeDurableDrafts('runner-A:1', storage), true);
  assert.deepEqual([...values.keys()], [current]);
  purgeScopeDurableDrafts('', storage);
  assert.deepEqual([...values.keys()], [current]);
});

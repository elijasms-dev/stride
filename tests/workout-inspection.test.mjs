import './ui-render-loader.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { demoPlan } from '../lib/engine.ts';
import {
  upcomingPlanChanges,
  workoutComparisonRows,
  preferenceOverviewRows,
  previewDistance,
} from '../lib/plan-change-summary.ts';

const { default: WorkoutDetail } =
  await import('../components/workout-detail.tsx');
const { PreferencePreview } =
  await import('../components/training/preference-preview.tsx');
const today = '2026-09-14';
const plan = demoPlan(today);
const first = plan.workouts.find((w) => w.date >= today && w.kind !== 'race');
const noop = () => {};
const render = (Component, props) =>
  renderToStaticMarkup(createElement(Component, props));
const previewProps = (preview) => ({
  preview,
  plan,
  today,
  version: 3,
  previewVersion: 3,
  effectiveDate: today,
  onClose: noop,
  onAction: async () => {},
  busy: false,
  submitted: preview.profile,
  showAll: false,
  setShowAll: noop,
  setPreview: noop,
  setError: noop,
  ...upcomingPlanChanges(plan, preview, today),
});

test('preview detects duration and distance allocation changes without renamed steps', () => {
  for (const field of ['minutes', 'estimatedKm']) {
    const after = structuredClone(plan);
    after.workouts.find((w) => w.id === first.id)[field] += 1;
    assert.deepEqual(
      upcomingPlanChanges(plan, after, today).changes.map((w) => w.id),
      [first.id],
    );
  }
});

test('pace-only updates show the old and new targets even when session time is unchanged', () => {
  const before = structuredClone(first);
  before.steps[0].target = { mode: 'pace', low: 340, high: 360 };
  const after = structuredClone(before);
  after.steps[0].target = { mode: 'pace', low: 350, high: 370 };
  const rows = workoutComparisonRows(before, after, plan.profile, plan.profile);
  const pace = rows.find((row) => row.label === 'Pace / effort');
  assert.equal(pace.changed, true);
  assert.match(pace.before, /5:40–6:00 \/km/);
  assert.match(pace.after, /5:50–6:10 \/km/);
  assert.equal(rows.find((row) => row.label === 'Time').changed, false);
});

test('distance previews distinguish exact prescriptions, estimates and unknown distance', () => {
  const exact = {
    ...first,
    steps: [{ ...first.steps[0], metres: 10000, seconds: 3600 }],
  };
  const timed = { ...first, steps: [{ ...first.steps[0], seconds: 3600 }] };
  delete timed.steps[0].metres;
  assert.equal(previewDistance(exact, plan.profile), '10 km target');
  assert.match(
    previewDistance(timed, { ...plan.profile, easyPace: 6 }),
    /km estimated$/,
  );
  assert.equal(
    previewDistance(timed, {
      ...plan.profile,
      easyPace: undefined,
      recentRace: undefined,
    }),
    'Distance not estimated',
  );
});

test('unit changes compare both columns in the selected units without false load changes', () => {
  const exact = {
    ...first,
    steps: [{ ...first.steps[0], metres: 10000, seconds: 3600 }],
  };
  const rows = workoutComparisonRows(
    exact,
    exact,
    { ...plan.profile, units: 'km' },
    { ...plan.profile, units: 'mi' },
  );
  const distance = rows.find((row) => row.label === 'Distance');
  assert.equal(distance.before, '6.2 mi target');
  assert.equal(distance.before, distance.after);
  assert.equal(distance.changed, false);
});

test('new and removed workouts are compared against not scheduled, never zero distances', () => {
  const added = workoutComparisonRows(
    undefined,
    first,
    plan.profile,
    plan.profile,
  );
  const removed = workoutComparisonRows(
    first,
    undefined,
    plan.profile,
    plan.profile,
  );
  assert.ok(added.every((row) => row.before === 'Not scheduled'));
  assert.ok(removed.every((row) => row.after === 'Not scheduled'));
});

test('change detection preserves unchanged completed and manually edited snapshots', () => {
  const before = structuredClone(plan);
  before.workouts[0].status = 'completed';
  before.workouts[1].changeSource = 'manual';
  const after = structuredClone(before);
  after.profile.units = 'mi';
  const original = JSON.stringify(before);
  assert.deepEqual(upcomingPlanChanges(before, after, today), {
    changes: [],
    removed: [],
  });
  assert.equal(JSON.stringify(before), original);
});

test('week totals do not turn missing pace evidence into a zero or an exact distance', () => {
  const unknown = structuredClone(plan);
  delete unknown.profile.easyPace;
  delete unknown.profile.recentRace;
  for (const workout of unknown.workouts) {
    for (const step of workout.steps) delete step.metres;
  }
  assert.equal(
    preferenceOverviewRows(unknown, unknown, today).rows[0].after,
    'Distance not fully estimated',
  );
  assert.equal(
    preferenceOverviewRows(plan, plan, '2030-01-01').rows[0].after,
    'No full week remaining',
  );
});

test('workout details put the prescription and complete steps before collapsed supporting guidance', () => {
  const html = render(WorkoutDetail, {
    workout: first,
    plan,
    profile: plan.profile,
    version: 3,
    open: true,
    today,
    onClose: noop,
    onAction: async () => {},
    onConnect: noop,
    busy: false,
    isDemo: false,
    connected: false,
  });
  const stats = html.indexOf('class="workout-stats"');
  const steps = html.indexOf('Your session, step by step');
  const guide = html.indexOf('Preparation, food &amp; recovery');
  assert.ok(stats >= 0 && steps > stats && guide > steps);
  assert.match(
    html,
    /<details class="workout-supporting-detail"><summary>Preparation, food &amp; recovery/,
  );
  assert.match(html, /Log this run/);
  assert.match(html, /More actions/);
});

test('preference review displays before/after recipes and retains stale-preview apply protection', () => {
  const after = structuredClone(plan);
  after.workouts.find((w) => w.id === first.id).steps[0].target = {
    mode: 'pace',
    low: 340,
    high: 360,
  };
  const html = render(PreferencePreview, {
    ...previewProps(after),
    previewVersion: 2,
  });
  assert.match(html, /Before/);
  assert.match(html, /After/);
  assert.match(html, /Pace \/ effort/);
  assert.match(html, /Compare every step/);
  assert.match(html, /This preview is out of date/);
  assert.match(html, /<button[^>]*disabled=""[^>]*>Apply from/);
});

test('preference review explicitly labels newly scheduled and removed sessions', () => {
  const after = structuredClone(plan);
  after.workouts = after.workouts.filter((w) => w.id !== first.id);
  after.workouts.push({ ...structuredClone(first), id: 'brand-new-session' });
  const html = render(PreferencePreview, previewProps(after));
  assert.match(html, /data-kind="Added"/);
  assert.match(html, /data-kind="Removed"/);
  assert.match(html, /Not scheduled/);
});

test('races never turn a planning allowance into a finish-time prediction', () => {
  const race = plan.workouts.find((w) => w.kind === 'race');
  const row = workoutComparisonRows(
    race,
    race,
    plan.profile,
    plan.profile,
  ).find((r) => r.label === 'Time');
  assert.equal(row.after, 'Race distance; no finish-time prediction');
  assert.doesNotMatch(row.after, /estimated/);
});

test('quality changes are detected and described even without different session titles', () => {
  const after = structuredClone(plan);
  const run = after.workouts.find((w) => w.id === first.id);
  run.hard = !first.hard;
  run.qualityMinutes = 15;
  assert.equal(upcomingPlanChanges(plan, after, today).changes.length, 1);
  const role = workoutComparisonRows(
    first,
    run,
    plan.profile,
    plan.profile,
  ).find((r) => r.label === 'Session role');
  assert.equal(role.changed, true);
  assert.match(role.after, /15m quality work/);
});

test('finish intent previews report the actual weekday quality setting instead of inventing zero', () => {
  const after = structuredClone(plan);
  after.profile.intent = 'finish';
  after.profile.qualityMode = 'custom';
  after.profile.qualitySessions = 1;
  const html = render(PreferencePreview, previewProps(after));
  assert.match(html, /Up to 1 weekday quality workout per week/);
  assert.match(html, /plus the long run/);
});

test('distance-prefixed titles changing units do not count as rewritten prescriptions', () => {
  const before = structuredClone(plan);
  const old = before.workouts.find((w) => w.id === first.id);
  old.title = '10 km · Easy running';
  old.steps = [{ ...old.steps[0], metres: 10000, seconds: 3600 }];
  const after = structuredClone(before);
  after.profile.units = 'mi';
  const updated = after.workouts.find((w) => w.id === first.id);
  updated.title = '6.2 mi · Easy running';
  assert.deepEqual(upcomingPlanChanges(before, after, today), {
    changes: [],
    removed: [],
  });
  const title = workoutComparisonRows(
    old,
    updated,
    before.profile,
    after.profile,
  ).find((r) => r.label === 'Workout');
  assert.equal(title.before, '6.2 mi · Easy running');
  assert.equal(title.changed, false);
});

test('a planning-distance-only change is visible and labelled as planning rather than a new target', () => {
  const after = { ...first, estimatedKm: first.estimatedKm + 2 };
  const row = workoutComparisonRows(
    first,
    after,
    plan.profile,
    plan.profile,
  ).find((r) => r.label === 'Planning distance');
  assert.equal(row.changed, true);
  assert.match(row.after, /allocated for planning/);
});

test('mixed distance intervals and timed recoveries label total duration as estimated', () => {
  const mixed = {
    ...first,
    steps: [
      { ...first.steps[0], metres: 1000, seconds: 300 },
      {
        kind: 'recovery',
        label: 'Easy jog',
        seconds: 120,
        effort: 'Easy',
        intensity: 2,
      },
    ],
  };
  assert.match(
    workoutComparisonRows(mixed, mixed, plan.profile, plan.profile).find(
      (r) => r.label === 'Time',
    ).after,
    /estimated$/,
  );
  const html = render(WorkoutDetail, {
    workout: mixed,
    plan,
    profile: plan.profile,
    version: 3,
    open: true,
    today,
    onClose: noop,
    onAction: async () => {},
    onConnect: noop,
    busy: false,
    isDemo: false,
    connected: false,
  });
  assert.match(html, /<span>estimated time<\/span>/);
});

test('a partial race week is never presented as the next full week', () => {
  const fridayRace = structuredClone(plan);
  fridayRace.profile.raceDate = '2026-09-18';
  assert.equal(
    preferenceOverviewRows(fridayRace, fridayRace, today).weekStart,
    undefined,
  );
  assert.equal(
    preferenceOverviewRows(fridayRace, fridayRace, today).rows[0].after,
    'No full week remaining',
  );
});

test('effort changes stay visible alongside unchanged pace targets', () => {
  const before = structuredClone(first);
  before.steps[0].target = { mode: 'pace', low: 340, high: 360 };
  before.steps[0].effort = 'Steady';
  const after = structuredClone(before);
  after.steps[0].effort = 'Hard';
  const row = workoutComparisonRows(
    before,
    after,
    plan.profile,
    plan.profile,
  ).find((r) => r.label === 'Pace / effort');
  assert.equal(row.changed, true);
  assert.match(row.before, /Steady/);
  assert.match(row.after, /Hard/);
});

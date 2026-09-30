import './ui-render-loader.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  BENCHMARK_DISTANCES,
  elapsedTimeText,
  parseElapsedTime,
} from '../lib/benchmark-input.ts';
import {
  benchmarkEvidence,
  calculateTrainingPaces,
  validateRecentRace,
} from '../lib/fitness-pacing.ts';
import {
  addDays,
  demoProfile,
  makePlan,
  revisePreferences,
  validatePlan,
  validateProfile,
} from '../lib/engine.ts';
import { validateRecovery } from '../lib/recovery.ts';
import { workoutStepTarget } from '../lib/workout-targets.ts';
const { NumericDraftContext } = await import('../components/numeric-input.tsx');
const { RecentRaceFields } =
  await import('../components/recent-race-fields.tsx');
const { ElapsedTimeInput } =
  await import('../components/elapsed-time-input.tsx');

const start = '2026-09-14';
const race = { distanceKm: 10, timeMinutes: 50 };
const profile = (patch = {}) => ({
  ...demoProfile(start),
  recentRace: race,
  ...patch,
});
const render = (Component, props) =>
  renderToStaticMarkup(createElement(Component, props));
const noop = () => {};

test('elapsed finish time accepts unambiguous clocks and keeps seconds instead of decimal-minute guesses', () => {
  assert.equal(parseElapsedTime('1:45:30'), 105.5);
  assert.equal(parseElapsedTime('25:30'), 25.5);
  assert.equal(parseElapsedTime('0:25:30.5'), 25 + 30.5 / 60);
  assert.equal(parseElapsedTime('25:30,5'), 25 + 30.5 / 60);
  assert.equal(parseElapsedTime(' 0:50:00 '), 50);
  assert.equal(parseElapsedTime(''), null);
  for (const value of [
    '50',
    '50.5',
    '1:60:00',
    '25:60',
    '1:2:30',
    '-1:30',
    '1e2:00',
    'NaN',
    '1:00:00:00',
  ])
    assert.ok(Number.isNaN(parseElapsedTime(value)), value);
  for (const minutes of [20, 25.5, 50.25, 105.5, 239.99, 1500])
    assert.ok(
      Math.abs(parseElapsedTime(elapsedTimeText(minutes)) - minutes) < 1 / 6000,
    );
  assert.equal(elapsedTimeText(90.5), '1:30:30');
  assert.equal(elapsedTimeText(59 + 59.999 / 60), '1:00:00');
  for (const value of [null, undefined, NaN, Infinity, 0])
    assert.equal(elapsedTimeText(value), '');
});

test('legacy benchmarks retain their shape while validated provenance survives serialization without changing paces', () => {
  assert.deepEqual(
    validateRecentRace({ ...race, unexpected: 'discard' }),
    race,
  );
  const withEvidence = {
    ...race,
    date: '2026-09-01',
    source: 'time-trial',
    course: 'track',
  };
  assert.deepEqual(validateRecentRace(withEvidence, start), withEvidence);
  assert.deepEqual(
    validateProfile(profile({ recentRace: withEvidence }), start).recentRace,
    withEvidence,
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(validateRecentRace(withEvidence))),
    withEvidence,
  );
  assert.deepEqual(
    calculateTrainingPaces(withEvidence),
    calculateTrainingPaces(race),
  );
  for (const patch of [
    { date: '2026-02-30' },
    { date: '2026-2-1' },
    { date: null },
    { source: 'easy-run' },
    { source: null },
    { course: 'sea' },
    { course: null },
  ])
    assert.throws(() => validateRecentRace({ ...race, ...patch }));
  assert.throws(
    () => validateRecentRace({ ...race, date: '2026-09-15' }, start),
    /future/,
  );
  assert.throws(
    () =>
      validateProfile(
        profile({ recentRace: { ...race, date: '2026-09-15' } }),
        start,
      ),
    { name: 'PlanError', message: /future/ },
  );
});

test('benchmark evidence distinguishes missing, stale and non-comparable conditions without altering numeric fitness', () => {
  const unknown = benchmarkEvidence(race, start);
  assert.equal(unknown.ageDays, null);
  assert.match(unknown.notices.join(' '), /No benchmark age|unspecified/);
  const dated = {
    ...race,
    date: '2026-01-01',
    source: 'race',
    course: 'trail',
  };
  const evidence = benchmarkEvidence(dated, start);
  assert.equal(evidence.ageDays, 256);
  assert.match(evidence.notices.join(' '), /older result/);
  assert.match(evidence.notices.join(' '), /terrain and elevation/);
  assert.deepEqual(calculateTrainingPaces(dated), calculateTrainingPaces(race));
  assert.match(
    benchmarkEvidence({ ...dated, date: '2026-09-15' }, start).notices.join(
      ' ',
    ),
    /future/,
  );
  assert.equal(benchmarkEvidence(dated, 'broken').ageDays, null);
});

test('metadata edits after the block starts preserve every existing prescription and two-workout preference', () => {
  const plan = makePlan(
    profile({
      goal: 'marathon',
      raceDate: addDays(start, 83),
      weeklyKm: 70,
      longestKm: 23,
      currentRuns: 5,
      days: [0, 1, 2, 4, 6],
      weekdayMinutes: 120,
      longMinutes: 300,
      qualityMode: 'custom',
      qualitySessions: 2,
      recentQualitySessions: 2,
      recentQualityMinutes: 30,
    }),
    start,
  );
  const original = structuredClone(plan);
  const evidence = {
    ...race,
    date: '2026-09-16',
    source: 'race',
    course: 'road',
  };
  const next = revisePreferences(plan, { recentRace: evidence }, '2026-09-18');
  assert.deepEqual(next.profile.recentRace, evidence);
  assert.equal(next.profile.qualityMode, 'custom');
  assert.equal(next.profile.qualitySessions, 2);
  assert.deepEqual(next.workouts, plan.workouts);
  assert.deepEqual(next.weeks, plan.weeks);
  assert.deepEqual(validatePlan(next), []);
  assert.deepEqual(plan, original, 'input remains untouched');
  const restored = validateRecovery({
    format: 'stride-recovery-2',
    exportedAt: '2026-09-18T12:00:00Z',
    profile: null,
    plan: JSON.parse(JSON.stringify(next)),
  });
  assert.deepEqual(restored.plan.profile.recentRace, evidence);
  const prescriptions = (p) =>
    p.workouts.map(
      ({ id, date, kind, minutes, estimatedKm, hard, steps, status }) => ({
        id,
        date,
        kind,
        minutes,
        estimatedKm,
        hard,
        steps,
        status,
      }),
    );
  assert.deepEqual(prescriptions(restored.plan), prescriptions(next));
  const subsequent = revisePreferences(
    next,
    { workoutVariety: 'familiar' },
    '2026-09-18',
  );
  assert.deepEqual(subsequent.profile.recentRace, evidence);
  assert.deepEqual(validatePlan(subsequent), []);
  const cleared = revisePreferences(next, { recentRace: race }, '2026-09-18');
  assert.deepEqual(cleared.workouts, next.workouts);
  assert.deepEqual(cleared.profile.recentRace, race);
  assert.throws(
    () =>
      revisePreferences(
        next,
        { recentRace: { ...race, date: '2026-09-19' } },
        '2026-09-18',
      ),
    /future/,
  );
});

test('benchmark metadata never overrides manual effort, heart-rate or partial pace settings', () => {
  const workout = { kind: 'tempo', stimulus: 'threshold' };
  const step = {
    kind: 'work',
    seconds: 300,
    intensity: 6,
    effort: 'Controlled',
  };
  const p = profile({
    recentRace: { ...race, date: '2026-09-01', source: 'race', course: 'road' },
  });
  assert.equal(
    workoutStepTarget(workout, step, {
      ...p,
      workoutTargets: { mode: 'effort' },
    }),
    undefined,
  );
  assert.equal(
    workoutStepTarget(workout, step, {
      ...p,
      workoutTargets: { mode: 'pace', pace: { easy: { low: 360, high: 390 } } },
    }),
    undefined,
  );
  assert.deepEqual(
    workoutStepTarget(workout, step, {
      ...p,
      workoutTargets: {
        mode: 'heart-rate',
        heartRate: { tempo: { low: 150, high: 160 } },
      },
    }),
    { mode: 'heart-rate', low: 150, high: 160, source: 'manual' },
  );
});

test('benchmark fields show familiar time, exact presets, selected units and actual reference pace', () => {
  const original = profile({
    units: 'mi',
    recentRace: { ...race, timeMinutes: 50.5 },
  });
  const html = render(RecentRaceFields, {
    profile: original,
    asOf: start,
    onChange: noop,
  });
  assert.match(html, /Race distance \(mi\)/);
  assert.match(html, /value="0:50:30"/);
  assert.match(html, /value="6\.21371192"/);
  assert.match(html, /Half marathon/);
  assert.match(html, /Your average pace for this result/);
  assert.match(
    html,
    /not an easy-run target or a prediction for another distance/,
  );
  assert.match(html, /No benchmark age/);
  assert.match(html, /max="2026-09-14"/);
  assert.match(html, /\/mi/);
  assert.equal(
    original.recentRace.distanceKm,
    10,
    'rendering in miles does not round canonical distance',
  );
  assert.equal(BENCHMARK_DISTANCES[2].distanceKm, 21.0975);
  assert.equal(BENCHMARK_DISTANCES[3].distanceKm, 42.195);
  assert.equal(
    BENCHMARK_DISTANCES.find((d) => d.label === 'Mile').distanceKm,
    1.609344,
  );
  assert.equal(
    BENCHMARK_DISTANCES.find((d) => d.label === '1500 m').distanceKm,
    1.5,
  );
  const manual = render(RecentRaceFields, {
    profile: profile({ workoutTargets: { mode: 'effort' } }),
    asOf: start,
    onChange: noop,
  });
  assert.match(
    manual,
    /programme determines which targets this result can support/,
  );
  const invalid = render(RecentRaceFields, {
    profile: profile({ recentRace: { ...race, date: '2026-09-15' } }),
    asOf: start,
    onChange: noop,
  });
  assert.match(invalid, /cannot be in the future/);
  assert.doesNotMatch(invalid, /Estimated training paces/);
  const unsupported = render(RecentRaceFields, {
    profile: profile({ recentRace: { distanceKm: 5, timeMinutes: 50 } }),
    asOf: start,
    onChange: noop,
  });
  assert.match(unsupported, /10:00/);
  assert.match(unsupported, /This result reflects my current fitness/);
  assert.doesNotMatch(unsupported, /class="benchmark-pace-preview"/);
});

test('unfinished elapsed-time drafts survive a JSON reload and are not turned into a plausible finish time', () => {
  const values = {
    recentRaceElapsedTime: {
      text: '1:4',
      value: 'NaN',
      factor: 1,
      pace: false,
    },
  };
  const html = renderToStaticMarkup(
    createElement(
      NumericDraftContext.Provider,
      { value: { values, set: noop } },
      createElement(ElapsedTimeInput, { value: null, onValueChange: noop }),
    ),
  );
  assert.match(html, /value="1:4"/);
  assert.ok(Number.isNaN(parseElapsedTime('1:4')));
  assert.match(
    render(ElapsedTimeInput, { value: 50.5, onValueChange: noop }),
    /value="0:50:30"/,
  );
});

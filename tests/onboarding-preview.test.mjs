import './ui-render-loader.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { demoPlan } from '../lib/engine.ts';
import { runDuration } from '../lib/journal-view.ts';

const { OnboardingWorkoutPreview } =
  await import('../components/onboarding-workout-preview.tsx');
const plan = demoPlan('2026-09-14');
const baseline = plan.workouts.find((w) => w.kind === 'long');
const render = (workout, profile = plan.profile) =>
  renderToStaticMarkup(
    createElement(OnboardingWorkoutPreview, { workout, profile }),
  );

test('onboarding previews distance targets in selected units and labels planning time as estimated', () => {
  const workout = {
    ...baseline,
    title: '23 km · Easy long run',
    minutes: 138,
    steps: [{ ...baseline.steps[0], metres: 23000, seconds: 8280 }],
  };
  const km = render(workout);
  assert.match(km, /23 km/);
  assert.match(km, /2h 18m estimated/);
  const miles = render(workout, { ...plan.profile, units: 'mi' });
  assert.match(miles, /14\.3 mi/);
  assert.doesNotMatch(miles, /23 km/);
});

test('onboarding race preview presents the exact race distance without a finish-time forecast', () => {
  const race = plan.workouts.find((w) => w.kind === 'race');
  const html = render(race);
  assert.match(html, /Race distance target/);
  assert.match(html, /10 km/);
  assert.doesNotMatch(html, new RegExp(runDuration(race.minutes)));
  assert.doesNotMatch(html, /Estimated duration|Total duration/);
});

test('onboarding measured intervals preserve targets, repeats and timed recoveries', () => {
  const work = {
    kind: 'work',
    label: 'Controlled repeat',
    seconds: 120,
    metres: 400,
    intensity: 7,
    effort: 'Controlled and strong',
    target: { mode: 'pace', low: 280, high: 300 },
  };
  const recovery = {
    kind: 'recovery',
    label: 'Easy jog',
    seconds: 90,
    intensity: 2,
    effort: 'Let your breathing settle',
  };
  const html = render({
    ...baseline,
    kind: 'intervals',
    title: 'Measured repeats',
    minutes: 8.5,
    steps: [work, recovery, { ...work }, { ...recovery }, { ...work }],
  });
  assert.match(html, /Estimated duration/);
  assert.match(html, /400 m/);
  assert.match(html, /4:40–5:00 \/km/);
  assert.match(html, /Repeat × 3/);
  assert.match(html, /Between repeats · 2 recoveries/);
  assert.match(html, /90 sec/);
});

test('onboarding timed runs retain their prescribed duration without implying a measured distance', () => {
  const step = { ...baseline.steps[0], seconds: 1800 };
  delete step.metres;
  const html = render({
    ...baseline,
    title: 'Easy running',
    minutes: 30,
    steps: [step],
  });
  assert.match(html, /30 min/);
  assert.match(html, /Total duration/);
  assert.doesNotMatch(html, /estimated/);
});

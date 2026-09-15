import './ui-render-loader.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const {
  TrainingView,
  TrainingInsights,
  WorkoutGuide,
  PlanPreferences,
  ExtraRunForm,
} = await import('../components/training.tsx');
const { TrainingComparison } =
  await import('../components/training/training-comparison.tsx');
const { metrics } =
  await import('../components/training/comparison-metrics.ts');
const { TodayRoute } = await import('../components/app/today-route.tsx');
const { AppProvider } = await import('../components/app/app-context.tsx');
const { Tabs } = await import('../components/ui/tabs.tsx');
const { demoPlan } = await import('../lib/engine.ts');
const { DEFAULT_HOME_PREFERENCES } = await import('../lib/home-preferences.ts');

const today = '2026-09-14';
const plan = demoPlan(today);
const noop = () => {};
const props = {
  plan,
  today,
  isDemo: false,
  onPreferences: noop,
  onNew: noop,
  onWorkout: noop,
  onExtra: noop,
  onClose: noop,
  onAction: async () => {},
  busy: false,
  version: 4,
};
const render = (Component, patch = {}) =>
  renderToStaticMarkup(createElement(Component, { ...props, ...patch }));

test('training entry exports preserve overview, comparison and research order', () => {
  const html = render(TrainingView);
  const overview = html.indexOf('Your starting point');
  const compare = html.indexOf('Compare your options');
  const research = html.indexOf('How other plans are shaped');
  assert.ok(overview >= 0 && compare > overview && research > compare);
  assert.match(html, /class="training-baseline">/);
  assert.equal(
    (html.match(/class="training-section" hidden=""/g) ?? []).length,
    2,
  );
  assert.match(html, /Plan preferences/);
  assert.match(render(TrainingView, { isDemo: true }), /Build my plan/);
});

test('comparison tab preserves current and alternative training metrics', () => {
  const candidate = structuredClone(plan);
  const next = candidate.workouts.find((run) => run.kind !== 'race');
  next.minutes += 10;
  const current = metrics(plan, today);
  const alternative = metrics(candidate, today);
  const html = render(TrainingComparison, {
    section: 'compare',
    option: 'maintain',
    setOption: noop,
    selectedWeek: 0,
    setSelectedWeek: noop,
    compare: { plan: candidate, patch: { volume: 'maintain' }, error: '' },
    current,
    candidate: alternative,
    unit: plan.profile.units,
    scale: Math.max(current.peak, alternative.peak),
    trainingDisplay: (value) => Math.round(value).toLocaleString(),
  });
  assert.match(html, /Weekly training minutes/);
  assert.match(html, /Peak remaining training week/);
  assert.match(html, /Longest training run/);
  assert.match(html, /Quality sessions/);
  assert.match(html, /Total training time/);
  assert.match(html, /Review this option/);
  assert.equal(alternative.minutes, current.minutes + 10);
});

test('training preferences retain preview-first form and busy protection', () => {
  const html = render(PlanPreferences);
  assert.match(html, /Choose your week. Preview the changes before saving./);
  assert.match(html, /Preview future changes/);
  assert.doesNotMatch(html, /Apply from/);
  assert.match(
    render(PlanPreferences, { busy: true }),
    /<fieldset disabled=""/,
  );
});

test('extra-run entry preserves manual, imported and correction modes', () => {
  assert.match(render(ExtraRunForm), /Log an extra run/);
  const imported = render(ExtraRunForm, {
    imported: {
      id: 'recording',
      date: today,
      movingTime: 3600,
      distance: 10000,
      source: 'Garmin',
    },
    onBackToRecordings: noop,
  });
  assert.match(imported, /Review this recording/);
  assert.match(imported, /Where does this recording belong/);
  assert.match(imported, /Back to recordings/);
  const correction = render(ExtraRunForm, {
    existing: {
      id: 'extra-run',
      date: today,
      minutes: 45,
      km: 8,
      effort: 5,
      feeling: 'good',
      note: 'Comfortable',
    },
  });
  assert.match(correction, /Correct your run/);
  assert.match(correction, /Reason for correction/);
  assert.match(correction, /Save correction/);
});

test('insights and workout-guide public entry points retain their content', () => {
  assert.match(render(TrainingInsights), /Your last four weeks/);
  assert.match(render(TrainingInsights), /Log an extra run/);
  assert.match(render(WorkoutGuide), /Inside the workouts/);
  assert.match(render(WorkoutGuide), /Workout purpose/);
});

test('today route preserves workout and rest-day presentations through app context', () => {
  const workout = plan.workouts[0];
  const state = {
    plan,
    today,
    currentDate: workout.date,
    unit: plan.profile.units,
    workout,
    dayWorkouts: [workout],
    homePreferences: DEFAULT_HOME_PREFERENCES,
    motion: 'full',
    suggestion: null,
    setSelectedDate: noop,
    setSelectedSession: noop,
    setView: noop,
    showWorkout: noop,
    showDay: noop,
  };
  const route = (value) =>
    renderToStaticMarkup(
      createElement(
        Tabs,
        { value: 'today' },
        createElement(AppProvider, { value }, createElement(TodayRoute)),
      ),
    );
  const training = route(state);
  assert.match(training, /class="workout-card"/);
  assert.match(training, /Open workout/);
  const rest = route({
    ...state,
    workout: null,
    dayWorkouts: [],
    dayTitle: 'Rest day',
  });
  assert.match(rest, /class="daily-rest-card"/);
  assert.match(rest, /Rest day, open daily guide/);
});

import './ui-render-loader.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { watchSetupState } from '../lib/watch-setup.ts';
const { WatchSetupGuide } = await import('../components/watch-setup-guide.tsx');
const today = '2026-09-21';
const workout = (id, date, patch = {}) => ({
  id,
  date,
  title: `Workout ${id}`,
  status: 'planned',
  steps: [{ seconds: 1800, target: { mode: 'pace', low: 360, high: 370 } }],
  ...patch,
});
const source = {
  plan: {
    profile: { timezone: 'UTC' },
    workouts: [
      workout('second', '2026-09-23'),
      workout('first', today),
      workout('completed', today, { status: 'completed' }),
      workout('past', '2026-09-20'),
      workout('later', '2026-10-01'),
    ],
  },
  version: 7,
  connection: {
    athlete_name: 'Runner',
    connected_at: today,
    generation: 'generation-1',
  },
  deliveries: [],
  today,
};
const receipt = (patch = {}) => ({
  workout_id: 'first',
  version: 7,
  connection_generation: 'generation-1',
  status: 'accepted',
  ...patch,
});
const render = (patch = {}) =>
  renderToStaticMarkup(
    createElement(WatchSetupGuide, {
      ...source,
      onWorkout: () => {},
      ...patch,
    }),
  );

test('guide selects the first real upcoming sendable prescription without changing it', () => {
  const before = JSON.stringify(source);
  const state = watchSetupState(source);
  assert.equal(state.workout, source.plan.workouts[1]);
  assert.equal(state.mode, 'direct');
  assert.equal(state.providerReceived, false);
  assert.equal(JSON.stringify(source), before);
});

test('a current provider receipt does not establish physical watch receipt', () => {
  const state = watchSetupState({ ...source, deliveries: [receipt()] });
  assert.equal(state.providerReceived, true);
  assert.equal(state.watchConfirmed, false);
  assert.deepEqual(state.completedSteps, [true, true, true, false]);
  const html = render({ deliveries: [receipt()] });
  assert.match(html, /does not establish delivery to your watch/);
  assert.match(html, /I can see it on my watch/);
  assert.doesNotMatch(html, /You confirmed seeing/);
});

test('only a current user confirmation finishes the walkthrough', () => {
  const state = watchSetupState({
    ...source,
    deliveries: [receipt({ status: 'confirmed' })],
  });
  assert.equal(state.watchConfirmed, true);
  assert.deepEqual(state.completedSteps, [true, true, true, true]);
  assert.match(
    render({ deliveries: [receipt({ status: 'confirmed' })] }),
    /You confirmed seeing/,
  );
});

for (const patch of [
  { connection: null },
  { connection: { ...source.connection, generation: 'reconnected' } },
  { connection: { ...source.connection, generation: undefined } },
  { version: 8 },
])
  test(`disconnect, reconnect, missing identity or changed revision invalidates old success: ${JSON.stringify(patch)}`, () => {
    const state = watchSetupState({
      ...source,
      deliveries: [receipt({ status: 'confirmed' })],
      ...patch,
    });
    assert.equal(state.providerReceived, false);
    assert.equal(state.watchConfirmed, false);
  });

for (const status of ['stale', 'failed', 'review', 'sending', 'removed'])
  test(`${status} receipts need review without suggesting watch completion`, () => {
    const state = watchSetupState({
      ...source,
      deliveries: [receipt({ status })],
    });
    assert.equal(state.needsReview, true);
    assert.equal(state.providerReceived, false);
    assert.equal(state.watchConfirmed, false);
  });

test('HR-only weeks offer a FIT file without crediting unsupported bridge receipts', () => {
  const plan = {
    ...source.plan,
    workouts: [
      workout('first', today, {
        steps: [
          {
            seconds: 1800,
            target: { mode: 'heart-rate', low: 120, high: 145 },
          },
        ],
      }),
    ],
  };
  const input = {
    plan,
    connection: null,
    deliveries: [receipt({ status: 'confirmed' })],
  };
  const state = watchSetupState({ ...source, ...input });
  assert.equal(state.mode, 'fit');
  assert.equal(state.providerReceived, false);
  assert.equal(state.watchConfirmed, false);
  const html = render(input);
  assert.match(html, /Open FIT download/);
  assert.match(html, /no Intervals.icu connection is needed/);
  assert.doesNotMatch(html, /Connect Intervals.icu|Complete<\/span>/);
  assert.match(html, /cannot verify a downloaded file/);
  assert.doesNotMatch(html, /I can see it on my watch/);
  assert.doesNotMatch(html, /disabled=""/);
});

test('a mixed week selects a pace workout for the bridge check', () => {
  const plan = structuredClone(source.plan);
  plan.workouts[1].steps[0].target = {
    mode: 'heart-rate',
    low: 120,
    high: 145,
  };
  assert.equal(watchSetupState({ ...source, plan }).workout.id, 'second');
});

test('demo and empty states provide direction without a send action', () => {
  for (const patch of [
    { isDemo: true },
    { plan: { ...source.plan, workouts: [] } },
  ]) {
    const state = watchSetupState({ ...source, ...patch });
    assert.equal(state.workout, undefined);
    assert.equal(state.providerReceived, false);
    const html = render(patch);
    assert.doesNotMatch(html, /<button/);
    assert.match(html, /Create your personal plan|no unfinished workouts/);
  }
});

test('setup is an accessible ordered sequence with one next step and explicit device evidence', () => {
  const html = render();
  assert.match(html, /<ol[^>]*aria-label="Watch setup progress"/);
  assert.equal((html.match(/aria-current="step"/g) ?? []).length, 1);
  assert.match(html, /Watch confirmation comes from you/);
  assert.match(html, /Stride cannot inspect your device/);
  assert.doesNotMatch(html, /955/);
  assert.match(render({ connection: null }), /disabled=""/);
  assert.match(render({ disabled: true }), /disabled=""/);
});

test('opening the guide action delegates the original workout to existing delivery UI', () => {
  const opened = [];
  const tree = WatchSetupGuide({ ...source, onWorkout: (w) => opened.push(w) });
  const nodes = (element) =>
    !element || typeof element !== 'object'
      ? []
      : Array.isArray(element)
        ? element.flatMap(nodes)
        : [element, ...nodes(element.props?.children)];
  const button = nodes(tree).find((node) => node.type === 'button');
  button.props.onClick();
  assert.deepEqual(opened, [source.plan.workouts[1]]);
  const disconnected = WatchSetupGuide({
    ...source,
    connection: null,
    onWorkout: (w) => opened.push(w),
  });
  nodes(disconnected)
    .find((node) => node.type === 'button')
    .props.onClick();
  assert.equal(opened.length, 1);
});

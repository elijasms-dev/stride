import './ui-render-loader.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { workoutStepGroups } from '../lib/workout-groups.ts';

const { SessionSequence, workoutTargetSummary } =
  await import('../components/session-sequence.tsx');
const { SessionBriefing } = await import('../components/session-briefing.tsx');
const { WorkoutSteps } = await import('../components/workout-steps.tsx');
const render = (component, props) =>
  renderToStaticMarkup(createElement(component, props));
const pacing = (role, guidance) => ({
  version: 'source-pacing-v1',
  role,
  label: role === 'current-5k' ? 'Current 5K pace' : 'Current 10K pace',
  guidance,
  source: {
    id: 'test-source',
    version: '1',
    title: 'Recorded programme instruction',
    scope: 'pace-instruction',
  },
  method: 'same-distance-benchmark',
  reason: 'From the selected result for this distance.',
});
const warm = {
  kind: 'warmup',
  label: 'Warm up',
  seconds: 600,
  effort: 'Run comfortably',
  intensity: 2,
};
const work = {
  kind: 'work',
  label: '400 m repetition',
  seconds: 120,
  metres: 400,
  effort: 'Saved legacy cue',
  intensity: 6,
  target: { mode: 'pace', low: 300, high: 310 },
  pacing: pacing('current-5k', 'Follow the saved current 5K effort.'),
};
const rest = {
  kind: 'recovery',
  label: 'Recover',
  seconds: 90,
  effort: 'Easy jog',
  intensity: 2,
};
const cool = { ...warm, kind: 'cooldown', label: 'Cool down', seconds: 300 };
const session = {
  id: 'test',
  title: 'A tempo pyramid',
  kind: 'intervals',
  stimulus: 'threshold',
  steps: [warm, work, rest, { ...work }, cool],
};

test('mixed target headlines compare every work segment, including its saved role', () => {
  assert.equal(workoutTargetSummary(session, 'km').value, '5:00–5:10 /km');
  const changed = { ...work, target: { mode: 'pace', low: 320, high: 330 } };
  assert.equal(
    workoutTargetSummary(
      { ...session, steps: [warm, work, rest, changed, cool] },
      'km',
    ).value,
    'Varied paces',
  );
  const differentRole = {
    ...work,
    pacing: pacing('current-10k', 'Saved 10K cue'),
  };
  assert.equal(
    workoutTargetSummary({ ...session, steps: [work, differentRole] }, 'km')
      .value,
    'Varied targets',
  );
  assert.equal(
    workoutTargetSummary(
      { ...session, steps: [work, { ...work, target: undefined }] },
      'km',
    ).value,
    'Varied targets',
  );
});

test('different source instructions are not merged into one repeated set', () => {
  assert.equal(
    workoutStepGroups(session.steps).find((g) => g.start === 1).repetitions,
    2,
  );
  const changed = {
    ...work,
    pacing: pacing('current-10k', 'Follow the saved current 10K effort.'),
  };
  assert.equal(workoutStepGroups([work, rest, changed]).length, 3);
});

test('the sequence describes exact repeat and recovery counts without a numeric pace scale', () => {
  const html = render(SessionSequence, {
    workout: session,
    units: 'km',
    selectedIndex: 1,
  });
  assert.match(html, /2 × 400 m/);
  assert.match(html, /between repeats \(1 recovery\)/);
  assert.match(html, /Schematic, not to scale or a pace graph/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /Follow the saved current 5K effort/);
  assert.match(html, /5:00–5:10 \/km/);
  assert.doesNotMatch(html, /Saved legacy cue/);
  const compact = render(SessionSequence, {
    workout: session,
    units: 'km',
    compact: true,
  });
  assert.match(compact, /1 × 90 sec recovery/);
});

test('ordinary lengths use the selected units while track repeats preserve their authored distance', () => {
  const measured = {
    ...session,
    steps: [
      { ...warm, metres: 2000 },
      work,
      rest,
      { ...work },
      { ...cool, metres: 1000 },
    ],
  };
  const html = render(SessionSequence, { workout: measured, units: 'mi' });
  const rows = render(WorkoutSteps, {
    workout: measured,
    profile: { units: 'mi' },
  });
  for (const output of [html, rows]) {
    assert.match(output, /1.2 mi/);
    assert.match(output, /0.6 mi/);
    assert.match(output, /400 m/);
  }
  const long = {
    ...session,
    kind: 'long',
    steps: [{ ...warm, kind: 'aerobic', metres: 10000 }],
  };
  assert.match(
    render(SessionSequence, { workout: long, units: 'mi' }),
    /6.2 mi/,
  );
});

test('the diagram includes every on/off recovery, including the last', () => {
  const reset = {
    ...rest,
    kind: 'aerobic',
    label: 'Easy off block',
    seconds: 60,
  };
  const workout = {
    ...session,
    steps: [warm, work, reset, { ...work }, { ...reset }, cool],
  };
  const html = render(SessionSequence, { workout, units: 'km', compact: true });
  assert.match(html, /2 × 1 min recovery/);
  assert.equal((html.match(/sequence-recovery-cue/g) ?? []).length, 1);
});

test('selection exposes the chosen actual segment rather than the first work target', () => {
  const html = render(SessionSequence, {
    workout: session,
    units: 'km',
    selectedIndex: 4,
  });
  const instruction = html.slice(html.indexOf('class="sequence-instruction"'));
  assert.match(instruction, /Cool down/);
  assert.match(instruction, /Run comfortably/);
  assert.doesNotMatch(instruction, /5:00/);
});

test('unknown and historical effort-only sessions remain qualitative without mutating their snapshot', () => {
  const unknown = {
    ...session,
    steps: [warm, { ...work, target: undefined, pacing: undefined }, cool],
  };
  const before = JSON.stringify(unknown);
  const html = render(SessionSequence, {
    workout: unknown,
    units: 'km',
    selectedIndex: 1,
  });
  assert.match(html, /Saved legacy cue/);
  assert.doesNotMatch(html, /\/km|From the selected result/);
  assert.equal(JSON.stringify(unknown), before);
});

test('briefing uses saved coaching instructions instead of inferring from title or stimulus', () => {
  const html = render(SessionBriefing, { workout: session, units: 'km' });
  assert.match(html, /Follow the saved current 5K effort/);
  assert.doesNotMatch(
    html,
    /as the repetitions grow|final repeat feel as composed/,
  );
});

test('source explanation and textual steps remain available beside the drawing', () => {
  const html = render(WorkoutSteps, {
    workout: session,
    profile: { units: 'km' },
    selectedIndex: 1,
  });
  assert.match(html, /Repeat × 2/);
  assert.match(html, /data-selected-step="true"/);
  assert.match(html, /Current 5K pace/);
  assert.match(html, /Why this target/);
  assert.match(html, /From the selected result for this distance/);
  assert.match(html, /Recorded programme instruction/);
});

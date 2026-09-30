import './ui-render-loader.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement, Children, isValidElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  makePlan,
  demoProfile,
  addDays,
  revisePreferences,
  validatePlan,
} from '../lib/engine.ts';
import { requestedQualityCount } from '../lib/training-structure.ts';
import {
  initialTargetSettings,
  targetSettingsConfig,
} from '../lib/workout-target-form.ts';
import {
  benchmarkWorkoutTargets,
  updateWorkoutTargets,
  validateWorkoutTargets,
  parsePace,
} from '../lib/workout-targets.ts';
const { WorkoutFrequencyField, ScheduleFields, PlanCustomizationFields } =
  await import('../components/training-controls.tsx');
const { TrainingPattern } = await import('../components/training-pattern.tsx');
const { default: WorkoutTargetSettings } =
  await import('../components/workout-target-settings.tsx');

const start = '2026-09-07';
function profile(goal = '10k', patch = {}) {
  return {
    ...demoProfile(start),
    goal,
    startDate: start,
    raceDate: addDays(start, 83),
    experience: 'established',
    intent: 'finish',
    weeklyKm: goal === 'marathon' ? 70 : goal === 'half' ? 55 : 50,
    longestKm:
      goal === 'marathon'
        ? 23
        : goal === 'half'
          ? 16
          : goal === '10k'
            ? 14
            : 12,
    currentRuns: 5,
    runsPerWeek: 5,
    availableDays: [0, 1, 2, 3, 4, 5, 6],
    days: [0, 1, 2, 3, 5],
    longDay: 5,
    weekdayMinutes: 120,
    longMinutes: 300,
    easyPace: 6,
    recentQualitySessions: 2,
    recentQualityMinutes: 40,
    qualityMode: 'custom',
    qualitySessions: 2,
    ...patch,
  };
}
const render = (Component, props) =>
  renderToStaticMarkup(createElement(Component, props));
function findElement(tree, predicate) {
  if (!isValidElement(tree)) return undefined;
  if (predicate(tree)) return tree;
  for (const child of Children.toArray(tree.props.children)) {
    const found = findElement(child, predicate);
    if (found) return found;
  }
}
function chooseFrequency(p, choice) {
  let edited;
  const tree = WorkoutFrequencyField({
    profile: p,
    onChange: (next) => {
      edited = next;
    },
  });
  const control = findElement(
    tree,
    (node) => node.props.label === 'Harder workouts per week',
  );
  assert.ok(control);
  assert.ok(
    control.props.options.some(
      (option) => option.value === choice && !option.disabled,
    ),
  );
  control.props.onChange(choice);
  return edited;
}
for (const goal of ['5k', '10k', 'half', 'marathon']) {
  for (const intent of ['finish', 'improve']) {
    for (const choice of ['automatic', '0', '1', '2']) {
      test(`${goal} ${intent}: actual frequency control → preference rebuild → serialize → reopen preserves ${choice}`, () => {
        const original = makePlan(profile(goal, { intent }), start, false);
        const edited = chooseFrequency(original.profile, choice);
        assert.equal(
          edited.intent,
          intent,
          'Frequency choice must not change race intent',
        );
        const candidate = revisePreferences(original, edited, start);
        const reopened = JSON.parse(JSON.stringify(candidate));
        assert.deepEqual(validatePlan(reopened), []);
        const expected =
          choice === 'automatic'
            ? requestedQualityCount({
                ...reopened.profile,
                qualityMode: 'automatic',
              })
            : Number(choice);
        assert.equal(requestedQualityCount(reopened.profile), expected);
        assert.equal(reopened.profile.intent, intent);
        const html = render(ScheduleFields, {
          profile: reopened.profile,
          onChange() {},
        });
        assert.match(html, new RegExp(`checked="" value="${choice}"`));
        const pattern = render(TrainingPattern, { profile: reopened.profile });
        assert.equal(
          (pattern.match(/data-role="workout"/g) ?? []).length,
          expected,
        );
        const advanced = render(ScheduleFields, {
          profile: reopened.profile,
          section: 'advanced',
          onChange() {},
        });
        if (expected) assert.match(advanced, /Available quality slots:/);
        else assert.match(advanced, /no separate hard session is requested/);
        // Editing an unrelated preference must retain both the source and resolved count.
        const subsequent = revisePreferences(
          reopened,
          { workoutVariety: 'familiar' },
          start,
        );
        assert.equal(requestedQualityCount(subsequent.profile), expected);
        assert.equal(
          subsequent.profile.qualityMode,
          reopened.profile.qualityMode,
        );
      });
    }
  }
}

test('automatic distinguishes a familiar finish routine from one with no quality history', () => {
  for (const [recentQualitySessions, expected] of [
    [2, 1],
    [0, 0],
  ]) {
    const p = profile('10k', {
      qualityMode: undefined,
      qualitySessions: 2,
      recentQualitySessions,
    });
    const html = render(WorkoutFrequencyField, { profile: p, onChange() {} });
    assert.match(html, /checked="" value="automatic"/);
    assert.match(html, new RegExp(`${expected} per week`));
    assert.equal(requestedQualityCount(p), expected);
  }
});

test('time availability is visible before advanced customization and is not duplicated', () => {
  const html = render(PlanCustomizationFields, {
    profile: profile(),
    onChange() {},
  });
  assert.ok(
    html.indexOf('Time available for running') <
      html.indexOf('class="plan-advanced"'),
  );
  assert.equal((html.match(/name="weekdayMinutes"/g) ?? []).length, 1);
  assert.equal((html.match(/name="longMinutes"/g) ?? []).length, 1);
});

function targetPlan(patch = {}) {
  return makePlan(
    profile('10k', {
      recentRace: {
        distanceKm: 5,
        timeMinutes: 25,
        date: '2026-08-01',
        source: 'race',
        course: 'road',
      },
      ...patch,
    }),
    start,
    false,
  );
}
const targetProps = (plan) => ({
  plan,
  version: 1,
  onAction: async () => {},
  onClose() {},
  busy: false,
});

test('benchmark settings show programme guidance without copying a universal pace table', () => {
  const plan = targetPlan();
  const draft = initialTargetSettings(plan.profile);
  assert.equal(draft.mode, 'automatic');
  assert.equal(targetSettingsConfig(plan.profile, draft), null);
  const html = render(WorkoutTargetSettings, targetProps(plan));
  assert.match(html, /Programme guidance/);
  assert.match(html, /Your reference result/);
  assert.match(html, /value="0:25:00"/);
  assert.match(
    html,
    /not an easy-run target or a prediction for another distance/,
  );
  assert.equal(draft.pace.easy.low, '');
  assert.deepEqual(
    updateWorkoutTargets(plan, null, start),
    plan,
    'Unchanged automatic save must preserve every prescription',
  );
});

test('effort override and reset are reversible while protected and recorded prescriptions stay intact', () => {
  const plan = targetPlan();
  const protectedId = plan.workouts.find((w) => w.date > start).id;
  const completed = plan.workouts.find((w) => w.date === start);
  completed.status = 'completed';
  const snapshot = structuredClone(plan);
  const effort = updateWorkoutTargets(plan, { mode: 'effort' }, start, [
    protectedId,
  ]);
  assert.equal(initialTargetSettings(effort.profile).mode, 'effort');
  const eligible = (w) => w.status === 'planned' && w.id !== protectedId;
  assert.ok(
    effort.workouts
      .filter(eligible)
      .every((w) => w.steps.every((s) => !s.target)),
  );
  const reset = updateWorkoutTargets(effort, null, start, [protectedId]);
  assert.equal(Object.hasOwn(reset.profile, 'workoutTargets'), false);
  assert.equal(initialTargetSettings(reset.profile).mode, 'automatic');
  assert.ok(
    reset.workouts
      .filter(eligible)
      .every((w) => w.steps.every((s) => !s.target)),
  );
  for (const id of [completed.id, protectedId])
    assert.deepEqual(
      reset.workouts.find((w) => w.id === id),
      snapshot.workouts.find((w) => w.id === id),
    );
  assert.deepEqual(plan, snapshot, 'Input plan is immutable');
  assert.deepEqual(updateWorkoutTargets(reset, null, start), reset);
});

test('automatic without a benchmark remains explicit in the UI and resets an old manual override', () => {
  const plan = targetPlan({
    recentRace: undefined,
    workoutTargets: { mode: 'pace', pace: { easy: { low: 360, high: 400 } } },
  });
  const reset = updateWorkoutTargets(plan, null, start);
  const html = render(WorkoutTargetSettings, targetProps(reset));
  assert.match(html, /Add race benchmark/);
  assert.match(html, /Programme guidance/);
  assert.ok(reset.workouts.every((w) => w.steps.every((s) => !s.target)));
});

test('unchanged manual pace save preserves canonical precision in miles and all saved snapshots', () => {
  const plan = targetPlan({
    units: 'mi',
    workoutTargets: {
      mode: 'pace',
      bandsVersion: 2,
      pace: { easy: { low: 360, high: 397 }, tempo: { low: 300, high: 322 } },
    },
  });
  const draft = initialTargetSettings(plan.profile);
  const config = targetSettingsConfig(plan.profile, draft);
  assert.deepEqual(config, plan.profile.workoutTargets);
  assert.deepEqual(updateWorkoutTargets(plan, config, start), plan);
  draft.pace.easy.low = '9:50';
  assert.notEqual(
    targetSettingsConfig(plan.profile, draft).pace.easy.low,
    config.pace.easy.low,
  );
});

test('cross-band validation rejects separated reversals across absent middle bands and units', () => {
  for (const [easier, harder] of [
    ['easy', 'steady'],
    ['easy', 'interval'],
    ['steady', 'tempo'],
    ['tempo', 'interval'],
  ]) {
    const pace = {
      easy: { low: 450, high: 480 },
      [easier]: { low: 180, high: 190 },
      [harder]: { low: 600, high: 620 },
    };
    assert.throws(
      () => validateWorkoutTargets({ mode: 'pace', pace }),
      /should not be entirely slower/,
    );
    const heartRate = {
      easy: { low: 80, high: 100 },
      [easier]: { low: 200, high: 220 },
      [harder]: { low: 80, high: 90 },
    };
    assert.throws(
      () => validateWorkoutTargets({ mode: 'heart-rate', heartRate }),
      /should not be entirely lower in heart rate/,
    );
  }
  const pace = {
    easy: { low: parsePace('4:50', 'mi'), high: parsePace('5:00', 'mi') },
    interval: { low: parsePace('16:00', 'mi'), high: parsePace('16:20', 'mi') },
  };
  assert.throws(
    () => validateWorkoutTargets({ mode: 'pace', pace }),
    /swapped/,
  );
  assert.throws(
    () => updateWorkoutTargets(targetPlan(), { mode: 'pace', pace }, start),
    /swapped/,
  );
});

test('reasonable overlap and event-specific race ranges are accepted without made-up HR formulas', () => {
  const pace = {
    mode: 'pace',
    pace: {
      easy: { low: 330, high: 390 },
      steady: { low: 320, high: 360 },
      tempo: { low: 310, high: 340 },
      interval: { low: 290, high: 320 },
      race: { low: 420, high: 440 },
    },
  };
  const hr = {
    mode: 'heart-rate',
    heartRate: {
      easy: { low: 130, high: 160 },
      steady: { low: 150, high: 170 },
      tempo: { low: 160, high: 180 },
      interval: { low: 170, high: 190 },
      race: { low: 140, high: 150 },
    },
  };
  assert.deepEqual(validateWorkoutTargets(pace), pace);
  assert.deepEqual(validateWorkoutTargets(hr), hr);
  const auto = benchmarkWorkoutTargets(
    profile('10k', { recentRace: { distanceKm: 5, timeMinutes: 25 } }),
    'threshold',
  );
  assert.equal(
    auto,
    undefined,
    'A benchmark alone cannot select programme-specific targets',
  );
  assert.deepEqual(validateWorkoutTargets({ mode: 'automatic' }), {
    mode: 'automatic',
  });
});

test('the frequency UI cannot fund two workouts by hiding a second long run in an easy day', () => {
  assert.throws(
    () =>
      makePlan(profile('5k', { weeklyKm: 50, longestKm: 10 }), start, false),
    /starting weekly distance and long-run baseline cannot fit/,
  );
});

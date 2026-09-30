import test from 'node:test';
import assert from 'node:assert/strict';
import {
  currentRaceInstruction,
  resolveStepPacing,
  validPaceInstruction,
  validStepPacing,
} from '../lib/source-pacing.ts';
import {
  validStepTarget,
  targetLabel,
  validateWorkoutTargets,
  withWorkoutTargets,
  updateWorkoutTargets,
} from '../lib/workout-targets.ts';
import {
  validateRecentRace,
  schedulingEasyPace,
} from '../lib/fitness-pacing.ts';
import { WORKOUT_LIBRARY, scaleTemplate } from '../lib/workout-library.ts';

const work = {
  kind: 'work',
  seconds: 180,
  intensity: 7,
  effort: 'Controlled running',
  movement: 'run',
  label: 'Work',
};
const workout = {
  id: 'sample',
  date: '2026-10-12',
  originalDate: '2026-10-12',
  week: 0,
  kind: 'intervals',
  stimulus: 'aerobic-power',
  minutes: 3,
  estimatedKm: 0.6,
  status: 'planned',
  hard: true,
  title: 'Repetitions',
  purpose: 'Controlled',
  reason: 'Test fixture',
  steps: [work],
};
const profile = {
  goal: 'marathon',
  units: 'km',
  easyPace: 6,
  runMeasure: 'time',
  recentRace: {
    distanceKm: 5,
    timeMinutes: 25,
    representative: true,
    course: 'road',
  },
  workoutTargets: { mode: 'automatic' },
};
const named = (sourceId, kind, distanceKm) => ({
  sourceId,
  sourceVersion: 'public-2026-09-28',
  kind,
  ...(distanceKm === undefined ? {} : { distanceKm }),
});

test('same-distance result supplies one point, without race equivalence or a tolerance band', () => {
  const resolved = resolveStepPacing(
    workout,
    { ...work, paceInstruction: currentRaceInstruction(5) },
    profile,
  );
  assert.equal(resolved.role, 'current-5k');
  assert.deepEqual(resolved.target, {
    mode: 'pace',
    low: 300,
    high: 300,
    source: 'benchmark',
    model: 'same-distance-result-v1',
  });
  assert.equal(resolved.source.scope, 'stride-recipe');
  assert.equal(validStepPacing(resolved, resolved.target), true);
  assert.equal(targetLabel(resolved.target), '5:00 /km');
  assert.equal(
    resolveStepPacing(
      workout,
      { ...work, paceInstruction: currentRaceInstruction(10) },
      profile,
    ).target,
    undefined,
  );
});

test('the selected race does not rewrite an explicit current-5K instruction', () => {
  for (const goal of ['5k', '10k', 'half', 'marathon', 'custom', 'ultra']) {
    const result = resolveStepPacing(
      workout,
      { ...work, paceInstruction: currentRaceInstruction(5) },
      { ...profile, goal, raceDistanceKm: 50 },
    );
    assert.equal(result.role, 'current-5k');
    assert.equal(result.target.low, 300);
  }
});

test('source fixtures distinguish Higdon 5K mile repeats from 10K 5K repeats', () => {
  // Official 5K intermediate: 400m at 1500m/mile pace, not Daniels I.
  // Official 10K intermediate: 400m at current 5K pace.
  const five = {
    ...work,
    seconds: 48,
    metres: 400,
    paceInstruction: named('higdon-5k-intermediate', 'current-race', 1.609344),
  };
  const ten = {
    ...work,
    metres: 400,
    paceInstruction: named('higdon-10k-intermediate', 'current-race', 5),
  };
  const mileProfile = {
    ...profile,
    recentRace: {
      distanceKm: 1.609344,
      timeMinutes: 8,
      representative: true,
      course: 'track',
    },
  };
  assert.equal(
    resolveStepPacing({ ...workout, stimulus: 'economy' }, five, mileProfile)
      .target.low,
    Math.round(480 / 1.609344),
  );
  assert.equal(resolveStepPacing(workout, five, profile).target, undefined);
  assert.equal(resolveStepPacing(workout, ten, profile).target.low, 300);
  assert.equal(
    validPaceInstruction(named('higdon-5k-intermediate', 'current-race', 5)),
    false,
  );
  assert.equal(
    validPaceInstruction(
      named('higdon-10k-intermediate', 'current-race', 1.609344),
    ),
    false,
  );
});

test('source progressive effort, conversational running, hills and beginners never acquire inferred numeric targets', () => {
  for (const kind of ['progressive', 'conversational']) {
    const result = resolveStepPacing(
      workout,
      { ...work, paceInstruction: named('higdon-5k-intermediate', kind) },
      profile,
    );
    assert.equal(result.target, undefined);
    assert.equal(result.method, 'effort');
    assert.equal(validStepPacing(result), true);
  }
  for (const w of [
    { ...workout, templateId: 'hill-reps' },
    {
      ...workout,
      beginnerLesson: { stage: 0, lesson: 0, stageStarted: '2026-10-12' },
    },
  ]) {
    const result = resolveStepPacing(
      w,
      { ...work, paceInstruction: currentRaceInstruction(5) },
      profile,
    );
    assert.equal(result.target, undefined);
  }
  assert.equal(
    resolveStepPacing(workout, work, profile).target,
    undefined,
    'unclassified intervals do not use universal VDOT',
  );
});

test('representative confirmation and comparable result are necessary', () => {
  for (const patch of [
    { representative: undefined },
    { representative: false },
    { course: 'trail' },
    { course: 'treadmill' },
    { distanceKm: 10 },
  ]) {
    assert.equal(
      resolveStepPacing(
        workout,
        { ...work, paceInstruction: currentRaceInstruction(5) },
        { ...profile, recentRace: { ...profile.recentRace, ...patch } },
      ).target,
      undefined,
    );
  }
  assert.throws(() =>
    validateRecentRace({ ...profile.recentRace, representative: 'yes' }),
  );
  assert.equal(validateRecentRace(profile.recentRace).representative, true);
});

test('goal pace needs an explicit source rule, matching event scope and its own evidence', () => {
  const instruction = named(
    'higdon-marathon-intermediate',
    'goal-race',
    42.195,
  );
  const p = {
    ...profile,
    workoutTargets: {
      mode: 'automatic',
      goalTimeMinutes: 240,
      raceScope: 'marathon:',
    },
  };
  const result = resolveStepPacing(
    workout,
    { ...work, paceInstruction: instruction },
    p,
  );
  assert.equal(result.target.low, Math.round(14400 / 42.195));
  assert.deepEqual(result.goal, { distanceKm: 42.195, timeMinutes: 240 });
  assert.equal(validStepPacing(result, result.target), true);
  assert.equal(
    resolveStepPacing(
      workout,
      { ...work, paceInstruction: instruction },
      { ...p, goal: 'half' },
    ).target,
    undefined,
  );
  assert.equal(
    resolveStepPacing(workout, work, p).target,
    undefined,
    'goal never leaks into generic intervals',
  );
});

test('per-role overrides preserve automatic resolution elsewhere and permit point targets', () => {
  const p = {
    ...profile,
    workoutTargets: validateWorkoutTargets({
      mode: 'automatic',
      overrides: { threshold: { mode: 'pace', low: 320, high: 320 } },
    }),
  };
  assert.equal(
    resolveStepPacing({ ...workout, stimulus: 'threshold' }, work, p).target
      .low,
    320,
  );
  assert.equal(
    resolveStepPacing(
      workout,
      { ...work, paceInstruction: currentRaceInstruction(5) },
      p,
    ).target.low,
    300,
  );
  p.workoutTargets.overrides.threshold = { mode: 'effort' };
  assert.equal(
    resolveStepPacing({ ...workout, stimulus: 'threshold' }, work, p).target,
    undefined,
  );
  assert.equal(validStepTarget({ mode: 'pace', low: 120, high: 120 }), true);
  assert.equal(validStepTarget({ mode: 'pace', low: 1200, high: 1200 }), true);
  for (const range of [
    { low: 400.8, high: 400.2 },
    { low: 119.9, high: 119.9 },
    { low: 1200.1, high: 1200.1 },
    { low: NaN, high: 300 },
  ])
    assert.throws(() =>
      validateWorkoutTargets({
        mode: 'automatic',
        overrides: { easy: { mode: 'pace', ...range } },
      }),
    );
  assert.equal(
    schedulingEasyPace({
      ...profile,
      workoutTargets: {
        mode: 'automatic',
        overrides: { easy: { mode: 'pace', low: 360, high: 390 } },
      },
    }),
    6.5,
  );
});

test('saved metadata validates regardless of property order and rejects mismatched pace evidence', () => {
  const result = resolveStepPacing(
    workout,
    { ...work, paceInstruction: currentRaceInstruction(5) },
    profile,
  );
  const reorder = (obj) => Object.fromEntries(Object.entries(obj).reverse());
  assert.equal(
    validStepPacing(
      {
        ...result,
        source: reorder(result.source),
        target: reorder(result.target),
      },
      result.target,
    ),
    true,
  );
  assert.equal(
    validStepPacing({ ...result, target: { ...result.target, low: 299 } }),
    false,
  );
  assert.equal(
    validStepPacing({
      ...result,
      evidence: { ...result.evidence, timeMinutes: 20 },
    }),
    false,
  );
  assert.equal(
    validStepPacing({
      ...result,
      source: { ...result.source, url: 'https://unverified.invalid' },
    }),
    false,
  );
});

test('generated marathon speed recipes carry their actual 5K meaning', () => {
  const recipes = WORKOUT_LIBRARY.filter(
    (t) => t.id.startsWith('marathon-book-') && t.stimulus === 'aerobic-power',
  );
  assert.ok(recipes.length > 0);
  for (const recipe of recipes)
    assert.deepEqual(recipe.paceInstruction, currentRaceInstruction(5));
  const recipe = recipes.find((t) => !t.workMetres);
  const scaled = scaleTemplate(recipe, 60, false, 'Build', 12, 12, profile);
  assert.ok(scaled);
  for (const step of scaled.steps.filter((s) => s.kind === 'work'))
    assert.deepEqual(step.paceInstruction, currentRaceInstruction(5));
});

test('explicit review migrates old automatic targets and preserves protected history', () => {
  const old = {
    ...workout,
    steps: [
      {
        ...work,
        target: {
          mode: 'pace',
          low: 270,
          high: 290,
          source: 'benchmark',
          model: 'old-generic',
        },
      },
    ],
  };
  const plan = {
    profile,
    weeks: [],
    workouts: [old, { ...structuredClone(old), id: 'protected' }],
  };
  const next = updateWorkoutTargets(plan, null, '2026-10-12', ['protected']);
  assert.equal(next.workouts[0].steps[0].target, undefined);
  assert.equal(next.workouts[0].steps[0].pacing.method, 'effort');
  assert.deepEqual(next.workouts[1], plan.workouts[1]);
  assert.deepEqual(plan.workouts[0], old);
});

test('legacy saved marathon speed recipes retain current 5K meaning on review', () => {
  const result = resolveStepPacing(
    { ...workout, templateId: 'marathon-book-six-hundred-timed' },
    work,
    profile,
  );
  assert.equal(result.role, 'current-5k');
  assert.equal(result.target.low, 300);
  assert.equal(result.source.id, 'stride-adaptive');
  assert.equal(
    resolveStepPacing(
      { ...workout, templateId: 'unverified-six-hundred-timed' },
      work,
      profile,
    ).target,
    undefined,
  );
});

test('unsupported legacy ultra event lengths retain valid effort snapshots', () => {
  for (const distanceKm of [120, 160.9344]) {
    const result = resolveStepPacing(
      {
        ...workout,
        kind: 'race',
        stimulus: 'race-rhythm',
        eventDistanceKm: distanceKm,
      },
      work,
      { ...profile, goal: 'ultra', raceDistanceKm: distanceKm },
    );
    assert.equal(result.target, undefined);
    assert.equal(result.referenceDistanceKm, undefined);
    assert.equal(validStepPacing(result, undefined), true);
  }
});

test('evidence-only review recalculates automatic roles without changing saved endpoints', () => {
  const tagged = {
    ...workout,
    steps: [{ ...work, paceInstruction: currentRaceInstruction(5) }],
  };
  const saved = withWorkoutTargets(tagged, profile);
  const plan = { profile, weeks: [], workouts: [saved] };
  const next = updateWorkoutTargets(
    plan,
    profile.workoutTargets,
    '2026-10-12',
    [],
    {
      recentRace: { ...profile.recentRace, timeMinutes: 24 },
    },
  );
  assert.equal(next.workouts[0].steps[0].target.low, 288);
  assert.equal(next.workouts[0].steps[0].seconds, saved.steps[0].seconds);
  assert.equal(plan.workouts[0].steps[0].target.low, 300);
});

test('stale event goals and generic overrides are discarded, while exact distance roles survive', () => {
  const stale = {
    mode: 'automatic',
    raceScope: 'half:',
    goalTimeMinutes: 120,
    overrides: {
      'goal-race': { mode: 'pace', low: 300, high: 300 },
      'current-race': { mode: 'pace', low: 310, high: 310 },
      race: { mode: 'pace', low: 320, high: 320 },
      'current-5k': { mode: 'pace', low: 280, high: 280 },
    },
  };
  const p = { ...profile, workoutTargets: stale };
  const plan = { profile: p, weeks: [], workouts: [] };
  const next = updateWorkoutTargets(plan, stale, '2026-10-12');
  assert.equal(next.profile.workoutTargets.goalTimeMinutes, undefined);
  assert.deepEqual(Object.keys(next.profile.workoutTargets.overrides), [
    'current-5k',
  ]);
  assert.equal(next.profile.workoutTargets.raceScope, 'marathon:');
  const reviewed = updateWorkoutTargets(
    plan,
    { ...stale, raceScope: 'marathon:', goalTimeMinutes: 240 },
    '2026-10-12',
  );
  assert.equal(reviewed.profile.workoutTargets.goalTimeMinutes, 240);
  assert.equal(reviewed.profile.workoutTargets.overrides['goal-race'].low, 300);
});

test('recovery rejects numeric provenance inconsistent with its source or role', () => {
  const current = resolveStepPacing(
    workout,
    { ...work, paceInstruction: currentRaceInstruction(5) },
    profile,
  );
  assert.equal(validStepPacing({ ...current, role: 'threshold' }), false);
  assert.equal(
    validStepPacing({
      ...current,
      target: { ...current.target, model: 'unverified-equivalence' },
    }),
    false,
  );
  assert.equal(
    validStepPacing({
      ...current,
      evidence: { ...current.evidence, course: 'trail' },
    }),
    false,
  );
  const nhs = resolveStepPacing(
    {
      ...workout,
      beginnerLesson: { stage: 0, lesson: 0, stageStarted: '2026-10-12' },
    },
    work,
    profile,
  );
  assert.equal(validStepPacing({ ...current, source: nhs.source }), false);
  assert.equal(
    validStepPacing({
      ...current,
      role: 'progressive',
      method: 'manual-override',
      target: { mode: 'pace', low: 300, high: 300, source: 'manual' },
    }),
    false,
  );
});

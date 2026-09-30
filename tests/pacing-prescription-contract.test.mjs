import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addDays,
  demoProfile,
  makePlan,
  revisePreferences,
  refreshWeekTotals,
  refreshWorkoutVariety,
  validatePlan,
} from '../lib/engine.ts';
import { distanceEstimate, qualityWorkMinutes } from '../lib/prescription.ts';
import { prescribedDistanceKm, updateRunMeasure } from '../lib/run-distance.ts';
import { validateRecovery, prepareRestoredPlan } from '../lib/recovery.ts';
import { trainingContractCases } from '../scripts/verify-training-contracts.mjs';
import {
  updateWorkoutTargets,
  withWorkoutTargets,
} from '../lib/workout-targets.ts';

const start = '2026-09-28';
const benchmark = { distanceKm: 5, timeMinutes: 25 };
const manual = {
  mode: 'pace',
  pace: {
    easy: { low: 330, high: 360 },
    steady: { low: 315, high: 330 },
    tempo: { low: 300, high: 315 },
    interval: { low: 270, high: 300 },
  },
};

function profile(goal = '5k', runMeasure = 'time', patch = {}) {
  const [weeklyKm, longestKm] = {
    '5k': [24, 8],
    '10k': [30, 10],
    half: [40, 12],
    marathon: [48, 16],
  }[goal];
  return {
    ...demoProfile(start),
    goal,
    weeklyKm,
    longestKm,
    currentRuns: 4,
    days: [0, 2, 4, 6],
    availableDays: [0, 2, 4, 6],
    runsPerWeek: 4,
    longDay: 6,
    experience: 'established',
    planLevel: 'standard',
    intent: 'improve',
    qualityMode: 'custom',
    qualitySessions: 1,
    recentQualitySessions: 1,
    weekdayMinutes: 120,
    longMinutes: 300,
    raceDate: addDays(start, 139),
    easyPace: null,
    recentRace: benchmark,
    workoutTargets: undefined,
    runMeasure,
    ...patch,
  };
}

function easyWorkout(patch = {}) {
  return {
    id: 'pacing-contract-easy',
    date: start,
    originalDate: start,
    week: 0,
    kind: 'easy',
    title: 'Easy run',
    minutes: 40,
    estimatedKm: 5,
    hard: false,
    status: 'planned',
    stimulus: 'aerobic',
    qualityMinutes: 0,
    purpose: 'Conversational running.',
    reason: 'Synthetic prescription contract.',
    steps: [
      {
        kind: 'work',
        label: 'Easy running',
        seconds: 2400,
        intensity: 3,
        effort: 'Conversational · full sentences · 2–3 / 10',
        movement: 'run',
      },
    ],
    distanceEstimate: { lowerKm: 4.3, upperKm: 5.3, basis: 'Old estimate.' },
    ...patch,
  };
}

// This oracle reads the executable instructions, not fitness coefficients or
// scheduling allocations. Time / (seconds per km) is the user's possible distance.
function executableDistanceRange(workout) {
  let low = 0,
    high = 0;
  for (const step of workout.steps) {
    if (step.metres !== undefined) {
      low += step.metres / 1000;
      high += step.metres / 1000;
    } else if (step.target?.mode === 'pace') {
      low += step.seconds / step.target.high;
      high += step.seconds / step.target.low;
    } else return null;
  }
  return { low, high };
}

function assertCanonicalDistance(workout, runner) {
  assert.deepEqual(
    workout.distanceEstimate,
    distanceEstimate(workout.steps, runner),
    `${workout.date} ${workout.title}: saved estimate differs from the displayed prescription`,
  );
  const range = executableDistanceRange(workout);
  if (!range) return false;
  assert.ok(
    workout.estimatedKm >= range.low - 0.02 &&
      workout.estimatedKm <= range.high + 0.02,
    `${workout.title}: ${workout.estimatedKm} km is outside executable ${range.low}–${range.high} km`,
  );
  assert.ok(workout.distanceEstimate.lowerKm !== null);
  assert.ok(workout.distanceEstimate.upperKm !== null);
  assert.ok(workout.distanceEstimate.lowerKm <= range.low + 1e-6);
  assert.ok(workout.distanceEstimate.upperKm >= range.high - 1e-6);
  return true;
}

function complete(workout) {
  workout.status = 'completed';
  workout.feedback = {
    actualDate: workout.date,
    actualMinutes: workout.minutes,
    actualKm: workout.estimatedKm,
    effort: 3,
    feeling: 'good',
    execution: 'as-planned',
    executionSource: 'self-report',
    completedQualityMinutes: qualityWorkMinutes(workout),
    note: 'Synthetic completed history, retained exactly.',
    recordedAt: `${workout.date}T20:00:00Z`,
  };
}

function assertWeeklyTotals(plan) {
  for (const week of plan.weeks) {
    const training = plan.workouts.filter(
      (w) =>
        w.week === week.index && w.status !== 'skipped' && w.kind !== 'race',
    );
    const sum = (key) => training.reduce((n, w) => n + w[key], 0);
    assert.ok(
      Math.abs(week.targetKm - sum('estimatedKm')) <= 0.051,
      `${week.start}: weekly distance is stale`,
    );
    assert.ok(
      Math.abs(week.trainingMinutes - sum('minutes')) <= 1e-6,
      `${week.start}: weekly duration is stale`,
    );
    assert.ok(
      Math.abs(
        week.qualityMinutes -
          training.reduce((n, w) => n + qualityWorkMinutes(w), 0),
      ) <= 1e-6,
      `${week.start}: weekly quality dose is stale`,
    );
    assert.equal(
      week.longKm,
      Math.max(
        0,
        ...training.filter((w) => w.kind === 'long').map((w) => w.estimatedKm),
      ),
    );
  }
}

test('manual-only pace instructions give a numeric distance without a benchmark or separate easy pace', () => {
  const step = {
    ...easyWorkout().steps[0],
    seconds: 1800,
    target: { mode: 'pace', low: 330, high: 360 },
  };
  const range = distanceEstimate([step], { easyPace: null });
  assert.equal(range.lowerKm, 5, '30 minutes at 6:00/km is 5 km');
  assert.ok(
    range.upperKm >= 60 / 11 && range.upperKm <= 5.5,
    'The faster 5:30/km edge is about 5.45 km, with outward display rounding',
  );
});

test('mixed distance and manually paced time steps contribute to the same numeric estimate', () => {
  const step = easyWorkout().steps[0];
  const range = distanceEstimate(
    [
      { ...step, metres: 1000, seconds: 900 },
      { ...step, seconds: 1800, target: { mode: 'pace', low: 330, high: 360 } },
    ],
    { easyPace: null },
  );
  assert.equal(range.lowerKm, 6);
  assert.ok(range.upperKm >= 1 + 60 / 11 && range.upperKm <= 6.5);
});

test('an untargeted timed segment without pace evidence cannot become a fabricated known estimate', () => {
  const range = distanceEstimate(easyWorkout().steps, { easyPace: null });
  assert.equal(range.lowerKm, null);
  assert.equal(range.upperKm, null);
});

test('applying pace to a timed 40-minute run retains its time and refreshes distance allocation and stored range', () => {
  const runner = profile('5k', 'time', { workoutTargets: manual });
  const before = easyWorkout();
  const snapshot = structuredClone(before);
  const after = withWorkoutTargets(before, runner);
  assert.deepEqual(before, snapshot, 'The input prescription is not mutated');
  assert.equal(after.minutes, 40);
  assert.deepEqual(
    after.steps.map((s) => s.seconds),
    [2400],
  );
  assert.equal(prescribedDistanceKm(after), null);
  assert.ok(
    after.estimatedKm > 6.6,
    'The old 5 km allocation cannot survive the faster target',
  );
  assertCanonicalDistance(after, runner);
  assert.deepEqual(
    withWorkoutTargets(after, runner),
    after,
    'Reapplying the same target must not keep changing distance or duration',
  );
});

for (const change of [
  { name: 'faster', pace: { low: 330, high: 360 }, minutes: [27.5, 30] },
  { name: 'slower', pace: { low: 540, high: 600 }, minutes: [45, 50] },
])
  test(`a saved 5 km prescription retains its metres with a ${change.name} target and updates predicted duration`, () => {
    const runner = profile('5k', 'distance', {
      workoutTargets: { mode: 'pace', pace: { easy: change.pace } },
    });
    const before = easyWorkout();
    before.steps[0].metres = 5000;
    before.steps[0].planningPaceSecondsPerKm = 480;
    const after = withWorkoutTargets(before, runner);
    assert.equal(prescribedDistanceKm(after), 5);
    assert.equal(after.estimatedKm, 5);
    assert.equal(after.distanceEstimate.lowerKm, 5);
    assert.equal(after.distanceEstimate.upperKm, 5);
    assert.ok(
      after.minutes >= change.minutes[0] &&
        after.minutes <= change.minutes[1] + 1 / 60,
      `The new target requires ${change.minutes[0]}–${change.minutes[1]} minutes, not the old 40-minute allowance`,
    );
    assert.ok(
      Math.abs(
        after.minutes - after.steps.reduce((n, s) => n + s.seconds, 0) / 60,
      ) <=
        1 / 60,
    );
    assertCanonicalDistance(after, runner);
  });

test('distance-ended quality counts the duration implied by distance and pace, not a retained allowance', () => {
  const workout = easyWorkout({
    kind: 'tempo',
    hard: true,
    stimulus: 'threshold',
    minutes: 12,
    steps: [
      {
        label: '1 km threshold',
        kind: 'work',
        intensity: 6,
        metres: 1000,
        seconds: 600,
        effort: 'Controlled · 6 / 10',
        target: { mode: 'pace', low: 300, high: 330 },
      },
      {
        label: 'Recover',
        kind: 'recovery',
        intensity: 2,
        seconds: 120,
        effort: 'Easy',
      },
    ],
  });
  assert.ok(
    qualityWorkMinutes(workout) >= 5 && qualityWorkMinutes(workout) <= 5.5,
    'The kilometre takes 5:00–5:30; it cannot count as ten quality minutes',
  );
  const timed = structuredClone(workout);
  delete timed.steps[0].metres;
  assert.equal(
    qualityWorkMinutes(timed),
    10,
    'A truly timed ten-minute repetition still prescribes ten quality minutes',
  );
  assert.equal(
    qualityWorkMinutes({ ...workout, kind: 'race' }),
    0,
    'Race duration remains separate from training quality dose',
  );
});

test('resolving a distance interval refreshes stored quality dose and retains its distance end condition', () => {
  const runner = profile('10k', 'time', { workoutTargets: manual });
  const before = easyWorkout({
    kind: 'tempo',
    hard: true,
    stimulus: 'threshold',
    minutes: 12,
    qualityMinutes: 10,
    steps: [
      {
        label: '1 km threshold',
        kind: 'work',
        intensity: 6,
        metres: 1000,
        seconds: 600,
        effort: 'Controlled · 6 / 10',
      },
      {
        label: 'Recover',
        kind: 'recovery',
        intensity: 2,
        seconds: 120,
        effort: 'Easy',
      },
    ],
  });
  const after = withWorkoutTargets(before, runner);
  assert.equal(after.steps[0].metres, 1000);
  assert.equal(after.steps[1].seconds, 120);
  assert.ok(
    after.qualityMinutes >= 5 && after.qualityMinutes <= 5.25,
    'The saved work dose must reflect a 1 km rep at the final 5:00–5:15/km target',
  );
  assert.equal(after.qualityMinutes, qualityWorkMinutes(after));
});

for (const goal of ['5k', '10k', 'half', 'marathon']) {
  for (const measure of ['time', 'distance']) {
    test(`${goal} ${measure}: generated allocations, stored ranges and totals agree with executable pace targets`, () => {
      const plan = makePlan(
        profile(goal, measure, { workoutTargets: manual }),
        start,
      );
      assert.deepEqual(validatePlan(plan), []);
      const restored = JSON.parse(JSON.stringify(plan));
      assert.deepEqual(validatePlan(restored), []);
      let fullySpecified = 0;
      for (const workout of restored.workouts.filter((w) => w.kind !== 'race'))
        if (assertCanonicalDistance(workout, restored.profile))
          fullySpecified++;
      assert.ok(
        fullySpecified >= 10,
        'The test must exercise real numeric prescriptions',
      );
      assertWeeklyTotals(restored);
    });
  }
}

test('a faster matching benchmark updates only supported future targets and preserves the schedule and history', () => {
  const plan = makePlan(
    profile('5k', 'time', {
      recentRace: { ...benchmark, representative: true },
    }),
    start,
  );
  const from = addDays(start, 7);
  plan.workouts
    .filter((w) => w.date < from && w.kind !== 'race')
    .forEach(complete);
  const before = structuredClone(plan);
  const next = updateWorkoutTargets(plan, null, from, [], {
    recentRace: {
      distanceKm: 5,
      timeMinutes: 24,
      date: from,
      source: 'time-trial',
      course: 'track',
      representative: true,
    },
  });
  assert.deepEqual(plan, before, 'The source plan remains immutable');
  let supported = 0;
  for (const workout of next.workouts) {
    const old = before.workouts.find((w) => w.id === workout.id);
    assert.equal(workout.date, old.date);
    assert.equal(workout.kind, old.kind);
    if (workout.date < from || workout.status !== 'planned') {
      assert.deepEqual(workout, old);
      continue;
    }
    workout.steps.forEach((step, i) => {
      assert.equal(step.metres, old.steps[i].metres);
      if (step.metres === undefined)
        assert.equal(step.seconds, old.steps[i].seconds);
      if (step.pacing?.method === 'same-distance-benchmark') {
        supported++;
        assert.equal(step.pacing.referenceDistanceKm, 5);
        assert.equal(old.steps[i].target.low, 300);
        assert.equal(step.target.low, 288);
        assert.equal(step.target.high, 288);
      } else
        assert.equal(
          step.target,
          undefined,
          'A faster race result cannot invent generic easy or threshold zones',
        );
    });
    assertCanonicalDistance(workout, next.profile);
  }
  assert.ok(supported > 0, 'Exercise an actual matching current-race target');
  assertWeeklyTotals(next);
  assert.deepEqual(validatePlan(next), []);
});

test('editing timed pace targets preserves protected history and session time while refreshing distance and weekly totals', () => {
  const plan = makePlan(
    profile('5k', 'time', {
      qualitySessions: 0,
      recentQualitySessions: 0,
    }),
    start,
  );
  const completed = plan.workouts.find((w) => w.kind !== 'race');
  complete(completed);
  const from = addDays(start, 1);
  const protectedId = plan.workouts.find(
    (w) => w.date >= from && w.kind === 'easy',
  ).id;
  const before = structuredClone(plan);
  const next = updateWorkoutTargets(plan, manual, from, [protectedId]);
  assert.deepEqual(plan, before);
  let changedDistance = 0;
  for (const workout of next.workouts) {
    const previous = before.workouts.find((w) => w.id === workout.id);
    if (
      workout.status === 'completed' ||
      workout.date < from ||
      workout.id === protectedId
    ) {
      assert.deepEqual(workout, previous);
      continue;
    }
    if (workout.kind === 'race') continue;
    assert.equal(workout.date, previous.date);
    assert.equal(
      workout.minutes,
      previous.minutes,
      'Changing pace must not secretly extend a timed session',
    );
    assert.deepEqual(
      workout.steps.map((s) => s.seconds),
      previous.steps.map((s) => s.seconds),
    );
    assertCanonicalDistance(workout, next.profile);
    if (workout.estimatedKm !== previous.estimatedKm) changedDistance++;
  }
  assert.ok(
    changedDistance > 0,
    'A material target change must alter timed distance estimates',
  );
  assert.ok(
    next.weeks.some((week, i) => week.targetKm !== before.weeks[i].targetKm),
    'The calendar must show the revised distances rather than old allocations',
  );
  assertWeeklyTotals(next);
  assert.deepEqual(validatePlan(next), []);
  assert.deepEqual(validatePlan(JSON.parse(JSON.stringify(next))), []);
});

test('serialized distance targets cannot evade their time allowance by omitting the planning-pace field', () => {
  const p = makePlan(
    profile('10k', 'distance', { workoutTargets: manual }),
    start,
    false,
  );
  const run = p.workouts.find(
    (w) =>
      w.kind === 'easy' &&
      w.steps.every((s) => s.metres !== undefined && s.target?.mode === 'pace'),
  );
  assert.ok(run);
  for (const step of run.steps) {
    delete step.planningPaceSecondsPerKm;
    step.seconds = 1;
  }
  run.minutes = run.steps.length / 60;
  assert.ok(
    validatePlan(JSON.parse(JSON.stringify(p))).some((e) =>
      e.includes('planning time for their prescribed pace'),
    ),
  );
});

test('a saved timed long run keeps its time endpoint even when the profile defaults to distance', () => {
  const p = profile('10k', 'time');
  const plan = makePlan(p, start, false);
  const run = plan.workouts.find((w) => w.kind === 'long');
  assert.ok(run.steps.every((s) => s.metres === undefined));
  const next = withWorkoutTargets(run, {
    ...plan.profile,
    runMeasure: 'distance',
    recentRace: { distanceKm: 5, timeMinutes: 24 },
  });
  assert.deepEqual(
    next.steps.map((s) => s.seconds),
    run.steps.map((s) => s.seconds),
  );
  assert.ok(next.steps.every((s) => s.metres === undefined));
});

function editedTimeFixture(goal, quality = 0) {
  const scenario = trainingContractCases().find(
    (c) => c.id === `${goal}-q${quality}-time`,
  );
  return makePlan(
    {
      ...scenario.profile,
      recentRace: { distanceKm: 5, timeMinutes: 20 },
      workoutTargets: { mode: 'pace', pace: { easy: { low: 360, high: 390 } } },
    },
    scenario.profile.startDate,
    false,
  );
}
const slowerEasy = {
  mode: 'pace',
  pace: { easy: { low: 540, high: 600 } },
};

test('a reviewed timed estimate remains valid when explicitly converted to metre endpoints', () => {
  const before = editedTimeFixture('10k');
  const edited = updateWorkoutTargets(
    before,
    slowerEasy,
    before.profile.startDate,
  );
  const revised = edited.workouts.filter((w) => w.distanceRevision);
  assert.ok(
    revised.some((w) => w.kind === 'long' && !Number.isInteger(w.estimatedKm)),
  );
  const converted = updateRunMeasure(
    edited,
    'distance',
    before.profile.startDate,
  );
  assert.deepEqual(validatePlan(converted), []);
  assert.deepEqual(validatePlan(JSON.parse(JSON.stringify(converted))), []);
  for (const previous of revised.filter((w) => w.kind === 'long')) {
    const current = converted.workouts.find((w) => w.id === previous.id);
    assert.equal(current.distanceRevision, 'pace-edited-time');
    assert.equal(
      prescribedDistanceKm(current),
      Math.round(previous.estimatedKm * 1000) / 1000,
    );
    assertCanonicalDistance(current, converted.profile);
  }
  const restored = prepareRestoredPlan(
    validateRecovery(
      JSON.parse(
        JSON.stringify({
          format: 'stride-recovery-2',
          exportedAt: '2026-09-25T10:00:00Z',
          profile: null,
          plan: converted,
          standaloneRuns: [],
        }),
      ),
    ).plan,
  );
  assert.deepEqual(validatePlan(restored), []);
  assert.deepEqual(
    restored.workouts.map((w) => w.distanceRevision),
    converted.workouts.map((w) => w.distanceRevision),
  );
});

test('slower pace estimates do not invalidate saved marathon timed endpoints or completed history', () => {
  const before = editedTimeFixture('marathon', 1);
  complete(before.workouts[0]);
  const completed = structuredClone(before.workouts[0]);
  const next = updateWorkoutTargets(
    before,
    slowerEasy,
    before.profile.startDate,
  );
  assert.deepEqual(
    next.workouts.find((w) => w.id === completed.id),
    completed,
  );
  assert.deepEqual(validatePlan(next), []);
  for (const old of before.workouts) {
    const current = next.workouts.find((w) => w.id === old.id);
    assert.deepEqual(
      current.steps.map((s) => s.metres),
      old.steps.map((s) => s.metres),
    );
    old.steps.forEach((s, i) => {
      if (s.metres === undefined)
        assert.equal(current.steps[i].seconds, s.seconds);
    });
    if (current.estimatedKm !== old.estimatedKm) {
      assert.equal(current.distanceRevision, 'pace-edited-time');
      assertCanonicalDistance(current, next.profile);
    }
  }
  assertWeeklyTotals(next);
});

test('generic recipe preference changes cannot exempt malformed generated long-run progression', () => {
  const generated = editedTimeFixture('10k');
  const refreshed = refreshWorkoutVariety(
    generated,
    generated.profile.startDate,
  );
  assert.ok(refreshed.workouts.every((w) => w.distanceRevision === undefined));
  const broken = structuredClone(generated);
  const long = broken.workouts.find((w) => w.kind === 'long' && w.week === 1);
  const first = broken.workouts.find((w) => w.kind === 'long' && w.week === 0);
  const km = first.estimatedKm - 0.5;
  const step = long.steps[0];
  step.seconds = Math.floor(km * step.target.high);
  long.estimatedKm = km;
  Object.assign(long, withWorkoutTargets(long, broken.profile));
  long.changed = true;
  long.changeSource = 'preferences';
  refreshWeekTotals(broken);
  const errors = validatePlan(broken);
  assert.ok(errors.some((e) => e.includes('whole-kilometre')));
  assert.ok(errors.some((e) => e.includes('reduces the long run')));
});

test('pace revision provenance cannot hide stale estimates or invalid metadata', () => {
  const before = editedTimeFixture('10k');
  const next = updateWorkoutTargets(
    before,
    slowerEasy,
    before.profile.startDate,
  );
  const revised = next.workouts.find(
    (w) => w.kind === 'long' && w.distanceRevision,
  );
  revised.estimatedKm += 20;
  refreshWeekTotals(next);
  assert.ok(validatePlan(next).some((e) => e.includes('allocated distance')));
  revised.distanceRevision = 'arbitrary-generation-exemption';
  assert.ok(validatePlan(next).some((e) => e.includes('Invalid provenance')));
  assert.throws(
    () =>
      validateRecovery(
        JSON.parse(
          JSON.stringify({
            format: 'stride-recovery-2',
            exportedAt: '2026-09-25T10:00:00Z',
            profile: null,
            plan: next,
            standaloneRuns: [],
          }),
        ),
      ),
    /unknown timed distance revision/,
  );
});

test('direct distance-target reviews cannot acquire a timed-estimate progression exemption', () => {
  const scenario = trainingContractCases().find(
    (c) => c.id === '10k-q0-distance',
  );
  const before = makePlan(
    {
      ...scenario.profile,
      recentRace: { distanceKm: 5, timeMinutes: 20 },
      workoutTargets: { mode: 'pace', pace: { easy: { low: 360, high: 390 } } },
    },
    scenario.profile.startDate,
    false,
  );
  const easy = before.workouts.find((w) => w.kind === 'easy').steps[0].target;
  const next = updateWorkoutTargets(
    before,
    { mode: 'pace', pace: { easy: { low: easy.low, high: easy.high } } },
    before.profile.startDate,
  );
  assert.ok(next.workouts.every((w) => w.distanceRevision === undefined));
  assert.deepEqual(validatePlan(next), []);
  const long = next.workouts.find((w) => w.kind === 'long' && w.week === 1);
  long.steps[0].metres -= 500;
  Object.assign(long, withWorkoutTargets(long, next.profile));
  long.changed = true;
  long.changeSource = 'preferences';
  refreshWeekTotals(next);
  assert.ok(validatePlan(next).some((e) => e.includes('whole-kilometre')));
  assert.ok(validatePlan(next).some((e) => e.includes('reduces the long run')));
});

test('a completely rebuilt forecast does not inherit timed-edit provenance from its previous prescriptions', () => {
  const before = editedTimeFixture('10k');
  const edited = updateWorkoutTargets(
    before,
    slowerEasy,
    before.profile.startDate,
  );
  assert.ok(edited.workouts.some((w) => w.distanceRevision));
  const rebuilt = revisePreferences(edited, {}, before.profile.startDate, true);
  assert.deepEqual(validatePlan(rebuilt), []);
  assert.ok(rebuilt.workouts.every((w) => w.distanceRevision === undefined));
});

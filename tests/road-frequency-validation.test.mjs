import { roadOpeningFailures } from './road-overhaul-helpers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  demoProfile,
  addDays,
  validatePlan,
  validateProfile,
  makePlan,
} from '../lib/engine.ts';
import { ENGINE_VERSION, TRAINING_POLICY } from '../lib/plan/policy.ts';
import { roadQualityFrequencyErrors } from '../lib/plan/generation-rhythm.ts';
import {
  classicQualityCount,
  requestedQualityCount,
} from '../lib/training-structure.ts';

const start = '2026-09-21';
const profile = (goal, patch = {}) => ({
  ...demoProfile(start),
  goal,
  startDate: start,
  raceDate: addDays(start, 83),
  weeklyKm: 55,
  longestKm: 12,
  currentRuns: 5,
  runsPerWeek: 5,
  days: [0, 1, 3, 4, 6],
  availableDays: [0, 1, 3, 4, 6],
  longDay: 6,
  weekdayMinutes: 120,
  longMinutes: 240,
  easyPace: 6,
  qualityMode: 'custom',
  qualitySessions: 1,
  recentQualitySessions: 2,
  recentQualityMinutes: 30,
  method: 'balanced',
  experience: 'established',
  intent: 'improve',
  volume: 'gradual',
  ...patch,
});
const easyStep = (seconds, kind = 'aerobic') => ({
  label: 'Easy running',
  seconds,
  effort: '2–3/10',
  intensity: 2,
  kind,
  movement: 'run',
});
const hardStep = (seconds = 360) => ({
  label: 'Controlled work',
  seconds,
  effort: '6/10',
  intensity: 6,
  kind: 'work',
  movement: 'run',
});

// Independent, executable fixture: the validator must catch malformed input
// even if a future generator accidentally emits it. This is not a generator snapshot.
const fixture = (goal, count) => {
  const p = profile(goal, { qualitySessions: count });
  const weekStart = addDays(start, 7);
  const workouts = p.days.map((day) => {
    const quality = (day === 1 && count > 0) || (day === 3 && count > 1);
    const long = day === 6;
    const date = addDays(weekStart, day);
    return {
      id: `${goal}-${day}`,
      date,
      originalDate: date,
      week: 1,
      title: quality
        ? 'Controlled workout'
        : long
          ? 'Easy long run'
          : 'Easy run',
      kind: quality ? 'tempo' : long ? 'long' : 'easy',
      hard: quality,
      stimulus: quality ? 'threshold' : 'aerobic',
      minutes: quality ? 26 : long ? 72 : 30,
      estimatedKm: long ? 12 : 5,
      purpose: 'Validation fixture',
      reason: 'Independent schedule',
      steps: quality
        ? [easyStep(600, 'warmup'), hardStep(), easyStep(600, 'cooldown')]
        : [easyStep(long ? 4320 : 1800)],
      status: 'planned',
    };
  });
  return {
    id: `${goal}-${count}`,
    engineVersion: ENGINE_VERSION,
    policyVersion: TRAINING_POLICY.version,
    profile: p,
    weeks: [
      {
        index: 1,
        start: weekStart,
        phase: 'Build',
        targetKm: 32,
        longKm: 12,
        focus: 'Training',
      },
    ],
    workouts,
    notes: [],
    createdAt: `${start}T00:00:00Z`,
  };
};
const firstQuality = (plan) => plan.workouts.find((workout) => workout.hard);

for (const runMeasure of ['time', 'distance'])
  for (const [distanceKm, timeMinutes] of [
    [5, 25],
    [10, 52.12328804205607],
  ])
    test(`${runMeasure}: ${distanceKm} km benchmark preserves a funded 30-minute opening workout`, () => {
      const input = profile('5k', {
        startDate: '2026-09-28',
        raceDate: '2027-01-17',
        weeklyKm: 12,
        longestKm: 4,
        currentRuns: 3,
        runsPerWeek: 3,
        days: [1, 3, 6],
        availableDays: [0, 1, 2, 3, 4, 5, 6],
        longDay: 6,
        easyPace: null,
        recentQualitySessions: 1,
        recentQualityMinutes: 20,
        runMeasure,
        recentRace: {
          distanceKm,
          timeMinutes,
          date: '2026-09-20',
          source: 'race',
          course: 'road',
        },
      });
      const plan = makePlan(input, input.startDate, false);
      const opening = plan.workouts.filter((workout) => workout.week === 0);
      const quality = opening.filter((workout) => workout.hard);
      assert.equal(opening.length, 3);
      assert.equal(quality.length, 1);
      assert.ok(quality[0].qualityMinutes >= 6);
      assert.ok(
        quality[0].steps.some((step) => step.kind === 'warmup') &&
          quality[0].steps.some((step) => step.kind === 'cooldown'),
      );
      assert.equal(
        opening.find((workout) => workout.kind === 'long').estimatedKm,
        4,
      );
      assert.ok(
        Math.abs(
          opening.reduce((sum, workout) => sum + workout.estimatedKm, 0) - 12,
        ) < 0.002,
      );
      assert.ok(
        opening.every((workout) => workout.minutes <= input.weekdayMinutes),
      );
      assert.deepEqual(validatePlan(plan), []);
      assert.deepEqual(validatePlan(JSON.parse(JSON.stringify(plan))), []);
    });

const resetDuration = (workout) => {
  workout.minutes =
    workout.steps.reduce((sum, step) => sum + step.seconds, 0) / 60;
};

for (const goal of ['5k', '10k', 'half']) {
  for (const count of [0, 1, 2])
    test(`${goal}: ${count} complete weekday workouts validate after serialization`, () => {
      const plan = JSON.parse(JSON.stringify(fixture(goal, count)));
      assert.deepEqual(validatePlan(plan), []);
    });

  test(`${goal}: deleting a selected run cannot bypass frequency validation`, () => {
    const plan = fixture(goal, 1);
    plan.workouts = plan.workouts.filter((workout) => !workout.hard);
    assert.match(validatePlan(plan).join(' '), /missing|exactly 1 complete/);
  });

  for (const [description, corrupt] of [
    [
      'easy replacement',
      (w) => {
        w.steps = [easyStep(w.minutes * 60)];
        w.kind = 'easy';
        w.hard = false;
        w.stimulus = 'aerobic';
      },
    ],
    [
      'stale hard flag and cached total',
      (w) => {
        w.steps = [easyStep(w.minutes * 60)];
        w.qualityMinutes = 999;
      },
    ],
    [
      'hidden actual work behind an easy label',
      (w) => {
        w.kind = 'easy';
        w.hard = false;
        w.stimulus = 'aerobic';
      },
    ],
    [
      'walking main set',
      (w) => {
        w.steps.find((step) => step.kind === 'work').movement = 'walk';
      },
    ],
    [
      'five minute main set',
      (w) => {
        w.steps.find((step) => step.kind === 'work').seconds = 300;
        resetDuration(w);
      },
    ],
    [
      'strides with a stale workout flag',
      (w) => {
        w.steps = [
          easyStep(600),
          ...Array.from({ length: 6 }, () => hardStep(20)),
          easyStep(600),
        ];
        w.kind = 'easy';
        w.stimulus = 'economy';
        resetDuration(w);
      },
    ],
  ])
    test(`${goal}: ${String(description)} is rejected independently of metadata`, () => {
      const plan = fixture(goal, 1);
      corrupt(firstQuality(plan));
      assert.match(
        validatePlan(plan).join(' '),
        /exactly 1 complete weekday workouts/,
      );
    });

  test(`${goal}: zero workouts rejects hidden threshold work`, () => {
    const plan = fixture(goal, 0),
      run = plan.workouts[0];
    run.steps = [easyStep(1440), hardStep()];
    assert.match(
      validatePlan(plan).join(' '),
      /exactly 0 complete weekday workouts/,
    );
  });

  test(`${goal}: short relaxed strides remain distinct from a quality workout`, () => {
    const plan = fixture(goal, 0),
      run = plan.workouts[0];
    run.steps = [
      easyStep(1680),
      ...Array.from({ length: 6 }, () => hardStep(20)),
    ];
    run.stimulus = 'economy';
    assert.deepEqual(validatePlan(plan), []);
  });

  test(`${goal}: the long run cannot be relabelled to evade the weekly contract`, () => {
    const plan = fixture(goal, 1);
    plan.workouts.find((w) => w.kind === 'long').kind = 'easy';
    assert.match(validatePlan(plan).join(' '), /one separate easy long run/);
  });

  test(`${goal}: an easy long run cannot hide an extra hard session`, () => {
    for (const markHard of [false, true]) {
      const plan = fixture(goal, 1);
      const long = plan.workouts.find((run) => run.kind === 'long');
      long.hard = markHard;
      long.steps = [easyStep(3960), hardStep(360)];
      assert.match(
        roadQualityFrequencyErrors(plan).join(' '),
        /separate easy long run/,
      );
    }
  });

  test(`${goal}: padding a small main set into a long session is rejected`, () => {
    const plan = fixture(goal, 1),
      run = firstQuality(plan);
    run.steps.splice(1, 0, easyStep(3600));
    resetDuration(run);
    assert.match(validatePlan(plan).join(' '), /too much easy padding/);
  });

  test(`${goal}: explicit positive choices with two running days reject rather than reset`, () => {
    for (const qualitySessions of [1, 2])
      assert.throws(
        () =>
          validateProfile(
            profile(goal, {
              days: [2, 6],
              availableDays: [2, 6],
              runsPerWeek: 2,
              qualitySessions,
            }),
            start,
          ),
        /Two running days cannot fit/,
      );
  });

  test(`${goal}: automatic decisions respect experience and familiar quality`, () => {
    const developing = profile(goal, {
      experience: 'new',
      qualityMode: 'automatic',
    });
    assert.equal(classicQualityCount(developing), 0);
    assert.equal(requestedQualityCount(developing), 0);
    assert.equal(
      requestedQualityCount({
        ...developing,
        qualityMode: 'custom',
        qualitySessions: 1,
      }),
      1,
    );
    assert.equal(
      classicQualityCount(
        profile(goal, { intent: 'finish', recentQualitySessions: 0 }),
      ),
      0,
    );
    assert.equal(
      classicQualityCount(
        profile(goal, { intent: 'finish', recentQualitySessions: 1 }),
      ),
      1,
    );
  });

  test(`${goal}: a new but already running profile can enter its numerical baseline`, () => {
    const p = validateProfile(
      profile(goal, {
        experience: 'new',
        qualityMode: 'automatic',
        qualitySessions: 2,
      }),
      start,
    );
    assert.equal(p.qualitySessions, 0);
  });
}

test('road frequency validation leaves marathon/custom/ultra contracts unchanged', () => {
  for (const goal of ['marathon', 'custom', 'ultra']) {
    const plan = fixture('5k', 2);
    plan.profile.goal = goal;
    plan.workouts = [];
    assert.deepEqual(roadQualityFrequencyErrors(plan), []);
  }
});

test('ordinary road long runs cannot jump by more than 2 km between build weeks', () => {
  const plan = fixture('10k', 0);
  plan.weeks.push({
    ...plan.weeks[0],
    index: 2,
    start: addDays(plan.weeks[0].start, 7),
  });
  plan.workouts.push(
    ...plan.workouts.map((run) => {
      const next = {
        ...structuredClone(run),
        id: `${run.id}-next`,
        week: 2,
        date: addDays(run.date, 7),
      };
      if (next.kind === 'long') {
        next.estimatedKm = 15;
        next.minutes = 90;
        next.steps = [easyStep(5400)];
      }
      return next;
    }),
  );
  assert.match(
    validatePlan(plan).join(' '),
    /increases the long run by more than 2 km/,
  );
});

test('a continuous-running half beginner keeps the 18 km / 6 km baseline and receives an exposure review', () => {
  const p = profile('half', {
    experience: 'new',
    weeklyKm: 18,
    longestKm: 6,
    currentRuns: 3,
    runsPerWeek: 3,
    days: [1, 3, 6],
    availableDays: [1, 3, 6],
    qualityMode: 'automatic',
    recentQualitySessions: 0,
    intent: 'finish',
  });
  const plan = makePlan(p, start, false);
  const first = plan.workouts.filter(
    (run) => run.week === 0 && run.kind !== 'race',
  );
  assert.deepEqual(roadOpeningFailures(plan, p), []);
  assert.equal(plan.profile.weeklyKm, 18);
  assert.equal(first.find((run) => run.kind === 'long').estimatedKm, 6);
  assert.ok(
    plan.workouts
      .filter((run) => run.kind !== 'race')
      .every((run) => !run.hard),
  );
  assert.equal(plan.feasibility.status, 'review-required');
  assert.deepEqual(validatePlan(JSON.parse(JSON.stringify(plan))), []);
});

test('zero-history runners still need a base before longer race blocks', () => {
  for (const goal of ['10k', 'half', 'marathon'])
    assert.throws(
      () =>
        validateProfile(
          profile(goal, {
            experience: 'new',
            weeklyKm: 0,
            longestKm: 0,
            currentRuns: 0,
            days: [1, 3, 6],
            availableDays: [1, 3, 6],
            runsPerWeek: 3,
            qualityMode: 'automatic',
          }),
          start,
        ),
      /recent baseline|Build a base/,
    );
});

test('recorded history, recovery weeks and deliberate edits keep their meaning', () => {
  for (const change of [
    (p) => (p.weeks[0].phase = 'Recovery'),
    (p) => (p.workouts[0].status = 'completed'),
    (p) => {
      p.workouts[0].changed = true;
      p.workouts[0].changeSource = 'manual';
    },
  ]) {
    const plan = fixture('5k', 1);
    firstQuality(plan).steps = [easyStep(1560)];
    change(plan);
    assert.deepEqual(roadQualityFrequencyErrors(plan), []);
  }
});

test('an actual archived or separately recorded run explains only its own interrupted week', () => {
  for (const source of ['archived', 'extra', 'pending-history-merge']) {
    const plan = fixture('10k', 1);
    const missing = plan.workouts.shift();
    const recorded = {
      ...structuredClone(missing),
      id: 'recorded-run',
      week: -1,
      date: addDays(missing.date, -21),
      status: 'completed',
      feedback: {
        actualDate: missing.date,
        actualMinutes: 30,
        effort: 3,
        feeling: 'good',
        recordedAt: `${missing.date}T18:00:00Z`,
      },
    };
    let context = [];
    if (source === 'archived') plan.workouts.push(recorded);
    else if (source === 'pending-history-merge') context = [recorded];
    else
      plan.extraRuns = [
        {
          id: 'recorded-extra',
          date: missing.date,
          minutes: 30,
          effort: 3,
          recordedAt: recorded.feedback.recordedAt,
        },
      ];
    const before = structuredClone([plan, context]);
    assert.deepEqual(roadQualityFrequencyErrors(plan, context), [], source);
    assert.deepEqual(
      [plan, context],
      before,
      'validation cannot rewrite recorded facts',
    );

    const later = fixture('10k', 1);
    later.weeks[0].index = 2;
    later.weeks[0].start = addDays(later.weeks[0].start, 7);
    for (const run of later.workouts) {
      run.week = 2;
      run.id += '-later';
      run.date = addDays(run.date, 7);
    }
    later.workouts.shift();
    plan.weeks.push(...later.weeks);
    plan.workouts.push(...later.workouts);
    assert.match(
      roadQualityFrequencyErrors(plan, context).join(' '),
      /Week 3 must retain all/,
    );
  }
});

test('forecast, malformed, and unrelated records cannot excuse a missing road session', () => {
  for (const change of [
    (run) => {
      run.status = 'planned';
    },
    (run) => {
      delete run.feedback;
    },
    (run) => {
      run.feedback.actualMinutes = NaN;
    },
    (run) => {
      run.feedback.actualMinutes = 0;
    },
    (run) => {
      run.feedback.actualDate = addDays(run.feedback.actualDate, -14);
    },
  ]) {
    const plan = fixture('5k', 1);
    const missing = plan.workouts.shift();
    const recorded = {
      ...missing,
      date: addDays(missing.date, -21),
      status: 'completed',
      feedback: { actualDate: missing.date, actualMinutes: 30, effort: 3 },
    };
    change(recorded);
    assert.match(
      roadQualityFrequencyErrors(plan, [recorded]).join(' '),
      /must retain all/,
      JSON.stringify(recorded),
    );
  }
});

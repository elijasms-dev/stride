import test from 'node:test';
import assert from 'node:assert/strict';
import {
  demoProfile,
  makePlan,
  addDays,
  refreshWorkoutVariety,
  revisePreferences,
  validatePlan,
} from '../lib/engine.ts';
import {
  selectTemplate,
  scaleTemplate,
  resizeWorkout,
  WORKOUT_LIBRARY,
} from '../lib/workout-library.ts';
import {
  roadAerobicAllowanceMinutes,
  roadQualitySessionCap,
} from '../lib/road-training-policy.ts';
import { ROAD_WORKOUTS } from '../lib/road-workouts.ts';

const profile = (goal, patch = {}) => ({
  ...demoProfile('2026-09-14'),
  goal,
  weeklyKm: 45,
  longestKm: 14,
  currentRuns: 5,
  runsPerWeek: 5,
  experience: 'established',
  intent: 'improve',
  qualityMode: 'custom',
  qualitySessions: 2,
  recentQualitySessions: 1,
  recentQualityMinutes: 18,
  difficulty: 'balanced',
  method: 'balanced',
  workoutFormat: 'time',
  workoutVariety: 'varied',
  ...patch,
});
const work = (decision, dose, week) => ({
  kind: decision.template.kind,
  hard: true,
  status: 'planned',
  templateId: decision.template.id,
  stimulus: decision.template.stimulus,
  week,
  steps: dose.steps,
  minutes: dose.minutes,
  qualityMinutes: dose.qualityMinutes,
});

const mainShape = (w) =>
  JSON.stringify(
    w.steps
      .filter((s) => s.kind === 'work' || s.kind === 'recovery')
      .map((s) => [s.kind, s.metres ?? s.seconds, s.effortRole, s.intensity]),
  );

const reviewedProfile = (goal, count) => {
  const start = '2026-09-28';
  const values = {
    '5k': { base: [30, 8], advanced: [55, 13], weeks: 12, race: [5, 25] },
    '10k': { base: [36, 11], advanced: [60, 16], weeks: 12, race: [10, 50] },
    half: {
      base: [45, 16],
      advanced: [65, 18],
      weeks: 16,
      race: [21.0975, 110],
    },
  }[goal];
  const [weeklyKm, longestKm] = count === 2 ? values.advanced : values.base;
  const days = count === 2 ? [0, 1, 2, 3, 4, 6] : [0, 2, 4, 6];
  return profile(goal, {
    startDate: start,
    raceDate: addDays(start, values.weeks * 7 - 1),
    weeklyKm,
    longestKm,
    currentRuns: days.length,
    runsPerWeek: days.length,
    days,
    availableDays: [0, 1, 2, 3, 4, 5, 6],
    longDay: 6,
    weekdayMinutes: 120,
    longMinutes: 300,
    qualitySessions: count,
    recentQualitySessions: count,
    recentQualityMinutes: count * 20,
    runMeasure: 'distance',
    workoutFormat: 'automatic',
    easyPace: null,
    recentRace: {
      distanceKm: values.race[0],
      timeMinutes: values.race[1],
      date: '2026-09-20',
      source: 'race',
      course: 'road',
    },
  });
};

for (const goal of ['5k', '10k', 'half'])
  for (const count of [1, 2])
    test(`${goal} q${count}: reviewed plans vary actual work and retain complete bounded prescriptions`, () => {
      const input = reviewedProfile(goal, count);
      const original = structuredClone(input);
      const plan = makePlan(input, input.startDate, false);
      assert.deepEqual(input, original);
      assert.deepEqual(validatePlan(plan), []);
      assert.deepEqual(validatePlan(JSON.parse(JSON.stringify(plan))), []);
      const quality = plan.workouts.filter(
        (w) => w.hard && !['long', 'race'].includes(w.kind),
      );
      // The reported 5K case previously repeated 7 x 2 minutes at all four
      // opening exposures. Titles and changing numeric pace cannot pass this.
      assert.ok(new Set(quality.slice(0, 4).map(mainShape)).size >= 2);
      assert.ok(new Set(quality.map(mainShape)).size >= 5);
      let last,
        consecutive = 0;
      for (const w of quality) {
        const phase = plan.weeks[w.week].phase;
        if (['Taper', 'Race week'].includes(phase)) continue;
        const shape = mainShape(w);
        consecutive = shape === last ? consecutive + 1 : 1;
        assert.ok(consecutive <= 2, `${w.date}: repeated executable main set`);
        last = shape;
        assert.ok(w.qualityMinutes >= 6);
        assert.ok(w.qualityMinutes <= w.targetWorkMinutes + 1 / 60);
        assert.ok(w.minutes <= input.weekdayMinutes);
        assert.ok(w.steps.some((s) => s.kind === 'warmup' && s.seconds >= 600));
        assert.ok(
          w.steps.some((s) => s.kind === 'cooldown' && s.seconds >= 300),
        );
        const workSteps = w.steps.filter((s) => s.kind === 'work');
        assert.equal(
          w.steps.filter((s) => s.kind === 'recovery').length,
          workSteps.length - 1,
        );
        assert.ok(
          workSteps.every(
            (s) =>
              !s.target &&
              s.pacing?.method === 'effort' &&
              s.pacing.guidance === s.effort,
          ),
          'Unconfirmed reference results retain each authored effort instruction',
        );
      }
    });

test('complete road pyramids preserve every authored bout or do not fit', () => {
  const pyramids = ROAD_WORKOUTS.filter((t) => t.completeSet);
  assert.ok(pyramids.length >= 8);
  for (const template of pyramids) {
    const p = profile(template.goals[0]);
    const total =
      template.workSeconds.reduce((sum, seconds) => sum + seconds, 0) / 60;
    const dose = scaleTemplate(template, 90, false, 'Build', total, total, p);
    assert.ok(dose, template.id);
    assert.deepEqual(
      dose.steps.filter((s) => s.kind === 'work').map((s) => s.seconds),
      template.workSeconds,
    );
    assert.equal(dose.qualityMinutes, total);
    assert.equal(
      scaleTemplate(template, 90, false, 'Build', total - 1, total - 1, p),
      null,
    );
  }
});

test('familiar road preference keeps the opening shape; varied preference changes actual bouts', () => {
  const p = profile('5k', { qualitySessions: 1, recentQualityMinutes: 20 });
  const opening = (preference) => {
    const previous = [];
    for (let week = 0; week < 2; week++) {
      const selected = selectTemplate(
        { ...p, workoutVariety: preference },
        'Foundation',
        {
          previous,
          slot: 0,
          qualitySlots: 1,
          availableMinutes: 45,
          excludeTemplateIds: new Set(previous.map((w) => w.templateId)),
        },
      );
      const dose = scaleTemplate(
        selected.template,
        45,
        false,
        'Foundation',
        20,
        selected.targetWorkMinutes,
        p,
      );
      assert.ok(dose);
      previous.push(work(selected, dose, week));
    }
    return previous.map(mainShape);
  };
  const familiar = opening('familiar');
  assert.equal(familiar[0], familiar[1]);
  const varied = opening('varied');
  assert.notEqual(varied[0], varied[1]);
});

test('road variety refresh preserves completed, skipped and past prescriptions', () => {
  const input = reviewedProfile('10k', 2);
  const plan = makePlan(input, input.startDate, false);
  const quality = plan.workouts.filter((w) => w.hard && w.kind !== 'race');
  quality[0].status = 'completed';
  quality[1].status = 'skipped';
  const asOf = addDays(input.startDate, 14);
  const protectedRuns = plan.workouts.filter(
    (w) => w.date < asOf || w.status !== 'planned',
  );
  const next = refreshWorkoutVariety(plan, asOf);
  assert.deepEqual(
    next.workouts.filter((w) =>
      protectedRuns.some((saved) => saved.id === w.id),
    ),
    protectedRuns,
  );
});

for (const goal of ['5k', '10k', 'half']) {
  test(`${goal}: explicit finish and developing choices contain real controlled work`, () => {
    for (const patch of [
      { intent: 'finish' },
      {
        experience: 'new',
        weeklyKm: 18,
        recentQualitySessions: 0,
        recentQualityMinutes: undefined,
      },
      { difficulty: 'gentle' },
    ]) {
      const p = profile(goal, patch);
      for (const slot of [0, 1]) {
        const selected = selectTemplate(p, 'Build', {
          previous: [],
          slot,
          qualitySlots: 2,
          availableMinutes: 120,
        });
        assert.notEqual(selected.template.stimulus, 'economy');
        const dose = scaleTemplate(
          selected.template,
          120,
          p.difficulty === 'gentle',
          'Build',
          20,
          selected.targetWorkMinutes,
          p,
        );
        assert.ok(dose && dose.qualityMinutes >= 6);
        assert.ok(
          dose.steps
            .filter((s) => s.kind === 'work')
            .every((s) => s.intensity <= 5),
        );
        assert.ok(dose.minutes <= roadQualitySessionCap(p));
        assert.ok(
          dose.steps
            .filter((s) => s.kind === 'aerobic')
            .reduce((n, s) => n + s.seconds / 60, 0) <=
            roadAerobicAllowanceMinutes(p),
        );
      }
    }
  });
  test(`${goal}: planned exposures progress complementary roles without capacity-driven hard work`, () => {
    const p = profile(goal);
    const previous = [];
    for (let week = 0; week < 12; week++) {
      for (const slot of [0, 1]) {
        const context = {
          previous,
          slot,
          qualitySlots: 2,
          week,
          availableMinutes: 120,
        };
        const selected = selectTemplate(
          p,
          week < 6 ? 'Build' : 'Race preparation',
          context,
        );
        const smaller = selectTemplate(
          p,
          week < 6 ? 'Build' : 'Race preparation',
          { ...context, availableMinutes: 60 },
        );
        assert.equal(selected.targetWorkMinutes, smaller.targetWorkMinutes);
        const dose = scaleTemplate(
          selected.template,
          120,
          false,
          'Build',
          40,
          selected.targetWorkMinutes,
          p,
        );
        assert.ok(dose && dose.qualityMinutes >= 6);
        assert.ok(dose.qualityMinutes <= selected.targetWorkMinutes + 1 / 60);
        assert.ok(dose.minutes <= roadQualitySessionCap(p));
        const efforts = dose.steps.filter((s) => s.kind === 'work');
        assert.equal(
          dose.steps.filter((s) => s.kind === 'recovery').length,
          efforts.length - 1,
        );
        previous.push(work(selected, dose, week));
      }
    }
    assert.ok(previous.some((w) => w.stimulus === 'threshold'));
    assert.ok(previous.some((w) => w.stimulus === 'race-rhythm'));
    assert.ok(
      new Set(previous.map((w) => `${w.templateId}:${w.qualityMinutes}`))
        .size >= 6,
    );
    const before = previous.at(-1);
    const taper = selectTemplate(p, 'Race week', {
      previous,
      slot: 0,
      availableMinutes: 30,
    });
    assert.ok(taper.targetWorkMinutes < before.qualityMinutes);
  });
}

test('new distance recipes use the relevant work pace instead of easy planning pace', () => {
  const p = profile('10k', {
    workoutFormat: 'distance',
    workoutTargets: {
      mode: 'pace',
      raceScope: '10k:',
      pace: { easy: { low: 360, high: 420 }, race: { low: 270, high: 300 } },
    },
  });
  const t = WORKOUT_LIBRARY.find((t) => t.id === 'road-10k-1000m');
  const dose = scaleTemplate(t, 70, false, 'Build', 20, 20, p);
  assert.ok(dose);
  assert.ok(
    dose.steps
      .filter((s) => s.kind === 'work')
      .every((s) => s.metres === 1000 && s.seconds === 300),
  );
});

test('custom normalized recipe selection does not enter the named road policy', () => {
  const selected = selectTemplate(profile('half'), 'Build', {
    originalGoal: 'custom',
    previous: [],
    slot: 0,
    availableMinutes: 60,
  });
  assert.ok(!selected.template.id.startsWith('road-'));
});

test('a new road template with ten minutes of work cannot absorb two hours of spare capacity', () => {
  const p = profile('5k');
  const template = WORKOUT_LIBRARY.find((t) => t.id === 'road-5k-120s');
  const dose = scaleTemplate(template, 120, false, 'Build', 10, 10, p);
  assert.ok(dose);
  assert.equal(dose.qualityMinutes, 10);
  assert.ok(dose.minutes <= 31 + roadAerobicAllowanceMinutes(p));
});

test('resizing a finish-oriented road workout preserves its saved controlled intensity', () => {
  const p = profile('10k', { intent: 'finish', difficulty: 'balanced' });
  const decision = selectTemplate(p, 'Build', {
    previous: [],
    slot: 1,
    qualitySlots: 2,
    availableMinutes: 60,
  });
  const dose = scaleTemplate(
    decision.template,
    60,
    false,
    'Build',
    15,
    decision.targetWorkMinutes,
    p,
  );
  const saved = { ...work(decision, dose, 2), estimatedKm: dose.minutes / 6 };
  for (const limit of [dose.minutes, dose.minutes - 1]) {
    const next = resizeWorkout(saved, p, 'Build', limit);
    assert.ok(
      next.steps
        .filter((s) => s.kind === 'work')
        .every((s) => s.intensity <= 5),
    );
    assert.deepEqual(
      next.steps.filter((s) => s.kind === 'work').map((s) => s.effort),
      saved.steps.filter((s) => s.kind === 'work').map((s) => s.effort),
    );
    assert.equal(next.qualityMinutes, saved.qualityMinutes);
  }
});

for (const goal of ['5k', '10k', 'half']) {
  test(`${goal}: controlled effort survives generation, taper, refresh, preferences and resizing`, () => {
    const start = '2026-09-07';
    for (const patch of [
      {
        weeklyKm: 21,
        longestKm: 8,
        currentRuns: 3,
        runsPerWeek: 3,
        days: [1, 3, 6],
        availableDays: [1, 3, 6],
      },
      { intent: 'finish' },
      { difficulty: 'gentle' },
    ]) {
      const p = profile(goal, {
        startDate: start,
        raceDate: addDays(start, goal === 'half' ? 83 : 27),
        days: [0, 1, 3, 4, 6],
        availableDays: [0, 1, 3, 4, 6],
        longDay: 6,
        weekdayMinutes: 120,
        longMinutes: 180,
        qualitySessions: 1,
        recentQualitySessions: 1,
        recentQualityMinutes: 20,
        ...patch,
      });
      const plan = makePlan(p, start, false);
      const variants = [
        plan,
        refreshWorkoutVariety(plan, start),
        revisePreferences(plan, { weekdayMinutes: 110 }, start),
      ];
      for (const variant of variants) {
        const workouts = variant.workouts.filter(
          (w) => w.hard && w.kind !== 'race' && w.kind !== 'long',
        );
        assert.ok(workouts.length);
        for (const w of workouts) {
          assert.ok(
            w.steps
              .filter((s) => s.kind === 'work')
              .every((s) => s.intensity <= 5),
            `${w.date} ${w.templateId}`,
          );
          const shorter = resizeWorkout(
            w,
            variant.profile,
            variant.weeks[w.week].phase,
            w.minutes - 1,
          );
          assert.ok(
            shorter.steps
              .filter((s) => s.kind === 'work')
              .every((s) => s.intensity <= 5),
          );
        }
      }
    }
  });
}

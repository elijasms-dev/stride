import test from 'node:test';
import assert from 'node:assert/strict';
import { Decoder, Stream } from '@garmin/fitsdk';
import {
  demoProfile,
  makePlan,
  validatePlan,
  revisePreferences,
  addDays,
} from '../lib/engine.ts';
import {
  selectTemplate,
  scaleTemplate,
  WORKOUT_LIBRARY,
} from '../lib/workout-library.ts';
import { withWorkoutTargets } from '../lib/workout-targets.ts';
import { withSpecificWorkoutName } from '../lib/workout-names.ts';
import { assertMarathonWeek } from './marathon-contract.mjs';
import { qualityWorkMinutes } from '../lib/prescription.ts';
import { encodeWorkout } from '../lib/fit.ts';
import { intervalsWorkoutText } from '../lib/intervals-workout.ts';

const start = '2026-09-07';
const input = (patch = {}) => ({
  ...demoProfile(start),
  startDate: start,
  goal: 'marathon',
  raceDate: addDays(start, 125),
  weeklyKm: 60,
  longestKm: 26,
  currentRuns: 5,
  runsPerWeek: 5,
  availableDays: [0, 1, 2, 3, 4, 5, 6],
  longDay: 5,
  qualityMode: 'automatic',
  qualitySessions: 2,
  recentQualitySessions: 2,
  recentQualityMinutes: null,
  weekdayMinutes: 120,
  longMinutes: 300,
  runMeasure: 'distance',
  volume: 'maintain',
  difficulty: 'balanced',
  workoutVariety: 'varied',
  ...patch,
});
const build = (patch = {}) => makePlan(input(patch), start, false);
const main = (w) => w.hard && w.kind !== 'race';

function assertFundedBaseline(plan, weekIndex, expectedKm) {
  const runs = plan.workouts.filter(
    (w) => w.week === weekIndex && w.kind !== 'race',
  );
  assert.equal(
    runs.reduce((sum, w) => sum + w.minutes, 0),
    expectedKm * (plan.profile.easyPace ?? 6),
  );
  const actualKm = runs.reduce((sum, w) => sum + w.estimatedKm, 0);
  assert.equal(plan.weeks[weekIndex].targetKm, Math.round(actualKm * 10) / 10);
  assert.ok(actualKm <= expectedKm + 0.001);
  assert.ok(
    expectedKm - actualKm < runs.length * 0.1,
    'rounding distance prescriptions must not remove more than 100 m per run',
  );
}

function recipeWorkout(plan, family, cap = 30) {
  const template = WORKOUT_LIBRARY.find(
    (t) => t.id === `marathon-book-${family}`,
  );
  assert.ok(template, family);
  const dose = scaleTemplate(
    template,
    75,
    false,
    'Build',
    cap,
    cap,
    plan.profile,
  );
  assert.ok(dose, `${family} must fit its work allowance`);
  const original = plan.workouts.find((w) => w.stimulus === 'threshold');
  return withWorkoutTargets(
    withSpecificWorkoutName({
      ...original,
      ...dose,
      id: `saved-${family}`,
      title: template.title,
      kind: template.kind,
      stimulus: template.stimulus,
      templateId: template.id,
      estimatedKm: dose.minutes / (plan.profile.easyPace ?? 6),
    }),
    plan.profile,
  );
}

test('existing marathon routine starts with a substantial tempo and one long run', () => {
  const p = build();
  const week = p.workouts.filter((w) => w.week === 0);
  assertFundedBaseline(p, 0, 60);
  assert.equal(p.weeks[0].longKm, 26);
  assert.equal(week.length, 5);
  const quality = week.filter((w) => main(w) || w.kind === 'long');
  assert.equal(quality.length, 2);
  assert.equal(quality[0].stimulus, 'threshold');
  assert.ok(qualityWorkMinutes(quality[0]) >= 20);
  assert.equal(quality[1].kind, 'long');
  assert.equal(quality[1].estimatedKm, 26);
  assertMarathonWeek(p, p.weeks[0]);
  assert.equal(
    p.profile.recentQualityMinutes ?? null,
    null,
    'a provisional dose must not manufacture training history',
  );
  assert.deepEqual(validatePlan(p), []);
});

test('partial opening week does not permanently replace the recent long-run baseline', () => {
  const p = build({ startDate: '2026-09-08' });
  assert.ok(p.weeks[0].targetKm < 60);
  assertFundedBaseline(p, 1, 60);
  assert.equal(p.weeks[1].longKm, 26);
  assert.ok(p.workouts.every((w) => w.date >= p.profile.startDate));
  assert.deepEqual(validatePlan(p), []);
});

test('variety changes tempo main sets while preserving one weekday workout and one long run', () => {
  const p = build();
  const sessions = p.workouts.filter(main);
  for (const text of ['min tempo', 'Cut-down tempo', 'on / off'])
    assert.ok(
      sessions.some((w) => w.title.includes(text)),
      text,
    );
  const explicitIntervals = [
    'pyramid-timed',
    'long-into-short-timed',
    'split-repeats-timed',
  ].map((family) => recipeWorkout(p, family));
  assert.match(explicitIntervals[0].title, /Pyramid intervals/);
  assert.match(explicitIntervals[1].title, /into/);
  assert.ok(
    explicitIntervals[2].steps.some(
      (s) => s.label === 'Extra recovery between sets',
    ),
  );
  for (const k of p.weeks) {
    const runs = p.workouts.filter(
      (w) => w.week === k.index && w.kind !== 'race',
    );
    const hard = runs.filter(main);
    assertMarathonWeek(p, k);
    assert.ok(hard.length <= 2);
    if (hard.length === 2) assert.notEqual(hard[0].stimulus, hard[1].stimulus);
    assert.ok(
      runs.reduce((n, w) => n + qualityWorkMinutes(w), 0) <=
        runs.reduce((n, w) => n + w.minutes, 0) * 0.22 + 0.1,
    );
    if (k.phase === 'Recovery') assert.equal(hard.length, 0);
  }
});

test('explicit small recent work dose takes precedence over the established-runner default', () => {
  const p = input({ recentQualityMinutes: 12 });
  const decision = selectTemplate(p, 'Foundation', {
    previous: [],
    availableMinutes: 60,
    slot: 0,
  });
  assert.equal(decision.targetWorkMinutes, 6);
  for (const patch of [
    { recentQualitySessions: 0 },
    { experience: 'returning' },
    { weeklyKm: 30 },
    { difficulty: 'gentle' },
  ]) {
    const profile = input(patch);
    const d = selectTemplate(profile, 'Foundation', {
      previous: [],
      availableMinutes: 60,
      slot: 0,
    });
    assert.ok(d.targetWorkMinutes < 20);
  }
});

test('saved time limits remain real constraints and lifting them restores the entered distances', () => {
  const limits = {
    weekdayMinutes: 45,
    longMinutes: 180,
  };
  const settings = { raceDate: '2026-10-18' };
  assert.throws(
    () => build({ ...settings, ...limits }),
    /starting weekly distance/,
  );
  const limited = revisePreferences(build(settings), limits, start);
  assert.ok(limited.weeks[0].targetKm < 60);
  assert.ok(
    limited.workouts
      .filter((w) => w.kind !== 'long' && w.kind !== 'race')
      .every((w) => w.minutes <= 45),
  );
  const revised = revisePreferences(
    limited,
    { weekdayMinutes: 120, longMinutes: 300 },
    start,
  );
  assertFundedBaseline(revised, 0, 60);
  assert.equal(revised.weeks[0].longKm, 26);
  assert.deepEqual(validatePlan(revised), []);
});

for (const mode of ['effort', 'pace', 'heart-rate'])
  test(`${mode} targets survive structured main sets and watch exports`, () => {
    const workoutTargets =
      mode === 'pace'
        ? {
            mode,
            raceScope: 'marathon:',
            pace: {
              easy: { low: 330, high: 390 },
              tempo: { low: 260, high: 280 },
              interval: { low: 230, high: 250 },
              race: { low: 285, high: 305 },
            },
          }
        : mode === 'heart-rate'
          ? {
              mode,
              raceScope: 'marathon:',
              heartRate: {
                easy: { low: 120, high: 140 },
                tempo: { low: 150, high: 165 },
                interval: { low: 165, high: 180 },
                race: { low: 145, high: 160 },
              },
            }
          : { mode };
    // Keep the maintained weekly budget consistent with the supplied easy pace.
    const p = build({ workoutTargets, easyPace: mode === 'pace' ? 6.5 : 6 });
    const unit = mode === 'pace' ? 'metres' : 'timed';
    const workouts = [
      ...p.workouts.filter(main),
      recipeWorkout(p, `six-hundred-${unit}`, 16),
      recipeWorkout(p, `marathon-blocks-${unit}`, 30),
    ];
    if (mode !== 'effort') {
      const ranges =
        mode === 'pace' ? workoutTargets.pace : workoutTargets.heartRate;
      for (const [stimulus, band] of [
        ['threshold', 'tempo'],
        ['aerobic-power', 'interval'],
        ['race-rhythm', 'race'],
      ]) {
        const run = workouts.find(
          (w) => w.stimulus === stimulus && w.kind !== 'long',
        );
        assert.ok(run, stimulus);
        const step = run.steps.find(
          (s) => s.kind === 'work' && s.seconds >= 120,
        );
        assert.deepEqual(step.target, { mode, ...ranges[band] });
        const decoded = new Decoder(
          Stream.fromByteArray(encodeWorkout(run, p.profile)),
        ).read();
        assert.ok(
          decoded.messages.workoutStepMesgs.some(
            (s) => s.targetType === (mode === 'pace' ? 'speed' : 'heartRate'),
          ),
        );
      }
    }
    for (const w of workouts) {
      assert.equal(
        Math.round(w.steps.reduce((n, s) => n + s.seconds, 0)),
        Math.round(w.minutes * 60),
      );
      const { errors, messages } = new Decoder(
        Stream.fromByteArray(encodeWorkout(w, p.profile)),
      ).read();
      assert.deepEqual(errors, []);
      assert.ok(messages.workoutStepMesgs.length >= 3);
      if (mode === 'heart-rate') {
        assert.throws(
          () => intervalsWorkoutText(w, p.profile),
          /Direct BPM targets/,
        );
        continue;
      }
      const text = intervalsWorkoutText(w, p.profile);
      assert.ok(text.includes('Warm up'));
      for (const s of w.steps.filter((s) => s.kind === 'work')) {
        if (s.metres !== undefined) assert.ok(text.includes(`${s.metres}mtr`));
      }
    }
    if (mode === 'pace')
      assert.ok(workouts.some((w) => w.steps.some((s) => s.metres === 600)));
    else
      assert.ok(
        workouts
          .filter((w) => w.kind !== 'long')
          .every((w) =>
            w.steps
              .filter((s) => s.kind === 'work')
              .every((s) => s.metres === undefined),
          ),
      );
  });

test('taper retains a reduced familiar tempo after the build progression', () => {
  const p = build({
    weeklyKm: 70,
    longestKm: 30,
    raceDate: '2027-01-17',
    volume: 'gradual',
  });
  const taper = p.workouts.filter((w) => p.weeks[w.week].phase === 'Taper');
  assert.ok(taper.some(main));
  assert.ok(taper.filter(main).every((w) => qualityWorkMinutes(w) <= 12));
  assert.deepEqual(validatePlan(p), []);
});

for (const mode of ['effort', 'heart-rate'])
  test(`a saved pace-authored interval can be reduced for taper after switching to ${mode}`, () => {
    const p = build({
      workoutTargets: {
        mode: 'pace',
        pace: {
          easy: { low: 330, high: 360 },
          tempo: { low: 260, high: 280 },
          interval: { low: 230, high: 250 },
        },
      },
    });
    const saved = recipeWorkout(p, 'six-hundred-metres', 16);
    const profile = {
      ...p.profile,
      workoutTargets:
        mode === 'effort'
          ? { mode }
          : { mode, heartRate: { easy: { low: 120, high: 140 } } },
    };
    const template = WORKOUT_LIBRARY.find((t) => t.id === saved.templateId);
    const dose = scaleTemplate(
      template,
      60,
      false,
      'Taper',
      12,
      12,
      profile,
      saved.steps,
    );
    assert.ok(dose);
    assert.ok(dose.qualityMinutes > 0 && dose.qualityMinutes <= 12);
    assert.ok(dose.steps.some((s) => s.kind === 'work' && s.metres));
    assert.ok(dose.qualityMinutes < saved.qualityMinutes);
    assert.ok(
      dose.steps
        .filter((s) => s.kind === 'work')
        .every((s) => s.metres === 600),
    );
  });

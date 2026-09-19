import { assertMarathonWeek } from './marathon-contract.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Decoder, Stream } from '@garmin/fitsdk';
import {
  makePlan,
  demoProfile,
  addDays,
  validatePlan,
  revisePreferences,
  refreshWorkoutVariety,
} from '../lib/engine.ts';
import {
  requestedQualityCount,
  qualitySchedule,
  resolveRunningDays,
} from '../lib/training-structure.ts';
import { qualityWorkMinutes } from '../lib/prescription.ts';
import {
  selectTemplate,
  scaleTemplate,
  WORKOUT_LIBRARY,
} from '../lib/workout-library.ts';
import { withWorkoutTargets } from '../lib/workout-targets.ts';
import { encodeWorkout } from '../lib/fit.ts';
import { intervalsWorkoutText } from '../lib/intervals-workout.ts';

const start = '2026-09-14';
const input = (patch = {}) => ({
  ...demoProfile(start),
  goal: 'marathon',
  startDate: start,
  raceDate: addDays(start, 125),
  weeklyKm: 70,
  longestKm: 28,
  currentRuns: 5,
  runsPerWeek: 5,
  availableDays: [0, 1, 2, 3, 4, 5, 6],
  days: [0, 1, 2, 3, 5],
  longDay: 5,
  weekdayMinutes: 120,
  longMinutes: 240,
  easyPace: 6,
  difficulty: 'balanced',
  recentQualitySessions: 2,
  recentQualityMinutes: 40,
  workoutVariety: 'familiar',
  qualityMode: 'custom',
  ...patch,
});
const build = (patch) => makePlan(input(patch), start, false);
const main = (w) =>
  w.kind !== 'race' &&
  w.status !== 'skipped' &&
  w.stimulus !== 'economy' &&
  qualityWorkMinutes(w) > 0;
const prescriptions = (p) =>
  p.workouts.map(({ date, kind, minutes, steps, templateId }) => ({
    date,
    kind,
    minutes,
    steps,
    templateId,
  }));

function savedInterval(plan) {
  const original = plan.workouts.find((w) => w.stimulus === 'threshold');
  const template = WORKOUT_LIBRARY.find(
    (t) => t.id === 'marathon-book-six-hundred-timed',
  );
  const dose = scaleTemplate(
    template,
    original.minutes,
    false,
    'Build',
    15,
    15,
    plan.profile,
  );
  assert.ok(dose, 'the saved interval recipe fits its existing session budget');
  return withWorkoutTargets(
    {
      ...original,
      ...dose,
      title: template.title,
      kind: template.kind,
      stimulus: template.stimulus,
      templateId: template.id,
    },
    plan.profile,
  );
}

test('automatic and legacy marathon counts keep the one weekday workout plus one long run', () => {
  assert.equal(
    requestedQualityCount(
      input({ qualityMode: 'automatic', qualitySessions: 2 }),
    ),
    1,
  );
  assert.equal(
    requestedQualityCount(
      input({ qualityMode: undefined, qualitySessions: 2 }),
    ),
    1,
  );
  const automatic = build({ qualityMode: 'automatic', qualitySessions: 2 });
  assert.deepEqual(
    prescriptions(automatic),
    prescriptions(build({ qualityMode: undefined, qualitySessions: 2 })),
  );
  assert.deepEqual(
    prescriptions(automatic),
    prescriptions(build({ qualitySessions: 1 })),
  );
});

for (const runs of [5, 6, 7])
  for (const count of [0, 1, 2])
    test(`${runs} running days and ${count} selected workouts agree across solver and saved plan`, () => {
      const p = input({
        runsPerWeek: runs,
        currentRuns: runs,
        qualitySessions: count,
      });
      assert.equal(requestedQualityCount(p), count);
      const days = resolveRunningDays(p);
      assert.equal(days.length, runs);
      assert.equal(qualitySchedule({ ...p, days }).length, count);
      const plan = makePlan(p, start, false);
      assert.deepEqual(validatePlan(plan), []);
      for (const week of plan.weeks) {
        const sessions = plan.workouts.filter(
          (w) => w.week === week.index && w.kind !== 'race',
        );
        assert.equal(plan.profile.qualitySessions, count);
        if (count === 1) assertMarathonWeek(plan, week);
        assert.ok(
          sessions.filter((w) => w.hard && w.kind !== 'long').length <= count,
        );
        assert.ok(
          sessions.reduce((n, w) => n + qualityWorkMinutes(w), 0) <=
            sessions.reduce((n, w) => n + w.minutes, 0) * 0.22 + 0.1,
        );
        if (week.index < 12)
          assert.equal(new Set(sessions.map((w) => w.date)).size, runs);
      }
      assert.ok(
        plan.weeks.some(
          (week) =>
            plan.workouts.filter(
              (w) => w.week === week.index && (w.hard || w.kind === 'long'),
            ).length ===
            count + 1,
        ),
      );
    });

test('explicit two-workout choices require a familiar background while automatic schedules retain one weekday slot', () => {
  for (const patch of [
    { recentQualitySessions: 1 },
    { recentQualitySessions: null },
    { currentRuns: 4 },
    { experience: 'returning' },
  ]) {
    assert.throws(
      () => build({ ...patch, qualitySessions: 2 }),
      /Two quality sessions/,
    );
    const automatic = build({
      ...patch,
      qualityMode: 'automatic',
      qualitySessions: 2,
    });
    assert.equal(automatic.profile.qualitySessions, 1);
    assert.deepEqual(validatePlan(automatic), []);
  }
  assert.throws(
    () => build({ weeklyKm: 40, qualitySessions: 2 }),
    /Two quality sessions/,
  );
  const familiarLong = build({
    weeklyKm: 40,
    qualityMode: 'automatic',
    qualitySessions: 2,
  });
  assert.equal(familiarLong.weeks[0].targetKm, 40);
  assert.equal(familiarLong.weeks[0].longKm, 28);
  assert.equal(familiarLong.profile.qualitySessions, 1);
  assert.deepEqual(validatePlan(familiarLong), []);
  for (const week of familiarLong.weeks) assertMarathonWeek(familiarLong, week);
  assert.equal(
    requestedQualityCount(input({ goal: 'base', qualitySessions: 2 })),
    0,
  );
  assert.equal(
    requestedQualityCount(input({ runsPerWeek: 2, qualitySessions: 2 })),
    0,
  );
  assert.equal(
    requestedQualityCount(
      input({ goal: 'half', runsPerWeek: 2, qualitySessions: 2 }),
    ),
    0,
  );
});

test('automatic marathon-effort long runs consume the second workout and taper removes it', () => {
  const p = build({ qualityMode: 'automatic', qualitySessions: 2 });
  const rehearsals = p.workouts.filter((w) => w.kind === 'long' && main(w));
  assert.ok(rehearsals.length > 0);
  for (const long of rehearsals) {
    const week = p.workouts.filter((w) => w.week === long.week && main(w));
    assert.equal(week.length, 2);
    assert.ok(
      !week.some((w) => w.templateId === 'marathon-book-secondary-steady'),
    );
  }
  assert.ok(
    !p.workouts.some(
      (w) =>
        w.templateId === 'marathon-book-secondary-steady' &&
        ['Taper', 'Race week', 'Recovery'].includes(p.weeks[w.week].phase),
    ),
  );
});

test('saved interval history does not accelerate primary tempo progression', () => {
  const p = input({ qualitySessions: 2 });
  const context = {
    previous: [],
    availableMinutes: 70,
    week: 1,
    slot: 0,
    marathonModel: true,
  };
  const before = selectTemplate(p, 'Foundation', context);
  const secondary = savedInterval(build({ qualitySessions: 2 }));
  assert.deepEqual(
    selectTemplate(p, 'Foundation', { ...context, previous: [secondary] }),
    before,
  );
});

test('gentle and endurance preferences retain one controlled weekday workout and one long run', () => {
  for (const patch of [
    { difficulty: 'gentle' },
    { marathonApproach: 'endurance' },
  ]) {
    const p = build({ ...patch, qualityMode: 'automatic', qualitySessions: 2 });
    assert.deepEqual(validatePlan(p), []);
    for (const week of p.weeks) assertMarathonWeek(p, week);
    const weekday = p.workouts.filter((w) => w.kind !== 'long' && main(w));
    assert.ok(weekday.length);
    assert.ok(
      weekday.every(
        (w) =>
          w.stimulus === 'threshold' &&
          w.qualityMinutes <= 40 &&
          w.steps.every(
            (s) =>
              s.kind !== 'work' ||
              s.intensity <= (patch.difficulty === 'gentle' ? 5 : 6),
          ),
      ),
    );
    assert.ok(!p.workouts.some((w) => w.stimulus === 'aerobic-power'));
    for (const week of p.weeks) {
      const runs = p.workouts.filter(
        (w) => w.week === week.index && w.kind !== 'race',
      );
      assert.ok(
        runs.reduce((sum, w) => sum + qualityWorkMinutes(w), 0) <=
          runs.reduce((sum, w) => sum + w.minutes, 0) * 0.22 + 0.1,
      );
    }
  }
});

test('changing only workout count preserves hidden settings and completed work', () => {
  const p = build({
    qualitySessions: 1,
    carbsPerHour: 60,
    weeklyMinutesLimit: 900,
    dayPreferences: [{ day: 2, maxMinutes: 110, startTime: '07:30' }],
    preferredHardDays: [1, 3],
  });
  const completed = p.workouts.find((w) => main(w));
  completed.status = 'completed';
  completed.feedback = {
    minutes: completed.minutes,
    effort: 6,
    feeling: 'good',
    recordedAt: completed.date + 'T18:00:00.000Z',
  };
  const snapshot = structuredClone(completed);
  const updated = revisePreferences(
    p,
    { qualityMode: 'custom', qualitySessions: 2 },
    addDays(start, 7),
  );
  for (const key of [
    'carbsPerHour',
    'weeklyMinutesLimit',
    'dayPreferences',
    'preferredHardDays',
    'runsPerWeek',
    'availableDays',
    'recentQualitySessions',
    'recentQualityMinutes',
  ])
    assert.deepEqual(updated.profile[key], p.profile[key]);
  assert.deepEqual(
    updated.workouts.find((w) => w.id === completed.id),
    snapshot,
  );
  assert.deepEqual(validatePlan(updated), []);
  assert.equal(updated.profile.qualitySessions, 2);
  assert.notDeepEqual(prescriptions(updated), prescriptions(p));
  const repeated = revisePreferences(
    updated,
    { qualityMode: 'custom', qualitySessions: 2 },
    addDays(start, 7),
  );
  assert.deepEqual(prescriptions(repeated), prescriptions(updated));
});

test('two selected weekday workouts survive variety and unrelated preference changes', () => {
  const assertTwo = (plan) => {
    assert.equal(plan.profile.qualityMode, 'custom');
    assert.equal(plan.profile.qualitySessions, 2);
    assert.deepEqual(validatePlan(plan), []);
    for (const week of plan.weeks) {
      if (['Recovery', 'Taper', 'Race week'].includes(week.phase)) continue;
      const runs = plan.workouts.filter(
        (w) =>
          w.week === week.index && w.kind !== 'race' && w.status !== 'skipped',
      );
      assert.equal(
        runs.filter((w) => w.kind !== 'long' && w.hard && main(w)).length,
        2,
        `Week ${week.index + 1} must retain both selected weekday workouts`,
      );
      assert.ok(
        runs.reduce((sum, w) => sum + qualityWorkMinutes(w), 0) <=
          runs.reduce((sum, w) => sum + w.minutes, 0) * 0.22 + 0.1,
        'The two workouts must share the existing work allowance',
      );
    }
  };
  for (const runsPerWeek of [5, 6, 7]) {
    for (const workoutFormat of ['automatic', 'time', 'distance']) {
      let plan = build({
        runsPerWeek,
        currentRuns: runsPerWeek,
        qualitySessions: 2,
        workoutFormat,
      });
      assertTwo(plan);
      const weeklyDistances = plan.weeks.map(({ targetKm, longKm }) => [
        targetKm,
        longKm,
      ]);
      for (const patch of [
        { workoutVariety: 'varied' },
        { terrain: 'hills' },
        { carbsPerHour: 60 },
      ]) {
        // Persistence and each new preview must retain the explicit selection.
        plan = revisePreferences(
          JSON.parse(JSON.stringify(plan)),
          patch,
          start,
        );
        assertTwo(plan);
        assert.deepEqual(
          plan.weeks.map(({ targetKm, longKm }) => [targetKm, longKm]),
          weeklyDistances,
          'Preserving workout frequency must not change weekly or long-run distances',
        );
      }
      assertTwo(refreshWorkoutVariety(plan, start));
    }
  }
});

test('saved completed interval recipes survive refresh and export their real steps to the watch', () => {
  const p = build({ qualitySessions: 2 });
  const second = savedInterval(p);
  second.status = 'completed';
  p.workouts[p.workouts.findIndex((w) => w.id === second.id)] = second;
  const refreshed = refreshWorkoutVariety(p, start);
  assert.deepEqual(
    refreshed.workouts.find((w) => w.id === second.id).steps,
    second.steps,
  );
  const bytes = encodeWorkout(second, p.profile);
  const decoded = new Decoder(Stream.fromByteArray(bytes)).read();
  assert.deepEqual(decoded.errors, []);
  assert.ok(
    decoded.messages.workoutStepMesgs.some((s) => s.durationTime === 180),
  );
  assert.match(
    intervalsWorkoutText(second, p.profile),
    /180s freeride intensity=active/,
  );
});

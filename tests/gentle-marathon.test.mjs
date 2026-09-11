import test from 'node:test';
import assert from 'node:assert/strict';
import { Decoder, Stream } from '@garmin/fitsdk';
import {
  makePlan,
  demoProfile,
  addDays,
  validatePlan,
  shortenWorkout,
  revisePreferences,
  refreshWorkoutVariety,
  trainingPhaseOn,
} from '../lib/engine.ts';
import {
  WORKOUT_LIBRARY,
  selectTemplate,
  scaleTemplate,
} from '../lib/workout-library.ts';
import { qualityWorkMinutes } from '../lib/prescription.ts';
import { qualityTrainingEvidence } from '../lib/training-evidence.ts';
import {
  marathonPlanDescription,
  planWeekFocus,
} from '../lib/plan-guidance.ts';
import { encodeWorkout } from '../lib/fit.ts';
import { intervalsWorkoutText } from '../lib/intervals-workout.ts';
import { exportProgram } from '../lib/program-export.ts';
import { validateRecovery } from '../lib/recovery.ts';

const start = '2026-09-07';
const input = (patch = {}) => ({
  ...demoProfile(start),
  goal: 'marathon',
  raceDate: addDays(start, 125),
  weeklyKm: 70,
  longestKm: 28,
  currentRuns: 5,
  runsPerWeek: 5,
  availableDays: [0, 1, 2, 3, 4, 5, 6],
  days: [0, 1, 2, 3, 5],
  longDay: 5,
  qualityMode: 'automatic',
  recentQualitySessions: 2,
  recentQualityMinutes: 40,
  weekdayMinutes: 120,
  longMinutes: 240,
  easyPace: 6,
  difficulty: 'gentle',
  workoutVariety: 'familiar',
  ...patch,
});
const build = (patch = {}) => makePlan(input(patch), start, false);
const work = (w) =>
  w.steps.filter((s) => s.kind === 'work' && s.intensity >= 4);
const intro = (p) =>
  p.workouts.find((w) => w.templateId === 'marathon-book-steady-intro');
const template = WORKOUT_LIBRARY.find(
  (t) => t.id === 'marathon-book-steady-intro',
);

test('the unchanged six-minute entry allowance now selects a complete steady workout', () => {
  const p = input();
  const decision = selectTemplate(p, 'Foundation', {
    previous: [],
    availableMinutes: 60,
    week: 0,
    slot: 0,
    marathonModel: true,
  });
  assert.equal(decision.targetWorkMinutes, 6);
  assert.equal(decision.template.id, template.id);
  const dose = scaleTemplate(
    decision.template,
    60,
    true,
    'Foundation',
    60,
    decision.targetWorkMinutes,
    p,
  );
  assert.equal(dose.qualityMinutes, 6);
  assert.deepEqual(
    work(dose).map((s) => s.seconds),
    [360],
  );
  assert.ok(
    work(dose).every(
      (s) => s.intensity === 5 && /Steady and comfortable/.test(s.effort),
    ),
  );
  assert.equal(
    scaleTemplate(
      WORKOUT_LIBRARY.find((t) => t.id === 'threshold-cruise'),
      60,
      true,
      'Foundation',
      60,
      6,
      p,
    ),
    null,
  );
});

test('complete preparation and gentle work caps are never increased to force the introduction', () => {
  for (const [minutes, cap, target] of [
    [20, 60, 6],
    [60, 6, 6],
    [60, 60, 5],
  ])
    assert.equal(
      scaleTemplate(
        template,
        minutes,
        true,
        'Foundation',
        cap,
        target,
        input(),
      ),
      null,
    );
  const dose = scaleTemplate(template, 21, true, 'Foundation', 7.5, 6, input());
  assert.equal(dose.minutes, 21);
  assert.equal(dose.steps[0].seconds, 600);
  assert.equal(dose.steps.at(-1).seconds, 300);
  assert.equal(dose.qualityMinutes, 6);
});

test('gentle marathon quality keeps only the easy time already allocated to the same day', () => {
  const p = input();
  for (const id of ['marathon-book-steady-intro', 'threshold-cruise']) {
    const t = WORKOUT_LIBRARY.find((t) => t.id === id);
    const target = id === template.id ? 6 : 12;
    const dose = scaleTemplate(t, 90, true, 'Build', 60, target, p);
    assert.equal(dose.minutes, 90);
    assert.equal(dose.qualityMinutes, target);
    assert.equal(
      dose.steps.reduce((n, s) => n + s.seconds, 0),
      5400,
    );
    assert.ok(
      dose.steps
        .filter((s) => !work(dose).includes(s))
        .every((s) => s.intensity <= 3),
    );
  }
  for (const p of [
    input({ goal: 'half' }),
    input({ method: 'threshold-singles' }),
  ]) {
    const dose = scaleTemplate(
      WORKOUT_LIBRARY.find((t) => t.id === 'threshold-cruise'),
      90,
      p.difficulty === 'gentle',
      'Build',
      60,
      12,
      p,
    );
    assert.ok(dose.minutes < 90);
  }
});

test('a full gentle block advances beyond the opening effort while preserving easy recovery and taper', () => {
  const p = build();
  assert.deepEqual(validatePlan(p), []);
  const quality = p.workouts.filter(
    (w) => w.kind !== 'race' && qualityWorkMinutes(w) > 0,
  );
  assert.deepEqual(
    quality.slice(0, 4).map((w) => w.qualityMinutes),
    [6, 8, 8, 12],
  );
  assert.ok(
    quality.every(
      (w) => w.qualityMinutes <= 12 && work(w).every((s) => s.intensity <= 5),
    ),
  );
  assert.ok(
    !p.workouts.some(
      (w) => w.stimulus === 'aerobic-power' || (w.kind === 'long' && w.hard),
    ),
  );
  assert.ok(
    quality
      .filter((w) =>
        ['Taper', 'Race week'].includes(
          trainingPhaseOn(p.profile, p.weeks[w.week].phase, w.date),
        ),
      )
      .every((w) => w.qualityMinutes <= 4),
  );
  for (const week of p.weeks) {
    const runs = p.workouts.filter((w) => w.week === week.index);
    assert.ok(runs.filter((w) => w.hard && w.kind !== 'race').length <= 1);
    if (week.phase === 'Recovery') assert.ok(runs.every((w) => !w.hard));
    assert.ok(new Set(runs.map((w) => w.date)).size <= 5);
  }
  assert.deepEqual(
    qualityTrainingEvidence(p.workouts, addDays(start, 140)),
    [],
  );
});

for (const raceOffset of [125, 126, 127, 128, 129, 130, 131])
  test(`busy Wednesday retains its cap and a feasible long-run progression: race offset ${raceOffset}`, () => {
    const p = build({
      runsPerWeek: 6,
      currentRuns: 6,
      marathonApproach: 'endurance',
      dayPreferences: [{ day: 2, maxMinutes: 15 }],
      raceDate: addDays(start, raceOffset),
    });
    assert.deepEqual(validatePlan(p), []);
    assert.ok(intro(p));
    assert.ok(
      Math.max(
        ...p.workouts
          .filter((w) => w.kind === 'long')
          .map((w) => w.estimatedKm),
      ) >= 26,
    );
    for (const week of p.weeks) {
      const runs = p.workouts.filter(
        (w) => w.week === week.index && w.kind !== 'race',
      );
      assert.ok(
        runs.every(
          (w) =>
            new Date(w.date + 'T12:00:00Z').getUTCDay() !== 3 ||
            w.minutes <= 15,
        ),
      );
      assert.ok(runs.filter((w) => w.hard).length <= 1);
    }
  });

test('short blocks do not cram in an introduction during taper', () => {
  for (const duration of [1, 3, 7, 14, 21]) {
    const p = build({ raceDate: addDays(start, duration - 1) });
    assert.deepEqual(validatePlan(p), []);
    assert.ok(
      p.workouts.every((w) => w.date >= start && w.date <= p.profile.raceDate),
    );
    assert.ok(
      p.workouts
        .filter((w) => w.templateId === template.id)
        .every(
          (w) =>
            !['Taper', 'Race week'].includes(
              trainingPhaseOn(p.profile, p.weeks[w.week].phase, w.date),
            ),
        ),
    );
    if (duration <= 14) assert.ok(!intro(p));
  }
});

test('the first effort stays whole through shortening and becomes easy when preparation cannot fit', () => {
  const p = build();
  let next = p;
  const first = intro(p);
  for (const minutes of [35, 30, 25, 21]) {
    next = shortenWorkout(next, first.id, minutes, start);
    const w = next.workouts.find((w) => w.id === first.id);
    assert.equal(w.minutes, minutes);
    assert.deepEqual(
      work(w).map((s) => s.seconds),
      [360],
    );
    assert.equal(w.qualityMinutes, 6);
  }
  const easy = shortenWorkout(next, first.id, 20, start).workouts.find(
    (w) => w.id === first.id,
  );
  assert.equal(easy.hard, false);
  assert.equal(qualityWorkMinutes(easy), 0);
});

test('explicit completed evidence stays six minutes and repeated reviews preserve the saved workout', () => {
  let p = build();
  const w = intro(p);
  w.status = 'completed';
  w.feedback = {
    actualDate: w.date,
    actualMinutes: w.minutes,
    actualKm: w.estimatedKm,
    effort: 5,
    feeling: 'good',
    execution: 'as-planned',
    completedQualityMinutes: 6,
    note: 'Synthetic steady introduction',
    recordedAt: w.date + 'T12:00:00Z',
  };
  const before = structuredClone(w);
  assert.equal(
    qualityTrainingEvidence(p.workouts, addDays(start, 7))[0].eligible,
    true,
  );
  assert.equal(
    qualityTrainingEvidence(p.workouts, addDays(start, 7))[0].workout
      .qualityMinutes,
    6,
  );
  for (const weeklyMinutesLimit of [900, 950, 900]) {
    p = refreshWorkoutVariety(
      revisePreferences(p, { weeklyMinutesLimit }, addDays(start, 7)),
      addDays(start, 7),
    );
    assert.deepEqual(
      p.workouts.find((s) => s.id === w.id),
      before,
    );
    assert.deepEqual(validatePlan(p), []);
  }
  assert.doesNotThrow(() =>
    validateRecovery({
      format: 'stride-recovery-2',
      exportedAt: start + 'T12:00:00Z',
      profile: null,
      plan: p,
    }),
  );
});

for (const mode of ['effort', 'pace', 'heart-rate'])
  test(`${mode} targets and FIT contain the saved six-minute steady effort`, () => {
    const p = build({
      workoutTargets: {
        mode,
        pace: {
          easy: { low: 360, high: 400 },
          steady: { low: 320, high: 340 },
          tempo: { low: 280, high: 300 },
        },
        heartRate: {
          easy: { low: 130, high: 145 },
          steady: { low: 145, high: 155 },
          tempo: { low: 165, high: 175 },
        },
      },
    });
    const w = intro(p);
    assert.match(w.title, /6 min steady/);
    assert.match(w.purpose, /not a full threshold workout/);
    const { messages, errors } = new Decoder(
      Stream.fromByteArray(encodeWorkout(w)),
    ).read();
    assert.deepEqual(errors, []);
    for (const [i, s] of w.steps.entries()) {
      const out = messages.workoutStepMesgs[i];
      assert.equal(out.durationTime, s.seconds);
      assert.equal(out.notes, s.effort);
      if (s.kind !== 'work') continue;
      assert.equal(out.durationTime, 360);
      assert.equal(
        out.targetType,
        mode === 'pace'
          ? 'speed'
          : mode === 'heart-rate'
            ? 'heartRate'
            : 'open',
      );
      if (mode === 'pace')
        assert.deepEqual(
          [out.customTargetSpeedLow, out.customTargetSpeedHigh],
          [2.941, 3.125],
        );
      if (mode === 'heart-rate')
        assert.deepEqual(
          [out.customTargetHeartRateLow, out.customTargetHeartRateHigh],
          [245, 255],
        );
    }
    if (mode === 'pace')
      assert.match(intervalsWorkoutText(w), /360s 5:20-5:40\/km Pace/);
    if (mode === 'effort')
      assert.match(intervalsWorkoutText(w), /360s freeride/);
    if (mode === 'heart-rate')
      assert.throws(() => intervalsWorkoutText(w), /Direct BPM targets/);
    assert.match(marathonPlanDescription(p), /Steady, comfortable efforts/);
    assert.doesNotMatch(
      planWeekFocus(p, p.weeks[w.week]),
      /tempo is included|Faster repetitions/,
    );
    const output = exportProgram(p)
      .weeks[w.week].days.flatMap((d) => d.sessions)
      .find((s) => s.id === w.id);
    assert.equal(
      output.main_set.find((s) => s.kind === 'work').duration_seconds,
      360,
    );
  });

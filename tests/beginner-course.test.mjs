import { Decoder, Stream } from '@garmin/fitsdk';
import { encodeWorkout } from '../lib/fit.ts';
import { intervalsWorkoutText } from '../lib/intervals-workout.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makePlan,
  demoProfile,
  validatePlan,
  noviceReview,
  advanceRunWalk,
  revisePreferences,
  moveWorkout,
  shortenWorkout,
  adjustPlan,
  refreshWorkoutVariety,
  addDays,
  PlanError,
  rebalanceFutureQuality,
} from '../lib/engine.ts';
import { BEGINNER_LESSONS, beginnerSteps } from '../lib/beginner-course.ts';
import { changeEvent, avoidRecordedOverlap } from '../lib/event-transition.ts';
import { updateRunMeasure } from '../lib/run-distance.ts';
import { updateWorkoutTargets } from '../lib/workout-targets.ts';
import { validateRecovery, prepareRestoredPlan } from '../lib/recovery.ts';
import { assessFeasibility } from '../lib/plan/feasibility.ts';

const start = '2026-05-04';
const profile = (patch = {}) => ({
  ...demoProfile(start),
  goal: '5k',
  experience: 'new',
  weeklyKm: 0,
  longestKm: 0,
  currentRuns: 0,
  days: [0, 2, 4],
  availableDays: [0, 2, 4],
  runsPerWeek: 3,
  longDay: 5,
  weekdayMinutes: 40,
  easyPace: null,
  qualityMode: 'automatic',
  raceDate: addDays(start, 62),
  ...patch,
});

void test('foundation lessons ignore retained manual pace for distance estimates, including JSON recovery', () => {
  for (const goal of ['5k', '10k', 'half', 'marathon']) {
    const plan = makePlan(
      profile({
        goal,
        planLevel: 'beginner',
        easyPace: 6,
        recentRace: { distanceKm: 5, timeMinutes: 30 },
        workoutTargets: {
          mode: 'pace',
          pace: { easy: { low: 360, high: 420 } },
        },
      }),
      start,
    );
    for (const w of plan.workouts) {
      assert.equal(w.estimatedKm, 0);
      assert.equal(w.distanceEstimate.lowerKm, null);
      assert.equal(w.distanceEstimate.upperKm, null);
      assert.ok(
        w.steps.every((s) => s.target === undefined && s.metres === undefined),
      );
    }
    const serialized = JSON.parse(JSON.stringify(plan));
    // Older copies may contain the fabricated range; restoration must not use
    // the retained manual pace for an untargeted walking/running lesson.
    serialized.workouts[0].distanceEstimate = {
      lowerKm: 2,
      upperKm: 3.3,
      basis: 'Old pace-derived estimate.',
    };
    const restored = validateRecovery({
      format: 'stride-recovery-2',
      exportedAt: start + 'T18:00:00Z',
      profile: null,
      plan: serialized,
    }).plan;
    assert.ok(
      restored.workouts.every(
        (w) =>
          w.distanceEstimate.lowerKm === null &&
          w.distanceEstimate.upperKm === null,
      ),
    );
  }
});
const plan = (patch = {}) => makePlan(profile(patch), start);
function log(w, patch = {}) {
  w.status = 'completed';
  w.feedback = {
    actualDate: w.date,
    actualMinutes: w.minutes,
    actualKm: null,
    effort: 3,
    feeling: 'good',
    execution: 'as-planned',
    note: 'Synthetic beginner test',
    recordedAt: w.date + 'T18:00:00Z',
    ...patch,
  };
}
function three(p = plan(), patch = {}) {
  p.workouts.slice(0, 3).forEach((w) => log(w, patch));
  return p;
}
const after = addDays(start, 7);
const errors = (p) => assert.deepEqual(validatePlan(p), []);

void test('zero running history creates a timed introduction without invented kilometres, pace, long run or race', () => {
  const p = plan();
  errors(p);
  assert.equal(p.beginner.stage, 0);
  assert.equal(p.workouts.length, 27);
  assert.deepEqual(
    [p.profile.weeklyKm, p.profile.longestKm, p.profile.currentRuns],
    [0, 0, 0],
  );
  assert.ok(
    p.workouts.every(
      (w) =>
        w.kind === 'easy' &&
        !w.hard &&
        w.estimatedKm === 0 &&
        w.minutes === 28.5 &&
        w.beginnerLesson.stage === 0,
    ),
  );
  assert.equal(
    p.workouts[0].steps.filter((s) => s.movement === 'run').length,
    8,
  );
  assert.ok(
    p.workouts.every((w) =>
      w.steps.every((s) => s.target === undefined && s.metres === undefined),
    ),
  );
  assert.equal(assessFeasibility(p, start).status, 'review-required');
  assert.match(assessFeasibility(p, start).reasons[0], /not necessarily 5 km/);
});

void test('all 27 lessons match independently transcribed NHS running bouts and outing totals', () => {
  const running = [
    [1, 1, 1, 1, 1, 1, 1, 1],
    [1.5, 1.5, 1.5, 1.5, 1.5, 1.5],
    [1.5, 3, 1.5, 3],
    [3, 5, 3, 5],
  ];
  const expectedBouts = [
    ...running.flatMap((v) => [v, v, v]),
    [5, 5, 5],
    [8, 8],
    [20],
    [5, 8, 5],
    [10, 10],
    [25],
    [25],
    [25],
    [25],
    [28],
    [28],
    [28],
    [30],
    [30],
    [30],
  ];
  const totals = [
    28.5, 28.5, 28.5, 29, 29, 29, 25, 25, 25, 31.5, 31.5, 31.5, 31, 31, 30, 34,
    33, 35, 35, 35, 35, 38, 38, 38, 40, 40, 40,
  ];
  assert.equal(BEGINNER_LESSONS.length, 9);
  for (let i = 0; i < 27; i++) {
    const steps = beginnerSteps(Math.floor(i / 3), i % 3);
    assert.deepEqual(
      steps.filter((s) => s.movement === 'run').map((s) => s.seconds / 60),
      expectedBouts[i],
    );
    assert.equal(steps.reduce((n, s) => n + s.seconds, 0) / 60, totals[i]);
    assert.equal(steps[0].seconds, 300);
    assert.equal(steps.at(-1).seconds, 300);
    assert.equal(steps[0].movement, 'walk');
    assert.equal(steps.at(-1).movement, 'walk');
  }
});

for (const pace of [null, 3, 6, 10, 15])
  void test(`beginner lesson dose is independent of guessed pace ${pace}`, () =>
    assert.deepEqual(
      plan({ easyPace: pace }).workouts.map((w) => w.steps),
      plan().workouts.map((w) => w.steps),
    ));
for (const q of [1, 2])
  void test(`explicit ${q} speed workouts are rejected, never silently erased`, () =>
    assert.throws(
      () => plan({ qualityMode: 'custom', qualitySessions: q }),
      /zero speed workouts/,
    ));
for (const days of [
  [0, 1],
  [0, 2, 6],
  [0, 1, 2],
])
  void test(`adjacent-only availability ${days} has a clear rest-day error`, () =>
    assert.throws(
      () => plan({ days, availableDays: days, runsPerWeek: days.length }),
      /rest day/,
    ));
for (const patch of [
  { runsPerWeek: 4 },
  { weekdayMinutes: 39 },
  { weeklyMinutesLimit: 119 },
  { dayPreferences: [{ day: 0, maxMinutes: 30 }] },
])
  void test(`incompatible beginner limits ${JSON.stringify(patch)} reject cleanly`, () =>
    assert.throws(() => plan(patch), PlanError));

void test('calendar advance, missed and unconfirmed lessons never certify progression', () => {
  for (const execution of [
    undefined,
    'unknown',
    'partial',
    'easy-substitute',
    'not-attempted',
  ]) {
    const p = three(plan(), { execution });
    assert.equal(noviceReview(p, after).ready, false);
    assert.throws(() => advanceRunWalk(p, after), PlanError);
  }
  assert.equal(noviceReview(plan(), addDays(start, 60)).ready, false);
  const p = three();
  p.workouts[1].status = 'skipped';
  delete p.workouts[1].feedback;
  assert.equal(noviceReview(p, after).ready, false);
});

void test('all nine reviewed stages preserve logs and culminate in 30 minutes, not a recorded 5 km', () => {
  let p = plan();
  for (let stage = 0; stage < 9; stage++) {
    const date = addDays(start, (stage + 1) * 7);
    p.workouts
      .filter((w) => w.status === 'planned' && w.date < date)
      .forEach((w) => log(w));
    const before = structuredClone(
      p.workouts.filter((w) => w.status === 'completed'),
    );
    assert.equal(noviceReview(p, date).ready, true);
    p = advanceRunWalk(p, date);
    errors(p);
    assert.deepEqual(
      p.workouts.filter((w) => w.status === 'completed'),
      before,
    );
    assert.throws(() => advanceRunWalk(p, date), PlanError);
  }
  assert.equal(p.workouts.filter((w) => w.status === 'completed').length, 27);
  assert.equal(p.beginner.completedAt, addDays(start, 63));
  assert.ok(p.workouts.every((w) => w.feedback.actualKm === null));
  assert.equal(
    p.workouts.at(-1).steps.find((s) => s.movement === 'run').seconds,
    1800,
  );
});

void test('variable stage requires lessons 1, 2 and 3 in order; repeats of one do not qualify', () => {
  let p = plan();
  for (let i = 0; i < 4; i++) {
    const day = addDays(start, (i + 1) * 7);
    p.workouts
      .filter((w) => w.status === 'planned' && w.date < day)
      .forEach((w) => log(w));
    p = advanceRunWalk(p, day);
  }
  const upcoming = p.workouts.filter((w) => w.status === 'planned');
  upcoming.slice(0, 3).forEach((w) => log(w));
  assert.equal(noviceReview(p, addDays(start, 35)).ready, true);
  upcoming[2].feedback.execution = 'partial';
  assert.equal(noviceReview(p, addDays(start, 35)).ready, false);
});

void test('corrupted historical recipes cannot manufacture progress evidence', () => {
  const p = three();
  for (const w of p.workouts.slice(0, 3)) {
    for (const s of w.steps.filter((s) => s.movement === 'run')) s.seconds = 1;
    w.minutes = w.steps.reduce((n, s) => n + s.seconds, 0) / 60;
    w.feedback.actualMinutes = w.minutes;
  }
  assert.equal(noviceReview(p, after).ready, false);
  assert.throws(() => advanceRunWalk(p, after), PlanError);
  assert.ok(validatePlan(p).length);
});

void test('fatigue, short outings, duplicated actual dates and same-day third lesson prevent advancement', () => {
  for (const patch of [
    { feeling: 'tired' },
    { effort: 8 },
    { actualMinutes: 10 },
    { actualDate: start },
  ])
    assert.equal(noviceReview(three(plan(), patch), after).ready, false);
  assert.equal(noviceReview(three(), addDays(start, 4)).ready, false);
});

void test('preferences, measurement, targets and variety preserve beginner recipes and state', () => {
  const p = advanceRunWalk(three(), after);
  for (const updated of [
    revisePreferences(p, { weekdayMinutes: 45 }, after),
    updateRunMeasure(p, 'distance', after),
    updateWorkoutTargets(
      p,
      { mode: 'pace', pace: { easy: { low: 300, high: 330 } } },
      after,
    ),
    refreshWorkoutVariety(p, after),
  ]) {
    errors(updated);
    assert.deepEqual(updated.beginner, p.beginner);
    assert.deepEqual(
      updated.workouts.map((w) => w.steps),
      p.workouts.map((w) => w.steps),
    );
  }
});

void test('manual moved dates and identities survive advancement', () => {
  let p = three();
  const w = p.workouts.find((w) => w.date === addDays(start, 11));
  p = moveWorkout(p, w.id, addDays(start, 12), after);
  p = advanceRunWalk(p, after);
  const moved = p.workouts.find((x) => x.id === w.id);
  assert.equal(moved.date, addDays(start, 12));
  assert.equal(moved.beginnerLesson.stage, 1);
  errors(p);
});

void test('moves enforce rest across week boundaries and shortening cannot discard preparation', () => {
  const p = plan();
  assert.throws(
    () => moveWorkout(p, p.workouts[0].id, addDays(start, 1), start),
    /rest day/,
  );
  assert.throws(
    () => moveWorkout(p, p.workouts[2].id, addDays(start, 6), start),
    /rest day/,
  );
  assert.throws(
    () => shortenWorkout(p, p.workouts[0].id, 20, start),
    /complete beginner lesson/,
  );
});

void test('rest breaks preserve history and repeat an easier stage without metric return allocation', () => {
  let p = advanceRunWalk(three(), after);
  const before = structuredClone(p.workouts.slice(0, 3));
  p = adjustPlan(p, after, addDays(after, 6), 'rest', after);
  errors(p);
  assert.equal(p.beginner.stage, 0);
  assert.equal(p.returnState, undefined);
  assert.deepEqual(p.workouts.slice(0, 3), before);
  assert.equal(noviceReview(p, addDays(after, 7)).ready, false);
  assert.ok(
    p.workouts
      .filter((w) => w.date >= after && w.date <= addDays(after, 6))
      .every((w) => w.status === 'skipped'),
  );
});

void test('actual running dates and extra runs reserve recovery during preference review', () => {
  let p = plan();
  log(p.workouts[0], { actualDate: addDays(start, 1) });
  assert.ok(validatePlan(p).some((s) => s.includes('recorded running')));
  p = revisePreferences(p, { weekdayMinutes: 45 }, addDays(start, 2));
  errors(p);
  assert.ok(
    !p.workouts.some(
      (w) => w.status === 'planned' && w.date === addDays(start, 2),
    ),
  );
});

void test('short course extends without losing progress or inventing a road baseline', () => {
  let p = three(plan({ raceDate: addDays(start, 13) }));
  p = advanceRunWalk(p, after);
  const saved = structuredClone(
    p.workouts.filter((w) => w.status === 'completed'),
  );
  p = changeEvent(
    p,
    {
      goal: '5k',
      raceName: 'Continue learning',
      raceDate: addDays(start, 100),
    },
    addDays(start, 14),
  );
  errors(p);
  assert.equal(p.beginner.stage, 1);
  assert.equal(p.profile.weeklyKm, 0);
  assert.deepEqual(
    p.workouts.filter((w) => w.status === 'completed'),
    saved,
  );
});

void test('JSON recovery retains lesson identity and evidence; corrupt metadata rejects', () => {
  const p = advanceRunWalk(three(), after);
  const input = {
    format: 'stride-recovery-2',
    exportedAt: new Date().toISOString(),
    profile: null,
    plan: p,
    standaloneRuns: [],
  };
  const recovered = prepareRestoredPlan(
    validateRecovery(JSON.parse(JSON.stringify(input))).plan,
  );
  errors(recovered);
  assert.deepEqual(recovered.beginner, p.beginner);
  assert.deepEqual(
    recovered.workouts.map((w) => w.beginnerLesson),
    p.workouts.map((w) => w.beginnerLesson),
  );
  input.plan.beginner.stage = 20;
  assert.throws(() => validateRecovery(input), /beginner course/);
});

void test('future breaks cannot be bypassed with pre-break progression evidence', () => {
  let p = advanceRunWalk(three(), after);
  p = adjustPlan(p, addDays(start, 21), addDays(start, 27), 'rest', after);
  errors(p);
  p.workouts
    .filter((w) => w.status === 'planned' && w.date < addDays(start, 14))
    .forEach((w) => log(w));
  assert.equal(noviceReview(p, addDays(start, 14)).ready, false);
  assert.throws(() => advanceRunWalk(p, addDays(start, 14)), /after the break/);
  assert.equal(noviceReview(p, addDays(start, 29)).ready, false);
});

void test('single-session preferred start times survive recovery without paired-day metadata', () => {
  const p = plan({ dayPreferences: [{ day: 0, startTime: '08:00' }] });
  const input = {
    format: 'stride-recovery-2',
    exportedAt: new Date().toISOString(),
    profile: null,
    plan: p,
    standaloneRuns: [],
  };
  assert.equal(validateRecovery(input).plan.workouts[0].startTime, '08:00');
  input.plan.workouts[0].startTime = '99:00';
  assert.throws(() => validateRecovery(input), /start time/);
});

void test('all 27 beginner lessons retain time, walking cues and open effort targets through FIT and Intervals export', () => {
  const w = plan().workouts[0];
  for (let stage = 0; stage < 9; stage++)
    for (let lesson = 0; lesson < 3; lesson++) {
      const steps = beginnerSteps(stage, lesson);
      const workout = {
        ...w,
        steps,
        minutes: steps.reduce((n, s) => n + s.seconds, 0) / 60,
        beginnerLesson: { ...w.beginnerLesson, stage, lesson },
      };
      const decoder = new Decoder(Stream.fromByteArray(encodeWorkout(workout)));
      assert.equal(decoder.checkIntegrity(), true);
      const decoded = decoder.read();
      assert.deepEqual(decoded.errors, []);
      assert.equal(decoded.messages.workoutStepMesgs.length, steps.length);
      for (const [i, saved] of decoded.messages.workoutStepMesgs.entries()) {
        assert.equal(saved.durationType, 'time');
        assert.equal(saved.durationTime, steps[i].seconds);
        assert.equal(saved.targetType, 'open');
      }
      const text = intervalsWorkoutText(workout);
      assert.equal(text.split('\n').length, steps.length);
      assert.ok(
        text.includes('warm-up walk') && text.includes('cooldown walk'),
      );
      assert.ok(
        text
          .split('\n')
          .every((line) => line.includes('freeride') && !line.includes('mtr')),
      );
    }
});

void test('truthful changed-date logging saves while conflicting upcoming lessons become rest', () => {
  const p = plan();
  log(p.workouts[0], { actualDate: addDays(start, 1) });
  rebalanceFutureQuality(p, addDays(start, 1));
  errors(p);
  assert.equal(p.workouts[0].feedback.actualDate, addDays(start, 1));
  assert.equal(p.workouts[1].status, 'skipped');
  assert.equal(p.beginner.stage, 0);
});

void test('changing days cannot schedule lessons inside a saved rest break', () => {
  let p = adjustPlan(
    advanceRunWalk(three(), after),
    after,
    addDays(after, 6),
    'rest',
    after,
  );
  p = revisePreferences(
    p,
    { days: [1, 3, 5], availableDays: [1, 3, 5], runsPerWeek: 3, longDay: 5 },
    after,
  );
  errors(p);
  assert.ok(
    p.workouts
      .filter((w) => w.date >= after && w.date <= addDays(after, 6))
      .every((w) => w.status === 'skipped'),
  );
  const corrupt = structuredClone(p);
  const upcoming = corrupt.workouts.find(
    (w) => w.status === 'planned' && w.date > after,
  );
  upcoming.date = addDays(after, 1);
  assert.ok(
    validatePlan(corrupt).some((error) => error.includes('rest break')),
  );
});

void test('activation preview reserves recovery from standalone running before the course starts', () => {
  const p = plan();
  const next = avoidRecordedOverlap(
    p,
    null,
    [
      {
        id: 'synthetic-prior-run',
        date: addDays(start, -1),
        minutes: 15,
        km: null,
        effort: 3,
        feeling: 'good',
        note: 'Synthetic',
        recordedAt: start + 'T08:00:00Z',
      },
    ],
    start,
  );
  assert.equal(next.workouts[0].status, 'skipped');
  assert.equal(p.workouts[0].status, 'planned');
  errors(next);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  demoProfile,
  makePlan,
  revisePreferences,
  validatePlan,
} from '../lib/engine.ts';
import { updateRunMeasure } from '../lib/run-distance.ts';
import {
  scaleTemplate,
  selectTemplate,
  WORKOUT_LIBRARY,
} from '../lib/workout-library.ts';
import { qualityWorkMinutes } from '../lib/prescription.ts';
import { refreshWorkoutVariety } from '../lib/plan/variety.ts';

const start = '2026-09-28';
const profile = (patch = {}) => ({
  ...demoProfile(start),
  goal: 'marathon',
  raceDate: addDays(start, 125),
  weeklyKm: 60,
  longestKm: 20,
  currentRuns: 5,
  runsPerWeek: 5,
  days: [0, 1, 2, 4, 6],
  availableDays: [0, 1, 2, 3, 4, 5, 6],
  longDay: 6,
  weekdayMinutes: 120,
  longMinutes: 300,
  easyPace: 6,
  experience: 'established',
  intent: 'improve',
  qualityMode: 'custom',
  qualitySessions: 2,
  recentQualitySessions: 2,
  recentQualityMinutes: 40,
  workoutFormat: 'time',
  workoutVariety: 'varied',
  runMeasure: 'distance',
  ...patch,
});
// Ignore titles, easy padding and changed target numbers. A continuous run stays
// one pattern even when its duration progresses; interval work/recovery remains executable.
const signature = (w) => {
  const work = w.steps.filter((s) => s.kind === 'work');
  const first = w.steps.indexOf(work[0]),
    last = w.steps.indexOf(work.at(-1));
  const body = w.steps.slice(first, last + 1);
  return JSON.stringify([
    w.stimulus,
    work.length === 1
      ? 'continuous'
      : body.map((s) => [
          s.kind,
          s.metres === undefined ? 'time' : 'distance',
          s.metres ?? s.seconds,
          s.intensity,
          s.movement ?? 'run',
        ]),
  ]);
};
const ordinary = (plan) =>
  plan.workouts.filter(
    (w) =>
      w.hard &&
      w.kind !== 'long' &&
      w.kind !== 'race' &&
      ['Foundation', 'Build', 'Race preparation'].includes(
        plan.weeks[w.week].phase,
      ) &&
      Date.parse(plan.profile.raceDate) - Date.parse(w.date) > 21 * 86400000,
  );
const settings = (mode) =>
  mode === 'effort'
    ? { workoutTargets: { mode: 'effort' } }
    : {
        recentRace: { distanceKm: 10, timeMinutes: 50, date: '2026-09-01' },
        ...(mode === 'manual'
          ? {
              workoutTargets: {
                mode: 'pace',
                bandsVersion: 2,
                raceScope: 'marathon:',
                pace: {
                  easy: { low: 330, high: 360 },
                  threshold: { low: 285, high: 300 },
                  interval: { low: 240, high: 270 },
                  race: { low: 300, high: 330 },
                },
              },
            }
          : {}),
      };
for (const qualitySessions of [1, 2])
  for (const workoutFormat of ['time', 'distance'])
    for (const mode of ['effort', 'automatic', 'manual']) {
      test(`marathon q${qualitySessions} ${workoutFormat}/${mode}: distinct executable sets preserve frequency, baseline and work caps`, () => {
        const plan = makePlan(
          profile({ qualitySessions, workoutFormat, ...settings(mode) }),
          start,
          false,
        );
        assert.deepEqual(validatePlan(plan), []);
        const sessions = ordinary(plan);
        assert.ok(
          new Set(sessions.map(signature)).size >=
            (qualitySessions === 1 ? 5 : 10),
        );
        if (qualitySessions === 2) {
          assert.ok(sessions.some((w) => w.stimulus === 'threshold'));
          assert.ok(sessions.some((w) => w.stimulus === 'aerobic-power'));
          assert.ok(sessions.some((w) => w.stimulus === 'race-rhythm'));
        }
        for (const week of plan.weeks) {
          const runs = plan.workouts.filter(
            (w) => w.week === week.index && w.kind !== 'race',
          );
          if (week.index === 0) {
            assert.ok(
              Math.abs(runs.reduce((n, w) => n + w.estimatedKm, 0) - 60) <
                0.002,
            );
            assert.equal(runs.find((w) => w.kind === 'long').estimatedKm, 20);
          }
          if (
            !['Foundation', 'Build', 'Race preparation'].includes(week.phase) ||
            Date.parse(plan.profile.raceDate) -
              Date.parse(addDays(week.start, 6)) <=
              21 * 86400000
          )
            continue;
          const quality = sessions.filter((w) => w.week === week.index);
          assert.equal(quality.length, qualitySessions);
          if (qualitySessions === 2)
            assert.notEqual(signature(quality[0]), signature(quality[1]));
          const minutes = runs.reduce((n, w) => n + w.minutes, 0);
          assert.ok(
            runs.reduce((n, w) => n + qualityWorkMinutes(w), 0) <=
              minutes * 0.22 + 0.02,
          );
          assert.ok(
            runs.reduce((n, w) => n + w.estimatedKm, 0) <= 60 * 1.4 + 0.002,
          );
          for (const w of runs) {
            assert.ok(w.minutes <= (w.kind === 'long' ? 300 : 120) + 1 / 60);
            if (mode === 'effort') assert.ok(w.steps.every((s) => !s.target));
          }
        }
      });
    }

test('a limited marathon slot selects a complete fitting set before generation can drop it', () => {
  const p = profile({
    qualitySessions: 1,
    recentQualityMinutes: 40,
    workoutFormat: 'time',
  });
  const previous = [
    {
      id: 'previous',
      status: 'planned',
      kind: 'tempo',
      stimulus: 'threshold',
      date: start,
      week: 0,
      qualityMinutes: 20,
      templateId: 'marathon-book-lt-20',
      steps: [{ kind: 'work', seconds: 1200, intensity: 6 }],
    },
  ];
  const decision = selectTemplate(p, 'Build', {
    previous,
    availableMinutes: 40,
    workAllowanceMinutes: 12,
    slot: 0,
    week: 1,
  });
  const dose = scaleTemplate(
    decision.template,
    40,
    false,
    'Build',
    12,
    decision.targetWorkMinutes,
    p,
  );
  assert.ok(dose);
  assert.ok(dose.qualityMinutes >= 6 && dose.qualityMinutes <= 12);
  assert.ok(
    dose.steps.filter((s) => s.kind === 'work').length > 1,
    'a complete cruise set fits instead of being demoted to easy',
  );
});

test('authored short ladders retain every bout and fail below their complete dose', () => {
  for (const [id, seconds] of [
    ['marathon-book-short-cruise-ladder-timed', [300, 240, 180]],
    ['marathon-book-marathon-descending-timed', [600, 480, 360]],
  ]) {
    const template = WORKOUT_LIBRARY.find((t) => t.id === id);
    const work = seconds.reduce((a, b) => a + b, 0) / 60;
    const dose = scaleTemplate(
      template,
      60,
      false,
      'Build',
      work,
      work,
      profile(),
    );
    assert.ok(dose);
    assert.deepEqual(
      dose.steps.filter((s) => s.kind === 'work').map((s) => s.seconds),
      seconds,
    );
    assert.equal(
      scaleTemplate(
        template,
        60,
        false,
        'Build',
        work - 1,
        work - 1,
        profile(),
      ),
      null,
    );
  }
});

test('familiar marathon preference keeps its primary continuous pattern', () => {
  const p = makePlan(
    profile({
      qualitySessions: 1,
      workoutVariety: 'familiar',
      ...settings('effort'),
    }),
    start,
    false,
  );
  assert.ok(
    ordinary(p).every(
      (w) => w.steps.filter((s) => s.kind === 'work').length === 1,
    ),
  );
});

test('new marathon patterns do not rewrite completed, manually edited or tapered prescriptions', () => {
  const plan = makePlan(profile(settings('automatic')), start, false);
  const sessions = ordinary(plan);
  sessions[0].status = 'completed';
  sessions[1].changed = true;
  sessions[1].changeSource = 'manual';
  const protectedIds = [
    sessions[0].id,
    sessions[1].id,
    ...plan.workouts
      .filter((w) => ['Taper', 'Race week'].includes(plan.weeks[w.week].phase))
      .map((w) => w.id),
  ];
  const before = plan.workouts.filter((w) => protectedIds.includes(w.id));
  const next = refreshWorkoutVariety(plan, start);
  assert.deepEqual(
    next.workouts.filter((w) => protectedIds.includes(w.id)),
    before,
  );
});

test('a paced marathon finish retains its complete work dose and funded metres through measurement round trips', () => {
  const original = revisePreferences(
    makePlan(
      profile({
        weeklyKm: 70,
        longestKm: 23,
        raceDate: addDays(start, 111),
        runMeasure: 'time',
        ...settings('automatic'),
      }),
      start,
      false,
    ),
    { workoutVariety: 'familiar' },
    start,
  );
  const snapshot = structuredClone(original);
  const fasterLongs = original.workouts.filter(
    (w) => w.kind === 'long' && w.hard,
  );
  assert.ok(
    fasterLongs.some((w) => w.estimatedKm >= 33 && qualityWorkMinutes(w) >= 55),
  );
  let current = original;
  for (let round = 0; round < 3; round++) {
    const measured = updateRunMeasure(current, 'distance', start);
    assert.deepEqual(validatePlan(measured), []);
    for (const before of fasterLongs) {
      const after = measured.workouts.find((w) => w.id === before.id);
      assert.equal(after.estimatedKm, before.estimatedKm);
      // At most one metre per faster block is lost when its timed dose becomes
      // a distance endpoint; proportional easy-pace splitting lost >11 minutes.
      assert.ok(
        Math.abs(qualityWorkMinutes(after) - qualityWorkMinutes(before)) <
          1 / 60,
      );
      assert.deepEqual(
        after.steps.filter((s) => s.intensity >= 4).map((s) => s.seconds),
        before.steps.filter((s) => s.intensity >= 4).map((s) => s.seconds),
      );
      assert.ok(after.minutes <= original.profile.longMinutes + 1 / 60);
    }
    current = updateRunMeasure(
      JSON.parse(JSON.stringify(measured)),
      'time',
      start,
    );
    assert.deepEqual(validatePlan(current), []);
    for (const before of original.workouts) {
      const after = current.workouts.find((w) => w.id === before.id);
      assert.ok(
        Math.abs(after.estimatedKm - before.estimatedKm) <= 0.0005 + 1e-9,
      );
      assert.equal(qualityWorkMinutes(after), qualityWorkMinutes(before));
    }
  }
  assert.deepEqual(original, snapshot);
});

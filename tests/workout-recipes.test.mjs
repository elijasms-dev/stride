import test from 'node:test';
import assert from 'node:assert/strict';
import { Decoder, Stream } from '@garmin/fitsdk';
import {
  makePlan,
  demoProfile,
  addDays,
  validatePlan,
  workoutAlternatives,
  substituteWorkout,
} from '../lib/engine.ts';
import {
  WORKOUT_LIBRARY,
  scaleTemplate,
  resizeWorkout,
  variedWorkoutPrescription,
  selectTemplate,
} from '../lib/workout-library.ts';
import {
  withWorkoutTargets,
  updateWorkoutTargets,
} from '../lib/workout-targets.ts';
import {
  specificWorkoutName,
  mainSetSummary,
  recoverySummary,
  withSpecificWorkoutName,
} from '../lib/workout-names.ts';
import { distanceEstimate } from '../lib/prescription.ts';
import { encodeWorkout } from '../lib/fit.ts';
import { exportCalendar } from '../lib/calendar.ts';
import { exportProgram } from '../lib/program-export.ts';
const start = '2026-09-07';
const config = {
  mode: 'pace',
  pace: {
    easy: { low: 330, high: 390 },
    tempo: { low: 275, high: 300 },
    interval: { low: 250, high: 270 },
    race: { low: 270, high: 290 },
  },
};
const profile = (goal = '5k') => ({
  ...demoProfile(start),
  goal,
  easyPace: 5.67,
  weeklyKm: goal === 'marathon' ? 70 : 45,
  longestKm: goal === 'marathon' ? 25 : 15,
  currentRuns: 5,
  runsPerWeek: 5,
  days: [0, 1, 2, 3, 5],
  longDay: 5,
  recentQualitySessions: 2,
  recentQualityMinutes: 32,
  qualitySessions: 2,
  intent: 'improve',
  weekdayMinutes: 90,
  longMinutes: 200,
  raceDate: addDays(start, 139),
  workoutTargets: { ...config, raceScope: `${goal}:` },
});
function session(id, cap = 30, p = profile(), minutes = 50) {
  const t = WORKOUT_LIBRARY.find((t) => t.id === id);
  const dose = scaleTemplate(
    t,
    minutes,
    false,
    'Race preparation',
    cap,
    cap,
    p,
  );
  assert.ok(dose, `${id} fits`);
  return withWorkoutTargets(
    withSpecificWorkoutName({
      id: 'recipe-fixture',
      date: addDays(start, 30),
      originalDate: addDays(start, 30),
      week: 4,
      status: 'planned',
      title: t.title,
      purpose: t.purpose,
      reason: t.purpose,
      kind: t.kind,
      hard: true,
      stimulus: t.stimulus,
      templateId: t.id,
      steps: dose.steps,
      minutes: dose.minutes,
      estimatedKm: dose.minutes / p.easyPace,
      qualityMinutes: dose.qualityMinutes,
    }),
    p,
  );
}
void test('recognisable titles and exact main-set/recovery summaries use saved steps', () => {
  const pyramid = session('power-full-pyramid');
  assert.equal(pyramid.title, 'Pyramid intervals');
  assert.equal(mainSetSummary(pyramid), '1–2–3–2–1 min');
  assert.match(recoverySummary(pyramid), /90 sec easy jog.*4 recoveries/);
  const distance = session('race-rhythm-5-metres', 7);
  assert.equal(mainSetSummary(distance), '6 × 200 m');
  assert.equal(specificWorkoutName(distance), '6 × 200 m 5K effort');
  assert.match(recoverySummary(distance), /2 min easy jog.*5 recoveries/);
  const cut = session('threshold-descending');
  assert.equal(cut.title, 'Cut-down tempo');
  assert.equal(mainSetSummary(cut), '4–3–2 min');
});
void test('distance recipes require a relevant explicit pace band, not the easy-pace estimate', () => {
  const t = WORKOUT_LIBRARY.find((t) => t.id === 'power-400-metres');
  assert.equal(
    scaleTemplate(t, 60, false, 'Build', 30, 30, {
      ...profile(),
      workoutTargets: { mode: 'effort' },
    }),
    null,
  );
  assert.equal(
    scaleTemplate(t, 60, false, 'Build', 30, 30, {
      ...profile(),
      workoutTargets: { mode: 'pace', pace: { easy: config.pace.easy } },
    }),
    null,
  );
  const race = WORKOUT_LIBRARY.find((t) => t.id === 'race-rhythm-5-metres');
  assert.equal(
    scaleTemplate(race, 50, false, 'Race preparation', 10, 10, {
      ...profile(),
      workoutTargets: { ...config, raceScope: '10k:' },
    }),
    null,
  );
});
void test('pyramids remain complete at small budgets, including taper', () => {
  for (const id of [
    'power-full-pyramid',
    'power-pyramid-metres',
    'marathon-pyramid',
  ]) {
    const t = WORKOUT_LIBRARY.find((t) => t.id === id);
    assert.equal(scaleTemplate(t, 20, false, 'Taper', 2, 2, profile()), null);
  }
});
void test('distance pyramids preserve metres and rounded budgets after repeated shortening', () => {
  const p = profile(),
    w = session('power-pyramid-metres', 30, p);
  const a = resizeWorkout(w, p, 'Race preparation', w.minutes - 1);
  const b = resizeWorkout(a, p, 'Race preparation', a.minutes - 1);
  assert.deepEqual(
    a.steps.filter((s) => s.kind === 'work'),
    w.steps.filter((s) => s.kind === 'work'),
  );
  assert.deepEqual(
    b.steps.filter((s) => s.kind === 'work'),
    w.steps.filter((s) => s.kind === 'work'),
  );
  assert.deepEqual(
    b.steps.filter((s) => s.metres).map((s) => s.metres),
    [200, 400, 600, 400, 200],
  );
  assert.ok(b.minutes < w.minutes);
});
void test('slower pace updates show a truthful timed alternative and preserve protected snapshots', () => {
  const p = profile(),
    w = session('power-400-metres', 30, p);
  const slower = {
    ...p,
    workoutTargets: {
      ...config,
      pace: { ...config.pace, interval: { low: 420, high: 450 } },
    },
  };
  const next = withWorkoutTargets(w, slower);
  assert.equal(next.minutes, w.minutes);
  assert.deepEqual(
    next.steps.map((s) => s.seconds),
    w.steps.map((s) => s.seconds),
  );
  assert.ok(next.steps.every((s) => s.metres === undefined));
  assert.doesNotMatch(next.title, /400/);
  assert.doesNotMatch(next.purpose, /400/);
  assert.match(next.reason, /timed alternative/);
  const plan = makePlan(p, start);
  plan.workouts.push(w);
  assert.deepEqual(
    updateWorkoutTargets(plan, slower.workoutTargets, start, [
      w.id,
    ]).workouts.at(-1),
    w,
  );
});
void test('FIT exports actual metre endings with precise pace targets and time-based recoveries', () => {
  const w = session('race-rhythm-5-metres', 7);
  const decoder = new Decoder(Stream.fromByteArray(encodeWorkout(w)));
  assert.equal(decoder.checkIntegrity(), true);
  const { messages, errors } = decoder.read();
  assert.deepEqual(errors, []);
  const steps = messages.workoutStepMesgs;
  const distance = steps.filter((s) => s.durationType === 'distance');
  assert.equal(distance.length, 6);
  assert.ok(
    distance.every(
      (s) => s.durationDistance === 200 && s.targetType === 'speed',
    ),
  );
  assert.equal(steps.filter((s) => s.intensity === 'recovery').length, 5);
});
void test('distance descriptions and exports separate exact reps from time allowances', () => {
  const p = profile(),
    w = session('race-rhythm-5-metres', 7, p);
  const plan = makePlan(p, start);
  plan.workouts = [w];
  const calendar = exportCalendar(plan, start, 1).replace(/\r\n /g, '');
  assert.match(calendar, /200 m/);
  assert.match(calendar, /planning allowance/);
  const program = exportProgram(plan);
  const row = program.weeks
    .flatMap((w) => w.days ?? [])
    .flatMap((d) => d.sessions ?? []);
  assert.ok(JSON.stringify(program).includes('Planning allowance'));
  assert.equal(row.length, 1);
  assert.match(row[0].duration_basis, /Planning allowance/);
  assert.equal(
    row[0].main_set.filter((s) => s.distance_metres === 200).length,
    6,
  );
  assert.deepEqual(
    distanceEstimate(
      w.steps.filter((s) => s.metres),
      { easyPace: null },
    ),
    {
      lowerKm: 1.2,
      upperKm: 1.2,
      basis: 'Exact distance prescribed in every step.',
    },
  );
});
for (const goal of ['5k', '10k', 'half', 'marathon'])
  void test(`${goal}: calibrated plans schedule real distance recipes without breaking constraints`, () => {
    const p = makePlan(profile(goal), start);
    assert.deepEqual(validatePlan(p), []);
    const measured = p.workouts.filter(
      (w) => w.kind !== 'race' && w.steps.some((s) => s.metres !== undefined),
    );
    assert.ok(measured.length > 0, `${goal} has measured sessions`);
    for (const w of measured) {
      assert.ok(
        w.steps.every(
          (s) =>
            s.metres === undefined ||
            (s.metres * s.planningPaceSecondsPerKm) / 1000 <= s.seconds,
        ),
      );
      assert.equal(
        w.steps.reduce((n, s) => n + s.seconds, 0),
        w.minutes * 60,
      );
    }
  });
void test('calibrated distance alternatives are selectable and preserve the schedule', () => {
  const plan = makePlan(profile(), start);
  const w = plan.workouts.find((w) =>
    workoutAlternatives(plan, w.id).some((t) => t.workMetres),
  );
  assert.ok(w);
  const t = workoutAlternatives(plan, w.id).find((t) => t.workMetres);
  const next = substituteWorkout(plan, w.id, t.id, start);
  assert.deepEqual(
    next.workouts.map((w) => w.date),
    plan.workouts.map((w) => w.date),
  );
  assert.ok(
    next.workouts.find((s) => s.id === w.id).steps.some((s) => s.metres),
  );
  assert.deepEqual(validatePlan(next), []);
});
void test('authored shape shortening retains its actual pattern instead of returning to uniform reps', () => {
  const p = profile('marathon');
  const base = session('threshold-cruise', 20, p, 60);
  const w = variedWorkoutPrescription(base, p, 'Build', 6);
  assert.ok(w.varietyVersion);
  const work = w.steps.filter((s) => s.kind === 'work');
  assert.ok(new Set(work.map((s) => s.seconds)).size > 1);
  const short = resizeWorkout(w, p, 'Build', w.minutes - 1);
  assert.deepEqual(
    short.steps.filter((s) => s.kind === 'work').map((s) => s.seconds),
    work.map((s) => s.seconds),
  );
});

void test('familiar distance taper work has finite work ceilings, even after changing target mode', () => {
  const p = profile(),
    w = session('race-rhythm-5-metres', 7, p);
  w.status = 'completed';
  const effort = { ...p, workoutTargets: { mode: 'effort' } };
  const decision = selectTemplate(effort, 'Taper', {
    previous: [w],
    availableMinutes: 45,
    slot: 0,
  });
  assert.ok(Number.isFinite(decision.targetWorkMinutes));
  const dose = scaleTemplate(
    decision.template,
    45,
    false,
    'Taper',
    3,
    decision.targetWorkMinutes,
    effort,
  );
  assert.ok(dose && dose.qualityMinutes <= 3);
  assert.ok(dose.steps.some((s) => s.metres === 200));
  assert.equal(
    scaleTemplate(decision.template, 45, false, 'Taper', 3, NaN, effort),
    null,
  );
  assert.equal(
    scaleTemplate(decision.template, 45, false, 'Taper', NaN, 3, effort),
    null,
  );
});

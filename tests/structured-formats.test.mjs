import test from 'node:test';
import assert from 'node:assert/strict';
import { Decoder, Stream } from '@garmin/fitsdk';
import {
  demoProfile,
  makePlan,
  addDays,
  validatePlan,
  refreshWorkoutVariety,
  taperFactor,
} from '../lib/engine.ts';
import {
  WORKOUT_LIBRARY,
  scaleTemplate,
  resizeWorkout,
} from '../lib/workout-library.ts';
import { withWorkoutTargets } from '../lib/workout-targets.ts';
import {
  withSpecificWorkoutName,
  mainSetSummary,
  recoverySummary,
} from '../lib/workout-names.ts';
import { workoutStepGroups } from '../lib/workout-groups.ts';
import { qualityWorkMinutes } from '../lib/prescription.ts';
import { intervalsWorkoutText } from '../lib/intervals-workout.ts';
import { encodeWorkout } from '../lib/fit.ts';
const start = '2026-09-07';
const profile = (patch = {}) => ({
  ...demoProfile(start),
  goal: 'marathon',
  intent: 'improve',
  experience: 'established',
  weeklyKm: 70,
  longestKm: 25,
  currentRuns: 5,
  runsPerWeek: 5,
  availableDays: [0, 1, 2, 3, 4, 5, 6],
  longDay: 5,
  weekdayMinutes: 120,
  longMinutes: 210,
  recentQualitySessions: 2,
  recentQualityMinutes: 40,
  qualityMode: 'automatic',
  method: 'balanced',
  raceDate: addDays(start, 139),
  easyPace: 6,
  workoutTargets: {
    mode: 'pace',
    pace: {
      easy: { low: 330, high: 390 },
      tempo: { low: 270, high: 300 },
      interval: { low: 240, high: 270 },
      race: { low: 300, high: 330 },
    },
    raceScope: 'marathon:',
  },
  ...patch,
});
function session(family, cap = 30, p = profile(), minutes = 75) {
  const t = WORKOUT_LIBRARY.find((t) => t.id === `session-${family}`);
  const dose = scaleTemplate(t, minutes, false, 'Build', cap, cap, p);
  assert.ok(dose, `${family} fits`);
  return withWorkoutTargets(
    withSpecificWorkoutName({
      id: 'synthetic-structured',
      date: addDays(start, 50),
      originalDate: addDays(start, 50),
      week: 7,
      status: 'planned',
      title: t.title,
      reason: t.purpose,
      purpose: t.purpose,
      kind: t.kind,
      stimulus: t.stimulus,
      templateId: t.id,
      hard: true,
      estimatedKm: dose.minutes / 6,
      ...dose,
    }),
    p,
  );
}
const work = (w) =>
  w.steps.filter((s) => s.kind === 'work' && s.intensity >= 4);
function expand(groups) {
  return groups.flatMap((g) => {
    if (g.repetitions === 1) return [g.work];
    return Array.from({ length: g.repetitions }, (_, i) => [
      g.work,
      ...(g.reset && (i < g.repetitions - 1 || g.resetAfterLast)
        ? [g.reset]
        : []),
    ]).flat();
  });
}
const semantic = (s) => [
  s.kind,
  s.seconds,
  s.metres,
  s.intensity,
  s.movement,
  s.effort,
  s.target,
];

void test('two sets retain equal complete repetition counts and additive inter-set rest', () => {
  const w = session('split-repeats-metres', 16);
  assert.equal(work(w).length, 6);
  assert.equal(
    work(w).reduce((n, s) => n + s.metres, 0),
    2400,
  );
  assert.equal(w.steps.filter((s) => s.kind === 'recovery').length, 6);
  assert.ok(
    w.steps
      .filter((s) => s.kind === 'recovery')
      .every((s) => s.movement === 'walk' && !s.target),
  );
  assert.equal(mainSetSummary(w), '2 × (3 × 400 m)');
  assert.match(recoverySummary(w), /60 sec|1 min/);
  assert.match(recoverySummary(w), /extra walking/);
  const boundary = w.steps.findIndex(
    (s) => s.label === 'Extra recovery between sets',
  );
  assert.equal(w.steps[boundary - 1].kind, 'recovery');
  assert.equal(w.steps[boundary - 1].seconds + w.steps[boundary].seconds, 120);
  assert.equal(w.steps.at(-2).kind, 'work');
});
void test('shortening sets twice preserves both sets, renames counts and avoids beginner fallback', () => {
  const p = profile(),
    original = session('split-repeats-metres', 30, p);
  const a = resizeWorkout(original, p, 'Build', 40, 11);
  const b = resizeWorkout(a, p, 'Build', 32, 11);
  assert.equal(work(a).length, 4);
  assert.equal(work(b).length, 4);
  assert.equal(mainSetSummary(b), '2 × (2 × 400 m)');
  assert.ok(
    b.steps
      .filter((s) => s.kind === 'recovery')
      .every((s) => s.movement === 'walk'),
  );
  const easy = resizeWorkout(b, p, 'Build', 20, 2);
  assert.equal(easy.kind, 'easy');
  assert.equal(easy.qualityMinutes, 0);
  assert.ok(easy.steps.every((s) => s.movement !== 'walk'));
  assert.doesNotMatch(easy.title, /400|walk/);
});
void test('mixed 600m into200m prescriptions are complete and never falsely named after truncation', () => {
  const w = session('long-into-short-metres', 15);
  assert.deepEqual(
    work(w).map((s) => s.metres),
    [600, 600, 200, 200],
  );
  assert.equal(w.title, '600 m into 200 m');
  assert.equal(mainSetSummary(w), '2 × 600 m + 2 × 200 m');
  const short = resizeWorkout(w, profile(), 'Build', 25, 6);
  assert.equal(short.kind, 'easy');
  assert.doesNotMatch(short.title, /600|200/);
});
void test('alternating kilometre floats are genuinely easy, including after the last work block', () => {
  const w = session('on-off-metres', 14);
  const floats = w.steps.filter((s) => s.label === 'Easy off block');
  assert.equal(work(w).length, 2);
  assert.equal(floats.length, 2);
  assert.ok(
    floats.every(
      (s) => s.kind === 'aerobic' && s.intensity === 3 && s.metres === 1000,
    ),
  );
  assert.ok(floats.every((s) => s.target.low === 330 && s.target.high === 390));
  assert.ok(
    work(w).every((s) => s.target.low === 270 && s.target.high === 300),
  );
  assert.equal(
    qualityWorkMinutes(w),
    work(w).reduce((n, s) => n + s.seconds, 0) / 60,
  );
  assert.equal(w.steps.at(-2).label, 'Easy off block');
  assert.equal(mainSetSummary(w), '2 × (1 km tempo + 1 km easy)');
});
for (const family of [
  'split-repeats-metres',
  'long-into-short-metres',
  'on-off-metres',
  'long-tempo-metres',
  'tempo-cut-down-timed',
])
  void test(`${family}: grouped presentation expands to the exact executable chronology`, () => {
    const w = session(family);
    const before = JSON.stringify(w.steps);
    assert.deepEqual(
      expand(workoutStepGroups(w.steps)).map(semantic),
      w.steps.map(semantic),
    );
    assert.equal(JSON.stringify(w.steps), before);
    assert.equal(
      w.minutes * 60,
      w.steps.reduce((n, s) => n + s.seconds, 0),
    );
    const decoded = new Decoder(Stream.fromByteArray(encodeWorkout(w))).read();
    assert.deepEqual(decoded.errors, []);
    assert.equal(decoded.messages.workoutStepMesgs.length, w.steps.length);
    decoded.messages.workoutStepMesgs.forEach((s, i) => {
      assert.equal(s.durationType, w.steps[i].metres ? 'distance' : 'time');
      assert.equal(
        w.steps[i].metres ? s.durationDistance : s.durationTime,
        w.steps[i].metres ?? w.steps[i].seconds,
      );
    });
    const lines = intervalsWorkoutText(w).split('\n');
    assert.equal(lines.length, w.steps.length);
    w.steps.forEach((s, i) =>
      assert.ok(
        lines[i].includes(s.metres ? `${s.metres}mtr` : `${s.seconds}s`),
      ),
    );
  });
void test('tempo distance steps support supplied HR, short intervals and walking recoveries stay on effort', () => {
  const config = {
    mode: 'heart-rate',
    heartRate: {
      easy: { low: 120, high: 140 },
      tempo: { low: 155, high: 168 },
      interval: { low: 170, high: 180 },
    },
  };
  const p = profile({ workoutTargets: config });
  const tempo = withWorkoutTargets(session('long-tempo-metres'), p);
  assert.ok(
    work(tempo).every(
      (s) => s.target?.mode === 'heart-rate' && s.target.low === 155,
    ),
  );
  const speed = withWorkoutTargets(session('split-repeats-metres'), p);
  assert.ok(work(speed).every((s) => !s.target));
  assert.ok(
    speed.steps.filter((s) => s.movement === 'walk').every((s) => !s.target),
  );
  assert.throws(() => intervalsWorkoutText(tempo), /Direct BPM/);
  assert.ok(encodeWorkout(tempo).length > 0);
});
void test('slower easy target converts alternating distance pairs together into truthful timed steps', () => {
  const w = session('on-off-metres');
  const p = profile();
  p.workoutTargets.pace.easy = { low: 500, high: 540 };
  const next = withWorkoutTargets(w, p);
  assert.ok(next.steps.every((s) => !s.metres));
  assert.equal(next.title, 'Tempo on / off');
  assert.doesNotMatch(mainSetSummary(next), /km/);
  assert.equal(
    next.steps.filter((s) => s.label === 'Easy off block').length,
    work(next).length,
  );
  assert.deepEqual(
    next.steps.map((s) => s.seconds),
    w.steps.map((s) => s.seconds),
  );
});
for (const mode of ['effort', 'pace', 'heart-rate'])
  for (const days of [4, 5, 6])
    void test(`${days} days, ${mode}: genuine marathon speed is scheduled within classic frequency and workload`, () => {
      const p = profile({ currentRuns: days, runsPerWeek: days });
      if (mode === 'effort') p.workoutTargets = { mode };
      if (mode === 'heart-rate')
        p.workoutTargets = {
          mode,
          heartRate: {
            easy: { low: 120, high: 140 },
            tempo: { low: 155, high: 168 },
          },
        };
      const plan = makePlan(p, start);
      assert.deepEqual(validatePlan(plan), []);
      const speed = plan.workouts.filter((w) => w.stimulus === 'aerobic-power');
      assert.ok(speed.length >= (days === 4 ? 1 : 2));
      assert.ok(
        speed.every((w) =>
          ['Race preparation', 'Taper'].includes(plan.weeks[w.week].phase),
        ),
      );
      assert.ok(speed.every((w) => w.qualityMinutes <= 24));
      if (mode !== 'pace')
        assert.ok(speed.every((w) => work(w).every((s) => !s.metres)));
      for (const week of plan.weeks) {
        const runs = plan.workouts.filter(
          (w) => w.week === week.index && w.kind !== 'race',
        );
        assert.ok(new Set(runs.map((w) => w.date)).size <= days);
        assert.ok(runs.filter((w) => w.hard).length <= 1);
        assert.ok(
          runs.reduce((n, w) => n + qualityWorkMinutes(w), 0) <=
            runs.reduce((n, w) => n + w.minutes, 0) * 0.22 + 0.1,
        );
        if (days > 4 && runs.some((w) => w.stimulus === 'aerobic-power'))
          assert.ok(!runs.some((w) => w.stimulus === 'race-rhythm'));
      }
      assert.ok(
        plan.workouts
          .filter((w) => w.kind !== 'race' && taperFactor(p, w.date) < 1)
          .every(
            (w) =>
              w.stimulus !== 'aerobic-power' ||
              speed.some(
                (old) =>
                  old.date < w.date &&
                  taperFactor(p, old.date) === 1 &&
                  qualityWorkMinutes(old) > qualityWorkMinutes(w),
              ),
          ),
      );
    });
for (const patch of [
  { intent: 'finish' },
  { difficulty: 'gentle' },
  { marathonApproach: 'endurance' },
])
  void test(`${JSON.stringify(patch)} keeps conservative marathon selection`, () => {
    const plan = makePlan(profile(patch), start);
    assert.ok(plan.workouts.every((w) => w.stimulus !== 'aerobic-power'));
    if (!patch.marathonApproach)
      assert.ok(
        plan.workouts.every((w) => !w.templateId?.startsWith('session-')),
      );
  });
void test('refresh preserves completed, past, edited and provider-protected session snapshots', () => {
  const plan = makePlan(profile(), start);
  const sessions = plan.workouts.filter(
    (w) => w.hard && w.templateId?.startsWith('marathon-book-'),
  );
  assert.ok(sessions.length >= 4);
  sessions[0].status = 'completed';
  sessions[1].changed = true;
  sessions[1].changeSource = 'manual';
  const protectedIds = [sessions[2].id];
  const next = refreshWorkoutVariety(plan, sessions[0].date, protectedIds);
  for (const w of sessions.slice(0, 3))
    assert.deepEqual(
      next.workouts.find((s) => s.id === w.id),
      w,
    );
});

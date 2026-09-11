import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makePlan,
  demoProfile,
  addDays,
  refreshWorkoutVariety,
  validatePlan,
} from '../lib/engine.ts';
import { qualityWorkMinutes } from '../lib/prescription.ts';
import {
  WORKOUT_LIBRARY,
  scaleTemplate,
  variedWorkoutPrescription,
} from '../lib/workout-library.ts';
const start = '2026-09-07';
const profile = (goal = 'marathon') => ({
  ...demoProfile(start),
  goal,
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
});
const signature = (w) =>
  w.steps
    .filter((s) => ['work', 'recovery'].includes(s.kind))
    .map((s) => `${s.kind}:${s.seconds}:${s.intensity}`)
    .join('|');
const eligible = (p, w) =>
  ['Foundation', 'Build', 'Race preparation'].includes(
    p.weeks[w.week]?.phase,
  ) &&
  ['threshold', 'aerobic-power', 'race-rhythm'].includes(w.stimulus) &&
  w.kind !== 'long';
function legacyPlan() {
  const plan = makePlan(profile(), start);
  for (const workout of plan.workouts.filter((w) => eligible(plan, w))) {
    const template = WORKOUT_LIBRARY.find(
      (t) =>
        t.id ===
        (workout.stimulus === 'threshold'
          ? 'threshold-cruise'
          : 'marathon-steady'),
    );
    const dose = scaleTemplate(
      template,
      workout.minutes,
      false,
      plan.weeks[workout.week].phase,
      qualityWorkMinutes(workout),
      qualityWorkMinutes(workout),
    );
    if (dose) {
      const extra = Math.round((workout.minutes - dose.minutes) * 60);
      if (extra) dose.steps.find((s) => s.kind === 'aerobic').seconds += extra;
      Object.assign(workout, {
        templateId: template.id,
        title: template.title,
        steps: dose.steps,
        qualityMinutes: dose.qualityMinutes,
        targetWorkMinutes: dose.qualityMinutes,
      });
    }
    delete workout.varietyVersion;
  }
  return plan;
}
for (const goal of ['5k', '10k', 'half', 'marathon'])
  void test(`${goal}: build weeks vary complete prescriptions within a stable schedule`, () => {
    const plan = makePlan(profile(goal), start);
    assert.deepEqual(validatePlan(plan), []);
    const work = plan.workouts.filter((w) => eligible(plan, w));
    assert.ok(
      work.filter((w) =>
        goal === 'marathon'
          ? w.templateId?.startsWith('marathon-book-')
          : w.varietyVersion,
      ).length >= 3,
    );
    const threshold = work.filter((w) => w.stimulus === 'threshold');
    assert.ok(new Set(threshold.map(signature)).size >= 3);
    // Consecutive weeks may now alternate tempo and genuine speed roles.
    const consecutive = work.filter(
      (w) => plan.weeks[w.week].phase === 'Build',
    );
    assert.ok(
      consecutive.some(
        (w, i) =>
          i &&
          w.week === consecutive[i - 1].week + 1 &&
          signature(w) !== signature(consecutive[i - 1]),
      ),
    );
    for (const workout of work.filter((w) => w.varietyVersion)) {
      const template = WORKOUT_LIBRARY.find((t) => t.id === workout.templateId);
      assert.ok(template.goals.includes(goal));
      assert.ok(template.phases.includes(plan.weeks[workout.week].phase));
      if (template.workSeconds.length > 1)
        assert.deepEqual(
          workout.steps.filter((s) => s.kind === 'work').map((s) => s.seconds),
          template.workSeconds,
        );
    }
    for (const workout of plan.workouts.filter(
      (w) =>
        ['Taper', 'Race week'].includes(plan.weeks[w.week]?.phase) &&
        w.templateId,
    )) {
      assert.ok(
        plan.workouts.some(
          (old) =>
            old.date < workout.date &&
            (goal === 'marathon'
              ? old.stimulus === workout.stimulus
              : old.templateId === workout.templateId),
        ),
      );
      assert.equal(workout.varietyVersion, undefined);
    }
  });
void test('existing refresh is pure, deterministic, idempotent and cannot raise workload', () => {
  const before = legacyPlan(),
    snapshot = structuredClone(before),
    from = addDays(start, 14);
  const after = refreshWorkoutVariety(before, from);
  assert.deepEqual(before, snapshot);
  assert.deepEqual(refreshWorkoutVariety(before, from), after);
  assert.deepEqual(refreshWorkoutVariety(after, from), after);
  assert.ok(after.workouts.filter((w) => w.varietyVersion).length >= 5);
  for (let i = 0; i < before.workouts.length; i++) {
    const a = before.workouts[i],
      b = after.workouts[i];
    for (const key of [
      'id',
      'date',
      'originalDate',
      'week',
      'minutes',
      'estimatedKm',
      'status',
      'hard',
    ])
      assert.deepEqual(b[key], a[key]);
    assert.ok(qualityWorkMinutes(b) <= qualityWorkMinutes(a) + 1e-6);
    const originalRecovery = a.steps.filter((s) => s.kind === 'recovery'),
      variedRecovery = b.steps.filter((s) => s.kind === 'recovery');
    assert.ok(variedRecovery.length >= originalRecovery.length);
    if (originalRecovery.length && variedRecovery.length)
      assert.ok(
        Math.min(...variedRecovery.map((s) => s.seconds)) >=
          Math.min(...originalRecovery.map((s) => s.seconds)),
      );
    assert.ok(
      Math.max(
        0,
        ...b.steps.filter((s) => s.kind === 'work').map((s) => s.seconds),
      ) <=
        Math.max(
          0,
          ...a.steps.filter((s) => s.kind === 'work').map((s) => s.seconds),
        ),
    );
    assert.equal(
      b.steps.reduce((n, s) => n + s.seconds, 0),
      b.minutes * 60,
    );
    assert.ok(
      Math.max(...b.steps.map((s) => s.intensity)) <=
        Math.max(...a.steps.map((s) => s.intensity)),
    );
    if (!b.varietyVersion || !eligible(before, a) || a.date < from)
      assert.deepEqual(b, a);
  }
  for (const week of before.weeks) {
    const sum = (p) =>
      p.workouts
        .filter((w) => w.week === week.index)
        .reduce((n, w) => n + qualityWorkMinutes(w), 0);
    assert.ok(sum(after) <= sum(before) + 1e-6);
  }
  assert.deepEqual(validatePlan(after), []);
});
void test('past, completed, skipped, manually edited and delivery-protected sessions remain identical', () => {
  const before = legacyPlan(),
    runs = before.workouts.filter((w) => eligible(before, w) && w.week > 3);
  runs[0].status = 'completed';
  runs[1].status = 'skipped';
  runs[2].changed = true;
  runs[2].changeSource = 'manual';
  runs[3].changed = true;
  delete runs[3].changeSource;
  const protectedIds = [runs[4].id, runs[5].id],
    from = addDays(start, 7);
  const after = refreshWorkoutVariety(before, from, protectedIds);
  for (const original of [
    ...runs.slice(0, 6),
    ...before.workouts.filter((w) => w.date < from),
  ])
    assert.deepEqual(
      after.workouts.find((w) => w.id === original.id),
      original,
    );
  assert.ok(
    after.workouts.some(
      (w) => w.varietyVersion || w.templateId?.startsWith('marathon-book-'),
    ),
  );
  assert.deepEqual(refreshWorkoutVariety(after, from, protectedIds), after);
});
void test('beginner, return, finish, ultra and advanced methods keep their programming', () => {
  for (const patch of [
    { experience: 'new' },
    { experience: 'returning' },
    { intent: 'finish' },
    { goal: 'ultra', raceDistanceKm: 100 },
    { method: 'threshold-singles' },
    { method: 'double-threshold' },
  ]) {
    const plan = legacyPlan();
    Object.assign(plan.profile, patch);
    assert.deepEqual(refreshWorkoutVariety(plan, start), plan);
  }
  const plan = legacyPlan();
  plan.returnState = { stage: 1 };
  assert.deepEqual(refreshWorkoutVariety(plan, start), plan);
});
void test('undersized budgets keep the original recipe and pyramids are never truncated', () => {
  const plan = legacyPlan(),
    original = plan.workouts.find((w) => w.stimulus === 'threshold');
  const tiny = structuredClone(original),
    effort = tiny.steps.find((s) => s.kind === 'work');
  tiny.steps = [{ ...effort, seconds: 240 }];
  tiny.minutes = 4;
  assert.deepEqual(
    variedWorkoutPrescription(tiny, profile(), 'Build', 4),
    tiny,
  );
  for (let exposure = 2; exposure < 15; exposure++) {
    const changed = variedWorkoutPrescription(
      original,
      profile(),
      'Build',
      exposure,
    );
    const template = WORKOUT_LIBRARY.find((t) => t.id === changed.templateId);
    if (template.workSeconds.length > 1)
      assert.deepEqual(
        changed.steps.filter((s) => s.kind === 'work').map((s) => s.seconds),
        template.workSeconds,
      );
  }
});
void test('additional patterns use runnable whole or half minutes, keeping at least three quarters of work', () => {
  const before = legacyPlan(),
    next = refreshWorkoutVariety(before, addDays(start, 14));
  const changes = next.workouts.filter((w) => w.varietyVersion);
  assert.ok(changes.length);
  for (const w of changes) {
    const old = before.workouts.find((s) => s.id === w.id);
    assert.ok(
      w.steps
        .filter((s) => s.kind === 'work')
        .every((s) => s.seconds % 30 === 0),
    );
    assert.ok(qualityWorkMinutes(w) >= qualityWorkMinutes(old) * 0.75);
  }
});

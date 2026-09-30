import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, demoProfile, makePlan, validatePlan } from '../lib/engine.ts';
import {
  assertNoPacingPreferenceChange,
  paceReviewFingerprint,
  preparePaceReview,
  qualityReadinessReview,
  validatePacingEvidence,
} from '../lib/pacing-review.ts';
import { qualityWorkMinutes } from '../lib/prescription.ts';
import {
  validReviewedQualityProvenance,
  reviewedQualityMinutes,
} from '../lib/pace-review-eligibility.ts';
import { validateRecovery } from '../lib/recovery.ts';

const start = '2026-05-04';
const benchmark = {
  distanceKm: 5,
  timeMinutes: 30,
  date: start,
  source: 'race',
  course: 'road',
};
function foundation(patch = {}) {
  return makePlan(
    {
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
      raceDate: addDays(start, 83),
      ...patch,
    },
    start,
  );
}

test('pace evidence accepts an omitted patch, explicit clear, and valid dated results only', () => {
  assert.equal(validatePacingEvidence(undefined, start), undefined);
  assert.deepEqual(validatePacingEvidence({}, start), {});
  assert.deepEqual(validatePacingEvidence({ recentRace: null }, start), {
    recentRace: null,
  });
  assert.deepEqual(validatePacingEvidence({ recentRace: benchmark }, start), {
    recentRace: benchmark,
  });
  for (const invalid of [
    null,
    [],
    0,
    { weeklyKm: 100 },
    { recentRace: {} },
    { recentRace: { ...benchmark, date: addDays(start, 1) } },
    { recentRace: { ...benchmark, distanceKm: '5' } },
  ])
    assert.throws(() => validatePacingEvidence(invalid, start));
});

test('automatic beginner preference remains distinct from explicit zero after benchmark and calendar changes', () => {
  const plan = foundation();
  const initial = qualityReadinessReview(plan, start);
  assert.equal(initial.preference, 'automatic');
  assert.equal(initial.requestedSessions, null);
  assert.equal(initial.status, 'foundation');
  const preview = preparePaceReview(
    plan,
    { mode: 'automatic' },
    { recentRace: benchmark },
    start,
  );
  assert.deepEqual(plan.profile.recentRace, undefined);
  assert.deepEqual(preview.plan.profile.recentRace, benchmark);
  assert.equal(preview.plan.profile.qualityMode, 'automatic');
  assert.equal(
    preview.plan.profile.qualitySessions,
    plan.profile.qualitySessions,
  );
  assert.equal(preview.qualityReview.status, 'foundation');
  assert.equal(
    qualityReadinessReview(preview.plan, addDays(start, 100)).status,
    'foundation',
  );
  assert.ok(
    preview.plan.workouts.every(
      (w) => !w.hard && !w.steps.some((s) => s.target),
    ),
  );
  assert.deepEqual(validatePlan(preview.plan), []);
  const optOut = qualityReadinessReview(
    foundation({ qualityMode: 'custom', qualitySessions: 0 }),
    start,
  );
  assert.equal(optOut.preference, 'custom');
  assert.equal(optOut.status, 'explicit-opt-out');
  assert.equal(optOut.requestedSessions, 0);
  // Imported legacy courses can retain a nonzero custom preference even though
  // new course creation correctly requires easy-only or automatic structure.
  const legacy = structuredClone(plan);
  legacy.profile.qualityMode = 'custom';
  legacy.profile.qualitySessions = 2;
  const requested = qualityReadinessReview(legacy, start);
  assert.equal(requested.preference, 'custom');
  assert.equal(requested.requestedSessions, 2);
  assert.equal(requested.status, 'foundation');
  assert.match(requested.message, /preference remains saved/);
  assert.doesNotMatch(requested.message, /Automatic progression/);
});

test('completing foundation offers an honest programme review rather than fabricated eligibility', () => {
  const plan = foundation();
  plan.beginner.stage = 8;
  plan.beginner.completedAt = addDays(start, 63);
  const review = qualityReadinessReview(plan, addDays(start, 64));
  assert.equal(review.status, 'review-required');
  assert.equal(review.automaticTransition, false);
  assert.ok(review.nextSteps.some((s) => /entry requirements/.test(s)));
  assert.ok(review.nextSteps.some((s) => /No automatic/.test(s)));
  assert.equal(plan.profile.qualityMode, 'automatic');
});

test('first-race courses retain automatic preference without silently introducing quality', () => {
  for (const [goal, weeklyKm, longestKm, runs, weeks] of [
    ['5k', 12, 4, 3, 8],
    ['10k', 18, 6, 3, 8],
    ['half', 30, 8, 4, 12],
    ['marathon', 40, 12, 4, 18],
  ]) {
    const plan = makePlan(
      {
        ...demoProfile(start),
        goal,
        planLevel: 'beginner',
        experience: 'new',
        weeklyKm,
        longestKm,
        currentRuns: runs,
        runsPerWeek: runs,
        days: runs === 3 ? [0, 2, 5] : [0, 2, 4, 6],
        availableDays: undefined,
        longDay: runs === 3 ? 5 : 6,
        qualityMode: 'automatic',
        weekdayMinutes: 120,
        longMinutes: 300,
        raceDate: addDays(start, weeks * 7 - 1),
      },
      start,
    );
    const review = qualityReadinessReview(plan, start);
    assert.equal(review.preference, 'automatic', goal);
    assert.equal(review.status, 'review-required', goal);
    assert.equal(review.automaticTransition, false, goal);
    assert.ok(
      plan.workouts.every((w) => w.kind === 'race' || !w.hard),
      goal,
    );
  }
});

test('a result edit cannot enter the schedule preference rebuild path', () => {
  const profile = foundation().profile;
  assert.doesNotThrow(() =>
    assertNoPacingPreferenceChange(profile, { volume: 'maintain' }, start),
  );
  assert.doesNotThrow(() =>
    assertNoPacingPreferenceChange(profile, { recentRace: null }, start),
  );
  assert.throws(
    () =>
      assertNoPacingPreferenceChange(profile, { recentRace: benchmark }, start),
    /Training paces/,
  );
  const withResult = { ...profile, recentRace: benchmark };
  assert.doesNotThrow(() =>
    assertNoPacingPreferenceChange(
      withResult,
      { recentRace: benchmark },
      start,
    ),
  );
  assert.throws(
    () =>
      assertNoPacingPreferenceChange(withResult, { recentRace: null }, start),
    /Training paces/,
  );
});

test('pace fingerprints are independent of receipt order but change for new delivery protection', async () => {
  const plan = foundation();
  const a = await paceReviewFingerprint(plan, start, ['a', 'b']);
  assert.equal(a, await paceReviewFingerprint(plan, start, ['b', 'a', 'a']));
  assert.notEqual(a, await paceReviewFingerprint(plan, start, ['a', 'b', 'c']));
  assert.notEqual(
    a,
    await paceReviewFingerprint(plan, addDays(start, 1), ['a', 'b']),
  );
});

function fasterDistanceReview() {
  const original = makePlan(
    {
      ...demoProfile(start),
      goal: '5k',
      weeklyKm: 24,
      longestKm: 8,
      currentRuns: 4,
      days: [0, 2, 4, 6],
      availableDays: [0, 2, 4, 6],
      runsPerWeek: 4,
      longDay: 6,
      experience: 'established',
      planLevel: 'standard',
      intent: 'improve',
      qualityMode: 'custom',
      qualitySessions: 1,
      recentQualitySessions: 1,
      weekdayMinutes: 120,
      longMinutes: 300,
      raceDate: addDays(start, 139),
      easyPace: null,
      recentRace: { ...benchmark, timeMinutes: 25, representative: true },
      runMeasure: 'time',
    },
    start,
  );
  assert.deepEqual(
    validatePlan(original),
    [],
    'The original generated plan must already be valid',
  );
  const next = preparePaceReview(
    original,
    null,
    {
      recentRace: { ...benchmark, timeMinutes: 24, representative: true },
    },
    start,
  ).plan;
  return { original, next };
}

test('faster reviewed distance repetitions retain their complete session eligibility without inflating actual load', () => {
  const { original, next } = fasterDistanceReview();
  const retained = next.workouts.filter((w) => w.paceReviewEligibility);
  assert.ok(
    retained.length > 0,
    'Exercise real repetitions crossing the six-minute classification boundary',
  );
  const endpoints = (w) =>
    w.steps.map((step) => ({
      kind: step.kind,
      intensity: step.intensity,
      movement: step.movement,
      metres: step.metres,
      seconds: step.metres === undefined ? step.seconds : undefined,
    }));
  for (const workout of retained) {
    const old = original.workouts.find((w) => w.id === workout.id);
    assert.ok(qualityWorkMinutes(old) >= 6 - 1e-6);
    assert.ok(qualityWorkMinutes(workout) < 6);
    assert.equal(workout.qualityMinutes, qualityWorkMinutes(workout));
    assert.equal(reviewedQualityMinutes(workout), qualityWorkMinutes(old));
    assert.deepEqual(endpoints(workout), endpoints(old));
    assert.equal(workout.kind, old.kind);
    assert.equal(workout.date, old.date);
    const reordered = structuredClone(workout);
    for (const step of reordered.paceReviewEligibility.steps)
      if (step.paceInstruction)
        step.paceInstruction = Object.fromEntries(
          Object.entries(step.paceInstruction).reverse(),
        );
    assert.equal(validReviewedQualityProvenance(reordered), true);
  }
  assert.deepEqual(validatePlan(next), []);
  assert.deepEqual(validatePlan(JSON.parse(JSON.stringify(next))), []);
  const file = {
    format: 'stride-recovery-2',
    exportedAt: start + 'T12:00:00Z',
    profile: null,
    plan: next,
  };
  assert.doesNotThrow(() => validateRecovery(JSON.parse(JSON.stringify(file))));
  const again = preparePaceReview(
    next,
    null,
    {
      recentRace: { ...benchmark, timeMinutes: 23, representative: true },
    },
    start,
  ).plan;
  for (const workout of retained)
    assert.deepEqual(
      again.workouts.find((w) => w.id === workout.id).paceReviewEligibility,
      workout.paceReviewEligibility,
    );
  assert.deepEqual(validatePlan(again), []);
});

test('reviewed eligibility rejects missing or altered bouts, recovery changes and fabricated original time allowances', () => {
  const { next } = fasterDistanceReview();
  const original = next.workouts.find((w) => w.paceReviewEligibility);
  const mutations = [
    (w) => {
      w.steps.splice(
        w.steps.findIndex((s) => s.kind === 'work'),
        1,
      );
    },
    (w) => {
      w.steps.find((s) => s.kind === 'work').metres /= 2;
    },
    (w) => {
      w.steps.find((s) => s.kind === 'work').intensity = 3;
    },
    (w) => {
      w.steps.find((s) => s.kind === 'work').movement = 'walk';
    },
    (w) => {
      w.steps.find((s) => s.kind === 'recovery').seconds += 5;
    },
    (w) => {
      w.paceReviewEligibility.version = 'invented';
    },
    (w) => {
      w.paceReviewEligibility.steps = structuredClone(w.steps);
      for (const step of w.paceReviewEligibility.steps)
        if (step.kind === 'work') step.seconds += 600;
    },
    (w) => {
      w.paceReviewEligibility.steps.find((s) => s.kind === 'work').target.high =
        1201;
    },
  ];
  for (const mutate of mutations) {
    const plan = structuredClone(next);
    const workout = plan.workouts.find((w) => w.id === original.id);
    mutate(workout);
    assert.equal(validReviewedQualityProvenance(workout), false);
    assert.equal(reviewedQualityMinutes(workout), undefined);
    assert.ok(
      validatePlan(plan).some((error) =>
        /Invalid saved quality eligibility/.test(error),
      ),
    );
    assert.throws(() =>
      validateRecovery({
        format: 'stride-recovery-2',
        exportedAt: start + 'T12:00:00Z',
        profile: null,
        plan,
      }),
    );
  }
  const missing = structuredClone(next);
  missing.workouts = missing.workouts.filter((w) => w.id !== original.id);
  assert.ok(
    validatePlan(missing).some((error) =>
      /retain all|exactly.*weekday/.test(error),
    ),
  );
});

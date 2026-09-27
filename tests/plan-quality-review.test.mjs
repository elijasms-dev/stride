import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, makePlan, revisePreferences } from '../lib/engine.ts';
import { validateRecovery, prepareRestoredPlan } from '../lib/recovery.ts';
import {
  auditPlanQuality,
  planQualityCases,
  qualitySignature,
} from '../scripts/audit-plan-quality.mjs';

for (const c of planQualityCases(false)) {
  void test(`${c.id}: the reviewed example has readable long/easy contrast, coherent progression and varied actual work`, () => {
    const plan = makePlan(c.input, c.input.startDate, false);
    assert.equal(
      plan.profile.weeklyKm,
      c.input.weeklyKm,
      'The reported baseline remains recorded history, even when the forecast is reduced',
    );
    assert.equal(plan.profile.longestKm, c.input.longestKm);
    const quality = auditPlanQuality(plan);
    assert.deepEqual(quality.issues, [], JSON.stringify(quality.issues));
    assert.equal(
      quality.opening.actualLongKm,
      c.input.longestKm,
      'Retain the familiar opening long run instead of extending it just to balance the easy days',
    );
    assert.ok(quality.opening.actualWeeklyKm <= c.input.weeklyKm + 0.001);
    if (c.input.qualitySessions === 0)
      assert.ok(
        plan.workouts.filter((w) => w.kind !== 'race').every((w) => !w.hard),
        'Do not manufacture intensity for variety',
      );
  });
}

void test('variety comparison ignores cosmetic names and aerobic padding but detects actual main-set and recovery changes', () => {
  const workout = {
    title: 'Synthetic controlled repetitions',
    steps: [
      { kind: 'warmup', seconds: 600, intensity: 2, effortRole: 'easy' },
      { kind: 'work', seconds: 240, intensity: 6, effortRole: 'threshold' },
      { kind: 'recovery', seconds: 90, intensity: 2, effortRole: 'easy' },
      { kind: 'work', seconds: 240, intensity: 6, effortRole: 'threshold' },
      { kind: 'cooldown', seconds: 600, intensity: 2, effortRole: 'easy' },
    ],
  };
  const renamed = structuredClone(workout);
  renamed.title = 'A completely different marketing name';
  renamed.steps[0].seconds += 300;
  renamed.steps[1].label = 'Renamed work';
  renamed.steps[1].target = { mode: 'pace', low: 280, high: 300 };
  renamed.steps.splice(1, 0, {
    kind: 'aerobic',
    seconds: 1200,
    intensity: 3,
    effortRole: 'easy',
  });
  assert.equal(qualitySignature(renamed), qualitySignature(workout));
  const recovery = structuredClone(workout);
  recovery.steps[2].seconds = 60;
  assert.notEqual(qualitySignature(recovery), qualitySignature(workout));
  const progressed = structuredClone(workout);
  progressed.steps[1].seconds = 300;
  assert.notEqual(qualitySignature(progressed), qualitySignature(workout));
});

void test('independent accounting rejects NaN and serialized null instead of letting numerical comparisons silently pass', () => {
  const c = planQualityCases(false)[0];
  const plan = makePlan(c.input, c.input.startDate, false);
  plan.weeks[0].targetKm = Number.NaN;
  plan.workouts[0].minutes = Number.NaN;
  for (const candidate of [plan, JSON.parse(JSON.stringify(plan))]) {
    const issues = auditPlanQuality(candidate).issues;
    assert.ok(issues.some((issue) => issue.type === 'non-finite-accounting'));
    assert.ok(issues.some((issue) => issue.type === 'non-finite-prescription'));
  }
});

void test('recovery preserves the disclosed opening allocation while rejecting invalid balance metadata', () => {
  const c = planQualityCases(false).find((item) => item.id === '5k-q0');
  const plan = makePlan(c.input, c.input.startDate, false);
  assert.ok(plan.openingWeekKm < plan.profile.weeklyKm);
  const snapshot = (p) =>
    JSON.parse(
      JSON.stringify({
        format: 'stride-recovery-2',
        exportedAt: '2026-09-25T12:00:00Z',
        profile: null,
        plan: p,
        standaloneRuns: [],
      }),
    );
  const recovered = prepareRestoredPlan(validateRecovery(snapshot(plan)).plan);
  assert.equal(recovered.openingWeekKm, plan.openingWeekKm);
  assert.equal(recovered.sessionBalanceVersion, plan.sessionBalanceVersion);
  assert.deepEqual(recovered.profile, plan.profile);
  assert.deepEqual(
    recovered.workouts.map((w) => [w.date, w.minutes, w.estimatedKm, w.steps]),
    plan.workouts.map((w) => [w.date, w.minutes, w.estimatedKm, w.steps]),
  );
  assert.deepEqual(auditPlanQuality(recovered).issues, []);
  const invalid = structuredClone(plan);
  invalid.openingWeekKm = plan.profile.weeklyKm + 1;
  assert.throws(
    () => validateRecovery(snapshot(invalid)),
    /invalid opening weekly allocation/,
  );
  invalid.openingWeekKm = plan.openingWeekKm;
  invalid.sessionBalanceVersion = 'unrecognized-balance-version';
  assert.throws(
    () => validateRecovery(snapshot(invalid)),
    /unknown easy\/long-run balance policy/,
  );
});

void test('the marathon medium-long exception remains visibly distinct, unique and bounded; road labels never receive it', () => {
  const c = planQualityCases(false).find((item) => item.id === 'marathon-q0');
  const plan = makePlan(c.input, c.input.startDate, false);
  const endurance = plan.workouts.find((w) => w.role === 'medium-long');
  const long = plan.workouts.find(
    (w) => w.week === endurance.week && w.kind === 'long',
  );
  assert.ok(endurance && long);
  const issuesFor = (change) => {
    const candidate = structuredClone(plan);
    change(
      candidate,
      candidate.workouts.find((w) => w.id === endurance.id),
    );
    return auditPlanQuality(candidate).issues;
  };
  assert.ok(
    issuesFor((_, w) => {
      w.title = 'Easy run';
    }).some((issue) => issue.type === 'medium-long-label'),
  );
  assert.ok(
    issuesFor((_, w) => {
      w.estimatedKm = long.estimatedKm * 0.91;
    }).some((issue) => issue.type === 'medium-long-hierarchy'),
  );
  assert.ok(
    issuesFor((p, w) => {
      const second = p.workouts.find(
        (run) => run.week === w.week && run.kind === 'easy' && run.id !== w.id,
      );
      second.role = 'medium-long';
      second.title = 'Midweek endurance run';
    }).some((issue) => issue.type === 'medium-long-hierarchy'),
  );
  assert.ok(
    issuesFor((p, w) => {
      p.profile.goal = 'half';
      w.estimatedKm = long.estimatedKm * 0.85;
    }).some((issue) => issue.type === 'easy-long-hierarchy'),
  );
});

void test('easy running next to the long day stays shorter even when it would satisfy the general easy ceiling', () => {
  const c = planQualityCases(false).find((item) => item.id === '5k-q0');
  const plan = makePlan(c.input, c.input.startDate, false);
  const long = plan.workouts.find((w) => w.kind === 'long');
  const short = plan.workouts.find(
    (w) =>
      w.week === long.week &&
      w.kind === 'easy' &&
      plan.workouts.some(
        (next) => Date.parse(next.date) - Date.parse(w.date) === 86400000,
      ),
  );
  assert.ok(short);
  short.estimatedKm = long.estimatedKm * 0.7;
  const issues = auditPlanQuality(plan).issues;
  assert.ok(
    issues.some(
      (issue) =>
        issue.type === 'short-support-hierarchy' && issue.date === short.date,
    ),
  );
  assert.ok(
    !issues.some(
      (issue) =>
        issue.type === 'easy-long-hierarchy' && issue.week === long.week + 1,
    ),
  );
});

void test('restoring and repeating the same full review cannot reinterpret reduced opening mileage as new training history', () => {
  const c = planQualityCases(false).find((item) => item.id === '5k-q0');
  let plan = makePlan(c.input, c.input.startDate, false);
  const asOf = addDays(c.input.startDate, 1);
  const opening = plan.workouts
    .filter((w) => w.week === 0 && w.kind !== 'race')
    .reduce((sum, w) => sum + w.estimatedKm, 0);
  let reviewedPrescription;
  for (let pass = 0; pass < 3; pass++) {
    const file = JSON.parse(
      JSON.stringify({
        format: 'stride-recovery-2',
        exportedAt: '2026-09-25T12:00:00Z',
        profile: null,
        plan,
        standaloneRuns: [],
      }),
    );
    const restored = prepareRestoredPlan(validateRecovery(file).plan);
    plan = revisePreferences(restored, {}, asOf, true);
    assert.equal(plan.profile.weeklyKm, c.input.weeklyKm);
    assert.equal(plan.profile.longestKm, c.input.longestKm);
    const openingNow = plan.workouts
      .filter((w) => w.week === 0 && w.kind !== 'race')
      .reduce((sum, w) => sum + w.estimatedKm, 0);
    assert.ok(
      Math.abs(openingNow - opening) < 0.001,
      'An unchanged review must not successively cut the authored opening allocation',
    );
    const prescription = plan.workouts
      .filter((w) => w.date >= asOf)
      .map((w) => [w.date, w.kind, w.minutes, w.estimatedKm, w.steps]);
    if (reviewedPrescription)
      assert.deepEqual(prescription, reviewedPrescription);
    reviewedPrescription = prescription;
  }
});

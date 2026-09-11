import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const lib = existsSync(new URL('../lib/engine.ts', import.meta.url))
  ? new URL('../lib/', import.meta.url)
  : new URL('./stride/lib/', import.meta.url);
const {
  demoProfile,
  makePlan,
  addDays,
  monday,
  todayInZone,
  adjustPlan,
  advanceReturn,
  returnReview,
  revisePreferences,
  validatePlan,
} = await import(new URL('engine.ts', lib));
const { currentTrainingBaseline } = await import(
  new URL('training-history.ts', lib)
);
const { validateRecovery, prepareRestoredPlan } = await import(
  new URL('recovery.ts', lib)
);

// Recorded runs remain in the past when this suite is run in a later release.
const today = todayInZone('Europe/London');
const start = addDays(monday(today), -70),
  breakAt = addDays(start, 56);
const stageStart = addDays(breakAt, 7),
  advanceAt = addDays(stageStart, 7);
function complete(w, kmFactor = 1) {
  w.status = 'completed';
  w.feedback = {
    actualDate: w.date,
    actualMinutes: w.minutes,
    actualKm: w.estimatedKm * kmFactor,
    effort: 3,
    feeling: 'good',
    note: 'Synthetic return duration regression',
    recordedAt: w.date + 'T18:00:00Z',
  };
}
function fixture() {
  const p = makePlan(
    {
      ...demoProfile(start),
      raceDate: addDays(start, 139),
      terrain: 'flat',
      recentQualitySessions: 1,
      qualitySessions: 1,
    },
    start,
  );
  p.workouts.filter((w) => w.date < breakAt).forEach((w) => complete(w, 1.2));
  const evidence = currentTrainingBaseline(p, breakAt);
  assert.ok(evidence.weeklyMinutes < evidence.weeklyKm * p.profile.easyPace);
  assert.ok(evidence.longestMinutes < evidence.longestKm * p.profile.easyPace);
  return { p, evidence };
}
function stageOne(mode = 'rest') {
  const { p, evidence } = fixture(),
    before = structuredClone(p);
  const returning = adjustPlan(p, breakAt, addDays(breakAt, 6), mode, breakAt);
  assert.deepEqual(
    p,
    before,
    'Starting a return must not mutate the input journal',
  );
  return { p: returning, evidence };
}
function comfortableWeek(p) {
  p.workouts
    .filter(
      (w) =>
        w.date >= stageStart && w.date < advanceAt && w.status === 'planned',
    )
    .forEach((w) => complete(w));
  assert.equal(returnReview(p, advanceAt).ready, true);
  return p;
}
function week(p, from) {
  const runs = p.workouts.filter(
    (w) =>
      w.date >= from &&
      w.date < addDays(from, 7) &&
      w.status === 'planned' &&
      w.kind !== 'race',
  );
  assert.equal(
    runs.length,
    p.profile.days.length,
    'Use one complete planned week',
  );
  const minutes = runs.map(
    (w) => w.steps.reduce((n, step) => n + step.seconds, 0) / 60,
  );
  return {
    total: minutes.reduce((n, value) => n + value, 0),
    longest: Math.max(...minutes),
    runs,
  };
}
function facts(p) {
  return {
    completed: p.workouts.filter((w) => w.status === 'completed'),
    extras: p.extraRuns ?? [],
  };
}
function restoredFacts(p) {
  return p.workouts
    .filter((w) => w.status === 'completed')
    .map((w) => ({
      ...w.feedback,
      source: undefined,
    }));
}
// This is the recovery export's serialized contract; it does not call the live API.
function recoveryFile(p) {
  return JSON.parse(
    JSON.stringify({
      format: 'stride-recovery-2',
      exportedAt: new Date().toISOString(),
      profile: null,
      plan: p,
      standaloneRuns: [],
    }),
  );
}

for (const mode of ['rest', 'easy']) {
  void test(`return after ${mode} persists observed time ceilings and bounds stage-one executable duration`, () => {
    const { p, evidence } = stageOne(mode);
    assert.equal(p.returnState.baselineMinutes, evidence.weeklyMinutes);
    assert.equal(p.returnState.longestMinutes, evidence.longestMinutes);
    assert.equal(p.returnState.baselineKm, evidence.weeklyKm);
    assert.equal(p.returnState.longestKm, evidence.longestKm);
    const upcoming = week(p, stageStart);
    assert.ok(
      upcoming.total <= evidence.weeklyMinutes * 0.65,
      `Stage one executes ${upcoming.total} minutes above ${evidence.weeklyMinutes * 0.65}`,
    );
    assert.ok(upcoming.runs.every((w) => !w.hard));
    assert.deepEqual(validatePlan(p), []);
  });
}

void test('stage two respects both observed weekly time and the 75 percent long-session duration cap', () => {
  const { p, evidence } = stageOne();
  comfortableWeek(p);
  const before = structuredClone(p),
    recorded = structuredClone(facts(p));
  const next = advanceReturn(p, advanceAt),
    upcoming = week(next, advanceAt);
  assert.equal(next.returnState.stage, 2);
  assert.equal(next.returnState.baselineMinutes, evidence.weeklyMinutes);
  assert.equal(next.returnState.longestMinutes, evidence.longestMinutes);
  assert.ok(
    upcoming.total <= evidence.weeklyMinutes * 0.8,
    `Stage two executes ${upcoming.total} minutes above ${evidence.weeklyMinutes * 0.8}`,
  );
  assert.ok(
    upcoming.longest <= evidence.longestMinutes * 0.75,
    `Longest return session executes ${upcoming.longest} minutes above ${evidence.longestMinutes * 0.75}`,
  );
  assert.deepEqual(p, before);
  assert.deepEqual(facts(next), recorded);
  assert.deepEqual(validatePlan(next), []);
});

void test('preference changes during an active return retain its observed duration ceilings and history', () => {
  const { p, evidence } = stageOne();
  comfortableWeek(p);
  const second = advanceReturn(p, advanceAt),
    before = structuredClone(second);
  const next = revisePreferences(second, { weekdayMinutes: 90 }, advanceAt);
  assert.equal(next.returnState.stage, 2);
  assert.equal(next.returnState.baselineMinutes, evidence.weeklyMinutes);
  assert.equal(next.returnState.longestMinutes, evidence.longestMinutes);
  const upcoming = week(next, advanceAt);
  assert.ok(upcoming.total <= evidence.weeklyMinutes * 0.8);
  assert.ok(upcoming.longest <= evidence.longestMinutes * 0.75);
  assert.deepEqual(second, before);
  assert.deepEqual(facts(next), facts(second));
});

void test('journal snapshots and the recovery serialization preserve return and baseline duration evidence', () => {
  const { p, evidence } = stageOne();
  p.baselineEvidence = structuredClone(evidence);
  comfortableWeek(p);
  const original = structuredClone(p),
    exported = recoveryFile(p);
  assert.equal(
    exported.plan.returnState.baselineMinutes,
    evidence.weeklyMinutes,
  );
  assert.equal(
    exported.plan.returnState.longestMinutes,
    evidence.longestMinutes,
  );
  assert.equal(
    exported.plan.baselineEvidence.longestMinutes,
    evidence.longestMinutes,
  );
  const parsed = validateRecovery(exported),
    restored = prepareRestoredPlan(parsed.plan);
  assert.notEqual(restored.id, p.id);
  assert.deepEqual(restored.returnState, p.returnState);
  assert.deepEqual(restored.baselineEvidence, p.baselineEvidence);
  assert.deepEqual(restoredFacts(restored), restoredFacts(p));
  assert.deepEqual(p, original);
  const next = advanceReturn(restored, advanceAt),
    upcoming = week(next, advanceAt);
  assert.ok(upcoming.total <= evidence.weeklyMinutes * 0.8);
  assert.ok(upcoming.longest <= evidence.longestMinutes * 0.75);
  assert.doesNotThrow(() => validateRecovery(recoveryFile(next)));
});

void test('legacy recovery files without optional duration fields remain restorable and usable', () => {
  const { p, evidence } = stageOne();
  p.baselineEvidence = structuredClone(evidence);
  comfortableWeek(p);
  const exported = recoveryFile(p);
  delete exported.plan.returnState.baselineMinutes;
  delete exported.plan.returnState.longestMinutes;
  delete exported.plan.baselineEvidence.longestMinutes;
  const before = structuredClone(exported),
    parsed = validateRecovery(exported);
  assert.deepEqual(exported, before);
  const restored = prepareRestoredPlan(parsed.plan),
    next = advanceReturn(restored, advanceAt);
  assert.equal(next.returnState.stage, 2);
  const upcoming = week(next, advanceAt),
    pace = next.profile.easyPace ?? 7;
  assert.ok(Number.isFinite(upcoming.total));
  assert.ok(upcoming.total <= next.returnState.baselineKm * pace * 0.8);
  assert.ok(upcoming.longest <= next.returnState.longestKm * pace * 0.75);
  assert.doesNotThrow(() => validateRecovery(recoveryFile(next)));
});

for (const [object, key] of [
  ['baselineEvidence', 'longestMinutes'],
  ['returnState', 'baselineMinutes'],
  ['returnState', 'longestMinutes'],
]) {
  void test(`recovery rejects malformed optional ${object}.${key} before it reaches planning`, () => {
    const { p, evidence } = stageOne();
    p.baselineEvidence = structuredClone(evidence);
    for (const value of [-1, '30', null, {}, NaN, Infinity, 100000]) {
      const file = recoveryFile(p);
      file.plan[object][key] = value;
      const before = structuredClone(file);
      assert.throws(
        () => validateRecovery(file),
        /recovery file cannot be restored/i,
        `${object}.${key} accepted ${JSON.stringify(value)}`,
      );
      assert.deepEqual(
        file,
        before,
        'Validation must preserve the source recovery file',
      );
    }
  });
}

void test('recovery accepts optional boolean progression evidence and rejects other values without coercion', () => {
  const { p, evidence } = stageOne();
  p.baselineEvidence = structuredClone(evidence);
  for (const value of ['true', 'false', 1, 0, null, {}, []]) {
    const file = recoveryFile(p);
    file.plan.baselineEvidence.supportsProgression = value;
    const before = structuredClone(file);
    assert.throws(
      () => validateRecovery(file),
      /invalid baseline progression evidence/i,
    );
    assert.deepEqual(file, before);
  }
  for (const value of [undefined, true, false]) {
    const file = recoveryFile(p);
    if (value === undefined)
      delete file.plan.baselineEvidence.supportsProgression;
    else file.plan.baselineEvidence.supportsProgression = value;
    assert.doesNotThrow(() => validateRecovery(file));
  }
});

for (const mode of ['resolved rest', 'one-minute recorded runs']) {
  void test(`automatic return and cautious replan reject ${mode} below the five-minute session minimum`, () => {
    const { p } = fixture();
    p.workouts
      .filter((w) => w.date < breakAt)
      .forEach((w) => {
        if (mode === 'resolved rest') {
          w.status = 'skipped';
          w.skipReason = 'Recorded rest';
          delete w.feedback;
        } else {
          w.feedback.actualMinutes = 1;
          w.feedback.actualKm = null;
        }
      });
    const evidence = currentTrainingBaseline(p, breakAt);
    assert.equal(evidence.coverage, 100);
    assert.ok(evidence.weeklyMinutes * 0.65 < 5 * p.profile.days.length);
    assert.equal(evidence.longestMinutes, mode === 'resolved rest' ? 0 : 1);
    const before = structuredClone(p);
    assert.throws(
      () => adjustPlan(p, breakAt, addDays(breakAt, 6), 'rest', breakAt),
      /review|five|5|time|minute/i,
      'The existing session floor must not manufacture more running than the recorded budget',
    );
    assert.deepEqual(
      p,
      before,
      'Rejected automatic return must not partly save the requested break or alter logs',
    );
    assert.throws(
      () => revisePreferences(p, { days: [0, 3, 4, 6] }, breakAt),
      /review|five|5|time|minute/i,
      'An ordinary cautious replan must also preserve the recorded capacity limit',
    );
    assert.deepEqual(
      p,
      before,
      'Rejected preference replan must preserve all original prescriptions and recorded history',
    );
  });
}

void test('zero recorded duration survives recovery but cannot silently become five-minute return sessions', () => {
  const { p, evidence } = stageOne();
  p.baselineEvidence = { ...evidence, longestMinutes: 0 };
  comfortableWeek(p);
  p.returnState.baselineMinutes = 0;
  p.returnState.longestMinutes = 0;
  const exported = recoveryFile(p),
    parsed = validateRecovery(exported);
  const restored = prepareRestoredPlan(parsed.plan);
  assert.equal(restored.returnState.baselineMinutes, 0);
  assert.equal(restored.returnState.longestMinutes, 0);
  assert.equal(restored.baselineEvidence.longestMinutes, 0);
  const before = structuredClone(restored);
  assert.throws(
    () => advanceReturn(restored, advanceAt),
    /review|five|5|time|minute/i,
  );
  assert.deepEqual(restored, before);
});

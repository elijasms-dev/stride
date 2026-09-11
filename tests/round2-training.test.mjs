import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makePlan,
  demoProfile,
  addDays,
  revisePreferences,
  validatePlan,
  advanceRunWalk,
} from '../lib/engine.ts';
import {
  currentTrainingBaseline,
  workloadSummary,
} from '../lib/training-history.ts';
import { qualityWorkMinutes } from '../lib/prescription.ts';
const start = '2026-09-07',
  asOf = addDays(start, 56);
const source = makePlan(
  {
    ...demoProfile(start),
    raceDate: addDays(start, 104),
    terrain: 'flat',
    recentQualitySessions: 1,
    qualitySessions: 1,
  },
  start,
);
function history({
  factor = 1,
  missing = false,
  partial = false,
  tired = false,
  execution,
  qualityFraction = 1,
} = {}) {
  const p = structuredClone(source);
  p.workouts
    .filter((w) => w.date < asOf)
    .forEach((w, i) => {
      if (partial && i % 2) return;
      w.status = 'completed';
      w.feedback = {
        actualDate: w.date,
        actualMinutes: w.minutes * factor,
        actualKm: missing ? null : w.estimatedKm * factor,
        effort: tired ? 8 : 3,
        feeling: tired ? 'tired' : 'good',
        note: 'Synthetic regression',
        recordedAt: w.date + 'T18:00:00Z',
      };
      if (execution !== undefined && qualityWorkMinutes(w) > 0)
        Object.assign(w.feedback, {
          execution,
          executionSource: 'self-report',
          completedQualityMinutes:
            execution === 'as-planned'
              ? qualityWorkMinutes(w) * qualityFraction
              : execution === 'partial'
                ? qualityWorkMinutes(w) * 0.5
                : 0,
        });
    });
  return p;
}
const revised = (p) => revisePreferences(p, { days: [0, 3, 4, 6] }, asOf);
const nextRuns = (p) =>
  p.workouts.filter(
    (w) =>
      w.date >= asOf &&
      w.date < addDays(asOf, 7) &&
      w.kind !== 'race' &&
      w.status === 'planned',
  );
const minutes = (p) => nextRuns(p).reduce((n, w) => n + w.minutes, 0);
const longMinutes = (p) =>
  Math.max(
    0,
    ...nextRuns(p)
      .filter((w) => w.kind === 'long')
      .map((w) => w.minutes),
  );
const firstDose = (p) => {
  const w = p.workouts.find(
    (w) => w.date >= asOf && w.kind !== 'race' && qualityWorkMinutes(w) > 0,
  );
  return {
    title: w?.title,
    template: w?.templateId,
    workMinutes: w ? qualityWorkMinutes(w) : 0,
    totalMinutes: w?.minutes,
  };
};
const facts = (p) =>
  p.workouts
    .filter((w) => w.date < asOf)
    .map((w) => ({
      id: w.id,
      date: w.date,
      steps: w.steps,
      feedback: w.feedback,
      status: w.status,
    }));
void test('true no-op and semantically reordered days preserve the whole journal exactly', () => {
  const p = history({ execution: 'as-planned' }),
    q = revisePreferences(p, { terrain: 'flat' }, asOf),
    r = revisePreferences(q, { days: [6, 4, 2, 0] }, asOf);
  assert.deepEqual(q, p);
  assert.deepEqual(r, p);
});
void test('observed half-volume does not retain the old full forecast', () => {
  const p = history({ factor: 0.5 }),
    b = currentTrainingBaseline(p, asOf),
    q = revised(p);
  assert.equal(b.supportsProgression, false);
  assert.ok(b.weeklyMinutes < 100);
  assert.ok(minutes(q) <= 100);
  assert.ok(longMinutes(q) <= 40);
  assert.equal(q.feasibility.status, 'review-required');
  assert.deepEqual(facts(q), facts(p));
  assert.deepEqual(validatePlan(q), []);
});
void test('sustained positive running supports capacity above the original declaration without modifying that declaration', () => {
  const p = history({ factor: 1.2, execution: 'as-planned' }),
    b = currentTrainingBaseline(p, asOf);
  assert.equal(b.supportsProgression, true);
  assert.ok(b.weeklyKm > p.profile.weeklyKm);
  assert.ok(b.longestKm > p.profile.longestKm);
  assert.equal(p.profile.weeklyKm, 30);
  assert.equal(p.profile.longestKm, 10);
});
void test('partial recording remains unknown and cannot authorize preserving progression', () => {
  const p = history({ partial: true }),
    b = currentTrainingBaseline(p, asOf);
  assert.equal(b.coverage, 50);
  assert.equal(b.source, 'declared-baseline');
  assert.equal(b.supportsProgression, false);
  assert.equal(b.weeklyKm, 30);
});
void test('unknown distances cannot establish extra km capacity; observed reduced duration still reduces training', () => {
  const high = history({ factor: 1.2, missing: true }),
    b = currentTrainingBaseline(high, asOf);
  assert.ok(b.weeklyKm <= 30);
  assert.equal(workloadSummary(high, asOf).averageWeeklyKm, null);
  const low = history({ factor: 0.5, missing: true }),
    q = revised(low);
  assert.equal(currentTrainingBaseline(low, asOf).supportsProgression, false);
  assert.ok(minutes(q) <= 100);
  assert.ok(longMinutes(q) <= 40);
  assert.deepEqual(facts(q), facts(low));
});
void test('recent fatigue blocks positive progression despite complete logs', () => {
  assert.equal(
    currentTrainingBaseline(history({ factor: 1.2, tired: true }), asOf)
      .supportsProgression,
    false,
  );
});
const comparisons = [];
for (const execution of [
  'as-planned',
  'partial',
  'easy-substitute',
  'not-attempted',
  'unknown',
  undefined,
]) {
  const p = history({ execution }),
    q = revised(p),
    load = workloadSummary(p, asOf);
  comparisons.push({
    execution: execution ?? 'legacy-absent',
    totalActualMinutes: load.totalMinutes,
    totalActualKm: load.totalKm,
    baseline: currentTrainingBaseline(p, asOf),
    nextDose: firstDose(q),
    historyPreserved: JSON.stringify(facts(p)) === JSON.stringify(facts(q)),
  });
}
void test('same total activity time credits intended quality separately from easy substitutes and unknown execution', () => {
  const planned = comparisons.find((r) => r.execution === 'as-planned'),
    unknown = comparisons.find((r) => r.execution === 'unknown');
  for (const r of comparisons) {
    assert.equal(r.totalActualMinutes, planned.totalActualMinutes);
    assert.equal(r.totalActualKm, planned.totalActualKm);
    assert.deepEqual(r.baseline, planned.baseline);
    assert.equal(r.historyPreserved, true);
  }
  assert.ok(
    planned.nextDose.workMinutes > unknown.nextDose.workMinutes,
    JSON.stringify(comparisons),
  );
  for (const r of comparisons.filter((r) => r.execution !== 'as-planned'))
    assert.equal(
      r.nextDose.workMinutes,
      unknown.nextDose.workMinutes,
      r.execution,
    );
});
void test('an as-planned label below the90percent quality-work gate does not count as successful execution', () => {
  const low = revised(
      history({ execution: 'as-planned', qualityFraction: 0.89 }),
    ),
    unknown = revised(history({ execution: 'unknown' }));
  assert.equal(firstDose(low).workMinutes, firstDose(unknown).workMinutes);
});
void test('local easy cap rebalances future long share, preserves actuals, and protects manual long edits', () => {
  const p = history(),
    q = revisePreferences(p, { easyLimitKm: 1 }, asOf);
  assert.ok(longMinutes(q) <= minutes(q) * 0.45 + 1);
  assert.deepEqual(facts(q), facts(p));
  assert.deepEqual(validatePlan(q), []);
  const manual = structuredClone(p),
    long = manual.workouts.find((w) => w.date >= asOf && w.kind === 'long');
  long.changed = true;
  long.changeSource = 'manual';
  assert.throws(
    () => revisePreferences(manual, { easyLimitKm: 1 }, asOf),
    /deliberate|manual|edit/i,
  );
});
void test('a newly imposed impossible long cap flags event review without replacing the goal', () => {
  const p = revisePreferences(source, { longLimitKm: 1 }, start);
  assert.equal(p.feasibility.status, 'review-required');
  assert.equal(p.profile.goal, source.profile.goal);
});
void test('internal run-walk advance updates executable intervals even when volume already maintains', () => {
  const p = makePlan(
      {
        ...demoProfile(start),
        goal: 'base',
        raceDate: addDays(start, 55),
        weeklyKm: 5,
        longestKm: 1,
        currentRuns: 2,
        days: [0, 2, 5],
        longDay: 5,
        experience: 'new',
        volume: 'maintain',
      },
      start,
    ),
    day = addDays(start, 7);
  p.workouts
    .filter((w) => w.date < day)
    .forEach((w) => {
      w.status = 'completed';
      w.feedback = {
        actualDate: w.date,
        actualMinutes: w.minutes,
        actualKm: w.estimatedKm,
        effort: 3,
        feeling: 'good',
        execution: 'as-planned',
        note: 'Comfortable synthetic run-walk',
        recordedAt: w.date + 'T18:00:00Z',
      };
    });
  const q = advanceRunWalk(p, day);
  assert.equal(q.profile.runWalkStage, 1);
  assert.ok(
    q.workouts
      .filter((w) => w.date >= day)
      .some((w) =>
        w.steps.some((s) => s.movement === 'run' && s.seconds === 120),
      ),
  );
});

void test('event tapers retain familiar work, reduce its dose, and exclude the exact race from training totals', () => {
  const cases = [
    ['5k', 83, 2, 5],
    ['10k', 83, 2, 10],
    ['half', 195, 3, 21.0975],
    ['marathon', 139, 3, 42.195],
    ['ultra', 195, 3, 50],
    ['ultra', 195, 3, 80],
  ];
  for (const [goal, length, taperCount, distance] of cases) {
    const p = makePlan(
      {
        ...demoProfile(start),
        goal,
        raceDate: addDays(start, length),
        raceDistanceKm: distance,
        weeklyKm: 70,
        longestKm: 24,
        currentRuns: 5,
        days: [0, 1, 3, 4, 6],
        longDay: 6,
        weekdayMinutes: 100,
        longMinutes: 270,
        recentQualitySessions: 1,
        qualitySessions: 1,
      },
      start,
    );
    const taper = p.weeks.filter(
      (w) => w.phase === 'Taper' || w.phase === 'Race week',
    );
    assert.ok(
      taper.length >= taperCount && taper.length <= taperCount + 1,
      `${goal} ${distance}: a date-relative taper can cross an extra calendar week`,
    );
    const before = p.workouts.filter(
      (w) => w.week < taper[0].index && w.templateId,
    );
    const dose = (w) =>
      w.steps
        .filter((s) => s.kind === 'work')
        .reduce((n, s) => n + s.seconds, 0);
    for (const w of p.workouts.filter(
      (w) => w.week >= taper[0].index && w.kind !== 'race' && w.templateId,
    )) {
      const familiar = before
        .filter((prior) => prior.templateId === w.templateId)
        .at(-1);
      assert.ok(
        familiar,
        `${goal} ${distance}: new taper template ${w.templateId}`,
      );
      assert.ok(
        dose(w) <= dose(familiar),
        `${goal} ${distance}: taper work increased`,
      );
    }
    for (const week of taper) {
      const training = p.workouts.filter(
        (w) =>
          w.week === week.index && w.kind !== 'race' && w.status !== 'skipped',
      );
      assert.equal(
        week.trainingMinutes,
        training.reduce((n, w) => n + w.minutes, 0),
      );
    }
    assert.equal(
      p.workouts
        .find((w) => w.kind === 'race')
        .steps.reduce((n, s) => n + (s.metres ?? 0), 0),
      distance * 1000,
    );
    assert.deepEqual(validatePlan(p), []);
  }
});

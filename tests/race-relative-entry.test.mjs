import { roadOpeningFailures } from './road-overhaul-helpers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  dayDiff,
  demoProfile,
  makePlan,
  revisePreferences,
  taperFactor,
  validatePlan,
} from '../lib/engine.ts';
import { qualityWorkMinutes } from '../lib/prescription.ts';
import { assertMarathonWeek } from './marathon-contract.mjs';

const start = '2026-09-07';
const input = (patch = {}) => ({
  ...demoProfile(start),
  startDate: start,
  goal: '5k',
  raceName: 'Synthetic 5K',
  raceDate: addDays(start, 27),
  weeklyKm: 20,
  longestKm: 8,
  currentRuns: 3,
  runsPerWeek: 3,
  availableDays: [0, 1, 2, 3, 4, 5, 6],
  days: [1, 3, 5],
  longDay: 5,
  weekdayMinutes: 120,
  longMinutes: 300,
  easyPace: 6,
  recentQualitySessions: 1,
  recentQualityMinutes: null,
  qualityMode: 'custom',
  qualitySessions: 1,
  workoutVariety: 'familiar',
  volume: 'gradual',
  ...patch,
});
const build = (patch = {}) => makePlan(input(patch), start, false);
const training = (plan, week) =>
  plan.workouts.filter(
    (w) => w.kind !== 'race' && (week === undefined || w.week === week),
  );
const main = (w) => w.hard && w.kind !== 'race';
const minutes = (runs) => runs.reduce((sum, w) => sum + w.minutes, 0);

function assertRoadPhaseFollowsRace(plan) {
  const p = plan.profile;
  // Reviewed v33 windows for these fixture abilities: the clock is race-relative
  // even when signup happens inside the window; the first quality dose still
  // depends on actual reported history, not the calendar's apparent urgency.
  const preparationDays =
    p.goal === 'half'
      ? p.currentRuns >= 4 && p.weeklyKm >= 35
        ? 42
        : 35
      : p.goal === '10k' &&
          p.currentRuns >= 5 &&
          p.weeklyKm >= 45 &&
          p.longestKm >= 12
        ? 35
        : 28;
  for (const week of plan.weeks) {
    const activeStart = week.start < p.startDate ? p.startDate : week.start;
    const left = dayDiff(activeStart, p.raceDate);
    if (['Recovery', 'Taper', 'Race week'].includes(week.phase)) continue;
    if (left <= preparationDays) assert.equal(week.phase, 'Race preparation');
    else assert.notEqual(week.phase, 'Race preparation');
    if (week.phase === 'Foundation') assert.ok(left > preparationDays);
  }
}

function assertBoundedPlan(plan) {
  assert.deepEqual(validatePlan(plan), []);
  assert.ok(
    plan.workouts.every(
      (w) =>
        w.date >= plan.profile.startDate &&
        w.date <= plan.profile.raceDate &&
        w.status === 'planned' &&
        !w.feedback,
    ),
    'a remaining block must not invent earlier or completed training',
  );
  for (const week of plan.weeks) {
    const runs = training(plan, week.index);
    const all = plan.workouts.filter((w) => w.week === week.index);
    assert.ok(new Set(all.map((w) => w.date)).size <= plan.profile.runsPerWeek);
    assert.ok(
      runs.reduce((sum, w) => sum + qualityWorkMinutes(w), 0) <=
        minutes(runs) * 0.22 + 0.1,
      `week ${week.index} must retain the existing work allowance`,
    );
    for (const w of runs) {
      assert.ok(
        w.minutes <=
          (w.kind === 'long'
            ? plan.profile.longMinutes
            : plan.profile.weekdayMinutes),
      );
      assert.ok(!w.hard || dayDiff(w.date, plan.profile.raceDate) >= 3);
      assert.ok(
        Math.abs(
          w.steps.reduce((sum, s) => sum + s.seconds, 0) - w.minutes * 60,
        ) < 1.01,
      );
    }
  }
}

for (const [weeklyKm, longestKm] of [
  [60, 26],
  [70, 30],
])
  test(`six-week marathon retains the ${weeklyKm}/${longestKm} baseline and its remaining taper`, () => {
    const p = build({
      goal: 'marathon',
      raceName: 'Synthetic marathon',
      raceDate: addDays(start, 41),
      weeklyKm,
      longestKm,
      currentRuns: 5,
      runsPerWeek: 5,
      days: [0, 1, 2, 3, 5],
      recentQualitySessions: 2,
      qualityMode: 'automatic',
      qualitySessions: 2,
      workoutVariety: 'varied',
    });
    const openingRuns = training(p, 0);
    assert.equal(minutes(openingRuns), weeklyKm * p.profile.easyPace);
    const openingKm = openingRuns.reduce((sum, w) => sum + w.estimatedKm, 0);
    assert.equal(p.weeks[0].targetKm, Math.round(openingKm * 10) / 10);
    assert.ok(openingKm <= weeklyKm + 0.001);
    assert.ok(weeklyKm - openingKm < openingRuns.length * 0.1);
    assert.equal(p.weeks[0].longKm, longestKm);
    assert.equal(p.weeks[0].phase, 'Build');
    assert.ok(p.weeks.some((w) => w.phase === 'Race preparation'));
    assert.ok(p.weeks.every((w) => w.phase !== 'Foundation'));
    const opening = openingRuns.filter((w) => main(w) || w.kind === 'long');
    assert.equal(opening.length, 2);
    assert.ok(
      opening.some(
        (w) => w.stimulus === 'threshold' && qualityWorkMinutes(w) >= 20,
      ),
    );
    assert.ok(
      opening.some((w) => w.kind === 'long' && w.estimatedKm === longestKm),
    );
    assert.equal(p.profile.recentQualitySessions, 2);
    assert.equal(p.profile.recentQualityMinutes ?? null, null);
    assert.equal(p.baselineEvidence, undefined);

    const untapered = training(p).filter(
      (w) =>
        w.kind === 'long' &&
        p.weeks[w.week].phase !== 'Recovery' &&
        taperFactor(p.profile, w.date) === 1,
    );
    let familiar = longestKm;
    for (const w of untapered) {
      assert.ok(Number.isInteger(w.estimatedKm));
      assert.ok(w.estimatedKm >= familiar);
      assert.ok(w.estimatedKm <= Math.min(35, familiar + 3));
      familiar = Math.max(familiar, w.estimatedKm);
    }
    for (const week of p.weeks) assertMarathonWeek(p, week);
    const peak = Math.max(...p.weeks.map((w) => minutes(training(p, w.index))));
    for (const [minimum, maximum, fraction] of [
      [7, 13, 0.6],
      [1, 6, 0.4],
    ]) {
      const runs = training(p).filter((w) => {
        const left = dayDiff(w.date, p.profile.raceDate);
        return left >= minimum && left <= maximum;
      });
      assert.ok(runs.length > 0);
      assert.ok(minutes(runs) <= peak * fraction + 0.1);
    }
    assertBoundedPlan(p);
  });

test('a four-week developing 5K block retains the race-relative phase and starts with controlled threshold', () => {
  const p = build();
  assert.equal(p.weeks[0].phase, 'Race preparation');
  assert.equal(p.weeks[1].phase, 'Race preparation');
  assert.equal(p.weeks[0].longKm, 8);
  assert.deepEqual(roadOpeningFailures(p), []);
  assert.equal(p.profile.weeklyKm, 20);
  const first = training(p).find(main);
  assert.equal(first.stimulus, 'threshold');
  assert.equal(qualityWorkMinutes(first), 6);
  assert.ok(
    first.steps.filter((s) => s.kind === 'work').every((s) => s.intensity <= 5),
  );
  assert.ok(training(p).some((w) => w.stimulus === 'race-rhythm'));
  assert.equal(p.profile.weeklyKm, 20);
  assert.equal(p.profile.longestKm, 8);
  assert.equal(p.profile.recentQualityMinutes ?? null, null);
  assert.equal(p.baselineEvidence, undefined);
  assertBoundedPlan(p);
});

for (let offset = 0; offset < 7; offset++)
  test(`short 5K entry on weekday ${offset} follows every possible race weekday`, () => {
    const startDate = addDays(start, offset);
    for (let extra = 0; extra < 7; extra++) {
      const p = build({ startDate, raceDate: addDays(startDate, 27 + extra) });
      assertRoadPhaseFollowsRace(p);
      const quality = training(p).filter(
        (w) => main(w) && taperFactor(p.profile, w.date) === 1,
      );
      assert.ok(quality.length >= 2);
      assert.equal(quality[0].stimulus, 'threshold');
      assert.equal(qualityWorkMinutes(quality[0]), 6);
      // Two controlled exposures establish the role before specific practice.
      // Partial starts do not invent a missed workout to force a third exposure.
      if (quality.length >= 3)
        assert.ok(quality.some((w) => w.stimulus === 'race-rhythm'));
      assert.ok(
        quality.every(
          (w) => qualityWorkMinutes(w) >= 6 && qualityWorkMinutes(w) <= 10,
        ),
      );
      assertBoundedPlan(p);
    }
  });

for (const [goal, weeklyKm, longestKm, days] of [
  ['5k', 20, 8, [1, 3, 5]],
  ['10k', 35, 12, [0, 1, 3, 5]],
  ['half', 50, 18, [0, 1, 3, 5]],
])
  test(`${String(goal)} keeps race-relative entry across short and same-day windows`, () => {
    for (let offset = 0; offset < 7; offset++)
      for (const span of [0, 1, 6, 13, 14, 20, 27, 34]) {
        const startDate = addDays(start, offset);
        const p = build({
          goal,
          weeklyKm,
          longestKm,
          days,
          currentRuns: days.length,
          runsPerWeek: days.length,
          startDate,
          raceDate: addDays(startDate, span),
        });
        assertRoadPhaseFollowsRace(p);
        assert.equal(p.profile.startDate, startDate);
        assert.equal(p.profile.recentQualityMinutes ?? null, null);
        assertBoundedPlan(p);
      }
  });

test('calendar proximity keeps the guaranteed workout introductory without invented speed history', () => {
  const p = build({ recentQualitySessions: 0 });
  assert.equal(p.weeks[0].phase, 'Race preparation');
  const opening = training(p).filter((w) => w.week < 2);
  assert.ok(opening.length > 0);
  assert.ok(opening.some(main));
  assert.ok(opening.filter(main).every((w) => qualityWorkMinutes(w) <= 8));
  assert.ok(opening.every((w) => w.steps.every((s) => s.intensity < 7)));
  assert.equal(p.profile.recentQualitySessions, 0);
  assert.equal(p.profile.recentQualityMinutes ?? null, null);
  assertBoundedPlan(p);
});

test('short-road opening work respects a bounded share of declared quality, not the whole reported dose', () => {
  const unknown = build();
  const known = build({ recentQualityMinutes: 20 });
  const firstUnknown = training(unknown).find(main);
  const firstKnown = training(known).find(main);
  assert.equal(firstUnknown.stimulus, 'threshold');
  assert.equal(firstKnown.stimulus, 'threshold');
  assert.ok(qualityWorkMinutes(firstKnown) > qualityWorkMinutes(firstUnknown));
  assert.ok(qualityWorkMinutes(firstKnown) <= 20 * 0.5);
  assert.equal(known.profile.recentQualityMinutes, 20);

  const tenK = (recentQualitySessions) =>
    build({
      goal: '10k',
      weeklyKm: 50,
      longestKm: 15,
      currentRuns: 5,
      runsPerWeek: 5,
      days: [0, 1, 2, 3, 5],
      recentQualitySessions,
      recentQualityMinutes: 20,
    });
  const one = tenK(1),
    two = tenK(2);
  const oneDose = qualityWorkMinutes(training(one).find(main));
  const twoDose = qualityWorkMinutes(training(two).find(main));
  assert.ok(oneDose > twoDose);
  assert.ok(oneDose <= 16);
  assert.ok(twoDose <= (20 / 2) * 0.8);
  for (const p of [unknown, known, one, two]) assertBoundedPlan(p);
});

test('a race date never fabricates readiness for a novice below the event baseline', () => {
  const novice = input({
    experience: 'new',
    weeklyKm: 5,
    longestKm: 1,
    easyPace: 7,
    recentQualitySessions: 0,
    qualitySessions: 0,
  });
  const original = structuredClone(novice);
  assert.throws(
    () => makePlan(novice, start, false),
    /recent baseline|build a base/i,
  );
  assert.deepEqual(novice, original);
  const base = makePlan({ ...novice, goal: 'base' }, start, false);
  assert.ok(base.workouts.every((w) => !w.hard && w.kind !== 'race'));
  assert.ok(
    base.workouts.some((w) => w.steps.some((s) => s.movement === 'walk')),
  );
  assert.ok(base.weeks.every((w) => w.phase !== 'Race preparation'));
  assert.equal(base.profile.recentQualitySessions, 0);
  assertBoundedPlan(base);
});

test('full-length road plans keep an opening foundation and later event preparation', () => {
  for (const [goal, span, weeklyKm, longestKm, days] of [
    ['5k', 83, 20, 8, [1, 3, 5]],
    ['10k', 83, 35, 12, [0, 1, 3, 5]],
    // A 50 km half baseline cannot fit on only three runs while preserving the
    // 18 km long run and the bounded introductory quality session. Four familiar
    // running days distribute that existing volume without oversized padding.
    ['half', 111, 50, 18, [0, 1, 3, 5]],
  ]) {
    const p = build({
      goal,
      raceDate: addDays(start, span),
      weeklyKm,
      longestKm,
      days,
      currentRuns: days.length,
      runsPerWeek: days.length,
    });
    assert.equal(p.weeks[0].phase, 'Foundation');
    assert.ok(p.weeks.some((w) => w.phase === 'Build'));
    assert.ok(p.weeks.some((w) => w.phase === 'Race preparation'));
    assertBoundedPlan(p);
  }
});

test('reviewing a short event block preserves recorded history and is stable on a repeat review', () => {
  const p = build({ recentQualityMinutes: 20 });
  const asOf = addDays(start, 7);
  for (const w of p.workouts.filter((w) => w.date < asOf)) {
    w.status = 'completed';
    w.feedback = {
      actualDate: w.date,
      actualMinutes: w.minutes,
      actualKm: w.estimatedKm,
      effort: w.hard ? 6 : 3,
      feeling: 'good',
      execution: 'as-planned',
      completedQualityMinutes: qualityWorkMinutes(w),
      recordedAt: w.date + 'T12:00:00Z',
      note: 'Synthetic completed run for the review regression.',
    };
  }
  const saved = structuredClone(p.workouts.filter((w) => w.date < asOf));
  const once = revisePreferences(p, { volume: p.profile.volume }, asOf, true);
  const twice = revisePreferences(
    once,
    { volume: p.profile.volume },
    asOf,
    true,
  );
  for (const reviewed of [once, twice]) {
    assert.deepEqual(
      reviewed.workouts.filter((w) => w.date < asOf),
      saved,
    );
    assert.ok(
      reviewed.workouts
        .filter((w) => w.date >= asOf)
        .every((w) => w.status === 'planned' && !w.feedback),
    );
    assert.deepEqual(validatePlan(reviewed), []);
  }
  const prescriptions = (plan) =>
    plan.workouts.map((w) => ({
      id: w.id,
      date: w.date,
      kind: w.kind,
      templateId: w.templateId,
      minutes: w.minutes,
      estimatedKm: w.estimatedKm,
      steps: w.steps,
    }));
  assert.deepEqual(prescriptions(twice), prescriptions(once));
});

test('short-road entry rejects a weekly baseline that requires an easy run beyond its declared long run', () => {
  assert.throws(
    () => build({ weeklyKm: 25, longestKm: 8 }),
    /starting weekly distance and long-run baseline cannot fit/,
  );
});

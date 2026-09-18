import { assertMarathonWeek } from './marathon-contract.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makePlan,
  demoProfile,
  validatePlan,
  revisePreferences,
  moveWorkout,
  addDays,
  raceDistance,
  suggestedAdjustment,
} from '../lib/engine.ts';
import { workloadSummary, trainingRecords } from '../lib/training-history.ts';
import { advancedEligibility } from '../lib/advanced-methods.ts';
const start = '2026-09-07';
const profile = (patch = {}) => ({
  ...demoProfile(start),
  startDate: start,
  raceDate: addDays(start, 139),
  weeklyKm: 50,
  longestKm: 18,
  currentRuns: 5,
  days: [0, 1, 3, 4, 6],
  longDay: 6,
  weekdayMinutes: 100,
  longMinutes: 210,
  easyPace: 6,
  qualitySessions: 1,
  recentQualitySessions: 1,
  ...patch,
});
const dt = (patch = {}) =>
  profile({
    goal: '10k',
    weeklyKm: 80,
    longestKm: 16,
    currentRuns: 6,
    days: [0, 1, 2, 3, 4, 6],
    weekdayMinutes: 120,
    volume: 'maintain',
    method: 'double-threshold',
    stableWeeks: 12,
    easyDoubleWeeks: 4,
    recentSessionsPerWeek: 7,
    recentQualitySessions: 2,
    recentQualityMinutes: 40,
    doubleDays: [1],
    doubleGapHours: 8,
    thresholdControl: 'heart-rate',
    thresholdCeiling: 150,
    ...patch,
  });
for (const [goal, patch] of [
  ['half', {}],
  ['marathon', { raceDate: addDays(start, 153) }],
  [
    'ultra',
    {
      raceDistanceKm: 50,
      weeklyKm: 55,
      longestKm: 20,
      raceDate: addDays(start, 181),
      longMinutes: 270,
    },
  ],
  ['custom', { raceDistanceKm: 15 }],
  ['custom', { raceDistanceKm: 30 }],
  [
    'custom',
    {
      raceDistanceKm: 65,
      weeklyKm: 65,
      longestKm: 24,
      currentRuns: 6,
      days: [0, 1, 2, 3, 4, 6],
      longMinutes: 300,
      raceDate: addDays(start, 195),
    },
  ],
])
  void test(`${JSON.stringify(goal)} ${patch.raceDistanceKm ?? ''} creates an eligible complete block`, () => {
    const p = makePlan(profile({ goal, ...patch }), start);
    assert.equal(
      p.workouts.find((w) => w.kind === 'race').estimatedKm,
      raceDistance(p.profile),
    );
    assert.deepEqual(validatePlan(p), []);
    assert.ok(p.weeks.length > 10);
  });
void test('custom race retains exact metre distance', () => {
  const p = makePlan(
    profile({ goal: 'custom', raceDistanceKm: 15.255 }),
    start,
  );
  assert.equal(
    p.workouts.find((w) => w.kind === 'race').steps[0].metres,
    15255,
  );
});
void test('same 80 km distance uses the same ultra exposure requirements', () => {
  for (const goal of ['ultra', 'custom'])
    assert.throws(
      () =>
        makePlan(
          profile({
            goal,
            raceDistanceKm: 80,
            weeklyKm: 75,
            longestKm: 28,
            currentRuns: 6,
            days: [0, 1, 2, 3, 4, 6],
            longLimitKm: 30,
            longMinutes: 300,
            raceDate: addDays(start, 195),
          }),
          start,
        ),
      /32 km/,
    );
});
void test('unsupported course and inadequate marathon base fail before generation', () => {
  assert.throws(
    () => makePlan(profile({ raceTerrain: 'mountain' }), start),
    /Mountain|mountain/,
  );
  assert.throws(
    () => makePlan(profile({ goal: 'marathon', weeklyKm: 20 }), start),
    /recent|requires|base/i,
  );
});
void test('long lead-in uses maintenance without reaching peak a year early', () => {
  const p = makePlan(
    profile({ goal: 'marathon', raceDate: addDays(start, 363) }),
    start,
  );
  assert.equal(p.weeks[5].phase, 'Maintenance');
  for (const week of p.weeks.slice(0, 8)) assertMarathonWeek(p, week);
  assert.ok(
    p.workouts
      .filter((w) => w.week < 8 && w.hard && w.kind !== 'long')
      .every((w) => w.qualityMinutes <= 12),
  );
  assert.ok(p.weeks[20].targetKm <= p.weeks[0].targetKm + 0.1);
});
void test('maintain option does not silently grow the long run', () => {
  const p = makePlan(profile({ volume: 'maintain' }), start);
  assert.ok(
    p.workouts
      .filter((w) => w.kind === 'long')
      .every((w) => w.estimatedKm <= p.profile.longestKm),
  );
});
void test('threshold singles budget uses actual capped volume', () => {
  const p = makePlan(
    profile({
      weeklyKm: 80,
      longestKm: 16,
      currentRuns: 6,
      days: [0, 1, 2, 3, 4, 6],
      method: 'threshold-singles',
      stableWeeks: 12,
      recentQualitySessions: 2,
      recentQualityMinutes: 50,
      qualitySessions: 2,
    }),
    start,
  );
  const capped = revisePreferences(
    p,
    { easyLimitKm: 2, longLimitKm: 8, qualityLimitKm: 8 },
    start,
  );
  for (const week of capped.weeks) {
    const w = capped.workouts.filter(
      (x) => x.week === week.index && x.kind !== 'race',
    );
    assert.ok(
      w.reduce((n, x) => n + (x.qualityMinutes ?? 0), 0) <=
        w.reduce((n, x) => n + x.minutes, 0) * 0.18 + 0.1,
    );
  }
});
void test('double threshold preserves weekly volume and respects individual distance caps', () => {
  const p = revisePreferences(
    makePlan(dt(), start),
    { easyLimitKm: 8, qualityLimitKm: 8 },
    start,
  );
  // A separate quality-disabled plan has different daily allocations. The
  // declared maintained baseline is the weekly ceiling; expansion conservation
  // is checked directly in road-taper-phase.test.mjs.
  const pairs = p.workouts.filter((w) => w.pairType === 'double-threshold');
  assert.ok(pairs.length > 4);
  for (const w of pairs) {
    assert.ok(w.estimatedKm <= 8.001);
    assert.ok(w.qualityMinutes <= 12);
    assert.equal(
      w.steps.reduce((n, s) => n + s.seconds, 0),
      w.minutes * 60,
    );
  }
  for (const week of p.weeks) {
    assert.ok(
      p.workouts
        .filter((w) => w.week === week.index && w.kind !== 'race')
        .reduce((n, w) => n + w.minutes, 0) <=
        p.profile.weeklyKm * p.profile.easyPace + 1,
    );
  }
  assert.deepEqual(validatePlan(p), []);
});
void test('lactate/gentle dose and daily budget are enforced', () => {
  const p = makePlan(
    dt({
      thresholdControl: 'lactate',
      thresholdCeiling: 2.5,
      difficulty: 'gentle',
    }),
    start,
  );
  assert.ok(
    p.workouts.filter((w) => w.pairId).every((w) => w.qualityMinutes <= 12),
  );
  assert.throws(() => makePlan(dt({ doubleGapHours: NaN }), start), /gap/);
  assert.throws(
    () => makePlan(dt({ recentSessionsPerWeek: '7' }), start),
    /whole number/,
  );
  assert.ok(
    advancedEligibility(dt({ doubleDays: [0] })).some((x) =>
      x.includes('two days'),
    ),
  );
});
void test('easy doubles split volume and hold the introduction weeks', () => {
  const p = makePlan(
    profile({
      method: 'easy-doubles',
      stableWeeks: 8,
      recentSessionsPerWeek: 5,
      doubleDays: [3],
    }),
    start,
  );
  assert.ok(p.workouts.some((w) => w.pairType === 'easy-doubles'));
  assert.ok(p.weeks[2].targetKm <= p.weeks[0].targetKm + 0.1);
  assert.ok(p.workouts.filter((w) => w.pairId).every((w) => !w.hard));
});
void test('marathon medium-long option redistributes existing easy volume', () => {
  const plain = makePlan(
      profile({ goal: 'marathon', runMeasure: 'time' }),
      start,
    ),
    specific = makePlan(
      profile({
        goal: 'marathon',
        marathonApproach: 'endurance',
        runMeasure: 'time',
      }),
      start,
    );
  assert.ok(specific.workouts.some((w) => w.role === 'medium-long'));
  assert.ok(plain.workouts.some((w) => w.role === 'medium-long'));
  assert.ok(!specific.workouts.some((w) => w.stimulus === 'aerobic-power'));
  assert.ok(
    Math.max(...specific.weeks.map((w) => w.targetKm)) <=
      specific.profile.weeklyKm * 1.4,
  );
  assert.deepEqual(validatePlan(specific), []);
});
void test('paired day validates clock values, labels and types without crashing', () => {
  for (const patch of [
    { startTime: '07:99' },
    { startTime: 'invalid' },
    { session: 'garbage' },
    { pairType: 'other' },
  ]) {
    const p = makePlan(dt(), start);
    Object.assign(
      p.workouts.find((w) => w.pairId),
      patch,
    );
    assert.ok(validatePlan(p).length > 0);
  }
});
void test('completed morning and upcoming evening both survive preference review', () => {
  const p = makePlan(dt(), start),
    am = p.workouts.find((w) => w.pairId && w.session === 'AM'),
    pm = p.workouts.find((w) => w.pairId === am.pairId && w.session === 'PM');
  am.status = 'completed';
  am.feedback = {
    actualMinutes: am.minutes,
    actualKm: am.estimatedKm,
    actualDate: am.date,
    effort: 4,
    feeling: 'good',
    note: '',
    recordedAt: am.date,
  };
  const next = revisePreferences(
    p,
    { ...p.profile, difficulty: 'gentle' },
    am.date,
  );
  assert.deepEqual(
    next.workouts.find((w) => w.id === am.id),
    am,
  );
  assert.deepEqual(
    next.workouts.find((w) => w.id === pm.id),
    pm,
  );
  assert.equal(
    new Set(next.workouts.map((w) => w.id)).size,
    next.workouts.length,
  );
});
void test('preference revisions preserve manual changes and stable workout identities', () => {
  const p = makePlan(profile(), start);
  const selected = p.workouts.find(
    (w) => w.week === 4 && !w.hard && w.kind === 'easy',
  );
  selected.changed = true;
  selected.changeSource = 'manual';
  selected.status = 'skipped';
  const asOf = addDays(start, 21),
    next = revisePreferences(p, { ...p.profile, difficulty: 'gentle' }, asOf),
    again = revisePreferences(
      next,
      { ...next.profile, recoveryWeeks: 3 },
      asOf,
    );
  assert.equal(
    next.workouts.find((w) => w.id === selected.id).status,
    'skipped',
  );
  assert.equal(
    again.workouts.find((w) => w.id === selected.id).status,
    'skipped',
  );
  assert.equal(next.profile.raceDate, p.profile.raceDate);
  assert.equal(
    next.workouts.filter((w) => w.date < asOf).length,
    p.workouts.filter((w) => w.date < asOf).length,
  );
});
void test('pairs move together and cannot swap into an occupied date', () => {
  const p = makePlan(dt(), start),
    am = p.workouts.find((w) => w.pairId);
  assert.throws(
    () => moveWorkout(p, am.id, addDays(am.date, 1), start),
    /empty/,
  );
  const moved = moveWorkout(p, am.id, am.date, start);
  assert.equal(
    moved.workouts.filter((w) => w.pairId === am.pairId && w.date === am.date)
      .length,
    2,
  );
});
void test('workload uses actual dates and keeps separate same-day sessions', () => {
  const p = makePlan(profile(), start);
  p.extraRuns = [
    {
      id: 'one',
      date: addDays(start, 1),
      minutes: 30,
      km: null,
      effort: 3,
      feeling: 'good',
      note: '',
      recordedAt: start,
    },
    {
      id: 'two',
      date: addDays(start, 1),
      minutes: 40,
      km: 7,
      effort: 4,
      feeling: 'good',
      note: '',
      recordedAt: start,
    },
  ];
  const h = workloadSummary(p, addDays(start, 28));
  assert.equal(h.totalMinutes, 70);
  assert.equal(h.recent.length, 2);
  assert.equal(h.longestKm, 7);
  assert.equal(h.canReviewBaseline, false);
  assert.ok(h.weeks.some((w) => w.unknownDistances === 1));
});
void test('external activity identity deduplicates accidental history copies', () => {
  const p = makePlan(profile(), start),
    r = {
      id: 'one',
      date: start,
      minutes: 30,
      km: 5,
      effort: 3,
      feeling: 'good',
      note: '',
      recordedAt: start,
      activityId: 'external-1',
    };
  p.extraRuns = [r, { ...r, id: 'two' }];
  assert.equal(trainingRecords(p).length, 1);
});
void test('expected effort on a hard run does not produce fatigue advice', () => {
  const p = makePlan(profile(), start);
  for (const w of p.workouts.filter((w) => w.hard).slice(0, 3)) {
    w.status = 'completed';
    w.feedback = {
      actualMinutes: w.minutes,
      actualKm: w.estimatedKm,
      effort: 8,
      feeling: 'good',
      note: '',
      recordedAt: w.date,
    };
  }
  assert.equal(suggestedAdjustment(p), null);
});

void test('a moved workout does not reappear on its original day after preference changes', () => {
  const p = makePlan(
    profile({
      days: [0, 2, 4, 6],
      currentRuns: 4,
      weeklyKm: 30,
      longestKm: 10,
    }),
    start,
  );
  const w = p.workouts.find(
    (w) => w.week === 0 && w.date === addDays(start, 2),
  );
  const moved = moveWorkout(p, w.id, addDays(w.date, 1), start);
  const revised = revisePreferences(
    moved,
    { ...moved.profile, difficulty: 'gentle' },
    start,
  );
  assert.equal(
    revised.workouts.filter((x) => x.week === 0).length,
    moved.workouts.filter((x) => x.week === 0).length,
  );
  assert.ok(!revised.workouts.some((x) => x.date === w.date));
  assert.equal(
    revised.workouts.find((x) => x.id === w.id).date,
    addDays(w.date, 1),
  );
});

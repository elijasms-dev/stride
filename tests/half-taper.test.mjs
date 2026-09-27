import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  dayDiff,
  demoProfile,
  makePlan,
  refreshWorkoutVariety,
  revisePreferences,
  taperFactor,
  trainingPhaseOn,
  validatePlan,
} from '../lib/engine.ts';
import { supportingSession } from '../lib/coaching-context.ts';

const start = '2026-09-07';
const input = (patch = {}) => ({
  ...demoProfile(start),
  name: 'Synthetic half-marathon runner',
  goal: 'half',
  raceName: 'Autumn Half Marathon',
  raceDate: '2026-11-29',
  weeklyKm: 50,
  longestKm: 18,
  currentRuns: 5,
  runsPerWeek: 5,
  availableDays: [0, 1, 2, 3, 4, 5, 6],
  days: [0, 1, 2, 3, 5],
  longDay: 5,
  easyPace: 6,
  weekdayMinutes: 100,
  longMinutes: 150,
  experience: 'established',
  qualityMode: 'custom',
  qualitySessions: 2,
  recentQualitySessions: 2,
  recentQualityMinutes: 30,
  intent: 'improve',
  volume: 'maintain',
  ...patch,
});
const make = (patch = {}) => makePlan(input(patch), start);
const training = (plan) => plan.workouts.filter((w) => w.kind !== 'race');

test('the full training week 15–20 days before a Sunday half keeps its race-specific work', () => {
  const plan = make();
  const week = plan.weeks.find((w) => w.start === '2026-11-09');
  assert.equal(week.phase, 'Race preparation');
  assert.match(week.focus, /Taper begins on 15 Nov/);
  const runs = training(plan).filter((w) => w.week === week.index);
  assert.equal(runs.length, 5);
  assert.ok(
    Math.abs(runs.reduce((n, w) => n + w.estimatedKm, 0) - 50) <= 0.001,
  );
  const quality = runs.filter((w) => w.hard);
  assert.equal(quality.length, 2);
  assert.ok(
    quality.every(
      (w) =>
        w.steps
          .filter((step) => step.kind === 'work' && step.intensity >= 4)
          .reduce((sum, step) => sum + step.seconds / 60, 0) >= 6,
    ),
  );
  assert.ok(runs.every((w) => taperFactor(plan.profile, w.date) === 1));
  assert.ok(runs.every((w) => !/Taper ·/.test(w.reason)));
  assert.deepEqual(validatePlan(plan), []);
});

for (let raceDay = 0; raceDay < 7; raceDay++)
  test(`half taper starts on its actual date for race weekday ${raceDay}, across runner frequencies`, () => {
    for (const runsPerWeek of [3, 5, 6]) {
      const plan = make({
        raceDate: addDays('2026-11-23', raceDay),
        runsPerWeek,
        currentRuns: runsPerWeek,
        ...(runsPerWeek === 3 ? { weeklyKm: 30, longestKm: 12 } : {}),
        qualitySessions: runsPerWeek >= 5 ? 2 : 1,
      });
      assert.deepEqual(validatePlan(plan), []);
      for (const w of training(plan)) {
        const gap = dayDiff(w.date, plan.profile.raceDate);
        const phase = trainingPhaseOn(
          plan.profile,
          plan.weeks[w.week].phase,
          w.date,
        );
        if (gap > 14) assert.ok(!['Taper', 'Race week'].includes(phase));
        else assert.ok(['Taper', 'Race week'].includes(phase));
        if (gap <= 2) assert.equal(w.hard, false);
      }
      for (const week of plan.weeks) {
        if (week.phase === 'Taper')
          assert.ok(dayDiff(week.start, plan.profile.raceDate) <= 14);
        const dates = new Set(
          plan.workouts.filter((w) => w.week === week.index).map((w) => w.date),
        );
        assert.ok(dates.size <= runsPerWeek);
      }
    }
  });

test('named half uses two taper weeks while custom half-family events retain three', () => {
  for (const patch of [
    {},
    { goal: 'custom', raceDistanceKm: 20 },
    { goal: 'custom', raceDistanceKm: 30 },
  ]) {
    const plan = make(patch);
    for (const [days, factor] of plan.profile.goal === 'half'
      ? [
          [22, 1],
          [21, 1],
          [15, 1],
          [14, 0.8],
          [8, 0.8],
          [7, 0.5],
          [1, 0.5],
        ]
      : [
          [22, 1],
          [21, 0.85],
          [15, 0.85],
          [14, 0.65],
          [8, 0.65],
          [7, 0.4],
          [1, 0.4],
        ])
      assert.equal(
        taperFactor(plan.profile, addDays(plan.profile.raceDate, -days)),
        factor,
      );
    assert.equal(
      plan.weeks.find((w) => w.start === '2026-11-02').phase,
      'Race preparation',
    );
    assert.deepEqual(validatePlan(plan), []);
  }
});

test('short blocks enter taper by date without compressing training or imposing a minimum length', () => {
  for (let offset = 0; offset < 7; offset++)
    for (const span of [0, 1, 6, 13, 14, 15, 20, 21, 22, 27]) {
      const startDate = addDays(start, offset);
      const profile = input({ startDate, raceDate: addDays(startDate, span) });
      const plan = makePlan(profile, startDate);
      assert.deepEqual(validatePlan(plan), []);
      assert.ok(
        plan.workouts.every(
          (w) => w.date >= startDate && w.date <= profile.raceDate,
        ),
      );
      for (const w of training(plan)) {
        const phase = trainingPhaseOn(
          plan.profile,
          plan.weeks[w.week].phase,
          w.date,
        );
        if (dayDiff(w.date, profile.raceDate) <= 14)
          assert.ok(['Taper', 'Race week'].includes(phase));
        else assert.equal(phase, 'Race preparation');
      }
    }
});

test('explicit edits of a legacy boundary week do not retain its premature taper label', () => {
  const profile = input();
  assert.equal(
    trainingPhaseOn(profile, 'Taper', '2026-11-03'),
    'Race preparation',
  );
  assert.equal(
    trainingPhaseOn(profile, 'Taper', '2026-11-08'),
    'Race preparation',
  );
  assert.equal(trainingPhaseOn(profile, 'Taper', '2026-11-15'), 'Taper');
  assert.equal(
    trainingPhaseOn(
      { ...profile, startDate: '2026-11-02' },
      'Taper',
      '2026-11-03',
    ),
    'Race preparation',
  );
});

test('refresh preserves actual taper prescriptions and their last familiar pre-taper anchors', () => {
  const plan = make({ raceDate: '2026-11-25' });
  const before = structuredClone(plan);
  const tapered = training(plan).filter(
    (w) => dayDiff(w.date, plan.profile.raceDate) <= 14,
  );
  assert.ok(
    tapered.some(
      (w) => plan.weeks[w.week].phase === 'Race preparation' && w.templateId,
    ),
  );
  const next = refreshWorkoutVariety(plan, start);
  for (const w of tapered) {
    assert.deepEqual(
      next.workouts.find((s) => s.id === w.id),
      w,
    );
    const anchor = training(plan)
      .filter(
        (s) =>
          s.templateId &&
          s.templateId === w.templateId &&
          dayDiff(s.date, plan.profile.raceDate) > 14,
      )
      .at(-1);
    if (anchor)
      assert.deepEqual(
        next.workouts.find((s) => s.id === anchor.id),
        anchor,
      );
  }
  assert.deepEqual(plan, before);
});

test('optional supporting sessions reduce from the actual taper day, including a Sunday boundary', () => {
  const plan = make({
    crossTraining: [{ day: 6, activity: 'cycling', minutes: 40 }],
  });
  assert.equal(supportingSession(plan, '2026-10-25').minutes, 40);
  assert.equal(supportingSession(plan, '2026-11-08').minutes, 40);
  assert.equal(supportingSession(plan, '2026-11-15').minutes, 20);
});

for (const method of ['easy-doubles', 'double-threshold'])
  test(`${method} cannot add a pair on tapered dates in a mixed boundary week`, () => {
    const plan = make({
      method,
      raceDate: '2026-11-25',
      weeklyKm: 80,
      longestKm: 20,
      currentRuns: 6,
      runsPerWeek: 6,
      weekdayMinutes: 120,
      longMinutes: 180,
      stableWeeks: 12,
      easyDoubleWeeks: 4,
      recentSessionsPerWeek: 7,
      recentQualityMinutes: 40,
      doubleDays: [method === 'easy-doubles' ? 4 : 3],
      doubleGapHours: 8,
      thresholdControl: 'heart-rate',
      thresholdCeiling: 150,
    });
    assert.ok(plan.workouts.some((w) => w.pairId));
    assert.ok(
      training(plan)
        .filter((w) => dayDiff(w.date, plan.profile.raceDate) <= 14)
        .every((w) => !w.pairId),
    );
    assert.deepEqual(validatePlan(plan), []);
  });

test('policy review preserves elapsed prescriptions and repeated review does not compound the taper', () => {
  const plan = make({ raceDate: '2026-11-25' });
  plan.policyVersion = 'provisional-2026-09-11-v17';
  const asOf = '2026-11-04';
  const past = training(plan).filter((w) => w.date < asOf);
  const before = structuredClone(plan);
  const next = revisePreferences(plan, {}, asOf);
  assert.deepEqual(
    next.workouts.filter((w) => w.date < asOf),
    past,
  );
  const repeated = revisePreferences(next, {}, asOf);
  const prescription = (p) =>
    p.workouts.map(({ date, steps, minutes, templateId }) => ({
      date,
      steps,
      minutes,
      templateId,
    }));
  assert.deepEqual(prescription(repeated), prescription(next));
  assert.deepEqual(plan, before);
  assert.deepEqual(validatePlan(repeated), []);
});

test('a first-half runner can keep easy training and a lowered boundary-week ceiling stays executable', () => {
  const novice = makePlan(
    input({
      experience: 'established',
      currentRuns: 3,
      runsPerWeek: 3,
      weeklyKm: 40,
      longestKm: 16,
      qualitySessions: 0,
      recentQualitySessions: 0,
      recentQualityMinutes: 0,
      intent: 'finish',
    }),
    start,
    false,
  );
  assert.ok(training(novice).every((w) => !w.hard));
  assert.deepEqual(validatePlan(novice), []);
  const plan = make({ raceDate: '2026-11-25', volume: 'gradual' });
  const next = revisePreferences(
    plan,
    { peakWeeklyKm: 50, qualityLimitKm: 7 },
    '2026-11-04',
  );
  assert.deepEqual(validatePlan(next), []);
  assert.ok(
    training(next)
      .filter((w) => w.date >= '2026-11-04' && w.hard)
      .every((w) => w.minutes <= 42),
  );
  for (const w of training(next))
    assert.equal(
      w.steps.reduce((n, s) => n + s.seconds, 0),
      w.minutes * 60,
    );
});

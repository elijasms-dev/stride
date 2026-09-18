import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  demoProfile,
  makePlan,
  refreshWorkoutVariety,
  taperFactor,
  validatePlan,
} from '../lib/engine.ts';
import { qualityWorkMinutes } from '../lib/prescription.ts';
import {
  classicQualityCount,
  requestedQualityCount,
  usesStandardQualityRhythm,
} from '../lib/training-structure.ts';
import {
  ensureGeneratedQualityRhythm,
  standardQualityRhythmErrors,
} from '../lib/plan/generation-rhythm.ts';
const start = '2026-09-21';
const input = (patch = {}) => ({
  ...demoProfile(start),
  goal: '5k',
  raceDate: addDays(start, 125),
  weeklyKm: 40,
  longestKm: 10,
  currentRuns: 5,
  runsPerWeek: 5,
  days: [0, 1, 3, 4, 6],
  availableDays: [0, 1, 2, 3, 4, 5, 6],
  longDay: 6,
  weekdayMinutes: 120,
  longMinutes: 240,
  easyPace: 6,
  qualityMode: 'automatic',
  recentQualitySessions: 2,
  recentQualityMinutes: 40,
  method: 'balanced',
  experience: 'established',
  intent: 'improve',
  volume: 'gradual',
  ...patch,
});
const ordinary = (plan) =>
  plan.weeks.filter(
    (w) =>
      !['Recovery', 'Taper', 'Race week'].includes(w.phase) &&
      taperFactor(plan.profile, addDays(w.start, 6)) >= 1,
  );
function rhythm(plan) {
  for (const week of ordinary(plan)) {
    const runs = plan.workouts.filter(
      (w) => w.week === week.index && w.kind !== 'race',
    );
    const quality = runs.filter((w) => w.hard || w.kind === 'long');
    assert.equal(
      quality.length,
      2,
      `${plan.profile.goal} week ${week.index + 1}`,
    );
    assert.equal(quality.filter((w) => w.kind === 'long').length, 1);
    assert.ok(qualityWorkMinutes(quality.find((w) => w.kind !== 'long')) >= 6);
    assert.ok(
      runs.reduce((n, w) => n + qualityWorkMinutes(w), 0) <=
        runs.reduce((n, w) => n + w.minutes, 0) * 0.22 + 0.1,
    );
    for (const w of runs)
      assert.ok(
        Math.abs(w.steps.reduce((n, s) => n + s.seconds, 0) - w.minutes * 60) <
          1.00001,
      );
  }
  assert.deepEqual(validatePlan(JSON.parse(JSON.stringify(plan))), []);
}
/** @type {Array<[string, Record<string, unknown> & {raceDistanceKm?: number}]>} */
const familyProfiles = [
  [
    '5k',
    {
      weeklyKm: 15,
      longestKm: 4.5,
      easyPace: 5,
      currentRuns: 6,
      runsPerWeek: 6,
      days: [0, 1, 2, 3, 4, 6],
      raceDate: addDays(start, 55),
    },
  ],
  ['10k', { weeklyKm: 35, longestKm: 10 }],
  ['half', { weeklyKm: 55, longestKm: 20 }],
  ['marathon', { weeklyKm: 75, longestKm: 23 }],
  [
    'ultra',
    {
      raceDistanceKm: 50,
      weeklyKm: 90,
      longestKm: 30,
      currentRuns: 6,
      runsPerWeek: 6,
      days: [0, 1, 2, 3, 4, 6],
      raceDate: addDays(start, 167),
    },
  ],
  [
    'ultra',
    {
      raceDistanceKm: 100,
      weeklyKm: 90,
      longestKm: 30,
      currentRuns: 6,
      runsPerWeek: 6,
      days: [0, 1, 2, 3, 4, 6],
      raceDate: addDays(start, 223),
      stableWeeks: 16,
      ultraWeeklyMinutes: 540,
      ultraLongestMinutes: 180,
    },
  ],
  ['custom', { raceDistanceKm: 15, weeklyKm: 45, longestKm: 13 }],
];
for (const [goal, patch] of familyProfiles)
  for (const runMeasure of ['time', 'distance'])
    void test(`${goal} ${patch.raceDistanceKm ?? ''} ${runMeasure} maintains one weekday quality workout plus the long run`, () => {
      const profile = input({ goal, ...patch, runMeasure });
      const before = structuredClone(profile);
      const plan = makePlan(profile, start, false);
      rhythm(plan);
      assert.deepEqual(profile, before);
      const opening = plan.workouts.filter(
        (w) => w.week === 0 && w.kind !== 'race',
      );
      assert.ok(
        Math.abs(
          opening.reduce((n, w) => n + w.estimatedKm, 0) - profile.weeklyKm,
        ) <= 0.00101,
      );
      assert.equal(
        opening.find((w) => w.kind === 'long').estimatedKm,
        profile.longestKm,
      );
      rhythm(refreshWorkoutVariety(plan, start));
    });

void test('automatic balanced weeks use one weekday slot while explicit choices and specialist methods remain distinct', () => {
  assert.equal(classicQualityCount(input()), 1);
  assert.equal(classicQualityCount(input({ method: 'threshold-singles' })), 2);
  for (const qualitySessions of [0, 1, 2])
    for (const goal of ['5k', '10k', 'half', 'marathon']) {
      const p = input({
        goal,
        qualityMode: 'custom',
        qualitySessions,
        weeklyKm: 75,
        longestKm: goal === 'marathon' ? 24 : 10,
      });
      assert.equal(requestedQualityCount(p), qualitySessions);
      assert.equal(usesStandardQualityRhythm(p), qualitySessions === 1);
    }
  for (const patch of [
    { goal: 'base' },
    { experience: 'new' },
    { experience: 'returning' },
    { weeklyKm: 9 },
    { runsPerWeek: 2 },
    { method: 'threshold-singles' },
    { method: 'double-threshold' },
    { method: 'easy-doubles' },
  ])
    assert.equal(usesStandardQualityRhythm(input(patch)), false);
});

for (const goal of ['5k', 'half', 'marathon'])
  for (const qualitySessions of [0, 2])
    void test(`${goal} preserves explicit ${qualitySessions} weekday-workout preference`, () => {
      const p = makePlan(
        input({
          goal,
          qualityMode: 'custom',
          qualitySessions,
          weeklyKm: 75,
          longestKm: goal === 'marathon' ? 24 : 10,
        }),
        start,
        false,
      );
      assert.equal(p.profile.qualitySessions, qualitySessions);
      assert.equal(requestedQualityCount(p.profile), qualitySessions);
      if (qualitySessions === 0)
        assert.ok(
          ordinary(p).every((week) =>
            p.workouts
              .filter(
                (w) =>
                  w.week === week.index &&
                  w.kind !== 'long' &&
                  w.kind !== 'race',
              )
              .every((w) => !w.hard),
          ),
        );
      assert.deepEqual(validatePlan(p), []);
    });

void test('the weekday repair transfers existing easy time and preserves completed work and explicit edits', () => {
  const p = makePlan(
    input({
      qualityMode: 'custom',
      qualitySessions: 0,
      volume: 'maintain',
      weeklyKm: 15,
      longestKm: 4.5,
      easyPace: 5,
      currentRuns: 6,
      runsPerWeek: 6,
      days: [0, 1, 2, 3, 4, 6],
      raceDate: addDays(start, 55),
    }),
    start,
    false,
  );
  p.profile.qualityMode = 'automatic';
  p.profile.qualitySessions = 1;
  const before = new Map(
    p.weeks.map((week) => [
      week.index,
      p.workouts
        .filter((w) => w.week === week.index && w.kind !== 'race')
        .reduce((n, w) => n + w.minutes, 0),
    ]),
  );
  ensureGeneratedQualityRhythm(p, start);
  rhythm(p);
  for (const week of p.weeks)
    assert.ok(
      p.workouts
        .filter((w) => w.week === week.index && w.kind !== 'race')
        .reduce((n, w) => n + w.minutes, 0) <=
        before.get(week.index) + 1 / 60 + 1e-6,
    );
  const changed = structuredClone(p);
  const quality = changed.workouts.find((w) => w.hard && w.kind !== 'long');
  quality.changed = true;
  quality.changeSource = 'manual';
  quality.hard = false;
  quality.kind = 'easy';
  const saved = structuredClone(changed.workouts);
  ensureGeneratedQualityRhythm(changed, start);
  assert.deepEqual(changed.workouts, saved);
});

void test('a real shortfall reports a controlled error instead of adding load or dropping the weekday workout', () => {
  assert.throws(
    () =>
      makePlan(
        input({ weeklyKm: 24, longestKm: 8, weekdayMinutes: 25 }),
        start,
        false,
      ),
    /30-minute|complete.*quality|weekday.*workout/,
  );
  assert.throws(
    () =>
      makePlan(
        input({
          weeklyKm: 10,
          longestKm: 5,
          easyPace: 5,
          currentRuns: 5,
          runsPerWeek: 5,
        }),
        start,
        false,
      ),
    /starting weekly distance|cannot fund|minimum-length|quality/,
  );
});

void test('validator detects an ordinary missing weekday stimulus but permits recovery, return and explicit manual exceptions', () => {
  const p = makePlan(input(), start, false);
  const tampered = structuredClone(p);
  const q = tampered.workouts.find(
    (w) => w.week === 0 && w.hard && w.kind !== 'long',
  );
  q.hard = false;
  q.kind = 'easy';
  assert.match(
    standardQualityRhythmErrors(tampered).join(' '),
    /Week 1 needs one complete weekday/,
  );
  q.changed = true;
  q.changeSource = 'manual';
  assert.deepEqual(standardQualityRhythmErrors(tampered), []);
  delete q.changed;
  delete q.changeSource;
  tampered.returnState = {};
  assert.deepEqual(standardQualityRhythmErrors(tampered), []);
});

void test('finish and gentle ultra routines use sustainable endurance rhythm rather than threshold fallback', () => {
  const p = makePlan(
    input({
      goal: 'ultra',
      raceDistanceKm: 100,
      weeklyKm: 90,
      longestKm: 30,
      currentRuns: 6,
      runsPerWeek: 6,
      days: [0, 1, 2, 3, 4, 6],
      raceDate: addDays(start, 223),
      stableWeeks: 16,
      ultraWeeklyMinutes: 540,
      ultraLongestMinutes: 180,
      intent: 'finish',
      difficulty: 'gentle',
    }),
    start,
    false,
  );
  rhythm(p);
  assert.ok(
    p.workouts
      .filter((w) => w.hard && w.kind !== 'long' && w.kind !== 'race')
      .every(
        (w) =>
          w.stimulus === 'race-rhythm' &&
          w.steps
            .filter((s) => s.kind === 'work')
            .every((s) => s.intensity <= 4),
      ),
  );
});

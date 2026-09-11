// Independent source-executing acceptance matrix. Synthetic profiles only.
// Portable: place in work/ beside stride/, or copy unchanged to stride/tests/.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
const lib = existsSync(new URL('./stride/lib/engine.ts', import.meta.url))
  ? new URL('./stride/lib/', import.meta.url)
  : new URL('../lib/', import.meta.url);
const { makePlan, demoProfile, addDays, dayDiff, weekday, raceDistance } =
  await import(new URL('engine.ts', lib));
const start = '2026-09-07';
const base = {
  ...demoProfile(start),
  goal: '10k',
  raceDate: addDays(start, 111),
  weeklyKm: 60,
  longestKm: 16,
  currentRuns: 5,
  days: [0, 1, 3, 4, 6],
  longDay: 6,
  weekdayMinutes: 100,
  longMinutes: 200,
  easyPace: 5.5,
  experience: 'established',
  difficulty: 'balanced',
  volume: 'gradual',
  method: 'balanced',
  intent: 'improve',
  qualitySessions: 1,
  recentQualitySessions: 1,
  recentQualityMinutes: 24,
};
const matrix = [
  [
    'beginner base',
    {
      goal: 'base',
      weeklyKm: 0,
      longestKm: 0,
      currentRuns: 0,
      days: [0, 2, 6],
      experience: 'new',
      qualitySessions: 0,
      recentQualitySessions: 0,
      recentQualityMinutes: 0,
    },
  ],
  [
    'returning three-day base',
    {
      goal: 'base',
      weeklyKm: 24,
      longestKm: 8,
      currentRuns: 3,
      days: [1, 3, 6],
      experience: 'returning',
      qualitySessions: 0,
      recentQualitySessions: 0,
      recentQualityMinutes: 0,
    },
  ],
  [
    'established three-day 5K',
    {
      goal: '5k',
      weeklyKm: 30,
      longestKm: 8,
      currentRuns: 3,
      days: [1, 3, 6],
      raceDate: addDays(start, 83),
    },
  ],
  [
    'established four-day 10K',
    {
      weeklyKm: 45,
      longestKm: 12,
      currentRuns: 4,
      days: [0, 2, 4, 6],
      raceDate: addDays(start, 83),
    },
  ],
  [
    'established five-day half',
    {
      goal: 'half',
      weeklyKm: 55,
      longestKm: 18,
      qualitySessions: 2,
      recentQualitySessions: 2,
      recentQualityMinutes: 32,
    },
  ],
  [
    'established six-day marathon',
    {
      goal: 'marathon',
      weeklyKm: 70,
      longestKm: 26,
      currentRuns: 6,
      days: [0, 1, 2, 3, 4, 6],
      qualitySessions: 2,
      recentQualitySessions: 2,
      recentQualityMinutes: 40,
      raceDate: addDays(start, 139),
    },
  ],
  [
    'established five-day 50K',
    {
      goal: 'ultra',
      raceDistanceKm: 50,
      weeklyKm: 55,
      longestKm: 20,
      longMinutes: 270,
      easyPace: 6,
      raceDate: addDays(start, 181),
    },
  ],
  [
    'custom 15.255km',
    { goal: 'custom', raceDistanceKm: 15.255, weeklyKm: 50, longestKm: 16 },
  ],
];
const training = (p) =>
  p.workouts.filter((w) => w.kind !== 'race' && w.status !== 'skipped');
const week = (p, i) => training(p).filter((w) => w.week === i);
const total = (xs) => xs.reduce((n, w) => n + w.minutes, 0);
const quality = (xs) => xs.reduce((n, w) => n + (w.qualityMinutes ?? 0), 0);
const full = (p) =>
  p.weeks.filter(
    (w) =>
      w.start >= p.profile.startDate &&
      addDays(w.start, 6) < p.profile.raceDate,
  );
const build = (p) =>
  p.weeks.find((w) => w.phase === 'Build' && w.start >= p.profile.startDate);
const snapshot = (p) =>
  training(p).map((w) => ({
    date: w.date,
    kind: w.kind,
    minutes: w.minutes,
    role: w.role,
    steps: w.steps,
  }));
const generate = (patch) => makePlan({ ...base, ...patch }, start);
function verifyExecutable(plan, input) {
  const runs = training(plan);
  assert.ok(
    runs.length > 0,
    'Every supported profile needs executable training',
  );
  assert.equal(
    new Set(plan.workouts.map((w) => w.id)).size,
    plan.workouts.length,
    'Workout identities remain distinct',
  );
  for (const w of runs) {
    assert.ok(
      input.days.includes(weekday(w.date)),
      'Training uses selected days',
    );
    assert.ok(
      w.date >= input.startDate && w.date <= input.raceDate,
      'Training stays inside requested dates',
    );
    assert.ok(
      Number.isFinite(w.minutes) && w.minutes >= 5,
      'Every running session has finite useful duration',
    );
    assert.ok(
      Math.abs(w.steps.reduce((n, s) => n + s.seconds, 0) - w.minutes * 60) <
        0.01,
      'Actual steps agree with displayed duration',
    );
    assert.ok(
      w.steps.every(
        (s) =>
          Number.isFinite(s.seconds) &&
          s.seconds > 0 &&
          typeof s.effort === 'string' &&
          s.effort.length,
      ),
      'Every step is executable with an effort cue',
    );
    assert.ok(
      w.minutes <=
        (w.kind === 'long' ? input.longMinutes : input.weekdayMinutes) + 0.01,
      'Honor explicit time caps',
    );
    const limit =
      w.kind === 'long'
        ? input.longLimitKm
        : w.hard
          ? input.qualityLimitKm
          : input.easyLimitKm;
    if (limit != null)
      assert.ok(w.estimatedKm <= limit + 0.01, 'Honor explicit distance caps');
  }
  for (const w of full(plan)) {
    const xs = week(plan, w.index);
    assert.equal(
      new Set(xs.map((s) => s.date)).size,
      input.days.length,
      'A full ordinary week covers the selected running days',
    );
    assert.ok(
      quality(xs) <= total(xs) * 0.22 + 0.1,
      'Quality remains a fraction of executed volume',
    );
    for (const l of xs.filter((s) => s.kind === 'long'))
      assert.ok(
        l.minutes <= total(xs) * 0.45 + 1,
        'Long-run share uses actual allocated training',
      );
  }
  const demanding = plan.workouts
    .filter((w) => (w.hard || w.kind === 'long') && w.status !== 'skipped')
    .sort((a, b) => a.date.localeCompare(b.date));
  for (let i = 1; i < demanding.length; i++)
    assert.ok(
      dayDiff(demanding[i - 1].date, demanding[i].date) >= 2,
      'Keep a recovery day between demanding outings across week boundaries',
    );
  if (input.goal === 'base')
    assert.equal(plan.workouts.filter((w) => w.kind === 'race').length, 0);
  else {
    const race = plan.workouts.filter((w) => w.kind === 'race');
    assert.equal(race.length, 1);
    assert.equal(race[0].date, input.raceDate);
    assert.ok(
      Math.abs(race[0].steps[0].metres - raceDistance(input) * 1000) < 0.11,
      'The exact event distance survives scheduling',
    );
    const first = plan.weeks.findIndex((w) =>
      ['Taper', 'Race week'].includes(w.phase),
    );
    if (first > 0) {
      const reference = plan.weeks
        .slice(0, first)
        .reverse()
        .find((w) => w.phase !== 'Recovery');
      const cap = total(week(plan, reference.index));
      for (const w of plan.weeks.slice(first))
        assert.ok(
          total(week(plan, w.index)) < cap,
          'Taper reduces actual training separately from race distance',
        );
    }
  }
  for (const key of [
    'weeklyKm',
    'longestKm',
    'currentRuns',
    'recentQualitySessions',
    'recentQualityMinutes',
  ])
    if (input[key] !== undefined)
      assert.equal(
        plan.profile[key],
        input[key],
        'Do not rewrite declared history to fit the output',
      );
}
for (const [name, patch] of matrix)
  void test(`matrix: ${JSON.stringify(name)} has a coherent executable schedule`, () => {
    const input = { ...base, ...patch };
    const before = structuredClone(input);
    const p = makePlan(input, start);
    assert.deepEqual(input, before);
    verifyExecutable(p, input);
    if (patch.experience === 'new') {
      assert.ok(training(p).every((w) => !w.hard));
      assert.ok(
        training(p).every((w) => w.steps.some((s) => s.movement === 'walk')),
        'Beginner plan keeps run/walk execution',
      );
    }
  });

void test('weekly baseline changes the executable first full week, not just profile metadata', () => {
  const a = generate({ weeklyKm: 45, longestKm: 12, qualitySessions: 0 }),
    b = generate({ weeklyKm: 60, longestKm: 12, qualitySessions: 0 });
  assert.ok(total(week(b, 0)) > total(week(a, 0)));
  assert.ok(total(week(b, 0)) <= 60 * base.easyPace + 1);
});
void test('recent longest run changes initial long capacity independently of weekly volume', () => {
  const a = generate({ longestKm: 8, qualitySessions: 0 }),
    b = generate({ longestKm: 16, qualitySessions: 0 });
  const longest = (p) =>
    Math.max(
      ...week(p, 0)
        .filter((w) => w.kind === 'long')
        .map((w) => w.minutes),
    );
  assert.ok(longest(b) > longest(a));
  assert.ok(longest(a) <= 8 * base.easyPace + 0.01);
});
void test('reducing five current runs to four reduces volume instead of concentrating it, without rewriting history', () => {
  const a = generate({
      currentRuns: 5,
      days: [0, 2, 4, 6],
      qualitySessions: 0,
    }),
    b = generate({ currentRuns: 5, days: [0, 1, 3, 4, 6], qualitySessions: 0 });
  assert.equal(week(a, 0).length, 4);
  assert.equal(week(b, 0).length, 5);
  assert.ok(total(week(a, 0)) < total(week(b, 0)));
  assert.ok(total(week(a, 0)) / 4 <= total(week(b, 0)) / 5 + 1);
  assert.equal(a.profile.currentRuns, 5);
  assert.equal(b.profile.currentRuns, 5);
});
void test('lower weekday time caps reduce executable workload without reallocating beyond long-run capacity', () => {
  const a = generate({ weekdayMinutes: 100 }),
    b = generate({ weekdayMinutes: 40 });
  assert.ok(total(training(b)) < total(training(a)));
  verifyExecutable(b, { ...base, weekdayMinutes: 40 });
});
void test('explicit easy/quality/long distance caps remain ceilings after redistribution', () => {
  const patch = { easyLimitKm: 8, qualityLimitKm: 7, longLimitKm: 12 };
  const p = generate(patch);
  verifyExecutable(p, { ...base, ...patch });
});
void test('zero quality requests really contain no fast work', () => {
  const p = generate({
    qualitySessions: 0,
    recentQualitySessions: 2,
    recentQualityMinutes: 50,
  });
  assert.equal(quality(training(p)), 0);
  assert.ok(training(p).every((w) => !w.hard && !w.templateId));
});
void test('one versus two established quality sessions changes actual compatible Build roles', () => {
  const a = generate({
      qualitySessions: 1,
      recentQualitySessions: 2,
      recentQualityMinutes: 50,
    }),
    b = generate({
      qualitySessions: 2,
      recentQualitySessions: 2,
      recentQualityMinutes: 50,
    });
  const i = build(b).index;
  assert.equal(week(a, i).filter((w) => w.hard).length, 1);
  assert.equal(week(b, i).filter((w) => w.hard).length, 2);
  assert.ok(quality(week(b, i)) > quality(week(a, i)));
});
void test('explicit familiar quality dose affects introductory work while remaining within declared volume', () => {
  const patch = { qualitySessions: 1, recentQualitySessions: 1 };
  const a = generate({ ...patch, recentQualityMinutes: 12 }),
    b = generate({ ...patch, recentQualityMinutes: 32 });
  const first = (p) => training(p).find((w) => w.hard);
  assert.ok(first(a) && first(b));
  assert.ok(
    first(b).qualityMinutes > first(a).qualityMinutes,
    'An experienced current dose must not be ignored',
  );
  assert.ok(first(b).qualityMinutes <= 32);
});
void test('unknown quality history remains unknown in the generated profile', () => {
  const input = { ...base };
  delete input.recentQualitySessions;
  delete input.recentQualityMinutes;
  const before = structuredClone(input);
  const p = makePlan(input, start);
  assert.equal(p.profile.recentQualitySessions, undefined);
  assert.equal(p.profile.recentQualityMinutes, undefined);
  assert.deepEqual(input, before);
});
void test('finish intent and gentle difficulty do not prescribe more fast work than balanced improvement', () => {
  const regular = generate({}),
    finish = generate({ intent: 'finish' }),
    gentle = generate({ difficulty: 'gentle' });
  assert.ok(quality(training(finish)) <= quality(training(regular)));
  assert.ok(quality(training(gentle)) <= quality(training(regular)));
  assert.notDeepEqual(snapshot(finish), snapshot(regular));
  assert.notDeepEqual(snapshot(gentle), snapshot(regular));
});
void test('maintain volume holds long capacity and gradual volume produces an actual later build', () => {
  const maintain = generate({ volume: 'maintain' }),
    gradual = generate({ volume: 'gradual' });
  const long = (p) =>
    Math.max(
      ...training(p)
        .filter((w) => w.kind === 'long')
        .map((w) => w.minutes),
    );
  assert.ok(long(maintain) <= base.longestKm * base.easyPace + 0.1);
  assert.ok(
    Math.max(...full(gradual).map((w) => total(week(gradual, w.index)))) >
      Math.max(...full(maintain).map((w) => total(week(maintain, w.index)))),
  );
});
for (const goal of ['half', 'marathon'])
  void test(`${goal}: established five-day weeks distinguish recovery and aerobic support rather than equal easy clones`, () => {
    const p = generate({
      goal,
      longestKm: 22,
      raceDate: addDays(start, 139),
      qualitySessions: 1,
      recentQualitySessions: 1,
    });
    const w = build(p),
      easy = week(p, w.index).filter((w) => w.kind === 'easy' && !w.templateId);
    assert.ok(easy.length >= 2);
    assert.ok(
      new Set(easy.map((w) => w.minutes)).size > 1,
      'Different easy roles should have different practical allocations',
    );
    assert.ok(
      new Set(easy.map((w) => w.role)).size > 1,
      'The plan should describe the different roles it allocates',
    );
  });
for (const goal of ['10k', 'half', 'marathon'])
  void test(`${goal}: structured work conserves an available weekly easy budget`, () => {
    const patch = {
      goal,
      longestKm: 22,
      raceDate: addDays(start, goal === '10k' ? 83 : 139),
      recentQualitySessions: 2,
      recentQualityMinutes: 50,
    };
    const easy = generate({ ...patch, qualitySessions: 0 }),
      qualityPlan = generate({ ...patch, qualitySessions: 2 });
    const i = build(qualityPlan).index,
      a = total(week(easy, i)),
      b = total(week(qualityPlan, i));
    assert.ok(b >= a - base.days.length, `Lost ${a - b} executable minutes`);
    assert.ok(
      b <= a + base.days.length,
      'Redistribution is bounded by the same already-prescribed workload',
    );
  });
void test('feasible Tuesday/Sunday quality slots survive a Friday long run', () => {
  const p = generate({
    longDay: 4,
    qualitySessions: 2,
    recentQualitySessions: 2,
    recentQualityMinutes: 50,
  });
  const q = week(p, build(p).index).filter((w) => w.hard);
  assert.equal(q.length, 2);
  assert.deepEqual(
    q.map((w) => weekday(w.date)).sort((a, b) => a - b),
    [1, 6],
  );
});

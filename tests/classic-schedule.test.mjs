// Regression tests for classic rhythm and exact requested frequency.
// Portable unchanged from work/ into stride/tests/. Synthetic data, no APIs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
const lib = existsSync(new URL('./stride/lib/engine.ts', import.meta.url))
  ? new URL('./stride/lib/', import.meta.url)
  : new URL('../lib/', import.meta.url);
const { makePlan, demoProfile, addDays, dayDiff, weekday, validatePlan } =
  await import(new URL('engine.ts', lib));
const { qualitySchedule } = await import(new URL('training-structure.ts', lib));
const start = '2026-09-14',
  all = [0, 1, 2, 3, 4, 5, 6];
const profile = (n, patch = {}) => ({
  ...demoProfile(start),
  goal: n < 4 ? '10k' : 'marathon',
  raceDate: addDays(start, n < 4 ? 90 : 146),
  weeklyKm: n < 4 ? 30 : 70,
  longestKm: n < 4 ? 10 : 30,
  currentRuns: n,
  days: [0, 2, 4, 5],
  availableDays: all,
  runsPerWeek: n,
  longDay: 5,
  qualityMode: 'automatic',
  recentQualitySessions: n < 5 ? 1 : 2,
  recentQualityMinutes: n < 5 ? 16 : 40,
  weekdayMinutes: 120,
  longMinutes: 200,
  experience: 'established',
  intent: 'improve',
  method: 'balanced',
  easyPace: 6,
  ...patch,
});
const active = (p, index) =>
  p.workouts.filter((w) => w.week === index && w.status !== 'skipped');
const shapes = {
  3: [1, 3, 5],
  5: [0, 1, 2, 3, 5],
  6: [0, 1, 2, 3, 4, 5],
  7: all,
};
for (const n of [3, 5, 6, 7])
  void test(`${n} requested days uses the classic Saturday-long rhythm and quality placements`, () => {
    const p = makePlan(profile(n), start);
    assert.deepEqual(p.profile.days, shapes[n]);
    assert.deepEqual(qualitySchedule(p.profile), [1]);
    assert.deepEqual(validatePlan(p), []);
    for (const week of p.weeks.filter((w) => w.phase !== 'Race week')) {
      const runs = active(p, week.index);
      assert.equal(new Set(runs.map((w) => w.date)).size, n);
      assert.equal(
        runs.length,
        n,
        'Single sessions remain the default, including seven-day plans',
      );
    }
  });

void test('default pattern rotates with the long day; explicit quality preferences can override the default', () => {
  for (const longDay of all) {
    const p = makePlan(profile(5, { longDay }), start);
    const rotate = (d) => (d + longDay - 5 + 7) % 7;
    assert.deepEqual(
      p.profile.days,
      shapes[5].map(rotate).sort((a, b) => a - b),
    );
    assert.deepEqual(
      qualitySchedule(p.profile),
      [1].map(rotate).sort((a, b) => a - b),
    );
    assert.deepEqual(validatePlan(p), []);
  }
  const override = makePlan(profile(5, { preferredHardDays: [0, 2] }), start);
  assert.equal(qualitySchedule(override.profile).length, 1);
  assert.ok([0, 2].includes(qualitySchedule(override.profile)[0]));
  assert.equal(override.profile.days.length, 5);
  assert.deepEqual(validatePlan(override), []);
});

for (const n of [3, 4, 5, 6, 7])
  for (const raceDay of all)
    void test(`${n} requested days, race on weekday ${raceDay}: race occupies one running day`, () => {
      const p = makePlan(
        profile(n, { raceDate: addDays(start, (n < 4 ? 84 : 140) + raceDay) }),
        start,
      );
      for (const week of p.weeks) {
        const runs = active(p, week.index);
        assert.ok(
          new Set(runs.map((w) => w.date)).size <= n,
          `${week.start}: ${n} requested but ${runs.length} prescribed including the race`,
        );
        assert.equal(
          runs.filter((w) => w.kind === 'race').length,
          week.index === p.weeks.at(-1).index ? 1 : 0,
        );
      }
      const hard = p.workouts.filter((w) => w.status !== 'skipped' && w.hard);
      for (let i = 1; i < hard.length; i++)
        assert.ok(
          dayDiff(hard[i - 1].date, hard[i].date) >= 2,
          'Race and quality retain recovery spacing',
        );
      assert.deepEqual(validatePlan(p), []);
    });

void test('Sunday race replaces Saturday run when the normal weekday selection already fills requested frequency', () => {
  const p = makePlan(profile(5), start),
    last = active(p, p.weeks.at(-1).index);
  assert.ok(last.some((w) => w.kind === 'race' && weekday(w.date) === 6));
  assert.ok(
    !last.some((w) => weekday(w.date) === 5),
    'Saturday becomes rest instead of producing a sixth day',
  );
  assert.equal(last.length, 5);
});

void test('an explicit five-day restart overrides inherited six-day arrays and survives profile normalization', () => {
  const raw = profile(5, {
    currentRuns: 6,
    days: [0, 1, 2, 3, 4, 5],
    availableDays: all,
    runsPerWeek: 5,
  });
  const preview = makePlan(raw, start),
    activated = makePlan(preview.profile, start);
  assert.equal(preview.profile.runsPerWeek, 5);
  assert.equal(activated.profile.runsPerWeek, 5);
  assert.deepEqual(activated.profile.days, preview.profile.days);
  assert.equal(active(activated, 2).length, 5);
  assert.deepEqual(
    activated.workouts.map((w) => [w.date, w.kind, w.minutes, w.steps]),
    preview.workouts.map((w) => [w.date, w.kind, w.minutes, w.steps]),
  );
});

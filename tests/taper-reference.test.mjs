// Source-executing taper-reference regressions. Portable unchanged into tests/.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
const lib = existsSync(new URL('./stride/lib/engine.ts', import.meta.url))
  ? new URL('./stride/lib/', import.meta.url)
  : new URL('../lib/', import.meta.url);
const {
  makePlan,
  demoProfile,
  addDays,
  revisePreferences,
  validatePlan,
  taperFactor,
} = await import(new URL('engine.ts', lib));
const { qualitySchedule } = await import(new URL('training-structure.ts', lib));
const start = '2026-09-07';
const inputs = (patch = {}) => ({
  ...demoProfile(start),
  name: 'Synthetic reference runner',
  goal: 'marathon',
  raceDate: addDays(start, 139),
  weeklyKm: 70,
  longestKm: 30,
  currentRuns: 5,
  availableDays: [0, 1, 2, 3, 4, 5, 6],
  runsPerWeek: 5,
  days: [0, 1, 3, 4, 6],
  qualityMode: 'automatic',
  recentQualitySessions: 2,
  recentQualityMinutes: 40,
  weekdayMinutes: 120,
  longMinutes: 200,
  easyPace: 6,
  intent: 'improve',
  method: 'balanced',
  ...patch,
});
const changes = (before, after) => {
  const signature = (w) =>
    JSON.stringify({
      date: w.date,
      kind: w.kind,
      minutes: w.minutes,
      quality: w.qualityMinutes,
      steps: w.steps,
    });
  return before.workouts.flatMap((w) => {
    const next = after.workouts.find((n) => n.id === w.id);
    return next && signature(w) === signature(next)
      ? []
      : [{ date: w.date, before: w.minutes, after: next?.minutes ?? null }];
  });
};
void test('same-effective calendar preferences preserve a Sunday-race marathon taper across repeated full reviews', () => {
  const original = makePlan(inputs(), start);
  const restDay = [0, 1, 2, 3, 4, 5, 6].find(
    (d) => !original.profile.days.includes(d),
  );
  const existingHardDays = qualitySchedule(original.profile);
  // The final peak Sunday is 21 days before the race. The following six-day
  // boundary starts the taper; repeated reviews must keep a fixed reference.
  assert.equal(
    taperFactor(original.profile, addDays(original.profile.raceDate, -20)),
    0.75,
  );
  let current = original;
  for (let i = 0; i < 4; i++) {
    const before = structuredClone(current);
    current = revisePreferences(
      current,
      {
        crossTraining: [
          {
            day: restDay,
            activity: i % 2 ? 'mobility' : 'cycling',
            minutes: 40,
          },
        ],
        preferredHardDays: existingHardDays,
      },
      start,
    );
    assert.deepEqual(
      changes(original, current),
      [],
      `Full review ${i + 1} must not compound a taper reduction`,
    );
    assert.deepEqual(validatePlan(current), []);
    assert.equal(before.workouts.length, current.workouts.length);
  }
});
void test('Sunday 10K taper never uses the already-reduced day at its 14-day boundary as its own reference', () => {
  const original = makePlan(
    inputs({
      goal: '10k',
      raceDate: addDays(start, 83),
      weeklyKm: 40,
      longestKm: 12,
      currentRuns: 4,
      runsPerWeek: 4,
      days: [0, 2, 4, 6],
      recentQualitySessions: 1,
      recentQualityMinutes: 16,
      weekdayMinutes: 75,
      longMinutes: 100,
    }),
    start,
  );
  assert.equal(
    taperFactor(original.profile, addDays(original.profile.raceDate, -14)),
    0.65,
  );
  let current = original;
  for (let i = 0; i < 4; i++) {
    current = revisePreferences(current, {}, start, true);
    assert.deepEqual(
      changes(original, current),
      [],
      `Full review ${i + 1} must not multiply the 14-day taper factor again`,
    );
    assert.deepEqual(validatePlan(current), []);
  }
});

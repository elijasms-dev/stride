// Portable source-executing acceptance tests. Synthetic inputs only; no provider or database access.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
const lib = existsSync(new URL('./stride/lib/engine.ts', import.meta.url))
  ? new URL('./stride/lib/', import.meta.url)
  : new URL('../lib/', import.meta.url);
const { makePlan, demoProfile, addDays, weekday } = await import(
  new URL('engine.ts', lib)
);
const date = '2026-09-07';
const base = {
  ...demoProfile(date),
  currentRuns: 5,
  days: [0, 1, 3, 4, 6],
  longDay: 6,
  weeklyKm: 60,
  longestKm: 22,
  easyPace: 5.5,
  weekdayMinutes: 100,
  longMinutes: 180,
  experience: 'established',
  qualitySessions: 2,
  recentQualitySessions: 2,
  recentQualityMinutes: 50,
  difficulty: 'balanced',
  volume: 'gradual',
  method: 'balanced',
  intent: 'improve',
  terrain: 'flat',
};
const profiles = {
  '10k': { goal: '10k', raceDate: addDays(date, 83) },
  half: { goal: 'half', raceDate: addDays(date, 111) },
  marathon: { goal: 'marathon', raceDate: addDays(date, 139) },
};
const training = (plan, index) =>
  plan.workouts.filter((w) => w.week === index && w.kind !== 'race');
const total = (runs) => runs.reduce((n, w) => n + w.minutes, 0);
const gap = (a, b) => Math.min(Math.abs(a - b), 7 - Math.abs(a - b));
for (const goal of ['10k', 'half', 'marathon']) {
  void test(`${goal}: introducing structured work conserves an executable established weekly budget when easy capacity is available`, () => {
    const p = { ...base, ...profiles[goal] };
    const easy = makePlan({ ...p, qualitySessions: 0 }, date),
      structured = makePlan(p, date);
    const target = structured.weeks.find((w) => w.phase === 'Build');
    const plainRuns = training(easy, target.index),
      structuredRuns = training(structured, target.index);
    assert.ok(
      structuredRuns.some((w) => w.templateId),
      'The fixture must actually introduce a structured session',
    );
    const missing = total(plainRuns) - total(structuredRuns);
    assert.ok(
      missing <= p.days.length,
      `Structured week lost ${missing} minutes versus ${total(plainRuns)} already executable minutes`,
    );
    assert.ok(
      total(structuredRuns) <= total(plainRuns) + p.days.length,
      'Redistribution cannot invent a higher weekly allocation',
    );
    for (const w of structuredRuns) {
      assert.ok(
        w.minutes <= (w.kind === 'long' ? p.longMinutes : p.weekdayMinutes),
        'Preserve each explicit time ceiling',
      );
      assert.ok(
        Math.abs(w.steps.reduce((n, s) => n + s.seconds, 0) - w.minutes * 60) <
          0.01,
        'Schedule and executable steps must agree',
      );
    }
  });
}
void test('a feasible two-slot 10K schedule is not lost by greedily choosing Monday before Tuesday and Sunday', () => {
  const p = {
    ...base,
    ...profiles['10k'],
    longDay: 4,
    qualityMode: 'custom',
    qualitySessions: 2,
  };
  const plan = makePlan(p, date),
    build = plan.weeks.find((w) => w.phase === 'Build');
  const hard = training(plan, build.index).filter((w) => w.hard);
  assert.equal(
    hard.length,
    2,
    'Tuesday and Sunday both satisfy all existing spacing and availability rules',
  );
  const days = hard.map((w) => weekday(w.date));
  assert.ok(days.every((d) => p.days.includes(d) && gap(d, p.longDay) >= 2));
  assert.ok(gap(days[0], days[1]) >= 2);
});
void test('a personalized suggestion does not rewrite declared history or input preferences', () => {
  const p = { ...base, ...profiles.marathon };
  const before = structuredClone(p);
  const plan = makePlan(p, date);
  assert.deepEqual(p, before);
  for (const key of [
    'weeklyKm',
    'longestKm',
    'currentRuns',
    'recentQualitySessions',
    'recentQualityMinutes',
  ])
    assert.equal(plan.profile[key], before[key]);
});

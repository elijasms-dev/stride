import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
const lib = existsSync(new URL('../lib/schedule-guidance.ts', import.meta.url))
  ? new URL('../lib/', import.meta.url)
  : new URL('./stride/lib/', import.meta.url);
const { runningDayRange, suggestedRunningDays } = await import(
  new URL('schedule-guidance.ts', lib)
);
const profile = (patch = {}) => ({
  goal: 'base',
  currentRuns: 2,
  days: [0, 2, 4, 6],
  longDay: 6,
  ...patch,
});

for (const [currentRuns, min, max] of [
  [0, 2, 3],
  [1, 2, 2],
  [2, 2, 3],
  [3, 2, 4],
  [4, 2, 5],
  [5, 2, 6],
  [6, 2, 7],
  [7, 2, 7],
]) {
  void test(`shared allowed-day range supports two through seven runs within recent-frequency progression for ${currentRuns} recent days`, () => {
    assert.deepEqual(runningDayRange(profile({ currentRuns })), { min, max });
  });
}

void test('untouched four-day defaults become a valid three-day suggestion for two recent running days', () => {
  const p = profile();
  const suggested = suggestedRunningDays(p);
  assert.equal(suggested.length, 3);
  assert.ok(suggested.includes(p.longDay), 'Keep the chosen long-run day');
  assert.ok(
    suggested.every((day) => p.days.includes(day)),
    'Retain existing available days when reducing the count',
  );
  assert.equal(new Set(suggested).size, 3);
  assert.equal(
    p.currentRuns,
    2,
    'A schedule suggestion never rewrites recent running history',
  );
});

void test('a valid deliberate three-day schedule retains its selected days', () => {
  const p = profile({ days: [1, 3, 5], longDay: 5 });
  assert.deepEqual(suggestedRunningDays(p), p.days);
});

void test('one recent running day can receive a two-day introductory suggestion', () => {
  const p = profile({ currentRuns: 1 });
  assert.equal(suggestedRunningDays(p).length, 2);
  assert.equal(p.currentRuns, 1);
});

void test('an ultra uses the five-day minimum and cannot invent an eligible recent routine', () => {
  const eligible = profile({
    goal: 'ultra',
    raceDistanceKm: 50,
    currentRuns: 4,
    days: [0, 1, 2, 4, 6],
  });
  assert.deepEqual(runningDayRange(eligible), { min: 5, max: 5 });
  assert.equal(suggestedRunningDays(eligible).length, 5);
  const insufficient = { ...eligible, currentRuns: 3 };
  assert.deepEqual(runningDayRange(insufficient), { min: 5, max: 4 });
  assert.equal(suggestedRunningDays(insufficient), null);
});

void test('a custom ultra distance uses the same schedule minimum as an ultra goal', () => {
  assert.deepEqual(
    runningDayRange(
      profile({ goal: 'custom', raceDistanceKm: 50, currentRuns: 4 }),
    ),
    { min: 5, max: 5 },
  );
});

void test('empty selections can receive a valid bounded suggestion without duplicate days', () => {
  const suggested = suggestedRunningDays(profile({ days: [] }));
  assert.equal(suggested.length, 2);
  assert.equal(new Set(suggested).size, 2);
  assert.ok(
    suggested.every((day) => Number.isInteger(day) && day >= 0 && day <= 6),
  );
});

void test('suggesting a schedule does not mutate a frozen profile or its original array', () => {
  const p = Object.freeze(profile({ days: Object.freeze([0, 2, 4, 6]) }));
  const before = structuredClone(p);
  suggestedRunningDays(p);
  runningDayRange(p);
  assert.deepEqual(p, before);
});

for (const [recent, chosen] of [
  [4, 5],
  [5, 6],
  [6, 5],
]) {
  void test(`${recent} recent days supports a deliberate ${chosen}-day schedule without rewriting history`, () => {
    const days = [0, 1, 2, 3, 4, 6].slice(6 - chosen);
    const p = profile({ currentRuns: recent, days, longDay: 6 });
    const before = structuredClone(p);
    assert.deepEqual(suggestedRunningDays(p), days);
    assert.deepEqual(p, before);
  });
}

void test('three recent days offers four after a deliberate six-day selection, preserving recent frequency', () => {
  const p = profile({ currentRuns: 3, days: [0, 1, 2, 3, 4, 6] });
  const before = structuredClone(p);
  assert.deepEqual(runningDayRange(p), { min: 2, max: 4 });
  const suggestion = suggestedRunningDays(p);
  assert.equal(suggestion.length, 4);
  assert.ok(suggestion.includes(p.longDay));
  assert.ok(suggestion.every((day) => p.days.includes(day)));
  assert.deepEqual(p, before);
});

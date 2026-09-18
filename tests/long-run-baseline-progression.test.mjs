import test from 'node:test';
import assert from 'node:assert/strict';
import {
  anchoredLongRunKm,
  longRunForWeek,
} from '../lib/progression-engine.ts';

const progression = (patch = {}) => ({
  weekIndex: 0,
  startLongKm: 10.5,
  peakKm: 21,
  peakWeekIndex: 9,
  recovery: false,
  taper: false,
  taperFraction: 1,
  wholeKilometres: true,
  recoveryEveryWeeks: 4,
  recoveryOffset: 0,
  ...patch,
});

void test('the supplied positive long-run baseline is never raised to the event minimum', () => {
  for (const baseline of [0.5, 3, 7.5, 10.5, 23, 23.5, 38]) {
    assert.equal(anchoredLongRunKm(baseline, 16), baseline);
  }
  for (const absent of [0, undefined, null, NaN]) {
    assert.equal(anchoredLongRunKm(absent, 8), 8);
  }
});

void test('the opening whole-distance target preserves the exact supplied baseline', () => {
  for (const startLongKm of [0.5, 3, 10.5, 23, 23.5, 38.5]) {
    for (const peakWeekIndex of [0, 1, 3, 12]) {
      assert.equal(
        longRunForWeek(progression({ startLongKm, peakKm: 45, peakWeekIndex })),
        startLongKm,
      );
    }
  }
});

void test('a fractional baseline joins the integer grid without an oversized first build increase', () => {
  const values = [0, 1, 2].map((weekIndex) =>
    longRunForWeek(progression({ weekIndex, peakWeekIndex: 2, peakKm: 35 })),
  );
  assert.deepEqual(values, [10.5, 12, 14]);
  assert.equal(
    longRunForWeek(
      progression({ weekIndex: 2, peakWeekIndex: 2, peakKm: 13.8 }),
    ),
    13,
  );
  assert.equal(
    longRunForWeek(
      progression({ weekIndex: 2, peakWeekIndex: 2, peakKm: 10.8 }),
    ),
    10.5,
  );
});

void test('ultra progression may exceed 35 km while respecting its supplied peak', () => {
  const options = progression({
    startLongKm: 38.5,
    peakKm: 45,
    peakWeekIndex: 8,
  });
  assert.equal(longRunForWeek(options), 38.5);
  assert.equal(longRunForWeek({ ...options, weekIndex: 8 }), 45);
  assert.equal(longRunForWeek({ ...options, weekIndex: 30 }), 45);
});

void test('a long timeline moves a fractional baseline to an integer on the first ordinary hold', () => {
  const options = progression({
    startLongKm: 16.5,
    peakKm: 21,
    peakWeekIndex: 13,
  });
  assert.equal(longRunForWeek(options), 16.5);
  assert.equal(longRunForWeek({ ...options, weekIndex: 1 }), 17);
  assert.equal(longRunForWeek({ ...options, weekIndex: 2 }), 17);
  let previous = 16.5;
  for (let weekIndex = 1; weekIndex <= 13; weekIndex++) {
    const recovery = (weekIndex + 1) % 4 === 0;
    const value = longRunForWeek({ ...options, weekIndex, recovery });
    if (recovery) continue;
    assert.ok(Number.isInteger(value));
    assert.ok(value >= previous && value - previous <= 2);
    assert.ok(value <= 21);
    previous = value;
  }
  assert.equal(previous, 21);
});

void test('ordinary holds preserve a fraction only when the peak cannot fit the next whole kilometre', () => {
  const options = progression({
    startLongKm: 16.5,
    peakKm: 16.9,
    peakWeekIndex: 13,
  });
  for (let weekIndex = 0; weekIndex <= 13; weekIndex++) {
    assert.equal(longRunForWeek({ ...options, weekIndex }), 16.5);
  }
});

void test('recovery slots and their calendar offset do not count as extra build opportunities', () => {
  const options = progression({
    startLongKm: 10,
    peakKm: 30,
    peakWeekIndex: 3,
  });
  assert.equal(longRunForWeek({ ...options, weekIndex: 3 }), 14);
  assert.equal(
    longRunForWeek({ ...options, weekIndex: 3, recoveryOffset: 1 }),
    14,
  );
  assert.equal(
    longRunForWeek({ ...options, weekIndex: 3, recoveryOffset: 3 }),
    16,
  );
  assert.equal(
    longRunForWeek({ ...options, weekIndex: 3, recovery: true }),
    11,
  );
  assert.equal(longRunForWeek({ ...options, weekIndex: 4 }), 14);
});

void test('recovery and taper round downward without inflating a small starting distance', () => {
  for (const startLongKm of [0.5, 1, 2.5, 10.5, 23.5]) {
    const options = progression({ startLongKm, peakKm: 45 });
    assert.equal(
      longRunForWeek({ ...options, recovery: true }),
      Math.floor(startLongKm * 0.8),
    );
    assert.equal(
      longRunForWeek({ ...options, taper: true, taperFraction: 0.65 }),
      Math.floor(startLongKm * 0.65),
    );
  }
});

void test('a peak below the baseline cannot erase that baseline or create further growth', () => {
  for (let weekIndex = 0; weekIndex <= 20; weekIndex++) {
    assert.equal(
      longRunForWeek(progression({ weekIndex, startLongKm: 10.5, peakKm: 9 })),
      10.5,
    );
  }
});

void test('whole-distance forecasts have bounded, monotonic build increments across timelines and recovery offsets', () => {
  for (const recoveryEveryWeeks of [3, 4]) {
    for (const recoveryOffset of [0, 1, 2, 3, 4, 7]) {
      for (const peakWeekIndex of [0, 1, 3, 8, 16, 40]) {
        for (const startLongKm of [0.5, 1, 3.5, 10.5, 23, 23.5, 38.5]) {
          for (const extraKm of [0.2, 1, 3.5, 10, 40]) {
            const peakKm = startLongKm + extraKm;
            let previousBuild = startLongKm;
            for (
              let weekIndex = 0;
              weekIndex <= peakWeekIndex + 2;
              weekIndex++
            ) {
              const recovery =
                weekIndex > 0 &&
                (weekIndex + recoveryOffset + 1) % recoveryEveryWeeks === 0;
              const value = longRunForWeek(
                progression({
                  weekIndex,
                  startLongKm,
                  peakKm,
                  peakWeekIndex,
                  recovery,
                  recoveryEveryWeeks,
                  recoveryOffset,
                }),
              );
              assert.ok(
                Number.isFinite(value) && value >= 0 && value <= peakKm,
              );
              if (recovery) continue;
              assert.ok(
                value >= previousBuild,
                `${JSON.stringify({ weekIndex, startLongKm, peakKm, peakWeekIndex, recoveryEveryWeeks, recoveryOffset })}: ${previousBuild} -> ${value}`,
              );
              assert.ok(value - previousBuild <= 2);
              assert.ok(value === startLongKm || Number.isInteger(value));
              if (
                weekIndex > 0 &&
                Math.floor(peakKm) >= Math.ceil(startLongKm)
              ) {
                assert.ok(Number.isInteger(value));
              }
              previousBuild = value;
            }
          }
        }
      }
    }
  }
});

void test('explicit and default legacy interpolation remain compatible', () => {
  const options = progression({
    weekIndex: 1,
    startLongKm: 10,
    peakKm: 20,
    peakWeekIndex: 3,
    wholeKilometres: false,
  });
  assert.equal(longRunForWeek(options), 10 + 10 / 3);
  const { wholeKilometres: _wholeKilometres, ...legacy } = options;
  assert.equal(longRunForWeek(legacy), 10 + 10 / 3);
});

const { demoProfile, validateProfile, addDays } =
  await import('../lib/engine.ts');
const { resolveGenerationPolicy } =
  await import('../lib/plan/generation-policy.ts');
const { calculateWeekLoad } = await import('../lib/plan/generation-load.ts');
const { allocateGenerationWeek } =
  await import('../lib/plan/generation-allocation.ts');
const stageStart = '2026-09-14';
const generationContext = (patch = {}) =>
  resolveGenerationPolicy(
    validateProfile(
      {
        ...demoProfile(stageStart),
        goal: 'half',
        raceDate: addDays(stageStart, 111),
        weeklyKm: 60,
        longestKm: 16.5,
        currentRuns: 5,
        days: [0, 1, 2, 4, 6],
        longDay: 6,
        weekdayMinutes: 120,
        longMinutes: 240,
        easyPace: 6,
        recentQualitySessions: 2,
        recentQualityMinutes: 30,
        ...patch,
      },
      stageStart,
    ),
  );

void test('distant marathon maintenance rounds the second long run without increasing weekly volume', () => {
  const context = generationContext({
    goal: 'marathon',
    longestKm: 23.5,
    raceDate: addDays(stageStart, 209),
  });
  assert.ok(context.longProgressionStart > 1);
  const opening = calculateWeekLoad(context, 0, context.initialLoad);
  const next = calculateWeekLoad(context, 1, opening.load);
  assert.equal(opening.long, 23.5);
  assert.equal(next.long, 24);
  assert.equal(next.load, opening.load);
});

void test('a future capacity between the familiar fraction and next integer holds the baseline instead of rounding below it', () => {
  const context = generationContext({
    dayPreferences: [{ day: 6, maxMinutes: 101 }],
  });
  const opening = calculateWeekLoad(context, 0, context.initialLoad);
  const next = calculateWeekLoad(context, 1, opening.load);
  assert.equal(next.long, 17);
  const allocation = allocateGenerationWeek(context, next, 1, [], []);
  assert.equal(allocation.longDistance, 16.5);
  assert.ok(allocation.longDistance * context.longPace <= 101);
});

void test('an incompatible familiar long run cannot consume minutes reserved for minimum useful easy outings', () => {
  const context = generationContext({
    goal: 'base',
    weeklyKm: 18,
    longestKm: 16.5,
    currentRuns: 3,
    days: [0, 2, 6],
    qualitySessions: 0,
    recentQualitySessions: 0,
    recentQualityMinutes: 0,
  });
  const week = calculateWeekLoad(context, 0, context.initialLoad);
  const allocation = allocateGenerationWeek(context, week, 0, [], []);
  const longMinutes = Math.ceil(allocation.longDistance * context.longPace);
  const easyMinutes = [...allocation.allocation.values()].reduce(
    (sum, minutes) => sum + minutes,
    0,
  );
  assert.ok(
    longMinutes + easyMinutes <= Math.floor(allocation.desired * context.pace),
  );
  assert.ok(
    [...allocation.allocation.values()].every((minutes) => minutes >= 5),
  );
  assert.ok(
    allocation.longDistance < context.startLong,
    'caller can report the baseline incompatibility instead of inventing time',
  );
});

void test('a fresh plan retains supplied weekly volume when returning or changing running frequency', () => {
  const context = generationContext({
    goal: 'base',
    weeklyKm: 30,
    longestKm: 12.5,
    experience: 'returning',
    currentRuns: 5,
    days: [0, 2, 6],
    qualitySessions: 0,
    recentQualitySessions: 0,
    recentQualityMinutes: 0,
  });
  assert.equal(context.initialLoad, 30);
  assert.equal(context.startLong, 12.5);
});

void test('a half-family custom event reaches its integer peak before the day-specific taper reduces it', () => {
  const context = generationContext({
    goal: 'custom',
    raceDistanceKm: 30,
    longestKm: 18,
    raceDate: addDays(stageStart, 139),
  });
  let load = context.initialLoad;
  let peak = 0;
  for (let week = 0; week < context.count; week++) {
    const next = calculateWeekLoad(context, week, load);
    load = next.load;
    if (!next.recovery && !next.taper) peak = Math.max(peak, next.long);
  }
  assert.equal(peak, 21);
});

void test('maintaining volume holds the exact long-run baseline while recovery and taper still reduce it', () => {
  const context = generationContext({ volume: 'maintain', longestKm: 16.5 });
  let load = context.initialLoad;
  for (let week = 0; week < context.count; week++) {
    const next = calculateWeekLoad(context, week, load);
    load = next.load;
    assert.ok(next.long <= 16.5);
    if (!next.recovery && !next.taper && !next.taperAtWeekStart)
      assert.equal(next.long, 16.5);
  }
});

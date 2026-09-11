import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseNumericText,
  parsePaceText,
  paceText,
  numericText,
  MILE_KM,
  trainingDay,
  reconcileStartDate,
  relativeDayLabel,
  runFeedbackError,
} from '../lib/form-values.ts';
import { demoProfile, makePlan, addDays, todayInZone } from '../lib/engine.ts';

void test('new feedback must be supplied deliberately before it can become a training observation', () => {
  for (const [effort, feeling] of [
    ['', ''],
    ['', 'good'],
    ['3', ''],
    ['0', 'okay'],
    ['11', 'good'],
    ['3.5', 'okay'],
    ['NaN', 'tired'],
    ['3', 'unknown'],
  ])
    assert.ok(
      runFeedbackError(effort, feeling),
      `${effort}/${feeling} must be incomplete`,
    );
  for (const feeling of ['good', 'okay', 'tired']) {
    for (const effort of ['1', '3', '5', '7', '10'])
      assert.equal(
        runFeedbackError(effort, feeling),
        '',
        'Existing valid corrections remain valid',
      );
  }
});

void test('runner pace is deliberate m:ss, supports fractional seconds, and never decimal-minute ambiguity', () => {
  assert.equal(parsePaceText('6:17'), 6 + 17 / 60);
  assert.equal(parsePaceText('6:30'), 6.5);
  assert.equal(parsePaceText('6:17,5'), 6 + 17.5 / 60);
  for (const raw of ['6.17', '6.30', '6:', '6:60', '6:9', 'abc'])
    assert.ok(Number.isNaN(parsePaceText(raw)), raw);
  assert.equal(parsePaceText(''), null);
  assert.equal(paceText(6 + 1.5 / 60), '6:01.5');
  assert.ok(
    Math.abs(parsePaceText(paceText(6, MILE_KM), MILE_KM) - 6) < 0.0001,
  );
});
void test('numeric text supports comma, clearing and decimal drafts without exponent or grouped-number coercion', () => {
  assert.equal(parseNumericText('30,0'), 30);
  assert.equal(parseNumericText('.7'), 0.7);
  assert.equal(parseNumericText(''), null);
  assert.equal(parseNumericText('15.'), 15);
  for (const raw of ['1e3', '1,000.5', '-1', '1 000', 'Infinity', '.'])
    assert.ok(Number.isNaN(parseNumericText(raw)), raw);
  const canonical = 42.1951;
  for (let n = 0; n < 100; n++) {
    numericText(canonical, MILE_KM);
    numericText(canonical);
  }
  assert.equal(canonical, 42.1951);
  assert.ok(
    parseNumericText('.7') * MILE_KM > 1,
    'sub-mile cap can exceed the one-km minimum',
  );
});
void test('onboarding clock uses its selected timezone at the audited midnight, without changing race or other inputs', () => {
  const instant = new Date('2026-09-07T22:58:00Z');
  assert.equal(trainingDay('Europe/London', instant), '2026-09-07');
  assert.equal(trainingDay('Europe/Vilnius', instant), '2026-09-08');
  assert.deepEqual(
    reconcileStartDate('2026-09-07', 'Europe/Vilnius', instant),
    { today: '2026-09-08', start: '2026-09-07', corrected: false },
  );
  assert.equal(
    reconcileStartDate('2026-12-01', 'Europe/Vilnius', instant).start,
    '2026-12-01',
  );
});
void test('relative labels use calendar dates through DST, leap day and year boundaries', () => {
  assert.equal(relativeDayLabel('2026-03-30', '2026-03-28'), 'In 2 days');
  assert.equal(relativeDayLabel('2026-10-24', '2026-10-26'), '2 days ago');
  assert.equal(relativeDayLabel('2027-01-01', '2026-12-31'), 'Tomorrow');
  assert.equal(relativeDayLabel('2024-02-29', '2024-03-01'), 'Yesterday');
  assert.equal(relativeDayLabel('2026-09-08', '2026-09-08'), 'Today');
});
void test('required custom 15km inputs preserve canonical values with and without pace', () => {
  const today = todayInZone('Europe/Vilnius');
  for (const pace of [parsePaceText('6:00'), null]) {
    const p = {
      ...demoProfile(today),
      goal: 'custom',
      raceDistanceKm: 15,
      startDate: today,
      raceDate: addDays(today, 104),
      weeklyKm: 30,
      longestKm: 10,
      currentRuns: 4,
      days: [0, 2, 4, 6],
      longDay: 6,
      weekdayMinutes: 60,
      longMinutes: 100,
      timezone: 'Europe/Vilnius',
      easyPace: pace,
      runMeasure: 'time',
    };
    const plan = makePlan(p);
    for (const key of [
      'raceDistanceKm',
      'weeklyKm',
      'longestKm',
      'currentRuns',
      'weekdayMinutes',
      'longMinutes',
      'timezone',
      'easyPace',
    ])
      assert.equal(plan.profile[key], p[key]);
    assert.equal(
      plan.workouts.find((w) => w.kind === 'race').steps[0].metres,
      15000,
    );
    if (pace === null)
      assert.ok(
        plan.workouts
          .filter((w) => w.kind !== 'race')
          .every((w) => w.distanceEstimate.lowerKm === null),
      );
  }
});

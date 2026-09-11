import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  makePlan,
  demoProfile,
  addDays,
  validatePlan,
  preparationRequirements,
  MAX_EVENT_KM,
  eventDistanceDisplay,
  revisePreferences,
  dayDiff,
  adjustPlan,
} from '../lib/engine.ts';
import {
  isLongUltra,
  longUltraCapacity,
  MAX_RECORDED_MINUTES,
} from '../lib/ultra-policy.ts';
import { encodeWorkout } from '../lib/fit.ts';
import { Decoder, Stream } from '@garmin/fitsdk';
import { validateRecovery } from '../lib/recovery.ts';
import { validateRun } from '../lib/run-input.ts';
import { exportCalendar } from '../lib/calendar.ts';
import { avoidRecordedOverlap, changeEvent } from '../lib/event-transition.ts';
import { currentTrainingBaseline } from '../lib/training-history.ts';
import { workoutGuidance } from '../lib/coaching-context.ts';
const start = '2026-09-07';
const profile = (patch = {}) => ({
  ...demoProfile(start),
  goal: 'ultra',
  raceDistanceKm: MAX_EVENT_KM,
  startDate: start,
  raceDate: addDays(start, 223),
  weeklyKm: 90,
  longestKm: 30,
  currentRuns: 5,
  days: [0, 1, 2, 3, 5],
  availableDays: [0, 1, 2, 3, 4, 5, 6],
  runsPerWeek: 5,
  longDay: 5,
  weekdayMinutes: 120,
  longMinutes: 240,
  easyPace: 6,
  recentQualitySessions: 2,
  qualityMode: 'automatic',
  stableWeeks: 16,
  ultraWeeklyMinutes: 540,
  ultraLongestMinutes: 180,
  ...patch,
});
const make = (patch = {}) => makePlan(profile(patch), start, false);

void test('ultra policy can load before the engine without circular initialization', () => {
  const result = spawnSync(
    process.execPath,
    [
      '--experimental-strip-types',
      '--input-type=module',
      '-e',
      `await import(${JSON.stringify(new URL('../lib/ultra-policy.ts', import.meta.url).href)})`,
    ],
    { encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr);
});

void test('ultra preparation counts actual extra runs once on their recorded date', () => {
  const raceDate = '2027-04-18';
  const date = addDays(raceDate, -60);
  const asOf = addDays(raceDate, -40);
  const feedback = {
    actualDate: date,
    actualMinutes: 60,
    actualKm: null,
    effort: 3,
    feeling: 'good',
    note: '',
    recordedAt: date + 'T18:00:00Z',
    activityId: 'same-imported-run',
  };
  const extra = {
    id: 'extra',
    date,
    minutes: 60,
    km: null,
    ...feedback,
  };
  const plan = {
    profile: { raceDate },
    workouts: [],
    extraRuns: [extra, { ...extra, id: 'duplicate-extra' }],
  };
  assert.deepEqual(
    longUltraCapacity(plan, asOf).weeklyMinutes,
    [60, 0, 0, 0, 0, 0],
  );
  const completed = {
    id: 'completed',
    week: -1,
    kind: 'easy',
    status: 'completed',
    date: addDays(raceDate, -70),
    minutes: 90,
    feedback,
  };
  plan.workouts = [completed, { ...completed, id: 'archived-duplicate' }];
  const before = structuredClone(plan);
  assert.deepEqual(
    longUltraCapacity(plan, asOf).weeklyMinutes,
    [60, 0, 0, 0, 0, 0],
  );
  assert.deepEqual(
    longUltraCapacity(plan, asOf),
    longUltraCapacity(plan, asOf),
  );
  assert.deepEqual(plan, before);
  // A correction to the actual date must win over the old prescription/extra copy.
  completed.feedback.actualDate = addDays(raceDate, -50);
  assert.deepEqual(
    longUltraCapacity(plan, asOf).weeklyMinutes,
    [0, 60, 0, 0, 0, 0],
  );
  completed.feedback.actualDate = addDays(raceDate, -64);
  assert.equal(longUltraCapacity(plan, asOf).averageMinutes, 0);
});

void test('ultra checkpoint separates actual running from future active prescriptions', () => {
  const raceDate = '2027-04-18',
    asOf = addDays(raceDate, -42);
  const planned = (id, date, patch = {}) => ({
    id,
    date,
    week: 2,
    kind: 'easy',
    status: 'planned',
    minutes: 45,
    ...patch,
  });
  const recorded = (id, date, patch = {}) =>
    planned(id, date, {
      status: 'completed',
      feedback: {
        actualDate: date,
        actualMinutes: 60,
        actualKm: null,
        effort: 3,
        feeling: 'good',
        note: '',
        recordedAt: date + 'T18:00:00Z',
      },
      ...patch,
    });
  const plan = {
    profile: { raceDate },
    workouts: [
      recorded('actual-today', asOf),
      planned('later-today', asOf),
      planned('future', addDays(asOf, 7)),
      planned('last-valid-day', addDays(raceDate, -22)),
      recorded('first-valid-day', addDays(raceDate, -63)),
      recorded('too-early', addDays(raceDate, -64)),
      recorded('future-actual', addDays(asOf, 1)),
      planned('taper', addDays(raceDate, -21)),
      planned('unlogged-past', addDays(asOf, -1)),
      planned('archived-prescription', asOf, { week: -1 }),
      planned('skipped', asOf, { status: 'skipped' }),
      planned('race-prescription', asOf, { kind: 'race' }),
      recorded('race-record', addDays(asOf, -1), { kind: 'race' }),
    ],
    extraRuns: [],
  };
  assert.deepEqual(
    longUltraCapacity(plan, asOf).weeklyMinutes,
    [60, 0, 0, 105, 45, 45],
  );
  assert.equal(longUltraCapacity(plan, asOf).fits, false);
});

void test('an imported race cannot count as ultra preparation through another ledger entry', () => {
  const raceDate = '2027-04-18',
    date = addDays(raceDate, -45);
  const feedback = {
    actualDate: date,
    actualMinutes: 300,
    actualKm: 50,
    effort: 7,
    feeling: 'good',
    note: '',
    recordedAt: date + 'T18:00:00Z',
    activityId: 'linked-race',
  };
  const run = {
    id: 'mislinked-easy',
    kind: 'easy',
    week: -1,
    status: 'completed',
    date,
    minutes: 300,
    feedback,
  };
  const race = { ...run, id: 'race', kind: 'race' };
  for (const workouts of [
    [run, race],
    [race, run],
  ]) {
    const plan = {
      profile: { raceDate },
      workouts,
      extraRuns: [{ id: 'extra', date, minutes: 300, km: 50, ...feedback }],
    };
    assert.equal(longUltraCapacity(plan, date).averageMinutes, 0);
  }
});

for (const distance of [100, 120, 160.9344])
  for (const days of [5, 6, 7])
    void test(`${distance} km preserves ${days} running days with bounded ultra structure`, () => {
      const p = make({
        raceDistanceKm: distance,
        runsPerWeek: days,
        currentRuns: days,
      });
      assert.deepEqual(validatePlan(p), []);
      assert.ok(longUltraCapacity(p).fits);
      for (const week of p.weeks) {
        const runs = p.workouts.filter(
          (w) => w.week === week.index && w.kind !== 'race',
        );
        if (
          week.start >= start &&
          dayDiff(addDays(week.start, 6), p.profile.raceDate) > 7
        )
          assert.equal(new Set(runs.map((w) => w.date)).size, days);
        assert.ok(runs.filter((w) => w.hard).length <= 1);
        assert.ok(runs.every((w) => !w.pairId));
        assert.ok(
          runs.every((w) => w.minutes <= (w.kind === 'long' ? 240 : 120)),
        );
      }
      const first = p.workouts.filter((w) => w.week === 0);
      assert.ok(first.reduce((n, w) => n + w.minutes, 0) <= 540);
      assert.ok(first.find((w) => w.kind === 'long').minutes <= 180);
      const race = p.workouts.find((w) => w.kind === 'race');
      assert.equal(race.steps[0].metres, Math.round(distance * 10000) / 10);
    });
void test('100-mile exact bounds and stronger prerequisites preserve the 50-mile anchor', () => {
  assert.equal(MAX_EVENT_KM, 160.9344);
  assert.equal(eventDistanceDisplay(MAX_EVENT_KM, 'mi'), '100');
  assert.equal(isLongUltra(profile({ raceDistanceKm: 80.4672 })), false);
  assert.deepEqual(
    preparationRequirements(profile({ raceDistanceKm: 80.4672 })),
    preparationRequirements(profile({ raceDistanceKm: 80 })),
  );
  assert.equal(preparationRequirements(profile()).recommendedDays, 195);
  assert.equal(
    preparationRequirements(profile({ raceDistanceKm: 100 })).recommendedDays,
    167,
  );
  for (const [patch, message] of [
    [{ raceDistanceKm: 160.9345 }, /100 miles/],
    [{ weeklyKm: 55 }, /baseline/],
    [{ stableWeeks: 6 }, /12 weeks/],
    [{ raceTerrain: 'mountain' }, /mountain/],
    [{ ultraWeeklyMinutes: undefined }, /running minutes/],
    [{ method: 'double-threshold' }, /single runs/],
    [{ qualityMode: 'custom', qualitySessions: 2 }, /zero or one/],
  ])
    assert.throws(() => make(patch), message);
  assert.throws(() => make({ weekdayMinutes: 60 }), /six weeks before taper/);
  assert.throws(() => make({ longMinutes: 160 }), /180 minutes/);
});
void test('custom 100 miles receives the same prescriptions and race exports', () => {
  const p = make(),
    other = make({ goal: 'custom' });
  assert.deepEqual(
    p.workouts.map(({ reason: _reason, ...w }) => w),
    other.workouts.map(({ reason: _reason, ...w }) => w),
  );
  const race = p.workouts.find((w) => w.kind === 'race');
  const result = new Decoder(Stream.fromByteArray(encodeWorkout(race))).read();
  assert.deepEqual(result.errors, []);
  assert.equal(result.messages.workoutStepMesgs[0].durationDistance, 160934.4);
  const ics = exportCalendar(p, start, 1).replace(/\r\n /g, '');
  assert.match(ics, /SUMMARY:.*160\.9344 km/);
  assert.doesNotMatch(ics, /SUMMARY:.*race day.* min/);
  const longest = p.workouts
    .filter((w) => w.kind === 'long')
    .sort((a, b) => b.minutes - a.minutes)[0];
  assert.ok(workoutGuidance(p, longest).some((n) => n.includes('walk breaks')));
});
for (let offset = 0; offset < 7; offset++)
  void test(`100-mile taper stays reduced with race weekday offset ${offset}`, () => {
    const p = make({ raceDate: addDays(start, 217 + offset) });
    const race = p.workouts.find((w) => w.kind === 'race');
    for (const w of p.workouts.filter(
      (w) => w.kind !== 'race' && dayDiff(w.date, race.date) <= 14,
    )) {
      assert.ok(w.minutes <= (w.kind === 'long' ? 120 : 120));
    }
    const firstTaper = p.weeks.findIndex((w) => w.phase === 'Taper');
    const ref = p.weeks
      .slice(0, firstTaper)
      .findLast((w) => w.phase !== 'Recovery');
    for (const w of p.weeks.filter((w) => w.phase === 'Taper'))
      assert.ok(w.trainingMinutes < ref.trainingMinutes);
  });
void test('lower availability flags the long-ultra forecast without raising volume', () => {
  const p = make();
  const next = revisePreferences(p, { weekdayMinutes: 65 }, start);
  assert.equal(next.feasibility.status, 'review-required');
  assert.ok(next.feasibility.reasons.some((s) => s.includes('six weeks')));
  assert.ok(
    next.workouts
      .filter((w) => w.kind !== 'race')
      .reduce((n, w) => n + w.minutes, 0) <=
      p.workouts
        .filter((w) => w.kind !== 'race')
        .reduce((n, w) => n + w.minutes, 0),
  );
});
void test('slow 100-mile placeholder and 30-hour actual survive recovery without widening ordinary prescription caps', () => {
  const p = make({
    easyPace: 15,
    ultraWeeklyMinutes: 1000,
    ultraLongestMinutes: 300,
  });
  const raw = {
    format: 'stride-recovery-2',
    exportedAt: start + 'T18:00:00Z',
    profile: null,
    plan: p,
  };
  assert.doesNotThrow(() => validateRecovery(structuredClone(raw)));
  const old = p.workouts.find((w) => w.kind === 'race');
  p.workouts.push({
    ...structuredClone(old),
    id: 'previous-100-mile',
    week: -1,
    date: start,
    originalDate: start,
    status: 'completed',
    feedback: {
      actualDate: start,
      actualMinutes: 1800,
      actualKm: 160.9344,
      effort: 8,
      feeling: 'tired',
      note: 'Synthetic 30-hour race',
      recordedAt: start + 'T18:00:00Z',
    },
  });
  assert.doesNotThrow(() => validateRecovery(structuredClone(raw)));
  assert.doesNotThrow(() =>
    validateRun(
      {
        date: start,
        minutes: 1800,
        km: 160.9344,
        effort: 8,
        feeling: 'tired',
        note: '',
      },
      start,
    ),
  );
  assert.throws(() =>
    validateRun(
      {
        date: start,
        minutes: MAX_RECORDED_MINUTES + 1,
        km: 160.9344,
        effort: 8,
        feeling: 'tired',
        note: '',
      },
      start,
    ),
  );
  const ordinary = p.workouts.find((w) => w.kind !== 'race');
  ordinary.minutes = 1600;
  ordinary.steps = [
    { label: 'Easy', seconds: 96000, effort: 'Easy', intensity: 2 },
  ];
  assert.throws(() => validateRecovery(raw), /prescribed duration/);
});
void test('both new-block routes retain recovery after a completed long ultra', () => {
  const previous = make({
    weeklyKm: 70,
    ultraWeeklyMinutes: 490,
    ultraLongestMinutes: 210,
    easyPace: 7,
  });
  previous.workouts = [
    {
      ...previous.workouts.find((w) => w.kind === 'race'),
      week: -1,
      id: 'completed-ultra',
      date: start,
      originalDate: start,
      status: 'completed',
      feedback: {
        actualDate: start,
        actualMinutes: 1800,
        actualKm: 160.9344,
        effort: 8,
        feeling: 'tired',
        note: '',
        recordedAt: start + 'T18:00:00Z',
      },
    },
  ];
  const nextDay = addDays(start, 1);
  const candidate = makePlan(
    { ...demoProfile(nextDay), goal: 'base', raceDate: addDays(nextDay, 55) },
    nextDay,
    false,
  );
  for (const next of [
    avoidRecordedOverlap(candidate, previous, [], nextDay),
    changeEvent(
      previous,
      {
        goal: 'base',
        raceName: 'Recover',
        raceDate: addDays(nextDay, 55),
        raceTerrain: 'road',
      },
      nextDay,
    ),
  ]) {
    assert.ok(next.returnState);
    assert.ok(
      next.workouts
        .filter((w) => w.date >= nextDay && w.date < addDays(start, 21))
        .every((w) => w.status === 'skipped'),
    );
  }
});

void test('measured ultra time is preserved in fallback and recovery baselines', () => {
  const p = make({
    easyPace: 10,
    ultraWeeklyMinutes: 540,
    ultraLongestMinutes: 180,
  });
  const b = currentTrainingBaseline(p, start);
  assert.equal(b.weeklyMinutes, 540);
  assert.equal(b.longestMinutes, 180);
  const next = adjustPlan(p, start, addDays(start, 3), 'rest', start);
  assert.equal(next.returnState.baselineMinutes, 540);
  assert.equal(next.returnState.longestMinutes, 180);
});
void test('replanning merges completed checkpoint weeks before evaluating capacity', () => {
  const p = make();
  const asOf = addDays(start, 190);
  for (const w of p.workouts.filter((w) => w.date < asOf && w.kind !== 'race'))
    Object.assign(w, {
      status: 'completed',
      feedback: {
        actualDate: w.date,
        actualMinutes: w.minutes,
        actualKm: w.estimatedKm,
        effort: w.hard ? 5 : 3,
        feeling: 'good',
        note: 'Synthetic training',
        recordedAt: w.date + 'T18:00:00Z',
      },
    });
  const next = revisePreferences(p, { weekdayMinutes: 120 }, asOf, true);
  assert.ok(longUltraCapacity(next, asOf).fits);
  assert.ok(
    !next.feasibility.reasons.some((r) =>
      r.startsWith('The six weeks before taper'),
    ),
  );
});
void test('historical-start restart and a newer short race cannot bypass long-ultra recovery', () => {
  const previous = make({
    weeklyKm: 70,
    ultraWeeklyMinutes: 490,
    ultraLongestMinutes: 210,
    easyPace: 7,
  });
  const template = previous.workouts.find((w) => w.kind === 'race');
  previous.workouts = [
    {
      ...template,
      id: 'hundred',
      week: -1,
      date: start,
      originalDate: start,
      status: 'completed',
      feedback: {
        actualDate: start,
        actualMinutes: 1800,
        actualKm: 160.9344,
        effort: 8,
        feeling: 'tired',
        note: '',
        recordedAt: start + 'T18:00:00Z',
      },
    },
    {
      ...template,
      id: 'short',
      week: -1,
      date: addDays(start, 2),
      originalDate: addDays(start, 2),
      estimatedKm: 5,
      status: 'completed',
      feedback: {
        actualDate: addDays(start, 2),
        actualMinutes: 30,
        actualKm: 5,
        effort: 5,
        feeling: 'okay',
        note: '',
        recordedAt: addDays(start, 2) + 'T18:00:00Z',
      },
    },
  ];
  const asOf = addDays(start, 3);
  const earlier = addDays(start, -7);
  const candidate = makePlan(
    { ...demoProfile(earlier), goal: 'base', raceDate: addDays(start, 55) },
    asOf,
    false,
  );
  for (const next of [
    avoidRecordedOverlap(candidate, previous, [], asOf),
    changeEvent(
      previous,
      {
        goal: 'base',
        raceName: 'Recover',
        raceDate: addDays(start, 55),
        raceTerrain: 'road',
      },
      asOf,
    ),
  ]) {
    assert.ok(next.returnState);
    assert.ok(
      next.workouts
        .filter((w) => w.date >= asOf && w.date < addDays(start, 21))
        .every((w) => w.status === 'skipped'),
    );
  }
});

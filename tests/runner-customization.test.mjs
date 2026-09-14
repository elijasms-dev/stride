import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makePlan,
  demoProfile,
  addDays,
  validateProfile,
  validatePlan,
  revisePreferences,
  moveWorkout,
  weekday,
} from '../lib/engine.ts';
import {
  runningDayLimit,
  applyPreferredStartTimes,
} from '../lib/runner-customization.ts';
import { qualitySchedule } from '../lib/training-structure.ts';
const start = '2026-09-07';
const marathon = (patch = {}) => ({
  ...demoProfile(start),
  goal: 'marathon',
  weeklyKm: 70,
  longestKm: 25,
  currentRuns: 5,
  runsPerWeek: 5,
  availableDays: [0, 1, 2, 3, 4, 5, 6],
  longDay: 5,
  weekdayMinutes: 120,
  longMinutes: 210,
  recentQualitySessions: 2,
  recentQualityMinutes: 40,
  qualityMode: 'automatic',
  method: 'balanced',
  raceDate: addDays(start, 139),
  easyPace: 6,
  workoutTargets: {
    mode: 'pace',
    pace: {
      easy: { low: 330, high: 390 },
      tempo: { low: 270, high: 300 },
      interval: { low: 240, high: 270 },
      race: { low: 300, high: 330 },
    },
    raceScope: 'marathon:',
  },
  ...patch,
});
const base = (patch = {}) => ({
  ...marathon(),
  goal: 'base',
  raceName: 'Base block',
  raceDate: addDays(start, 55),
  weeklyKm: 20,
  longestKm: 7,
  currentRuns: 4,
  runsPerWeek: 4,
  weekdayMinutes: 60,
  longMinutes: 100,
  recentQualitySessions: 0,
  workoutTargets: { mode: 'effort' },
  ...patch,
});
const generate = (p) => makePlan(p, start, false);
const training = (p) =>
  p.workouts.filter((w) => w.kind !== 'race' && w.status !== 'skipped');
const sum = (ws) => ws.reduce((n, w) => n + w.minutes, 0);

void test('omitted new preferences retain existing prescriptions', () => {
  const original = generate(marathon());
  const explicit = generate(
    marathon({
      dayPreferences: [],
      weeklyMinutesLimit: null,
      workoutFormat: 'automatic',
      workoutVariety: 'varied',
    }),
  );
  assert.deepEqual(explicit.workouts, original.workouts);
});

void test('custom days and weekly time ceilings tailor a five-day marathon without expanding availability into runs', () => {
  const p = generate(
    marathon({
      weeklyMinutesLimit: 480,
      dayPreferences: [
        { day: 1, maxMinutes: 35, startTime: '06:30' },
        { day: 2, maxMinutes: 45 },
        { day: 3, maxMinutes: 75 },
        { day: 5, maxMinutes: 180, startTime: '08:00' },
      ],
    }),
  );
  assert.deepEqual(validatePlan(p), []);
  assert.equal(p.profile.days.length, 5);
  for (const week of p.weeks) {
    const ws = training(p).filter((w) => w.week === week.index);
    assert.ok(sum(ws) <= 480.01);
    assert.ok(new Set(ws.map((w) => w.date)).size <= 5);
  }
  for (const w of training(p)) {
    assert.ok(w.minutes <= runningDayLimit(p.profile, weekday(w.date)) + 0.01);
    if (weekday(w.date) === 1) assert.equal(w.startTime, '06:30');
    if (weekday(w.date) === 5) assert.equal(w.startTime, '08:00');
  }
  const original = generate(marathon());
  // Busy-day constraints are applied before allocation so the guaranteed tempo
  // and long run can share the same funded week across the available days.
  assert.ok(
    sum(training(p).filter((w) => w.week === 0)) <=
      sum(training(original).filter((w) => w.week === 0)),
    'Redistribution must not increase the opening weekly workload',
  );
  assert.deepEqual(validatePlan(p), []);
});

void test('short busy days are not selected for full quality workouts', () => {
  const p = validateProfile(
    marathon({ dayPreferences: [{ day: 1, maxMinutes: 20 }] }),
  );
  assert.equal(qualitySchedule(p).includes(1), false);
  assert.equal(p.days.length, 5);
});

void test('a weekly time ceiling can deliberately lower a base block below declared distance', () => {
  const p = generate(base({ weeklyMinutesLimit: 90 }));
  assert.deepEqual(validatePlan(p), []);
  assert.ok(
    p.weeks.every(
      (week) => sum(training(p).filter((w) => w.week === week.index)) <= 90,
    ),
  );
  assert.equal(
    p.profile.weeklyKm,
    20,
    'Capacity must not rewrite the reported baseline',
  );
});

void test('midweek review preserves history, reduces upcoming work and does not refill time when ceilings are cleared', () => {
  const p = generate(base());
  const first = p.workouts[0];
  first.status = 'completed';
  first.feedback = {
    actualMinutes: first.minutes,
    actualKm: first.estimatedKm,
    effort: 3,
    feeling: 'good',
    note: '',
    recordedAt: start,
  };
  const cutoff = addDays(start, 2),
    before = structuredClone(p.workouts.filter((w) => w.date < cutoff));
  const revised = revisePreferences(
    p,
    {
      weeklyMinutesLimit: 100,
      dayPreferences: [{ day: 3, maxMinutes: 20, startTime: '06:15' }],
    },
    cutoff,
  );
  assert.deepEqual(validatePlan(revised), []);
  assert.deepEqual(
    revised.workouts.filter((w) => w.date < cutoff),
    before,
  );
  for (const w of training(revised).filter(
    (w) => w.date >= cutoff && weekday(w.date) === 3,
  )) {
    assert.ok(w.minutes <= 20);
    assert.equal(w.startTime, '06:15');
  }
  const cleared = revisePreferences(
    revised,
    { weeklyMinutesLimit: null, dayPreferences: [] },
    cutoff,
  );
  for (const w of training(cleared).filter((w) => w.date >= cutoff)) {
    assert.ok(
      w.minutes <=
        revised.workouts.find((old) => old.id === w.id).minutes + 0.01,
    );
    if (weekday(w.date) === 3) assert.equal(w.startTime, undefined);
  }
});

void test('a ceiling below completed running cannot erase history or create a misleading preview', () => {
  const p = generate(base());
  const first = p.workouts[0];
  first.status = 'completed';
  first.feedback = {
    actualMinutes: 100,
    actualKm: 15,
    effort: 3,
    feeling: 'good',
    note: '',
    recordedAt: start,
  };
  const snapshot = structuredClone(p);
  assert.throws(
    () => revisePreferences(p, { weeklyMinutesLimit: 60 }, addDays(start, 1)),
    /ceiling|saved running/,
  );
  assert.deepEqual(p, snapshot);
});

void test('manual future edits are never silently shortened by daily limits', () => {
  const p = generate(base());
  const w = p.workouts.find((w) => weekday(w.date) === 3);
  w.changed = true;
  w.changeSource = 'manual';
  const snapshot = structuredClone(p);
  assert.throws(
    () =>
      revisePreferences(
        p,
        { dayPreferences: [{ day: 3, maxMinutes: 15 }] },
        start,
      ),
    /deliberate edit/,
  );
  assert.deepEqual(p, snapshot);
});

void test('moving a run applies the destination start time and refuses a too-small daily budget', () => {
  const p = generate(
    base({
      dayPreferences: [
        { day: 0, startTime: '06:00' },
        { day: 2, startTime: '18:30' },
      ],
    }),
  );
  const first = p.workouts.find((w) => w.date === start);
  const moved = moveWorkout(p, first.id, addDays(start, 2), start);
  assert.equal(
    moved.workouts.find((w) => w.id === first.id).startTime,
    '18:30',
  );
  const restricted = structuredClone(p);
  restricted.profile.dayPreferences.push({ day: 4, maxMinutes: 15 });
  assert.throws(
    () => moveWorkout(restricted, first.id, addDays(start, 4), start),
    /daily time ceiling/,
  );
});

void test('paired-day timing preserves the recovery gap and refuses an overnight spill', () => {
  const p = base({
    dayPreferences: [{ day: 1, startTime: '06:30' }],
    doubleGapHours: 8,
  });
  const pair = [
    {
      id: 'a',
      date: addDays(start, 1),
      kind: 'tempo',
      status: 'planned',
      pairId: 'pair',
      session: 'AM',
      minutes: 40,
    },
    {
      id: 'b',
      date: addDays(start, 1),
      kind: 'tempo',
      status: 'planned',
      pairId: 'pair',
      session: 'PM',
      minutes: 35,
    },
  ];
  assert.equal(applyPreferredStartTimes(pair, p), null);
  assert.equal(pair[0].startTime, '06:30');
  assert.equal(pair[1].startTime, '15:10');
  assert.match(
    applyPreferredStartTimes(structuredClone(pair), {
      ...p,
      dayPreferences: [{ day: 1, startTime: '18:00' }],
    }),
    /midnight/,
  );
});

void test('timed and measured preferences change real workout steps while familiar mode retains progression', () => {
  const timed = generate(
    marathon({ workoutFormat: 'time', runMeasure: 'time' }),
  );
  const measured = generate(marathon({ workoutFormat: 'distance' }));
  const familiar = generate(marathon({ workoutVariety: 'familiar' }));
  for (const p of [timed, measured, familiar])
    assert.deepEqual(validatePlan(p), []);
  assert.equal(
    training(timed).some((w) => w.steps.some((s) => s.metres)),
    false,
  );
  assert.ok(training(measured).some((w) => w.steps.some((s) => s.metres)));
  const formats = (p) =>
    new Set(
      training(p)
        .filter((w) => w.hard)
        .map((w) => w.templateId),
    ).size;
  assert.ok(formats(familiar) < formats(measured));
  assert.ok(
    new Set(
      training(familiar)
        .filter((w) => w.hard)
        .map((w) => w.qualityMinutes),
    ).size > 2,
  );
  assert.deepEqual(
    training(timed).map((w) => w.date),
    training(measured).map((w) => w.date),
  );
});

void test('measured preference falls back to timed sessions when pace targets are unknown', () => {
  const p = generate(
    marathon({
      workoutFormat: 'distance',
      runMeasure: 'time',
      workoutTargets: { mode: 'effort' },
    }),
  );
  assert.deepEqual(validatePlan(p), []);
  assert.equal(
    training(p).some((w) => w.steps.some((s) => s.metres)),
    false,
  );
});

void test('explicit clear survives JSON preview/save while omission and zero have different meanings', () => {
  const p = generate(marathon());
  const cleared = revisePreferences(
    p,
    JSON.parse(
      JSON.stringify({
        recentQualitySessions: null,
        recentQualityMinutes: null,
        easyDoubleWeeks: null,
        doubleGapHours: null,
      }),
    ),
    start,
  );
  assert.equal(cleared.profile.recentQualitySessions, undefined);
  assert.equal(cleared.profile.recentQualityMinutes, undefined);
  const reloaded = JSON.parse(JSON.stringify(cleared));
  assert.equal(reloaded.profile.recentQualitySessions, undefined);
  assert.equal(
    revisePreferences(p, {}, start).profile.recentQualitySessions,
    2,
  );
  assert.equal(
    revisePreferences(
      p,
      { recentQualitySessions: 0, recentQualityMinutes: 0 },
      start,
    ).profile.recentQualitySessions,
    0,
  );
});

for (const patch of [
  { weeklyMinutesLimit: 0 },
  { weeklyMinutesLimit: Infinity },
  { weeklyMinutesLimit: '120' },
  { dayPreferences: [{ day: 1, maxMinutes: 10 }] },
  { dayPreferences: [{ day: 7 }] },
  { dayPreferences: [{ day: 1 }, { day: 1 }] },
  { dayPreferences: [{ day: 0, startTime: '25:00' }] },
  { dayPreferences: [null] },
  { workoutFormat: 'sprints' },
  { workoutVariety: 'random' },
])
  void test(`invalid custom input is rejected: ${JSON.stringify(patch)}`, () => {
    assert.throws(
      () => generate(base(patch)),
      /ceiling|weekday|repetitions|formats/,
    );
  });

const extra = (patch = {}) => ({
  id: 'extra',
  date: addDays(start, 1),
  minutes: 60,
  km: 8,
  effort: 3,
  feeling: 'good',
  note: 'Synthetic extra running',
  recordedAt: start,
  ...patch,
});
void test('weekly reviews reserve extra running and reject ceilings below recorded time', () => {
  const p = generate(base());
  p.extraRuns = [extra()];
  const next = revisePreferences(
    p,
    { weeklyMinutesLimit: 150 },
    addDays(start, 2),
  );
  assert.ok(sum(training(next).filter((w) => w.week === 0)) + 60 <= 150);
  assert.deepEqual(next.extraRuns, p.extraRuns);
  p.extraRuns = [extra({ minutes: 180 })];
  assert.throws(
    () => revisePreferences(p, { weeklyMinutesLimit: 150 }, addDays(start, 2)),
    /saved running/,
  );
});
void test('carried completions reserve time on their actual calendar date and duplicate activities count once', () => {
  const p = generate(base());
  const archived = {
    ...structuredClone(p.workouts[0]),
    id: 'archived',
    week: -1,
    date: addDays(start, -7),
    status: 'completed',
    minutes: 40,
    feedback: {
      actualDate: addDays(start, 1),
      actualMinutes: 40,
      actualKm: 6,
      effort: 3,
      feeling: 'good',
      note: '',
      recordedAt: start,
      activityId: 'same-record',
    },
  };
  p.workouts.push(archived);
  p.extraRuns = [extra({ minutes: 40, activityId: 'same-record' })];
  const withoutDuplicate = structuredClone(p);
  withoutDuplicate.extraRuns = [];
  const next = revisePreferences(
    p,
    { weeklyMinutesLimit: 150 },
    addDays(start, 2),
  );
  const control = revisePreferences(
    withoutDuplicate,
    { weeklyMinutesLimit: 150 },
    addDays(start, 2),
  );
  assert.ok(sum(training(next).filter((w) => w.week === 0)) + 40 <= 150);
  assert.deepEqual(next.workouts, control.workouts);
  assert.deepEqual(
    next.workouts.find((w) => w.id === 'archived'),
    archived,
  );
});
void test('a daily review reserves extra runs recorded on that actual day', () => {
  const p = generate(base());
  p.extraRuns = [extra({ date: addDays(start, 3), minutes: 20 })];
  const next = revisePreferences(
    p,
    { dayPreferences: [{ day: 3, maxMinutes: 35 }] },
    addDays(start, 3),
  );
  assert.ok(
    sum(training(next).filter((w) => w.date === addDays(start, 3))) + 20 <= 35,
  );
});
void test('logging actual overruns never invalidates the saved prescriptions', () => {
  const p = generate(base({ weeklyMinutesLimit: 100 })),
    first = p.workouts[0];
  first.status = 'completed';
  first.feedback = {
    actualMinutes: 150,
    actualKm: 20,
    effort: 3,
    feeling: 'good',
    note: '',
    recordedAt: start,
  };
  p.extraRuns = [extra({ minutes: 60 })];
  assert.deepEqual(validatePlan(p), []);
});
void test('an unrelated review keeps an in-progress pair’s saved timing', () => {
  const p = generate(
    marathon({
      method: 'easy-doubles',
      stableWeeks: 8,
      recentSessionsPerWeek: 5,
      doubleDays: [2],
      dayPreferences: [{ day: 2, startTime: '06:00' }],
    }),
  );
  const am = p.workouts.find((w) => w.pairId && w.session === 'AM');
  assert.ok(am);
  const pm = p.workouts.find(
    (w) => w.pairId === am.pairId && w.session === 'PM',
  );
  am.status = 'completed';
  am.feedback = {
    actualMinutes: am.minutes,
    actualKm: am.estimatedKm,
    effort: 3,
    feeling: 'good',
    note: '',
    recordedAt: am.date,
  };
  const next = revisePreferences(p, { weeklyMinutesLimit: 550 }, am.date);
  assert.deepEqual(validatePlan(next), []);
  assert.deepEqual(
    next.workouts.find((w) => w.id === am.id),
    am,
  );
  assert.equal(
    next.workouts.find((w) => w.id === pm.id).startTime,
    pm.startTime,
  );
  assert.throws(
    () =>
      revisePreferences(
        p,
        { dayPreferences: [{ day: 2, startTime: '07:00' }] },
        am.date,
      ),
    /already started/,
  );
});

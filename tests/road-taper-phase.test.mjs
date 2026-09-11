import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  dayDiff,
  demoProfile,
  makePlan,
  taperFactor,
  trainingPhaseOn,
  validatePlan,
  refreshWorkoutVariety,
  revisePreferences,
} from '../lib/engine.ts';
import { supportingSession, workoutGuidance } from '../lib/coaching-context.ts';
import { applyAdvancedMethod } from '../lib/advanced-methods.ts';

const start = '2026-09-07';
const input = (patch = {}) => ({
  ...demoProfile(start),
  goal: 'custom',
  raceDistanceKm: 15,
  raceDate: '2026-11-29',
  name: 'Synthetic custom-road runner',
  weeklyKm: 50,
  longestKm: 18,
  currentRuns: 5,
  runsPerWeek: 5,
  availableDays: [0, 1, 2, 3, 4, 5, 6],
  days: [0, 1, 2, 3, 5],
  longDay: 5,
  easyPace: 6,
  weekdayMinutes: 120,
  longMinutes: 150,
  experience: 'established',
  qualitySessions: 2,
  recentQualitySessions: 2,
  recentQualityMinutes: 30,
  intent: 'improve',
  volume: 'maintain',
  ...patch,
});
const make = (patch) => makePlan(input(patch), start);
const training = (plan) => plan.workouts.filter((w) => w.kind !== 'race');

for (const raceDistanceKm of [5, 8, 15]) {
  test(`${raceDistanceKm}K boundary week retains training before its actual taper`, () => {
    const plan = make({
      raceDistanceKm,
      crossTraining: [{ day: 4, activity: 'cycling', minutes: 40 }],
    });
    const week = plan.weeks.find((w) => w.start === '2026-11-09');
    assert.equal(week.phase, 'Race preparation');
    assert.match(week.focus, /Taper begins on 15 Nov/);
    const sessions = training(plan).filter((w) => w.week === week.index);
    assert.ok(sessions.every((w) => taperFactor(plan.profile, w.date) === 1));
    assert.ok(
      sessions
        .filter((w) => w.hard)
        .reduce((sum, w) => sum + w.qualityMinutes, 0) > 11,
    );
    assert.ok(sessions.every((w) => !/Taper ·/.test(w.reason)));
    assert.equal(supportingSession(plan, '2026-11-13').minutes, 40);
    assert.equal(supportingSession(plan, '2026-11-20').minutes, 20);
    assert.deepEqual(validatePlan(plan), []);
  });
}

for (let weekday = 0; weekday < 7; weekday++) {
  test(`road preparation uses actual dates for race weekday ${weekday}`, () => {
    for (const event of [
      { goal: '5k' },
      { goal: '10k' },
      { goal: 'custom', raceDistanceKm: 7.5 },
      { goal: 'custom', raceDistanceKm: 7.5001 },
      { goal: 'custom', raceDistanceKm: 8 },
      { goal: 'custom', raceDistanceKm: 15 },
      { goal: 'custom', raceDistanceKm: 15.0001 },
      { goal: 'custom', raceDistanceKm: 16.09344 },
      { goal: 'custom', raceDistanceKm: 30 },
    ]) {
      const plan = make({ ...event, raceDate: addDays('2026-11-23', weekday) });
      for (const w of training(plan)) {
        const phase = trainingPhaseOn(
          plan.profile,
          plan.weeks[w.week].phase,
          w.date,
        );
        assert.equal(
          ['Taper', 'Race week'].includes(phase),
          taperFactor(plan.profile, w.date) < 1,
          `${event.goal}/${event.raceDistanceKm} ${w.date}`,
        );
        if (dayDiff(w.date, plan.profile.raceDate) <= 2)
          assert.equal(w.hard, false);
        assert.equal(
          w.steps.reduce((n, s) => n + s.seconds, 0),
          w.minutes * 60,
        );
      }
      for (const week of plan.weeks)
        if (week.phase === 'Taper')
          assert.ok(taperFactor(plan.profile, week.start) < 1);
      assert.deepEqual(validatePlan(plan), []);
    }
  });
}

test('native/custom short-road taper lengths and longer event models retain their current factors', () => {
  for (const [event, length] of [
    [{ goal: '5k' }, 14],
    [{ goal: '10k' }, 14],
    [{ goal: 'custom', raceDistanceKm: 15 }, 14],
    [{ goal: 'custom', raceDistanceKm: 16.09344 }, 21],
    [{ goal: 'half' }, 21],
    [{ goal: 'custom', raceDistanceKm: 35 }, 21],
    [{ goal: 'ultra', raceDistanceKm: 50 }, 21],
  ]) {
    const p = input(event);
    assert.equal(taperFactor(p, addDays(p.raceDate, -length - 1)), 1);
    assert.ok(taperFactor(p, addDays(p.raceDate, -length)) < 1);
    assert.equal(taperFactor(p, addDays(p.raceDate, -14)), 0.65);
    assert.equal(taperFactor(p, addDays(p.raceDate, -7)), 0.4);
  }
});

test('short blocks accept every date without shifting taper to their calendar Monday', () => {
  for (const distance of [5, 8, 15, 16.09344])
    for (let offset = 0; offset < 7; offset++)
      for (const span of [0, 1, 6, 13, 14, 15, 20, 21]) {
        const startDate = addDays(start, offset),
          p = input({
            raceDistanceKm: distance,
            startDate,
            raceDate: addDays(startDate, span),
          }),
          plan = makePlan(p, startDate);
        assert.ok(
          plan.workouts.every(
            (w) => w.date >= startDate && w.date <= p.raceDate,
          ),
        );
        for (const w of training(plan))
          assert.equal(
            ['Taper', 'Race week'].includes(
              trainingPhaseOn(plan.profile, plan.weeks[w.week].phase, w.date),
            ),
            taperFactor(plan.profile, w.date) < 1,
          );
        assert.deepEqual(validatePlan(plan), []);
      }
});

test('the Sunday boundary reduces supporting work on Sunday, not six days earlier', () => {
  const plan = make({
    crossTraining: [{ day: 6, activity: 'cycling', minutes: 40 }],
  });
  assert.equal(supportingSession(plan, '2026-11-08').minutes, 40);
  assert.equal(supportingSession(plan, '2026-11-15').minutes, 20);
});

test('refresh keeps real taper sessions and their familiar anchors, including a mixed week', () => {
  const plan = make({ raceDate: '2026-11-25' }),
    before = structuredClone(plan);
  const tapered = training(plan).filter(
    (w) => taperFactor(plan.profile, w.date) < 1,
  );
  assert.ok(
    tapered.some((w) => plan.weeks[w.week].phase === 'Race preparation'),
  );
  const next = refreshWorkoutVariety(plan, start);
  for (const w of tapered) {
    assert.deepEqual(
      next.workouts.find((n) => n.id === w.id),
      w,
    );
    const anchor = training(plan)
      .filter(
        (n) =>
          n.templateId &&
          n.templateId === w.templateId &&
          taperFactor(plan.profile, n.date) === 1,
      )
      .at(-1);
    if (anchor)
      assert.deepEqual(
        next.workouts.find((n) => n.id === anchor.id),
        anchor,
      );
  }
  assert.deepEqual(plan, before);
});

test('legacy premature labels resolve by actual date during explicit edits', () => {
  const p = input();
  assert.equal(trainingPhaseOn(p, 'Taper', '2026-11-10'), 'Race preparation');
  assert.equal(trainingPhaseOn(p, 'Taper', '2026-11-15'), 'Taper');
  assert.equal(
    trainingPhaseOn({ ...p, startDate: '2026-11-09' }, 'Taper', '2026-11-10'),
    'Foundation',
  );
});

test('repeated preference reviews preserve elapsed recordings and the reviewed taper', () => {
  const plan = make(),
    asOf = '2026-11-10',
    w = plan.workouts.find((w) => w.date === '2026-11-09');
  w.status = 'completed';
  w.feedback = {
    actualDate: w.date,
    actualMinutes: w.minutes,
    actualKm: w.estimatedKm,
    effort: 3,
    feeling: 'good',
    note: 'Synthetic preserved log',
    recordedAt: w.date + 'T18:00:00Z',
  };
  const prior = structuredClone(plan.workouts.filter((w) => w.date < asOf));
  const patch = {
    crossTraining: [{ day: 4, activity: 'cycling', minutes: 40 }],
  };
  const next = revisePreferences(plan, patch, asOf),
    again = revisePreferences(next, patch, asOf);
  assert.deepEqual(
    next.workouts.filter((w) => w.date < asOf),
    prior,
  );
  assert.deepEqual(again.workouts, next.workouts);
  assert.deepEqual(validatePlan(again), []);
});

test('headlamp practice and race-preparation tips do not spill into the tapered part of a week', () => {
  const plan = make({ raceDate: '2026-11-25', practiceInDark: true });
  for (const w of training(plan).filter(
    (w) => taperFactor(plan.profile, w.date) < 1,
  ))
    assert.ok(
      workoutGuidance(plan, w).every(
        (t) => !/Optional headlamp|Rehearse familiar race shoes/.test(t),
      ),
    );
});

test('a boundary-week double splits its existing daily budget without adding training', () => {
  const p = input({
    goal: '10k',
    raceDate: '2027-01-24',
    weeklyKm: 80,
    currentRuns: 6,
    runsPerWeek: 6,
    days: [0, 1, 2, 3, 4, 6],
    method: 'double-threshold',
    doubleDays: [1],
    doubleGapHours: 8,
    thresholdControl: 'heart-rate',
    thresholdCeiling: 150,
    recentQualityMinutes: 40,
  });
  const base = makePlan({ ...p, method: 'balanced' }, start).workouts.find(
    (w) => w.date === '2027-01-05',
  );
  const raw = [
    {
      ...base,
      id: 'synthetic-unsplit',
      minutes: 96,
      estimatedKm: 16,
      kind: 'tempo',
      hard: true,
      steps: [
        {
          label: 'Controlled session',
          kind: 'work',
          seconds: 5760,
          effort: 'Controlled',
          intensity: 5,
        },
      ],
    },
  ];
  const result = applyAdvancedMethod(
    raw,
    p,
    Array(20).fill('Race preparation'),
    (w) => trainingPhaseOn(p, 'Race preparation', w.date),
  );
  assert.equal(result.length, 2);
  assert.deepEqual(
    result.map((w) => w.minutes),
    [48, 48],
  );
  assert.equal(
    result.reduce((sum, w) => sum + w.minutes, 0),
    raw[0].minutes,
  );
  assert.ok(
    result.every(
      (w) =>
        w.date === raw[0].date &&
        w.steps.reduce((n, s) => n + s.seconds, 0) === w.minutes * 60,
    ),
  );
  const during = raw.map((w) => ({ ...w, date: '2027-01-12' }));
  const single = applyAdvancedMethod(
    during,
    p,
    Array(20).fill('Race preparation'),
    (w) => trainingPhaseOn(p, 'Race preparation', w.date),
  );
  assert.deepEqual(single, during);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makePlan,
  demoProfile,
  addDays,
  shortenWorkout,
  revisePreferences,
  refreshWorkoutVariety,
} from '../lib/engine.ts';
import {
  marathonPlanDescription,
  marathonScheduleFacts,
  planWeekFocus,
} from '../lib/plan-guidance.ts';
import { exportProgram } from '../lib/program-export.ts';
import { intervalsWorkoutText } from '../lib/intervals-workout.ts';
import { changeEvent } from '../lib/event-transition.ts';
import { assertMarathonWeek } from './marathon-contract.mjs';
import { WORKOUT_LIBRARY, scaleTemplate } from '../lib/workout-library.ts';

const start = '2026-09-07';
const build = (patch = {}) =>
  makePlan(
    {
      ...demoProfile(start),
      goal: 'marathon',
      raceDate: addDays(start, 125),
      weeklyKm: 70,
      longestKm: 25,
      currentRuns: 5,
      runsPerWeek: 5,
      availableDays: [0, 1, 2, 3, 4, 5, 6],
      days: [0, 1, 2, 3, 5],
      longDay: 5,
      qualityMode: 'automatic',
      recentQualitySessions: 2,
      recentQualityMinutes: 40,
      weekdayMinutes: 120,
      longMinutes: 240,
      easyPace: 6,
      ...patch,
    },
    start,
    false,
  );
const allFocus = (p) => p.weeks.map((w) => planWeekFocus(p, w)).join(' ');

test('restarting a marathon does not count the previous block as one enormous quality week', () => {
  const p = build({ longestKm: 28 });
  const asOf = addDays(start, 70);
  const next = changeEvent(
    p,
    {
      goal: 'marathon',
      raceName: 'Next marathon',
      raceDate: addDays(asOf, 55),
    },
    asOf,
  );
  assert.ok(
    next.workouts.filter((w) => w.week === -1 && w.hard && w.kind !== 'race')
      .length > 2,
  );
  assert.match(marathonPlanDescription(next), /two quality sessions/);
  assert.equal(
    marathonScheduleFacts(next.workouts.filter((w) => w.week === -1))
      .maximumQuality,
    0,
  );
});

test('book plan summary counts the weekday workout and marathon long run as two quality sessions', () => {
  const p = build();
  assert.equal(p.profile.qualitySessions, 1);
  assert.ok(!p.notes.some((n) => n.includes('1 of 2 requested quality')));
  assert.match(marathonPlanDescription(p), /two quality sessions/);
  assert.match(marathonPlanDescription(p), /tempo.*sustained marathon effort/);
  assert.doesNotMatch(marathonPlanDescription(p), /faster repetitions/);
  const long = p.workouts.find((w) => w.kind === 'long' && w.hard);
  const f = marathonScheduleFacts(
    p.workouts.filter((w) => w.week === long.week),
  );
  assert.equal(f.maximumQuality, 2);
  assert.equal(f.marathonPace, true);
  assert.equal(f.tempo, true);
  const focus = planWeekFocus(p, p.weeks[long.week]);
  assert.match(focus, /long run includes sustained marathon effort/);
  assert.match(focus, /Controlled tempo is included/);
  assert.doesNotMatch(focus, /Faster repetitions/);
});

test('endurance preference describes tempo and marathon work without promising faster repetitions', () => {
  const p = build({ marathonApproach: 'endurance' });
  assert.equal(marathonScheduleFacts(p.workouts).repetitions, false);
  assert.match(marathonPlanDescription(p), /tempo.*marathon effort/);
  assert.doesNotMatch(allFocus(p), /5K|[Ff]aster repetitions/);
});

test('saved steady threshold adaptations are not described as threshold or race pace', () => {
  const previous = build();
  const w = previous.workouts.find((w) => w.stimulus === 'threshold');
  w.status = 'completed';
  w.feedback = {
    actualDate: w.date,
    actualMinutes: w.minutes,
    actualKm: w.estimatedKm,
    effort: 6,
    feeling: 'good',
    execution: 'as-planned',
    completedQualityMinutes: 20,
    note: 'Synthetic completed tempo',
    recordedAt: w.date + 'T12:00:00Z',
  };
  const asOf = '2026-09-14';
  const revised = revisePreferences(previous, { difficulty: 'gentle' }, asOf);
  assert.match(
    planWeekFocus(revised, revised.weeks[w.week]),
    /Controlled tempo/,
  );
  const p = {
    ...revised,
    workouts: revised.workouts.filter((w) => w.date >= asOf),
  };
  const f = marathonScheduleFacts(p.workouts);
  assert.ok(f.quality.length);
  assert.equal(f.steady, true);
  assert.equal(f.tempo, false);
  assert.equal(f.repetitions, false);
  assert.equal(f.marathonPace, false);
  assert.match(marathonPlanDescription(p), /Steady, comfortable efforts/);
  assert.match(marathonPlanDescription(p), /one controlled steady workout/);
  assert.doesNotMatch(marathonPlanDescription(p), /tempo|threshold/);
  assert.doesNotMatch(
    allFocus(p),
    /tempo is included|Faster repetitions|sustained marathon effort/,
  );
});

test('a short gentle block without familiar quality does not advertise optional tempo', () => {
  const p = build({ difficulty: 'gentle', raceDate: addDays(start, 6) });
  assert.equal(marathonScheduleFacts(p.workouts).maximumQuality, 0);
  assert.match(marathonPlanDescription(p), /no hard training sessions/);
  assert.doesNotMatch(
    allFocus(p),
    /tempo is included|Faster repetitions|sustained marathon effort/,
  );
});

test('finish preference describes the actual two-session marathon rhythm', () => {
  const p = build({ intent: 'finish' });
  for (const week of p.weeks) assertMarathonWeek(p, week);
  assert.match(marathonPlanDescription(p), /two quality sessions/);
  assert.match(allFocus(p), /Controlled tempo is included/);
  assert.doesNotMatch(allFocus(p), /Faster repetitions/);
});

test('explicit zero-quality preference is described from the saved easy prescriptions', () => {
  const p = build({ qualityMode: 'custom', qualitySessions: 0 });
  assert.equal(marathonScheduleFacts(p.workouts).maximumQuality, 0);
  assert.match(marathonPlanDescription(p), /no hard training sessions/);
  assert.doesNotMatch(
    allFocus(p),
    /Controlled tempo is included|Faster repetitions/,
  );
});

test('busy-day summary shows the real small outing, not a full medium-long run', () => {
  const p = build({
    dayPreferences: [{ day: 2, maxMinutes: 15 }],
    runMeasure: 'distance',
  });
  const w = p.workouts.find((w) => w.week === 0 && w.role === 'medium-long');
  assert.ok(w.minutes <= 15);
  const text = planWeekFocus(p, p.weeks[0]);
  assert.match(text, /Midweek running: 2.5 km/);
  assert.match(text, /shorter outing.*not a full medium-long run/);
});

test('distance estimates remain estimates; mile displays are converted', () => {
  const p = build({
    dayPreferences: [{ day: 2, maxMinutes: 15 }],
    runMeasure: 'time',
    units: 'mi',
  });
  assert.match(planWeekFocus(p, p.weeks[0]), /Midweek running: about 1.6 mi/);
});

test('shortening a tempo to easy removes its old promise without rewriting the saved focus', () => {
  const p = build();
  const w = p.workouts.find(
    (w) => w.hard && w.kind !== 'long' && w.kind !== 'race',
  );
  const next = shortenWorkout(p, w.id, 10, start);
  assert.equal(next.workouts.find((s) => s.id === w.id).hard, false);
  assert.doesNotMatch(
    planWeekFocus(next, next.weeks[w.week]),
    /tempo is included|Faster repetitions/,
  );
  assert.equal(next.weeks[w.week].focus, p.weeks[w.week].focus);
});

test('a shortened endurance role is described from saved distance', () => {
  const p = build({ runMeasure: 'distance' });
  const w = p.workouts.find((w) => w.week === 0 && w.role === 'medium-long');
  const next = shortenWorkout(p, w.id, 15, start);
  assert.match(
    planWeekFocus(next, next.weeks[0]),
    /shorter outing.*not a full medium-long run/,
  );
});

test('skips and stale titles cannot make an empty week advertise a workout', () => {
  const p = build();
  for (const w of p.workouts.filter((w) => w.week === 0)) w.status = 'skipped';
  p.weeks[0].focus = 'Tempo and speed work every day';
  assert.match(planWeekFocus(p, p.weeks[0]), /^No training runs remain/);
  assert.equal(
    marathonScheduleFacts(p.workouts.filter((w) => w.week === 0)).strides,
    false,
  );
});

test('race-only short blocks do not claim tempo or extra endurance preparation', () => {
  const p = build({ raceDate: start });
  assert.match(marathonPlanDescription(p), /no training runs before race day/);
  assert.match(
    planWeekFocus(p, p.weeks[0]),
    /Race day is the only scheduled run/,
  );
});

test('retained completed prescriptions are described independently of changed preferences', () => {
  const p = build();
  const original = p.workouts.find((w) => w.stimulus === 'threshold');
  const recipe = WORKOUT_LIBRARY.find((t) => t.id === 'power-ninety');
  const dose = scaleTemplate(
    recipe,
    original.minutes,
    false,
    'Build',
    12,
    12,
    p.profile,
  );
  assert.ok(dose);
  const speed = {
    ...original,
    ...dose,
    kind: recipe.kind,
    stimulus: recipe.stimulus,
    templateId: recipe.id,
    title: recipe.title,
    status: 'completed',
  };
  p.workouts[p.workouts.indexOf(original)] = speed;
  p.profile.marathonApproach = 'endurance';
  assert.match(
    planWeekFocus(p, p.weeks[speed.week]),
    /Faster repetitions are included/,
  );
});

test('read-time guidance and portable export agree after repeated preference/variety edits', () => {
  let p = build();
  for (const patch of [
    { qualityMode: 'custom', qualitySessions: 0 },
    { qualityMode: 'automatic' },
    { difficulty: 'gentle' },
  ]) {
    p = refreshWorkoutVariety(revisePreferences(p, patch, start), start);
    const before = structuredClone(p);
    const watch = p.workouts
      .filter((w) => w.kind !== 'race')
      .map(intervalsWorkoutText);
    const output = exportProgram(p);
    for (const week of p.weeks)
      assert.equal(output.weeks[week.index].purpose, planWeekFocus(p, week));
    marathonPlanDescription(p);
    assert.deepEqual(p, before);
    assert.deepEqual(
      p.workouts.filter((w) => w.kind !== 'race').map(intervalsWorkoutText),
      watch,
    );
  }
  assert.doesNotMatch(
    allFocus(p),
    /tempo is included|Faster repetitions|sustained marathon effort/,
  );
});

test('other training models and maintenance review instructions retain their existing focus', () => {
  for (const p of [
    build({ goal: 'half' }),
    build({ raceDate: addDays(start, 279) }),
  ]) {
    const week =
      p.profile.goal === 'half'
        ? p.weeks[0]
        : p.weeks.find((w) => w.phase === 'Maintenance');
    assert.equal(planWeekFocus(p, week), week.focus);
  }
});

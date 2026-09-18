import test from 'node:test';
import assert from 'node:assert/strict';
import { Decoder, Stream } from '@garmin/fitsdk';
import {
  addDays,
  dayDiff,
  demoProfile,
  makePlan,
  refreshWorkoutVariety,
  revisePreferences,
  trainingPhaseOn,
  validatePlan,
} from '../lib/engine.ts';
import { selectTemplate } from '../lib/workout-library.ts';
import { qualityWorkMinutes } from '../lib/prescription.ts';
import { encodeWorkout } from '../lib/fit.ts';
import { intervalsWorkoutText } from '../lib/intervals-workout.ts';

const start = '2026-09-14';
const input = (patch = {}) => ({
  ...demoProfile(start),
  name: 'Synthetic one-workout half runner',
  goal: 'half',
  raceName: 'Winter Half Marathon',
  raceDate: '2027-01-17',
  weeklyKm: 45,
  longestKm: 16,
  currentRuns: 4,
  runsPerWeek: 4,
  availableDays: [0, 1, 2, 3, 4, 5, 6],
  longDay: 5,
  qualityMode: 'custom',
  qualitySessions: 1,
  recentQualitySessions: 1,
  recentQualityMinutes: 20,
  weekdayMinutes: 90,
  longMinutes: 150,
  experience: 'established',
  difficulty: 'balanced',
  intent: 'improve',
  volume: 'maintain',
  workoutVariety: 'familiar',
  workoutFormat: 'time',
  ...patch,
});
const build = (patch = {}) => makePlan(input(patch), start, false);
const main = (w) => w.hard && w.kind !== 'race' && w.stimulus !== 'economy';
const buildWork = (plan) =>
  plan.workouts.filter(
    (w) =>
      main(w) &&
      trainingPhaseOn(plan.profile, plan.weeks[w.week].phase, w.date) ===
        'Build',
  );

test('one weekly workout includes half-effort practice during Build between tempo sessions', () => {
  const plan = build();
  const work = buildWork(plan);
  const specific = work.filter((w) => w.stimulus === 'race-rhythm');
  assert.ok(specific.length >= 2);
  for (const w of specific) {
    assert.match(w.title, /half-marathon effort/);
    assert.equal(work[work.indexOf(w) - 1]?.stimulus, 'threshold');
    assert.ok(w.steps.some((s) => s.kind === 'warmup'));
    assert.ok(w.steps.some((s) => s.kind === 'cooldown'));
    assert.ok(w.qualityMinutes <= 18);
  }
  assert.deepEqual(validatePlan(plan), []);
});

test('selected running frequency and one-workout limit survive the new mix', () => {
  for (const runs of [3, 4, 5, 6, 7]) {
    const plan = build({
      currentRuns: runs,
      runsPerWeek: runs,
      weeklyKm: runs === 3 ? 45 : 60,
      weekdayMinutes: 120,
      longMinutes: 180,
    });
    assert.ok(buildWork(plan).some((w) => w.stimulus === 'race-rhythm'));
    for (const week of plan.weeks) {
      const sessions = plan.workouts.filter(
        (w) => w.week === week.index && w.kind !== 'race',
      );
      assert.ok(sessions.filter(main).length <= 1);
      assert.ok(new Set(sessions.map((w) => w.date)).size <= runs);
      assert.ok(
        sessions.reduce((n, w) => n + qualityWorkMinutes(w), 0) <=
          sessions.reduce((n, w) => n + w.minutes, 0) * 0.22 + 0.1,
      );
    }
    assert.deepEqual(validatePlan(plan), []);
  }
});

test('race rehearsal does not bypass introduction, history or an explicit training method', () => {
  const plan = build();
  const tempo = plan.workouts
    .filter((w) => w.stimulus === 'threshold')
    .slice(0, 2);
  const context = {
    previous: tempo,
    availableMinutes: 60,
    week: 5,
    slot: 0,
    qualitySlots: 1,
  };
  const selected = selectTemplate(input(), 'Build', context);
  assert.equal(selected.template.stimulus, 'race-rhythm');
  assert.notEqual(
    selectTemplate(input(), 'Build', {
      ...context,
      previous: tempo.slice(0, 1),
    }).template.stimulus,
    'race-rhythm',
  );
  assert.equal(
    selectTemplate(input(), 'Build', {
      ...context,
      previous: tempo.map((w) => ({ ...w, status: 'skipped' })),
    }).template.stimulus,
    'threshold',
  );
  assert.equal(
    selectTemplate(input(), 'Build', { ...context, introduction: true })
      .template.stimulus,
    'economy',
  );
  assert.equal(
    selectTemplate(input({ method: 'threshold-singles' }), 'Build', context)
      .template.stimulus,
    'threshold',
  );
  assert.equal(
    selectTemplate(input(), 'Build', { ...context, qualitySlots: 2 }).template
      .stimulus,
    'threshold',
  );
});

test('zero-workout choices stay easy while finish and gentle routines retain their selected controlled session', () => {
  const easy = build({ qualitySessions: 0 });
  assert.ok(!easy.workouts.some(main));
  assert.deepEqual(validatePlan(easy), []);
  const finish = build({ intent: 'finish' });
  assert.ok(finish.workouts.some(main));
  assert.deepEqual(validatePlan(finish), []);
  const gentle = build({ difficulty: 'gentle' });
  assert.ok(
    gentle.workouts
      .filter(main)
      .every((w) => w.steps.every((s) => s.intensity <= 5)),
  );
  assert.deepEqual(validatePlan(gentle), []);
});

test('partial starts and every race weekday retain recovery, time ceilings and actual taper dates', () => {
  for (let offset = 0; offset < 7; offset++) {
    const startDate = addDays(start, offset);
    const plan = makePlan(
      input({
        startDate,
        raceDate: addDays('2027-01-11', offset),
        weekdayMinutes: 60,
        weeklyMinutesLimit: 270,
        dayPreferences: [{ day: 2, maxMinutes: 55, startTime: '07:30' }],
      }),
      startDate,
      false,
    );
    assert.deepEqual(validatePlan(plan), []);
    for (const w of plan.workouts) {
      assert.ok(w.date >= startDate && w.date <= plan.profile.raceDate);
      if (w.kind === 'race') continue;
      if (w.kind !== 'long') assert.ok(w.minutes <= 60);
      if (plan.weeks[w.week].phase === 'Recovery') assert.ok(!main(w));
      if (dayDiff(w.date, plan.profile.raceDate) <= 21)
        assert.ok(
          ['Taper', 'Race week'].includes(
            trainingPhaseOn(plan.profile, plan.weeks[w.week].phase, w.date),
          ),
        );
    }
    for (const week of plan.weeks)
      assert.ok(
        plan.workouts
          .filter((w) => w.week === week.index && w.kind !== 'race')
          .reduce((n, w) => n + w.minutes, 0) <= 270,
      );
  }
});

test('short half blocks do not compress rehearsal into their introductory weeks', () => {
  for (const span of [0, 1, 7, 20, 27]) {
    const plan = build({ raceDate: addDays(start, span) });
    assert.deepEqual(validatePlan(plan), []);
    assert.equal(buildWork(plan).length, 0);
  }
});

test('custom events in the half family retain their own effort identity', () => {
  for (const km of [16.09344, 20, 30]) {
    const plan = build({
      goal: 'custom',
      raceDistanceKm: km,
      raceName: 'Synthetic custom race',
      weeklyKm: 70,
      longestKm: 24,
      currentRuns: 5,
      runsPerWeek: 5,
      longMinutes: 180,
    });
    const sessions = buildWork(plan).filter(
      (w) => w.stimulus === 'race-rhythm',
    );
    assert.ok(sessions.length);
    assert.ok(
      sessions.every(
        (w) =>
          !/half-marathon/i.test(w.title + w.purpose + JSON.stringify(w.steps)),
      ),
    );
    assert.deepEqual(validatePlan(plan), []);
  }
});

test('preference review preserves completed and edited runs and repeating it is stable', () => {
  const plan = build({ carbsPerHour: 45, weeklyMinutesLimit: 300 });
  const completed = plan.workouts[0];
  completed.status = 'completed';
  completed.feedback = {
    actualMinutes: completed.minutes,
    actualKm: completed.estimatedKm,
    effort: 3,
    feeling: 'good',
    note: 'Synthetic completed run',
    recordedAt: completed.date + 'T18:00:00Z',
  };
  const edited = plan.workouts.find((w) => w.date > addDays(start, 14));
  edited.changed = true;
  edited.changeSource = 'manual';
  const snapshots = [structuredClone(completed), structuredClone(edited)];
  plan.policyVersion = 'provisional-2026-09-11-v25';
  const next = revisePreferences(
    plan,
    { qualityMode: 'custom', qualitySessions: 1 },
    addDays(start, 7),
  );
  for (const w of snapshots)
    assert.deepEqual(
      next.workouts.find((x) => x.id === w.id),
      w,
    );
  assert.notEqual(next.policyVersion, plan.policyVersion);
  assert.ok(next.workouts.some((w) => w.changeSource === 'preferences'));
  assert.equal(next.profile.carbsPerHour, 45);
  assert.equal(next.profile.weeklyMinutesLimit, 300);
  const again = revisePreferences(
    next,
    { qualityMode: 'custom', qualitySessions: 1 },
    addDays(start, 7),
  );
  assert.deepEqual(again.workouts, next.workouts);
  assert.deepEqual(validatePlan(next), []);
});

test('new race-effort steps retain the saved pace target through FIT and Intervals export', () => {
  const plan = build({
    workoutTargets: {
      mode: 'pace',
      raceScope: 'half:',
      pace: {
        easy: { low: 360, high: 400 },
        tempo: { low: 280, high: 300 },
        race: { low: 310, high: 330 },
      },
    },
  });
  const w = buildWork(plan).find((s) => s.stimulus === 'race-rhythm');
  assert.ok(w);
  assert.ok(
    w.steps
      .filter((s) => s.kind === 'work')
      .every(
        (s) =>
          s.target?.mode === 'pace' &&
          s.target.low === 310 &&
          s.target.high === 330,
      ),
  );
  const decoded = new Decoder(
    Stream.fromByteArray(encodeWorkout(w, plan.profile)),
  ).read();
  assert.deepEqual(decoded.errors, []);
  assert.ok(
    decoded.messages.workoutStepMesgs.some((s) => s.durationTime === 360),
  );
  assert.match(intervalsWorkoutText(w, plan.profile), /360s/);
  const refreshed = refreshWorkoutVariety(plan, start);
  assert.deepEqual(validatePlan(refreshed), []);
  assert.deepEqual(
    refreshed.profile.workoutTargets,
    plan.profile.workoutTargets,
  );
});

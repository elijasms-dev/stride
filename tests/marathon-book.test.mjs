import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makePlan,
  demoProfile,
  addDays,
  dayDiff,
  validatePlan,
  revisePreferences,
  refreshWorkoutVariety,
  shortenWorkout,
  trainingPhaseOn,
  taperFactor,
  weekday,
} from '../lib/engine.ts';
import { marathonBlockPhase, marathonReference } from '../lib/marathon-book.ts';
import { qualityWorkMinutes } from '../lib/prescription.ts';
import {
  executableQualityMinutes,
  qualityTrainingEvidence,
} from '../lib/training-evidence.ts';
import { validateRecovery } from '../lib/recovery.ts';
import { encodeWorkout } from '../lib/fit.ts';
import { intervalsWorkoutText } from '../lib/intervals-workout.ts';

const start = '2026-09-07';
const input = (patch = {}) => ({
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
});
const build = (patch = {}) => makePlan(input(patch), start, false);
const training = (p, week) =>
  p.workouts.filter(
    (w) => w.kind !== 'race' && (week === undefined || w.week === week),
  );
const work = (w) =>
  w.steps.filter((s) => s.kind === 'work' && s.intensity >= 4);

for (const [days, weeklyKm, longestKm] of [
  [4, 50, 20],
  [5, 70, 25],
  [6, 90, 28],
  [7, 115, 28],
])
  for (const duration of [1, 7, 21, 84, 112, 126, 168, 280, 364])
    void test(`${days} days / ${weeklyKm} km / ${duration}-day block respects the runner rather than copying a volume tier`, () => {
      const p = build({
        currentRuns: days,
        runsPerWeek: days,
        weeklyKm,
        longestKm,
        raceDate: addDays(start, duration - 1),
      });
      assert.deepEqual(validatePlan(p), []);
      assert.ok(
        p.workouts.every(
          (w) => w.date >= start && w.date <= p.profile.raceDate,
        ),
      );
      assert.equal(p.workouts.filter((w) => w.kind === 'race').length, 1);
      assert.ok(
        p.workouts.every(
          (w) => !w.pairId && w.status === 'planned' && !w.feedback,
        ),
      );
      const opening = training(p, 0).reduce((n, w) => n + w.minutes, 0);
      assert.ok(opening <= weeklyKm * 6 + 0.1);
      for (const week of p.weeks) {
        const runs = training(p, week.index);
        assert.ok(
          new Set(
            p.workouts.filter((w) => w.week === week.index).map((w) => w.date),
          ).size <= days,
        );
        assert.ok(runs.filter((w) => w.hard).length <= 1);
        assert.ok(
          runs.reduce((n, w) => n + qualityWorkMinutes(w), 0) <=
            runs.reduce((n, w) => n + w.minutes, 0) * 0.22 + 0.1,
        );
        if (week.phase === 'Recovery') assert.ok(runs.every((w) => !w.hard));
      }
      for (const w of training(p)) {
        assert.ok(w.minutes <= (w.kind === 'long' ? 240 : 120));
        assert.equal(
          Math.round(w.steps.reduce((n, s) => n + s.seconds, 0)),
          Math.round(w.minutes * 60),
        );
        if (w.stimulus === 'aerobic-power')
          assert.ok(
            ['Race preparation', 'Taper'].includes(
              trainingPhaseOn(p.profile, p.weeks[w.week].phase, w.date),
            ),
          );
        if (w.kind === 'long' && w.hard)
          assert.equal(
            training(p, w.week).filter((s) => s.hard && s.id !== w.id).length,
            0,
          );
      }
    });

void test('12- and 18-week phase calendars follow their distinct book structures; long blocks add a lead-in', () => {
  for (const [weeks, expected] of [
    [18, [6, 5, 4, 2, 1]],
    [12, [4, 3, 3, 1, 1]],
  ]) {
    const p = input({ raceDate: addDays(start, weeks * 7 - 1) });
    const phases = Array.from({ length: weeks }, (_, i) =>
      marathonBlockPhase(p, addDays(start, i * 7)),
    );
    assert.deepEqual(
      ['Foundation', 'Build', 'Race preparation', 'Taper', 'Race week'].map(
        (phase) => phases.filter((x) => x === phase).length,
      ),
      expected,
    );
  }
  const p = build({ raceDate: addDays(start, 279) });
  assert.ok(
    p.weeks
      .slice(0, 20)
      .every((w) => ['Maintenance', 'Recovery'].includes(w.phase)),
  );
  assert.ok(
    training(p)
      .filter((w) => w.week < 20)
      .every((w) => w.kind !== 'long' || w.estimatedKm <= 25),
  );
});

void test('the standard established plan progresses sustained tempo, four selective marathon rehearsals and later repetitions', () => {
  const p = build();
  const tempo = training(p).filter(
    (w) =>
      w.stimulus === 'threshold' &&
      p.weeks[w.week].phase !== 'Taper' &&
      p.weeks[w.week].phase !== 'Race week',
  );
  assert.ok(tempo.some((w) => qualityWorkMinutes(w) >= 20));
  assert.ok(tempo.some((w) => qualityWorkMinutes(w) >= 30));
  assert.ok(tempo.some((w) => work(w).length === 1));
  assert.ok(tempo.some((w) => work(w).length > 1));
  const rehearsals = training(p).filter((w) => w.kind === 'long' && w.hard);
  assert.equal(rehearsals.length, 4);
  assert.ok(
    qualityWorkMinutes(rehearsals.at(-1)) > qualityWorkMinutes(rehearsals[0]),
  );
  assert.ok(qualityWorkMinutes(rehearsals.at(-1)) >= 60);
  assert.ok(rehearsals.every((w) => work(w).length === 1));
  assert.ok(
    training(p).some((w) => w.role === 'medium-long' && w.estimatedKm >= 18),
  );
  assert.ok(training(p).some((w) => w.stimulus === 'economy'));
  assert.ok(training(p).some((w) => w.stimulus === 'aerobic-power'));
});

void test('introductory tempo advances beyond 15 minutes instead of stalling at a missing ladder rung', () => {
  const p = build({
    recentQualityMinutes: 12,
    recentQualitySessions: 1,
    raceDate: addDays(start, 139),
  });
  const tempo = training(p).filter((w) => w.stimulus === 'threshold');
  assert.ok(tempo.some((w) => qualityWorkMinutes(w) < 20));
  assert.ok(tempo.some((w) => qualityWorkMinutes(w) >= 20));
});

void test('the preferred workout day and reduced day budgets survive the marathon allocation', () => {
  const p = build({ preferredHardDays: [3] });
  assert.ok(
    training(p)
      .filter((w) => w.hard && w.kind !== 'long')
      .every((w) => weekday(w.date) === 3),
  );
  const normal = build();
  const limited = build({ dayPreferences: [{ day: 3, maxMinutes: 60 }] });
  for (const w of training(limited, 0))
    assert.ok(
      w.minutes <=
        normal.workouts.find((s) => s.date === w.date).minutes + 0.01,
    );
  assert.ok(
    training(limited)
      .filter((w) => weekday(w.date) === 3)
      .every((w) => w.minutes <= 60),
  );
});

void test('continuous prescriptions survive refresh, harmless preference edits, resizing, backups and watch export', () => {
  const p = build();
  const snapshot = structuredClone(p.workouts);
  const refreshed = refreshWorkoutVariety(p, start);
  assert.deepEqual(refreshed.workouts, snapshot);
  let edited = p;
  for (const weeklyMinutesLimit of [900, 950, 900])
    edited = revisePreferences(edited, { weeklyMinutesLimit }, start);
  assert.deepEqual(
    edited.workouts.map((w) => w.steps),
    snapshot.map((w) => w.steps),
  );
  const long = p.workouts.find(
    (w) => w.kind === 'long' && qualityWorkMinutes(w) >= 60,
  );
  const shorter = shortenWorkout(p, long.id, 100, start);
  const changed = shorter.workouts.find((w) => w.id === long.id);
  assert.equal(changed.kind, 'long');
  assert.equal(work(changed).length, 1);
  assert.ok(qualityWorkMinutes(changed) <= 60);
  assert.deepEqual(validatePlan(shorter), []);
  assert.ok(encodeWorkout(changed).length > 100);
  assert.match(intervalsWorkoutText(changed), /Warm|warm/);
  assert.doesNotThrow(() =>
    validateRecovery({
      format: 'stride-recovery-2',
      exportedAt: start + 'T12:00:00Z',
      profile: null,
      plan: p,
    }),
  );
});

void test('distance repetitions use supplied current pace and proportional jogging; unknown pace stays timed', () => {
  const p = build({
    workoutFormat: 'distance',
    workoutTargets: {
      mode: 'pace',
      pace: {
        easy: { low: 340, high: 360 },
        interval: { low: 235, high: 250 },
      },
    },
  });
  const speed = training(p).filter((w) => w.stimulus === 'aerobic-power');
  assert.ok(speed.some((w) => work(w).some((s) => s.metres)));
  for (const w of speed) {
    for (const s of work(w)) assert.ok(s.seconds >= 120 && s.seconds <= 360);
    const recovery = w.steps.filter((s) => s.kind === 'recovery');
    assert.ok(
      recovery.every(
        (s) =>
          s.movement === 'run' &&
          s.seconds >= work(w)[0].seconds * 0.5 &&
          s.seconds <= work(w)[0].seconds * 0.9,
      ),
    );
    assert.ok(encodeWorkout(w).length > 100);
    assert.ok(intervalsWorkoutText(w).length > 20);
  }
  assert.ok(
    training(build({ workoutFormat: 'distance' }))
      .filter((w) => w.stimulus === 'aerobic-power')
      .every((w) => work(w).every((s) => s.metres === undefined)),
  );
});

void test('distance-ended quality completion uses executable saved pace, preserving partial-work and feedback gates', () => {
  const p = build({
    workoutTargets: {
      mode: 'pace',
      raceScope: 'marathon:',
      pace: { easy: { low: 340, high: 360 }, race: { low: 260, high: 280 } },
    },
  });
  const original = p.workouts.find((w) => w.kind === 'long' && w.hard);
  const snapshot = structuredClone(original);
  const qualityMetres = work(original).reduce((n, s) => n + s.metres, 0);
  const completion = (minutes, execution = 'as-planned', feeling = 'good') => ({
    ...structuredClone(original),
    status: 'completed',
    feedback: {
      actualDate: original.date,
      actualMinutes: original.minutes,
      actualKm: original.estimatedKm,
      execution,
      completedQualityMinutes: minutes,
      effort: 6,
      feeling,
      note: '',
      recordedAt: original.date + 'T12:00:00Z',
    },
  });
  for (const pace of [260, 270, 280])
    assert.equal(
      qualityTrainingEvidence(
        [completion((qualityMetres * pace) / 1000 / 60)],
        addDays(original.date, 1),
      )[0].eligible,
      true,
    );
  for (const w of [
    completion(executableQualityMinutes(original) * 0.89),
    completion(qualityWorkMinutes(original), 'partial'),
    completion(qualityWorkMinutes(original), 'as-planned', 'tired'),
  ])
    assert.equal(
      qualityTrainingEvidence([w], addDays(original.date, 1))[0].eligible,
      false,
    );
  const timed = {
    ...original,
    steps: original.steps.map(({ metres, target, ...s }) => s),
  };
  assert.equal(executableQualityMinutes(timed), qualityWorkMinutes(timed));
  assert.deepEqual(original, snapshot);
});

void test('reference tiers do not follow ambitions or available days and high mileage requires a matching established routine', () => {
  const p = input({
    weeklyKm: 50,
    currentRuns: 4,
    runsPerWeek: 7,
    peakWeeklyKm: 140,
  });
  assert.equal(marathonReference(p).band, 'foundation');
  assert.throws(
    () => build({ weeklyKm: 115, currentRuns: 5, runsPerWeek: 5 }),
    /six-day/,
  );
  assert.ok(
    build({ weeklyKm: 130, currentRuns: 7, runsPerWeek: 7, longestKm: 30 })
      .weeks.length > 0,
  );
});

void test('book taper preserves the last three endurance Sundays and applies volume reduction only once', () => {
  const p = build({ longDay: 6 });
  const peak = Math.max(
    ...p.weeks
      .filter(
        (week) =>
          week.phase !== 'Recovery' &&
          training(p, week.index).every(
            (w) => taperFactor(p.profile, w.date) === 1,
          ),
      )
      .map((week) =>
        training(p, week.index).reduce((n, w) => n + w.minutes, 0),
      ),
  );
  for (const [from, to, low, high] of [
    [14, 20, 0.65, 0.75],
    [7, 13, 0.5, 0.6],
    [1, 6, 0.3, 0.4],
  ]) {
    const runs = training(p).filter(
      (w) =>
        dayDiff(w.date, p.profile.raceDate) >= from &&
        dayDiff(w.date, p.profile.raceDate) <= to,
    );
    const volume = runs.reduce((n, w) => n + w.minutes, 0);
    assert.ok(
      volume >= peak * low,
      `${from}–${to} days: taper has been reduced twice (${volume} from ${peak})`,
    );
    assert.ok(volume <= peak * high + 0.1);
  }
  for (const [days, low, high] of [
    [21, 26, 32],
    [14, 21, 26],
    [7, 16, 21],
  ]) {
    const long = p.workouts.find(
      (w) => dayDiff(w.date, p.profile.raceDate) === days,
    );
    assert.equal(long.kind, 'long');
    assert.ok(!long.hard);
    assert.ok(long.estimatedKm >= low && long.estimatedKm <= high);
  }
  const taperedSpeed = training(p).filter(
    (w) => w.stimulus === 'aerobic-power' && taperFactor(p.profile, w.date) < 1,
  );
  assert.equal(taperedSpeed.length, 2);
  assert.equal(
    qualityWorkMinutes(taperedSpeed[0]),
    qualityWorkMinutes(taperedSpeed[1]),
    'Both reductions use the familiar untapered dose',
  );
});

for (let raceDay = 0; raceDay < 7; raceDay++)
  void test(`race weekday ${raceDay}: book taper boundaries and final endurance are consistent`, () => {
    const p = build({
      raceDate: addDays(start, 119 + raceDay),
      longDay: raceDay,
    });
    for (const [days, fraction] of [
      [21, 1],
      [20, 0.75],
      [14, 0.75],
      [13, 0.6],
      [7, 0.6],
      [6, 0.4],
    ])
      assert.equal(
        taperFactor(p.profile, addDays(p.profile.raceDate, -days)),
        fraction,
      );
    const finalLong = training(p).find(
      (w) => dayDiff(w.date, p.profile.raceDate) === 7,
    );
    assert.equal(finalLong?.kind, 'long');
    assert.ok(!finalLong.hard);
    assert.ok(
      training(p)
        .filter((w) => dayDiff(w.date, p.profile.raceDate) < 7)
        .every((w) => w.kind !== 'long'),
    );
    assert.deepEqual(validatePlan(p), []);
  });

for (const runsPerWeek of [4, 5, 6])
  void test(`${runsPerWeek} days: Monday marathon never gets a hard Sunday from the preceding calendar week`, () => {
    const begin = '2026-09-13';
    const p = makePlan(
      input({
        startDate: begin,
        raceDate: '2026-10-05',
        currentRuns: runsPerWeek,
        runsPerWeek,
        longDay: 3,
      }),
      begin,
      false,
    );
    assert.deepEqual(validatePlan(p), []);
    assert.ok(
      training(p)
        .filter((w) => dayDiff(w.date, p.profile.raceDate) <= 2)
        .every((w) => !w.hard),
    );
    const next = revisePreferences(p, { weeklyMinutesLimit: 900 }, begin);
    assert.deepEqual(
      next.workouts.map((w) => [w.date, w.kind, w.steps]),
      p.workouts.map((w) => [w.date, w.kind, w.steps]),
    );
  });

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makePlan,
  demoProfile,
  addDays,
  dayDiff,
  validatePlan,
  shortenWorkout,
  rebalanceFutureQuality,
  taperFactor,
} from '../lib/engine.ts';
import { summaryEffort } from '../lib/prescription.ts';
const demo = demoProfile('2026-09-07');
const marathon = {
  ...demo,
  goal: 'marathon',
  raceName: 'Synthetic marathon',
  weeklyKm: 60,
  longestKm: 22,
  currentRuns: 5,
  days: [0, 1, 3, 4, 6],
  longDay: 6,
  raceDate: addDays(demo.startDate, 139),
  weekdayMinutes: 90,
  longMinutes: 200,
};
const generate = (p) => makePlan(p, p.startDate);
const training = (p, w) =>
  p.workouts.filter(
    (s) => s.week === w && s.kind !== 'race' && s.status !== 'skipped',
  );

void test('10K block repeats an aerobic-support family then progresses event-specific work', () => {
  const p = generate(demo),
    runs = p.workouts.filter((w) => w.hard && w.kind !== 'race');
  const support = runs.filter(
    (w) => p.weeks[w.week].phase === 'Build' && w.stimulus === 'threshold',
  );
  assert.ok(support.length >= 2);
  assert.equal(support[0].templateId, support[1].templateId);
  assert.ok(support[1].qualityMinutes >= support[0].qualityMinutes);
  const specific = runs.filter(
    (w) =>
      p.weeks[w.week].phase === 'Race preparation' &&
      w.stimulus === 'race-rhythm',
  );
  assert.ok(specific.length >= 2);
  assert.ok(specific.at(-1).qualityMinutes > specific[0].qualityMinutes);
  for (const w of runs.filter((w) => p.weeks[w.week].phase === 'Taper'))
    assert.ok(
      runs.some((old) => old.week < w.week && old.templateId === w.templateId),
    );
});
void test('long weekday caps do not manufacture prolonged cooldowns or fill every cap', () => {
  const p = generate(marathon);
  for (const w of p.workouts.filter((w) => w.kind !== 'race'))
    for (const s of w.steps)
      if (s.kind === 'cooldown')
        assert.ok(s.seconds <= 600, `${w.title}: ${s.seconds}`);
  const quality = p.workouts.filter((w) => w.hard && w.kind !== 'race');
  assert.ok(quality.some((w) => w.minutes < marathon.weekdayMinutes - 15));
  const specific = quality.filter(
    (w) =>
      w.stimulus === 'race-rhythm' &&
      p.weeks[w.week].phase === 'Race preparation',
  );
  assert.ok(Math.max(...specific.map((w) => w.qualityMinutes)) >= 20);
  assert.ok(
    specific.some((w) =>
      w.steps.some((s) => s.kind === 'work' && s.seconds >= 600),
    ),
  );
});
void test('gentle programming still supplies feasible conservative quality work', () => {
  for (const input of [demo, marathon]) {
    const a = generate(input),
      b = generate({ ...input, difficulty: 'gentle' });
    assert.ok(
      b.workouts.some(
        (w) =>
          w.hard &&
          w.kind !== 'race' &&
          w.stimulus ===
            (input.goal === 'marathon' ? 'threshold' : 'race-rhythm'),
      ),
    );
    assert.ok(
      b.workouts.reduce((n, w) => n + (w.qualityMinutes ?? 0), 0) <=
        a.workouts.reduce((n, w) => n + (w.qualityMinutes ?? 0), 0),
    );
  }
});
void test('actual allocated training controls long-run share and taper, with race separate', () => {
  for (const input of [demo, marathon, { ...marathon, weekdayMinutes: 50 }]) {
    const p = generate(input);
    for (const week of p.weeks) {
      const ss = training(p, week.index),
        total = ss.reduce((n, w) => n + w.minutes, 0);
      for (const w of ss.filter((w) => w.kind === 'long'))
        assert.ok(w.minutes <= total * 0.45 + 1);
      assert.equal(
        week.targetKm,
        Math.round(ss.reduce((n, w) => n + w.estimatedKm, 0) * 10) / 10,
      );
    }
    const first = p.weeks.findIndex((w) => w.phase === 'Taper');
    const prev = p.weeks
      .slice(0, first)
      .reverse()
      .find(
        (w) =>
          w.phase !== 'Recovery' &&
          training(p, w.index).every(
            (run) => taperFactor(p.profile, run.date) === 1,
          ),
      );
    const ref = prev.trainingMinutes;
    const finalWindow = (days) =>
      p.workouts
        .filter(
          (w) =>
            w.kind !== 'race' &&
            dayDiff(w.date, p.profile.raceDate) >= 1 &&
            dayDiff(w.date, p.profile.raceDate) <= days,
        )
        .reduce((n, w) => n + w.minutes, 0);
    assert.ok(finalWindow(input.goal === 'marathon' ? 6 : 7) <= ref * 0.4 + 1);
    assert.ok(
      finalWindow(input.goal === 'marathon' ? 13 : 14) <= ref * 1.05 + 2,
    );
    assert.equal(
      p.weeks.at(-1).raceKm,
      42.195 === input.raceDistanceKm
        ? 42.195
        : input.goal === 'marathon'
          ? 42.195
          : 10,
    );
  }
  assert.throws(
    () => generate({ ...marathon, weekdayMinutes: 30 }),
    /longest training exposure|limits/,
  );
});
void test('shortening keeps whole efforts and useful preparation, or clearly becomes easy', () => {
  const p = generate(demo),
    w = p.workouts.find((w) => w.hard && w.kind !== 'race');
  const short = shortenWorkout(p, w.id, 30, p.profile.startDate).workouts.find(
    (x) => x.id === w.id,
  );
  assert.ok(short.minutes <= 30);
  for (const s of short.steps.filter(
    (s) => s.kind === 'work' && s.intensity >= 5,
  ))
    assert.ok(
      w.steps.some((old) => old.kind === 'work' && old.seconds === s.seconds),
    );
  const tiny = shortenWorkout(p, w.id, 10, p.profile.startDate).workouts.find(
    (x) => x.id === w.id,
  );
  assert.equal(tiny.hard, false);
  assert.equal(tiny.qualityMinutes, 0);
  assert.equal(tiny.steps.length, 1);
});
void test('rest remains possible when removing easy volume would raise quality fraction', () => {
  const p = generate(demo),
    week = 2;
  for (const w of training(p, week)) if (!w.hard) w.status = 'skipped';
  rebalanceFutureQuality(p, p.profile.startDate);
  assert.deepEqual(validatePlan(p), []);
  assert.ok(
    training(p, week).reduce((n, w) => n + (w.qualityMinutes ?? 0), 0) <=
      training(p, week).reduce((n, w) => n + w.minutes, 0) * 0.22 + 0.1,
  );
});
void test('strides are described as mostly easy and unknown distance is not made precise', () => {
  const p = generate({ ...demo, intent: 'finish' }),
    strides = p.workouts.find((w) => w.stimulus === 'economy');
  assert.ok(strides);
  assert.equal(summaryEffort(strides), '2–3');
  const unknown = generate({ ...demo, easyPace: null, runMeasure: 'time' });
  assert.ok(
    unknown.workouts
      .filter((w) => w.kind !== 'race')
      .every((w) => w.distanceEstimate.lowerKm === null),
  );
});

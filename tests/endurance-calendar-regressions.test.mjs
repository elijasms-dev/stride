import assert from 'node:assert/strict';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
const root = process.env.STRIDE_AUDIT_ROOT ?? process.cwd();
const {
  makePlan,
  demoProfile,
  addDays,
  taperFactor,
  validatePlan,
  refreshWeekTotals,
} = await import(pathToFileURL(`${root}/lib/engine.ts`));
const { withWorkoutTargets } = await import(
  pathToFileURL(`${root}/lib/workout-targets.ts`)
);
const start = '2026-09-21';
const profile = (patch = {}) => ({
  ...demoProfile(start),
  goal: 'custom',
  raceDistanceKm: 42.195,
  raceDate: '2027-01-17',
  weeklyKm: 60,
  longestKm: 23,
  currentRuns: 5,
  availableDays: [0, 1, 2, 3, 4, 5, 6],
  runsPerWeek: 5,
  longDay: 0,
  weekdayMinutes: 120,
  longMinutes: 240,
  easyPace: 6,
  qualityMode: 'custom',
  qualitySessions: 1,
  recentQualitySessions: 2,
  recentQualityMinutes: 40,
  ...patch,
});
const runs = (plan, week) =>
  plan.workouts.filter(
    (r) => r.week === week.index && r.kind !== 'race' && r.status !== 'skipped',
  );
const ordinary = (plan, week) =>
  week.start >= plan.profile.startDate &&
  addDays(week.start, 6) <= plan.profile.raceDate &&
  !['Recovery', 'Taper', 'Race week'].includes(week.phase) &&
  runs(plan, week).every((r) => taperFactor(plan.profile, r.date) === 1);
for (const goal of ['custom', 'ultra'])
  for (const q of [0, 1, 2])
    test(`${goal} q${q}: unscheduled Sunday does not begin taper in earlier runs`, () => {
      const p = profile({
        goal,
        raceDistanceKm: goal === 'custom' ? 42.195 : 50,
        qualitySessions: q,
      });
      const plan = makePlan(p, start, false);
      let weekly = 0,
        long = 0;
      for (const week of plan.weeks.filter((w) => ordinary(plan, w))) {
        const rr = runs(plan, week),
          total = rr.reduce((n, r) => n + r.estimatedKm, 0);
        assert.ok(total + 0.001 >= weekly, `${week.start}: ${total}<${weekly}`);
        assert.ok(
          week.longKm + 0.001 >= long,
          `${week.start}: long${week.longKm}<${long}`,
        );
        assert.equal(rr.filter((r) => r.hard && r.kind !== 'long').length, q);
        weekly = Math.max(weekly, total);
        long = week.longKm;
      }
      assert.deepEqual(validatePlan(JSON.parse(JSON.stringify(plan))), []);
    });
for (const [weeklyKm, longestKm, currentRuns] of [
  [15, 4, 3],
  [30, 10, 4],
  [60, 23, 5],
])
  for (const tail of [0, 1, 3])
    test(`base ${weeklyKm}/${longestKm}: partial final weekday${tail} cannot cap previous weeks`, () => {
      const plan = makePlan(
        profile({
          goal: 'base',
          weeklyKm,
          longestKm,
          currentRuns,
          runsPerWeek: currentRuns,
          qualitySessions: 0,
          raceDate: addDays(start, 112 + tail),
        }),
        start,
        false,
      );
      assert.equal(plan.weeks[0].targetKm, weeklyKm);
      assert.equal(plan.weeks[0].longKm, longestKm);
      for (const week of plan.weeks.filter((w) => ordinary(plan, w)))
        assert.ok(
          week.longKm >= longestKm,
          `${week.start}: ${week.longKm}<${longestKm}`,
        );
      // Omitting later dates must not collapse a funded outing into a five-minute run.
      assert.ok(
        plan.workouts.find(
          (r) => r.week === plan.weeks.at(-1).index && r.kind === 'long',
        )?.minutes > 5,
      );
      assert.ok(plan.workouts.every((r) => r.date <= plan.profile.raceDate));
      assert.deepEqual(validatePlan(JSON.parse(JSON.stringify(plan))), []);
    });
test('an unmarked decline before the actual taper is rejected independently', () => {
  const plan = makePlan(profile(), start, false);
  const week = plan.weeks.find((w) => w.start === '2026-12-21');
  assert.ok(ordinary(plan, week));
  const r = runs(plan, week).find((r) => !r.hard && r.kind !== 'long');
  // Edit the executable prescription: changing only its derived estimate is
  // now correctly repaired by canonical target resolution.
  assert.ok(r.steps[0].metres > 2000);
  r.steps[0].metres -= 2000;
  r.steps[0].seconds = Math.ceil(
    (r.steps[0].metres * r.steps[0].planningPaceSecondsPerKm) / 1000,
  );
  r.minutes = r.steps.reduce((n, step) => n + step.seconds, 0) / 60;
  r.estimatedKm -= 2;
  Object.assign(r, withWorkoutTargets(r, plan.profile));
  refreshWeekTotals(plan);
  assert.ok(validatePlan(plan).some((e) => /reduces weekly distance/.test(e)));
});
const prescription = (plan, end) =>
  plan.workouts
    .filter((r) => r.date <= end)
    .map(({ id, varietyVersion, ...run }) => run);
for (const [weeklyKm, longestKm, currentRuns] of [
  [15, 4, 3],
  [60, 23, 5],
])
  for (const weekIndex of [0, 15, 16, 51])
    for (let tail = 0; tail < 6; tail++)
      test(`base ${weeklyKm}km week${weekIndex + 1} end${tail}: exact prefix of full week`, () => {
        const finish = addDays(start, weekIndex * 7 + tail);
        const p = profile({
          goal: 'base',
          weeklyKm,
          longestKm,
          currentRuns,
          runsPerWeek: currentRuns,
          qualitySessions: 0,
          raceDate: finish,
        });
        const shorter = makePlan(p, start, false);
        const full = makePlan(
          { ...p, raceDate: addDays(start, weekIndex * 7 + 6) },
          start,
          false,
        );
        assert.equal(shorter.profile.raceDate, finish);
        assert.deepEqual(
          prescription(shorter, finish),
          prescription(full, finish),
        );
        assert.deepEqual(validatePlan(JSON.parse(JSON.stringify(shorter))), []);
      });
test('base generation supports the maximum user date span even when the last week needs internal padding', () => {
  const partialStart = addDays(start, 2);
  const finish = addDays(partialStart, 363);
  const plan = makePlan(
    profile({
      goal: 'base',
      startDate: partialStart,
      raceDate: finish,
      qualitySessions: 0,
    }),
    partialStart,
    false,
  );
  assert.equal(plan.profile.raceDate, finish);
  assert.ok(plan.workouts.every((r) => r.date <= finish));
  assert.equal(plan.weeks.at(-1).longKm, 23);
  assert.deepEqual(validatePlan(plan), []);
});
test('civil workout dates and prescriptions survive timezone changes across DST and date-line zones', () => {
  const p = profile({
    goal: 'marathon',
    raceDistanceKm: undefined,
    raceDate: addDays(start, 83),
    longDay: 6,
  });
  const reference = makePlan(p, start, false);
  for (const timezone of [
    'Europe/Dublin',
    'America/New_York',
    'Pacific/Apia',
    'Asia/Kathmandu',
  ]) {
    const plan = makePlan({ ...p, timezone }, start, false);
    assert.deepEqual(
      prescription(plan, p.raceDate),
      prescription(reference, p.raceDate),
    );
    assert.deepEqual(validatePlan(JSON.parse(JSON.stringify(plan))), []);
  }
});

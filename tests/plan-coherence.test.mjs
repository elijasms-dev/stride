import { assertMarathonWeek } from './marathon-contract.mjs';
// Source-executing regression candidate. Synthetic runners only; no API, account,
// browser, or provider writes. Portable unchanged from work/ to stride/tests/.
// Numerical bands below are authored product acceptance criteria, not evidence
// that a duration, fraction, or forecast is universally safe or enjoyable.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
const lib = existsSync(new URL('./stride/lib/engine.ts', import.meta.url))
  ? new URL('./stride/lib/', import.meta.url)
  : new URL('../lib/', import.meta.url);
const {
  makePlan,
  demoProfile,
  addDays,
  dayDiff,
  weekday,
  validatePlan,
  shortenWorkout,
  adjustPlan,
  workoutAlternatives,
} = await import(new URL('engine.ts', lib));
const { qualityWorkMinutes } = await import(new URL('prescription.ts', lib));
const { WORKOUT_LIBRARY } = await import(new URL('workout-library.ts', lib));
const { encodeWorkout } = await import(new URL('fit.ts', lib));

const start = '2026-09-07';
const allDays = [0, 1, 2, 3, 4, 5, 6];
const profile = (patch = {}) => ({
  ...demoProfile(start),
  name: 'Synthetic coherence runner',
  goal: 'marathon',
  raceName: 'Synthetic marathon',
  raceDate: addDays(start, 139),
  weeklyKm: 70,
  longestKm: 30,
  currentRuns: 5,
  runsPerWeek: 5,
  availableDays: allDays,
  qualityMode: 'automatic',
  recentQualitySessions: 2,
  recentQualityMinutes: 40,
  weekdayMinutes: 90,
  longMinutes: 200,
  easyPace: 5.5,
  intent: 'improve',
  method: 'balanced',
  ...patch,
});
const make = (patch = {}) => makePlan(profile(patch), start);
const runs = (p, index) =>
  p.workouts.filter(
    (w) =>
      w.kind !== 'race' &&
      w.status !== 'skipped' &&
      (index == null || w.week === index),
  );
const sum = (ws) => ws.reduce((n, w) => n + w.minutes, 0);
const hardWeekdays = (p, index) =>
  runs(p, index).filter((w) => w.hard && w.kind !== 'long');
const development = (p) =>
  p.weeks.filter((w) => ['Build', 'Race preparation'].includes(w.phase));
const fullWeeks = (p) =>
  p.weeks.filter(
    (w) =>
      w.start >= p.profile.startDate &&
      addDays(w.start, 6) < p.profile.raceDate,
  );

function executable(p) {
  assert.deepEqual(
    validatePlan(p),
    [],
    'Final plan must satisfy executable invariants',
  );
  for (const w of runs(p)) {
    assert.ok(
      p.profile.days.includes(weekday(w.date)),
      'Prescribed runs use selected running days',
    );
    assert.ok(w.minutes >= 5 && Number.isFinite(w.minutes));
    assert.ok(
      w.steps.every((s) => s.seconds > 0 && Number.isFinite(s.seconds)),
    );
    assert.ok(
      Math.abs(w.steps.reduce((n, s) => n + s.seconds, 0) - w.minutes * 60) <
        0.01,
      `${w.date} ${w.title}: executable steps equal displayed duration`,
    );
    assert.ok(
      w.minutes <=
        (w.kind === 'long' ? p.profile.longMinutes : p.profile.weekdayMinutes) +
          0.01,
    );
    assert.ok(
      Math.abs((w.qualityMinutes ?? 0) - qualityWorkMinutes(w)) < 0.01,
      `${w.date} ${w.title}: quality summary agrees with the actual work steps`,
    );
  }
  for (const week of fullWeeks(p)) {
    assert.equal(
      new Set(runs(p, week.index).map((w) => w.date)).size,
      p.profile.runsPerWeek,
      `Week ${week.index + 1}: availability must not add running days`,
    );
  }
}

for (const n of [5, 6]) {
  void test(`${n}-day advanced marathon preserves the reported 30 km opening long exposure`, () => {
    const input = profile({ runsPerWeek: n });
    const before = structuredClone(input);
    const p = makePlan(input, start);
    executable(p);
    assert.deepEqual(input, before, 'Generation must not mutate runner inputs');
    const long = runs(p, 0).find((w) => w.kind === 'long');
    assert.ok(long, 'The opening week retains an endurance outing');
    assert.ok(
      long.minutes >= 164 && long.minutes <= 165,
      `Reported 30 km at 5.5 min/km should remain about 165 minutes; got ${long.minutes}`,
    );
    assert.ok(
      sum(runs(p, 0)) >= 380 && sum(runs(p, 0)) <= 385,
      'Adding one easy day redistributes the familiar 385-minute week',
    );
    for (const w of runs(p).filter((w) => w.role === 'recovery'))
      assert.ok(
        w.minutes <= 60,
        `${w.date}: recovery role inflated to ${w.minutes} minutes`,
      );
    for (const week of development(p)) assertMarathonWeek(p, week);
  });
}

void test('three-day 10K opening has a purposeful quality session and no easy outing longer than the familiar long run', () => {
  const p = make({
    goal: '10k',
    raceDate: addDays(start, 83),
    weeklyKm: 30,
    longestKm: 10,
    currentRuns: 3,
    runsPerWeek: 3,
    recentQualitySessions: 1,
    recentQualityMinutes: 20,
    weekdayMinutes: 65,
    longMinutes: 100,
    easyPace: 6,
  });
  executable(p);
  const opening = runs(p, 0),
    long = opening.find((w) => w.kind === 'long');
  assert.equal(opening.length, 3);
  assert.equal(opening.filter((w) => w.hard).length, 1);
  assert.equal(
    long.minutes,
    60,
    'Do not inflate the reported long run to repair allocation',
  );
  assert.ok(
    opening
      .filter((w) => !w.hard && w.kind !== 'long')
      .every((w) => w.minutes <= long.minutes),
  );
  assert.ok(
    sum(opening) >= 170,
    'Purposeful preparation preserves a useful familiar opening workload',
  );
});

for (const n of [5, 6]) {
  void test(`${n}-day half-marathon specific weeks have complementary workouts`, () => {
    const p = make({
      goal: 'half',
      raceDate: addDays(start, 111),
      weeklyKm: 55,
      longestKm: 18,
      currentRuns: n,
      runsPerWeek: n,
      longMinutes: 180,
    });
    executable(p);
    const specific = p.weeks.filter((w) => w.phase === 'Race preparation');
    assert.ok(specific.length >= 2);
    for (const week of specific) {
      const quality = hardWeekdays(p, week.index);
      assert.equal(quality.length, 2);
      assert.deepEqual(
        new Set(quality.map((w) => w.stimulus)),
        new Set(['threshold', 'race-rhythm']),
        'Specific preparation combines threshold support with race rhythm',
      );
      assert.equal(
        new Set(quality.map((w) => w.templateId)).size,
        2,
        'Do not duplicate the same half-marathon recipe in both slots',
      );
    }
  });
}

for (const n of [5, 6]) {
  void test(`${n}-day marathon pace long run accompanies one weekday tempo`, () => {
    const p = make({ runsPerWeek: n });
    executable(p);
    const mixed = runs(p).filter(
      (w) => w.kind === 'long' && w.stimulus === 'race-rhythm',
    );
    assert.ok(mixed.length >= 2);
    for (const long of mixed) {
      const week = runs(p, long.week);
      assert.equal(long.role, 'long');
      assert.ok(
        ['Foundation', 'Build', 'Race preparation'].includes(
          p.weeks[long.week].phase,
        ),
      );
      assert.equal(hardWeekdays(p, long.week).length, 1);
      assert.equal(week.filter((w) => w.hard || w.kind === 'long').length, 2);
      assert.equal(week.length, n);
      assert.ok(
        qualityWorkMinutes(long) >= 20 && qualityWorkMinutes(long) <= 90,
      );
      assert.ok(qualityWorkMinutes(long) <= long.minutes * 0.6 + 0.01);
    }
    assert.ok(qualityWorkMinutes(mixed.at(-1)) >= qualityWorkMinutes(mixed[0]));
  });
  void test(`${n}-day marathon develops longer continuous rehearsal blocks`, () => {
    const p = make({ runsPerWeek: n });
    const specific = runs(p).filter(
      (w) => w.kind === 'long' && w.stimulus === 'race-rhythm',
    );
    assert.ok(specific.length >= 2);
    for (let i = 0; i < specific.length; i++) {
      const work = specific[i].steps.filter((s) => s.kind === 'work');
      assert.equal(work.length, 1);
      assert.ok(work[0].seconds >= 1200);
      if (i) {
        assert.ok(dayDiff(specific[i - 1].date, specific[i].date) >= 14);
        assert.ok(
          qualityWorkMinutes(specific[i]) <=
            qualityWorkMinutes(specific[i - 1]) + 15.1,
        );
      }
    }
    assert.ok(
      qualityWorkMinutes(specific.at(-1)) > qualityWorkMinutes(specific[0]),
    );
  });
}

void test('mixed long shortening preserves complete work, endurance identity, easy fallback, and executable FIT steps', () => {
  const p = make(),
    before = structuredClone(p);
  const long = runs(p).find((w) => w.kind === 'long' && w.hard);
  assert.ok(long && long.minutes > 130);
  assert.ok(
    workoutAlternatives(p, long.id).every((t) => t.kind === 'long'),
    'Weekday equivalents must not replace a long-run role',
  );
  for (const limit of [130, 90, 50, 25]) {
    const next = shortenWorkout(p, long.id, limit, start);
    const w = next.workouts.find((s) => s.id === long.id);
    executable(next);
    assert.equal(w.kind, 'long');
    assert.ok(w.minutes <= limit);
    assert.ok(qualityWorkMinutes(w) <= qualityWorkMinutes(long));
    if (limit >= 50) {
      assert.ok(w.templateId.startsWith('marathon-book-mp-'));
      assert.equal(w.steps.filter((s) => s.kind === 'work').length, 1);
      assert.ok(
        w.steps
          .filter((s) => s.kind === 'work')
          .every((s) => s.seconds % 300 === 0),
        'Shortening keeps a continuous dose in complete five-minute increments',
      );
      assert.ok(
        w.steps
          .filter((s) => s.intensity <= 3)
          .reduce((n, s) => n + s.seconds, 0) >=
          w.minutes * 60 * 0.4 - 1,
        'Preserve easy preparation and recovery around the sustained effort',
      );
    } else {
      assert.equal(w.hard, false);
      assert.equal(w.templateId, undefined);
      assert.equal(qualityWorkMinutes(w), 0);
    }
    // encodeWorkout performs SDK decode, integrity, and step-duration checks.
    const bytes = encodeWorkout(w);
    assert.ok(bytes instanceof Uint8Array && bytes.length > 100);
  }
  assert.deepEqual(
    p,
    before,
    'Editing clones the plan rather than rewriting the source journal',
  );
});

void test('an easy recovery request removes every faster block from a mixed long run', () => {
  const p = make(),
    before = structuredClone(p);
  const long = runs(p).find((w) => w.kind === 'long' && w.hard);
  const next = adjustPlan(p, long.date, long.date, 'easy', start);
  const w = next.workouts.find((s) => s.id === long.id);
  assert.equal(w.kind, 'easy');
  assert.equal(w.hard, false);
  assert.equal(w.templateId, undefined);
  assert.equal(qualityWorkMinutes(w), 0);
  assert.ok(w.steps.every((s) => s.intensity <= 3));
  assert.deepEqual(p, before);
  assert.deepEqual(validatePlan(next), []);
});

for (const n of [5, 6]) {
  for (const raceDay of [0, 2, 6]) {
    void test(`${n}-day marathon taper does not inflate familiar weekdays for race weekday ${raceDay}`, () => {
      const p = make({
        runsPerWeek: n,
        raceDate: addDays('2027-01-18', raceDay),
      });
      executable(p);
      // Compare real complete outings before the final 21 days, excluding deloads.
      const reference = fullWeeks(p)
        .filter(
          (w) =>
            w.phase !== 'Recovery' &&
            dayDiff(addDays(w.start, 6), p.profile.raceDate) >= 21,
        )
        .at(-1);
      assert.ok(reference);
      const familiar = new Map(
        runs(p, reference.index).map((w) => [weekday(w.date), w.minutes]),
      );
      const final = runs(p).filter(
        (w) => dayDiff(w.date, p.profile.raceDate) <= 21,
      );
      assert.ok(final.length > n);
      for (const w of final) {
        assert.ok(
          w.minutes <= familiar.get(weekday(w.date)) + 0.01,
          `${w.date}: taper inflated ${familiar.get(weekday(w.date))} familiar minutes to ${w.minutes}`,
        );
        const remaining = dayDiff(w.date, p.profile.raceDate);
        if (remaining < 7) assert.notEqual(w.kind, 'long');
        if (remaining <= 2) assert.equal(w.hard, false);
      }
      for (const w of runs(p).filter((w) => w.role === 'recovery'))
        assert.ok(w.minutes <= 60);
    });
  }
}

for (const history of [undefined, 0]) {
  void test(`${history === 0 ? 'zero' : 'unknown'} quality history introduces the second hard session after prior weeks of practice`, () => {
    const p = make({
      goal: 'half',
      raceDate: addDays(start, 111),
      weeklyKm: 40,
      longestKm: 14,
      currentRuns: 5,
      runsPerWeek: 5,
      recentQualitySessions: history,
      recentQualityMinutes: history === 0 ? 0 : undefined,
      weekdayMinutes: 90,
      longMinutes: 180,
    });
    executable(p);
    for (const week of p.weeks.filter((w) => w.phase === 'Foundation'))
      assert.equal(
        hardWeekdays(p, week.index).length,
        0,
        'Unknown experience starts with easy running and relaxed strides',
      );
    const firstBuild = development(p)[0];
    assert.equal(
      hardWeekdays(p, firstBuild.index).length,
      1,
      'Do not introduce two hard sessions together',
    );
    const doubled = development(p).filter(
      (w) => hardWeekdays(p, w.index).length === 2,
    );
    assert.ok(
      doubled.length,
      'The conditional forecast can eventually develop the requested two-session structure',
    );
    const firstDouble = doubled[0];
    assert.ok(
      runs(p).filter(
        (w) => w.week < firstDouble.index && w.hard && w.kind !== 'long',
      ).length >= 2,
      'The second hard slot follows prior weeks of substantive work, not same-week counting',
    );
    assert.equal(runs(p).filter((w) => w.kind === 'long' && w.hard).length, 0);
  });
}

for (const weeks of [26, 40]) {
  void test(`${weeks}-week ultra stays within its authored templates and tapers recent ultra work`, () => {
    const p = make({
      goal: 'ultra',
      raceName: 'Synthetic 50K',
      raceDistanceKm: 50,
      raceDate: addDays(start, weeks * 7 - 1),
      weeklyKm: 70,
      longestKm: 28,
      currentRuns: 5,
      runsPerWeek: 5,
      weekdayMinutes: 100,
      longMinutes: 250,
      easyPace: 6,
    });
    executable(p);
    for (const w of runs(p).filter((w) => w.templateId)) {
      const template = WORKOUT_LIBRARY.find((t) => t.id === w.templateId);
      assert.ok(
        template && template.goals.includes('ultra'),
        `${p.weeks[w.week].phase} selected ${w.templateId} outside its declared race families`,
      );
    }
    const tapered = runs(p).filter(
      (w) =>
        ['Taper', 'Race week'].includes(p.weeks[w.week].phase) && w.templateId,
    );
    assert.ok(tapered.length, 'Retain some familiar ultra work when it fits');
    for (const w of tapered) {
      assert.ok(
        ['ultra-steady', 'economy-relaxed'].includes(w.templateId),
        'Do not resurrect remote road-race threshold work',
      );
      assert.ok(
        runs(p).some(
          (old) =>
            old.date < w.date &&
            old.templateId === w.templateId &&
            !['Taper', 'Race week'].includes(p.weeks[old.week].phase),
        ),
      );
    }
  });
}

for (const n of [2, 3]) {
  void test(`novice ${n}-day base keeps explicit walking and the requested frequency`, () => {
    const p = make({
      goal: 'base',
      raceDate: addDays(start, 83),
      weeklyKm: 0,
      longestKm: 0,
      currentRuns: 0,
      runsPerWeek: n,
      experience: 'new',
      recentQualitySessions: 0,
      recentQualityMinutes: 0,
      easyPace: null,
      weekdayMinutes: 30,
      longMinutes: 45,
    });
    executable(p);
    assert.ok(runs(p).every((w) => !w.hard && qualityWorkMinutes(w) === 0));
    assert.ok(runs(p).every((w) => w.steps.some((s) => s.movement === 'walk')));
    assert.equal(p.workouts.filter((w) => w.kind === 'race').length, 0);
  });
}

void test('seven available days preserve requested two-through-seven running frequency', () => {
  for (const n of [2, 3, 4, 5, 6, 7]) {
    const p = make({
      goal: '10k',
      raceDate: addDays(start, 83),
      weeklyKm: 45,
      longestKm: 12,
      currentRuns: n,
      runsPerWeek: n,
      recentQualitySessions: n >= 5 ? 2 : 1,
      recentQualityMinutes: n >= 5 ? 40 : 20,
      weekdayMinutes: 100,
      longMinutes: 160,
      easyPace: 6,
    });
    executable(p);
    assert.equal(p.profile.availableDays.length, 7);
    assert.equal(p.profile.days.length, n);
    const expected = n === 2 ? 0 : n >= 5 ? 2 : 1;
    for (const week of development(p)) {
      assert.equal(runs(p, week.index).length, n);
      assert.equal(runs(p, week.index).filter((w) => w.hard).length, expected);
      assert.equal(
        runs(p, week.index).filter((w) => w.kind === 'long').length,
        n === 2 ? 0 : 1,
      );
    }
  }
});

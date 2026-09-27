import { readFileSync, writeFileSync } from 'node:fs';
import { makePlan, validatePlan } from '../lib/engine.ts';
const inputs = JSON.parse(
  readFileSync(
    new URL('../tests/fixtures/viability-boundaries.json', import.meta.url),
  ),
);
const cases = inputs.map((c) => {
  try {
    makePlan(c.input, c.input.startDate, false);
    return { ...c, status: 'accepted' };
  } catch (error) {
    return {
      ...c,
      status: 'rejected',
      error: error.message,
      errorName: error.name,
    };
  }
});
const plus = (d, n) =>
  new Date(Date.parse(d + 'T12:00:00Z') + n * 86400000)
    .toISOString()
    .slice(0, 10);
const gap = (a, b) =>
  Math.round(
    (Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000,
  );
const wd = (d) => (new Date(d + 'T12:00:00Z').getUTCDay() + 6) % 7;
const completeWork = (w) =>
  w.steps
    .filter(
      (s) => s.kind === 'work' && s.intensity >= 4 && s.movement !== 'walk',
    )
    .reduce((sum, s) => sum + s.seconds / 60, 0);
const issues = [],
  results = [];
let weeksCount = 0,
  runsCount = 0;
for (const c of cases) {
  if ((c.expectation === 'reject') !== (c.status === 'rejected'))
    issues.push({ id: c.id, error: 'Changed acceptance contract' });
  if (c.status === 'rejected') {
    let category = c.error.includes('Two quality sessions need')
      ? 'quality-prerequisite'
      : c.error.includes('recent baseline')
        ? 'event-prerequisite'
        : c.error.includes('starting weekly distance')
          ? 'baseline-capacity'
          : null;
    if (!category || c.errorName !== 'PlanError')
      issues.push({
        id: c.id,
        error: 'Unclassified or uncontrolled rejection',
        detail: c.error,
      });
    results.push({
      id: c.id,
      goal: c.input.goal,
      status: 'controlled-rejection',
      category,
      error: c.error,
    });
    continue;
  }
  const p = makePlan(c.input, c.input.startDate, false),
    errors = [];
  const check = (ok, msg) => {
    if (!ok) errors.push(msg);
  };
  check(validatePlan(p).length === 0, 'validator rejects generated plan');
  check(
    validatePlan(JSON.parse(JSON.stringify(p))).length === 0,
    'JSON roundtrip rejects',
  );
  const core = ['5k', '10k', 'half', 'marathon'].includes(p.profile.goal);
  const taperDays =
    p.profile.goal === 'half'
      ? 14
      : p.profile.goal === 'marathon'
        ? gap(p.profile.startDate, p.profile.raceDate) + 1 <= 84
          ? 14
          : 21
        : 7;
  const races = p.workouts.filter((w) => w.kind === 'race');
  check(
    races.length === 1 && races[0].date === p.profile.raceDate,
    'race must appear once on selected date',
  );
  const demanding = p.workouts
    .filter((w) => w.hard || w.kind === 'long')
    .sort((a, b) => a.date.localeCompare(b.date));
  for (let i = 1; i < demanding.length; i++)
    check(
      gap(demanding[i - 1].date, demanding[i].date) >= 2,
      'adjacent demanding sessions',
    );
  let previousLong, previousWeekly;
  const weeks = p.weeks.map((week) => {
    const r = p.workouts.filter(
      (w) => w.week === week.index && w.kind !== 'race',
    );
    weeksCount++;
    runsCount += r.length;
    const total = r.reduce((s, w) => s + w.estimatedKm, 0),
      long = r.find((w) => w.kind === 'long'),
      q = r.filter(
        (w) =>
          w.kind !== 'long' &&
          w.stimulus !== 'economy' &&
          completeWork(w) >= 6 - 1e-6,
      );
    const ordinary =
      core &&
      week.start >= p.profile.startDate &&
      gap(plus(week.start, 6), p.profile.raceDate) >
        (p.profile.goal === 'marathon' ? taperDays - 1 : taperDays) &&
      week.phase !== 'Recovery';
    check(
      Math.abs(week.targetKm - total) <= 0.051,
      `week${week.index + 1}: wrong displayed sum`,
    );
    if (ordinary) {
      check(
        new Set(r.map((w) => w.date)).size === p.profile.days.length,
        `week${week.index + 1}: missing running day`,
      );
      check(
        q.length === (p.profile.qualitySessions ?? 1),
        `week${week.index + 1}: wrong quality count`,
      );
      if (week.start === p.profile.startDate) {
        check(
          Math.abs(total - p.profile.weeklyKm) <= 0.00101,
          'opening weekly baseline changed',
        );
        if (p.profile.days.length > 2)
          check(
            Math.abs(long?.estimatedKm - p.profile.longestKm) <= 0.00101,
            'opening long baseline changed',
          );
      }
      if (previousWeekly !== undefined)
        check(
          total + 0.001 >= previousWeekly,
          `week${week.index + 1}: unmarked weekly decline`,
        );
      previousWeekly = total;
      if (long) {
        if (previousLong !== undefined) {
          check(
            long.estimatedKm + 0.001 >= previousLong,
            `week${week.index + 1}: unmarked long decline`,
          );
          check(
            long.estimatedKm <= previousLong + 2.001,
            `week${week.index + 1}: >2km long jump`,
          );
        }
        previousLong = long.estimatedKm;
        if (p.profile.goal !== 'marathon')
          check(
            r
              .filter((w) => w.kind === 'easy')
              .every((w) => w.estimatedKm <= long.estimatedKm + 0.00101),
            `week${week.index + 1}: easy outing longer than designated long`,
          );
        if (long.estimatedKm > p.profile.longestKm + 0.00101)
          check(
            Number.isInteger(long.estimatedKm),
            `week${week.index + 1}: fractional growth`,
          );
      }
    }
    for (const w of r) {
      check(
        w.date >= p.profile.startDate && w.date <= p.profile.raceDate,
        'run outside plan',
      );
      check(p.profile.days.includes(wd(w.date)), 'run on unselected day');
      check(
        w.steps.length > 0 &&
          w.steps.every((s) => Number.isFinite(s.seconds) && s.seconds > 0),
        'invalid executable steps',
      );
      check(
        Math.abs(w.steps.reduce((n, s) => n + s.seconds, 0) - w.minutes * 60) <=
          1.01,
        'step duration disagrees with total',
      );
      check(
        w.minutes <=
          (w.kind === 'long'
            ? p.profile.longMinutes
            : p.profile.weekdayMinutes) +
            0.017,
        'session exceeds declared time',
      );
      if (w.hard)
        check(
          gap(w.date, p.profile.raceDate) >= 3,
          'hard work in final two days',
        );
    }
    return {
      index: week.index,
      phase: week.phase,
      totalKm: +total.toFixed(3),
      longKm: long?.estimatedKm ?? null,
      quality: q.length,
      ordinary,
    };
  });
  if (errors.length) issues.push({ id: c.id, errors });
  results.push({
    id: c.id,
    goal: c.input.goal,
    status: errors.length ? 'failed' : 'accepted',
    errors,
    weeks,
  });
}
const report = {
  generatedAt: new Date().toISOString(),
  cases: cases.length,
  accepted: results.filter((r) => r.status === 'accepted').length,
  rejected: results.filter((r) => r.status === 'controlled-rejection').length,
  failed: issues.length,
  rejectionCategories: results
    .filter((r) => r.category)
    .reduce((o, r) => ((o[r.category] = (o[r.category] ?? 0) + 1), o), {}),
  weeksCount,
  runsCount,
  issues,
  results,
};
writeFileSync(
  'docs/verification/2026-09-24/viability-review/boundaries.json',
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify({ ...report, results: undefined }, null, 2));

if (report.failed) process.exitCode = 1;

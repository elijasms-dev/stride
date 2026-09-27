import {
  makePlan,
  demoProfile,
  addDays,
  validatePlan,
  taperFactor,
  dayDiff,
  weekday,
  refreshWorkoutVariety,
  revisePreferences,
} from '../lib/engine.ts';
import { writeFileSync } from 'node:fs';
const start = '2026-09-21';
const base = {
  ...demoProfile(start),
  startDate: start,
  goal: 'marathon',
  raceDate: addDays(start, 125),
  weeklyKm: 60,
  longestKm: 23,
  currentRuns: 5,
  days: [1, 2, 3, 4, 6],
  availableDays: [0, 1, 2, 3, 4, 5, 6],
  runsPerWeek: 5,
  longDay: 6,
  weekdayMinutes: 120,
  longMinutes: 240,
  easyPace: 6,
  experience: 'established',
  qualityMode: 'custom',
  qualitySessions: 2,
  recentQualitySessions: 2,
  recentQualityMinutes: 40,
  stableWeeks: 16,
  ultraWeeklyMinutes: 540,
  ultraLongestMinutes: 180,
};
const cases = [];
for (const goal of ['marathon', 'custom', 'ultra', 'base'])
  for (const sd of [0, 1, 3, 6])
    for (const rd of [0, 1, 3, 6])
      for (const longDay of [0, 3, 6])
        for (const q of [0, 1, 2]) {
          const p = {
            ...base,
            goal,
            startDate: addDays(start, sd),
            raceDate: addDays(start, 112 + rd),
            raceDistanceKm:
              goal === 'custom' ? 42.195 : goal === 'ultra' ? 50 : undefined,
            longDay,
            qualitySessions: q,
          };
          cases.push({ id: `${goal}-s${sd}-r${rd}-l${longDay}-q${q}`, p });
        }
const patchCases = [
  ['low60min', { weekdayMinutes: 60 }],
  ['long90min', { longMinutes: 90 }],
  ['longfraction', { longestKm: 23.7 }],
  ['longdominated', { weeklyKm: 45, longestKm: 35 }],
  [
    'longaboveceiling',
    { weeklyKm: 90, longestKm: 40, currentRuns: 6, runsPerWeek: 6 },
  ],
  ['longequalsweekly', { weeklyKm: 45, longestKm: 45 }],
  ['longmaintain', { longestKm: 23.7, volume: 'maintain' }],
  ['timeceilingexact', { weeklyMinutesLimit: 360 }],
  ['timeceilingfraction', { weeklyMinutesLimit: 365 }],
  ['easySlow', { easyPace: 9, longMinutes: 300 }],
  ['easyFast', { easyPace: 4 }],
  ['newday', { currentRuns: 4 }],
  ['recovery3', { recoveryWeeks: 3 }],
  ['benchmark', { recentRace: { distanceKm: 10, timeMinutes: 40 } }],
  [
    'custompace',
    {
      workoutTargets: {
        mode: 'pace',
        pace: {
          easy: { low: 370, high: 420 },
          tempo: { low: 300, high: 320 },
          threshold: { low: 285, high: 310 },
          interval: { low: 250, high: 280 },
        },
      },
    },
  ],
  [
    'narrowdays',
    {
      availableDays: undefined,
      runsPerWeek: undefined,
      days: [0, 1, 2, 3, 6],
      longDay: 6,
    },
  ],
  ['all7', { currentRuns: 7, runsPerWeek: 7 }],
  [
    'specificdaylimits',
    {
      dayPreferences: [
        { day: 2, maxMinutes: 40 },
        { day: 6, maxMinutes: 180 },
      ],
    },
  ],
];
for (const goal of ['marathon', 'custom', 'ultra', 'base'])
  for (const [name, patch] of patchCases)
    for (const q of [0, 1, 2]) {
      cases.push({
        id: `${goal}-${name}-q${q}`,
        p: {
          ...base,
          goal,
          raceDistanceKm:
            goal === 'custom' ? 42.195 : goal === 'ultra' ? 50 : undefined,
          qualitySessions: q,
          ...patch,
        },
      });
    }
for (const km of [3, 8, 15, 25, 30, 42.195, 45, 50, 80, 80.4673, 100, 160.9344])
  for (const q of [0, 1, 2])
    cases.push({
      id: `custom-${km}-q${q}`,
      p: {
        ...base,
        goal: 'custom',
        raceDistanceKm: km,
        weeklyKm: 90,
        longestKm: 30,
        currentRuns: 6,
        runsPerWeek: 6,
        qualitySessions: q,
        raceDate: addDays(start, 223),
      },
    });
const results = [];
for (const { id, p } of cases) {
  try {
    const plan = makePlan(p, p.startDate, false);
    const errors = validatePlan(JSON.parse(JSON.stringify(plan)));
    const rows = plan.weeks.map((w) => {
      const ss = plan.workouts.filter(
        (r) =>
          r.week === w.index && r.kind !== 'race' && r.status !== 'skipped',
      );
      return {
        index: w.index,
        phase: w.phase,
        start: w.start,
        long: w.longKm,
        km: w.targetKm,
        min: w.trainingMinutes,
        quality: ss.filter((r) => r.hard && r.kind !== 'long').length,
        runs: ss.length,
        ordinary:
          w.start >= p.startDate &&
          addDays(w.start, 6) < p.raceDate &&
          !['Recovery', 'Taper', 'Race week'].includes(w.phase) &&
          ss.every((s) => taperFactor(p, s.date) === 1),
      };
    });
    const pp = plan.profile;
    let last;
    for (const w of rows.filter((r) => r.ordinary)) {
      if (w.quality !== pp.qualitySessions && goalQuality(p, pp))
        errors.push(
          `Quality count ${w.index + 1} ${w.quality}!=${pp.qualitySessions}`,
        );
      if (last && w.long + 0.01 < last.long)
        errors.push(
          `Long decline ${last.index + 1} ${last.long}->${w.index + 1} ${w.long}`,
        );
      if (last && w.km + 0.01 < last.km)
        errors.push(
          `Weekly decline ${last.index + 1} ${last.km}->${w.index + 1} ${w.km}`,
        );
      last = w;
    }
    for (const r of plan.workouts.filter((r) => r.kind !== 'race')) {
      if (
        r.minutes >
        (r.kind === 'long' ? p.longMinutes : p.weekdayMinutes) + 0.02
      )
        errors.push(`Timecap ${r.date} ${r.minutes}`);
      if (r.steps.some((s) => !Number.isFinite(s.seconds) || s.seconds <= 0))
        errors.push(`Invalidsteps ${r.date}`);
      if (
        Math.abs(r.minutes - r.steps.reduce((n, s) => n + s.seconds, 0) / 60) >
        0.1
      )
        errors.push(`Steptime ${r.date}`);
    }
    results.push({
      id,
      p,
      accepted: true,
      errors,
      rows,
      feasibility: plan.feasibility,
    });
  } catch (e) {
    results.push({ id, p, accepted: false, type: e.name, error: e.message });
  }
}
function goalQuality(p, pp) {
  return p.experience === 'established' && pp.goal !== 'base';
}
writeFileSync(
  'docs/verification/2026-09-24/viability-review/calendar.json',
  JSON.stringify(results, null, 2),
);
console.log(
  JSON.stringify(
    {
      total: results.length,
      accepted: results.filter((o) => o.accepted).length,
      rejected: results.filter((o) => !o.accepted).length,
      errors: results.filter((o) => o.accepted && o.errors.length),
      rejects: results
        .filter((o) => !o.accepted)
        .map((o) => ({ id: o.id, error: o.error })),
    },
    null,
    2,
  ),
);

const auditRows = results;
if (
  auditRows.some((r) => (r.accepted ? r.errors.length : r.type !== 'PlanError'))
)
  process.exitCode = 1;

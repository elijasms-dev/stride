import {
  makePlan,
  demoProfile,
  addDays,
  validatePlan,
  taperFactor,
  dayDiff,
  refreshWorkoutVariety,
  revisePreferences,
} from '../lib/engine.ts';
import { writeFileSync } from 'node:fs';
const start = '2026-09-21';
const cases = [];
for (const goal of ['marathon', 'custom', 'ultra', 'base'])
  for (const weeks of [4, 8, 12, 18, 24, 32])
    for (const [weeklyKm, longestKm, runs] of [
      [10, 4, 3],
      [25, 10, 4],
      [32, 12, 4],
      [45, 18, 5],
      [60, 23, 5],
      [90, 30, 6],
      [100, 35, 6],
    ])
      for (const q of [0, 1, 2]) {
        const p = {
          ...demoProfile(start),
          goal,
          raceDistanceKm:
            goal === 'custom' ? 42.195 : goal === 'ultra' ? 100 : undefined,
          startDate: start,
          raceDate: addDays(start, weeks * 7 - 1),
          weeklyKm,
          longestKm,
          currentRuns: runs,
          availableDays: [0, 1, 2, 3, 4, 5, 6],
          runsPerWeek: runs,
          days:
            runs === 3
              ? [1, 3, 6]
              : runs === 4
                ? [1, 2, 4, 6]
                : runs === 5
                  ? [1, 2, 3, 4, 6]
                  : [0, 1, 2, 3, 4, 6],
          longDay: 6,
          weekdayMinutes: 120,
          longMinutes: goal === 'ultra' ? 240 : 300,
          easyPace: 6,
          experience: 'established',
          qualityMode: 'custom',
          qualitySessions: q,
          recentQualitySessions: 2,
          recentQualityMinutes: 40,
          stableWeeks: 16,
          ultraWeeklyMinutes: weeklyKm * 6,
          ultraLongestMinutes: longestKm * 6,
        };
        cases.push({ id: `${goal}-${weeks}w-${weeklyKm}k-${q}q`, p });
      }
const output = [];
for (const { id, p } of cases) {
  try {
    const plan = makePlan(p, p.startDate, false);
    const errors = validatePlan(JSON.parse(JSON.stringify(plan)));
    const rows = plan.weeks.map((w) => {
      const sessions = plan.workouts.filter(
        (r) =>
          r.week === w.index && r.kind !== 'race' && r.status !== 'skipped',
      );
      return {
        ...w,
        quality: sessions.filter((r) => r.hard && r.kind !== 'long').length,
        runs: sessions.length,
        sessions: sessions.map((r) => ({
          date: r.date,
          kind: r.kind,
          hard: r.hard,
          km: r.estimatedKm,
          min: r.minutes,
          title: r.title,
          stimulus: r.stimulus,
          work:
            r.steps
              .filter((s) => s.kind === 'work' && s.intensity >= 4)
              .reduce((n, s) => n + s.seconds, 0) / 60,
        })),
        ordinary:
          w.start >= p.startDate &&
          !['Recovery', 'Taper', 'Race week'].includes(w.phase) &&
          taperFactor(p, addDays(w.start, 6)) === 1,
      };
    });
    let last;
    for (const w of rows.filter((r) => r.ordinary)) {
      if (w.quality !== (p.goal === 'base' ? 0 : p.qualitySessions))
        errors.push(`Quality count ${w.index + 1} ${w.quality}`);
      if (last && w.longKm + 0.01 < last.longKm)
        errors.push(
          `Long decline ${last.index + 1} ${last.longKm}->${w.index + 1} ${w.longKm}`,
        );
      if (last && w.targetKm + 0.01 < last.targetKm)
        errors.push(
          `Weekly decline ${last.index + 1} ${last.targetKm}->${w.index + 1} ${w.targetKm}`,
        );
      last = w;
    }
    const demanding = plan.workouts.filter((r) => r.hard || r.kind === 'long');
    for (let i = 1; i < demanding.length; i++)
      if (dayDiff(demanding[i - 1].date, demanding[i].date) < 2)
        errors.push(
          `Adjacent demand ${demanding[i - 1].date} ${demanding[i].date}`,
        );
    output.push({
      id,
      p,
      accepted: true,
      errors,
      feasibility: plan.feasibility,
      rows,
    });
  } catch (e) {
    output.push({ id, p, accepted: false, error: e.message, type: e.name });
  }
}
writeFileSync(
  'docs/verification/2026-09-24/viability-review/endurance.json',
  JSON.stringify(output, null, 2),
);
const accepted = output.filter((o) => o.accepted);
console.log(
  JSON.stringify(
    {
      total: output.length,
      accepted: accepted.length,
      rejected: output.length - accepted.length,
      errors: accepted.filter((o) => o.errors.length),
      groups: Object.fromEntries(
        ['marathon', 'custom', 'ultra', 'base'].map((g) => [
          g,
          output
            .filter((o) => o.p.goal === g)
            .reduce((r, o) => (r[o.accepted ? 'accepted' : 'rejected']++, r), {
              accepted: 0,
              rejected: 0,
            }),
        ]),
      ),
      rejections: [
        ...new Set(output.filter((o) => !o.accepted).map((o) => o.error)),
      ],
    },
    null,
    2,
  ),
);

const auditRows = output;
if (
  auditRows.some((r) => (r.accepted ? r.errors.length : r.type !== 'PlanError'))
)
  process.exitCode = 1;

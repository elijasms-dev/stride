/** Reviewable daily examples from the current engine; synthetic plans only. */
import { mkdir, writeFile } from 'node:fs/promises';
import { demoProfile, makePlan, validatePlan, addDays } from '../lib/engine.ts';
import { paceText } from '../lib/workout-targets.ts';
const out = new URL(
  '../docs/verification/2026-09-25/plan-quality-review/',
  import.meta.url,
);
await mkdir(out, { recursive: true });
const start = '2026-09-28';
const configurations = {
  '5k': {
    weeks: 12,
    ordinary: [30, 8, 4],
    advanced: [55, 13, 6],
    benchmark: [5, 25],
  },
  '10k': {
    weeks: 12,
    ordinary: [36, 11, 4],
    advanced: [60, 16, 6],
    benchmark: [10, 50],
  },
  half: {
    weeks: 16,
    ordinary: [45, 16, 4],
    advanced: [65, 18, 6],
    benchmark: [21.0975, 110],
  },
  marathon: {
    weeks: 20,
    ordinary: [60, 23, 5],
    advanced: [70, 23, 5],
    benchmark: [10, 45],
  },
};
const round = (n) => Number(n.toFixed(2));
const clean = (s) => String(s).replaceAll('|', '/').replaceAll('\n', ' ');
const quality = (w) =>
  !['long', 'race'].includes(w.kind) &&
  w.hard &&
  w.steps.some(
    (s) => s.kind === 'work' && s.intensity >= 4 && s.movement !== 'walk',
  );
const examples = [];
const lines = [
  '# Day-by-day examples after the session-balance and workout-variety fixes',
  '',
  'Twelve synthetic complete plans. Counts are weekday quality sessions; the long run is listed separately. Each runner has an established routine and the recent workout history required for their chosen count. Quality2 uses the larger starting workload shown below. Benchmarks describe current fitness, not guaranteed race finishes.',
  '',
];
for (const [goal, c] of Object.entries(configurations))
  for (const q of [0, 1, 2]) {
    const [weeklyKm, longestKm, runs] = q === 2 ? c.advanced : c.ordinary;
    const input = {
      ...demoProfile(start),
      goal,
      raceName: `${goal === 'half' ? 'Half marathon' : goal.toUpperCase()} race day`,
      weeklyKm,
      longestKm,
      currentRuns: runs,
      runsPerWeek: runs,
      days: { 4: [0, 2, 4, 6], 5: [0, 1, 2, 4, 6], 6: [0, 1, 2, 3, 4, 6] }[
        runs
      ],
      availableDays: [0, 1, 2, 3, 4, 5, 6],
      longDay: 6,
      weekdayMinutes: 120,
      longMinutes: 300,
      raceDate: addDays(start, c.weeks * 7 - 1),
      easyPace: null,
      recentRace: {
        distanceKm: c.benchmark[0],
        timeMinutes: c.benchmark[1],
        date: '2026-09-20',
        source: 'race',
        course: 'road',
      },
      qualityMode: 'custom',
      qualitySessions: q,
      recentQualitySessions: q,
      recentQualityMinutes: q * 20,
      runMeasure: 'distance',
    };
    const p = makePlan(input, start, false);
    const errors = validatePlan(p);
    if (errors.length) throw new Error(errors.join(';'));
    examples.push({ id: `${goal}-q${q}`, input, plan: p });
    lines.push(
      `## ${goal}: ${q} weekday workouts`,
      '',
      `${c.weeks} weeks; ${weeklyKm} km/week and ${longestKm} km recent long run; ${runs} running days; benchmark ${c.benchmark[0]} km in ${c.benchmark[1]} minutes.`,
      '',
      ...p.notes
        .filter((note) => note.startsWith('Opening-week balance ·'))
        .flatMap((note) => [note, '']),
      '| Week / phase | Mon | Tue | Wed | Thu | Fri | Sat | Sun | Training km | Long km | Workouts |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: |',
    );
    for (const week of p.weeks) {
      const runs = p.workouts.filter((w) => w.week === week.index);
      const training = runs.filter((w) => w.kind !== 'race');
      const cells = Array.from(
        { length: 7 },
        (_, day) =>
          runs
            .filter((w) => w.date === addDays(week.start, day))
            .map(
              (w) =>
                `${clean(w.title.replace(/^\d+(?:\.\d+)? (?:km|mi) · /, ''))} · ${round(w.estimatedKm)} km · ${round(w.minutes)} min`,
            )
            .join('<br>') || 'Rest',
      );
      lines.push(
        `| ${week.index + 1} · ${week.phase} | ${cells.join(' | ')} | ${round(training.reduce((n, w) => n + w.estimatedKm, 0))} | ${training.some((w) => w.kind === 'long') ? round(training.find((w) => w.kind === 'long').estimatedKm) : '—'} | ${training.filter(quality).length} |`,
      );
    }
    lines.push('', 'Exact quality-session steps:', '');
    for (const w of p.workouts.filter(quality))
      lines.push(
        `- **${w.date} — ${clean(w.title)}:** ` +
          w.steps
            .map(
              (s) =>
                `${clean(s.label)}: ${s.metres === undefined ? `${round(s.seconds / 60)} min` : `${s.metres} m`}${s.target?.mode === 'pace' ? ` at ${paceText(s.target.low)}–${paceText(s.target.high)}/km` : ` (${clean(s.effort)})`}`,
            )
            .join('; '),
      );
    lines.push('');
  }
await writeFile(new URL('day-by-day.md', out), lines.join('\n') + '\n');
await writeFile(
  new URL('example-plans.json', out),
  JSON.stringify(examples, null, 2) + '\n',
);
console.log(
  JSON.stringify({
    plans: examples.length,
    weeks: examples.reduce((n, e) => n + e.plan.weeks.length, 0),
    workouts: examples.reduce((n, e) => n + e.plan.workouts.length, 0),
  }),
);

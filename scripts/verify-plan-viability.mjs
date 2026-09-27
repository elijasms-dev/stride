/** Synthetic plans only: no database, account, network or publication writes. */
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { makePlan, demoProfile, addDays, validatePlan } from '../lib/engine.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const destination = resolve(
  root,
  'docs/verification/2026-09-24/viability-review',
);
await mkdir(destination, { recursive: true });
const execute = (script, ...args) =>
  execFileSync(
    process.execPath,
    ['--experimental-strip-types', resolve(root, 'scripts', script), ...args],
    { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
  );
if (!process.argv.includes('--examples-only')) {
  execute(
    'audit-road-viability.mjs',
    root,
    resolve(destination, 'independent-road.json'),
  );
  execute('audit-endurance-viability.mjs');
  execute('audit-calendar-viability.mjs');
  execute('audit-boundary-viability.mjs');
}
const read = async (name) =>
  JSON.parse(await readFile(resolve(destination, name), 'utf8'));
const road = await read('independent-road.json');
const endurance = await read('endurance.json');
const calendar = await read('calendar.json');
const boundaries = await read('boundaries.json');
const sweeps = [
  {
    name: 'Independent road abilities',
    cases: road.summary.scenarios,
    accepted: road.summary.accepted,
    rejected: road.summary.expectedRejections,
    failed: road.summary.failed,
    weeks: road.summary.generatedWeeks,
  },
  ...[
    ['Endurance baselines', endurance],
    ['Calendar and custom distances', calendar],
  ].map(([name, results]) => ({
    name,
    cases: results.length,
    accepted: results.filter((r) => r.accepted).length,
    rejected: results.filter((r) => !r.accepted).length,
    failed: results.filter((r) =>
      r.accepted ? r.errors.length : r.type !== 'PlanError',
    ).length,
    weeks: results.reduce((n, r) => n + (r.rows?.length ?? 0), 0),
  })),
  {
    name: 'Adversarial boundaries',
    cases: boundaries.cases,
    accepted: boundaries.accepted,
    rejected: boundaries.rejected,
    failed: boundaries.failed,
    weeks: boundaries.weeksCount,
  },
];
const summary = {
  generatedAt: new Date().toISOString(),
  libSourceSha256: road.summary.libSourceSha256,
  sweeps,
  totals: Object.fromEntries(
    ['cases', 'accepted', 'rejected', 'failed', 'weeks'].map((key) => [
      key,
      sweeps.reduce((n, sweep) => n + sweep[key], 0),
    ]),
  ),
};
await writeFile(
  resolve(destination, 'summary.json'),
  JSON.stringify(summary, null, 2) + '\n',
);

const start = '2026-09-21';
const quality = (w) =>
  !['long', 'race'].includes(w.kind) &&
  w.stimulus !== 'economy' &&
  w.steps.some(
    (s) => s.kind === 'work' && s.intensity >= 4 && s.movement !== 'walk',
  );
const rounded = (n) => Number(n.toFixed(2));
const safe = (value) =>
  String(value).replaceAll('|', '/').replaceAll('\n', ' ');
const examples = [];
for (const [goal, weeklyKm, longestKm] of [
  ['5k', 55, 13],
  ['10k', 60, 15],
  ['half', 65, 18],
  ['marathon', 60, 23],
]) {
  for (const count of [0, 1, 2]) {
    const input = {
      ...demoProfile(start),
      goal,
      raceName: `Synthetic ${goal} event`,
      weeklyKm,
      longestKm,
      raceDate: addDays(start, 83),
      currentRuns: 5,
      runsPerWeek: 5,
      days: [0, 1, 2, 4, 6],
      availableDays: [0, 1, 2, 3, 4, 5, 6],
      longDay: 6,
      weekdayMinutes: 120,
      longMinutes: 300,
      easyPace: 6,
      qualityMode: 'custom',
      qualitySessions: count,
      recentQualitySessions: count,
      recentQualityMinutes: count * 20,
      runMeasure: 'distance',
    };
    const plan = makePlan(input, start, false);
    if (validatePlan(plan).length)
      throw new Error(`Invalid example: ${goal} q${count}`);
    examples.push({ id: `${goal}-12weeks-q${count}`, input, plan });
  }
}
await writeFile(
  resolve(destination, 'example-plans.json'),
  JSON.stringify(examples, null, 2) + '\n',
);
const lines = [
  '# Twelve-week plans: every day',
  '',
  'Production engine output. These established five-day runners have the recent quality history needed for their selected count. Developing and established road variants are in road-matrix/. Every table includes rest days. Counts exclude the long run, strides and race. Training totals exclude race distance.',
  '',
];
for (const { id, input, plan } of examples) {
  lines.push(
    `## ${id}`,
    '',
    `${input.weeklyKm} km/week; ${input.longestKm} km recent long; ${input.qualitySessions} weekday workouts; 6:00/km scheduling pace.`,
    '',
    '| Week / phase | Mon | Tue | Wed | Thu | Fri | Sat | Sun | Training km | Long km | Workouts |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: |',
  );
  for (const week of plan.weeks) {
    const runs = plan.workouts.filter((w) => w.week === week.index);
    const days = Array.from(
      { length: 7 },
      (_, i) =>
        runs
          .filter((w) => w.date === addDays(week.start, i))
          .map(
            (w) =>
              `${safe(w.title.replace(/^\d+(?:\.\d+)? (?:km|mi) · /, ''))} · ${rounded(w.estimatedKm)} km · ${rounded(w.minutes)} min`,
          )
          .join('<br>') || 'Rest',
    );
    lines.push(
      `| ${week.index + 1} · ${week.phase} | ${days.join(' | ')} | ${rounded(runs.filter((w) => w.kind !== 'race').reduce((n, w) => n + w.estimatedKm, 0))} | ${runs.find((w) => w.kind === 'long')?.estimatedKm ?? '—'} | ${runs.filter(quality).length} |`,
    );
  }
  lines.push('', 'Exact workout steps:', '');
  for (const w of plan.workouts.filter(quality))
    lines.push(
      `- **${w.date} — ${safe(w.title)}:** ` +
        w.steps
          .map(
            (s) =>
              `${safe(s.label)} ${s.metres === undefined ? `${rounded(s.seconds / 60)} min` : `${s.metres} m`} (${safe(s.effort)})`,
          )
          .join('; '),
    );
  if (plan.feasibility?.reasons.length)
    lines.push('', ...plan.feasibility.reasons.map((r) => `- ${r}`));
  lines.push('');
}
await writeFile(resolve(destination, 'day-by-day.md'), lines.join('\n'));
console.log(JSON.stringify(summary, null, 2));
if (summary.totals.failed) process.exitCode = 1;

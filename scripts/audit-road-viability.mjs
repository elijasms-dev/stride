/** Read-only, source-executing review of every saved day. No account or DB access.
 * node --experimental-strip-types scripts/audit-road-viability.mjs <repo> [output.json]
 * Cases are written here independently of the repository's contract fixtures.
 */
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = resolve(process.argv[2] ?? process.cwd());
const output = resolve(
  process.argv[3] ??
    'docs/verification/2026-09-24/viability-review/independent-road.json',
);
const { makePlan, validatePlan } = await import(
  pathToFileURL(resolve(root, 'lib/engine.ts'))
);
const { taperFactor, trainingPhaseOn } = await import(
  pathToFileURL(resolve(root, 'lib/plan/generation-calendar.ts'))
);
const start = '2026-09-21';
const after = (date, n) =>
  new Date(Date.parse(date + 'T12:00:00Z') + n * 86400000)
    .toISOString()
    .slice(0, 10);
const day = (date) => (new Date(date + 'T12:00:00Z').getUTCDay() + 6) % 7;
const gap = (a, b) => (Date.parse(b) - Date.parse(a)) / 86400000;
const doses = (w) =>
  w.steps
    .filter((s) => s.kind === 'work' && s.intensity >= 4)
    .reduce((n, s) => n + s.seconds / 60, 0);
const quality = (w) =>
  !['long', 'race'].includes(w.kind) &&
  w.stimulus !== 'economy' &&
  doses(w) > 0;
const levels = {
  developing: { runs: 3, '5k': [12, 4], '10k': [18, 6], half: [24, 10] },
  established: { runs: 4, '5k': [30, 8], '10k': [36, 11], half: [45, 16] },
  advanced: { runs: 5, '5k': [55, 13], '10k': [60, 16], half: [65, 18] },
};
const results = [];
for (const goal of ['5k', '10k', 'half'])
  for (const [ability, level] of Object.entries(levels))
    for (const weeks of [8, 12, 18])
      for (const selectedQuality of [0, 1, 2]) {
        const [weeklyKm, longestKm] = level[goal];
        const input = {
          name: 'Independent synthetic viability audit',
          raceName: 'Synthetic ' + goal,
          goal,
          startDate: start,
          raceDate: after(start, weeks * 7 - 1),
          weeklyKm,
          longestKm,
          currentRuns: level.runs,
          runsPerWeek: level.runs,
          days: { 3: [1, 3, 6], 4: [0, 2, 4, 6], 5: [0, 1, 2, 4, 6] }[
            level.runs
          ],
          availableDays: [0, 1, 2, 3, 4, 5, 6],
          longDay: 6,
          weekdayMinutes: 120,
          longMinutes: 300,
          experience: 'established',
          difficulty: 'balanced',
          intent: 'improve',
          volume: 'gradual',
          timezone: 'Europe/Dublin',
          units: 'km',
          easyPace: 6,
          qualityMode: 'custom',
          qualitySessions: selectedQuality,
          recentQualitySessions: selectedQuality,
          recentQualityMinutes: selectedQuality * 20,
          runMeasure: 'distance',
          workoutFormat: 'time',
          workoutVariety: 'varied',
        };
        const id = `${goal}-${ability}-${weeks}weeks-q${selectedQuality}`;
        const expectedRejection = selectedQuality === 2 && level.runs < 5;
        const failures = [];
        const inputSnapshot = JSON.stringify(input);
        try {
          const plan = makePlan(input, start, false);
          if (expectedRejection)
            failures.push(
              'Accepted two quality sessions without five-day eligibility.',
            );
          if (JSON.stringify(input) !== inputSnapshot)
            failures.push('Generation mutated the supplied profile.');
          const validation = validatePlan(plan),
            roundtrip = validatePlan(JSON.parse(JSON.stringify(plan)));
          if (validation.length || roundtrip.length)
            failures.push(...validation, ...roundtrip);
          const weeksOutput = [];
          let previousOrdinaryLong;
          for (const week of plan.weeks) {
            const runs = plan.workouts.filter((w) => w.week === week.index);
            const training = runs.filter((w) => w.kind !== 'race');
            const markedLong = training.find((w) => w.kind === 'long');
            const ordinary =
              !['Recovery', 'Taper', 'Race week'].includes(week.phase) &&
              training.every((w) => taperFactor(plan.profile, w.date) === 1);
            const km = training.reduce((n, w) => n + w.estimatedKm, 0),
              minutes = training.reduce((n, w) => n + w.minutes, 0);
            if (ordinary && training.length !== input.runsPerWeek)
              failures.push(
                `Week${week.index + 1}: run count${training.length} !=${input.runsPerWeek}`,
              );
            if (ordinary && training.filter(quality).length !== selectedQuality)
              failures.push(`Week${week.index + 1}: quality count drift`);
            if (week.index === 0) {
              if (Math.abs(km - weeklyKm) > 0.002)
                failures.push(`Opening baseline${km} !=${weeklyKm}`);
              if (markedLong?.estimatedKm !== longestKm)
                failures.push('Opening long baseline changed');
            }
            if (ordinary && markedLong) {
              if (week.index > 0 && !Number.isInteger(markedLong.estimatedKm))
                failures.push(`Week${week.index + 1}: fractional long growth`);
              if (
                previousOrdinaryLong !== undefined &&
                markedLong.estimatedKm < previousOrdinaryLong - 0.001
              )
                failures.push(
                  `Week${week.index + 1}: unmarked long regression`,
                );
              previousOrdinaryLong = markedLong.estimatedKm;
              for (const run of training.filter(
                (w) => w.kind === 'easy' && !w.hard,
              ))
                if (run.estimatedKm > markedLong.estimatedKm + 0.002)
                  failures.push(
                    `Week${week.index + 1}: hidden long ${run.estimatedKm}km>${markedLong.estimatedKm}km`,
                  );
            }
            for (const run of runs) {
              if (
                !input.availableDays.includes(day(run.date)) &&
                run.kind !== 'race'
              )
                failures.push('Unavailable running day');
              if (run.date < start || run.date > input.raceDate)
                failures.push('Outside requested block');
              if (
                Math.abs(
                  run.steps.reduce((n, s) => n + s.seconds, 0) / 60 -
                    run.minutes,
                ) > 0.0001
              )
                failures.push('Step duration mismatch');
              if (
                run.steps.some(
                  (s) => !Number.isFinite(s.seconds) || s.seconds <= 0,
                )
              )
                failures.push('Non-executable step');
              if (
                quality(run) &&
                (!run.steps.some((s) => s.kind === 'warmup') ||
                  !run.steps.some((s) => s.kind === 'cooldown'))
              )
                failures.push('Quality missing warm-up/cool-down');
            }
            weeksOutput.push({
              index: week.index + 1,
              phase: week.phase,
              ordinary,
              trainingKm: km,
              trainingMinutes: minutes,
              quality: training.filter(quality).length,
              longKm: markedLong?.estimatedKm ?? null,
              days: Array.from({ length: 7 }, (_, i) => ({
                date: after(week.start, i),
                runs: runs
                  .filter((w) => w.date === after(week.start, i))
                  .map((w) => ({
                    kind: w.kind,
                    title: w.title,
                    km: w.estimatedKm,
                    minutes: w.minutes,
                    qualityMinutes: doses(w),
                    phase: trainingPhaseOn(plan.profile, week.phase, w.date),
                    steps: w.steps,
                  })),
              })),
            });
          }
          const demanding = plan.workouts
            .filter((w) => quality(w) || w.kind === 'long' || w.kind === 'race')
            .sort((a, b) => a.date.localeCompare(b.date));
          for (let i = 1; i < demanding.length; i++)
            if (gap(demanding[i - 1].date, demanding[i].date) < 2)
              failures.push(
                `Demanding sessions adjacent:${demanding[i - 1].date}/${demanding[i].date}`,
              );
          const peak = Math.max(...weeksOutput.map((w) => w.trainingKm));
          if (weeksOutput.at(-1).trainingKm >= peak)
            failures.push('Race-week training not reduced');
          results.push({
            id,
            input,
            status: failures.length ? 'failed' : 'accepted',
            failures,
            feasibility: plan.feasibility,
            weeks: weeksOutput,
          });
        } catch (error) {
          results.push({
            id,
            input,
            status:
              expectedRejection && error.name === 'PlanError'
                ? 'expected-rejection'
                : 'failed',
            error: error.message,
            failures: expectedRejection ? [] : [error.message],
          });
        }
      }
const hash = createHash('sha256');
async function digest(path) {
  for (const item of (await readdir(path, { withFileTypes: true })).sort(
    (a, b) => a.name.localeCompare(b.name),
  )) {
    const next = resolve(path, item.name);
    if (item.isDirectory()) await digest(next);
    else if (/\.tsx?$/.test(item.name)) {
      hash.update(relative(root, next));
      hash.update(await readFile(next));
    }
  }
}
await digest(resolve(root, 'lib'));
const summary = {
  generatedAt: new Date().toISOString(),
  libSourceSha256: hash.digest('hex'),
  scenarios: results.length,
  accepted: results.filter((r) => r.status === 'accepted').length,
  expectedRejections: results.filter((r) => r.status === 'expected-rejection')
    .length,
  failed: results.filter((r) => r.status === 'failed').length,
  generatedWeeks: results.reduce((n, r) => n + (r.weeks?.length ?? 0), 0),
  failureCases: results
    .filter((r) => r.status === 'failed')
    .map(({ id, failures, error }) => ({ id, failures, error })),
};
await writeFile(output, JSON.stringify({ summary, results }, null, 2) + '\n');
console.log(JSON.stringify({ ...summary, output }, null, 2));
if (summary.failed) process.exitCode = 1;

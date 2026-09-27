/** Reference-property audit, with immutable before/after evidence.
 * Run before production edits, then after each individually reviewed fix:
 * node --experimental-strip-types scripts/verify-short-race-reference.mjs --stage before
 * node --experimental-strip-types scripts/verify-short-race-reference.mjs --stage after-bug1
 * node --experimental-strip-types scripts/verify-short-race-reference.mjs --stage after-bug2
 * --stage verify-<label> verifies the final contract without replacing prior evidence.
 * This is not an exact reproduction of a published schedule. Assertions concern
 * only the properties explicitly requested in the user's supplied reference.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  addDays,
  demoProfile,
  makePlan,
  validatePlan,
  taperFactor,
} from '../lib/engine.ts';
import { mandatoryTaperWeeks } from '../lib/progression-engine.ts';

const root = new URL('../', import.meta.url);
const folder = new URL(
  'docs/verification/2026-09-27/short-race-reference/',
  root,
);
const stageIndex = process.argv.indexOf('--stage');
const stage = stageIndex < 0 ? undefined : process.argv[stageIndex + 1];
assert.ok(
  stage &&
    /^(before|after-bug[12](?:-[a-z0-9-]+)?|verify-[a-z0-9-]+)$/.test(stage),
  'Choose a unique --stage before, after-bug1[-label], after-bug2[-label] or verify-<label>',
);
const fixedStart = '2026-09-28';
const protectedGoals = ['half', 'marathon', 'ultra'];
const config = {
  '5k': { weeks: [8, 10, 12, 16, 20], long: 10, kmPerDay: 7, raceKm: 5 },
  '10k': { weeks: [8, 10, 12, 16, 20], long: 12, kmPerDay: 8, raceKm: 10 },
  half: { weeks: [8, 12, 16, 20], long: 16, kmPerDay: 10, raceKm: 21.0975 },
  marathon: { weeks: [8, 12, 16, 20], long: 23, kmPerDay: 13, raceKm: 42.195 },
  ultra: { weeks: [12, 16, 20], long: 25, kmPerDay: 15, raceKm: 50 },
};
const daysByCount = {
  3: [1, 3, 6],
  4: [0, 2, 4, 6],
  5: [0, 1, 2, 4, 6],
  6: [0, 1, 2, 3, 4, 6],
};
const cases = [];
for (const [goal, settings] of Object.entries(config))
  for (const days of [3, 4, 5, 6])
    for (const weeks of settings.weeks)
      for (const q of [0, 1, 2]) {
        cases.push({
          id: `${goal}-${weeks}w-${days}d-q${q}`,
          group: 'main',
          input: {
            ...demoProfile(fixedStart),
            goal,
            raceName: `${goal} reference-property regression`,
            raceDate: addDays(fixedStart, weeks * 7 - 1),
            ...(goal === 'ultra' ? { raceDistanceKm: settings.raceKm } : {}),
            weeklyKm: settings.kmPerDay * days,
            longestKm: settings.long,
            days: daysByCount[days],
            availableDays: [0, 1, 2, 3, 4, 5, 6],
            currentRuns: days,
            runsPerWeek: days,
            longDay: 6,
            weekdayMinutes: 120,
            longMinutes: 300,
            easyPace: 6,
            recentRace: {
              distanceKm: 5,
              timeMinutes: 25,
              date: '2026-09-20',
              source: 'race',
              course: 'road',
            },
            qualityMode: 'custom',
            qualitySessions: q,
            recentQualitySessions: 2,
            recentQualityMinutes: 40,
            method: 'balanced',
            experience: 'established',
            stableWeeks: 16,
            runMeasure: 'distance',
          },
        });
      }

// Advanced 5K inputs support the existing explicit two-workout prerequisite.
// Q0/Q1/Q2 remain input-identical within each matched advanced group.
for (const days of [5, 6])
  for (const weeks of config['5k'].weeks)
    for (const q of [0, 1, 2]) {
      const base = cases.find(
        (item) => item.id === `5k-${weeks}w-${days}d-q${q}`,
      );
      cases.push({
        id: `5k-${weeks}w-${days}d-q${q}-advanced`,
        group: 'main',
        input: {
          ...base.input,
          weeklyKm: days * 9,
          longestKm: 13,
        },
      });
    }

// Exceptions to the intermediate reference: choosing zero weekday workouts or
// a foundation course must not manufacture unrequested quality workouts.
for (const goal of ['5k', '10k']) {
  const base = cases.find((item) => item.id === `${goal}-8w-4d-q1`).input;
  cases.push({
    id: `${goal}-8w-foundation`,
    group: 'foundation',
    input: {
      ...base,
      weeklyKm: 0,
      longestKm: 0,
      currentRuns: 0,
      runsPerWeek: 3,
      days: [1, 3, 6],
      experience: 'new',
      planLevel: 'beginner',
      recentRace: undefined,
      easyPace: null,
      qualitySessions: 0,
      recentQualitySessions: 0,
      recentQualityMinutes: 0,
      runMeasure: 'time',
    },
  });
}

const round = (value) => Number(value.toFixed(3));
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        // Only the declared policy/engine version is ignored. Identity, notes,
        // pace targets, recipe steps, dose, profile and feasibility remain checked.
        .filter((key) => !['engineVersion', 'policyVersion'].includes(key))
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  return value;
}
function digest(value) {
  return createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');
}
async function fingerprint() {
  const hash = createHash('sha256');
  async function walk(url) {
    for (const entry of (await readdir(url, { withFileTypes: true })).sort(
      (a, b) => a.name.localeCompare(b.name),
    )) {
      const child = new URL(entry.name + (entry.isDirectory() ? '/' : ''), url);
      if (entry.isDirectory()) await walk(child);
      else if (entry.name.endsWith('.ts')) {
        hash.update(child.href.slice(root.href.length));
        hash.update(await readFile(child));
      }
    }
  }
  await walk(new URL('lib/', root));
  return hash.digest('hex');
}
const quality = (workout) =>
  !['race', 'long', 'easy'].includes(workout.kind) &&
  workout.status !== 'skipped' &&
  workout.steps.some(
    (step) =>
      step.kind === 'work' && step.intensity >= 4 && step.movement !== 'walk',
  );
function weekRows(plan) {
  return plan.weeks.map((week) => {
    const runs = plan.workouts.filter(
      (workout) => workout.week === week.index && workout.status !== 'skipped',
    );
    const training = runs.filter((workout) => workout.kind !== 'race');
    return {
      week: week.index + 1,
      phase: week.phase,
      targetKm: week.targetKm,
      actualKm: round(
        training.reduce((sum, workout) => sum + workout.estimatedKm, 0),
      ),
      longKm:
        training.find((workout) => workout.kind === 'long')?.estimatedKm ??
        null,
      weekdayQuality: training.filter(quality).length,
      hardOutings: training.filter((workout) => workout.hard).length,
      kinds: runs.map((workout) => workout.kind),
      runs: runs.map((workout) => ({
        date: workout.date,
        phase: workout.phase,
        kind: workout.kind,
        km: round(workout.estimatedKm),
        minutes: round(workout.minutes),
        title: workout.title,
      })),
      prescriptionHash: digest({
        week,
        workouts: plan.workouts.filter(
          (workout) => workout.week === week.index,
        ),
      }),
    };
  });
}
const sourceBefore = await fingerprint();
const records = cases.map(({ id, group, input }) => {
  const pristine = structuredClone(input);
  try {
    const plan = makePlan(input, fixedStart, false);
    assert.deepEqual(input, pristine, 'Generation mutated input');
    return {
      id,
      group,
      input,
      status: 'generated',
      validationErrors: validatePlan(plan),
      protectedHash: digest(plan),
      mandatoryTaperWeeks: mandatoryTaperWeeks(
        input.goal,
        plan.weeks.length,
        input.goal,
      ),
      dailyTaperDays: Array.from(
        { length: 29 },
        (_, index) => 28 - index,
      ).filter(
        (days) => taperFactor(plan.profile, addDays(input.raceDate, -days)) < 1,
      ),
      beginner: plan.beginner,
      firstRace: plan.firstRace,
      weeks: weekRows(plan),
    };
  } catch (error) {
    assert.deepEqual(input, pristine, 'Rejected generation mutated input');
    return {
      id,
      group,
      input,
      status: 'rejected',
      error: { name: error.name, message: error.message },
    };
  }
});
const sourceAfter = await fingerprint();
assert.equal(
  sourceBefore,
  sourceAfter,
  'Source changed while the matrix was running; rerun with a fresh stage label',
);
const failures = [];
const expect = (condition, message) => {
  if (!condition) failures.push(message);
};
for (const record of records.filter((item) => item.status === 'generated')) {
  expect(
    record.validationErrors.length === 0,
    `${record.id}: validatePlan: ${record.validationErrors.join('; ')}`,
  );
  if (record.input.qualitySessions === 0 || record.beginner) {
    expect(
      record.weeks.every((week) => week.weekdayQuality === 0),
      `${record.id}: zero-workout choice gained a weekday quality workout`,
    );
  }
  if (record.input.goal === 'half' && record.group === 'main') {
    const expectedRecoveryWeeks = record.weeks.filter(
      (week) =>
        week.week % 4 === 0 &&
        week.week < record.weeks.length - record.mandatoryTaperWeeks,
    );
    expect(
      expectedRecoveryWeeks.every((week) => week.phase === 'Recovery'),
      `${record.id}: half cutback missing at ${expectedRecoveryWeeks
        .filter((week) => week.phase !== 'Recovery')
        .map((week) => week.week)
        .join(', ')}`,
    );
  }
  if (
    stage !== 'before' &&
    ['5k', '10k'].includes(record.input.goal) &&
    record.group === 'main'
  ) {
    expect(
      record.weeks.every((week) => week.phase !== 'Recovery'),
      `${record.id}: short race still has a full recovery week`,
    );
    if (record.input.qualitySessions > 0)
      expect(
        record.weeks.every((week) => week.weekdayQuality >= 1),
        `${record.id}: quality missing in week(s) ${record.weeks
          .filter((week) => week.weekdayQuality === 0)
          .map((week) => week.week)
          .join(', ')}`,
      );
    if (!stage.startsWith('after-bug1')) {
      const taperDays = record.input.goal === '5k' ? 7 : 14;
      expect(
        record.mandatoryTaperWeeks === taperDays / 7,
        `${record.id}: mandatory taper does not match reference`,
      );
      expect(
        JSON.stringify(record.dailyTaperDays) ===
          JSON.stringify(
            Array.from(
              { length: taperDays },
              (_, index) => taperDays - 1 - index,
            ),
          ),
        `${record.id}: executable daily taper does not match ${taperDays} inclusive days ending on race day`,
      );
    }
  }
}
for (const goal of ['5k', '10k']) {
  const minimum = records.find((record) => record.id === `${goal}-8w-4d-q1`);
  expect(
    minimum?.status === 'generated',
    `${goal}: required eight-week q1 reference example was rejected`,
  );
}
let protectedCompared = 0;
if (stage !== 'before') {
  const baseline = JSON.parse(
    await readFile(new URL('before.json', folder), 'utf8'),
  );
  for (const prior of baseline.records.filter(
    (item) => item.status === 'generated',
  )) {
    expect(
      records.find((item) => item.id === prior.id)?.status === 'generated',
      `${prior.id}: previously generated input now refuses generation`,
    );
  }
  for (const record of records.filter((item) =>
    protectedGoals.includes(item.input.goal),
  )) {
    const prior = baseline.records.find((item) => item.id === record.id);
    expect(!!prior, `${record.id}: missing immutable baseline`);
    expect(
      record.status === prior?.status,
      `${record.id}: protected outcome changed`,
    );
    if (record.status === 'generated') {
      expect(
        record.protectedHash === prior?.protectedHash,
        `${record.id}: protected prescription/profile/notes changed`,
      );
      protectedCompared++;
    } else
      expect(
        JSON.stringify(record.error) === JSON.stringify(prior?.error),
        `${record.id}: protected refusal changed`,
      );
  }
}
const summary = {
  stage,
  commit: execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: fileURLToPath(root),
    encoding: 'utf8',
  }).trim(),
  sourceSha256: sourceBefore,
  cases: records.length,
  generated: records.filter((record) => record.status === 'generated').length,
  rejected: records.filter((record) => record.status === 'rejected').length,
  weeks: records.reduce(
    (total, record) => total + (record.weeks?.length ?? 0),
    0,
  ),
  protectedCompared,
  failures,
  goalCounts: Object.fromEntries(
    Object.keys(config).map((goal) => [
      goal,
      {
        generated: records.filter(
          (record) =>
            record.input.goal === goal && record.status === 'generated',
        ).length,
        rejected: records.filter(
          (record) =>
            record.input.goal === goal && record.status === 'rejected',
        ).length,
      },
    ]),
  ),
};
await mkdir(folder, { recursive: true });
await writeFile(
  new URL(`${stage}.json`, folder),
  JSON.stringify({ summary, records }, null, 2) + '\n',
  { flag: 'wx' },
);
const lines = [
  `# Short-race reference regression: ${stage}`,
  '',
  'Synthetic matched inputs; each quality choice retains exactly the same fitness, available time, long run and weekly baseline. Counts exclude race and long outings. Refusals are listed separately and are not passing generated plans. Only metadata engineVersion/policyVersion is excluded from protected full-output hashes. The fixture protects half/marathon/ultra from this scoped change; it does not certify their coaching quality.',
  '',
  '```json',
  JSON.stringify(summary, null, 2),
  '```',
  '',
  '## Every generated week',
  '',
];
for (const record of records.filter((item) => item.status === 'generated')) {
  lines.push(
    `### ${record.id}`,
    '',
    `Input: ${record.input.weeklyKm} km/week, ${record.input.longestKm} km long, ${record.input.runsPerWeek} days; ${record.input.qualitySessions} requested weekday workouts. Mandatory taper: ${record.mandatoryTaperWeeks} week(s). Daily taper offsets: ${record.dailyTaperDays.join(', ')} days before race.`,
    '',
    '| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |',
    '| --- | --- | ---: | ---: | ---: | ---: | --- |',
  );
  for (const week of record.weeks)
    lines.push(
      `| ${week.week} | ${week.phase} | ${round(week.targetKm)} | ${week.actualKm} | ${week.longKm === null ? '—' : round(week.longKm)} | ${week.weekdayQuality} | ${week.kinds.join(', ')} |`,
    );
  lines.push('');
}
lines.push('## Explicit refusals', '', '| Case | Refusal |', '| --- | --- |');
for (const record of records.filter((item) => item.status === 'rejected'))
  lines.push(
    `| ${record.id} | ${record.error.name}: ${record.error.message.replaceAll('|', '/').replaceAll('\n', ' ')} |`,
  );
await writeFile(new URL(`${stage}.md`, folder), lines.join('\n') + '\n', {
  flag: 'wx',
});
console.log(JSON.stringify(summary, null, 2));
if (failures.length) process.exitCode = 1;

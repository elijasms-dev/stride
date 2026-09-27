/** Independent synthetic road matrix. No account, database or network writes. */
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  demoProfile,
  makePlan,
  validatePlan,
  addDays,
  taperFactor,
} from '../lib/engine.ts';
const start = '2026-09-28';
const out = new URL(
  '../docs/verification/2026-09-25/all-distance-stress/',
  import.meta.url,
);
await mkdir(out, { recursive: true });
const label = process.argv[2] ?? 'latest';
if (!/^[a-zA-Z0-9_-]+$/.test(label))
  throw new Error('Use a filename-safe run label.');
const sourceSha256AtStart = await libFingerprint();
const levels = {
  developing: { runs: 3, '5k': [12, 4], '10k': [18, 6], half: [24, 10] },
  established: { runs: 4, '5k': [30, 8], '10k': [36, 11], half: [45, 16] },
  advanced: { runs: 6, '5k': [55, 13], '10k': [60, 16], half: [65, 18] },
};
const days = { 3: [1, 3, 6], 4: [0, 2, 4, 6], 6: [0, 1, 2, 3, 4, 6] };
const cases = [];
function add(id, goal, level, q, patch = {}, expectation) {
  const ability = levels[level];
  const [weeklyKm, longestKm] = ability[goal];
  const input = {
    ...demoProfile(start),
    goal,
    name: 'Road stress synthetic',
    weeklyKm,
    longestKm,
    currentRuns: ability.runs,
    runsPerWeek: ability.runs,
    days: days[ability.runs],
    availableDays: [0, 1, 2, 3, 4, 5, 6],
    longDay: 6,
    weekdayMinutes: 120,
    longMinutes: 300,
    qualityMode: 'custom',
    qualitySessions: q,
    recentQualitySessions: q,
    recentQualityMinutes: q * 20,
    runMeasure: 'distance',
    raceDate: addDays(start, 111),
    ...patch,
  };
  // Deliberate boundary probes may hit authored capacity limits. They are
  // reported separately, never counted as successfully generated plans.
  const qualityConflict = q === 2 && (ability.runs < 5 || input.weeklyKm < 45);
  const benchmarkFiveK = input.recentRace
    ? input.recentRace.timeMinutes / (input.recentRace.distanceKm / 5) ** 1.06
    : null;
  const capacityProbe =
    input.easyPace >= 7.5 ||
    benchmarkFiveK > 35 ||
    (goal === '10k' &&
      level === 'developing' &&
      q === 1 &&
      benchmarkFiveK > 24) ||
    (input.easyPace === 3 && level === 'developing' && q === 1) ||
    (input.weeklyKm === 30 &&
      input.longestKm === 20 &&
      input.easyPace === 4.5 &&
      q === 1);
  cases.push({
    id,
    input,
    expectation:
      expectation ??
      (qualityConflict
        ? 'quality-rejection'
        : capacityProbe
          ? 'capacity-probe'
          : 'generate'),
  });
}
// A normal 25-minute 5K benchmark can still conflict with a three-day 18/6 km
// routine: one short entry workout must carry 6 km while its aerobic padding is
// bounded. With a fourth familiar running day, the same mileage has room to fit.
// These counterparts MUST generate, so a broad capacity refusal cannot pass.
for (const km of [1.609344, 5, 10, 21.0975, 42.195])
  for (const runMeasure of ['distance', 'time'])
    add(
      `10k-four-day-counterpart-${km}-${runMeasure}`,
      '10k',
      'developing',
      1,
      {
        currentRuns: 4,
        runsPerWeek: 4,
        days: [0, 2, 4, 6],
        easyPace: null,
        runMeasure,
        recentRace: { distanceKm: km, timeMinutes: 25 * (km / 5) ** 1.06 },
      },
      'generate',
    );
for (const goal of ['5k', '10k', 'half'])
  for (const level of Object.keys(levels))
    for (const pace of [3, 4.5, 6, 7.5, 9, 12, 15])
      for (const q of [0, 1, 2])
        for (const runMeasure of ['distance', 'time'])
          for (const weeks of [8, 20])
            add(
              `${goal}-${level}-p${pace}-q${q}-${runMeasure}-${weeks}w`,
              goal,
              level,
              q,
              {
                easyPace: pace,
                runMeasure,
                raceDate: addDays(start, weeks * 7 - 1),
                workoutTargets: { mode: 'effort' },
                workoutFormat: weeks === 8 ? 'time' : 'distance',
              },
            );
for (const goal of ['5k', '10k', 'half'])
  for (const km of [1.609344, 5, 10, 21.0975, 42.195])
    for (const fiveK of [16, 25, 40])
      for (const level of Object.keys(levels))
        for (const q of [0, 1, 2])
          for (const runMeasure of ['distance', 'time'])
            add(
              `${goal}-${level}-benchmark${km}-${fiveK}-q${q}-${runMeasure}`,
              goal,
              level,
              q,
              {
                easyPace: null,
                runMeasure,
                recentRace: {
                  distanceKm: km,
                  timeMinutes: fiveK * (km / 5) ** 1.06,
                  date: '2026-09-20',
                  source: 'race',
                  course: 'road',
                },
                workoutFormat: q === 2 ? 'distance' : 'automatic',
              },
            );
for (const goal of ['5k', '10k', 'half']) {
  for (const [weeklyKm, longestKm] of [
    [30, 20],
    [30, 10.5],
    [30.5, 10.7],
    [45, 14.7],
    [55.5, 20.5],
  ])
    for (const q of [0, 1, 2])
      for (const easyPace of [4.5, 6, 8])
        add(
          `${goal}-fractional-${weeklyKm}-${longestKm}-p${easyPace}-q${q}`,
          goal,
          'advanced',
          q,
          { weeklyKm, longestKm, easyPace },
          q === 2 && weeklyKm < 45 ? 'quality-rejection' : undefined,
        );
  for (const [name, patch] of [
    ['negative', { weeklyKm: -1 }],
    ['nan', { easyPace: NaN }],
    ['infinite', { longestKm: Infinity }],
    ['long-above-week', { weeklyKm: 20, longestKm: 21 }],
    ['invalid-race', { recentRace: { distanceKm: 0, timeMinutes: 25 } }],
    ['impossible-time', { weeklyMinutesLimit: 30 }],
    [
      'negative-pace',
      {
        workoutTargets: {
          mode: 'pace',
          pace: { easy: { low: -1, high: 360 } },
        },
      },
    ],
  ]) {
    if (typeof name !== 'string')
      throw new TypeError('Expected a scenario label.');
    add(
      `${goal}-invalid-${name}`,
      goal,
      'established',
      1,
      patch,
      'input-rejection',
    );
  }
}
const quality = (w) =>
  !['long', 'race'].includes(w.kind) &&
  w.stimulus !== 'economy' &&
  w.steps.some(
    (s) => s.kind === 'work' && s.intensity >= 4 && s.movement !== 'walk',
  );
const gap = (a, b) =>
  (Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000;
const results = [];
for (const c of cases) {
  const failures = [];
  const check = (ok, message) => {
    if (!ok && !failures.includes(message)) failures.push(message);
  };
  const saved = JSON.stringify(c.input);
  try {
    const plan = makePlan(c.input, start, false);
    check(
      ['generate', 'capacity-probe'].includes(c.expectation),
      'Unexpected acceptance: ' + c.expectation,
    );
    check(JSON.stringify(c.input) === saved, 'Input mutated');
    failures.push(
      ...validatePlan(plan),
      ...validatePlan(JSON.parse(JSON.stringify(plan))),
    );
    const weeks = [];
    let lastLong, lastWeek;
    for (const week of plan.weeks) {
      const runs = plan.workouts.filter(
        (w) => w.week === week.index && w.kind !== 'race',
      );
      const long = runs.find((w) => w.kind === 'long');
      const km = runs.reduce((n, w) => n + w.estimatedKm, 0);
      const ordinary =
        !['Recovery', 'Taper', 'Race week'].includes(week.phase) &&
        week.start >= c.input.startDate &&
        addDays(week.start, 6) < c.input.raceDate &&
        runs.every((w) => taperFactor(plan.profile, w.date) === 1);
      check(
        Math.abs(week.targetKm - km) <= 0.051,
        `W${week.index + 1}: displayed weekly total differs`,
      );
      if (week.index === 0) {
        check(
          Math.abs(km - c.input.weeklyKm) <= 0.011,
          `Opening weekly baseline changed ${km}`,
        );
        check(
          Math.abs((long?.estimatedKm ?? 0) - c.input.longestKm) <= 0.0011,
          `Opening long baseline changed ${long?.estimatedKm}`,
        );
      }
      if (ordinary) {
        check(
          runs.length === c.input.runsPerWeek,
          `W${week.index + 1}: run count differs`,
        );
        check(
          runs.filter(quality).length === c.input.qualitySessions,
          `W${week.index + 1}: quality count differs`,
        );
        check(long, `W${week.index + 1}: no long run`);
        if (long) {
          check(
            lastLong === undefined || long.estimatedKm >= lastLong - 0.001,
            `W${week.index + 1}: unmarked long regression`,
          );
          check(
            lastLong === undefined || long.estimatedKm <= lastLong + 2.001,
            `W${week.index + 1}: long jump exceeds 2km`,
          );
          check(
            long.estimatedKm <= c.input.longestKm + 0.001 ||
              Number.isInteger(long.estimatedKm),
            `W${week.index + 1}: fractional long growth`,
          );
          check(
            runs
              .filter((w) => w.kind === 'easy')
              .every((w) => w.estimatedKm <= long.estimatedKm + 0.001),
            `W${week.index + 1}: hidden longer easy run`,
          );
          lastLong = long.estimatedKm;
        }
        check(
          lastWeek === undefined || km >= lastWeek - 0.011,
          `W${week.index + 1}: unmarked weekly regression`,
        );
        lastWeek = km;
      }
      for (const run of runs) {
        check(
          run.date >= start && run.date <= c.input.raceDate,
          'Run outside block',
        );
        check(
          run.steps.length > 0 &&
            run.steps.every((s) => Number.isFinite(s.seconds) && s.seconds > 0),
          'Invalid step duration',
        );
        check(
          Math.abs(
            run.steps.reduce((n, s) => n + s.seconds, 0) - run.minutes * 60,
          ) <= 1.01,
          'Step/workout duration mismatch',
        );
        check(
          run.minutes <=
            (run.kind === 'long'
              ? c.input.longMinutes
              : c.input.weekdayMinutes) +
              1 / 60 +
              0.000001,
          'Time cap exceeded',
        );
        if (quality(run))
          check(
            run.steps.some((s) => s.kind === 'warmup') &&
              run.steps.some((s) => s.kind === 'cooldown'),
            'Quality missing warmup/cooldown',
          );
        if (
          run.steps.every(
            (s) => s.metres !== undefined || s.target?.mode === 'pace',
          )
        ) {
          const low = run.steps.reduce(
            (n, s) =>
              n +
              (s.metres !== undefined
                ? s.metres / 1000
                : s.seconds / s.target.high),
            0,
          );
          const high = run.steps.reduce(
            (n, s) =>
              n +
              (s.metres !== undefined
                ? s.metres / 1000
                : s.seconds / s.target.low),
            0,
          );
          check(
            run.estimatedKm >= low - 0.021 && run.estimatedKm <= high + 0.021,
            'Allocated distance outside executable range',
          );
        }
      }
      weeks.push({
        week: week.index + 1,
        phase: week.phase,
        km: +km.toFixed(3),
        longKm: long?.estimatedKm ?? null,
        quality: runs.filter(quality).length,
        runs: runs.length,
        ordinary,
      });
    }
    const hard = plan.workouts
      .filter((w) => quality(w) || w.kind === 'long' || w.kind === 'race')
      .sort((a, b) => a.date.localeCompare(b.date));
    for (let i = 1; i < hard.length; i++)
      check(
        gap(hard[i - 1].date, hard[i].date) >= 2,
        'Adjacent demanding days',
      );
    results.push({
      ...c,
      status: failures.length ? 'failed' : 'generated',
      failures,
      weeks,
    });
  } catch (error) {
    const correct =
      error.name === 'PlanError' &&
      (c.expectation === 'input-rejection' ||
        (c.expectation === 'quality-rejection' &&
          error.message.includes('Two quality sessions need')));
    const capacity =
      c.expectation === 'capacity-probe' &&
      error.name === 'PlanError' &&
      (error.message.startsWith(
        'Your starting weekly distance and long-run baseline cannot fit',
      ) ||
        /^Week \d+ cannot maintain .* within the selected running days/.test(
          error.message,
        ) ||
        error.message.startsWith(
          'The planned weekly distance cannot fit the prescribed pace ranges and session limits',
        ));
    results.push({
      ...c,
      status: correct
        ? 'expected-rejection'
        : capacity
          ? 'capacity-rejection'
          : 'failed',
      errorType: error.name,
      error: error.message,
      failures: correct || capacity ? [] : [error.message],
    });
  }
}
async function libFingerprint() {
  const sourceHash = createHash('sha256');
  async function digest(dir) {
    for (const entry of (await readdir(dir, { withFileTypes: true })).sort(
      (a, b) => a.name.localeCompare(b.name),
    )) {
      const path = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
      if (entry.isDirectory()) await digest(path);
      else if (entry.name.endsWith('.ts')) {
        sourceHash.update(path.pathname.split('/lib/')[1]);
        sourceHash.update(await readFile(path));
      }
    }
  }
  await digest(new URL('../lib/', import.meta.url));
  return sourceHash.digest('hex');
}
const sourceSha256 = await libFingerprint();
const summary = {
  createdAt: new Date().toISOString(),
  sourceSha256,
  sourceSha256AtStart,
  sourceStable: sourceSha256 === sourceSha256AtStart,
  cases: results.length,
  generated: results.filter((c) => c.status === 'generated').length,
  expectedRejections: results.filter((c) => c.status === 'expected-rejection')
    .length,
  capacityRejections: results.filter((c) => c.status === 'capacity-rejection')
    .length,
  failed: results.filter((c) => c.status === 'failed').length,
  weeks: results.reduce((n, c) => n + (c.weeks?.length ?? 0), 0),
  workouts: results.reduce(
    (n, c) => n + (c.weeks?.reduce((m, w) => m + w.runs, 0) ?? 0),
    0,
  ),
};
await writeFile(
  new URL(label === 'latest' ? 'road-stress.json' : `road-${label}.json`, out),
  JSON.stringify({ summary, results }, null, 2) + '\n',
  { flag: label === 'latest' ? 'w' : 'wx' },
);
console.log(
  JSON.stringify(
    {
      ...summary,
      failures: results
        .filter((c) => c.status === 'failed')
        .slice(0, 25)
        .map(({ id, failures }) => ({ id, failures })),
    },
    null,
    2,
  ),
);
if (summary.failed || !summary.sourceStable) process.exitCode = 1;

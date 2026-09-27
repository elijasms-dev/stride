/** Synthetic endurance/custom/base contracts. No accounts, network, or app writes.
 * A rejected accept-case is a failure: PlanError alone never counts as success.
 * Run: node --experimental-strip-types scripts/stress-endurance-distances.mjs --tag before
 * Reproduce: add --case <id>. Each tag writes new evidence without replacing older reports.
 */
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, relative } from 'node:path';
import { makePlan, demoProfile, validatePlan, addDays } from '../lib/engine.ts';
const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const argument = (name, fallback) =>
  args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const tag = argument('--tag', new Date().toISOString().replace(/[:.]/g, '-'));
if (!/^[a-zA-Z0-9_-]+$/.test(tag))
  throw new Error('Use a filename-safe report tag.');
const only = argument('--case', null);
const destination = resolve(
  root,
  'docs/verification/2026-09-25/all-distance-stress',
);
const start = '2026-09-28';
const finishGap = (date, race) =>
  Math.round((Date.parse(race) - Date.parse(date)) / 86400000);
const familyOf = (p) =>
  p.goal !== 'custom' && p.goal !== 'ultra'
    ? p.goal
    : p.raceDistanceKm <= 7.5
      ? '5k'
      : p.raceDistanceKm <= 15
        ? '10k'
        : p.raceDistanceKm <= 30
          ? 'half'
          : p.raceDistanceKm <= 45
            ? 'marathon'
            : 'ultra';
const cases = [];
const seen = new Set();
function add(
  id,
  profile,
  expectation = 'accept',
  proof = 'Established routine, sufficient history and generous session limits; acceptance is required.',
  errorPattern = null,
) {
  const key = JSON.stringify(profile);
  if (seen.has(key)) return;
  seen.add(key);
  cases.push({ id, profile, expectation, proof, errorPattern });
}
function targets(pace, goal, distance) {
  const sec = pace * 60;
  const range = (slow, spread = 0.06) => ({
    low: Math.floor(sec * (slow - spread)),
    high: Math.ceil(sec * slow),
  });
  return {
    mode: 'pace',
    bandsVersion: 2,
    raceScope: `${goal}:${distance ?? ''}`,
    pace: {
      easy: range(1),
      steady: range(0.92),
      tempo: range(0.87),
      threshold: range(0.83),
      interval: range(0.77),
      repetition: range(0.72),
      race: range(0.86),
    },
  };
}
function profile(
  goal,
  distance,
  weeklyKm,
  longestKm,
  runs,
  weeks,
  pace,
  benchmarkMinutes,
  quality,
  measure,
  mode,
) {
  const longUltra = distance > 80.4672;
  const p = {
    ...demoProfile(start),
    name: 'Synthetic endurance stress',
    goal,
    ...(distance === undefined ? {} : { raceDistanceKm: distance }),
    raceDate: addDays(start, weeks * 7 - 1),
    weeklyKm,
    longestKm,
    currentRuns: runs,
    runsPerWeek: runs,
    days:
      runs === 3
        ? [1, 3, 6]
        : runs === 4
          ? [0, 2, 4, 6]
          : runs === 5
            ? [0, 1, 2, 4, 6]
            : [0, 1, 2, 3, 4, 6],
    availableDays: [0, 1, 2, 3, 4, 5, 6],
    longDay: 6,
    weekdayMinutes: 120,
    longMinutes: longUltra ? 240 : 300,
    easyPace: pace,
    experience: 'established',
    intent: 'improve',
    qualityMode: 'custom',
    qualitySessions: quality,
    recentQualitySessions: 2,
    recentQualityMinutes: 40,
    runMeasure: measure,
    workoutFormat: 'time',
    workoutVariety: 'varied',
    ...(longUltra
      ? { stableWeeks: 16, ultraWeeklyMinutes: 1000, ultraLongestMinutes: 240 }
      : {}),
  };
  if (mode !== 'effort')
    p.recentRace = {
      distanceKm: 10,
      timeMinutes: benchmarkMinutes,
      date: '2026-09-01',
      source: 'race',
      course: 'road',
    };
  if (mode === 'manual') p.workoutTargets = targets(pace, goal, distance);
  if (mode === 'effort') p.workoutTargets = { mode: 'effort' };
  return p;
}
function matrix(goal, distance, baselines, weeksList, paces) {
  for (const [weeklyKm, longestKm, runs] of baselines)
    for (const weeks of weeksList)
      for (const [pace, benchmark] of paces)
        for (const quality of [0, 1, 2])
          for (const measure of ['time', 'distance'])
            for (const mode of ['effort', 'automatic', 'manual']) {
              const p = profile(
                goal,
                distance,
                weeklyKm,
                longestKm,
                runs,
                weeks,
                pace,
                benchmark,
                quality,
                measure,
                mode,
              );
              const id = `${goal}${distance === undefined ? '' : `-${distance}k`}-${weeklyKm}w${longestKm}l-${runs}d-${weeks}weeks-${pace}pace-q${quality}-${measure}-${mode}`;
              if (distance > 80.4672 && quality === 2)
                add(
                  id,
                  p,
                  'reject',
                  'Documented long-ultra policy permits at most one quality workout beyond 50 miles.',
                  'zero or one quality',
                );
              else if (quality === 2 && (runs < 5 || weeklyKm < 45))
                add(
                  id,
                  p,
                  'reject',
                  'Two quality workouts plus a long run need the supported five-day routine.',
                  'two|Two|running days|quality',
                );
              else
                add(
                  id,
                  p,
                  'accept',
                  goal === 'base' && quality > 0
                    ? 'Normalization probe: the base-plan UI disables quality workouts, and the product contract normalizes any accepted legacy choice to zero.'
                    : undefined,
                );
            }
}
matrix(
  'marathon',
  undefined,
  [
    [45, 16, 5],
    [70, 23, 5],
    [90, 28, 6],
  ],
  [12, 18, 26],
  [
    [4.5, 38],
    [6, 50],
    [8, 65],
  ],
);
matrix(
  'base',
  undefined,
  [
    [15, 5, 3],
    [30, 10, 4],
    [55, 15, 5],
  ],
  [4, 12, 26],
  [
    [4.5, 38],
    [6, 50],
    [8, 65],
  ],
);
for (const distance of [
  1, 4.9999, 5, 7.5, 7.5001, 10, 15, 15.0001, 21.0975, 30, 30.0001, 42.195, 45,
  45.0001, 50, 60, 60.0001, 80.4672,
]) {
  const low =
    distance <= 15
      ? [50, 12, 5]
      : distance <= 30
        ? [60, 20, 5]
        : distance <= 45
          ? [70, 23, 6]
          : [75, 28, 6];
  const high =
    distance <= 15
      ? [60, 15, 6]
      : distance <= 30
        ? [70, 22, 6]
        : distance <= 45
          ? [85, 28, 6]
          : [90, 32, 6];
  matrix(
    'custom',
    distance,
    [low, high],
    [16, 26],
    distance > 45
      ? [
          [5.5, 40],
          [7, 50],
        ]
      : [
          [4.5, 38],
          [8, 65],
        ],
  );
}
for (const distance of [50, 60, 80.4672])
  matrix(
    'ultra',
    distance,
    [
      [75, 28, 6],
      [90, 32, 6],
    ],
    [20, 32],
    [
      [5.5, 40],
      [6.5, 45],
      [7, 50],
    ],
  );
for (const goal of ['custom', 'ultra'])
  for (const distance of [80.4673, 100, 160.9344])
    matrix(
      goal,
      distance,
      [
        [90, 30, 6],
        [105, 32, 6],
      ],
      [24, 32],
      [
        [5.5, 40],
        [7, 50],
      ],
    );
// These rejections are justified before running the generator, not inferred from its answer.
const seed = profile(
  'marathon',
  undefined,
  70,
  23,
  5,
  18,
  6.5,
  50,
  0,
  'distance',
  'manual',
);
for (const [label, patch, proof, pattern] of [
  [
    'physical-time-cap',
    { weekdayMinutes: 20, longMinutes: 30 },
    'Even five outings capped at 20/30 minutes cannot contain a 23 km long run at the explicit easy range.',
    'fit|time|long-run|capacity|limits',
  ],
  [
    'longer-than-week',
    { weeklyKm: 20, longestKm: 30 },
    'A single recent long run cannot exceed the whole recent week.',
    'long|weekly',
  ],
  [
    'quality-without-history',
    { qualitySessions: 2, recentQualitySessions: 0, recentQualityMinutes: 0 },
    'The runner explicitly declares no established quality-work history.',
    'quality|Two',
  ],
  [
    'invalid-benchmark',
    { recentRace: { distanceKm: 10, timeMinutes: 0 } },
    'A completed 10 km result cannot take zero minutes.',
    'race|finish|pace|time',
  ],
  [
    'future-benchmark',
    { recentRace: { distanceKm: 10, timeMinutes: 50, date: '2027-01-01' } },
    'The benchmark lies after the generation date.',
    'future',
  ],
  [
    'inverted-target',
    {
      workoutTargets: { mode: 'pace', pace: { easy: { low: 450, high: 400 } } },
    },
    'The supplied faster endpoint exceeds the slower endpoint.',
    'ordered|range',
  ],
]) {
  if (typeof label !== 'string')
    throw new TypeError('Expected a scenario label.');
  add(`impossible-${label}`, { ...seed, ...patch }, 'reject', proof, pattern);
}
add(
  'impossible-ultra-history',
  {
    ...profile('ultra', 100, 90, 30, 6, 32, 7, 50, 1, 'time', 'effort'),
    stableWeeks: 0,
  },
  'reject',
  'Long-ultra policy requires 12 established weeks.',
  '12 weeks',
);
add(
  'impossible-custom-distance',
  { ...seed, goal: 'custom', raceDistanceKm: 161 },
  'reject',
  'Event exceeds the supported 100-mile product boundary.',
  'distance|160|100',
);

function independentChecks(plan, input) {
  const errors = [],
    facts = {
      weeks: plan.weeks.length,
      workouts: plan.workouts.length,
      paceSteps: 0,
      distanceSteps: 0,
      qualitySessions: 0,
    };
  const issue = (code, detail) => {
    if (errors.length < 30) errors.push({ code, ...detail });
  };
  const near = (a, b, tolerance = 0.002) =>
    Number.isFinite(a) && Math.abs(a - b) <= tolerance;
  for (const key of ['weeklyKm', 'longestKm', 'qualitySessions', 'runMeasure'])
    if (
      plan.profile[key] !==
      (key === 'qualitySessions' && input.goal === 'base' ? 0 : input[key])
    )
      issue('changedInput', {
        key,
        input: input[key],
        output: plan.profile[key],
      });
  const distances = { marathon: 42.195 };
  const expectedRaceKm =
    input.goal === 'base'
      ? null
      : (input.raceDistanceKm ?? distances[input.goal]);
  const races = plan.workouts.filter((w) => w.kind === 'race');
  if (
    input.goal === 'base'
      ? races.length !== 0
      : races.length !== 1 ||
        races[0].date !== input.raceDate ||
        !near(races[0].estimatedKm, expectedRaceKm, 0.00001)
  )
    issue('eventIdentity', {
      races: races.map((w) => ({ date: w.date, km: w.estimatedKm })),
    });
  const ids = new Set();
  for (const w of plan.workouts) {
    if (ids.has(w.id)) issue('duplicateWorkout', { id: w.id });
    ids.add(w.id);
    if (
      !near(
        w.minutes * 60,
        w.steps.reduce((n, s) => n + s.seconds, 0),
        1.001,
      )
    )
      issue('durationSum', { id: w.id });
    let low = 0,
      high = 0,
      allKnown = true,
      qualitySeconds = 0;
    for (const s of w.steps) {
      if (
        !(s.seconds > 0) ||
        !Number.isFinite(s.seconds) ||
        (s.metres !== undefined &&
          (!(s.metres > 0) || !Number.isFinite(s.metres)))
      )
        issue('invalidEndpoint', { id: w.id, step: s });
      if (s.metres !== undefined) {
        facts.distanceSteps++;
        low += s.metres / 1000;
        high += s.metres / 1000;
      } else if (s.target?.mode === 'pace') {
        low += s.seconds / s.target.high;
        high += s.seconds / s.target.low;
      } else allKnown = false;
      if (s.target) {
        if (
          !(s.target.low < s.target.high) ||
          !Number.isInteger(s.target.low) ||
          !Number.isInteger(s.target.high)
        )
          issue('invalidTarget', { id: w.id, target: s.target });
        if (input.workoutTargets?.mode === 'effort')
          issue('effortHasNumericTarget', { id: w.id });
        if (s.movement === 'walk' || s.kind === 'recovery')
          issue('recoveryHasTarget', { id: w.id });
        if (s.target.mode === 'pace') {
          facts.paceSteps++;
          if (
            s.metres !== undefined &&
            w.kind !== 'race' &&
            (s.metres * s.target.high) / 1000 > s.seconds + 1.001
          )
            issue('paceDurationConflict', {
              id: w.id,
              metres: s.metres,
              seconds: s.seconds,
              target: s.target,
            });
        }
        if (!['manual', 'benchmark'].includes(s.target.source))
          issue('missingTargetProvenance', { id: w.id });
      }
      if (s.kind === 'work' && s.intensity >= 4 && w.stimulus !== 'aerobic')
        qualitySeconds +=
          s.metres !== undefined && s.target?.mode === 'pace'
            ? (s.metres * s.target.high) / 1000
            : s.seconds;
    }
    if (w.kind === 'race') continue;
    if (allKnown && (w.estimatedKm < low - 0.02 || w.estimatedKm > high + 0.02))
      issue('allocationOutsideEndpoints', {
        id: w.id,
        km: w.estimatedKm,
        range: [low, high],
      });
    if (
      w.qualityMinutes !== undefined &&
      !near(w.qualityMinutes, qualitySeconds / 60, 0.02)
    )
      issue('qualityDoseMismatch', {
        id: w.id,
        saved: w.qualityMinutes,
        actual: qualitySeconds / 60,
      });
    const cap = w.kind === 'long' ? input.longMinutes : input.weekdayMinutes;
    if (w.minutes > cap + 1 / 60 + 1e-6)
      issue('sessionCap', { id: w.id, minutes: w.minutes, cap });
    if (
      input.raceDistanceKm > 80.4672 &&
      w.kind === 'long' &&
      w.minutes > 240 + 1 / 60
    )
      issue('longUltraCap', { id: w.id, minutes: w.minutes });
    // Independently reconstruct stored distance metadata from its saved pace basis.
    let estimateLow = 0,
      estimateHigh = 0,
      knownEstimate = true;
    for (const s of w.steps) {
      if (s.metres !== undefined) {
        estimateLow += s.metres / 1000;
        estimateHigh += s.metres / 1000;
      } else if (s.target?.mode === 'pace') {
        estimateLow += s.seconds / s.target.high;
        estimateHigh += s.seconds / s.target.low;
      } else if (w.prescriptionPaceBasis) {
        const minutes = s.seconds / 60,
          walking = s.movement === 'walk';
        estimateLow +=
          minutes /
          (walking
            ? 20
            : w.prescriptionPaceBasis * (s.kind === 'recovery' ? 1.5 : 1.15));
        estimateHigh +=
          minutes /
          (walking
            ? 10
            : w.prescriptionPaceBasis *
              (s.kind === 'work' && s.intensity >= 5 ? 0.8 : 0.95));
      } else knownEstimate = false;
    }
    if (knownEstimate && w.distanceEstimate) {
      if (!w.steps.every((s) => s.metres !== undefined)) {
        estimateLow = Math.floor(estimateLow * 10 + 1e-9) / 10;
        estimateHigh = Math.ceil(estimateHigh * 10 - 1e-9) / 10;
      }
      if (
        !near(w.distanceEstimate.lowerKm, estimateLow, 0.00001) ||
        !near(w.distanceEstimate.upperKm, estimateHigh, 0.00001)
      )
        issue('staleDistanceMetadata', {
          id: w.id,
          stored: w.distanceEstimate,
          expected: [estimateLow, estimateHigh],
        });
    }
  }
  let previous;
  for (const week of plan.weeks) {
    const runs = plan.workouts.filter(
      (w) =>
        w.week === week.index && w.kind !== 'race' && w.status !== 'skipped',
    );
    const km = runs.reduce((n, w) => n + w.estimatedKm, 0),
      minutes = runs.reduce((n, w) => n + w.minutes, 0);
    const longs = runs.filter((w) => w.kind === 'long');
    const quality = runs.filter(
      (w) =>
        w.kind !== 'long' &&
        w.stimulus !== 'economy' &&
        w.steps.some((s) => s.kind === 'work' && s.intensity >= 4),
    );
    facts.qualitySessions += quality.length;
    if (
      !near(week.targetKm, km, 0.050001) ||
      !near(week.trainingMinutes, minutes, 0.02)
    )
      issue('staleWeekTotals', {
        week: week.index,
        storedKm: week.targetKm,
        km,
        savedMinutes: week.trainingMinutes,
        minutes,
      });
    if (
      week.index === 0 &&
      week.start === start &&
      !['Recovery', 'Taper', 'Race week'].includes(week.phase)
    ) {
      if (!near(km, input.weeklyKm))
        issue('openingWeeklyChanged', { expected: input.weeklyKm, km });
      if (longs.length && !near(longs[0].estimatedKm, input.longestKm))
        issue('openingLongChanged', {
          expected: input.longestKm,
          km: longs[0].estimatedKm,
        });
    }
    const ordinary =
      !['Recovery', 'Taper', 'Race week'].includes(week.phase) &&
      finishGap(addDays(week.start, 6), input.raceDate) > 21;
    const cap = input.weeklyKm * (familyOf(input) === 'marathon' ? 1.4 : 1.45);
    if (km > cap + 0.002)
      issue('forecastCeiling', { week: week.index, km, cap });
    if (!ordinary) continue;
    if (runs.length !== input.runsPerWeek)
      issue('runFrequency', {
        week: week.index,
        expected: input.runsPerWeek,
        actual: runs.length,
      });
    const workMinutes = runs.reduce(
      (n, w) =>
        n +
        w.steps.reduce(
          (a, s) =>
            a +
            (s.kind === 'work' && s.intensity >= 4 && w.stimulus !== 'aerobic'
              ? (s.metres !== undefined && s.target?.mode === 'pace'
                  ? (s.metres * s.target.high) / 1000
                  : s.seconds) / 60
              : 0),
          0,
        ),
      0,
    );
    if (workMinutes > minutes * 0.22 + 0.02)
      issue('qualityFraction', {
        week: week.index,
        workMinutes,
        totalMinutes: minutes,
      });
    const expectedQ = input.goal === 'base' ? 0 : input.qualitySessions;
    if (quality.length !== expectedQ)
      issue('qualityFrequency', {
        week: week.index,
        expected: expectedQ,
        actual: quality.length,
      });
    if (previous) {
      if (km + 0.002 < previous.km)
        issue('unmarkedWeeklyDecline', {
          week: week.index,
          previous: previous.km,
          km,
        });
      if (
        longs.length &&
        previous.long !== null &&
        longs[0].estimatedKm + 0.002 < previous.long
      )
        issue('unmarkedLongDecline', {
          week: week.index,
          previous: previous.long,
          km: longs[0].estimatedKm,
        });
      if (
        longs.length &&
        previous.long !== null &&
        longs[0].estimatedKm > previous.long + 2.002
      )
        issue('largeLongIncrement', {
          week: week.index,
          previous: previous.long,
          km: longs[0].estimatedKm,
        });
    }
    previous = { km, long: longs[0]?.estimatedKm ?? null };
  }
  return { errors, facts };
}
const selected = only ? cases.filter((c) => c.id === only) : cases;
if (!selected.length) throw new Error('Unknown case id.');
const hashSources = async () =>
  createHash('sha256')
    .update(JSON.stringify(await sourceHash(resolve(root, 'lib'))))
    .digest('hex');
const libSourceSha256Before = await hashSources();
const results = [];
for (const c of selected) {
  const before = JSON.stringify(c.profile);
  try {
    const plan = makePlan(c.profile, start, false);
    const { errors, facts } = independentChecks(plan, c.profile);
    const validation = validatePlan(plan),
      persisted = validatePlan(JSON.parse(JSON.stringify(plan)));
    if (validation.length || persisted.length)
      errors.push({ code: 'engineValidation', validation, persisted });
    if (before !== JSON.stringify(c.profile))
      errors.push({ code: 'inputMutated' });
    if (c.expectation === 'reject')
      errors.push({ code: 'unexpectedAcceptance', proof: c.proof });
    results.push({
      ...c,
      status: errors.length ? 'failed' : 'passed',
      errors,
      facts,
    });
  } catch (error) {
    const expected =
      c.expectation === 'reject' &&
      error.name === 'PlanError' &&
      new RegExp(c.errorPattern, 'i').test(error.message);
    results.push({
      ...c,
      status: expected ? 'expected-rejection' : 'unexpected-rejection',
      error: { name: error.name, message: error.message },
    });
  }
  if (results.length % 250 === 0)
    console.log(`Checked ${results.length}/${selected.length}`);
}
async function sourceHash(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await sourceHash(path)));
    else if (/\.[cm]?tsx?$/.test(entry.name))
      files.push([relative(root, path), await readFile(path, 'utf8')]);
  }
  return files;
}
const libSourceSha256 = await hashSources();
const summary = {
  generatedAt: new Date().toISOString(),
  libSourceSha256,
  libSourceSha256Before,
  sourceStable: libSourceSha256 === libSourceSha256Before,
  cases: results.length,
  passed: results.filter((r) => r.status === 'passed').length,
  expectedRejections: results.filter((r) => r.status === 'expected-rejection')
    .length,
  failedAccepted: results.filter((r) => r.status === 'failed').length,
  unexpectedRejections: results.filter(
    (r) => r.status === 'unexpected-rejection',
  ).length,
  normalizationProbes: results.filter(
    (r) =>
      r.expectation === 'accept' &&
      r.profile.goal === 'base' &&
      r.profile.qualitySessions > 0,
  ).length,
  generatedWeeks: results.reduce((n, r) => n + (r.facts?.weeks ?? 0), 0),
  byGoal: Object.fromEntries(
    ['marathon', 'base', 'custom', 'ultra'].map((g) => [
      g,
      Object.fromEntries(
        ['passed', 'failed', 'expected-rejection', 'unexpected-rejection'].map(
          (s) => [
            s,
            results.filter((r) => r.profile.goal === g && r.status === s)
              .length,
          ],
        ),
      ),
    ]),
  ),
};
const findings = {};
for (const r of results)
  for (const error of r.errors ?? []) {
    const f = (findings[error.code] ??= { count: 0, samples: [] });
    f.count++;
    if (f.samples.length < 6) f.samples.push({ caseId: r.id, ...error });
  }
const rejectedGroups = {};
for (const r of results.filter((r) => r.status === 'unexpected-rejection')) {
  const key = r.error.message;
  const g = (rejectedGroups[key] ??= { count: 0, samples: [] });
  g.count++;
  if (g.samples.length < 4) g.samples.push(r.id);
}
await mkdir(destination, { recursive: true });
const output = resolve(destination, `endurance-${tag}.json`);
await writeFile(
  output,
  JSON.stringify(
    {
      summary,
      methodology:
        'Expected acceptance is declared before generation. Deliberate rejects have independent constraint proofs and matched error categories. Accepted plans are checked independently, then with validatePlan and JSON round-trip. Historical evidence remains in its original folders.',
      findings,
      unexpectedRejections: rejectedGroups,
      results,
    },
    null,
    2,
  ) + '\n',
  { flag: 'wx' },
);
console.log(
  JSON.stringify(
    { output, summary, findings, unexpectedRejections: rejectedGroups },
    null,
    2,
  ),
);
if (
  !summary.sourceStable ||
  summary.failedAccepted ||
  summary.unexpectedRejections
)
  process.exitCode = 1;

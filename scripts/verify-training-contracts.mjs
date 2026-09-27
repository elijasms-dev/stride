import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  ENGINE_VERSION,
  TRAINING_POLICY,
  addDays,
  demoProfile,
  makePlan,
  refreshFeasibility,
  refreshWeekTotals,
  refreshWorkoutVariety,
  revisePreferences,
  taperFactor,
  validatePlan,
} from '../lib/engine.ts';
import { distanceEstimate, qualityWorkMinutes } from '../lib/prescription.ts';
import { updateRunMeasure } from '../lib/run-distance.ts';
import { roadOpeningFailures } from '../tests/road-overhaul-helpers.mjs';

export const DEFAULT_SEED = 20260919;
const start = '2026-09-14';
const repository = fileURLToPath(new URL('../', import.meta.url));
const json = (value) => JSON.stringify(value);
const check = (condition, message) => {
  if (!condition) throw new Error(message);
};
const close = (actual, expected, message, tolerance = 0.00101) =>
  check(
    Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );

function randomSequence(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
function caseSeed(seed, id) {
  let value = seed >>> 0;
  for (const c of id)
    value = Math.imul(value ^ c.charCodeAt(0), 16777619) >>> 0;
  return value;
}
function shuffle(items, random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const other = Math.floor(random() * (i + 1));
    [result[i], result[other]] = [result[other], result[i]];
  }
  return result;
}

/** Deliberately comfortable inputs: unexpected rejection is a release failure,
 * not an excluded case. Separate invalid cases verify the rejection boundary. */
export function trainingContractCases() {
  const events = [
    { id: '5k', goal: '5k', weeklyKm: 50, longestKm: 12, weeks: 12 },
    { id: '10k', goal: '10k', weeklyKm: 50, longestKm: 14, weeks: 12 },
    { id: 'half', goal: 'half', weeklyKm: 60, longestKm: 18, weeks: 16 },
    {
      id: 'marathon',
      goal: 'marathon',
      weeklyKm: 70,
      longestKm: 23,
      weeks: 16,
    },
    {
      id: 'custom-7.5k',
      goal: 'custom',
      raceDistanceKm: 7.5,
      weeklyKm: 50,
      longestKm: 12,
      weeks: 12,
    },
    {
      id: 'custom-15k',
      goal: 'custom',
      raceDistanceKm: 15,
      weeklyKm: 55,
      longestKm: 16,
      weeks: 16,
    },
    {
      id: 'custom-30k',
      goal: 'custom',
      raceDistanceKm: 30,
      weeklyKm: 65,
      longestKm: 22,
      weeks: 16,
    },
    {
      id: 'ultra-50k',
      goal: 'ultra',
      raceDistanceKm: 50,
      weeklyKm: 75,
      longestKm: 28,
      weeks: 20,
    },
  ];
  return events.flatMap(({ id, weeks, ...event }) =>
    [0, 1, 2].flatMap((qualitySessions) =>
      ['distance', 'time'].map((runMeasure) => ({
        id: `${id}-q${qualitySessions}-${runMeasure}`,
        profile: {
          ...demoProfile(start),
          ...event,
          raceName: `Synthetic ${id} contract`,
          startDate: start,
          raceDate: addDays(start, weeks * 7 - 1),
          currentRuns: 5,
          runsPerWeek: 5,
          availableDays: [0, 1, 2, 3, 4, 5, 6],
          days: [0, 1, 2, 4, 6],
          longDay: 6,
          weekdayMinutes: 120,
          longMinutes: 300,
          easyPace: 6,
          qualityMode: 'custom',
          qualitySessions,
          recentQualitySessions: 2,
          recentQualityMinutes: 40,
          workoutVariety: 'varied',
          runMeasure,
          units: runMeasure === 'time' ? 'mi' : 'km',
          recentRace: {
            distanceKm: 10,
            timeMinutes: 50,
            date: '2026-09-01',
            source: 'race',
            course: 'road',
          },
        },
      })),
    ),
  );
}

function prescriptions(plan) {
  return plan.workouts.map(
    ({
      id,
      date,
      originalDate,
      week,
      title,
      kind,
      minutes,
      estimatedKm,
      hard,
      steps,
      status,
      feedback,
      changed,
      changeSource,
    }) => ({
      id,
      date,
      originalDate,
      week,
      title,
      kind,
      minutes,
      estimatedKm,
      hard,
      steps,
      status,
      feedback,
      changed,
      changeSource,
    }),
  );
}
function protectedPrescriptions(plan, asOf) {
  return prescriptions(plan).filter(
    (w) =>
      w.date < asOf ||
      w.status === 'completed' ||
      (w.changed && w.changeSource === 'manual'),
  );
}
function assertProtected(before, after, asOf) {
  const next = new Map(prescriptions(after).map((w) => [w.id, w]));
  for (const old of protectedPrescriptions(before, asOf))
    check(
      json(next.get(old.id)) === json(old),
      `Protected prescription or recorded fact changed: ${old.id}`,
    );
}
function finiteTree(value, path = 'plan') {
  if (typeof value === 'number')
    check(Number.isFinite(value), `Non-finite number at ${path}`);
  else if (value && typeof value === 'object')
    for (const [key, entry] of Object.entries(value))
      finiteTree(entry, `${path}.${key}`);
}
function assertContract(plan, input, asOf) {
  const errors = validatePlan(plan);
  check(errors.length === 0, `validatePlan: ${errors.join('; ')}`);
  finiteTree(plan);
  check(
    plan.profile.qualityMode === 'custom',
    'Explicit workout mode was lost',
  );
  check(
    plan.profile.qualitySessions === input.qualitySessions,
    `Explicit workout count changed from ${input.qualitySessions} to ${plan.profile.qualitySessions}`,
  );
  close(
    plan.profile.weeklyKm,
    input.weeklyKm,
    'Declared weekly baseline changed',
  );
  close(
    plan.profile.longestKm,
    input.longestKm,
    'Declared long-run baseline changed',
  );
  const first = plan.workouts.filter((w) => w.week === 0 && w.kind !== 'race');
  if (['5k', '10k', 'half', 'marathon'].includes(input.goal)) {
    const openingErrors = roadOpeningFailures(plan, input);
    check(openingErrors.length === 0, openingErrors.join('; '));
  } else
    close(
      first.reduce((n, w) => n + w.estimatedKm, 0),
      input.weeklyKm,
      'Opening week must match declared distance',
    );
  const firstLong = first.find((w) => w.kind === 'long');
  check(!!firstLong, 'Opening long run is missing');
  close(
    firstLong.estimatedKm,
    input.longestKm,
    'Opening long run must match declared distance',
  );
  let priorLong = 0;
  let priorWeekly = 0;
  for (const week of plan.weeks) {
    const runs = plan.workouts.filter(
      (w) =>
        w.week === week.index && w.kind !== 'race' && w.status !== 'skipped',
    );
    for (const run of runs) {
      close(
        run.steps.reduce((n, s) => n + s.seconds, 0),
        run.minutes * 60,
        `Step duration in ${run.id}`,
        1.01,
      );
      check(
        run.steps.every((s) => s.seconds > 0),
        `Nonpositive step in ${run.id}`,
      );
    }
    const standard =
      !['Recovery', 'Taper', 'Race week'].includes(week.phase) &&
      addDays(week.start, 6) < plan.profile.raceDate &&
      taperFactor(plan.profile, addDays(week.start, 6)) === 1;
    if (!standard) continue;
    const long = runs.find((w) => w.kind === 'long');
    check(!!long, `Week ${week.index + 1} has no long run`);
    check(
      Number.isInteger(long.estimatedKm),
      `Fractional long run in week ${week.index + 1}: ${long.estimatedKm}`,
    );
    check(
      long.estimatedKm + 0.001 >= priorLong,
      `Ordinary long run regressed in week ${week.index + 1}: ${priorLong} -> ${long.estimatedKm}`,
    );
    const weeklyKm = runs.reduce((n, w) => n + w.estimatedKm, 0);
    check(
      weeklyKm + 0.00101 >= priorWeekly,
      `Ordinary weekly distance regressed in week ${week.index + 1}: ${priorWeekly} -> ${weeklyKm}`,
    );
    priorLong = long.estimatedKm;
    priorWeekly = weeklyKm;
    // Only complete future build weeks are frequency promises. Recovery/taper
    // and already-recorded partial weeks are intentionally distinct.
    if (week.start >= asOf) {
      const hard = runs.filter(
        (w) => w.kind !== 'long' && w.hard && qualityWorkMinutes(w) > 0,
      );
      check(
        hard.length === input.qualitySessions,
        `Week ${week.index + 1} lost the requested frequency: expected ${input.qualitySessions} weekday workouts, received ${hard.length}`,
      );
      check(
        new Set(runs.map((w) => w.date)).size === 5,
        `Week ${week.index + 1} lost a running day`,
      );
    }
  }
  check(
    validatePlan(JSON.parse(json(plan))).length === 0,
    'JSON persistence introduced a validation failure',
  );
}

/** Synthetic observations are fixture data. The transformations exercised below
 * are the same production modules used by the app, not the experimental engine. */
function recordPastFixtures(plan, asOf) {
  const next = structuredClone(plan);
  for (const w of next.workouts.filter(
    (w) => w.date < asOf && w.status === 'planned' && w.kind !== 'race',
  )) {
    w.status = 'completed';
    w.feedback = {
      actualDate: w.date,
      actualMinutes: w.minutes,
      actualKm: w.estimatedKm,
      effort: w.hard ? 6 : 3,
      feeling: 'good',
      note: 'Synthetic release contract recording.',
      recordedAt: `${w.date}T18:00:00.000Z`,
      execution: 'as-planned',
      executionSource: 'self-report',
      completedQualityMinutes: qualityWorkMinutes(w),
    };
  }
  refreshWeekTotals(next);
  refreshFeasibility(next, asOf);
  return next;
}

const operations = [
  'fuel-preference',
  'variety-preference',
  'terrain-preference',
  'refresh-variety',
  'unit-roundtrip',
  'json-roundtrip',
  'advance-recorded-days',
  'measure-roundtrip',
  'benchmark-context',
  'advance-recorded-days',
  'refresh-variety',
  'json-roundtrip',
];

function runCase(item, seed) {
  const trace = [];
  let asOf = start;
  let plan;
  const derivedSeed = caseSeed(seed, item.id);
  const random = randomSequence(derivedSeed);
  try {
    const snapshot = json(item.profile);
    plan = makePlan(item.profile, start, false);
    check(snapshot === json(item.profile), 'Generation mutated input');
    assertContract(plan, item.profile, asOf);
    // A saved manual choice protects its full prescription across all operations.
    const manual = plan.workouts.find(
      (w) => w.kind === 'easy' && w.date >= addDays(start, 21),
    );
    check(!!manual, 'Fixture has no future easy run for a protected edit');
    manual.changed = true;
    manual.changeSource = 'manual';
    for (const operation of shuffle(operations, random)) {
      trace.push({ operation, asOf });
      const before = plan;
      const unchanged = json(before);
      if (operation === 'advance-recorded-days') {
        asOf = addDays(asOf, 4 + Math.floor(random() * 5));
        plan = recordPastFixtures(before, asOf);
        // Recorded feedback is the deliberate mutation. Previous records stay fixed.
        for (const w of before.workouts.filter((w) => w.status === 'completed'))
          check(
            json(plan.workouts.find((x) => x.id === w.id)) === json(w),
            `Day advance changed an earlier recording: ${w.id}`,
          );
      } else {
        if (operation === 'fuel-preference')
          plan = revisePreferences(
            before,
            { carbsPerHour: 45 + Math.floor(random() * 4) * 5 },
            asOf,
          );
        if (operation === 'variety-preference')
          plan = revisePreferences(
            before,
            {
              workoutVariety:
                before.profile.workoutVariety === 'varied'
                  ? 'familiar'
                  : 'varied',
            },
            asOf,
          );
        if (operation === 'terrain-preference')
          plan = revisePreferences(
            before,
            { terrain: before.profile.terrain === 'hills' ? 'flat' : 'hills' },
            asOf,
          );
        if (operation === 'refresh-variety') {
          plan = refreshWorkoutVariety(before, asOf);
          check(
            json(refreshWorkoutVariety(plan, asOf)) === json(plan),
            'Variety refresh is not idempotent',
          );
        }
        if (operation === 'json-roundtrip') plan = JSON.parse(json(before));
        if (operation === 'unit-roundtrip') {
          // The profile API changes display units only; canonical kilometres and
          // stored prescriptions must survive both persistence boundaries.
          plan = JSON.parse(json(before));
          plan.profile.units = before.profile.units === 'mi' ? 'km' : 'mi';
          plan = JSON.parse(json(plan));
          plan.profile.units = before.profile.units;
          check(
            json(plan) === json(before),
            'Display unit roundtrip changed canonical data',
          );
        }
        if (operation === 'measure-roundtrip') {
          plan = updateRunMeasure(
            before,
            before.profile.runMeasure === 'distance' ? 'time' : 'distance',
            asOf,
          );
          plan = updateRunMeasure(plan, before.profile.runMeasure, asOf);
          for (const old of before.workouts) {
            const next = plan.workouts.find((w) => w.id === old.id);
            check(!!next, `Measurement conversion dropped ${old.id}`);
            close(
              next.estimatedKm,
              old.estimatedKm,
              `Measurement conversion changed allocated distance in ${old.id}`,
            );
          }
        }
        if (operation === 'benchmark-context') {
          plan = revisePreferences(
            before,
            {
              recentRace: {
                ...before.profile.recentRace,
                date: addDays(asOf, -1),
                source: 'time-trial',
                course: 'track',
              },
            },
            asOf,
          );
          check(
            json(prescriptions(plan)) === json(prescriptions(before)),
            'Benchmark provenance changed prescriptions',
          );
        }
        assertProtected(before, plan, asOf);
        if (operation === 'variety-preference')
          for (const w of plan.workouts) {
            const old = before.workouts.find((item) => item.id === w.id);
            if (old && json(w.steps) !== json(old.steps))
              check(
                json(w.distanceEstimate) ===
                  json(distanceEstimate(w.steps, plan.profile)),
                `Changed recipe has a stale distance estimate: ${w.id}`,
              );
          }
      }
      check(json(before) === unchanged, `${operation} mutated its input`);
      assertContract(plan, item.profile, asOf);
    }
    return {
      id: item.id,
      status: 'passed',
      caseSeed: derivedSeed,
      operations: trace,
      workouts: plan.workouts.length,
    };
  } catch (error) {
    return {
      id: item.id,
      status: 'failed',
      caseSeed: derivedSeed,
      operations: trace,
      error: error instanceof Error ? error.message : String(error),
      reproduce: `node --experimental-strip-types scripts/verify-training-contracts.mjs --seed ${seed} --case ${item.id}`,
    };
  }
}

function rejectionCases() {
  const base = trainingContractCases().find(
    (c) => c.id === 'marathon-q2-distance',
  ).profile;
  return [
    {
      id: 'reject-two-workouts-without-background',
      profile: { ...base, recentQualitySessions: 0 },
      expected: /Two quality sessions/,
    },
    {
      id: 'reject-nonfinite-baseline',
      profile: { ...base, weeklyKm: NaN },
      expected: /weekly|distance|volume|number/i,
    },
    {
      id: 'reject-invalid-benchmark-date',
      profile: {
        ...base,
        recentRace: { ...base.recentRace, date: '2026-02-30' },
      },
      expected: /calendar date/,
    },
    {
      id: 'reject-future-benchmark',
      profile: {
        ...base,
        recentRace: { ...base.recentRace, date: addDays(start, 1) },
      },
      expected: /future/,
    },
  ];
}

export function runTrainingContracts({ seed = DEFAULT_SEED, caseId } = {}) {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff)
    throw new Error('Seed must be an unsigned 32-bit integer.');
  const cases = trainingContractCases();
  if (caseId && !cases.some((c) => c.id === caseId))
    throw new Error(`Unknown case: ${caseId}`);
  const selected = caseId ? cases.filter((c) => c.id === caseId) : cases;
  const results = selected.map((item) => runCase(item, seed));
  const rejected = rejectionCases().map((item) => {
    try {
      makePlan(item.profile, start, false);
      return {
        id: item.id,
        status: 'failed',
        error: 'Invalid profile was accepted',
      };
    } catch (error) {
      const passed =
        error?.name === 'PlanError' && item.expected.test(error.message);
      return {
        id: item.id,
        status: passed ? 'rejected-as-expected' : 'failed',
        error: String(error?.message ?? error),
      };
    }
  });
  return {
    format: 'stride-training-contracts-1',
    seed,
    engineVersion: ENGINE_VERSION,
    policyVersion: TRAINING_POLICY.version,
    scope:
      'Synthetic production-engine invariants and mutation sequences; not coaching validation or hosted API/browser verification.',
    summary: {
      acceptedCases: results.length,
      passedCases: results.filter((r) => r.status === 'passed').length,
      rejectedCases: rejected.filter((r) => r.status === 'rejected-as-expected')
        .length,
      failures: [...results, ...rejected].filter((r) => r.status === 'failed')
        .length,
      operations: results.reduce((n, r) => n + r.operations.length, 0),
    },
    results,
    rejected,
  };
}

async function main() {
  const args = process.argv.slice(2);
  let seed = DEFAULT_SEED;
  let caseId;
  let reportPath;
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    const value = args[++index];
    if (!value || !['--seed', '--case', '--report'].includes(flag))
      throw new Error(
        'Usage: node --experimental-strip-types scripts/verify-training-contracts.mjs [--seed NUMBER] [--case ID] [--report PATH]',
      );
    if (flag === '--seed') seed = Number(value);
    if (flag === '--case') caseId = value;
    if (flag === '--report') reportPath = resolve(value);
  }
  const report = runTrainingContracts({ seed, caseId });
  try {
    report.git = {
      sha: execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: repository,
        encoding: 'utf8',
      }).trim(),
      dirty: !!execFileSync('git', ['status', '--porcelain'], {
        cwd: repository,
        encoding: 'utf8',
      }).trim(),
    };
  } catch {
    report.git = { sha: null, dirty: null };
  }
  report.generatedAt = new Date().toISOString();
  if (reportPath) {
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  }
  const failures = [...report.results, ...report.rejected].filter(
    (r) => r.status === 'failed',
  );
  process.stdout.write(
    `${JSON.stringify({ seed, git: report.git, engineVersion: report.engineVersion, policyVersion: report.policyVersion, ...report.summary, failureDetails: failures, ...(reportPath ? { report: reportPath } : {}) }, null, 2)}\n`,
  );
  if (report.summary.failures) process.exitCode = 1;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });

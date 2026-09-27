/** Read-only engine audit. Writes synthetic evidence, not application state.
 * Red contract checks remain red findings; this is not part of npm test. */
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Decoder, Stream } from '@garmin/fitsdk';
import { demoProfile, makePlan, validatePlan, addDays } from '../lib/engine.ts';
import {
  predictRaceTime,
  calculateTrainingPaces,
  fitnessPaceRange,
  schedulingEasyPace,
} from '../lib/fitness-pacing.ts';
import {
  benchmarkWorkoutTargets,
  withWorkoutTargets,
  paceText,
  validStepTarget,
} from '../lib/workout-targets.ts';
import { distanceEstimate } from '../lib/prescription.ts';
import { encodeWorkout } from '../lib/fit.ts';
import { intervalsWorkoutText } from '../lib/intervals-workout.ts';
import {
  FIRST_RACE_CASES,
  firstRaceProfile,
} from '../tests/first-race-cases.mjs';
const outputArgument = process.argv.indexOf('--out');
const out =
  outputArgument >= 0
    ? pathToFileURL(resolve(process.argv[outputArgument + 1]) + '/')
    : new URL(
        '../docs/verification/2026-09-25/pacing-implementation/',
        import.meta.url,
      );
await mkdir(out, { recursive: true });
const start = '2026-09-28';
const goals = { '5k': 5, '10k': 10, half: 21.0975, marathon: 42.195 };
const benchmarks = [
  [5, 15],
  [5, 20],
  [5, 25],
  [5, 30],
  [5, 40],
  [10, 45],
  [10, 60],
  [10, 80],
  [21.0975, 105],
  [21.0975, 150],
  [42.195, 240],
  [42.195, 330],
].map(([distanceKm, timeMinutes]) => ({ distanceKm, timeMinutes }));
const math = [],
  cases = [],
  findings = {},
  contracts = [];
const record = (kind, detail) => {
  findings[kind] ??= { count: 0, samples: [] };
  findings[kind].count++;
  if (findings[kind].samples.length < 5) findings[kind].samples.push(detail);
};
for (const benchmark of benchmarks) {
  const zones = calculateTrainingPaces(benchmark);
  assert.ok(
    zones.easy > zones.tempo &&
      zones.tempo > zones.threshold &&
      zones.threshold > zones.interval,
  );
  assert.equal(
    predictRaceTime(benchmark, benchmark.distanceKm),
    benchmark.timeMinutes,
  );
  for (const [goal, km] of Object.entries(goals)) {
    const expected =
      benchmark.timeMinutes *
      Math.exp(1.06 * Math.log(km / benchmark.distanceKm));
    assert.ok(Math.abs(predictRaceTime(benchmark, km) - expected) < 1e-8);
    const bands = benchmarkWorkoutTargets({ goal, recentRace: benchmark });
    assert.deepEqual(bands.pace.race, fitnessPaceRange((expected * 60) / km));
    math.push({
      benchmark,
      goal,
      predictionMinutes: expected,
      raceRange: bands.pace.race,
      zones,
    });
  }
  const faster = calculateTrainingPaces({
    ...benchmark,
    timeMinutes: benchmark.timeMinutes * 0.98,
  });
  assert.ok(Object.keys(zones).every((key) => faster[key] < zones[key]));
}
const modes = {
  automatic: undefined,
  effort: { mode: 'effort' },
  manual: {
    mode: 'pace',
    pace: {
      easy: { low: 390, high: 450 },
      steady: { low: 360, high: 390 },
      tempo: { low: 330, high: 360 },
      interval: { low: 290, high: 330 },
    },
  },
  heartRate: {
    mode: 'heart-rate',
    heartRate: {
      easy: { low: 125, high: 145 },
      tempo: { low: 150, high: 165 },
      interval: { low: 165, high: 175 },
    },
  },
};
for (const benchmark of benchmarks)
  for (const [goal] of Object.entries(goals))
    for (const runMeasure of ['distance', 'time'])
      for (const [mode, workoutTargets] of Object.entries(modes)) {
        const [weeklyKm, longestKm] = {
          '5k': [24, 8],
          '10k': [30, 10],
          half: [40, 12],
          marathon: [48, 16],
        }[goal];
        const profile = {
          ...demoProfile(start),
          goal,
          weeklyKm,
          longestKm,
          currentRuns: 4,
          days: [0, 2, 4, 6],
          longDay: 6,
          experience: 'established',
          intent: 'improve',
          qualityMode: 'custom',
          qualitySessions: 1,
          recentQualitySessions: 1,
          weekdayMinutes: 120,
          longMinutes: 300,
          raceDate: addDays(start, 139),
          easyPace: null,
          recentRace: benchmark,
          workoutTargets,
          runMeasure,
        };
        const id = `${goal}-${benchmark.distanceKm}km-${benchmark.timeMinutes}min-${runMeasure}-${mode}`;
        try {
          const plan = makePlan(profile, start),
            errors = validatePlan(plan);
          assert.deepEqual(errors, []);
          assert.deepEqual(validatePlan(JSON.parse(JSON.stringify(plan))), []);
          const counts = {
            workouts: plan.workouts.length,
            paceSteps: 0,
            staleEstimates: 0,
            allocationOutsidePaceRange: 0,
          };
          for (const w of plan.workouts) {
            for (const s of w.steps)
              if (s.target) {
                assert.ok(validStepTarget(s.target));
                if (s.target.mode === 'pace') counts.paceSteps++;
              }
            if (mode === 'effort') assert.ok(w.steps.every((s) => !s.target));
            if (w.kind === 'race') continue;
            const fresh = distanceEstimate(w.steps, plan.profile);
            if (JSON.stringify(fresh) !== JSON.stringify(w.distanceEstimate)) {
              counts.staleEstimates++;
              record('staleStoredDistanceEstimate', {
                id,
                date: w.date,
                kind: w.kind,
                stored: w.distanceEstimate,
                fresh,
              });
            }
            if (
              w.steps.every(
                (s) => s.metres !== undefined || s.target?.mode === 'pace',
              )
            ) {
              const low = w.steps.reduce(
                (n, s) =>
                  n +
                  (s.metres !== undefined
                    ? s.metres / 1000
                    : s.seconds / s.target.high),
                0,
              );
              const high = w.steps.reduce(
                (n, s) =>
                  n +
                  (s.metres !== undefined
                    ? s.metres / 1000
                    : s.seconds / s.target.low),
                0,
              );
              if (w.estimatedKm < low - 0.02 || w.estimatedKm > high + 0.02) {
                counts.allocationOutsidePaceRange++;
                record('allocatedKmOutsideExecutablePaceRange', {
                  id,
                  date: w.date,
                  kind: w.kind,
                  allocatedKm: w.estimatedKm,
                  impliedRangeKm: [low, high],
                });
              }
            }
          }
          const sample = plan.workouts.find(
            (w) =>
              w.kind !== 'race' &&
              w.steps.some((s) => s.target?.mode === 'pace'),
          );
          if (sample) {
            const decoder = new Decoder(
              Stream.fromByteArray(encodeWorkout(sample)),
            );
            assert.equal(decoder.checkIntegrity(), true);
            const decoded = decoder.read();
            assert.deepEqual(decoded.errors, []);
            for (const [i, s] of sample.steps.entries())
              if (s.target?.mode === 'pace') {
                const encoded = decoded.messages.workoutStepMesgs[i];
                assert.equal(encoded.targetType, 'speed');
                assert.ok(
                  Math.abs(
                    encoded.customTargetSpeedLow - 1000 / s.target.high,
                  ) < 0.0011,
                );
                assert.ok(
                  Math.abs(
                    encoded.customTargetSpeedHigh - 1000 / s.target.low,
                  ) < 0.0011,
                );
              }
            const text = intervalsWorkoutText(sample);
            for (const s of sample.steps.filter(
              (s) => s.target?.mode === 'pace',
            ))
              assert.ok(
                text.includes(
                  `${paceText(s.target.low)}-${paceText(s.target.high)}/km Pace`,
                ),
              );
          }
          cases.push({
            id,
            goal,
            benchmark,
            runMeasure,
            mode,
            generated: true,
            structural: 'pass',
            ...counts,
          });
        } catch (e) {
          cases.push({
            id,
            goal,
            benchmark,
            runMeasure,
            mode,
            generated: false,
            errorType: e.name,
            error: e.message,
          });
        }
      }
for (const c of FIRST_RACE_CASES)
  for (const benchmark of benchmarks)
    for (const runMeasure of ['distance', 'time']) {
      const p = firstRaceProfile(c, { recentRace: benchmark, runMeasure });
      const plan = makePlan(p, start);
      assert.deepEqual(validatePlan(plan), []);
      assert.ok(plan.workouts.every((w) => w.steps.every((s) => !s.target)));
      cases.push({
        id: `beginner-${c.goal}-${benchmark.distanceKm}-${benchmark.timeMinutes}-${runMeasure}`,
        goal: c.goal,
        beginner: true,
        generated: true,
        structural: 'pass',
        benchmark,
        runMeasure,
        workouts: plan.workouts.length,
        paceSteps: 0,
        staleEstimates: 0,
        allocationOutsidePaceRange: 0,
      });
    }
function contract(name, run) {
  try {
    run();
    contracts.push({ name, status: 'pass' });
  } catch (e) {
    contracts.push({ name, status: 'fail', reason: e.message });
  }
}
const easyStep = {
  label: 'Easy',
  kind: 'work',
  intensity: 3,
  movement: 'run',
  effort: 'Conversational',
  seconds: 2400,
};
const simple = (profile) => ({
  id: 'audit',
  date: start,
  originalDate: start,
  week: 0,
  title: 'Easy run',
  kind: 'easy',
  minutes: 40,
  estimatedKm: 5,
  hard: false,
  purpose: 'Audit',
  reason: 'Synthetic',
  status: 'planned',
  steps: [easyStep],
  distanceEstimate: distanceEstimate([easyStep], profile),
});
const base = {
  ...demoProfile(start),
  goal: '10k',
  runMeasure: 'time',
  easyPace: 8,
  recentRace: { distanceKm: 5, timeMinutes: 20 },
};
contract(
  'Changing a timed pace target refreshes its stored distance estimate',
  () => {
    const w = withWorkoutTargets(simple(base), base);
    assert.deepEqual(w.distanceEstimate, distanceEstimate(w.steps, base));
  },
);
contract(
  'A complete manual timed pace range works without an extra easy-pace or benchmark field',
  () => {
    const estimate = distanceEstimate(
      [
        {
          ...easyStep,
          seconds: 1800,
          target: { mode: 'pace', low: 330, high: 360 },
        },
      ],
      { easyPace: null },
    );
    assert.equal(estimate.lowerKm, 5);
    assert.equal(estimate.upperKm, 5.5);
  },
);
contract(
  'Manual easy targets have documented priority over an absent declared pace and conflicting benchmark',
  () => {
    const p = {
      easyPace: null,
      recentRace: { distanceKm: 5, timeMinutes: 35 },
      workoutTargets: { mode: 'pace', pace: { easy: { low: 330, high: 360 } } },
    };
    assert.equal(schedulingEasyPace(p), 6);
  },
);
contract(
  'Timed run allocation lies inside the distance implied by every explicit step target',
  () => {
    const w = withWorkoutTargets(simple(base), base),
      s = w.steps[0];
    assert.ok(
      w.estimatedKm >= s.seconds / s.target.high &&
        w.estimatedKm <= s.seconds / s.target.low,
      `Allocated ${w.estimatedKm} km; target implies ${(s.seconds / s.target.high).toFixed(2)}–${(s.seconds / s.target.low).toFixed(2)} km`,
    );
  },
);
contract(
  'Benchmark training zones do not change merely because a different goal was selected',
  () => {
    const plans = Object.keys(goals).map((goal) =>
      benchmarkWorkoutTargets(
        { goal, recentRace: { distanceKm: 5, timeMinutes: 25 } },
        'threshold',
      ),
    );
    for (const bands of plans.slice(1))
      for (const key of ['easy', 'tempo', 'interval'])
        assert.deepEqual(bands.pace[key], plans[0].pace[key]);
  },
);
contract(
  'No benchmark means no invented automatic threshold or interval pace',
  () => {
    assert.equal(
      benchmarkWorkoutTargets({ goal: 'marathon', easyPace: 7 }),
      undefined,
    );
  },
);
const exampleRace = { distanceKm: 5, timeMinutes: 25 };
const example = {
  benchmark: exampleRace,
  training: calculateTrainingPaces(exampleRace),
  races: Object.fromEntries(
    Object.entries(goals).map(([goal, km]) => [
      goal,
      {
        minutes: predictRaceTime(exampleRace, km),
        paceSecondsPerKm: (predictRaceTime(exampleRace, km) * 60) / km,
      },
    ]),
  ),
};
const hash = createHash('sha256');
async function scan(dir) {
  for (const e of (await readdir(dir, { withFileTypes: true })).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const u = new URL(e.name + (e.isDirectory() ? '/' : ''), dir);
    if (e.isDirectory()) await scan(u);
    else if (e.name.endsWith('.ts')) {
      hash.update(u.pathname.split('/lib/')[1]);
      hash.update(await readFile(u));
    }
  }
}
await scan(new URL('../lib/', import.meta.url));
// These are explicit constraint outcomes, not passing generated plans. All other
// errors (including validation failures wrapped in PlanError) fail the audit.
const capacityRejection = (c) =>
  !c.generated &&
  c.errorType === 'PlanError' &&
  (c.error.startsWith(
    'Your starting weekly distance and long-run baseline cannot fit',
  ) ||
    /^Week \d+ cannot maintain .* within the selected running days/.test(
      c.error,
    ) ||
    /^These limits leave a longest training exposure of .* this policy requires room/.test(
      c.error,
    ));
const summary = {
  createdAt: new Date().toISOString(),
  sourceSha256: hash.digest('hex'),
  benchmarkCases: benchmarks.length,
  raceFormulaMappings: math.length,
  planCases: cases.length,
  generatedPlans: cases.filter((c) => c.generated).length,
  generationRejections: cases.filter((c) => !c.generated).length,
  capacityRejections: cases.filter(capacityRejection).length,
  unexpectedRejections: cases.filter(
    (c) => !c.generated && !capacityRejection(c),
  ).length,
  generatedWorkouts: cases.reduce((n, c) => n + (c.workouts ?? 0), 0),
  paceSteps: cases.reduce((n, c) => n + (c.paceSteps ?? 0), 0),
  plansWithStaleEstimates: cases.filter((c) => c.staleEstimates > 0).length,
  plansWithAllocationMismatch: cases.filter(
    (c) => c.allocationOutsidePaceRange > 0,
  ).length,
  diagnosticContracts: contracts.length,
  failedContracts: contracts.filter((c) => c.status === 'fail').length,
};
await writeFile(
  new URL('results.json', out),
  JSON.stringify(
    { summary, example, contracts, findings, cases, math },
    null,
    2,
  ) + '\n',
);
console.log(JSON.stringify(summary, null, 2));
console.log(JSON.stringify(contracts, null, 2));
if (
  summary.failedContracts ||
  summary.unexpectedRejections ||
  summary.plansWithStaleEstimates ||
  summary.plansWithAllocationMismatch
)
  process.exitCode = 1;

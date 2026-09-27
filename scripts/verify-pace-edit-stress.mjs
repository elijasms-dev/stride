/** Deterministic public-operation stress audit; synthetic data only.
 * Unexpected exceptions are failures. Explicit capacity refusals are listed
 * separately and must leave their source plan unchanged. */
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Decoder, Stream } from '@garmin/fitsdk';
import {
  addDays,
  demoProfile,
  makePlan,
  validatePlan,
  revisePreferences,
  refreshWorkoutVariety,
  refreshWeekTotals,
  PlanError,
} from '../lib/engine.ts';
import { trainingContractCases } from './verify-training-contracts.mjs';
import {
  FIRST_RACE_CASES,
  firstRaceProfile,
} from '../tests/first-race-cases.mjs';
import {
  benchmarkWorkoutTargets,
  updateWorkoutTargets,
  paceText,
} from '../lib/workout-targets.ts';
import { updateRunMeasure } from '../lib/run-distance.ts';
import { schedulingEasyPace } from '../lib/fitness-pacing.ts';
import { distanceEstimate, qualityWorkMinutes } from '../lib/prescription.ts';
import { validateRecovery, prepareRestoredPlan } from '../lib/recovery.ts';
import { encodeWorkout } from '../lib/fit.ts';
import { intervalsWorkoutText } from '../lib/intervals-workout.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const option = (key) => {
  const i = args.indexOf(key);
  return i < 0 ? undefined : args[i + 1];
};
const selectedId = option('--case');
const out = resolve(
  option('--out') ??
    `${root}/docs/verification/2026-09-25/all-distance-stress/pace-edits`,
);
const benchmarkMinutes = [20, 30, 40];
const json = (value) => JSON.stringify(value);
const serial = (value) => JSON.parse(json(value));
const counters = {
  operations: 0,
  prescriptions: 0,
  numericPrescriptions: 0,
  fitExports: 0,
  intervalsExports: 0,
  intervalsHrRefusals: 0,
  completedSnapshots: 0,
};

function stressCases() {
  const cases = trainingContractCases().flatMap((c) =>
    benchmarkMinutes.map((minutes) => ({
      id: `${c.id}-5k${minutes}`,
      profile: {
        ...c.profile,
        startDate: addDays(c.profile.startDate, -14),
        raceDate: addDays(c.profile.raceDate, -14),
        recentRace: {
          distanceKm: 5,
          timeMinutes: minutes,
          date: '2026-08-18',
          source: 'race',
          course: 'road',
        },
      },
    })),
  );
  // Predeclared lower-volume counterparts must generate, including the slowest
  // benchmark and two complete workouts. High-volume probes below remain visible.
  const slowBaselines = {
    '5k': [24, 8],
    '10k': [30, 10],
    half: [36, 12],
    marathon: [48, 18],
    'ultra-50k': [60, 28],
  };
  for (const c of trainingContractCases()) {
    const family = c.id.replace(/-q[012]-(?:time|distance)$/, '');
    if (!slowBaselines[family]) continue;
    let [weeklyKm, longestKm] = slowBaselines[family];
    const twoRoad =
      c.profile.qualitySessions === 2 && ['5k', '10k', 'half'].includes(family);
    if (twoRoad) {
      weeklyKm = 45;
      longestKm = family === 'half' ? 12 : 10;
    }
    const minutes = family === 'ultra-50k' ? 35 : 40;
    cases.push({
      id: `${c.id}-5k${minutes}-capacity-compatible`,
      profile: {
        ...c.profile,
        startDate: addDays(c.profile.startDate, -14),
        raceDate: addDays(c.profile.raceDate, -14),
        weeklyKm,
        longestKm,
        ...(twoRoad || family === 'ultra-50k'
          ? { currentRuns: 6, runsPerWeek: 6, days: [0, 1, 2, 3, 4, 6] }
          : {}),
        recentRace: { distanceKm: 5, timeMinutes: minutes, date: '2026-08-18' },
      },
    });
  }
  const start = '2026-08-31';
  for (const measure of ['time', 'distance']) {
    for (const goal of ['base', 'ultra', 'custom']) {
      for (const distance of goal === 'base' ? [null] : [100, 160.9344]) {
        cases.push({
          id: `${goal}-${distance ?? 'foundation'}-${measure}`,
          profile: {
            ...demoProfile(start),
            goal,
            ...(distance ? { raceDistanceKm: distance } : {}),
            raceDate: addDays(start, 223),
            weeklyKm: goal === 'base' ? 30 : 90,
            longestKm: goal === 'base' ? 8 : 30,
            currentRuns: 5,
            runsPerWeek: 5,
            days: [0, 1, 2, 4, 6],
            availableDays: [0, 1, 2, 3, 4, 5, 6],
            longDay: 6,
            weekdayMinutes: 120,
            longMinutes: 300,
            easyPace: 6,
            qualityMode: 'custom',
            qualitySessions: 0,
            recentQualitySessions: 0,
            stableWeeks: 16,
            ultraWeeklyMinutes: 720,
            ultraLongestMinutes: 240,
            runMeasure: measure,
            recentRace: { distanceKm: 10, timeMinutes: 50 },
          },
        });
      }
    }
    for (const c of FIRST_RACE_CASES) {
      cases.push({
        id: `first-${c.goal}-${measure}`,
        profile: firstRaceProfile(c, {
          startDate: start,
          runMeasure: measure,
          recentRace: { distanceKm: 5, timeMinutes: 30 },
        }),
      });
      cases.push({
        id: `zero-${c.goal}-${measure}`,
        profile: firstRaceProfile(c, {
          startDate: start,
          weeklyKm: 0,
          longestKm: 0,
          currentRuns: 0,
          days: [1, 3, 6],
          experience: 'new',
          runMeasure: measure,
          recentRace: undefined,
        }),
      });
    }
  }
  return cases;
}

function reviewedGenerationConstraint(scenario, error) {
  if (!(error instanceof PlanError)) return null;
  const p = scenario.profile;
  const pace = schedulingEasyPace(p);
  const capacityMessage =
    'Your starting weekly distance and long-run baseline cannot fit';
  if (
    /^ultra-50k-q[012]-(?:time|distance)-5k40$/.test(scenario.id) &&
    error.message.startsWith(capacityMessage)
  ) {
    const requiredLongMinutes = p.longestKm * pace;
    assert.ok(requiredLongMinutes > p.longMinutes);
    return {
      classification: 'proved-baseline-capacity',
      requiredLongMinutes,
      availableLongMinutes: p.longMinutes,
    };
  }
  if (
    /^marathon-q0-(?:time|distance)-5k40$/.test(scenario.id) &&
    error.message.startsWith(capacityMessage)
  ) {
    const maximumWeekKm =
      p.longestKm + ((p.days.length - 1) * p.weekdayMinutes) / pace;
    assert.ok(maximumWeekKm < p.weeklyKm);
    return {
      classification: 'proved-baseline-capacity',
      requestedWeeklyKm: p.weeklyKm,
      maximumWeekKm,
    };
  }
  const openingProbe =
    /^(?:5k-q2-(?:time|distance)-5k(?:30|40)|10k-q2-(?:time|distance)-5k40|half-q1-(?:time|distance)-5k40|half-q2-(?:time|distance)-5k(?:30|40)|marathon-q[12]-(?:time|distance)-5k40)$/;
  const lateProbe = /^5k-q1-(?:time|distance)-5k40$/;
  if (
    (openingProbe.test(scenario.id) &&
      error.message.startsWith(capacityMessage)) ||
    (lateProbe.test(scenario.id) &&
      error.message.startsWith('Week 9 cannot maintain 50 km within'))
  )
    return {
      classification: 'bounded-quality-capacity-probe',
      note: 'The generated complete quality recipes and bounded easy padding cannot retain this high starting volume. This rejection is reported separately and is not counted as a passing or viable plan. Capacity-compatible counterparts with declared lower mileage, an extra familiar running day, or a less restrictive fitness/time combination are required to generate.',
    };
  return null;
}

function history(plan) {
  return serial(
    plan.workouts
      .filter((w) => w.status === 'completed')
      .map((w) => ({
        date: w.date,
        originalDate: w.originalDate,
        kind: w.kind,
        minutes: w.minutes,
        estimatedKm: w.estimatedKm,
        steps: w.steps,
        feedback: {
          actualDate: w.feedback.actualDate,
          actualMinutes: w.feedback.actualMinutes,
          actualKm: w.feedback.actualKm,
          effort: w.feedback.effort,
          feeling: w.feedback.feeling,
          execution: w.feedback.execution,
          recordedAt: w.feedback.recordedAt,
          completedQualityMinutes: w.feedback.completedQualityMinutes,
          note: w.feedback.note,
        },
      }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  );
}

function completeBefore(plan, asOf) {
  for (const w of plan.workouts.filter(
    (w) => w.kind !== 'race' && w.date < asOf,
  )) {
    w.status = 'completed';
    w.feedback = {
      actualDate: w.date,
      actualMinutes: w.minutes,
      actualKm: plan.beginner ? null : w.estimatedKm,
      effort: 3,
      feeling: 'good',
      execution: 'as-planned',
      executionSource: 'self-report',
      completedQualityMinutes: qualityWorkMinutes(w),
      recordedAt: `${w.date}T20:00:00Z`,
      note: 'Synthetic stress audit completion.',
    };
  }
}

function numericRange(w) {
  let low = 0,
    high = 0;
  for (const s of w.steps) {
    if (s.metres !== undefined) {
      low += s.metres / 1000;
      high += s.metres / 1000;
    } else if (s.target?.mode === 'pace') {
      low += s.seconds / s.target.high;
      high += s.seconds / s.target.low;
    } else return null;
  }
  return { low, high };
}

function assertPlan(plan, oldHistory) {
  assert.deepEqual(
    validatePlan(plan),
    [],
    'Plan validation must pass after an accepted operation',
  );
  assert.deepEqual(
    validatePlan(serial(plan)),
    [],
    'Serialized validation must pass',
  );
  if (oldHistory) {
    assert.deepEqual(
      history(plan),
      oldHistory,
      'Completed prescription or recorded history changed',
    );
    counters.completedSnapshots += oldHistory.length;
  }
  for (const w of plan.workouts) {
    counters.prescriptions++;
    assert.ok(Number.isFinite(w.minutes) && Number.isFinite(w.estimatedKm));
    assert.ok(
      Math.abs(w.steps.reduce((n, s) => n + s.seconds, 0) - w.minutes * 60) <
        1e-6,
      `${w.date}: step seconds and session minutes disagree`,
    );
    if (w.prescriptionVersion && !w.beginnerLesson) {
      const basis = { easyPace: w.prescriptionPaceBasis ?? null };
      assert.deepEqual(
        w.distanceEstimate,
        distanceEstimate(w.steps, basis),
        `${w.date}: stale saved distance range`,
      );
    }
    const range = numericRange(w);
    if (range && w.kind !== 'race') {
      counters.numericPrescriptions++;
      assert.ok(
        w.estimatedKm >= range.low - 0.020001 &&
          w.estimatedKm <= range.high + 0.020001,
        `${w.date}: ${w.estimatedKm} km outside executable ${range.low}–${range.high}`,
      );
    }
    if (plan.beginner)
      assert.ok(
        w.steps.every((s) => !s.target && s.metres === undefined),
        'Zero-base course acquired a numeric target or distance endpoint',
      );
  }
  const totals = structuredClone(plan);
  refreshWeekTotals(totals);
  for (let i = 0; i < totals.weeks.length; i++)
    for (const key of [
      'targetKm',
      'longKm',
      'raceKm',
      'trainingMinutes',
      'qualityMinutes',
    ])
      assert.equal(
        plan.weeks[i][key],
        totals.weeks[i][key],
        `Stale weekly ${key}`,
      );
}

function exportOne(w) {
  const decoder = new Decoder(Stream.fromByteArray(encodeWorkout(w)));
  assert.equal(decoder.checkIntegrity(), true);
  const decoded = decoder.read();
  assert.deepEqual(decoded.errors, []);
  const saved = decoded.messages.workoutStepMesgs;
  assert.equal(saved.length, w.steps.length);
  for (let i = 0; i < saved.length; i++) {
    const step = w.steps[i],
      delivered = saved[i];
    assert.equal(
      delivered.durationType,
      step.metres !== undefined ? 'distance' : 'time',
    );
    assert.ok(
      Math.abs(
        (step.metres !== undefined
          ? delivered.durationDistance
          : delivered.durationTime) - (step.metres ?? step.seconds),
      ) < 0.011,
      'FIT changed the executable endpoint',
    );
    if (step.target?.mode === 'pace') {
      assert.equal(delivered.targetType, 'speed');
      assert.ok(
        Math.abs(delivered.customTargetSpeedLow - 1000 / step.target.high) <
          0.0011,
      );
      assert.ok(
        Math.abs(delivered.customTargetSpeedHigh - 1000 / step.target.low) <
          0.0011,
      );
    } else if (step.target?.mode === 'heart-rate') {
      assert.equal(delivered.targetType, 'heartRate');
      assert.equal(delivered.customTargetHeartRateLow, step.target.low + 100);
      assert.equal(delivered.customTargetHeartRateHigh, step.target.high + 100);
    } else assert.equal(delivered.targetType, 'open');
  }
  counters.fitExports++;
  try {
    const text = intervalsWorkoutText(w);
    for (const step of w.steps.filter((s) => s.target?.mode === 'pace'))
      assert.ok(
        text.includes(
          `${paceText(step.target.low)}-${paceText(step.target.high)}/km Pace`,
        ),
      );
    counters.intervalsExports++;
  } catch (error) {
    if (
      w.steps.some((s) => s.target?.mode === 'heart-rate') &&
      /Direct BPM/.test(error.message)
    )
      counters.intervalsHrRefusals++;
    else throw error;
  }
}

function compatibleManual(plan) {
  const ranges = benchmarkWorkoutTargets(plan.profile)?.pace;
  return {
    mode: 'pace',
    bandsVersion: 2,
    pace: ranges ?? {
      easy: { low: 360, high: 420 },
      threshold: { low: 300, high: 330 },
      interval: { low: 270, high: 300 },
    },
  };
}

const results = [];
const cases = stressCases().filter((c) => !selectedId || c.id === selectedId);
if (!cases.length) throw new Error(`No stress case matches ${selectedId}`);
for (const scenario of cases) {
  const result = {
    id: scenario.id,
    profile: scenario.profile,
    status: 'pending',
    operations: [],
    refusals: [],
  };
  let plan,
    stepName = 'generate';
  try {
    plan = makePlan(scenario.profile, scenario.profile.startDate, false);
    assertPlan(plan);
    const asOf = addDays(plan.profile.startDate, 14);
    completeBefore(plan, asOf);
    const recorded = history(plan);
    assertPlan(plan, recorded);
    const changedBenchmark = {
      distanceKm: 5,
      timeMinutes: 25,
      date: addDays(asOf, -1),
      source: 'time-trial',
      course: 'track',
    };
    const operations = [
      [
        'benchmark',
        (p) => revisePreferences(p, { recentRace: changedBenchmark }, asOf),
      ],
      [
        'manual-targets',
        (p, ids) => updateWorkoutTargets(p, compatibleManual(p), asOf, ids),
      ],
      [
        'slower-targets',
        (p, ids) =>
          updateWorkoutTargets(
            p,
            { mode: 'pace', pace: { easy: { low: 540, high: 600 } } },
            asOf,
            ids,
          ),
      ],
      [
        'effort-targets',
        (p, ids) => updateWorkoutTargets(p, { mode: 'effort' }, asOf, ids),
      ],
      [
        'heart-rate-targets',
        (p, ids) =>
          updateWorkoutTargets(
            p,
            {
              mode: 'heart-rate',
              heartRate: {
                easy: { low: 125, high: 145 },
                threshold: { low: 155, high: 165 },
              },
            },
            asOf,
            ids,
          ),
      ],
      [
        'automatic-targets',
        (p, ids) => updateWorkoutTargets(p, null, asOf, ids),
      ],
      [
        'measurement-distance',
        (p, ids) => updateRunMeasure(p, 'distance', asOf, ids),
      ],
      ['measurement-time', (p, ids) => updateRunMeasure(p, 'time', asOf, ids)],
      ['variety', (p, ids) => refreshWorkoutVariety(p, asOf, ids)],
      ['json', (p) => serial(p)],
      [
        'recovery',
        (p) =>
          prepareRestoredPlan(
            validateRecovery(
              serial({
                format: 'stride-recovery-2',
                exportedAt: `${asOf}T20:00:00Z`,
                profile: null,
                plan: p,
                standaloneRuns: [],
              }),
            ).plan,
          ),
      ],
    ];
    for (const [name, operation] of operations) {
      stepName = name;
      const before = serial(plan);
      const protectedWork = plan.workouts.find(
        (w) => w.status === 'planned' && w.date >= asOf && w.kind !== 'race',
      );
      const ids =
        name === 'benchmark' ? [] : protectedWork ? [protectedWork.id] : [];
      let next;
      try {
        next = operation(plan, ids);
      } catch (error) {
        assert.deepEqual(
          serial(plan),
          before,
          'Rejected operation mutated the source plan',
        );
        if (
          error instanceof PlanError &&
          /cannot fit.*(?:time|limit)|time limit|weekly.*limit|capacity/.test(
            error.message,
          ) &&
          [
            'slower-targets',
            'manual-targets',
            'benchmark',
            'measurement-distance',
          ].includes(name)
        ) {
          result.refusals.push({ operation: name, message: error.message });
          continue;
        }
        throw error;
      }
      assert.deepEqual(
        serial(plan),
        before,
        'Operation mutated the source plan',
      );
      assertPlan(next, recorded);
      if (ids.length && !['json', 'recovery'].includes(name))
        assert.deepEqual(
          serial(next.workouts.find((w) => w.id === ids[0])),
          serial(protectedWork),
          `${String(name)}: delivery-protected prescription changed`,
        );
      if (
        [
          'manual-targets',
          'slower-targets',
          'effort-targets',
          'heart-rate-targets',
          'automatic-targets',
        ].includes(name)
      ) {
        for (const old of plan.workouts.filter(
          (w) => w.status === 'planned' && w.date >= asOf,
        )) {
          const nextWork = next.workouts.find((w) => w.id === old.id);
          assert.deepEqual(
            nextWork.steps.map((s) => s.metres),
            old.steps.map((s) => s.metres),
            `${String(name)}: pace setting changed endpoint type or distance`,
          );
          for (let i = 0; i < old.steps.length; i++)
            if (old.steps[i].metres === undefined)
              assert.equal(
                nextWork.steps[i].seconds,
                old.steps[i].seconds,
                `${String(name)}: a fixed-time endpoint changed duration`,
              );
        }
      }
      plan = next;
      counters.operations++;
      result.operations.push(name);
      const sample =
        plan.workouts.find(
          (w) =>
            w.status === 'planned' &&
            w.date >= asOf &&
            w.hard &&
            w.kind !== 'race',
        ) ??
        plan.workouts.find(
          (w) => w.status === 'planned' && w.date >= asOf && w.kind !== 'race',
        );
      if (sample) exportOne(sample);
    }
    result.status = 'passed';
    result.weeks = plan.weeks.length;
    result.workouts = plan.workouts.length;
  } catch (error) {
    const reviewed =
      stepName === 'generate'
        ? reviewedGenerationConstraint(scenario, error)
        : null;
    result.status = reviewed ? 'generation-rejected' : 'failed';
    if (reviewed) result.constraint = reviewed;
    result.failure = {
      operation: stepName,
      name: error.name,
      message: error.message,
      stack: error.stack,
      reproduce: `node --experimental-strip-types scripts/verify-pace-edit-stress.mjs --case ${scenario.id}`,
    };
    if (plan)
      result.failure.sample = plan.workouts
        .filter((w) => w.status === 'planned')
        .slice(0, 2);
  }
  results.push(result);
}

async function sourceHash(directory) {
  const hash = createHash('sha256');
  async function walk(dir) {
    for (const entry of (await readdir(dir, { withFileTypes: true })).sort(
      (a, b) => a.name.localeCompare(b.name),
    )) {
      const path = resolve(dir, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (/\.(ts|tsx)$/.test(path))
        hash.update(path.slice(root.length)).update(await readFile(path));
    }
  }
  await walk(directory);
  return hash.digest('hex');
}
const summary = {
  attempted: results.length,
  passed: results.filter((r) => r.status === 'passed').length,
  failed: results.filter((r) => r.status === 'failed').length,
  generationRejected: results.filter((r) => r.status === 'generation-rejected')
    .length,
  provedBaselineCapacity: results.filter(
    (r) => r.constraint?.classification === 'proved-baseline-capacity',
  ).length,
  boundedQualityCapacityProbes: results.filter(
    (r) => r.constraint?.classification === 'bounded-quality-capacity-probe',
  ).length,
  capacityRefusals: results.reduce((n, r) => n + r.refusals.length, 0),
  ...counters,
};
const report = {
  generatedAt: new Date().toISOString(),
  sourceSha256: await sourceHash(resolve(root, 'lib')),
  summary,
  limitations: [
    'Synthetic engine/serialization/export tests, not live integrations or coaching certification.',
    'Generation rejections and capacity refusals are reported separately; they are not proofs of viable training.',
    'Capacity probes accept only named fixtures and reviewed constraint messages; every unlisted generation rejection is a failure. Capacity-compatible slow-benchmark counterparts must complete all edit sequences; the 50K companion uses a 35-minute benchmark because 28 km at the 40-minute benchmark pace cannot fit the supported 300-minute ceiling.',
    'FIT and Intervals are sampled once per accepted operation, not every session.',
  ],
  results,
};
await mkdir(out, { recursive: true });
await writeFile(
  resolve(out, 'results.json'),
  JSON.stringify(report, null, 2) + '\n',
);
await writeFile(
  resolve(out, 'README.md'),
  `# Pace and edit sequence stress audit\n\n\`\`\`json\n${JSON.stringify(summary, null, 2)}\n\`\`\`\n\nSource: \`${report.sourceSha256}\`.\n\n` +
    `Reproduce with \`node --experimental-strip-types scripts/verify-pace-edit-stress.mjs\`; isolate with \`--case ID --out /tmp/stride-pace-case\`.\n\n` +
    report.limitations.map((s) => `- ${s}`).join('\n') +
    '\n\n' +
    results
      .filter((r) => r.status !== 'passed')
      .map(
        (r) =>
          `- **${r.id}**: ${r.constraint?.classification ?? r.status}, ${r.failure.operation}: ${r.failure.message}`,
      )
      .join('\n') +
    '\n',
);
console.log(JSON.stringify(summary, null, 2));
if (summary.failed) process.exitCode = 1;

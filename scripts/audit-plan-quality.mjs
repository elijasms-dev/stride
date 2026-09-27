/** Independent product-quality oracle. Historical examples are read, never rewritten. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  makePlan,
  addDays,
  taperFactor,
  validatePlan,
  refreshWorkoutVariety,
} from '../lib/engine.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = resolve(
  root,
  'docs/verification/2026-09-25/plan-quality-review/example-plans.json',
);
const folder = resolve(
  root,
  'docs/verification/2026-09-25/plan-quality-review',
);
const tolerance = 0.001001;
const round = (n, digits = 3) =>
  Number.isFinite(n) ? Number(n.toFixed(digits)) : n;
const train = (w) => w.kind !== 'race' && w.status !== 'skipped';
const demanding = (w) =>
  !['long', 'race'].includes(w.kind) &&
  w.hard &&
  w.steps.some(
    (s) => s.kind === 'work' && s.intensity >= 4 && s.movement !== 'walk',
  );

export function savedQualityExamples() {
  return JSON.parse(readFileSync(source, 'utf8'));
}

/** Ignore labels, easy padding, and changing pace values. Endpoints, dose,
 * recovery structure and effort role must actually differ to count as variety. */
export function qualitySignature(workout) {
  const steps = workout.steps.filter(
    (s) => !['warmup', 'cooldown', 'aerobic'].includes(s.kind),
  );
  return JSON.stringify(
    steps.map((s) => [
      s.kind,
      s.metres === undefined
        ? ['time', round(s.seconds)]
        : ['distance', round(s.metres)],
      s.intensity,
      s.effortRole ?? null,
      s.movement ?? 'run',
    ]),
  );
}

function readableSet(workout) {
  const tokens = workout.steps
    .filter((s) => !['warmup', 'cooldown', 'aerobic'].includes(s.kind))
    .map(
      (s) =>
        `${s.metres === undefined ? `${round(s.seconds / 60, 2)}min` : `${round(s.metres)}m`} ${s.kind}/${s.effortRole ?? s.intensity}`,
    );
  return tokens.join(' + ');
}

export function auditPlanQuality(plan) {
  const issues = [];
  const warnings = [];
  const rows = [];
  let previousOrdinaryLong;
  let previousOrdinaryWeek;
  let lastWeekSignature;
  let lastOrdinaryIndex;
  let identicalWeekStreak = 0;
  let maxIdenticalWeekStreak = 0;
  let identicalExposureStreak = 0;
  let maxIdenticalExposureStreak = 0;
  let previousExposureSignature;
  let adjacentIdenticalExposures = 0;
  const ordinarySignatures = new Set();
  const families = new Set();
  for (const week of plan.weeks) {
    for (const key of [
      'targetKm',
      'longKm',
      'trainingMinutes',
      'qualityMinutes',
    ])
      if (
        week[key] !== undefined &&
        (!Number.isFinite(week[key]) || week[key] < 0)
      )
        issues.push({
          type: 'non-finite-accounting',
          week: week.index + 1,
          field: key,
          value: week[key],
        });
    const runs = plan.workouts.filter((w) => w.week === week.index && train(w));
    const long = runs.find((w) => w.kind === 'long');
    const mediumLong = runs.filter(
      (w) =>
        plan.profile.goal === 'marathon' &&
        w.kind === 'easy' &&
        !w.hard &&
        w.role === 'medium-long',
    );
    const easy = runs.filter(
      (w) => w.kind === 'easy' && !w.hard && !mediumLong.includes(w),
    );
    const quality = runs.filter(demanding);
    const easyMaxKm = Math.max(0, ...easy.map((w) => w.estimatedKm));
    const easyMaxMinutes = Math.max(0, ...easy.map((w) => w.minutes));
    const mediumLongMaxKm = Math.max(
      0,
      ...mediumLong.map((w) => w.estimatedKm),
    );
    const factors = runs.map((w) => taperFactor(plan.profile, w.date));
    const longTaper = long ? taperFactor(plan.profile, long.date) : null;
    const mixedTaper =
      long &&
      easy.some((w) => taperFactor(plan.profile, w.date) > longTaper + 1e-9);
    const fullCalendar =
      week.start >= plan.profile.startDate &&
      addDays(week.start, 6) <= plan.profile.raceDate;
    const scope = mixedTaper
      ? 'mixed-taper'
      : week.phase === 'Race week'
        ? 'race-week'
        : factors.some((f) => f < 1) || week.phase === 'Taper'
          ? 'taper'
          : week.phase === 'Recovery'
            ? 'recovery'
            : 'ordinary';
    const hierarchyEligible =
      fullCalendar &&
      !!long &&
      ['ordinary', 'recovery'].includes(scope) &&
      !plan.beginner &&
      !plan.firstRace &&
      ['5k', '10k', 'half', 'marathon'].includes(plan.profile.goal);
    const shortSupport = long
      ? easy.filter((run) => {
          const gap = Math.abs(
            (Date.parse(run.date) - Date.parse(long.date)) / 86400000,
          );
          const nextDay = new Date(run.date + 'T12:00:00Z').getUTCDay() % 7;
          return gap === 1 || gap === 6 || plan.profile.days.includes(nextDay);
        })
      : [];
    const total = runs.reduce((n, w) => n + w.estimatedKm, 0);
    const signatures = quality.map(qualitySignature);
    const row = {
      week: week.index + 1,
      start: week.start,
      phase: week.phase,
      scope,
      trainingKm: round(total),
      minutes: round(runs.reduce((n, w) => n + w.minutes, 0)),
      longKm: long ? round(long.estimatedKm) : null,
      longMinutes: long ? round(long.minutes) : null,
      easyMaxKm: round(easyMaxKm),
      easyMaxMinutes: round(easyMaxMinutes),
      easyLongRatio:
        long && long.estimatedKm > 0
          ? round(easyMaxKm / long.estimatedKm, 6)
          : null,
      easyLongTimeRatio:
        long && long.minutes > 0
          ? round(easyMaxMinutes / long.minutes, 6)
          : null,
      hierarchyEligible,
      shortSupportCount: hierarchyEligible ? shortSupport.length : 0,
      mediumLongCount: mediumLong.length,
      mediumLongMaxKm: round(mediumLongMaxKm),
      mediumLongRatio:
        long && long.estimatedKm > 0
          ? round(mediumLongMaxKm / long.estimatedKm, 6)
          : null,
      qualityCount: quality.length,
      quality: quality.map((w) => ({
        date: w.date,
        title: w.title,
        stimulus: w.stimulus,
        signature: qualitySignature(w),
        steps: readableSet(w),
      })),
    };
    rows.push(row);
    if (hierarchyEligible)
      for (const run of shortSupport)
        if (run.estimatedKm > long.estimatedKm * 0.65 + tolerance)
          issues.push({
            type: 'short-support-hierarchy',
            week: row.week,
            date: run.date,
            easyKm: run.estimatedKm,
            longKm: long.estimatedKm,
          });
    if (hierarchyEligible && mediumLong.length) {
      if (
        mediumLong.length > 1 ||
        mediumLongMaxKm > long.estimatedKm * 0.9 + tolerance
      )
        issues.push({
          type: 'medium-long-hierarchy',
          week: row.week,
          count: mediumLong.length,
          maximumKm: mediumLongMaxKm,
          longKm: long.estimatedKm,
        });
      if (
        mediumLong.some(
          (w) => !/(?:medium[-–—‑ ]long|midweek endurance)/i.test(w.title),
        )
      )
        issues.push({
          type: 'medium-long-label',
          week: row.week,
          message:
            'A distinct medium-long or midweek-endurance role must be visible in the session title.',
        });
    }
    if (hierarchyEligible && easyMaxKm > long.estimatedKm * 0.8 + tolerance)
      issues.push({
        type: 'easy-long-hierarchy',
        week: row.week,
        message: `${easyMaxKm} km easy exceeds 80% of ${long.estimatedKm} km long run (${round((easyMaxKm / long.estimatedKm) * 100, 1)}%).`,
      });
    else if (long && easyMaxKm > long.estimatedKm * 0.8 + tolerance)
      warnings.push({
        type: 'taper-or-partial-hierarchy',
        week: row.week,
        scope,
        ratio: row.easyLongRatio,
      });
    if (fullCalendar && scope === 'ordinary') {
      if (quality.length !== (plan.profile.qualitySessions ?? 1))
        issues.push({
          type: 'quality-frequency',
          week: row.week,
          actual: quality.length,
          expected: plan.profile.qualitySessions ?? 1,
        });
      if (long) {
        if (
          previousOrdinaryLong !== undefined &&
          long.estimatedKm + tolerance < previousOrdinaryLong
        )
          issues.push({
            type: 'long-regression',
            week: row.week,
            previous: previousOrdinaryLong,
            actual: long.estimatedKm,
          });
        if (
          week.index > 0 &&
          Math.abs(long.estimatedKm - Math.round(long.estimatedKm)) > tolerance
        )
          issues.push({
            type: 'fractional-generated-long',
            week: row.week,
            km: long.estimatedKm,
          });
        previousOrdinaryLong = long.estimatedKm;
      }
      if (
        previousOrdinaryWeek !== undefined &&
        total + tolerance < previousOrdinaryWeek
      )
        issues.push({
          type: 'weekly-regression',
          week: row.week,
          previous: previousOrdinaryWeek,
          actual: total,
        });
      previousOrdinaryWeek = total;
      const signature = JSON.stringify(signatures);
      identicalWeekStreak =
        quality.length &&
        lastOrdinaryIndex === week.index - 1 &&
        signature === lastWeekSignature
          ? identicalWeekStreak + 1
          : quality.length
            ? 1
            : 0;
      lastWeekSignature = signature;
      lastOrdinaryIndex = week.index;
      maxIdenticalWeekStreak = Math.max(
        maxIdenticalWeekStreak,
        identicalWeekStreak,
      );
      for (const w of quality) {
        const sig = qualitySignature(w);
        if (sig === previousExposureSignature) adjacentIdenticalExposures++;
        identicalExposureStreak =
          sig === previousExposureSignature ? identicalExposureStreak + 1 : 1;
        maxIdenticalExposureStreak = Math.max(
          maxIdenticalExposureStreak,
          identicalExposureStreak,
        );
        previousExposureSignature = sig;
        ordinarySignatures.add(sig);
        families.add(w.stimulus ?? w.kind);
      }
      if (plan.profile.workoutVariety !== 'familiar' && identicalWeekStreak > 2)
        issues.push({
          type: 'identical-quality-weeks',
          week: row.week,
          streak: identicalWeekStreak,
        });
    } else {
      // Familiar sessions after recovery are useful repetition, not an unbroken
      // sequence of identical build-week instructions.
      previousExposureSignature = undefined;
      identicalExposureStreak = 0;
      lastWeekSignature = undefined;
      identicalWeekStreak = 0;
    }
    for (const run of runs) {
      if (
        !Number.isFinite(run.estimatedKm) ||
        run.estimatedKm <= 0 ||
        !Number.isFinite(run.minutes) ||
        run.minutes <= 0 ||
        run.steps.some(
          (s) =>
            !Number.isFinite(s.seconds) ||
            s.seconds <= 0 ||
            (s.metres !== undefined &&
              (!Number.isFinite(s.metres) || s.metres <= 0)),
        )
      )
        issues.push({ type: 'non-finite-prescription', date: run.date });
      const limit =
        run.kind === 'long'
          ? plan.profile.longMinutes
          : plan.profile.weekdayMinutes;
      if (run.minutes > limit + 1 / 60 + 1e-6)
        issues.push({
          type: 'session-time-cap',
          date: run.date,
          minutes: run.minutes,
          limit,
        });
      if (
        Math.abs(
          run.steps.reduce((sum, step) => sum + step.seconds, 0) -
            run.minutes * 60,
        ) > 1e-6
      )
        issues.push({ type: 'duration-accounting', date: run.date });
      if (
        run.steps.every(
          (s) => s.metres !== undefined || s.target?.mode === 'pace',
        )
      ) {
        const lower = run.steps.reduce(
          (sum, s) =>
            sum +
            (s.metres === undefined
              ? s.seconds / s.target.high
              : s.metres / 1000),
          0,
        );
        const upper = run.steps.reduce(
          (sum, s) =>
            sum +
            (s.metres === undefined
              ? s.seconds / s.target.low
              : s.metres / 1000),
          0,
        );
        if (
          run.estimatedKm < lower - 0.020001 ||
          run.estimatedKm > upper + 0.020001
        )
          issues.push({
            type: 'executable-distance-accounting',
            date: run.date,
            estimatedKm: run.estimatedKm,
            lower,
            upper,
          });
      }
    }
  }
  const first = rows[0];
  return {
    opening: {
      declaredWeeklyKm: plan.profile.weeklyKm,
      actualWeeklyKm: first?.trainingKm ?? 0,
      weeklyDifferenceKm: round(
        (first?.trainingKm ?? 0) - plan.profile.weeklyKm,
      ),
      declaredLongKm: plan.profile.longestKm,
      actualLongKm: first?.longKm ?? null,
    },
    peaks: {
      weeklyKm: Math.max(...rows.map((r) => r.trainingKm)),
      longKm: Math.max(...rows.map((r) => r.longKm ?? 0)),
    },
    checkedShortSupportRuns: rows.reduce(
      (sum, row) => sum + row.shortSupportCount,
      0,
    ),
    maximumEligibleEasyLongRatio: Math.max(
      0,
      ...rows.filter((r) => r.hierarchyEligible).map((r) => r.easyLongRatio),
    ),
    maximumEligibleMediumLongRatio: Math.max(
      0,
      ...rows
        .filter((r) => r.hierarchyEligible)
        .map((r) => r.mediumLongRatio ?? 0),
    ),
    adjacentIdenticalExposures,
    maxIdenticalExposureStreak,
    maxIdenticalWeekStreak,
    uniqueOrdinaryQualitySignatures: ordinarySignatures.size,
    qualityFamilies: [...families],
    issues,
    warnings,
    weeks: rows,
  };
}

export function planQualityCases(wide = true) {
  const examples = savedQualityExamples();
  const cases = examples.map((e) => ({
    id: e.id,
    input: e.input,
    group: 'exact-example',
  }));
  if (!wide) return cases;
  for (const e of examples) {
    if (e.input.goal !== 'marathon' && e.input.qualitySessions > 0)
      cases.push({
        id: `${e.id}-time-fast-benchmark-declared-easy`,
        group: 'competing-pace-inputs',
        input: {
          ...e.input,
          runMeasure: 'time',
          easyPace: 6,
          recentRace: { ...e.input.recentRace, distanceKm: 5, timeMinutes: 20 },
        },
      });
    for (const runMeasure of ['time', 'distance']) {
      for (const workoutFormat of ['time', 'distance'])
        cases.push({
          id: `${e.id}-${runMeasure}-${workoutFormat}-format`,
          input: { ...e.input, runMeasure, workoutFormat },
          group: 'measurement-format',
        });
      for (const easyPace of [5, 7])
        cases.push({
          id: `${e.id}-${runMeasure}-effort-${easyPace}`,
          input: {
            ...e.input,
            runMeasure,
            easyPace,
            recentRace: undefined,
            workoutTargets: { mode: 'effort' },
          },
          group: 'pace',
        });
    }
    cases.push({
      id: `${e.id}-familiar`,
      input: { ...e.input, workoutVariety: 'familiar' },
      group: 'familiar',
    });
    cases.push({
      id: `${e.id}-maintain`,
      input: { ...e.input, volume: 'maintain' },
      group: 'maintain',
      ...(e.input.goal === 'marathon'
        ? {
            expectedRejection:
              /^These limits leave a longest training exposure of 23 km; this policy requires room for 26 km\./,
          }
        : {}),
    });
    cases.push({
      id: `${e.id}-midweek`,
      input: {
        ...e.input,
        startDate: addDays(e.input.startDate, 2),
        raceDate: addDays(e.input.raceDate, 2),
      },
      group: 'calendar',
    });
  }
  const marathon = examples.find((e) => e.id === 'marathon-q2');
  for (const q of [0, 1]) {
    const example = examples.find((e) => e.id === `marathon-q${q}`);
    for (const runMeasure of ['time', 'distance'])
      cases.push({
        id: `marathon-support-heavy-q${q}-${runMeasure}`,
        input: {
          ...example.input,
          weeklyKm: 45,
          longestKm: 12,
          currentRuns: 4,
          runsPerWeek: 4,
          days: [0, 2, 4, 6],
          runMeasure,
        },
        group: 'marathon-hierarchy-regression',
      });
  }
  for (const distance of [31, 42.195, 45])
    for (const runMeasure of ['time', 'distance'])
      cases.push({
        id: `custom-${distance}-q2-${runMeasure}`,
        input: {
          ...marathon.input,
          goal: 'custom',
          raceDistanceKm: distance,
          runMeasure,
        },
        group: 'marathon-rhythm-regression',
      });
  return cases;
}

function checkHistory(plan) {
  const original = structuredClone(plan);
  const completed = original.workouts.find((w) => w.kind !== 'race');
  completed.status = 'completed';
  completed.feedback = {
    actualDate: completed.date,
    actualMinutes: completed.minutes,
    actualKm: completed.estimatedKm,
    effort: 3,
    feeling: 'good',
    execution: 'as-planned',
    executionSource: 'self-report',
    note: 'Synthetic quality-audit history.',
    recordedAt: `${completed.date}T20:00:00Z`,
  };
  const protectedRun = original.workouts.find(
    (w) => w.kind === 'long' && w.status === 'planned',
  );
  const before = structuredClone(original);
  const refreshed = refreshWorkoutVariety(
    original,
    addDays(completed.date, 1),
    protectedRun ? [protectedRun.id] : [],
  );
  assert.deepEqual(original, before, 'Variety mutated its source plan');
  assert.deepEqual(
    refreshed.workouts.find((w) => w.id === completed.id),
    completed,
    'Completed history changed',
  );
  if (protectedRun)
    assert.deepEqual(
      refreshed.workouts.find((w) => w.id === protectedRun.id),
      protectedRun,
      'Protected long run changed',
    );
  assert.deepEqual(
    validatePlan(refreshed),
    [],
    'Variety refresh returned an invalid plan',
  );
  assert.deepEqual(
    refreshed.workouts.map((w) => [w.id, w.date, w.kind]),
    original.workouts.map((w) => [w.id, w.date, w.kind]),
    'Variety changed the schedule or session count',
  );
}

async function fingerprint() {
  const hash = createHash('sha256');
  async function walk(dir) {
    for (const e of (await readdir(dir, { withFileTypes: true })).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const file = resolve(dir, e.name);
      if (e.isDirectory()) await walk(file);
      else if (/\.tsx?$/.test(e.name))
        hash.update(relative(root, file)).update(await readFile(file));
    }
  }
  await walk(resolve(root, 'lib'));
  return hash.digest('hex');
}

async function main() {
  const args = process.argv.slice(2);
  const get = (name, fallback) =>
    args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
  const tag = get('--tag', new Date().toISOString().replace(/[:.]/g, '-'));
  if (!/^[A-Za-z0-9_-]+$/.test(tag))
    throw new Error('Use a filename-safe audit tag.');
  const saved = args.includes('--saved');
  const sourceBefore = await fingerprint();
  const cases = saved
    ? savedQualityExamples().map((e) => ({ ...e, group: 'historical-example' }))
    : planQualityCases(!args.includes('--examples-only'));
  const results = [];
  for (const c of cases.filter(
    (c) => !get('--case', null) || c.id === get('--case', null),
  )) {
    const started = performance.now();
    let p;
    try {
      p = saved ? c.plan : makePlan(c.input, c.input.startDate, false);
      const generationMs = performance.now() - started;
      const structural = validatePlan(p);
      const quality = auditPlanQuality(p);
      if (!saved && c.group === 'exact-example') checkHistory(p);
      results.push({
        id: c.id,
        group: c.group,
        input: c.input,
        generationMs: round(generationMs),
        status:
          structural.length || quality.issues.length ? 'failed' : 'passed',
        structural,
        ...quality,
      });
    } catch (error) {
      const expected = c.expectedRejection?.test(error.message) === true;
      results.push({
        id: c.id,
        group: c.group,
        input: c.input,
        status: expected ? 'expected-rejection' : 'error',
        generationMs: round(performance.now() - started),
        error: { name: error.name, message: error.message, stack: error.stack },
        ...(expected
          ? {
              constraint:
                'A maintained23km long run cannot reach the policy26km marathon exposure; this is not a generated or viable plan.',
            }
          : {}),
      });
    }
  }
  const sourceAfter = await fingerprint();
  const timings = results.map((r) => r.generationMs).sort((a, b) => a - b);
  const issueCounts = {};
  for (const result of results)
    for (const issue of result.issues ?? [])
      issueCounts[issue.type] = (issueCounts[issue.type] ?? 0) + 1;
  const summary = {
    cases: results.length,
    passed: results.filter((r) => r.status === 'passed').length,
    failed: results.filter((r) => r.status === 'failed').length,
    errors: results.filter((r) => r.status === 'error').length,
    expectedRejections: results.filter((r) => r.status === 'expected-rejection')
      .length,
    weeks: results.reduce((n, r) => n + (r.weeks?.length ?? 0), 0),
    issueCounts,
    generationMs: {
      median: timings[Math.floor(timings.length * 0.5)],
      p95: timings[
        Math.min(timings.length - 1, Math.floor(timings.length * 0.95))
      ],
      maximum: timings.at(-1),
    },
  };
  const report = {
    generatedAt: new Date().toISOString(),
    sourceBefore,
    sourceAfter,
    sourceStable: sourceBefore === sourceAfter,
    historical: saved,
    summary,
    results,
  };
  await mkdir(folder, { recursive: true });
  await writeFile(
    resolve(folder, `quality-${tag}.json`),
    JSON.stringify(report, null, 2) + '\n',
    { flag: 'wx' },
  );
  const lines = [
    `# Plan-quality audit: ${tag}`,
    '',
    `\`\`\`json\n${JSON.stringify(summary, null, 2)}\n\`\`\``,
    '',
    `Source stable: ${report.sourceStable}; SHA256: \`${sourceAfter}\`. Saved-example mode: ${saved}.`,
    '',
    'The 80% ordinary-easy hierarchy limit and repetition threshold are declared product criteria, not universal coaching rules. Marathon plans may have one visibly named midweek endurance/medium-long outing up to 90% of the long run; road endurance outings retain the 80% bound. Recovery weeks are included; mixed taper and race weeks are reported separately. Completed history and a delivery-protected long run are checked for every regenerated exact example.',
    '',
    '| Plan | Opening weekly: declared → planned | Long: declared → planned | Peak week / long | Max eligible easy/long | Max marathon medium-long/long | Distinct quality sets | Longest repeated week set | Status |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
  ];
  for (const r of results) {
    if (r.error) {
      lines.push(
        `| ${r.id} | — | — | — | — | — | — | — | ${r.error.message.replaceAll('|', '/')} |`,
      );
      continue;
    }
    lines.push(
      `| ${r.id} | ${r.opening.declaredWeeklyKm} → ${r.opening.actualWeeklyKm} | ${r.opening.declaredLongKm} → ${r.opening.actualLongKm} | ${r.peaks.weeklyKm} / ${r.peaks.longKm} | ${round(r.maximumEligibleEasyLongRatio * 100, 1)}% | ${round(r.maximumEligibleMediumLongRatio * 100, 1)}% | ${r.uniqueOrdinaryQualitySignatures} | ${r.maxIdenticalWeekStreak} | ${r.status} |`,
    );
  }
  for (const r of results.filter(
    (r) =>
      ['exact-example', 'historical-example'].includes(r.group) && !r.error,
  )) {
    lines.push(
      '',
      `## ${r.id}`,
      '',
      '| Week | Phase / context | Weekly km | Long km | Largest easy km | Easy / long | Marathon medium-long km / ratio | Quality count | Main sets |',
      '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
    );
    for (const w of r.weeks)
      lines.push(
        `| ${w.week} | ${w.phase} / ${w.scope} | ${w.trainingKm} | ${w.longKm ?? '—'} | ${w.easyMaxKm} | ${w.easyLongRatio === null ? '—' : `${round(w.easyLongRatio * 100, 1)}%`} | ${w.mediumLongCount ? `${w.mediumLongMaxKm} / ${round(w.mediumLongRatio * 100, 1)}%` : '—'} | ${w.qualityCount} | ${w.quality.map((q) => q.steps.replaceAll('|', '/')).join('<br>') || 'Easy only'} |`,
      );
  }
  await writeFile(
    resolve(folder, `quality-${tag}.md`),
    lines.join('\n') + '\n',
    { flag: 'wx' },
  );
  console.log(
    JSON.stringify({ ...summary, sourceStable: report.sourceStable }, null, 2),
  );
  if (summary.failed || summary.errors || !report.sourceStable)
    process.exitCode = 1;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await main();

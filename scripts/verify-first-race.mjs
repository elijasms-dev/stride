/** An explicit scenario oracle: expected generation must generate. A random
 * PlanError is a failure, not a successful safety result. Synthetic data only. */
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  makePlan,
  validatePlan,
  addDays,
  dayDiff,
  PlanError,
} from '../lib/engine.ts';
import { assessFeasibility } from '../lib/plan/feasibility.ts';
import {
  FIRST_RACE_CASES,
  firstRaceProfile,
} from '../tests/first-race-cases.mjs';
const out = new URL(
  '../docs/verification/2026-09-24/beginner-distances/',
  import.meta.url,
);
await mkdir(out, { recursive: true });
const rows = [],
  failures = [];
const training = (p) => p.workouts.filter((w) => w.kind !== 'race');
const total = (runs) =>
  Number(runs.reduce((n, w) => n + w.estimatedKm, 0).toFixed(3));
function summarize(p) {
  return p.weeks.map((week) => {
    const runs = training(p).filter(
      (w) => w.week === week.index && w.status !== 'skipped',
    );
    return {
      week: week.index + 1,
      start: week.start,
      phase: week.phase,
      km: total(runs),
      longKm: Math.max(
        0,
        ...runs.filter((w) => w.kind === 'long').map((w) => w.estimatedKm),
      ),
      minutes: Number(runs.reduce((n, w) => n + w.minutes, 0).toFixed(2)),
      runs: runs.length,
      speedWorkouts: runs.filter((w) => w.hard || w.qualityMinutes > 0).length,
    };
  });
}
function verify(id, profile, expected) {
  try {
    let p;
    try {
      p = makePlan(profile, profile.startDate);
    } catch (e) {
      if (expected !== 'reject') throw e;
      assert.ok(e instanceof PlanError);
      rows.push({
        id,
        profile,
        expected,
        result: 'correctly-rejected',
        reason: e.message,
      });
      return;
    }
    assert.notEqual(
      expected,
      'reject',
      'Expected rejection but generated a plan',
    );
    assert.deepEqual(validatePlan(p), []);
    assert.deepEqual(validatePlan(JSON.parse(JSON.stringify(p))), []);
    const assessment = assessFeasibility(p, profile.startDate);
    const weeks = summarize(p);
    assert.ok(weeks.every((w) => w.speedWorkouts === 0));
    assert.ok(
      p.workouts.every(
        (w) => w.date >= profile.startDate && w.date <= profile.raceDate,
      ),
    );
    if (expected === 'foundation') {
      assert.ok(p.beginner);
      assert.ok(
        p.workouts.every((w) => w.estimatedKm === 0 && w.kind === 'easy'),
      );
      assert.equal(assessment.status, 'review-required');
    } else {
      assert.equal(p.firstRace.goal, profile.goal);
      assert.ok(
        training(p).every(
          (w) =>
            w.minutes <=
            (w.kind === 'long' ? profile.longMinutes : profile.weekdayMinutes) +
              1e-6,
        ),
      );
      const ordinary = weeks.filter(
        (w) =>
          !['Recovery', 'Taper', 'Race week'].includes(w.phase) &&
          w.start >= profile.startDate &&
          addDays(w.start, 6) <= profile.raceDate,
      );
      let anchor = profile.longestKm;
      for (const w of ordinary) {
        assert.equal(w.runs, profile.days.length);
        assert.ok(
          w.longKm >= anchor - 0.001,
          `unlabelled long-run decline ${anchor} -> ${w.longKm}`,
        );
        if (w.longKm > profile.longestKm) assert.ok(Number.isInteger(w.longKm));
        anchor = w.longKm;
      }
      if (
        ordinary.length &&
        dayDiff(profile.startDate, ordinary[0].start) < 7
      ) {
        assert.ok(
          Math.abs(ordinary[0].km - profile.weeklyKm) <= 0.011,
          'opening weekly baseline changed',
        );
        assert.equal(ordinary[0].longKm, profile.longestKm);
      }
      assert.equal(
        assessment.status,
        expected === 'adequate' ? 'forecast' : 'review-required',
        assessment.reasons.join(' '),
      );
    }
    rows.push({ id, profile, expected, result: expected, assessment, weeks });
  } catch (error) {
    failures.push({ id, profile, expected, error: error.message });
  }
}
for (const c of FIRST_RACE_CASES) {
  // Long enough calendars and generous caps: these MUST actually generate an
  // adequate forecast. Includes leap-year, DST and every start/event weekday.
  for (const origin of ['2026-09-28', '2028-02-21'])
    for (let offset = 0; offset < 7; offset++)
      for (let eventOffset = 0; eventOffset < 7; eventOffset++)
        for (const pace of [5.5, 7, 9]) {
          const start = addDays(origin, offset);
          const p = firstRaceProfile(c, {
            startDate: start,
            raceDate: addDays(start, (c.weeks + 4) * 7 - 1 + eventOffset),
            easyPace: pace,
            longMinutes: 300,
            weekdayMinutes: 120,
          });
          verify(
            `${c.goal}-${origin}-s${offset}-e${eventOffset}-p${pace}`,
            p,
            'adequate',
          );
        }
  for (const experience of ['new', 'established'])
    for (const format of ['time', 'distance']) {
      const p = firstRaceProfile(c, { experience, runMeasure: format });
      verify(`${c.goal}-${experience}-${format}`, p, 'adequate');
    }
  for (const weeks of [2, 4])
    verify(
      `${c.goal}-short-${weeks}`,
      firstRaceProfile(c, { raceDate: addDays('2026-09-28', weeks * 7 - 1) }),
      'review',
    );
  for (const q of [1, 2])
    verify(
      `${c.goal}-quality-${q}`,
      firstRaceProfile(c, { qualityMode: 'custom', qualitySessions: q }),
      'reject',
    );
  for (const patch of [
    { weeklyKm: 3, longestKm: 1, currentRuns: 2 },
    { longMinutes: 5 },
    { method: 'double-threshold' },
  ])
    verify(
      `${c.goal}-rejection-${JSON.stringify(patch)}`,
      firstRaceProfile(c, patch),
      'reject',
    );
  for (const runs of [2, 3])
    for (const weeks of [4, 18, 40])
      verify(
        `${c.goal}-zero-${runs}days-${weeks}weeks`,
        firstRaceProfile(c, {
          weeklyKm: 0,
          longestKm: 0,
          currentRuns: 0,
          days: runs === 2 ? [0, 3] : [0, 2, 4],
          longDay: 6,
          weekdayMinutes: 40,
          easyPace: null,
          raceDate: addDays('2026-09-28', weeks * 7 - 1),
        }),
        'foundation',
      );
  const entry = {
    '5k': [7.5, 2.5],
    '10k': [12, 5],
    half: [18, 6],
    marathon: [24, 10],
  }[c.goal];
  verify(
    `${c.goal}-entry-base`,
    firstRaceProfile(c, {
      weeklyKm: entry[0],
      longestKm: entry[1],
      raceDate: addDays('2026-09-28', (c.weeks + 4) * 7 - 1),
    }),
    'adequate',
  );
  verify(
    `${c.goal}-fractional-declared-base`,
    firstRaceProfile(c, {
      weeklyKm: c.weeklyKm + 0.6,
      longestKm: c.longestKm + 0.4,
    }),
    'adequate',
  );
  verify(
    `${c.goal}-long-cap-preparation-gap`,
    firstRaceProfile(c, {
      longMinutes: Math.max(30, Math.ceil(c.longestKm * 7 + 2)),
    }),
    'review',
  );
  verify(
    `${c.goal}-maintain-preparation-gap`,
    firstRaceProfile(c, { volume: 'maintain' }),
    'review',
  );
  verify(
    `${c.goal}-impossible-support-baseline`,
    firstRaceProfile(c, { weeklyKm: c.longestKm * (c.runs + 1) }),
    'reject',
  );
  if (c.goal === 'half') {
    verify(
      'half-four-days',
      firstRaceProfile(c, { currentRuns: 4, days: [0, 2, 4, 6] }),
      'adequate',
    );
    verify(
      'half-30-weekly-20-long',
      firstRaceProfile(c, { weeklyKm: 30, longestKm: 20 }),
      'adequate',
    );
  }
  const example = makePlan(firstRaceProfile(c), '2026-09-28');
  const weekRows = summarize(example);
  const lines = [
    `# Beginner ${c.goal}: day-by-day example`,
    '',
    `Synthetic input: ${c.weeklyKm} km/week, ${c.longestKm} km recent long run, ${c.runs} current/planned runs, ${c.weeks} weeks. No speed sessions. Easy pace 7 min/km is a scheduling estimate.`,
    '',
    `Assessment: ${example.feasibility.status}. ${example.feasibility.reasons.join(' ')}`,
    '',
    '## Weekly progression',
    '',
    '| Week | Phase | Training km | Long km | Runs | Speed workouts |',
    '|---|---|---:|---:|---:|---:|',
    ...weekRows.map(
      (w) =>
        `|${w.week}|${w.phase}|${w.km}|${w.longKm}|${w.runs}|${w.speedWorkouts}|`,
    ),
    '',
    '## Every day',
    '',
    '| Date | Session | Prescription | Planning minutes |',
    '|---|---|---|---:|',
  ];
  for (
    let d = example.profile.startDate;
    d <= example.profile.raceDate;
    d = addDays(d, 1)
  ) {
    const w = example.workouts.find((w) => w.date === d);
    lines.push(
      w
        ? `|${d}|${w.title}|${w.steps.map((s) => `${s.metres ? `${s.metres / 1000} km` : `${s.seconds / 60} min`} ${s.effort}`).join('; ')}|${Number(w.minutes.toFixed(2))}|`
        : `|${d}|Rest|No prescribed run|—|`,
    );
  }
  lines.push(
    '',
    'This is an authored Stride forecast informed by published beginner programmes, not a copied coach schedule or proof of individual readiness. See [research](../../../research/beginner-distance-plans.md).',
  );
  await writeFile(
    new URL(`${c.goal}-day-by-day.md`, out),
    lines.join('\n') + '\n',
  );
}
const hash = createHash('sha256');
async function hashDir(dir) {
  for (const entry of (await readdir(dir, { withFileTypes: true })).sort(
    (a, b) => a.name.localeCompare(b.name),
  )) {
    const path = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
    if (entry.isDirectory()) await hashDir(path);
    else if (entry.name.endsWith('.ts')) {
      hash.update(path.pathname.split('/lib/')[1]);
      hash.update(await readFile(path));
    }
  }
}
await hashDir(new URL('../lib/', import.meta.url));
const summary = {
  generatedAt: new Date().toISOString(),
  libSha256: hash.digest('hex'),
  cases: rows.length + failures.length,
  adequate: rows.filter((r) => r.result === 'adequate').length,
  foundation: rows.filter((r) => r.result === 'foundation').length,
  preparationGap: rows.filter((r) => r.result === 'review').length,
  expectedRejections: rows.filter((r) => r.result === 'correctly-rejected')
    .length,
  failures: failures.length,
};
await writeFile(
  new URL('matrix.json', out),
  JSON.stringify({ summary, rows, failures }, null, 2) + '\n',
);
await writeFile(
  new URL('README.md', out),
  `# Beginner distance verification\n\n${JSON.stringify(summary, null, 2)}\n\nEvery scenario has an explicit expected outcome. An unexpected PlanError fails; a structurally valid plan with inadequate preparation fails if adequacy was expected. Foundation, preparation gaps and expected rejection are separate outcomes. Adequate means the authored training criteria are met by the forecast, not observed personal readiness.\n\nExamples include every rest day and run: [5K](5k-day-by-day.md), [10K](10k-day-by-day.md), [half](half-day-by-day.md), [marathon](marathon-day-by-day.md).\n`,
);
console.log(JSON.stringify(summary));
if (failures.length) {
  console.error(JSON.stringify(failures.slice(0, 8), null, 2));
  process.exitCode = 1;
}

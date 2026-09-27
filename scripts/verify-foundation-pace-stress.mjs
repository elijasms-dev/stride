/** Independent admission and executable-prescription oracles. Synthetic inputs.
 * node --experimental-strip-types scripts/verify-foundation-pace-stress.mjs [run-label]
 * Every run writes a new directory; historical evidence is never overwritten. */
import assert from 'node:assert/strict';
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  existsSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import {
  makePlan,
  validatePlan,
  addDays,
  dayDiff,
  weekday,
} from '../lib/engine.ts';
import { assessFeasibility } from '../lib/plan/feasibility.ts';
import {
  FIRST_RACE_CASES,
  firstRaceProfile,
} from '../tests/first-race-cases.mjs';

const label = process.argv[2] ?? new Date().toISOString().replace(/[:.]/g, '-');
assert.match(label, /^[a-zA-Z0-9_-]+$/);
const out = new URL(
  `../docs/verification/2026-09-25/all-distance-stress/foundation-${label}/`,
  import.meta.url,
);
assert.ok(!existsSync(out), 'Use a new run label; preserve previous evidence.');
mkdirSync(out, { recursive: true });
const cases = [];
const put = (id, profile, expected, reason, family) =>
  cases.push({ id, profile, expected, reason, family });
const goals = ['5k', '10k', 'half', 'marathon'];
const paces = [3, 4, 5.5, 7, 9, 10.5, 12, 15];
const entries = {
  '5k': [7.5, 2.5],
  '10k': [12, 5],
  half: [18, 6],
  marathon: [24, 10],
};
const screens = {
  '5k': [5, 10],
  '10k': [9, 16],
  half: [16, 28],
  marathon: [28, 48],
};
function foundation(goal, patch = {}) {
  const c = FIRST_RACE_CASES.find((c) => c.goal === goal);
  return firstRaceProfile(c, {
    weeklyKm: 0,
    longestKm: 0,
    currentRuns: 0,
    days: [0, 2, 4],
    longDay: 4,
    weekdayMinutes: 40,
    longMinutes: 60,
    easyPace: null,
    raceDate: '2027-03-14',
    ...patch,
  });
}
function separated(days) {
  return days.every((a, i) =>
    days
      .slice(i + 1)
      .every((b) => Math.min(Math.abs(a - b), 7 - Math.abs(a - b)) >= 2),
  );
}
function selections(days, n) {
  if (!n) return [[]];
  return days.flatMap((day, i) =>
    selections(days.slice(i + 1), n - 1).map((rest) => [day, ...rest]),
  );
}

// Full calendar/pace/format cross-product with enough time for the declared base.
for (const goal of goals)
  for (const origin of ['2026-09-28', '2028-02-21'])
    for (let offset = 0; offset < 7; offset++)
      for (const pace of [null, 3, 7, 15])
        for (const measure of ['time', 'distance'])
          for (const runs of [2, 3]) {
            const start = addDays(origin, offset);
            put(
              `zero-${goal}-${origin}-s${offset}-p${pace}-${measure}-r${runs}`,
              foundation(goal, {
                startDate: start,
                raceDate: addDays(start, 20 * 7 - 1),
                days: runs === 2 ? [0, 3] : [0, 2, 4],
                longDay: runs === 2 ? 3 : 4,
                easyPace: pace,
                runMeasure: measure,
              }),
              'foundation',
              'Zero running history uses held timed lessons, independent of pace or eventual race distance.',
              'foundation',
            );
          }
// All weekly availability masks: the oracle searches calendar separation itself.
for (let mask = 1; mask < 128; mask++)
  for (const runs of [2, 3]) {
    const available = Array.from({ length: 7 }, (_, i) => i).filter(
      (i) => mask & (1 << i),
    );
    const chosen = selections(available, runs).find(separated);
    const days = chosen ?? available.slice(0, runs);
    put(
      `zero-availability-${mask}-r${runs}`,
      foundation('5k', {
        availableDays: available,
        runsPerWeek: runs,
        days,
        longDay: days.at(-1) ?? 0,
      }),
      chosen ? 'foundation' : 'reject',
      'A whole rest day must separate every weekly lesson, including Sunday/Monday.',
      'foundation',
    );
  }
for (const goal of goals)
  for (const cap of [39, 40, 41])
    for (const runs of [2, 3])
      for (const startTime of ['23:19', '23:20', '23:21']) {
        const days = runs === 2 ? [0, 3] : [0, 2, 4];
        put(
          `zero-cap-${goal}-${cap}-${runs}-${startTime.replace(':', '')}`,
          foundation(goal, {
            days,
            longDay: days.at(-1),
            weekdayMinutes: cap,
            dayPreferences: days.map((day) => ({ day, startTime })),
          }),
          cap >= 40 && startTime <= '23:20' ? 'foundation' : 'reject',
          'Reserve the full 40-minute course and do not cross midnight.',
          'foundation',
        );
      }
for (const goal of goals)
  for (const [name, patch, expected] of [
    [
      'manual-target',
      {
        workoutTargets: {
          mode: 'pace',
          pace: { easy: { low: 360, high: 420 } },
        },
      },
      'foundation',
    ],
    [
      'valid-benchmark',
      { recentRace: { distanceKm: 5, timeMinutes: 30 } },
      'foundation',
    ],
    [
      'unsupported-benchmark',
      { recentRace: { distanceKm: 5, timeMinutes: 50 } },
      'foundation',
    ],
    ['weekly119', { weeklyMinutesLimit: 119 }, 'reject'],
    ['weekly120', { weeklyMinutesLimit: 120 }, 'foundation'],
    ['speed-request', { qualityMode: 'custom', qualitySessions: 1 }, 'reject'],
  ]) {
    if (typeof name !== 'string') throw new Error('Expected a case name.');
    put(
      `zero-${goal}-${name}`,
      foundation(goal, patch),
      expected,
      'Zero-history course capacity/effort contract.',
      'foundation',
    );
  }

for (const c of FIRST_RACE_CASES) {
  for (const origin of ['2026-09-28', '2028-02-21'])
    for (let startOffset = 0; startOffset < 7; startOffset++)
      for (let eventOffset = 0; eventOffset < 7; eventOffset++)
        for (const pace of paces)
          for (const measure of ['time', 'distance'])
            for (const scale of [1, 1.25]) {
              const start = addDays(origin, startOffset);
              const p = firstRaceProfile(c, {
                startDate: start,
                raceDate: addDays(start, (c.weeks + 6) * 7 - 1 + eventOffset),
                weeklyKm: c.weeklyKm * scale,
                longestKm: c.longestKm * scale,
                easyPace: pace,
                runMeasure: measure,
                weekdayMinutes: 120,
                longMinutes: 300,
              });
              const [long, week] = screens[c.goal];
              const capacity =
                Math.min(300 / pace, 45) + ((c.runs - 1) * 120) / pace;
              const enough = 300 / pace >= long && capacity >= week;
              const openingFits =
                p.longestKm * pace <= 300 &&
                (p.weeklyKm - p.longestKm) * pace <= (c.runs - 1) * 120;
              put(
                `first-${c.goal}-${origin}-s${startOffset}-e${eventOffset}-p${pace}-${measure}-base${scale}`,
                p,
                !openingFits ? 'reject' : enough ? 'forecast' : 'review',
                'Opening long and supporting runs must fit their own time caps; a long calendar is adequate only if capacity also funds the independently recorded preparation screens.',
                'first-race',
              );
            }
  for (const pace of [3, 5.5, 7, 9, 12, 15]) {
    const supportNeed = ((c.weeklyKm - c.longestKm) / (c.runs - 1)) * pace;
    for (const delta of [-1, 0, 1]) {
      const cap = Math.ceil(supportNeed) + delta;
      if (cap >= 20 && cap <= 120)
        put(
          `first-${c.goal}-weekday-boundary-p${pace}-d${delta}`,
          firstRaceProfile(c, { easyPace: pace, weekdayMinutes: cap }),
          cap >= supportNeed ? 'accept' : 'reject',
          'Declared supporting runs must fit without reducing the weekly baseline.',
          'first-race',
        );
      const longCap = Math.ceil(c.longestKm * pace) + delta;
      if (longCap >= 30 && longCap <= 300)
        put(
          `first-${c.goal}-long-boundary-p${pace}-d${delta}`,
          firstRaceProfile(c, { easyPace: pace, longMinutes: longCap }),
          longCap >= c.longestKm * pace ? 'accept' : 'reject',
          'Declared longest run must fit the long-session time cap.',
          'first-race',
        );
    }
  }
  for (const [name, patch, expected] of [
    [
      'entry-exact',
      { weeklyKm: entries[c.goal][0], longestKm: entries[c.goal][1] },
      'accept',
    ],
    [
      'weekly-below-entry',
      { weeklyKm: entries[c.goal][0] - 0.1, longestKm: entries[c.goal][1] },
      'reject',
    ],
    [
      'long-below-entry',
      { weeklyKm: entries[c.goal][0], longestKm: entries[c.goal][1] - 0.1 },
      'reject',
    ],
    ['short-calendar', { raceDate: '2026-10-11' }, 'review'],
    ['speed-request', { qualityMode: 'custom', qualitySessions: 1 }, 'reject'],
    ['pace-too-fast', { easyPace: 2.99 }, 'reject'],
    ['pace-too-slow', { easyPace: 15.01 }, 'reject'],
    [
      'manual-precedence',
      {
        easyPace: 15,
        workoutTargets: {
          mode: 'pace',
          pace: { easy: { low: 330, high: 360 } },
        },
      },
      'accept',
    ],
  ]) {
    if (typeof name !== 'string') throw new Error('Expected a case name.');
    put(
      `first-${c.goal}-${name}`,
      firstRaceProfile(c, patch),
      expected,
      'Explicit first-race admission or documented limitation.',
      'first-race',
    );
  }
}

const rows = [],
  failures = [];
const libSha256AtStart = libFingerprint();
let totalWorkouts = 0,
  totalWeeks = 0;
function inspect(p, c) {
  assert.deepEqual(validatePlan(p), []);
  assert.deepEqual(validatePlan(JSON.parse(JSON.stringify(p))), []);
  assert.equal(p.profile.weeklyKm, c.profile.weeklyKm);
  assert.equal(p.profile.longestKm, c.profile.longestKm);
  const runs = p.workouts.filter((w) => w.kind !== 'race');
  const dates = runs.map((w) => w.date).sort();
  const assessment = assessFeasibility(p, c.profile.startDate);
  for (const w of runs) {
    assert.ok(w.date >= c.profile.startDate && w.date <= c.profile.raceDate);
    assert.ok(p.profile.days.includes(weekday(w.date)));
    assert.equal(w.hard, false);
    assert.equal(w.qualityMinutes, 0);
    assert.ok(
      w.steps.every(
        (s) => Number.isFinite(s.seconds) && s.seconds > 0 && s.intensity <= 3,
      ),
    );
    assert.ok(
      Math.abs(w.minutes * 60 - w.steps.reduce((n, s) => n + s.seconds, 0)) <
        0.001,
    );
    assert.ok(
      w.minutes <=
        (w.kind === 'long' ? c.profile.longMinutes : c.profile.weekdayMinutes) +
          1 / 60,
    );
  }
  if (c.family === 'foundation') {
    assert.equal(p.beginner?.stage, 0);
    assert.equal(assessment.status, 'review-required');
    assert.ok(runs.length > 0);
    assert.ok(
      runs.every(
        (w) =>
          w.estimatedKm === 0 &&
          w.distanceEstimate?.lowerKm === null &&
          w.distanceEstimate?.upperKm === null,
      ),
      'Foundation lessons must not fabricate distances from retained pace settings.',
    );
    for (let i = 1; i < dates.length; i++)
      assert.ok(dayDiff(dates[i - 1], dates[i]) >= 2);
    assert.ok(
      runs.every(
        (w) =>
          w.steps[0].seconds === 300 &&
          w.steps.at(-1).seconds === 300 &&
          w.steps.every((s) => !s.target && s.metres === undefined),
      ),
    );
  } else {
    assert.equal(p.firstRace?.goal, c.profile.goal);
    const first = p.weeks.find(
      (week) =>
        week.start >= c.profile.startDate &&
        addDays(week.start, 6) < c.profile.raceDate &&
        week.phase === 'Foundation',
    );
    if (first) {
      const opening = runs.filter((w) => w.week === first.index);
      assert.ok(
        Math.abs(
          opening.reduce((n, w) => n + w.estimatedKm, 0) - c.profile.weeklyKm,
        ) < 0.012,
        'Declared opening weekly mileage changed.',
      );
      assert.equal(
        opening.find((w) => w.kind === 'long')?.estimatedKm,
        c.profile.longestKm,
      );
    }
    if (['forecast', 'review'].includes(c.expected))
      assert.equal(
        assessment.status,
        c.expected === 'forecast' ? 'forecast' : 'review-required',
        assessment.reasons.join(' '),
      );
    if (assessment.status === 'forecast') {
      const [long, week] = screens[c.profile.goal];
      assert.ok(
        Math.max(
          ...runs.filter((w) => w.kind === 'long').map((w) => w.estimatedKm),
        ) >=
          long - 0.2,
      );
      assert.ok(Math.max(...p.weeks.map((w) => w.targetKm)) >= week - 0.2);
    }
  }
  totalWorkouts += p.workouts.length;
  totalWeeks += p.weeks.length;
  return {
    status: assessment.status,
    peakKm: Math.max(...p.weeks.map((w) => w.targetKm)),
    peakLongKm: Math.max(
      0,
      ...runs.filter((w) => w.kind === 'long').map((w) => w.estimatedKm),
    ),
  };
}
for (const c of cases) {
  let p;
  try {
    p = makePlan(c.profile, c.profile.startDate, false);
  } catch (e) {
    if (c.expected === 'reject' && e.name === 'PlanError')
      rows.push({
        id: c.id,
        family: c.family,
        expected: c.expected,
        result: 'correct-rejection',
        reason: e.message,
      });
    else
      failures.push({ ...c, result: 'unexpected-rejection', error: e.message });
    continue;
  }
  try {
    assert.notEqual(
      c.expected,
      'reject',
      'Expected rejection but generated a plan.',
    );
    const summary = inspect(p, c);
    rows.push({
      id: c.id,
      family: c.family,
      expected: c.expected,
      result: 'pass',
      ...summary,
    });
  } catch (e) {
    failures.push({ ...c, result: 'failed-contract', error: e.message });
  }
}
function libFingerprint() {
  const hash = createHash('sha256');
  function hashDir(dir) {
    for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const url = new URL(e.name + (e.isDirectory() ? '/' : ''), dir);
      if (e.isDirectory()) hashDir(url);
      else if (e.name.endsWith('.ts')) {
        hash.update(url.pathname.split('/lib/')[1]);
        hash.update(readFileSync(url));
      }
    }
  }
  hashDir(new URL('../lib/', import.meta.url));
  return hash.digest('hex');
}
const libSha256 = libFingerprint();
const summary = {
  generatedAt: new Date().toISOString(),
  libSha256,
  libSha256AtStart,
  sourceStable: libSha256 === libSha256AtStart,
  cases: cases.length,
  accepted: rows.filter((r) => r.result === 'pass').length,
  correctRejections: rows.filter((r) => r.result === 'correct-rejection')
    .length,
  failures: failures.length,
  totalWeeks,
  totalWorkouts,
};
writeFileSync(
  new URL('matrix.json', out),
  JSON.stringify({ summary, rows, failures }, null, 2) + '\n',
);
writeFileSync(
  new URL('README.md', out),
  `# Foundation and first-race pace stress\n\n${JSON.stringify(summary, null, 2)}\n\nSynthetic software verification, not evidence of an individual's race readiness. Admission expectations are declared before generation; an arbitrary PlanError never counts as success. Covers every start/event weekday, leap-year/DST dates, pace3–15min/km, two baseline-mileage levels, time/distance formats, all127 weekly availability masks, exact cap/midnight boundaries and explicit unsupported requests. The forecast screens are independent recorded Stride policy values, not universal physiological thresholds.\n\nReproduce: \`node --experimental-strip-types scripts/verify-foundation-pace-stress.mjs NEW_RUN_LABEL\`. Historical evidence is retained.\n`,
);
console.log(JSON.stringify(summary));
if (failures.length) {
  console.error(JSON.stringify(failures.slice(0, 8), null, 2));
  process.exitCode = 1;
}

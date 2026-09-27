/** Independent zero-history 5K verification. Synthetic inputs only.
 * Reproduce the admission, scheduling, evidence and integration matrix:
 * npm run verify:beginner -- [--matrix|--sequences|--all]
 * Completion simulation uses explicit synthetic feedback fixtures, matching existing
 * engine integration tests. It does not exercise the authenticated API route. */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import {
  makePlan,
  validatePlan,
  noviceReview,
  advanceRunWalk,
  revisePreferences,
  refreshWorkoutVariety,
  moveWorkout,
} from '../lib/engine.ts';
import { updateRunMeasure } from '../lib/run-distance.ts';
import { validateRecovery } from '../lib/recovery.ts';
const ROOT = fileURLToPath(new URL('../', import.meta.url)).replace(/\/$/, '');
const destination = ROOT + '/docs/verification/2026-09-24/beginner-course';
mkdirSync(destination, { recursive: true });
const START = '2026-09-21';
const after = (d, n) =>
  new Date(Date.parse(d + 'T12:00:00Z') + n * 86400000)
    .toISOString()
    .slice(0, 10);
const gap = (a, b) =>
  Math.round(
    (Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000,
  );
const wd = (d) => (new Date(d + 'T12:00:00Z').getUTCDay() + 6) % 7;
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const assert = (v, m) => {
  if (!v) throw new Error(m);
};
const daysFor = (mask) =>
  Array.from({ length: 7 }, (_, i) => i).filter((i) => mask & (1 << i));
function subsets(values, k) {
  if (k === 0) return [[]];
  return values.flatMap((d, i) =>
    subsets(values.slice(i + 1), k - 1).map((t) => [d, ...t]),
  );
}
function separated(days) {
  const sorted = [...days].sort((a, b) => a - b);
  return sorted.every(
    (d, i) => (sorted[(i + 1) % sorted.length] - d + 7) % 7 >= 2,
  );
}
function selection(mask, runs) {
  return subsets(daysFor(mask), runs).find(separated);
}
function input({
  mask = 127,
  runs = 3,
  offset = 0,
  weeks = 9,
  choice = 'automatic',
  pace = null,
  patch = {},
} = {}) {
  const available = daysFor(mask),
    chosen = selection(mask, runs) ?? available.slice(0, runs),
    startDate = after(START, offset);
  return {
    name: 'Synthetic zero-history 5K',
    goal: '5k',
    raceName: 'First 5K',
    startDate,
    raceDate: after(startDate, weeks * 7 - 1),
    weeklyKm: 0,
    longestKm: 0,
    currentRuns: 0,
    experience: 'new',
    days: chosen,
    availableDays: available,
    runsPerWeek: runs,
    longDay: chosen.at(-1) ?? available.at(-1) ?? 6,
    weekdayMinutes: 40,
    longMinutes: 60,
    easyPace: pace,
    difficulty: 'balanced',
    intent: 'finish',
    volume: 'gradual',
    timezone: 'Europe/Dublin',
    units: 'km',
    qualityMode:
      choice === 'default'
        ? undefined
        : choice === 'automatic'
          ? 'automatic'
          : 'custom',
    qualitySessions:
      choice === 'default' ? undefined : choice === 'automatic' ? 2 : choice,
    recentQualitySessions: 0,
    recentQualityMinutes: 0,
    runMeasure: 'time',
    ...patch,
  };
}
function expectedAdmission(p) {
  if (p.recentRace !== undefined && p.recentRace !== null)
    return { accept: false, reason: 'malformed benchmark' };
  if (p.qualityMode === 'custom' && (p.qualitySessions ?? 0) > 0)
    return { accept: false, reason: 'positive beginner quality request' };
  if (![2, 3].includes(p.runsPerWeek))
    return { accept: false, reason: 'unsupported beginner running frequency' };
  if (
    p.availableDays.length < 2 ||
    !subsets(p.availableDays, p.runsPerWeek).some(separated)
  )
    return {
      accept: false,
      reason: 'no weekly schedule with a rest day between runs',
    };
  if (
    p.weekdayMinutes < 40 ||
    (p.weeklyMinutesLimit != null && p.weeklyMinutesLimit < 40 * p.runsPerWeek)
  )
    return { accept: false, reason: 'full-course time capacity' };
  return { accept: true, reason: 'supported beginner request' };
}
function inspect(plan, p, { stage = 0 } = {}) {
  const e = [],
    check = (v, m) => {
      if (!v) e.push(m);
    };
  check(
    plan.beginner?.program === 'nhs-c25k-v1',
    'dedicated beginner marker missing',
  );
  check(plan.beginner?.stage === stage, `expected held stage${stage}`);
  check(
    plan.profile.qualitySessions === 0,
    'beginner quality must resolve to zero',
  );
  check(
    plan.profile.weeklyKm === 0 &&
      plan.profile.longestKm === 0 &&
      plan.profile.currentRuns === 0,
    'zero baseline overwritten',
  );
  check(
    validatePlan(plan).length === 0,
    'validatePlan rejects generated beginner plan: ' +
      validatePlan(plan).join(';'),
  );
  check(
    validatePlan(JSON.parse(JSON.stringify(plan))).length === 0,
    'serialization loses beginner validity',
  );
  const upcoming = plan.workouts.filter(
    (w) =>
      w.status === 'planned' && w.date >= (plan.constraintsFrom ?? p.startDate),
  );
  const rows = [...upcoming].sort((a, b) => a.date.localeCompare(b.date));
  check(rows.length > 0, 'no executable beginner lessons');
  for (let i = 0; i < rows.length; i++) {
    const w = rows[i],
      b = w.beginnerLesson;
    check(w.kind === 'easy' && !w.hard, 'beginner lesson is hard/long/race');
    check(
      w.date >= p.startDate && w.date <= p.raceDate,
      'lesson outside user dates',
    );
    check(p.availableDays.includes(wd(w.date)), 'lesson on unavailable day');
    if (i)
      check(
        gap(rows[i - 1].date, w.date) >= 2,
        'adjacent beginner running days',
      );
    check(
      b?.stage === stage && [0, 1, 2].includes(b?.lesson),
      'incorrect lesson stage/identity',
    );
    check(
      b?.stageStarted === plan.beginner?.stageStarted,
      'lesson stage-start provenance changed',
    );
    check(w.steps.length >= 3, 'lesson missing warm/main/cool steps');
    check(
      w.steps[0]?.kind === 'warmup' &&
        w.steps[0]?.movement === 'walk' &&
        w.steps[0]?.seconds >= 300,
      'missing5-minute walking warm-up',
    );
    check(
      w.steps.at(-1)?.kind === 'cooldown' &&
        w.steps.at(-1)?.movement === 'walk' &&
        w.steps.at(-1)?.seconds >= 300,
      'missing5-minute walking cooldown',
    );
    check(
      w.steps.every(
        (s) =>
          Number.isFinite(s.seconds) && s.seconds > 0 && s.metres === undefined,
      ),
      'beginner steps must remain positive and timed',
    );
    check(
      w.steps.every((s) => s.intensity <= 3),
      'beginner intensity exceeds conversational running',
    );
    check(
      w.steps.every((s) => s.target === undefined),
      'untargeted beginner receives numeric pace/HR targets',
    );
    check(
      Math.abs(w.steps.reduce((n, s) => n + s.seconds, 0) - w.minutes * 60) <=
        1.01,
      'step totals disagree with session minutes',
    );
    check(
      w.minutes <= 40 + 1 / 60 && w.minutes <= p.weekdayMinutes + 1 / 60,
      'lesson exceeds course/session time limit',
    );
  }
  for (const week of plan.weeks) {
    const runs = rows.filter((w) => w.week === week.index);
    check(runs.length <= p.runsPerWeek, 'too many running days');
    if (week.start >= p.startDate && after(week.start, 6) <= p.raceDate)
      check(
        runs.length === p.runsPerWeek,
        'missing selected run in complete beginner week',
      );
  }
  return [...new Set(e)];
}
function matrixCases() {
  const result = [],
    seen = new Set();
  const put = (id, p) => {
    const key = JSON.stringify(p);
    if (seen.has(key)) return;
    seen.add(key);
    result.push({ id, input: p, ...expectedAdmission(p) });
  };
  for (let mask = 1; mask < 128; mask++)
    for (const runs of [2, 3, 4])
      for (let offset = 0; offset < 7; offset++)
        put(
          `schedule-mask${mask}-r${runs}-start${offset}`,
          input({ mask, runs, offset }),
        );
  for (let mask = 1; mask < 128; mask++)
    for (const weeks of [3, 9, 14, 16])
      for (const [i, choice] of ['automatic', 0, 1, 2].entries())
        put(
          `calendar-mask${mask}-${weeks}w-q${choice}`,
          input({
            mask,
            runs: 2 + (mask % 2),
            offset: (mask + weeks + i) % 7,
            weeks,
            choice,
            pace: [null, 6, 10][(mask + weeks + i) % 3],
          }),
        );
  for (const runs of [2, 3])
    for (const pace of [null, 6, 10])
      for (const [label, patch] of [
        ['cap39', { weekdayMinutes: 39 }],
        ['cap40', { weekdayMinutes: 40 }],
        ['weeklyshort', { weeklyMinutesLimit: 40 * runs - 1 }],
        ['weeklyexact', { weeklyMinutesLimit: 40 * runs }],
        ['longcap30', { longMinutes: 30 }],
        ['null-benchmark', { recentRace: null }],
        ['empty-benchmark', { recentRace: {} }],
        ['zero-benchmark', { recentRace: { distanceKm: 0, timeMinutes: 0 } }],
      ])
        put(`${label}-r${runs}-pace${pace}`, input({ runs, pace, patch }));
  for (const runs of [2, 3])
    put(`default-quality-r${runs}`, input({ runs, choice: 'default' }));
  return result;
}
const output = {
  generatedAt: new Date().toISOString(),
  scope:
    'Independent engine/review integration. Synthetic feedback fixtures; not authenticated HTTP API coverage.',
  matrix: null,
  sequences: [],
  reviewChecks: [],
  operations: [],
};
function runMatrix() {
  const results = [],
    examples = [];
  let totalWeeks = 0,
    totalRuns = 0;
  for (const c of matrixCases()) {
    let plan;
    try {
      plan = makePlan(c.input, c.input.startDate, false);
    } catch (error) {
      results.push({
        id: c.id,
        expected: c.reason,
        status:
          !c.accept && error.name === 'PlanError'
            ? 'correctly-rejected'
            : 'failed',
        errorName: error.name,
        error: error.message,
        input: c.input,
      });
      continue;
    }
    const errors = inspect(plan, c.input);
    if (!c.accept) errors.push('unsupported input was accepted: ' + c.reason);
    totalWeeks += plan.weeks.length;
    totalRuns += plan.workouts.length;
    results.push({
      id: c.id,
      expected: c.reason,
      status: errors.length ? 'failed' : 'accepted',
      errors,
      input: c.input,
    });
    if (examples.length < 4 && c.accept && c.input.availableDays.length === 7)
      examples.push({ id: c.id, plan });
  }
  output.matrix = {
    cases: results.length,
    accepted: results.filter((x) => x.status === 'accepted').length,
    correctlyRejected: results.filter((x) => x.status === 'correctly-rejected')
      .length,
    failed: results.filter((x) => x.status === 'failed').length,
    totalWeeks,
    totalRuns,
    results,
    examples,
  };
}
function completed(w, patch = {}) {
  w.status = 'completed';
  w.feedback = {
    actualDate: w.date,
    actualMinutes: w.minutes,
    actualKm: null,
    effort: 3,
    feeling: 'good',
    execution: 'as-planned',
    note: 'Synthetic beginner lesson completion',
    recordedAt: w.date + 'T18:00:00Z',
    ...patch,
  };
}
function fullRecipeSnapshot(plan) {
  return plan.workouts.map((w) => ({
    id: w.id,
    date: w.date,
    status: w.status,
    steps: w.steps,
    beginnerLesson: w.beginnerLesson,
    feedback: w.feedback,
  }));
}
function sequence(runs, weeks) {
  const p = input({ runs, weeks, mask: runs === 3 ? 21 : 34 });
  let plan = makePlan(p, p.startDate, false);
  const daily = [],
    transitions = [],
    errors = [];
  for (let d = 0; d < weeks * 7; d++) {
    const date = after(p.startDate, d),
      review = noviceReview(plan, date),
      stage = plan.beginner?.stage;
    if (review?.ready && !plan.beginner?.completedAt) {
      const saved = JSON.stringify(
        plan.workouts.filter((w) => w.status === 'completed'),
      );
      const before = structuredClone(plan);
      let next;
      try {
        next = advanceRunWalk(plan, date);
      } catch (error) {
        errors.push(`advance on ${date}: ${error.message}`);
        break;
      }
      if (!eq(plan, before)) errors.push('advance mutated input');
      if (
        JSON.stringify(
          next.workouts.filter((w) => w.status === 'completed'),
        ) !== saved
      )
        errors.push('advance changed completed history');
      if (next.beginner?.stage !== Math.min(8, stage + 1))
        errors.push('advance did not move exactly one stage');
      if (stage === 8 && !next.beginner?.completedAt)
        errors.push('final milestone was not recorded');
      transitions.push({ date, from: stage, to: next.beginner?.stage });
      plan = next;
      if (noviceReview(plan, date)?.ready)
        errors.push('same logs immediately unlock another stage');
    }
    if (plan.beginner?.completedAt) break;
    const sessions = plan.workouts.filter(
      (w) => w.status === 'planned' && w.date === date,
    );
    daily.push({
      date,
      stage: plan.beginner?.stage,
      runs: sessions.map((w) => ({
        id: w.id,
        kind: w.kind,
        minutes: w.minutes,
        beginnerLesson: w.beginnerLesson,
        steps: w.steps,
      })),
    });
    sessions.forEach((w) => completed(w));
    const validation = validatePlan(plan);
    if (validation.length) {
      errors.push(`after ${date}: ${validation.join(';')}`);
      break;
    }
  }
  if (!plan.beginner?.completedAt) {
    const asOf = after(p.startDate, weeks * 7);
    if (noviceReview(plan, asOf)?.ready) plan = advanceRunWalk(plan, asOf);
  }
  if (!plan.beginner?.completedAt)
    errors.push(
      'final milestone was not reviewable within the horizon plus one day',
    );
  if (plan.beginner?.stage !== 8)
    errors.push(
      `expected final course stage8 after${weeks}weeks, got${plan.beginner?.stage}`,
    );
  const final = plan.workouts.filter(
    (w) => w.status === 'completed' && w.beginnerLesson?.stage === 8,
  );
  if (new Set(final.map((w) => w.beginnerLesson.lesson)).size !== 3)
    errors.push('did not complete3distinct final-stage lessons');
  if (
    final.some(
      (w) => !w.steps.some((s) => s.movement === 'run' && s.seconds >= 1800),
    )
  )
    errors.push('final-stage lesson lacks30-minute continuous run');
  output.sequences.push({
    id: `${runs}days-${weeks}weeks`,
    completedAt: plan.beginner?.completedAt,
    elapsedDays: plan.beginner?.completedAt
      ? gap(p.startDate, plan.beginner.completedAt)
      : null,
    completedLessonCount: plan.workouts.filter((w) => w.status === 'completed')
      .length,
    status: errors.length ? 'failed' : 'passed',
    errors,
    transitions,
    daily,
    finalPlan: plan,
  });
}
function check(name, fn) {
  try {
    fn();
    output.reviewChecks.push({ name, status: 'passed' });
  } catch (error) {
    output.reviewChecks.push({ name, status: 'failed', error: error.message });
  }
}
function readyFixture(patch = {}) {
  const p = input({ mask: 21, runs: 3, weeks: 16, ...patch }),
    plan = makePlan(p, p.startDate, false);
  plan.workouts.slice(0, 3).forEach((w) => completed(w));
  return { p, plan, asOf: after(p.startDate, 7) };
}
function reviewCases() {
  check('three distinct comfortable lessons allow one stage advance', () => {
    const { plan, asOf } = readyFixture();
    assert(
      noviceReview(plan, asOf)?.ready,
      'three confirmed lessons not eligible',
    );
  });
  for (const [name, change] of [
    [
      'two lessons only',
      (p) => {
        p.workouts[2].status = 'planned';
        delete p.workouts[2].feedback;
      },
    ],
    [
      'unknown execution',
      (p) => {
        p.workouts[2].feedback.execution = 'unknown';
      },
    ],
    [
      'partial execution',
      (p) => {
        p.workouts[2].feedback.execution = 'partial';
      },
    ],
    [
      'same lesson repeated',
      (p) => {
        p.workouts.slice(0, 3).forEach((w) => (w.beginnerLesson.lesson = 0));
      },
    ],
    [
      'same actual day',
      (p) => {
        p.workouts
          .slice(0, 3)
          .forEach((w) => (w.feedback.actualDate = p.workouts[0].date));
      },
    ],
    [
      'tired feedback',
      (p) => {
        p.workouts[2].feedback.feeling = 'tired';
      },
    ],
    [
      'duplicate provider activity',
      (p) => {
        p.workouts
          .slice(0, 3)
          .forEach((w) => (w.feedback.activityId = 'same-synthetic-recording'));
      },
    ],
    [
      'wrong stage',
      (p) => {
        p.workouts[2].beginnerLesson.stage = 1;
      },
    ],
    [
      'wrong stage start',
      (p) => {
        p.workouts[2].beginnerLesson.stageStarted = after(
          p.profile.startDate,
          -7,
        );
      },
    ],
    [
      'short actual outing',
      (p) => {
        p.workouts[2].feedback.actualMinutes = 5;
      },
    ],
  ])
    check(`${name} cannot advance`, () => {
      const { plan, asOf } = readyFixture();
      change(plan);
      assert(
        !noviceReview(plan, asOf)?.ready,
        'incomplete evidence marked ready',
      );
      let rejected = false;
      try {
        advanceRunWalk(plan, asOf);
      } catch (e) {
        assert(e.name === 'PlanError', 'uncontrolled advance error');
        rejected = true;
      }
      assert(rejected, 'advance accepted incomplete evidence');
    });
  check('calendar passing without logs cannot advance', () => {
    const p = input({ weeks: 16 }),
      plan = makePlan(p, p.startDate, false);
    assert(
      !noviceReview(plan, after(p.startDate, 70))?.ready,
      'elapsed weeks fabricate readiness',
    );
    assert(plan.beginner.stage === 0, 'forecast changes stage');
  });
  check('minimum seven days cannot be bypassed by three lessons', () => {
    const { plan } = readyFixture();
    assert(
      !noviceReview(plan, after(plan.profile.startDate, 6))?.ready,
      'advanced before7days',
    );
  });
  check(
    'shortened lesson cannot certify its full unshortened course requirement',
    () => {
      const { plan, asOf } = readyFixture();
      const victim = plan.workouts[2];
      victim.steps = victim.steps.map((s, i) =>
        s.movement === 'run' ? { ...s, seconds: 1 } : s,
      );
      victim.minutes = victim.steps.reduce((n, s) => n + s.seconds, 0) / 60;
      victim.feedback.actualMinutes = victim.minutes;
      assert(
        !noviceReview(plan, asOf)?.ready,
        'modified tiny running bouts certify full lesson',
      );
    },
  );
}
function operation(name, fn) {
  try {
    fn();
    output.operations.push({ name, status: 'passed' });
  } catch (error) {
    output.operations.push({ name, status: 'failed', error: error.message });
  }
}
function operations() {
  operation('JSON recovery retains beginner provenance', () => {
    const { plan } = readyFixture({ offset: -14 });
    const restored = validateRecovery(
      JSON.parse(
        JSON.stringify({
          format: 'stride-recovery-2',
          exportedAt: after(START, 7) + 'T18:00:00Z',
          profile: null,
          plan,
        }),
      ),
    ).plan;
    assert(eq(restored.beginner, plan.beginner), 'course state lost');
    assert(
      eq(
        restored.workouts.map((w) => w.beginnerLesson),
        plan.workouts.map((w) => w.beginnerLesson),
      ),
      'lesson provenance lost',
    );
  });
  operation('workout variety cannot replace course lessons', () => {
    const p = input({ weeks: 16 }),
      plan = makePlan(p, p.startDate, false);
    const next = refreshWorkoutVariety(plan, p.startDate);
    assert(
      eq(fullRecipeSnapshot(plan), fullRecipeSnapshot(next)),
      'variety replaced a course recipe',
    );
  });
  operation('distance preference keeps timed beginner lessons', () => {
    const p = input({ weeks: 16 }),
      plan = makePlan(p, p.startDate, false);
    const next = updateRunMeasure(plan, 'distance', p.startDate);
    assert(
      eq(
        plan.workouts.map((w) => w.steps),
        next.workouts.map((w) => w.steps),
      ),
      'distance measure changed timed lessons',
    );
    assert(eq(next.beginner, plan.beginner), 'measurement loses stage');
  });
  operation('ordinary unrelated preference retains course state', () => {
    const { plan, asOf } = readyFixture();
    const next = revisePreferences(plan, { workoutVariety: 'familiar' }, asOf);
    assert(
      eq(next.beginner, plan.beginner),
      'unrelated preference changes course',
    );
    assert(
      eq(
        next.workouts.filter((w) => w.status === 'completed'),
        plan.workouts.filter((w) => w.status === 'completed'),
      ),
      'unrelated preference changes history',
    );
  });
  operation('moving between adjacent beginner runs rejects', () => {
    const p = input({ mask: 21, weeks: 16 }),
      plan = makePlan(p, p.startDate, false),
      w = plan.workouts[0];
    let rejected = false;
    try {
      moveWorkout(plan, w.id, after(w.date, 1), p.startDate);
    } catch (e) {
      assert(e.name === 'PlanError', 'uncontrolled move error');
      rejected = true;
    }
    assert(rejected, 'adjacent beginner runs accepted');
  });
}
const option = process.argv[2] ?? '--all';
if (!['--all', '--matrix', '--sequences'].includes(option))
  throw new Error('Use --all, --matrix or --sequences');
const hash = createHash('sha256');
function digest(path) {
  for (const e of readdirSync(path, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const p = path + '/' + e.name;
    if (e.isDirectory()) digest(p);
    else if (/\.tsx?$/.test(e.name)) {
      hash.update(p.slice(ROOT.length));
      hash.update(readFileSync(p));
    }
  }
}
digest(ROOT + '/lib');
output.sourceSha256 = hash.digest('hex');
if (option !== '--sequences') runMatrix();
if (option !== '--matrix') {
  sequence(3, 9);
  sequence(2, 14);
  reviewCases();
  operations();
}
const path = destination + '/matrix.json';
writeFileSync(path, JSON.stringify(output, null, 2));
console.log(
  JSON.stringify(
    {
      generatedAt: output.generatedAt,
      sourceSha256: output.sourceSha256,
      matrix: output.matrix && {
        ...output.matrix,
        results: undefined,
        examples: undefined,
      },
      sequences: output.sequences.map(
        ({
          id,
          status,
          errors,
          transitions,
          completedAt,
          elapsedDays,
          completedLessonCount,
        }) => ({
          id,
          status,
          errors,
          transitions,
          completedAt,
          elapsedDays,
          completedLessonCount,
        }),
      ),
      reviewChecks: output.reviewChecks,
      operations: output.operations,
      result: path,
    },
    null,
    2,
  ),
);
if (
  (output.matrix?.failed ?? 0) +
  [...output.sequences, ...output.reviewChecks, ...output.operations].filter(
    (x) => x.status === 'failed',
  ).length
)
  process.exitCode = 1;

const sweep = [];
for (const runs of [2, 3])
  for (const pattern of subsets([0, 1, 2, 3, 4, 5, 6], runs).filter(separated))
    for (let offset = 0; offset < 7; offset++) {
      const p = input({
        runs,
        mask: pattern.reduce((n, d) => n + (1 << d), 0),
        offset,
        weeks: 16,
      });
      let plan = makePlan(p, p.startDate, false);
      const errors = [],
        transitions = [];
      for (let d = 0; d <= 16 * 7; d++) {
        const date = after(p.startDate, d),
          review = noviceReview(plan, date);
        if (review?.ready) {
          const stage = plan.beginner.stage;
          plan = advanceRunWalk(plan, date);
          transitions.push({ date, from: stage, to: plan.beginner.stage });
        }
        if (plan.beginner.completedAt) break;
        plan.workouts
          .filter((w) => w.status === 'planned' && w.date === date)
          .forEach((w) => completed(w));
        const validation = validatePlan(plan);
        if (validation.length) {
          errors.push(...validation);
          break;
        }
      }
      const done = plan.workouts.filter((w) => w.status === 'completed');
      if (!plan.beginner.completedAt) errors.push('not completed by16weeks');
      if (done.length !== 27)
        errors.push('extra or missing executed course lesson');
      const elapsed = plan.beginner.completedAt
        ? gap(p.startDate, plan.beginner.completedAt)
        : null;
      if (elapsed > (runs === 2 ? 98 : 63))
        errors.push(
          `exceeded${runs === 2 ? 14 : 9}weeks with perfect daily review`,
        );
      sweep.push({
        runs,
        pattern,
        start: p.startDate,
        elapsedDays: elapsed,
        completedAt: plan.beginner.completedAt,
        lessons: done.length,
        status: errors.length ? 'failed' : 'passed',
        errors,
        transitions,
      });
    }

writeFileSync(
  destination + '/completion-patterns.json',
  JSON.stringify(sweep, null, 2),
);
console.log(
  JSON.stringify(
    {
      completionPatterns: sweep.length,
      failed: sweep.filter((x) => x.status === 'failed').length,
    },
    null,
    2,
  ),
);
if (sweep.some((x) => x.status === 'failed')) process.exitCode = 1;

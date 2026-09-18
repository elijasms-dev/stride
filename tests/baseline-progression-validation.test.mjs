import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  demoProfile,
  ENGINE_VERSION,
  TRAINING_POLICY,
  validatePlan,
} from '../lib/engine.ts';

const start = '2026-09-21';
const baselineError = /first complete training week/;
const wholeError = /whole-kilometre/;
const declineError = /reduces the long run outside/;

// Independently authored prescriptions isolate validation from generation and
// prevent a generator and its validator from agreeing on the same bad output.
function planFixture({
  longs = [20, 21],
  totals = [30, 31],
  phases = [],
  profile = {},
} = {}) {
  const plan = {
    id: 'baseline-validation-fixture',
    createdAt: start,
    engineVersion: ENGINE_VERSION,
    policyVersion: TRAINING_POLICY.version,
    profile: {
      ...demoProfile(start),
      goal: 'half',
      startDate: start,
      raceDate: addDays(start, 111),
      weeklyKm: 30,
      longestKm: longs[0],
      days: [0, 2, 4, 6],
      currentRuns: 4,
      longDay: 6,
      easyPace: 6,
      weekdayMinutes: 90,
      longMinutes: 180,
      runMeasure: 'time',
      qualityMode: 'custom',
      qualitySessions: 0,
      ...profile,
    },
    weeks: [],
    workouts: [],
    notes: [],
  };
  for (const [week, longKm] of longs.entries()) {
    const total = totals[week] ?? longKm + 10;
    const weekStart = addDays(start, week * 7);
    plan.weeks.push({
      index: week,
      start: weekStart,
      phase: phases[week] ?? 'Build',
      targetKm: total,
      longKm,
      focus: '',
    });
    for (const [i, day] of [0, 2, 4, 6].entries()) {
      const km = day === 6 ? longKm : (total - longKm) / 3;
      const minutes = km * 6;
      const date = addDays(weekStart, day);
      plan.workouts.push({
        id: `week-${week}-run-${i}`,
        date,
        originalDate: date,
        week,
        title: day === 6 ? 'Long run' : 'Easy run',
        kind: day === 6 ? 'long' : 'easy',
        estimatedKm: km,
        minutes,
        steps: [{ label: 'Run', seconds: minutes * 60, intensity: 2 }],
        hard: false,
        status: 'planned',
        purpose: '',
        reason: '',
      });
    }
  }
  return plan;
}

const long = (plan, week) =>
  plan.workouts.find((w) => w.week === week && w.kind === 'long');
const onlyNewErrors = (plan) =>
  validatePlan(plan).filter(
    (error) =>
      baselineError.test(error) ||
      wholeError.test(error) ||
      declineError.test(error),
  );

void test('new-policy validation accepts an exact 30 km week with its familiar 20 km long run', () => {
  assert.deepEqual(validatePlan(planFixture()), []);
  assert.deepEqual(validatePlan(JSON.parse(JSON.stringify(planFixture()))), []);
});

void test('fresh generated plans cannot inflate or reduce the declared opening weekly distance', () => {
  for (const total of [29.9, 44]) {
    const errors = validatePlan(planFixture({ totals: [total, 31] }));
    assert.ok(errors.some((error) => /declared weekly distance/.test(error)));
  }
});

void test('the opening long run must match the declared baseline even when weekly distance matches', () => {
  const plan = planFixture({ longs: [19, 21], profile: { longestKm: 20 } });
  assert.ok(
    validatePlan(plan).some((error) =>
      /declared long-run distance/.test(error),
    ),
  );
});

void test('the start-date constraints marker still validates a fresh opening baseline', () => {
  const plan = planFixture({ totals: [44, 31] });
  plan.constraintsFrom = start;
  assert.ok(
    validatePlan(plan).some((error) => /declared weekly distance/.test(error)),
  );
});

void test('fractional user input is an exact opening anchor, then subsequent ordinary runs use whole kilometres', () => {
  assert.deepEqual(validatePlan(planFixture({ longs: [16.5, 17] })), []);
  const invalid = planFixture({ longs: [16.5, 17.5] });
  assert.ok(validatePlan(invalid).some((error) => wholeError.test(error)));
});

void test('a fractional baseline may hold only when the next whole kilometre exceeds a hard cap', () => {
  const allowed = planFixture({
    longs: [16.5, 16.5],
    profile: { longLimitKm: 16.5 },
  });
  assert.deepEqual(validatePlan(allowed), []);
  const uncapped = planFixture({ longs: [16.5, 16.5] });
  assert.ok(validatePlan(uncapped).some((error) => wholeError.test(error)));
  const differentFraction = planFixture({
    longs: [16.5, 16.4],
    profile: { longLimitKm: 16.5 },
  });
  assert.ok(
    validatePlan(differentFraction).some((error) => wholeError.test(error)),
  );
});

void test('session and selected-day ceilings can retain a fractional baseline without an unfunded increase', () => {
  for (const profile of [
    { longMinutes: 99 },
    { dayPreferences: [{ day: 6, maxMinutes: 99 }] },
  ])
    assert.deepEqual(
      validatePlan(planFixture({ longs: [16.5, 16.5], profile })),
      [],
    );
});

void test('ordinary long runs cannot regress even across a designated recovery week', () => {
  const valid = planFixture({
    longs: [20, 16, 21],
    phases: ['Build', 'Recovery', 'Build'],
  });
  assert.deepEqual(validatePlan(valid), []);
  const invalid = planFixture({
    longs: [20, 16, 19],
    phases: ['Build', 'Recovery', 'Build'],
  });
  assert.ok(validatePlan(invalid).some((error) => declineError.test(error)));
});

void test('recovery, taper and race-week long runs may reduce without ordinary-progression errors', () => {
  for (const phase of ['Recovery', 'Taper', 'Race week']) {
    const plan = planFixture({ longs: [20, 16.5], phases: ['Build', phase] });
    assert.deepEqual(validatePlan(plan), []);
  }
});

void test('daily taper context permits a reduced long run before the week receives its taper label', () => {
  const plan = planFixture({
    longs: [20, 16.5],
    profile: { raceDate: addDays(start, 20) },
  });
  assert.deepEqual(validatePlan(plan), []);
});

void test('older saved policy plans retain their existing validation semantics', () => {
  const plan = planFixture({ longs: [20, 19.5], totals: [44, 31] });
  plan.policyVersion = 'provisional-2026-09-11-v30';
  assert.deepEqual(validatePlan(plan), []);
});

void test('a partial first calendar week is not required to contain the full weekly baseline', () => {
  const plan = planFixture({ profile: { startDate: addDays(start, 2) } });
  plan.workouts = plan.workouts.filter((w) => w.date >= plan.profile.startDate);
  plan.weeks[0].targetKm = plan.workouts
    .filter((w) => w.week === 0)
    .reduce((sum, w) => sum + w.estimatedKm, 0);
  assert.deepEqual(validatePlan(plan), []);
});

void test('recorded history, changed opening workouts and later review dates do not reimpose a fresh baseline', () => {
  for (const mode of ['history', 'manual', 'completed', 'review']) {
    const plan = planFixture({ totals: [29, 31] });
    if (mode === 'history')
      plan.baselineEvidence = { source: 'recorded-plan-history' };
    if (mode === 'manual') plan.workouts[0].changed = true;
    if (mode === 'completed') plan.workouts[0].status = 'completed';
    if (mode === 'review') plan.constraintsFrom = addDays(start, 2);
    assert.deepEqual(onlyNewErrors(plan), [], mode);
  }
});

void test('historical, manual and return long runs are omitted from ordinary generated progression', () => {
  for (const mode of ['completed', 'manual', 'return']) {
    const plan = planFixture({ longs: [20, 18.5] });
    const session = long(plan, 1);
    if (mode === 'completed') session.status = 'completed';
    if (mode === 'manual')
      Object.assign(session, { changed: true, changeSource: 'manual' });
    if (mode === 'return') session.returnRole = 'long';
    assert.deepEqual(onlyNewErrors(plan), [], mode);
  }
});

void test('logging an opening easy run does not invalidate its existing fractional long-run baseline', () => {
  const plan = planFixture({ longs: [16.5, 17] });
  plan.workouts[0].status = 'completed';
  assert.deepEqual(validatePlan(plan), []);
});

void test('a closing partial week cannot be required to fit a complete baseline', () => {
  const plan = planFixture({
    longs: [20],
    totals: [30],
    profile: { goal: 'base', raceDate: addDays(start, 4) },
  });
  plan.workouts = plan.workouts.filter((w) => w.date <= plan.profile.raceDate);
  assert.deepEqual(validatePlan(plan), []);
});

void test('automatic preference adjustments still need coherent generated long-run progression', () => {
  const plan = planFixture({ longs: [20, 18.5] });
  Object.assign(long(plan, 1), { changed: true, changeSource: 'preferences' });
  const errors = validatePlan(plan);
  assert.ok(errors.some((error) => wholeError.test(error)));
  assert.ok(errors.some((error) => declineError.test(error)));
});

void test('active return plans use their return-state allocation instead of the fresh-baseline contract', () => {
  const plan = planFixture({
    longs: [16, 12.5],
    totals: [24, 20],
    profile: { longestKm: 20 },
  });
  plan.returnState = { stage: 1 };
  assert.deepEqual(onlyNewErrors(plan), []);
});

void test('two-day routines retain weekly distance without requiring a dedicated long workout', () => {
  const plan = planFixture({
    longs: [20],
    totals: [30],
    profile: { days: [0, 4] },
  });
  plan.workouts = plan.workouts.filter(
    (w) => w.date === start || w.date === addDays(start, 4),
  );
  for (const w of plan.workouts) {
    w.estimatedKm = 15;
    w.minutes = 90;
    w.steps = [{ label: 'Run', seconds: 5400, intensity: 2 }];
  }
  assert.deepEqual(validatePlan(plan), []);
  plan.workouts[0].estimatedKm = 14;
  assert.ok(
    validatePlan(plan).some((error) => /declared weekly distance/.test(error)),
  );
});

void test('a fresh ordinary week cannot silently reduce weekly distance while keeping the long run', () => {
  const plan = planFixture({ longs: [20, 20], totals: [30, 29] });
  assert.ok(
    validatePlan(plan).some((error) =>
      /reduces weekly distance outside/.test(error),
    ),
  );
  plan.weeks[1].phase = 'Recovery';
  assert.deepEqual(validatePlan(plan), []);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { progressChartWeeks } from '../lib/progress-chart.ts';
import { demoProfile, makePlan, addDays } from '../lib/engine.ts';
import { journalEntries, journalSummary } from '../lib/journal-view.ts';

function fixture() {
  const plan = makePlan(demoProfile('2026-12-21'), '2026-12-21');
  plan.weeks = plan.weeks.slice(0, 2);
  const [first, second] = plan.weeks;
  const template = plan.workouts[0];
  const run = (id, week, km, minutes, patch = {}) => ({
    ...structuredClone(template),
    id,
    week: week.index,
    date: week.start,
    estimatedKm: km,
    minutes,
    status: 'planned',
    kind: 'easy',
    ...patch,
  });
  plan.workouts = [
    run('delayed-run', first, 5, 30, {
      status: 'completed',
      feedback: {
        actualDate: second.start,
        actualKm: 6.5,
        actualMinutes: 42,
        effort: 3,
        feeling: 'good',
        recordedAt: `${second.start}T12:00:00Z`,
      },
    }),
    run('long-run', first, 12, 70, { kind: 'long' }),
    run('skipped-run', first, 50, 300, { status: 'skipped' }),
    run('race-day', second, 5, 25, { kind: 'race' }),
    run('archived-run', first, 8, 45, {
      week: -1,
      status: 'completed',
      date: addDays(first.start, -14),
      feedback: {
        actualDate: addDays(first.start, -14),
        actualKm: 8,
        actualMinutes: 45,
        effort: 3,
        feeling: 'good',
        recordedAt: `${addDays(first.start, -14)}T12:00:00Z`,
      },
    }),
  ];
  plan.extraRuns = [
    {
      id: 'unknown-distance',
      date: first.start,
      km: null,
      minutes: 20,
      effort: 3,
      feeling: 'good',
      note: '',
      recordedAt: `${first.start}T12:00:00Z`,
    },
  ];
  return plan;
}

test('progression separates saved plans from actual-date records, includes race and excludes skipped/archived prescriptions', () => {
  const plan = fixture();
  const before = structuredClone(plan);
  const weeks = progressChartWeeks(plan, plan.profile.startDate);
  assert.deepEqual(weeks[0].planned, {
    km: 17,
    minutes: 100,
    longKm: 12,
    longMinutes: 70,
    missingDistances: 0,
    missingTimes: 0,
  });
  assert.deepEqual(weeks[1].planned, {
    km: 5,
    minutes: null,
    longKm: 0,
    longMinutes: 0,
    missingDistances: 0,
    missingTimes: 1,
  });
  assert.deepEqual(weeks[0].recorded, {
    km: null,
    minutes: 20,
    runs: 1,
    missingDistances: 1,
  });
  assert.deepEqual(weeks[1].recorded, {
    km: 6.5,
    minutes: 42,
    runs: 1,
    missingDistances: 0,
  });
  assert.deepEqual(
    plan,
    before,
    'A chart read cannot edit the training schedule or journal',
  );
});

test('all-time stats retain preserved history even when it falls outside the progression chart', () => {
  const plan = fixture();
  const weeks = progressChartWeeks(plan, plan.profile.startDate);
  assert.equal(
    weeks.reduce((sum, week) => sum + week.recorded.runs, 0),
    2,
  );
  assert.deepEqual(journalSummary(journalEntries(plan)), {
    count: 3,
    knownDistances: 2,
    missingDistances: 1,
    km: 14.5,
    minutes: 107,
  });
});

test('a recorded zero remains distinct from an absent or partially recorded distance', () => {
  const plan = fixture();
  plan.workouts = plan.workouts.filter((run) => run.status !== 'completed');
  plan.extraRuns[0].km = 0;
  const weeks = progressChartWeeks(plan, plan.profile.startDate);
  assert.equal(weeks[0].recorded.km, 0);
  assert.equal(weeks[0].recorded.runs, 1);
  assert.equal(weeks[1].recorded.km, null);
  assert.equal(weeks[1].recorded.minutes, null);
  plan.extraRuns.push({ ...plan.extraRuns[0], id: 'unmeasured', km: null });
  const partial = progressChartWeeks(plan, plan.profile.startDate)[0];
  assert.equal(partial.recorded.km, 0);
  assert.equal(partial.recorded.missingDistances, 1);
  assert.equal(partial.recorded.minutes, 40);
});

test('without a real plan the overview shows recent recorded weeks, never demonstration prescriptions', () => {
  const plan = fixture();
  const today = plan.weeks[1].start;
  const weeks = progressChartWeeks(plan, today, false);
  assert.equal(weeks.length, 12);
  assert.ok(
    weeks.every((week) => week.planned === null && week.phase === null),
  );
  assert.equal(weeks.at(-1).recorded.km, 6.5);
  assert.equal(weeks.at(-2).recorded.km, null);
  assert.equal(weeks.at(-2).recorded.minutes, 20);
  assert.equal(weeks[0].recorded.km, null);
  assert.equal(weeks[0].recorded.minutes, null);
});

test('unsupported planned distances stay unknown while prescribed durations remain available', () => {
  const plan = fixture();
  plan.workouts = plan.workouts.slice(0, 2).map((run) => ({
    ...run,
    distanceEstimate: {
      lowerKm: null,
      upperKm: null,
      basis: 'No reliable pace supplied.',
    },
    steps: [
      {
        kind: 'aerobic',
        seconds: run.minutes * 60,
        label: 'Conversational running',
        effort: 'Comfortable',
        intensity: 2,
      },
    ],
  }));
  const first = progressChartWeeks(plan, plan.profile.startDate)[0];
  assert.equal(first.planned.km, null);
  assert.equal(first.planned.longKm, null);
  assert.equal(first.planned.minutes, 100);
  assert.equal(first.planned.missingDistances, 2);
  plan.workouts[0].distanceEstimate = {
    lowerKm: 4,
    upperKm: 6,
    basis: 'Saved estimate.',
  };
  const partial = progressChartWeeks(plan, plan.profile.startDate)[0];
  assert.equal(
    partial.planned.km,
    null,
    'A partial estimate is not plotted as a complete weekly total',
  );
  assert.equal(partial.planned.missingDistances, 1);
});

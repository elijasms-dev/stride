import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makePlan,
  demoProfile,
  demoPlan,
  validatePlan,
  moveWorkout,
  adjustPlan,
  addDays,
  dayDiff,
  monday,
  ENGINE_VERSION,
} from '../lib/engine.ts';
import { encodeWorkout } from '../lib/fit.ts';
import { Decoder, Stream } from '@garmin/fitsdk';
const date = '2026-09-07';
const p = demoProfile(date);
void test('same profile yields identical dated prescriptions and version', () => {
  assert.deepEqual(makePlan(p, date), makePlan(p, date));
  assert.equal(makePlan(p, date).engineVersion, ENGINE_VERSION);
});
void test('5K, 10K and base plans remain within time and scheduling constraints', () => {
  for (const goal of ['5k', '10k', 'base']) {
    const plan = makePlan({ ...p, goal }, date);
    assert.deepEqual(validatePlan(plan), []);
    for (const w of plan.workouts) {
      assert.equal(
        w.steps.reduce((n, s) => n + s.seconds, 0),
        w.minutes * 60,
      );
      assert.ok(
        w.kind === 'race' ||
          w.minutes <= (w.kind === 'long' ? p.longMinutes : p.weekdayMinutes),
      );
      assert.ok(
        w.kind === 'race' ||
          p.days.includes(
            (new Date(w.date + 'T12:00:00Z').getUTCDay() + 6) % 7,
          ),
      );
    }
  }
});
void test('race dates on every weekday anchor taper and avoid adjacent demanding sessions', () => {
  for (let i = 0; i < 7; i++) {
    const plan = makePlan({ ...p, raceDate: addDays('2026-11-23', i) }, date);
    assert.deepEqual(validatePlan(plan), []);
    assert.equal(
      plan.workouts.find((w) => w.kind === 'race').date,
      addDays('2026-11-23', i),
    );
    assert.equal(plan.weeks.at(-1).phase, 'Race week');
  }
});
void test('a partial start week contains no prescribed days before the start', () => {
  const plan = makePlan({ ...p, startDate: addDays(date, 3) }, date);
  assert.ok(plan.workouts.every((w) => w.date >= addDays(date, 3)));
  assert.ok(plan.weeks[0].targetKm < p.weeklyKm);
});
void test('invalid dates, unknown timezone and unsupported goals fail explicitly', () => {
  for (const patch of [
    { raceDate: '2026-02-30' },
    { raceDate: addDays(date, -1) },
    { timezone: 'not/a-zone' },
    { goal: 'unsupported' },
    { weeklyKm: NaN },
    { days: [1, 1, 2] },
    { longDay: 5 },
    { easyPace: 0 },
  ])
    assert.throws(() => makePlan({ ...p, ...patch }, date));
});
void test('no pace data still creates effort-only workouts', () => {
  const plan = makePlan({ ...p, easyPace: null }, date);
  assert.ok(plan.workouts.every((w) => w.steps.every((s) => s.effort)));
  assert.ok(plan.notes.some((n) => n.includes('estimates')));
});
void test('new runners start with three run-walk days and no hard work', () => {
  const q = {
    ...p,
    goal: 'base',
    weeklyKm: 0,
    longestKm: 0,
    currentRuns: 0,
    experience: 'new',
    days: [0, 2, 6],
  };
  const plan = makePlan(q, date);
  assert.ok(plan.workouts.every((w) => !w.hard));
  assert.ok(plan.workouts[0].steps.some((s) => s.label === 'Walk'));
  assert.throws(
    () => makePlan({ ...q, days: [0, 1, 2, 3, 4, 6] }, date),
    /two or three runs per week/,
  );
});
void test('insufficient time to prepare for a 10K is rejected', () => {
  assert.throws(
    () =>
      makePlan(
        {
          ...p,
          weeklyKm: 18,
          longestKm: 5,
          volume: 'maintain',
          weekdayMinutes: 20,
          longMinutes: 30,
        },
        date,
      ),
    /requires room/,
  );
});
void test('recovery and taper reduce load without treating recovery as new build baseline', () => {
  const plan = makePlan(p, date);
  assert.equal(plan.weeks[3].phase, 'Recovery');
  assert.ok(plan.weeks[3].targetKm < plan.weeks[2].targetKm);
  assert.ok(plan.weeks[4].targetKm > plan.weeks[3].targetKm);
  assert.equal(plan.workouts.filter((w) => w.week === 3 && w.hard).length, 0);
  assert.ok(plan.weeks[10].targetKm < plan.weeks[8].targetKm);
});
void test('changing difficulty changes quality dose while keeping schedule', () => {
  const a = makePlan(p, date),
    b = makePlan({ ...p, difficulty: 'gentle' }, date);
  assert.deepEqual(
    a.workouts.map((w) => w.date),
    b.workouts.map((w) => w.date),
  );
  assert.notDeepEqual(
    a.workouts.filter((w) => w.hard).map((w) => w.steps),
    b.workouts.filter((w) => w.hard).map((w) => w.steps),
  );
});
void test('date moves stay in week and cannot edit completed sessions', () => {
  const plan = makePlan(p, date);
  const run = plan.workouts[0];
  assert.equal(
    moveWorkout(plan, run.id, addDays(date, 1), date).workouts[0].date,
    addDays(date, 1),
  );
  assert.throws(() => moveWorkout(plan, run.id, addDays(date, 8), date));
  run.status = 'completed';
  assert.throws(() => moveWorkout(plan, run.id, addDays(date, 1), date));
});
void test('consecutive long runs are rejected across week boundaries', () => {
  const plan = makePlan(p, date);
  const long = plan.workouts.find((w) => w.date === '2026-09-20');
  assert.throws(
    () => moveWorkout(plan, long.id, '2026-09-14', date),
    /long or hard/,
  );
});
void test('archived completed sessions do not invalidate current plan changes', () => {
  const plan = makePlan(p, date);
  const archived = {
    ...structuredClone(plan.workouts[0]),
    id: 'archived',
    date: '2026-08-10',
    status: 'completed',
    week: -1,
  };
  plan.workouts.push(archived);
  const result = moveWorkout(plan, plan.workouts[0].id, '2026-09-08', date);
  assert.deepEqual(result.workouts.at(-1), archived);
});
void test('break preview preserves history and never redistributes missed distance', () => {
  const plan = makePlan(p, date);
  plan.workouts[0].status = 'completed';
  const original = structuredClone(plan.workouts[0]);
  const next = adjustPlan(plan, '2026-09-08', '2026-09-11', 'rest', date);
  assert.deepEqual(next.workouts[0], original);
  assert.deepEqual(validatePlan(next), []);
  for (const s of next.workouts)
    assert.ok(s.minutes <= plan.workouts.find((w) => w.id === s.id).minutes);
});
void test('extended break holds future load below baseline instead of resuming forecast', () => {
  const plan = makePlan(p, date),
    next = adjustPlan(plan, '2026-09-21', '2026-10-11', 'rest', date);
  for (const w of next.workouts.filter(
    (w) => w.date > '2026-10-11' && w.kind !== 'race',
  )) {
    assert.equal(w.hard, false);
    assert.ok(
      w.minutes <=
        Math.floor(((p.weeklyKm * p.easyPace) / p.days.length) * 0.75),
    );
  }
  assert.deepEqual(validatePlan(next), []);
});
void test('rest overlapping race defers the event without preventing recovery', () => {
  const plan = makePlan(demoProfile('2026-09-07'), '2026-09-07');
  const next = adjustPlan(
    plan,
    addDays(plan.profile.raceDate, -3),
    plan.profile.raceDate,
    'rest',
    plan.profile.startDate,
  );
  assert.equal(next.workouts.find((w) => w.kind === 'race').status, 'skipped');
  assert.equal(next.feasibility.status, 'event-deferred');
});

void test('return sessions also respect the time cap of their new role', () => {
  const plan = makePlan({ ...p, weekdayMinutes: 20, longMinutes: 100 }, date);
  const next = adjustPlan(plan, '2026-09-14', '2026-09-16', 'easy', date);
  assert.deepEqual(validatePlan(next), []);
});
void test('date arithmetic remains stable across DST and year changes', () => {
  assert.equal(dayDiff('2026-10-24', '2026-10-26'), 2);
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(monday('2026-11-01'), '2026-10-26');
});
void test('official Garmin SDK round-trip preserves every effort step', () => {
  const plan = demoPlan(date);
  for (const workout of plan.workouts) {
    const bytes = encodeWorkout(workout);
    const decoder = new Decoder(Stream.fromByteArray(bytes));
    assert.equal(decoder.checkIntegrity(), true);
    const { messages, errors } = decoder.read();
    assert.deepEqual(errors, []);
    assert.equal(messages.fileIdMesgs[0].type, 'workout');
    assert.equal(messages.workoutMesgs[0].sport, 'running');
    assert.equal(messages.workoutStepMesgs.length, workout.steps.length);
    messages.workoutStepMesgs.forEach((step, i) => {
      if (workout.steps[i].metres)
        assert.equal(step.durationDistance, workout.steps[i].metres);
      else assert.equal(step.durationTime, workout.steps[i].seconds);
      assert.equal(step.targetType, 'open');
      assert.equal(step.notes, workout.steps[i].effort);
    });
  }
});

void test('Garmin exports respect server memory limits and preserve each prescribed step', () => {
  const NativeArrayBuffer = globalThis.ArrayBuffer;
  const allocations = [];
  globalThis.ArrayBuffer = new Proxy(NativeArrayBuffer, {
    construct(target, args, newTarget) {
      const ceiling = args[1]?.maxByteLength ?? args[0];
      allocations.push(ceiling);
      if (ceiling > 128 * 1024 * 1024)
        throw new RangeError('Synthetic server memory ceiling');
      return Reflect.construct(target, args, newTarget);
    },
  });
  try {
    const w = {
      id: 'synthetic-worker-memory',
      originalDate: '2026-09-10',
      title: 'Marathon steady blocks',
      steps: [
        {
          kind: 'warmup',
          label: 'Warm up',
          seconds: 600,
          effort: 'Start gently · full sentences · 2–3 / 10',
        },
        {
          kind: 'aerobic',
          label: 'Aerobic running before the main set',
          seconds: 900,
          effort: 'Comfortable aerobic running · 2–3 / 10',
        },
        {
          kind: 'work',
          label: 'Controlled effort',
          seconds: 480,
          effort:
            'Steady and sustainable · 4–5 / 10 · well below an all-out effort',
        },
        {
          kind: 'cooldown',
          label: 'Cool down',
          seconds: 300,
          effort: 'Easy running · finish relaxed',
        },
      ],
    };
    const bytes = encodeWorkout(w);
    const decoder = new Decoder(Stream.fromByteArray(bytes));
    assert.equal(decoder.checkIntegrity(), true);
    const { messages, errors } = decoder.read();
    assert.deepEqual(errors, []);
    assert.deepEqual(
      messages.workoutStepMesgs.map((s) => s.durationTime),
      [600, 900, 480, 300],
    );
    assert.deepEqual(
      messages.workoutStepMesgs.map((s) => s.notes),
      w.steps.map((s) => s.effort),
    );
    assert.ok(messages.workoutStepMesgs.every((s) => s.targetType === 'open'));
    assert.ok(Math.max(...allocations) <= 1024 * 1024);
    // Exercise bounded output growth beyond the SDK's former initial allocation.
    const large = {
      ...w,
      steps: Array.from({ length: 3000 }, () => ({
        ...w.steps[2],
        effort: 'Synthetic bounded growth cue. '.repeat(6),
      })),
    };
    assert.ok(encodeWorkout(large).length > 524288);
    assert.throws(
      () =>
        encodeWorkout({ ...large, steps: [...large.steps, ...large.steps] }),
      /FIT_STEPS/,
    );
  } finally {
    globalThis.ArrayBuffer = NativeArrayBuffer;
  }
});

void test('FIT exports preserve Unicode cues, mixed endpoints and target ranges', () => {
  const workout = {
    id: 'mixed-unicode-workout',
    originalDate: '2026-09-14',
    title: 'Lämmittele – marathon 🏃',
    steps: [
      {
        kind: 'warmup',
        label: 'Lämmittely',
        seconds: 600,
        effort: 'Aloita rauhassa · 2–3 / 10',
      },
      {
        kind: 'work',
        label: 'Race rhythm',
        seconds: 300.125,
        metres: 1200,
        effort: 'Contrôlé · reste détendu',
        target: { mode: 'pace', low: 250, high: 280 },
      },
      {
        kind: 'recovery',
        label: 'Recovery',
        seconds: 90.125,
        effort: 'ゆっくり · recover',
        target: { mode: 'heart-rate', low: 130, high: 150 },
      },
      {
        kind: 'cooldown',
        label: 'Cool down 🏃',
        seconds: 180,
        effort: 'Finish relaxed',
      },
    ],
  };
  const before = structuredClone(workout);
  const decoder = new Decoder(Stream.fromByteArray(encodeWorkout(workout)));
  assert.equal(decoder.checkIntegrity(), true);
  const { messages, errors } = decoder.read();
  assert.deepEqual(errors, []);
  assert.equal(messages.fileIdMesgs[0].type, 'workout');
  assert.equal(
    messages.fileIdMesgs[0].timeCreated.toISOString(),
    '2026-09-14T12:00:00.000Z',
  );
  assert.equal(messages.workoutMesgs[0].numValidSteps, workout.steps.length);
  assert.equal(messages.workoutMesgs[0].wktName, workout.title);
  const steps = messages.workoutStepMesgs;
  assert.deepEqual(
    steps.map((s) => s.messageIndex),
    [0, 1, 2, 3],
  );
  assert.deepEqual(
    steps.map((s) => s.wktStepName),
    workout.steps.map((s) => s.label),
  );
  assert.deepEqual(
    steps.map((s) => s.notes),
    workout.steps.map((s) => s.effort),
  );
  assert.deepEqual(
    steps.map((s) => s.intensity),
    ['warmup', 'active', 'recovery', 'cooldown'],
  );
  assert.equal(steps[0].durationTime, 600);
  assert.equal(steps[1].durationDistance, 1200);
  assert.equal(steps[2].durationTime, 90.125);
  assert.equal(steps[3].durationTime, 180);
  assert.equal(steps[1].customTargetSpeedLow, 3.571);
  assert.equal(steps[1].customTargetSpeedHigh, 4);
  assert.equal(steps[2].customTargetHeartRateLow, 230);
  assert.equal(steps[2].customTargetHeartRateHigh, 250);
  assert.deepEqual(workout, before);
});

void test('FIT exports reject unrepresentable text instead of truncating prescribed cues', () => {
  const workout = {
    id: 'fit-field-capacity',
    originalDate: '2026-09-14',
    title: 'Controlled workout',
    steps: [{ kind: 'work', label: 'Run', seconds: 300, effort: '' }],
  };
  for (const effort of ['x'.repeat(255), 'é'.repeat(128), 'Easy\0Sprint']) {
    workout.steps[0].effort = effort;
    assert.throws(() => encodeWorkout(workout), {
      name: 'FitExportError',
      code: 'FIT_STEPS',
    });
    assert.equal(workout.steps[0].effort, effort);
  }
  workout.steps[0].effort = 'é'.repeat(127);
  const decoder = new Decoder(Stream.fromByteArray(encodeWorkout(workout)));
  const { messages, errors } = decoder.read();
  assert.deepEqual(errors, []);
  assert.equal(messages.workoutStepMesgs[0].notes, workout.steps[0].effort);
});

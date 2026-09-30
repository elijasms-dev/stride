import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRecovery, prepareRestoredPlan } from '../lib/recovery.ts';
import {
  makePlan,
  demoProfile,
  addDays,
  trainingFamily,
  eventDistanceDisplay,
  preparationRequirements,
  customExposureKm,
  workoutDistanceLabel,
} from '../lib/engine.ts';
import { encodeWorkout } from '../lib/fit.ts';
import { Decoder, Stream } from '@garmin/fitsdk';
const start = '2026-09-07',
  profile = demoProfile(start),
  plan = makePlan(profile, start);
const file = () => ({
  format: 'stride-recovery-2',
  exportedAt: start + 'T18:00:00Z',
  profile: null,
  plan: structuredClone(plan),
});
const complete = (w) =>
  Object.assign(w, {
    status: 'completed',
    feedback: {
      actualDate: start,
      actualMinutes: 30,
      actualKm: 5.25,
      effort: 3,
      feeling: 'good',
      note: 'Exact historical note',
      recordedAt: start + 'T18:00:00Z',
    },
  });
void test('recovery keeps actuals, creates independent identities, and round trips with a full notes array', () => {
  const f = file();
  complete(f.plan.workouts[0]);
  f.plan.notes = Array.from({ length: 100 }, (_, i) => 'Note ' + i);
  const first = validateRecovery(f),
    next = prepareRestoredPlan(first.plan);
  assert.notEqual(next.id, f.plan.id);
  assert.notEqual(next.workouts[0].id, f.plan.workouts[0].id);
  assert.equal(next.workouts[0].feedback.actualKm, 5.25);
  assert.equal(next.workouts[0].feedback.note, 'Exact historical note');
  assert.equal(next.notes.length, 100);
  assert.doesNotThrow(() => validateRecovery({ ...f, plan: next }));
});
void test('recovery rejects malformed session and return data before it reaches the interface or engine', () => {
  for (const patch of [
    { session: {} },
    { returnCeilingMinutes: 'broken' },
    { pairId: 'half-pair' },
    { qualityMinutes: NaN },
  ]) {
    const f = file();
    Object.assign(f.plan.workouts[0], patch);
    assert.throws(() => validateRecovery(f), /recovery file/);
  }
  for (const patch of [
    { feasibility: { status: 'review-required', reasons: 'broken' } },
    { returnState: { stage: 2 } },
    { baselineEvidence: { source: 'recorded-plan-history' } },
  ]) {
    const f = file();
    Object.assign(f.plan, patch);
    assert.throws(() => validateRecovery(f), /recovery file/);
  }
});
void test('recovery distinguishes intentional no data from an incomplete file and rejects duplicate recorded identities', () => {
  assert.doesNotThrow(() =>
    validateRecovery({
      format: 'stride-recovery-2',
      exportedAt: start + 'T00:00:00Z',
      plan: null,
      profile: null,
    }),
  );
  assert.throws(
    () =>
      validateRecovery({
        format: 'stride-recovery-2',
        exportedAt: start + 'T00:00:00Z',
      }),
    /explicitly present/,
  );
  const f = file();
  complete(f.plan.workouts[0]);
  const archived = {
    ...structuredClone(f.plan.workouts[0]),
    week: -1,
    id: 'archive',
  };
  f.plan.workouts[0].feedback.activityId = 'activity-1';
  archived.feedback.activityId = 'activity-1';
  f.plan.workouts.push(archived);
  assert.throws(() => validateRecovery(f), /duplicate external activity/);
});
void test('recovery verifies the week calendar and archived recorded facts', () => {
  const wrongWeek = file();
  wrongWeek.plan.workouts[0].week = 3;
  assert.throws(() => validateRecovery(wrongWeek), /match their weeks/);
  const archive = file();
  const w = structuredClone(archive.plan.workouts[0]);
  complete(w);
  w.week = -1;
  w.id = 'archived';
  w.feedback.actualMinutes = -2;
  archive.plan.workouts.push(w);
  assert.throws(() => validateRecovery(archive), /recorded time/);
});
void test('exact half marathon and sub-metre custom distance survive family selection, UI formatter and FIT', () => {
  for (const distance of [21.0975, 21.0976, 42.195, 1.0001]) {
    const p = {
      ...profile,
      goal: 'custom',
      raceDistanceKm: distance,
      weeklyKm: 60,
      longestKm: 22,
      currentRuns: 5,
      days: [0, 1, 3, 4, 6],
      longDay: 6,
      raceDate: addDays(start, 139),
      weekdayMinutes: 90,
      longMinutes: 200,
    };
    const generated = makePlan(p, start),
      race = generated.workouts.find((w) => w.kind === 'race');
    assert.equal(generated.profile.raceDistanceKm, distance);
    assert.equal(race.estimatedKm, distance);
    assert.equal(race.steps[0].metres, Math.round(distance * 10000) / 10);
    const result = new Decoder(
      Stream.fromByteArray(encodeWorkout(race)),
    ).read();
    assert.deepEqual(result.errors, []);
    assert.ok(
      Math.abs(
        result.messages.workoutStepMesgs[0].durationDistance - distance * 1000,
      ) < 0.001,
    );
  }
  assert.equal(
    trainingFamily({ goal: 'custom', raceDistanceKm: 21.0975 }),
    'half',
  );
  assert.equal(eventDistanceDisplay(21.0975, 'km'), '21.0975');
});

void test('tiny distance changes keep the preparation model and non-race schedule at standard anchors', () => {
  // Exact race names may change; dates, workload, targets and recovery must not.
  const scheduleAndDose = (workout, eventDistance) => {
    const result = structuredClone(workout);
    if (result.eventDistanceKm !== undefined) {
      for (const key of ['eventDistanceKm', 'title', 'purpose', 'reason'])
        delete result[key];
      for (const step of result.steps) {
        delete step.label;
        delete step.effort;
        // Saved guidance mirrors the same event-specific human-readable cue.
        if (step.pacing) delete step.pacing.guidance;
      }
    }
    for (const step of result.steps)
      if (
        step.pacing?.method === 'effort' &&
        step.pacing.source.id === 'stride-adaptive' &&
        step.pacing.role.startsWith('current-') &&
        step.pacing.referenceDistanceKm === eventDistance
      ) {
        // Exact event names/roles change from 5K to a custom 5.0001 km race.
        // This is effort-only event identity; source-specific references,
        // source provenance, evidence and every numerical target stay compared.
        delete step.pacing.referenceDistanceKm;
        delete step.pacing.role;
        delete step.pacing.label;
        if (
          step.paceInstruction?.sourceId === 'stride-adaptive' &&
          step.paceInstruction.kind === 'current-race' &&
          step.paceInstruction.distanceKm === eventDistance
        )
          delete step.paceInstruction.distanceKm;
      }
    return result;
  };
  for (const d of [5, 10, 21.0975, 42.195, 50]) {
    const base = {
      ...profile,
      goal: 'custom',
      raceDistanceKm: d,
      weeklyKm: 60,
      longestKm: 22,
      currentRuns: 5,
      days: [0, 1, 3, 4, 6],
      longDay: 6,
      raceDate: addDays(start, 195),
      weekdayMinutes: 90,
      longMinutes: 240,
    };
    const p = makePlan(base, start),
      q = makePlan({ ...base, raceDistanceKm: d + 0.0001 }, start);
    assert.equal(trainingFamily(p.profile), trainingFamily(q.profile));
    const a = preparationRequirements(p.profile),
      b = preparationRequirements(q.profile);
    assert.ok(Math.abs(a.recommendedDays - b.recommendedDays) <= 1);
    assert.ok(Math.abs(a.minWeekly - b.minWeekly) <= 0.1);
    assert.ok(Math.abs(a.minLong - b.minLong) <= 0.1);
    assert.deepEqual(
      p.workouts
        .filter((w) => w.kind !== 'race')
        .map((w) => scheduleAndDose(w, d)),
      q.workouts
        .filter((w) => w.kind !== 'race')
        .map((w) => scheduleAndDose(w, d + 0.0001)),
    );
    assert.ok(
      Math.abs(customExposureKm(d + 0.0001) - customExposureKm(d)) < 0.0001,
    );
    assert.equal(
      q.workouts.find((w) => w.kind === 'race').steps[0].metres,
      Math.round((d + 0.0001) * 10000) / 10,
    );
  }
});
void test('custom band crossings are explicit model changes with compatible long exposure rules', () => {
  for (const edge of [7.5, 15, 30, 45, 60]) {
    const p = { goal: 'custom', raceDistanceKm: edge },
      q = { ...p, raceDistanceKm: edge + 0.0001 };
    assert.notEqual(
      preparationRequirements(p).band,
      preparationRequirements(q).band,
    );
  }
  assert.ok(customExposureKm(30) > 20 && customExposureKm(30) < 22);
  assert.ok(customExposureKm(45) > 26 && customExposureKm(45) < 28);
});

void test('recovery retains target snapshots and rejects malformed ranges', async () => {
  const { updateWorkoutTargets } = await import('../lib/workout-targets.ts');
  const f = file();
  // This case tests target snapshot persistence, not a distance/time-cap review.
  f.plan = makePlan({ ...profile, runMeasure: 'time' }, start);
  f.plan = updateWorkoutTargets(
    f.plan,
    { mode: 'pace', pace: { easy: { low: 330, high: 390 } } },
    start,
  );
  complete(f.plan.workouts[0]);
  const recovered = validateRecovery(f);
  assert.deepEqual(recovered.plan.workouts[0].steps, f.plan.workouts[0].steps);
  assert.deepEqual(
    recovered.plan.profile.workoutTargets,
    f.plan.profile.workoutTargets,
  );
  f.plan.workouts[0].steps[0].target = {
    mode: 'heart-rate',
    low: 180,
    high: 150,
  };
  assert.throws(() => validateRecovery(f), /target range/);
});

void test('legacy completed, skipped and past prescriptions retain their saved estimates and quality dose', () => {
  for (const status of ['completed', 'skipped', 'planned']) {
    const f = file();
    const w = f.plan.workouts[0];
    delete w.prescriptionVersion;
    delete w.prescriptionPaceBasis;
    w.status = status;
    // A legacy distance interval used an old allocation for quality accounting.
    // Its original estimate must not borrow today's easy pace during restoration.
    w.kind = 'tempo';
    w.stimulus = 'threshold';
    w.hard = true;
    w.minutes = 12;
    w.qualityMinutes = 10;
    w.estimatedKm = 1.3;
    w.steps = [
      {
        label: '1 km tempo',
        kind: 'work',
        intensity: 6,
        seconds: 600,
        metres: 1000,
        effort: 'Controlled',
        target: { mode: 'pace', low: 300, high: 330 },
      },
      {
        label: 'Easy recovery',
        kind: 'recovery',
        intensity: 2,
        seconds: 120,
        effort: 'Easy',
      },
    ];
    w.distanceEstimate = {
      lowerKm: 1.2,
      upperKm: 1.5,
      basis: 'Saved legacy estimate.',
    };
    if (status === 'completed') complete(w);
    const before = structuredClone(w);
    const restored = validateRecovery(f).plan.workouts.find(
      (item) => item.id === w.id,
    );
    assert.deepEqual(restored, before);
    assert.equal(
      workoutDistanceLabel(restored, { units: 'km', easyPace: 12 }),
      '1.2–1.5 km est.',
    );
  }
});

void test('legacy history without an estimate does not borrow a newer easy pace', () => {
  const f = file();
  const w = f.plan.workouts[0];
  delete w.prescriptionVersion;
  delete w.prescriptionPaceBasis;
  delete w.distanceEstimate;
  w.steps = [
    {
      label: 'Easy running',
      seconds: w.minutes * 60,
      kind: 'work',
      intensity: 3,
      effort: 'Easy',
    },
  ];
  complete(w);
  const restored = validateRecovery(f).plan.workouts.find(
    (item) => item.id === w.id,
  );
  assert.equal(restored.distanceEstimate.lowerKm, null);
  assert.equal(restored.distanceEstimate.upperKm, null);
  assert.equal(
    workoutDistanceLabel(restored, { units: 'km', easyPace: 3 }),
    'Distance not estimated',
  );
});

void test('recovery validates legacy saved estimate shapes before preserving them', () => {
  for (const estimate of [
    { lowerKm: 5, upperKm: 4, basis: 'Reversed' },
    { lowerKm: null, upperKm: 5, basis: 'Mixed nulls' },
    { lowerKm: 1, upperKm: Infinity, basis: 'Non-finite' },
    { lowerKm: 1, upperKm: 2, basis: {} },
  ]) {
    const f = file();
    const w = f.plan.workouts[0];
    delete w.prescriptionVersion;
    complete(w);
    w.distanceEstimate = estimate;
    assert.throws(() => validateRecovery(f), /saved distance estimate/);
  }
});

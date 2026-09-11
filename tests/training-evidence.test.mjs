import test from 'node:test';
import assert from 'node:assert/strict';
const lib = new URL('../lib/', import.meta.url);
const { demoProfile, makePlan, addDays, revisePreferences } = await import(
  new URL('engine.ts', lib)
);
const { changeEvent } = await import(new URL('event-transition.ts', lib));
const { qualityWorkMinutes } = await import(new URL('prescription.ts', lib));
const { trainingRecords, currentTrainingBaseline } = await import(
  new URL('training-history.ts', lib)
);
const { canonicalCompletedWorkouts, qualityTrainingEvidence } = await import(
  new URL('training-evidence.ts', lib)
);

const start = '2026-09-07',
  defaultAsOf = '2026-11-02';
function fixture(asOf = defaultAsOf) {
  const p = makePlan(
    {
      ...demoProfile(start),
      weeklyKm: 50,
      longestKm: 15,
      weekdayMinutes: 90,
      longMinutes: 150,
      recentQualitySessions: 1,
      qualitySessions: 1,
      terrain: 'flat',
      raceDate: addDays(start, 104),
    },
    start,
  );
  p.workouts
    .filter((w) => w.date <= asOf)
    .forEach((w) => {
      w.status = 'completed';
      w.feedback = {
        actualDate: w.date,
        actualMinutes: w.minutes,
        actualKm: w.estimatedKm,
        effort: 3,
        feeling: 'good',
        note: 'Synthetic quality evidence regression',
        recordedAt: w.date + 'T18:00:00Z',
        execution: 'unknown',
      };
    });
  return p;
}
function success(w, patch = {}) {
  Object.assign(w.feedback, {
    execution: 'as-planned',
    executionSource: 'self-report',
    completedQualityMinutes: qualityWorkMinutes(w),
    ...patch,
  });
}
function facts(p) {
  return {
    completed: p.workouts.filter((w) => w.status === 'completed'),
    extras: p.extraRuns ?? [],
  };
}
function replan(p, asOf = defaultAsOf, days = [0, 3, 4, 6]) {
  const before = structuredClone(p),
    q = revisePreferences(p, { days }, asOf);
  assert.deepEqual(p, before, 'Preview must preserve the original journal');
  assert.deepEqual(
    facts(q),
    facts(p),
    'Recorded workouts and notes must remain intact',
  );
  return q;
}
function quality(p, asOf = defaultAsOf) {
  return p.workouts
    .filter((w) => w.date >= asOf && w.status === 'planned' && w.templateId)
    .sort((a, b) => a.date.localeCompare(b.date));
}
const dose = (w) => ({
  template: w.templateId,
  minutes: qualityWorkMinutes(w),
  target: w.targetWorkMinutes,
});

void test('canonical completed evidence shares journal deduplication and sorts by actual date without rewriting prescriptions', () => {
  const p = fixture();
  const ws = ['2026-10-07', '2026-10-14', '2026-10-21'].map((date) =>
    structuredClone(p.workouts.find((w) => w.date === date)),
  );
  ws[0].feedback.actualDate = '2026-10-28';
  ws[1].feedback.actualDate = '2026-10-12';
  ws[2].feedback.actualDate = '2026-10-19';
  ws.forEach((w, index) => {
    w.feedback.activityId = 'activity-' + index;
    success(w);
  });
  ws.push({ ...structuredClone(ws[0]), id: 'archived-copy', week: -1 });
  const before = structuredClone(ws),
    rows = canonicalCompletedWorkouts(ws);
  assert.equal(rows.length, 3);
  assert.deepEqual(
    rows.map((w) => w.feedback.actualDate),
    ['2026-10-12', '2026-10-19', '2026-10-28'],
  );
  assert.deepEqual(
    new Set(rows.map((w) => w.id)),
    new Set(trainingRecords({ workouts: ws }).map((r) => r.workoutId)),
  );
  assert.deepEqual(ws, before);
});

void test('only explicit successful quality with a finite completed dose qualifies; total duration alone supplies no credit', () => {
  const original = fixture().workouts.find((w) => w.date === '2026-10-14');
  const q = qualityWorkMinutes(original);
  for (const [label, patch, status, eligible] of [
    [
      'legacy absent execution',
      { execution: undefined, completedQualityMinutes: q },
      'execution-unknown',
      false,
    ],
    [
      'unknown execution with a dose',
      { execution: 'unknown', completedQualityMinutes: q },
      'execution-unknown',
      false,
    ],
    [
      'partial work',
      { execution: 'partial', completedQualityMinutes: q },
      'partial',
      false,
    ],
    [
      'easy substitute',
      { execution: 'easy-substitute', completedQualityMinutes: q },
      'easy-substitute',
      false,
    ],
    [
      'not attempted',
      { execution: 'not-attempted', completedQualityMinutes: q },
      'not-attempted',
      false,
    ],
    [
      'unknown dose',
      { completedQualityMinutes: undefined },
      'dose-unknown',
      false,
    ],
    ['nonfinite dose', { completedQualityMinutes: NaN }, 'dose-unknown', false],
    [
      'below 90 percent',
      { completedQualityMinutes: q * 0.89 },
      'below-dose',
      false,
    ],
    ['tired success', { feeling: 'tired' }, 'recovery-hold', false],
    ['high-effort success', { effort: 8 }, 'recovery-hold', false],
    [
      '90 percent and effort 7',
      { completedQualityMinutes: q * 0.9, effort: 7 },
      'reported-complete',
      true,
    ],
  ]) {
    const w = structuredClone(original);
    success(w, patch);
    const before = structuredClone(w),
      row = qualityTrainingEvidence([w], defaultAsOf)[0];
    assert.equal(row.status, status, label);
    assert.equal(row.eligible, eligible, label);
    assert.deepEqual(w, before, label);
  }
});

void test('quality evidence dates use actual prior days, including earlier actual runs with later prescriptions', () => {
  const original = fixture().workouts.find((w) => w.date === '2026-10-14');
  const rows = ['2026-10-30', defaultAsOf, '2026-11-03'].map((date, index) => {
    const w = structuredClone(original);
    w.id = 'date-case-' + index;
    w.date = index === 0 ? '2026-11-04' : '2026-10-14';
    success(w, { actualDate: date });
    return w;
  });
  const before = structuredClone(rows);
  assert.deepEqual(
    qualityTrainingEvidence(rows, defaultAsOf).map((r) => r.date),
    ['2026-10-30'],
  );
  assert.equal(
    qualityTrainingEvidence(rows, defaultAsOf, '2026-10-31').length,
    0,
  );
  assert.deepEqual(rows, before);
});

void test('missing or malformed effort and feeling cannot be promoted to successful quality evidence', () => {
  const original = fixture().workouts.find((w) => w.date === '2026-10-14');
  for (const [label, patch] of [
    ['absent effort', { effort: undefined }],
    ['nonfinite effort', { effort: NaN }],
    ['fractional effort', { effort: 3.5 }],
    ['effort below the input range', { effort: 0 }],
    ['absent feeling', { feeling: undefined }],
    ['unsupported feeling', { feeling: 'unknown' }],
  ]) {
    const w = structuredClone(original);
    success(w, patch);
    const before = structuredClone(w),
      row = qualityTrainingEvidence([w], defaultAsOf)[0];
    assert.equal(row.eligible, false, label);
    assert.equal(row.status, 'feedback-unknown', label);
    assert.deepEqual(w, before);
  }
});

void test('actual quality performed today cannot increase the next replan dose despite an older prescribed date', () => {
  const unknown = fixture(),
    w = unknown.workouts.find((w) => w.date === '2026-10-14');
  w.feedback.actualDate = defaultAsOf;
  const reported = structuredClone(unknown);
  success(reported.workouts.find((r) => r.id === w.id));
  assert.deepEqual(
    currentTrainingBaseline(unknown, defaultAsOf),
    currentTrainingBaseline(reported, defaultAsOf),
  );
  const a = dose(quality(replan(unknown))[0]),
    b = dose(quality(replan(reported))[0]);
  assert.deepEqual(b, a);
  assert.equal(a.minutes, 8);
});

void test('a prior-day successful recording scheduled today contributes to real replan quality', () => {
  const asOf = '2026-11-04',
    p = fixture(asOf),
    w = p.workouts.find((w) => w.date === asOf);
  success(w, { actualDate: '2026-11-03' });
  const equivalent = structuredClone(p);
  equivalent.workouts.find((r) => r.id === w.id).date = '2026-11-03';
  const a = dose(quality(replan(p, asOf, [0, 4, 5, 6]), asOf)[0]);
  const b = dose(quality(replan(equivalent, asOf, [0, 4, 5, 6]), asOf)[0]);
  assert.deepEqual(
    a,
    b,
    'The same actual successful run must not depend on its prescribed date',
  );
  assert.equal(a.template, 'threshold-cruise');
  assert.equal(a.minutes, 12);
});

void test('new-event history cannot bypass execution gates merely because a record was prescribed today', () => {
  const asOf = '2026-11-04';
  let controlDose;
  const patch = {
    goal: '10k',
    raceName: 'Synthetic new race',
    raceDate: addDays(asOf, 83),
    raceDistanceKm: 10,
    raceTerrain: 'road',
  };
  for (const execution of [
    undefined,
    'unknown',
    'easy-substitute',
    'partial',
    'not-attempted',
    'as-planned',
  ]) {
    const p = fixture(asOf),
      w = p.workouts.find((w) => w.date === asOf);
    w.feedback.execution = execution;
    if (execution === 'as-planned') success(w);
    const before = structuredClone(p),
      q = changeEvent(p, patch, asOf);
    const first = quality(q, asOf).find((w) => w.stimulus === 'threshold');
    assert.ok(first);
    const label = execution ?? 'legacy absent';
    assert.ok(
      qualityWorkMinutes(first) > 0 && qualityWorkMinutes(first) <= 8,
      label,
    );
    const actualDose = dose(first);
    if (!controlDose) controlDose = actualDose;
    else assert.deepEqual(actualDose, controlDose, label);
    assert.ok(
      qualityTrainingEvidence(p.workouts, asOf).every(
        (row) => row.workout.id !== w.id,
      ),
      label,
    );
    assert.deepEqual(p, before);
    assert.deepEqual(
      q.workouts.filter((w) => w.status === 'completed').map((w) => w.feedback),
      p.workouts.filter((w) => w.status === 'completed').map((w) => w.feedback),
    );
  }
});

void test('a duplicate provider identity cannot manufacture a second successful threshold exposure', () => {
  const single = fixture();
  const a = single.workouts.find((w) => w.date === '2026-10-07');
  const b = single.workouts.find((w) => w.date === '2026-10-14');
  a.feedback.activityId = b.feedback.activityId = 'same-threshold-activity';
  success(a);
  const duplicate = structuredClone(single);
  success(duplicate.workouts.find((w) => w.id === b.id));
  assert.deepEqual(trainingRecords(single), trainingRecords(duplicate));
  assert.deepEqual(
    currentTrainingBaseline(single, defaultAsOf),
    currentTrainingBaseline(duplicate, defaultAsOf),
  );
  const control = dose(quality(replan(single))[0]);
  assert.equal(control.template, 'threshold-cruise');
  assert.equal(control.minutes, 12);
  assert.deepEqual(dose(quality(replan(duplicate))[0]), control);
});

void test('quality preparation-window membership uses the actual date rather than the prescribed week', () => {
  const stale = fixture(),
    w = stale.workouts.find((w) => w.date === '2026-10-14');
  success(w, { actualDate: '2026-09-16' });
  const unknown = structuredClone(stale);
  unknown.workouts.find((r) => r.id === w.id).feedback.execution = 'unknown';
  assert.deepEqual(
    dose(quality(replan(stale))[0]),
    dose(quality(replan(unknown))[0]),
  );
  assert.equal(qualityWorkMinutes(quality(replan(stale))[0]), 8);
});

void test('future forecast exposures still progress separately from unknown recorded execution', () => {
  const p = fixture(),
    q = replan(p);
  const future = quality(q)
    .filter((w) => w.templateId === 'race-rhythm-10')
    .slice(0, 2);
  assert.equal(future.length, 2);
  assert.ok(future.every((w) => w.status === 'planned' && !w.feedback));
  assert.ok(qualityWorkMinutes(future[1]) > qualityWorkMinutes(future[0]));
  assert.ok(
    p.workouts
      .filter((w) => w.feedback)
      .every((w) => w.feedback.execution === 'unknown'),
  );
});

void test('legacy records without an actual date retain their prescribed-date fallback when execution and dose are known', () => {
  const w = structuredClone(
    fixture().workouts.find((w) => w.date === '2026-10-14'),
  );
  success(w);
  delete w.feedback.actualDate;
  const before = structuredClone(w),
    row = qualityTrainingEvidence([w], defaultAsOf)[0];
  assert.equal(row.date, w.date);
  assert.equal(row.eligible, true);
  assert.deepEqual(w, before);
});

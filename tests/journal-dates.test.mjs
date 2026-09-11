import test from 'node:test';
import assert from 'node:assert/strict';
import { makePlan, demoProfile } from '../lib/engine.ts';
import {
  recordedWorkoutDate,
  recordingCandidates,
  trainingRecords,
} from '../lib/training-history.ts';

function fixture() {
  const plan = makePlan(demoProfile('2026-09-07'), '2026-09-07');
  const [delayed, onTime] = plan.workouts;
  for (const [w, actualDate] of [
    [delayed, '2026-09-10'],
    [onTime, '2026-09-09'],
  ]) {
    if (typeof actualDate !== 'string')
      throw new Error('Fixture date must be a string');
    w.status = 'completed';
    w.feedback = {
      actualDate,
      actualMinutes: 41.25,
      actualKm: 6.1234,
      effort: 3,
      feeling: 'good',
      note: 'Synthetic journal date',
      recordedAt: actualDate + 'T18:00:00Z',
    };
  }
  return { plan, delayed, onTime };
}
void test('completed journal chronology and workload dates agree after a delayed run', () => {
  const { plan, delayed, onTime } = fixture(),
    before = structuredClone(plan);
  const rows = [delayed, onTime].sort((a, b) =>
    recordedWorkoutDate(b).localeCompare(recordedWorkoutDate(a)),
  );
  assert.deepEqual(
    rows.map((w) => [w.id, recordedWorkoutDate(w)]),
    trainingRecords(plan).map((r) => [r.workoutId, r.date]),
  );
  assert.equal(rows[0].id, delayed.id);
  assert.equal(recordedWorkoutDate(delayed), '2026-09-10');
  assert.equal(
    delayed.date,
    '2026-09-07',
    'The schedule remains the original prescription',
  );
  assert.deepEqual(plan, before);
});
void test('a recording attaches to the actual-date candidate without offering already-linked or skipped runs', () => {
  const { plan, delayed } = fixture();
  assert.deepEqual(
    recordingCandidates(plan.workouts, '2026-09-10').map((w) => w.id),
    [delayed.id],
  );
  assert.equal(
    recordingCandidates(plan.workouts, delayed.date).includes(delayed),
    false,
  );
  delayed.feedback.activityId = 'synthetic:one';
  assert.equal(recordingCandidates(plan.workouts, '2026-09-10').length, 0);
  const planned = plan.workouts.find((w) => w.status === 'planned');
  assert.ok(recordingCandidates(plan.workouts, planned.date).includes(planned));
  planned.status = 'skipped';
  assert.equal(
    recordingCandidates(plan.workouts, planned.date).includes(planned),
    false,
  );
});
void test('date corrections move the match and legacy recordings fall back to the scheduled date', () => {
  const { plan, delayed } = fixture();
  delayed.feedback.actualDate = '2026-09-08';
  assert.ok(recordingCandidates(plan.workouts, '2026-09-08').includes(delayed));
  assert.equal(
    recordingCandidates(plan.workouts, '2026-09-10').includes(delayed),
    false,
  );
  delete delayed.feedback.actualDate;
  assert.equal(recordedWorkoutDate(delayed), delayed.date);
  assert.ok(recordingCandidates(plan.workouts, delayed.date).includes(delayed));
});

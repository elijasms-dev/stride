import test from 'node:test';
import assert from 'node:assert/strict';

const { orderedDaySessions, focusedSession, daySessionSummary, workoutTone } =
  await import(new URL('../lib/day-sessions.ts', import.meta.url));

const date = '2026-09-09';
const run = (id, patch = {}) => ({
  id,
  date,
  week: 0,
  title: `${id} run`,
  kind: 'easy',
  status: 'planned',
  hard: false,
  ...patch,
});

await test('day ordering keeps every status but excludes archived and other-date workouts without mutating input', () => {
  const pm = Object.freeze(
    run('pm', { session: 'PM', startTime: '18:00', status: 'skipped' }),
  );
  const am = Object.freeze(
    run('am', { session: 'AM', startTime: '07:00', status: 'completed' }),
  );
  const workouts = Object.freeze([
    pm,
    Object.freeze(run('archived', { week: -1 })),
    Object.freeze(run('tomorrow', { date: '2026-09-10' })),
    am,
  ]);
  const sessions = orderedDaySessions(workouts, date);
  assert.deepEqual(
    sessions.map((w) => w.id),
    ['am', 'pm'],
  );
  assert.deepEqual(
    workouts.map((w) => w.id),
    ['pm', 'archived', 'tomorrow', 'am'],
  );
  assert.notStrictEqual(sessions, workouts);
});

await test('a completed morning defaults focus to the remaining evening session; an explicit morning selection is respected', () => {
  const am = run('am', { session: 'AM', status: 'completed' });
  const pm = run('pm', { session: 'PM' });
  assert.equal(focusedSession([am, pm])?.id, 'pm');
  assert.equal(focusedSession([am, pm], 'am')?.id, 'am');
  assert.equal(focusedSession([am, pm], 'previous-day-id')?.id, 'pm');
});

await test('partial doubled days expose the remaining session and never claim full completion', () => {
  const summary = daySessionSummary([
    run('am', { session: 'AM', status: 'completed' }),
    run('pm', { session: 'PM' }),
  ]);
  assert.deepEqual(
    [
      summary.remaining,
      summary.completed,
      summary.skipped,
      summary.active,
      summary.state,
    ],
    [1, 1, 0, 2, 'partial'],
  );
  assert.match(summary.label, /AM/i);
  assert.match(summary.label, /PM/i);
  assert.match(summary.label, /complet/i);
  assert.match(summary.label, /remaining|planned/i);
});

await test('completed plus skipped is complete only for active runs, and still discloses the skipped session', () => {
  const summary = daySessionSummary([
    run('am', { session: 'AM', status: 'completed' }),
    run('pm', { session: 'PM', status: 'skipped' }),
  ]);
  assert.deepEqual(
    [
      summary.remaining,
      summary.completed,
      summary.skipped,
      summary.active,
      summary.state,
    ],
    [0, 1, 1, 1, 'completed'],
  );
  assert.match(summary.label, /complet/i);
  assert.match(summary.label, /skipp/i);
  assert.doesNotMatch(summary.label, /all sessions complete/i);
});

await test('an all-skipped day keeps a skipped workout available to inspect, with no running remaining', () => {
  const sessions = [
    run('am', { session: 'AM', status: 'skipped' }),
    run('pm', { session: 'PM', status: 'skipped' }),
  ];
  const summary = daySessionSummary(sessions);
  assert.deepEqual(
    [
      summary.remaining,
      summary.completed,
      summary.skipped,
      summary.active,
      summary.state,
    ],
    [0, 0, 2, 0, 'skipped'],
  );
  assert.equal(focusedSession(sessions)?.id, 'am');
  assert.match(summary.label, /skipp/i);
});

await test('empty days are rest and completed-only days remain inspectable', () => {
  const empty = daySessionSummary([]);
  assert.deepEqual(
    [
      empty.remaining,
      empty.completed,
      empty.skipped,
      empty.active,
      empty.state,
    ],
    [0, 0, 0, 0, 'rest'],
  );
  assert.equal(focusedSession([]) ?? null, null);
  const finished = run('finished', { status: 'completed' });
  assert.equal(focusedSession([finished])?.id, finished.id);
  assert.equal(daySessionSummary([finished]).state, 'completed');
});

await test('semantic tones preserve race and long-run identity before quality, while strides remain easy', () => {
  assert.equal(workoutTone(run('race', { kind: 'race', hard: true })), 'race');
  assert.equal(workoutTone(run('long', { kind: 'long', hard: true })), 'long');
  assert.equal(
    workoutTone(run('tempo', { kind: 'tempo', hard: true })),
    'quality',
  );
  assert.equal(
    workoutTone(run('strides', { stimulus: 'economy', hard: false })),
    'easy',
  );
});

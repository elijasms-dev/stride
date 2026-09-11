import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

// Runs from work/ during review or stride/tests/ after adoption.
const lib = existsSync(new URL('../lib/journal-view.ts', import.meta.url))
  ? new URL('../lib/', import.meta.url)
  : new URL('./stride/lib/', import.meta.url);
const { journalEntries, journalSummary, runDuration } = await import(
  new URL('journal-view.ts', lib)
);
const { makePlan, demoProfile } = await import(new URL('engine.ts', lib));
const { trainingRecords } = await import(new URL('training-history.ts', lib));

function fixture() {
  const start = '2026-12-21';
  const plan = makePlan(demoProfile(start), start);
  const template = structuredClone(plan.workouts[0]);
  const completed = (id, date, actualDate, patch = {}) => ({
    ...structuredClone(template),
    id,
    date,
    minutes: 30,
    estimatedKm: 4.5,
    status: 'completed',
    feedback: {
      actualDate,
      actualMinutes: 42.25,
      actualKm: 6.1234,
      effort: 3,
      feeling: 'good',
      note: `Recorded ${id}`,
      recordedAt: `${actualDate}T19:00:00Z`,
      ...patch,
    },
  });
  const extra = (id, date, patch = {}) => ({
    id,
    date,
    minutes: 20.5,
    km: 3.25,
    effort: 4,
    feeling: 'okay',
    note: `Extra ${id}`,
    recordedAt: `${date}T20:00:00Z`,
    ...patch,
  });
  // Deliberately store neither kind in chronological order. The early and late
  // prescribed dates also order differently from when those runs took place.
  const delayed = completed('delayed', '2026-12-28', '2027-01-02');
  const early = completed('early', '2027-01-04', '2026-12-30');
  const legacy = completed('legacy', '2026-11-30', '2026-11-30');
  delete legacy.feedback.actualDate;
  const beforeNewYear = extra('before-new-year', '2026-12-31');
  const afterNewYear = extra('after-new-year', '2027-01-03');
  const planned = { ...structuredClone(template), id: 'not-yet-run' };
  const skipped = {
    ...structuredClone(template),
    id: 'skipped',
    status: 'skipped',
  };
  plan.workouts = [early, planned, delayed, skipped, legacy];
  plan.extraRuns = [beforeNewYear, afterNewYear];
  return {
    plan,
    completed,
    extra,
    delayed,
    early,
    legacy,
    beforeNewYear,
    afterNewYear,
  };
}

function freezeTree(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeTree(child);
    Object.freeze(value);
  }
  return value;
}

void test('a single journal interleaves both run kinds by actual date across a year and month boundary', () => {
  const { plan } = fixture();
  assert.deepEqual(
    journalEntries(plan).map(({ kind, record }) => [
      kind,
      record.id,
      record.date,
    ]),
    [
      ['extra', 'after-new-year', '2027-01-03'],
      ['planned', 'delayed', '2027-01-02'],
      ['extra', 'before-new-year', '2026-12-31'],
      ['planned', 'early', '2026-12-30'],
      ['planned', 'legacy', '2026-11-30'],
    ],
  );
});

void test('each journal correction action retains the original source object and actual measurements', () => {
  const { plan, delayed, afterNewYear } = fixture();
  const entries = journalEntries(plan);
  const recorded = entries.find(({ record }) => record.id === delayed.id);
  const standalone = entries.find(
    ({ record }) => record.id === afterNewYear.id,
  );
  assert.strictEqual(recorded.workout, delayed);
  assert.strictEqual(standalone.run, afterNewYear);
  assert.equal(recorded.record.minutes, 42.25);
  assert.equal(recorded.record.km, 6.1234);
  assert.equal(recorded.workout.date, '2026-12-28');
  assert.equal(recorded.workout.minutes, 30);
  assert.equal(recorded.workout.estimatedKm, 4.5);
});

void test('journal and training totals use the same canonical activity and id deduplication', () => {
  const { plan, completed, extra, delayed, beforeNewYear } = fixture();
  delayed.feedback.activityId = 'watch:canonical';
  plan.workouts.push(
    completed('duplicate-watch-workout', '2027-01-05', '2027-01-05', {
      activityId: 'watch:canonical',
      actualMinutes: 999,
      actualKm: 99,
    }),
  );
  plan.extraRuns.push(
    extra('duplicate-watch-extra', '2027-01-06', {
      activityId: 'watch:canonical',
      km: 88,
    }),
    extra(beforeNewYear.id, '2027-01-07', { km: 77 }),
  );
  const entries = journalEntries(plan);
  assert.deepEqual(
    entries.map(({ record }) => record),
    trainingRecords(plan),
  );
  assert.equal(entries.length, 5);
  assert.deepEqual(
    entries.map(({ record }) => record.id),
    ['after-new-year', 'delayed', 'before-new-year', 'early', 'legacy'],
  );
  assert.equal(journalSummary(entries).km, 24.8702);
});

void test('a duplicate extra-run id cannot send correction to the discarded copy', () => {
  const { plan, extra, beforeNewYear } = fixture();
  const discarded = extra(beforeNewYear.id, '2027-01-07', {
    minutes: 99,
    km: 77,
  });
  plan.extraRuns.push(discarded);
  const entry = journalEntries(plan).find(
    ({ record }) => record.id === beforeNewYear.id,
  );
  assert.strictEqual(
    entry.record,
    beforeNewYear,
    'Canonical history keeps the first recording',
  );
  assert.strictEqual(
    entry.run,
    beforeNewYear,
    'Correction must edit the recording displayed in this row',
  );
});

void test('a duplicate workout id cannot send correction to a different prescribed session', () => {
  const { plan, completed, delayed } = fixture();
  plan.workouts.push(
    completed(delayed.id, '2027-01-10', '2027-01-09', {
      actualMinutes: 99,
      actualKm: 77,
    }),
  );
  const entry = journalEntries(plan).find(
    ({ record }) => record.id === delayed.id,
  );
  assert.equal(entry.record.date, '2027-01-02');
  assert.strictEqual(
    entry.workout,
    delayed,
    'Correction must target the canonical completed workout',
  );
});

void test('an earlier uncompleted duplicate cannot become the correction target for a completed run', () => {
  const { plan, delayed } = fixture();
  const uncompleted = { ...structuredClone(delayed), status: 'planned' };
  delete uncompleted.feedback;
  plan.workouts.unshift(uncompleted);
  const entry = journalEntries(plan).find(
    ({ record }) => record.id === delayed.id,
  );
  assert.strictEqual(
    entry.workout,
    delayed,
    'Only the completed source supplies this journal row',
  );
});

void test('all unknown distances stay unknown while the complete run count and time remain available', () => {
  const { plan, extra } = fixture();
  plan.workouts = [];
  plan.extraRuns = [
    extra('first', '2026-12-31', { km: null, minutes: 10.25 }),
    extra('second', '2027-01-01', { km: null, minutes: 20.5 }),
  ];
  assert.deepEqual(journalSummary(journalEntries(plan)), {
    count: 2,
    knownDistances: 0,
    missingDistances: 2,
    km: null,
    minutes: 30.75,
  });
});

void test('mixed distances expose partial coverage without dropping the unknown run duration', () => {
  const { plan, delayed, afterNewYear } = fixture();
  plan.workouts = [delayed];
  plan.extraRuns = [afterNewYear];
  afterNewYear.km = null;
  assert.deepEqual(journalSummary(journalEntries(plan)), {
    count: 2,
    knownDistances: 1,
    missingDistances: 1,
    km: 6.1234,
    minutes: 62.75,
  });
});

void test('all known distances retain precision and a measured zero is known rather than missing', () => {
  const { plan, extra } = fixture();
  plan.workouts = [];
  plan.extraRuns = [
    extra('zero', '2026-12-31', { km: 0, minutes: 1 }),
    extra('measured', '2027-01-01', { km: 6.1234, minutes: 42.25 }),
  ];
  assert.deepEqual(journalSummary(journalEntries(plan)), {
    count: 2,
    knownDistances: 2,
    missingDistances: 0,
    km: 6.1234,
    minutes: 43.25,
  });
  assert.equal(
    journalSummary(journalEntries({ ...plan, extraRuns: [plan.extraRuns[0]] }))
      .km,
    0,
  );
});

void test('an empty journal does not manufacture a measured distance', () => {
  const { plan } = fixture();
  plan.workouts = [];
  delete plan.extraRuns;
  assert.deepEqual(journalEntries(plan), []);
  assert.deepEqual(journalSummary([]), {
    count: 0,
    knownDistances: 0,
    missingDistances: 0,
    km: null,
    minutes: 0,
  });
});

void test('run durations preserve seconds and normalize rounding through minute and hour rollovers', () => {
  for (const [minutes, expected] of [
    [0, '0m'],
    [1 / 60, '1s'],
    [59 / 60, '59s'],
    [59.6 / 60, '1m'],
    [1, '1m'],
    [42.25, '42m 15s'],
    [3599 / 60, '59m 59s'],
    [3599.6 / 60, '1h'],
    [60, '1h'],
    [3601 / 60, '1h 1s'],
    [61.25, '1h 1m 15s'],
    [1500, '25h'],
  ])
    assert.equal(runDuration(minutes), expected, `${minutes} minutes`);
});

void test('journal display and totals preserve a frozen plan, recordings, array order and prescribed facts', () => {
  const { plan } = fixture();
  const before = structuredClone(plan);
  freezeTree(plan);
  const entries = journalEntries(plan);
  journalSummary(entries);
  entries.forEach(({ record }) => runDuration(record.minutes));
  assert.deepEqual(plan, before);
  assert.deepEqual(
    journalEntries(plan),
    entries,
    'Repeated reads remain deterministic',
  );
});

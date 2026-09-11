import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

// Works from stride/tests/ after adoption, and from work/ during the read-only audit.
const lib = existsSync(new URL('../lib/journal-loading.ts', import.meta.url))
  ? new URL('../lib/', import.meta.url)
  : new URL('./stride/lib/', import.meta.url);
const { readJournalSnapshot, createJournalLoader } = await import(
  new URL('journal-loading.ts', lib)
);
const { makePlan, demoProfile, adjustPlan, returnReview, advanceReturn } =
  await import(new URL('engine.ts', lib));

const paths = ['/api/state', '/api/profile', '/api/account'];
const tick = () => new Promise((resolve) => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function round(label, accountId = 'account-a', accountEpoch = 2) {
  const stamp = { accountId, accountEpoch };
  const values = {
    '/api/state': { ...stamp, plan: { id: label }, version: 1 },
    '/api/profile': { ...stamp, profile: { name: label } },
    '/api/account': { ...stamp },
  };
  const replies = new Map(paths.map((path) => [path, deferred()]));
  const calls = [];
  return {
    values,
    calls,
    read(path, init) {
      assert.ok(replies.has(path), `Unexpected snapshot endpoint: ${path}`);
      assert.equal(
        calls.some((call) => call.path === path),
        false,
      );
      calls.push({ path, signal: init.signal });
      // Deliberately ignore abort: stale work must be fenced even if a read resolves late.
      return replies.get(path).promise;
    },
    resolve(path, value = values[path]) {
      replies.get(path).resolve(value);
    },
    reject(path, message) {
      replies.get(path).reject(new Error(message));
    },
    resolveAll() {
      for (const path of paths) replies.get(path).resolve(values[path]);
    },
  };
}
function harness() {
  let snapshot = null;
  let currentStatus = { pending: false, error: '' };
  const commits = [],
    statuses = [],
    queued = [];
  const loader = createJournalLoader(
    (signal) => {
      const next = queued.shift();
      assert.ok(next, 'Each refresh needs a controlled endpoint round');
      return readJournalSnapshot(next.read, signal);
    },
    (value) => {
      snapshot = value;
      commits.push(value);
    },
    (pending, error) => {
      currentStatus = { pending, error };
      statuses.push(currentStatus);
    },
  );
  return {
    loader,
    commits,
    statuses,
    get snapshot() {
      return snapshot;
    },
    get status() {
      return currentStatus;
    },
    start(next) {
      queued.push(next);
      return loader.refresh();
    },
  };
}
async function seed(h, label = 'saved-journal') {
  const request = round(label),
    task = h.start(request);
  request.resolveAll();
  await task;
  return h.snapshot;
}

void test('journal commits only after state, profile and matching account all resolve', async () => {
  const h = harness(),
    request = round('complete'),
    task = h.start(request);
  assert.deepEqual(
    request.calls.map((call) => call.path),
    paths,
  );
  assert.ok(
    request.calls.every((call) => call.signal === request.calls[0].signal),
  );
  request.resolve('/api/state');
  await tick();
  assert.equal(h.snapshot, null);
  assert.deepEqual(h.status, { pending: true, error: '' });
  request.resolve('/api/profile');
  await tick();
  assert.equal(h.commits.length, 0);
  request.resolve('/api/account');
  await task;
  assert.equal(h.commits.length, 1);
  assert.deepEqual(h.snapshot, {
    state: request.values['/api/state'],
    profile: request.values['/api/profile'],
    scope: 'account-a:2',
  });
  assert.deepEqual(h.status, { pending: false, error: '' });
});

void test('a partial endpoint failure preserves the last complete snapshot', async () => {
  const h = harness(),
    saved = await seed(h);
  const request = round('partial'),
    task = h.start(request);
  const rejected = assert.rejects(task, /profile temporarily unavailable/);
  request.resolve('/api/state');
  request.reject('/api/profile', 'profile temporarily unavailable');
  await rejected;
  assert.strictEqual(h.snapshot, saved);
  assert.equal(h.commits.length, 1);
  assert.deepEqual(h.status, {
    pending: false,
    error: 'profile temporarily unavailable',
  });
  request.resolve('/api/account');
  await tick();
  assert.strictEqual(h.snapshot, saved);
  assert.equal(h.commits.length, 1);
});

for (const outcome of ['success', 'error']) {
  void test(`an older late ${outcome} cannot replace a newer completed refresh or its status`, async () => {
    const h = harness();
    const old = round('old'),
      oldTask = h.start(old);
    const latest = round('latest'),
      latestTask = h.start(latest);
    assert.equal(old.calls[0].signal.aborted, true);
    latest.resolveAll();
    await latestTask;
    const saved = h.snapshot,
      statusCount = h.statuses.length;
    if (outcome === 'success') old.resolveAll();
    else old.reject('/api/profile', 'late old failure');
    await oldTask;
    assert.strictEqual(h.snapshot, saved);
    assert.equal(h.snapshot.state.plan.id, 'latest');
    assert.equal(h.commits.length, 1);
    assert.equal(h.statuses.length, statusCount);
    assert.deepEqual(h.status, { pending: false, error: '' });
  });
}

void test('a superseded error cannot end the current refresh loading state', async () => {
  const h = harness(),
    old = round('old'),
    oldTask = h.start(old);
  const latest = round('latest'),
    latestTask = h.start(latest);
  const statusCount = h.statuses.length;
  old.reject('/api/state', 'obsolete failure');
  await oldTask;
  assert.deepEqual(h.status, { pending: true, error: '' });
  assert.equal(h.statuses.length, statusCount);
  assert.equal(h.commits.length, 0);
  latest.resolveAll();
  await latestTask;
  assert.equal(h.snapshot.state.plan.id, 'latest');
});

for (const outcome of ['success', 'error']) {
  void test(`cancel aborts the request and discards its eventual ${outcome}`, async () => {
    const h = harness(),
      saved = await seed(h);
    const request = round('cancelled'),
      task = h.start(request);
    h.loader.cancel();
    const statusCount = h.statuses.length;
    assert.equal(request.calls[0].signal.aborted, true);
    if (outcome === 'success') request.resolveAll();
    else request.reject('/api/account', 'cancelled account failure');
    await task;
    assert.strictEqual(h.snapshot, saved);
    assert.equal(h.commits.length, 1);
    assert.equal(h.statuses.length, statusCount);
  });
}

void test('retry clears the visible error immediately and ends pending after a full successful snapshot', async () => {
  const h = harness(),
    saved = await seed(h);
  const failure = round('failed'),
    failedTask = h.start(failure);
  const rejected = assert.rejects(failedTask, /network unavailable/);
  failure.reject('/api/state', 'network unavailable');
  await rejected;
  const retry = round('retry'),
    retryTask = h.start(retry);
  assert.deepEqual(h.status, { pending: true, error: '' });
  assert.strictEqual(h.snapshot, saved);
  retry.resolveAll();
  await retryTask;
  assert.equal(h.snapshot.state.plan.id, 'retry');
  assert.deepEqual(h.status, { pending: false, error: '' });
  assert.equal(h.commits.length, 2);
});

for (const [part, field, value] of [
  ['/api/state', 'accountId', 'different-account'],
  ['/api/profile', 'accountId', 'different-account'],
  ['/api/state', 'accountEpoch', 3],
  ['/api/profile', 'accountEpoch', 3],
]) {
  void test(`a mixed snapshot rejects ${part} with a different ${field}`, async () => {
    const h = harness(),
      saved = await seed(h);
    const request = round('mixed'),
      task = h.start(request);
    const rejected = assert.rejects(task, /account changed while loading/i);
    request.values[part][field] = value;
    request.resolveAll();
    await rejected;
    assert.strictEqual(h.snapshot, saved);
    assert.equal(h.commits.length, 1);
    assert.equal(h.status.pending, false);
    assert.match(h.status.error, /account changed while loading/i);
  });
}

const start = '2026-09-07',
  asOf = '2026-09-21';
function returnFixture() {
  const plan = adjustPlan(
    makePlan(demoProfile(start), start),
    start,
    '2026-09-13',
    'rest',
    start,
  );
  const sessions = plan.workouts.filter(
    (w) => w.date >= '2026-09-14' && w.date < asOf,
  );
  assert.equal(sessions.length, 4);
  // The first recording actually happened before the return stage. Its fatigue
  // must not count; the other three actual dates qualify in the review window.
  const actualDates = ['2026-09-13', '2026-09-15', '2026-09-17', '2026-09-19'];
  sessions.forEach((w, index) => {
    w.status = 'completed';
    w.feedback = {
      actualDate: actualDates[index],
      actualMinutes: w.minutes,
      actualKm: w.estimatedKm,
      effort: index === 0 ? 8 : 3,
      feeling: index === 0 ? 'tired' : 'good',
      note: 'Synthetic return regression; actual date differs from prescription',
      recordedAt: actualDates[index] + 'T18:00:00Z',
    };
  });
  return plan;
}
function extra(patch = {}) {
  return {
    id: 'return-extra',
    date: '2026-09-20',
    minutes: 40,
    km: 6,
    effort: 3,
    feeling: 'good',
    note: 'Synthetic extra-run regression',
    recordedAt: '2026-09-20T19:00:00Z',
    ...patch,
  };
}
function reviewUnchanged(plan) {
  const before = structuredClone(plan),
    result = returnReview(plan, asOf);
  assert.deepEqual(
    plan,
    before,
    'Review must preserve the complete journal and prescriptions',
  );
  return result;
}

void test('return review uses actual dates and preserves all recorded history', () => {
  const result = reviewUnchanged(returnFixture());
  assert.equal(result.ready, true);
  assert.equal(result.completed, 3);
});

for (const [label, patch] of [
  ['tired', { feeling: 'tired', effort: 3 }],
  ['effort at the high-effort boundary', { feeling: 'good', effort: 7 }],
  ['fatigue logged today', { date: asOf, feeling: 'tired', effort: 9 }],
  [
    'fatigue at the start of the evidence window',
    { date: '2026-09-14', feeling: 'tired', effort: 9 },
  ],
]) {
  if (typeof label !== 'string')
    throw new Error('Fixture label must be a string');
  void test(`a recent extra run with ${label} blocks return-stage progression`, () => {
    const plan = returnFixture();
    plan.extraRuns = [extra(patch)];
    const result = reviewUnchanged(plan);
    assert.equal(
      result.completed,
      3,
      'Extra-run fatigue must not erase the comfortable prescribed sessions',
    );
    assert.equal(result.ready, false);
    const before = structuredClone(plan);
    assert.throws(() => advanceReturn(plan, asOf), /remain|comfortable|stage/i);
    assert.deepEqual(plan, before);
  });
}

for (const [label, patch] of [
  [
    'old fatigued run before the evidence window',
    { date: '2026-09-13', feeling: 'tired', effort: 9 },
  ],
  [
    'future run outside the feedback window',
    { date: '2026-09-22', feeling: 'tired', effort: 9 },
  ],
  [
    'comfortable recent run below the high-effort boundary',
    { feeling: 'good', effort: 6 },
  ],
]) {
  if (typeof label !== 'string')
    throw new Error('Fixture label must be a string');
  void test(`${label} does not block comfortable return-stage evidence`, () => {
    const plan = returnFixture();
    plan.extraRuns = [extra(patch)];
    const result = reviewUnchanged(plan);
    assert.equal(result.completed, 3);
    assert.equal(result.ready, true);
  });
}

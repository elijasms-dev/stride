import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fixture,
  owner,
  today,
  readState,
  saveState,
  recovery,
  validateRecovery,
} from './journal-integrity-fixture.mjs';
const {
  enqueueDelivery,
  runDeliveryJob,
  resumeDeliveryJobs,
  listDeliveryJobs,
  DELIVERY_JOB_ATTEMPTS,
} = await import('../lib/delivery-jobs.ts');
const { HttpError, RETAINED_REVISIONS } = await import('../lib/server.ts');
const { POST: queueRoute } = await import('../app/api/delivery-jobs/route.ts');
const { syncWorkout } = await import('../lib/garmin.ts');

async function setup(t) {
  const f = await fixture(t),
    plan = await f.seedPlan();
  await f.connect();
  const upcoming = plan.workouts.filter((w) => w.date >= today);
  const queue = (w = upcoming[0], action = 'send') =>
    enqueueDelivery(owner, 0, w.id, 1, action);
  const due = () =>
    f.db.exec(
      "UPDATE delivery_jobs SET available_at='2000-01-01T00:00:00.000Z' WHERE status='retry'",
    );
  return { ...f, plan, upcoming, queue, due };
}

test('jobs persist exact intent and repeated enqueue shares one pending request; completion is durable', async (t) => {
  const f = await setup(t);
  const id = await f.queue();
  assert.equal(await f.queue(), id);
  assert.equal((await listDeliveryJobs(owner, 0)).length, 1);
  let calls = 0;
  const execute = async (...args) => {
    calls++;
    assert.deepEqual(args, [
      owner,
      f.upcoming[0].id,
      1,
      false,
      0,
      false,
      { athleteId: 'athlete', generation: 'connection-1' },
    ]);
    return { status: 'accepted', remoteId: 'remote-1' };
  };
  assert.equal(
    (await runDeliveryJob(owner, 0, id, execute)).status,
    'accepted',
  );
  assert.equal(
    (await runDeliveryJob(owner, 0, id, execute)).status,
    'accepted',
  );
  assert.equal(calls, 1);
  assert.equal((await listDeliveryJobs(owner, 0))[0].status, 'complete');
});

test('network interruption survives restart, waits for backoff, and resumes the saved intent only once', async (t) => {
  const f = await setup(t),
    id = await f.queue();
  const fail = async () => {
    throw new HttpError(503, 'Temporary network failure');
  };
  const result = await runDeliveryJob(owner, 0, id, fail);
  assert.equal(result.status, 'queued');
  assert.ok(Date.parse(result.retryAt) >= Date.now() + 14000);
  assert.equal(
    f.db.prepare('SELECT status FROM delivery_jobs').get().status,
    'retry',
  );
  let calls = 0;
  const success = async () => {
    calls++;
    return { status: 'accepted' };
  };
  assert.equal((await runDeliveryJob(owner, 0, id, success)).status, 'queued');
  assert.equal(
    calls,
    0,
    'backoff cannot be bypassed by reopening or clicking resume',
  );
  f.due();
  const resumed = await resumeDeliveryJobs(owner, 0, success);
  assert.equal(resumed.results[0].status, 'accepted');
  assert.equal(calls, 1);
  assert.equal(resumed.jobs[0].attempts, 2);
});

test('provider cooldown and authorization rejection stop a resume batch after its first request', async (t) => {
  const f = await setup(t);
  await f.queue(f.upcoming[0]);
  await f.queue(f.upcoming[1]);
  let calls = 0;
  const rateLimited = async () => {
    calls++;
    const e = new HttpError(429, 'Slow down');
    e.retryAfter = 7200;
    throw e;
  };
  const before = Date.now();
  const result = await resumeDeliveryJobs(owner, 0, rateLimited);
  assert.equal(calls, 1);
  assert.equal(result.results[0].errorStatus, 429);
  assert.ok(Date.parse(result.results[0].retryAt) >= before + 7200000);
  const denied = async () => {
    calls++;
    throw new HttpError(401, 'Reconnect this account');
  };
  await f.queue(f.upcoming[2]);
  const rejected = await resumeDeliveryJobs(owner, 0, denied);
  assert.equal(calls, 2);
  assert.equal(rejected.results.length, 1);
  assert.equal(rejected.results[0].status, 'review');
});

test('one owner has only one active worker; expired leases recover after process termination', async (t) => {
  const f = await setup(t),
    id = await f.queue(),
    second = await f.queue(f.upcoming[1]);
  let release, started;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const begun = new Promise((resolve) => {
    started = resolve;
  });
  const running = runDeliveryJob(owner, 0, id, async () => {
    started();
    await gate;
    return { status: 'accepted' };
  });
  await begun;
  let attempts = 0;
  const execute = async () => {
    attempts++;
    return { status: 'accepted' };
  };
  assert.equal((await runDeliveryJob(owner, 0, id, execute)).status, 'queued');
  assert.equal(
    (await runDeliveryJob(owner, 0, second, execute)).status,
    'queued',
  );
  assert.equal(attempts, 0);
  release();
  await running;
  f.db
    .prepare(
      "UPDATE delivery_jobs SET status='processing',lease_until='2000-01-01',lease_token='killed-process',attempts=1 WHERE id=?",
    )
    .run(second);
  assert.equal(
    (await runDeliveryJob(owner, 0, second, execute)).status,
    'accepted',
  );
  assert.equal(attempts, 1);
});

test('queued jobs never move to a different plan version, edited prescription, or reconnected athlete', async (t) => {
  for (const changed of ['version', 'prescription', 'connection']) {
    await t.test(changed, async (t) => {
      const f = await setup(t),
        id = await f.queue();
      if (changed === 'version')
        f.db
          .prepare('UPDATE athlete_state SET version=2 WHERE owner=?')
          .run(owner);
      if (changed === 'prescription') {
        const plan = structuredClone(f.plan);
        plan.workouts.find((w) => w.id === f.upcoming[0].id).title =
          'Changed prescription';
        f.db
          .prepare('UPDATE athlete_state SET data=? WHERE owner=?')
          .run(JSON.stringify(plan), owner);
      }
      if (changed === 'connection')
        f.db
          .prepare(
            "UPDATE connections SET provider_athlete_id='other-athlete',generation='new-generation' WHERE owner=?",
          )
          .run(owner);
      let executed = false;
      const result = await runDeliveryJob(owner, 0, id, async () => {
        executed = true;
        return { status: 'accepted' };
      });
      assert.equal(result.status, 'review');
      assert.equal(executed, false);
    });
  }
});

test('adapter rechecks the captured connection before any provider request, closing the dispatch race', async (t) => {
  const f = await setup(t);
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    throw new Error('Must not dispatch');
  };
  await assert.rejects(
    syncWorkout(owner, f.upcoming[0].id, 1, false, 0, false, {
      athleteId: 'old-athlete',
      generation: 'old-generation',
    }),
    /connected account changed/,
  );
  assert.equal(calls, 0);
});

test('retry budget is finite and cannot silently become an endless provider loop', async (t) => {
  const f = await setup(t),
    id = await f.queue();
  let calls = 0;
  const fail = async () => {
    calls++;
    throw new HttpError(503, 'Network timeout');
  };
  let result;
  for (let i = 0; i < DELIVERY_JOB_ATTEMPTS; i++) {
    f.due();
    result = await runDeliveryJob(owner, 0, id, fail);
  }
  assert.equal(result.status, 'review');
  assert.equal(calls, DELIVERY_JOB_ATTEMPTS);
  await runDeliveryJob(owner, 0, id, fail);
  assert.equal(calls, DELIVERY_JOB_ATTEMPTS);
});

test('the actual provider adapter cannot blindly recreate an upload after its POST response was lost', async (t) => {
  const f = await setup(t),
    id = await f.queue();
  let creations = 0,
    lookups = 0;
  globalThis.fetch = async (url, init = {}) => {
    assert.ok(
      String(url).startsWith(
        'https://intervals.icu/api/v1/athlete/athlete/events',
      ),
    );
    if (init.method === 'POST') {
      creations++;
      throw new TypeError('Synthetic lost POST response');
    }
    assert.ok(!init.method || init.method === 'GET');
    lookups++;
    return Response.json([]);
  };
  assert.equal((await runDeliveryJob(owner, 0, id)).status, 'queued');
  assert.equal(creations, 1);
  assert.equal(
    f.db.prepare('SELECT create_outcome FROM deliveries').get().create_outcome,
    'unknown',
  );
  f.due();
  const retried = await runDeliveryJob(owner, 0, id);
  assert.equal(retried.status, 'review');
  assert.match(retried.message, /uncertain outcome/);
  assert.equal(creations, 1);
  assert.equal(lookups, 2);
});

test('pending delivery quotas are enforced without creating an extra job', async (t) => {
  const f = await setup(t);
  assert.ok(f.upcoming.length > 20);
  for (const workout of f.upcoming.slice(0, 20)) await f.queue(workout);
  await assert.rejects(f.queue(f.upcoming[20]), /queue is full/);
  assert.equal((await listDeliveryJobs(owner, 0)).length, 20);
  assert.equal(
    await f.queue(f.upcoming[0]),
    (await listDeliveryJobs(owner, 0)).find(
      (j) => j.workout_id === f.upcoming[0].id,
    ).id,
  );
});

test('cancel is account-scoped, prevents execution, and rejects cancellation of an active request', async (t) => {
  const f = await setup(t),
    id = await f.queue();
  const cancelled = await queueRoute(f.request({ action: 'cancel', id }));
  assert.equal(cancelled.status, 200);
  let calls = 0;
  assert.equal(
    (
      await runDeliveryJob(owner, 0, id, async () => {
        calls++;
        return { status: 'accepted' };
      })
    ).status,
    'cancelled',
  );
  assert.equal(calls, 0);
  const other = await f.queue(f.upcoming[1]);
  f.db
    .prepare(
      "UPDATE delivery_jobs SET status='processing',lease_until=? WHERE id=?",
    )
    .run(new Date(Date.now() + 60000).toISOString(), other);
  assert.equal(
    (await queueRoute(f.request({ action: 'cancel', id: other }))).status,
    409,
  );
});

test('account recovery clears queued work and epoch-fences a stale worker', async (t) => {
  const f = await setup(t),
    id = await f.queue();
  const preview = await (
    await recovery(f.request({ action: 'preview', kind: 'delete' }))
  ).json();
  const response = await recovery(
    f.request({
      action: 'commit',
      kind: 'delete',
      id: preview.id,
      confirm: 'DELETE',
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(
    f.db.prepare('SELECT count(*) AS n FROM delivery_jobs').get().n,
    0,
  );
  await assert.rejects(
    runDeliveryJob(owner, 0, id, async () => ({ status: 'accepted' })),
    /account changed/,
  );
});

test('retention compacts only old snapshots after a successful save and keeps undo plus full recovery', async (t) => {
  const f = await fixture(t),
    plan = await f.seedPlan();
  const payload = JSON.stringify(plan);
  for (let version = 2; version <= 75; version++)
    f.db
      .prepare(
        'INSERT INTO revisions(owner,version,data,label,created_at) VALUES(?,?,?,?,?)',
      )
      .run(
        owner,
        version,
        payload,
        'Synthetic revision',
        new Date().toISOString(),
      );
  f.db.prepare('UPDATE athlete_state SET version=75 WHERE owner=?').run(owner);
  const next = await saveState(owner, 75, plan, 'Retention trigger', 0);
  const versions = f.db
    .prepare('SELECT version FROM revisions WHERE owner=? ORDER BY version')
    .all(owner)
    .map((r) => r.version);
  assert.equal(versions.length, RETAINED_REVISIONS);
  assert.deepEqual(versions.slice(-2), [75, 76]);
  assert.equal(versions[0], 27);
  assert.deepEqual(
    next.plan.workouts,
    plan.workouts,
    'actual journal contents are not compacted',
  );
  assert.ok(
    validateRecovery({
      format: 'stride-recovery-2',
      exportedAt: new Date().toISOString(),
      profile: null,
      plan: next.plan,
      standaloneRuns: [],
    }).plan,
  );
  const undo = await f.action({ action: 'undo', version: 76 });
  assert.equal(undo.status, 200, JSON.stringify(undo.data));
  assert.equal(
    f.db.prepare('SELECT count(*) AS n FROM revisions WHERE owner=?').get(owner)
      .n,
    RETAINED_REVISIONS,
  );
  const countBefore = f.db
    .prepare('SELECT count(*) AS n FROM revisions')
    .get().n;
  await assert.rejects(
    saveState(owner, 74, plan, 'Rejected stale save', 0),
    /journal or account changed/,
  );
  assert.equal(
    f.db.prepare('SELECT count(*) AS n FROM revisions').get().n,
    countBefore,
  );
});

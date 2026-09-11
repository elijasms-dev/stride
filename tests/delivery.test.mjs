// Offline acceptance tests against actual Stride adapters and actual receipt SQL.
// Run with the bundled Node: node --experimental-strip-types --test work/integration-acceptance.mjs
// Never loads .env or provider credentials. Only synthetic fetch responses are allowed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
let fixtureSqlite;
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const site = new URL('../', import.meta.url);
const owner = 'integration-acceptance-owner';
const athleteId = 'i900000000';
const generation = 'test-generation-1';
globalThis.integrationAcceptanceEnv = {
  DB: null,
  STRIDE_ENCRYPTION_KEY: 'synthetic-test-secret-never-a-real-account-key',
};
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'cloudflare:workers')
      return {
        url: 'data:text/javascript,export const env=globalThis.integrationAcceptanceEnv;',
        shortCircuit: true,
      };
    if (context.parentURL?.startsWith(site.href)) {
      const base = specifier.startsWith('@/')
        ? new URL(specifier.slice(2), site)
        : specifier.startsWith('.')
          ? new URL(specifier, context.parentURL)
          : null;
      if (base)
        for (const suffix of ['', '.ts', '.tsx', '/index.ts']) {
          const url = new URL(base.href + suffix);
          if (existsSync(url)) return { url: url.href, shortCircuit: true };
        }
    }
    return nextResolve(specifier, context);
  },
});
globalThis.fetch = async (...args) => {
  if (!globalThis.integrationAcceptanceFetch)
    throw new Error('Unmocked fetch prohibited');
  return globalThis.integrationAcceptanceFetch(...args);
};
const { syncWorkout } = await import(new URL('lib/garmin.ts', site));
const { GET: getActivities } = await import(
  new URL('app/api/activities/route.ts', site)
);
const { GET: getState } = await import(new URL('app/api/state/route.ts', site));
const { POST: reconcile } = await import(
  new URL('app/api/reconcile/route.ts', site)
);
const { POST: updatePlan } = await import(
  new URL('app/api/plan/route.ts', site)
);
const { encrypt } = await import(new URL('lib/server.ts', site));
const { makePlan, demoProfile, todayInZone, addDays } = await import(
  new URL('lib/engine.ts', site)
);
const today = todayInZone('UTC');

function d1(sqlite, options) {
  const execute = (sql, values, method, column) => {
    if (method === 'run' && options.beforeRun)
      options.beforeRun(sqlite, sql, values);
    if (
      method === 'run' &&
      options.dropReceipt &&
      /^\s*UPDATE\s+["`]?deliveries["`]?\s/i.test(sql) &&
      (/SET\s+remote_id\s*=/i.test(sql) ||
        values.some((v) => ['accepted', 'verified', 'confirmed'].includes(v)))
    ) {
      options.dropped = true;
      return { success: true, meta: { changes: 0 } };
    }
    const stmt = sqlite.prepare(sql);
    if (method === 'first') {
      const row = stmt.get(...values) ?? null;
      return column ? (row?.[column] ?? null) : row;
    }
    if (method === 'all')
      return { results: stmt.all(...values), success: true, meta: {} };
    const info = stmt.run(...values);
    return {
      success: true,
      meta: {
        changes: Number(info.changes),
        last_row_id: Number(info.lastInsertRowid),
      },
    };
  };
  const prepare = (sql, values = []) => ({
    bind: (...args) => prepare(sql, args),
    first: async (column) => execute(sql, values, 'first', column),
    all: async () => execute(sql, values, 'all'),
    run: async () => execute(sql, values, 'run'),
  });
  return {
    prepare,
    batch: async (statements) => {
      sqlite.exec('BEGIN');
      try {
        const results = [];
        for (const s of statements) results.push(await s.run());
        sqlite.exec('COMMIT');
        return results;
      } catch (e) {
        sqlite.exec('ROLLBACK');
        throw e;
      }
    },
    exec: async (sql) => {
      sqlite.exec(sql);
      return { count: 1, duration: 0 };
    },
  };
}
function insertKnown(sqlite, table, values) {
  const columns = new Set(
    sqlite
      .prepare(`PRAGMA table_info(${table})`)
      .all()
      .map((c) => c.name),
  );
  const entries = Object.entries(values).filter(([k]) => columns.has(k));
  sqlite
    .prepare(
      `INSERT INTO ${table} (${entries.map(([k]) => k).join(',')}) VALUES (${entries.map(() => '?').join(',')})`,
    )
    .run(...entries.map(([, v]) => v));
}
async function fixture(options = {}) {
  const sqlite = (fixtureSqlite = new DatabaseSync(':memory:'));
  const migrationDir = new URL('drizzle/', site);
  for (const filename of readdirSync(migrationDir)
    .filter((x) => /^\d+.*\.sql$/.test(x))
    .sort()) {
    sqlite.exec(readFileSync(new URL(filename, migrationDir), 'utf8'));
  }
  globalThis.integrationAcceptanceEnv.DB = d1(sqlite, options);
  const { readAccount } = await import(new URL('lib/accounts.ts', site));
  await readAccount(owner);
  const plan = makePlan({ ...demoProfile(today), startDate: today }, today);
  plan.profile.timezone = 'UTC';
  const w = {
    ...plan.workouts[0],
    date: options.workoutDate ?? addDays(today, 2),
    status: options.skipped ? 'skipped' : 'planned',
  };
  plan.workouts = options.withoutWorkout
    ? []
    : options.keepFullPlan
      ? [w, ...plan.workouts.slice(1)]
      : [w];
  const state = { version: 3, plan };
  insertKnown(sqlite, 'athlete_state', {
    owner,
    version: 3,
    data: JSON.stringify(plan),
    updated_at: new Date().toISOString(),
  });
  if (!options.disconnected)
    insertKnown(sqlite, 'connections', {
      owner,
      encrypted_key: await encrypt('synthetic-personal-key'),
      athlete_name: 'Synthetic runner',
      connected_at: new Date().toISOString(),
      provider_athlete_id: athleteId,
      athlete_id: athleteId,
      generation,
      connection_generation: generation,
      status: 'connected',
    });
  if (options.receipt)
    insertKnown(sqlite, 'deliveries', {
      owner,
      workout_id: w.id,
      version: 2,
      remote_id: '77',
      status: 'accepted',
      message: 'Synthetic receipt',
      updated_at: new Date(Date.now() - 300000).toISOString(),
      provider_athlete_id: athleteId,
      athlete_id: athleteId,
      connection_generation: generation,
      generation,
      attempt_id: null,
      create_outcome: 'known',
      attempt_count: 0,
      ...options.receipt,
    });
  let remote = {
    id: 77,
    athlete_id: athleteId,
    calendar_id: 1,
    category: 'WORKOUT',
    type: 'Run',
    external_id: options.foreignExternal
      ? 'another-app:foreign-workout'
      : `stride:${w.id}`,
    name: w.title,
    start_date_local:
      (options.remoteDate ?? w.date) + 'T' + (w.startTime ?? '00:00') + ':00',
    workout_doc: {
      duration: w.steps.reduce((sum, s) => sum + s.seconds, 0),
      distance: w.steps.reduce((sum, s) => sum + (s.metres ?? 0), 0),
      steps: w.steps.map((s) => ({
        duration: s.seconds,
        distance: s.metres ?? 0,
        text: s.effort,
        name: s.label,
      })),
    },
  };
  let exists = !options.absent;
  const calls = [];
  globalThis.integrationAcceptanceFetch = async (input, init = {}) => {
    const url = new URL(
      typeof input === 'string' || input instanceof URL ? input : input.url,
    );
    assert.equal(
      url.origin,
      'https://intervals.icu',
      'Only the expected synthetic provider host is permitted',
    );
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const method = init.method ?? 'GET';
    calls.push({
      path,
      method,
      body: init.body,
      query: Object.fromEntries(url.searchParams),
    });
    if (method === 'GET' && /\/athlete\/[^/]+$/.test(path))
      return Response.json({ id: athleteId, name: 'Synthetic runner' });
    if (method === 'GET' && path.endsWith('/activities')) {
      if (options.undoDuringRead) {
        state.version = 4;
        state.plan.workouts[0].status = 'planned';
        sqlite
          .prepare('UPDATE athlete_state SET version=?,data=? WHERE owner=?')
          .run(4, JSON.stringify(state.plan), owner);
      }
      if (options.rotateActivityConnection)
        sqlite
          .prepare('UPDATE connections SET generation=? WHERE owner=?')
          .run('changed-during-import', owner);
      return Response.json(options.activities ?? []);
    }
    if (method === 'GET' && path.endsWith('/events'))
      return Response.json(
        exists
          ? options.duplicateExternal
            ? [remote, { ...remote, id: 78 }]
            : [remote]
          : [],
      );
    if (
      method === 'GET' &&
      path.endsWith('/events/88') &&
      options.wrongPutReceipt
    )
      return Response.json({ ...remote, id: 88 });
    if (method === 'GET' && path.endsWith('/events/77')) {
      if (
        options.failReadbackOnce &&
        calls.some((c) => ['POST', 'PUT'].includes(c.method))
      ) {
        options.failReadbackOnce = false;
        options.readbackFailed = true;
        return new Response(null, { status: 503 });
      }
      return exists
        ? Response.json(remote)
        : new Response(null, { status: 404 });
    }
    if (method === 'DELETE' && path.endsWith('/events/77')) {
      exists = false;
      return new Response(null, { status: 204 });
    }
    if (
      (method === 'POST' && path.endsWith('/events/bulk')) ||
      (method === 'PUT' && path.endsWith('/events/77'))
    ) {
      const value = JSON.parse(init.body),
        event = Array.isArray(value) ? value[0] : value;
      remote = { ...remote, ...event };
      if (options.badSemantics)
        Object.assign(remote, {
          start_date_local: '2030-01-01T00:00:00',
          type: 'Ride',
          workout_doc: { steps: [] },
        });
      if (options.badTargets)
        remote.workout_doc.steps = remote.workout_doc.steps.map((s) => ({
          ...s,
          pace: { start: 4, end: 5, units: 'm/s' },
        }));
      if (options.badCues)
        remote.workout_doc.steps = remote.workout_doc.steps.map((s) => ({
          ...s,
          text: 'Run all out',
          name: 'Sprint',
        }));
      exists = true;
      if (method === 'POST' && options.losePostResponseOnce) {
        options.losePostResponseOnce = false;
        options.postResponseLost = true;
        throw new Error('Synthetic response loss after provider commit');
      }
      return Response.json(
        method === 'POST'
          ? [remote]
          : options.wrongPutReceipt
            ? { ...remote, id: 88 }
            : remote,
      );
    }
    throw new Error(
      `Unmocked provider operation prohibited: ${method} ${path}`,
    );
  };
  return { sqlite, options, state, w, calls, remote: () => clone(remote) };
}
async function outcome(f, version = 3, confirm = false) {
  try {
    return await syncWorkout(owner, f.w.id, version, confirm);
  } catch (error) {
    return { status: 'rejected', error };
  }
}
function notCertified(result) {
  assert.ok(
    !['accepted', 'confirmed', 'verified'].includes(result.status),
    `Unexpected certification: ${result.status}`,
  );
}
void test('control: a valid event update reaches the provider using actual encrypted credentials and SQL', async (t) => {
  const f = await fixture({ receipt: {} });
  t.after(() => f.sqlite.close());
  const result = await outcome(f);
  assert.ok(
    ['accepted', 'verified', 'accepted_pending_verification'].includes(
      result.status,
    ),
    result.error?.message ?? result.status,
  );
  assert.equal(f.calls.filter((c) => c.method === 'PUT').length, 1);
});
void test('A01: an old accepted receipt must not certify a disconnected provider', async (t) => {
  const f = await fixture({ receipt: { version: 3 }, disconnected: true });
  t.after(() => f.sqlite.close());
  notCertified(await outcome(f));
  assert.equal(f.calls.length, 0);
});
void test('A02: undo during a cancellation lookup must prevent DELETE', async (t) => {
  const f = await fixture({ receipt: {}, skipped: true, undoDuringRead: true });
  t.after(() => f.sqlite.close());
  const result = await outcome(f);
  assert.equal(f.state.plan.workouts[0].status, 'planned');
  assert.equal(
    f.calls.filter((c) => c.method === 'DELETE').length,
    0,
    'Restored workout was deleted',
  );
  notCertified(result);
});
void test('A03: wrong date, sport and empty parsed steps must not certify a prescription', async (t) => {
  const f = await fixture({ receipt: {}, badSemantics: true });
  t.after(() => f.sqlite.close());
  const result = await outcome(f);
  assert.equal(
    f.calls.filter((c) => c.method === 'PUT').length,
    1,
    'Fault must reach the provider response',
  );
  notCertified(result);
});
void test('A04: a zero-row final receipt commit must not certify delivery', async (t) => {
  const f = await fixture({ receipt: {}, dropReceipt: true });
  t.after(() => f.sqlite.close());
  const result = await outcome(f);
  assert.equal(
    f.options.dropped,
    true,
    'Fault injection must intercept the final receipt commit',
  );
  notCertified(result);
});
void test('A05: an uncertain prior create plus an empty bounded lookup must not POST again', async (t) => {
  const f = await fixture({
    receipt: { status: 'failed', remote_id: null, create_outcome: 'unknown' },
    absent: true,
  });
  t.after(() => f.sqlite.close());
  const result = await outcome(f);
  assert.equal(
    f.calls.filter((c) => c.method === 'POST').length,
    0,
    'Uncertain creation was sent again',
  );
  notCertified(result);
});
void test('A06: imports preserve time and pairing, and disclose any page truncation', async (t) => {
  const f = await fixture({
    activities: Array.from({ length: 101 }, (_, i) => ({
      id: `i${i}`,
      type: 'Run',
      name: 'Run',
      start_date_local: today + 'T18:31:22',
      start_date: today + 'T15:31:22Z',
      timezone: 'Europe/Vilnius',
      distance: 5000,
      moving_time: 1800,
      elapsed_time: 1850,
      paired_event_id: 77,
      source: 'GARMIN',
    })),
  });
  t.after(() => f.sqlite.close());
  const response = await getActivities(
    new Request('https://stride.test/api/activities', {
      headers: { 'oai-authenticated-user-id': owner },
    }),
  );
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.ok(
    data.activities.length === 101 ||
      (data.hasMore === true &&
        typeof data.nextCursor === 'string' &&
        data.nextCursor),
    'Truncated import needs an actionable next cursor',
  );
  const a = data.activities[0];
  assert.equal(
    a.startLocal ?? a.startDateLocal ?? a.start_date_local,
    today + 'T18:31:22',
    'Local start time was discarded',
  );
  assert.equal(
    String(a.pairedEventId ?? a.paired_event_id),
    '77',
    'Provider pairing was discarded',
  );
  assert.equal(a.timezone, 'Europe/Vilnius');
});

const privateRequest = (path, method = 'GET') =>
  new Request('https://stride.test' + path, {
    method,
    headers: {
      'oai-authenticated-user-id': owner,
      origin: 'https://stride.test',
      'content-type': 'application/json',
      'x-stride-account':
        fixtureSqlite
          .prepare('SELECT account_id FROM accounts WHERE owner=?')
          .get(owner)?.account_id ?? '',
      'x-stride-epoch': '0',
    },
    ...(method === 'POST' ? { body: '{}' } : {}),
  });
function saveFixtureState(f, version) {
  f.state.version = version;
  f.sqlite
    .prepare('UPDATE athlete_state SET version=?,data=? WHERE owner=?')
    .run(version, JSON.stringify(f.state.plan), owner);
}
void test('B01: successful POST identity survives a failed readback', async (t) => {
  const f = await fixture({ absent: true, failReadbackOnce: true });
  t.after(() => f.sqlite.close());
  notCertified(await outcome(f));
  assert.equal(
    f.options.readbackFailed,
    true,
    'Readback fault was not exercised',
  );
  assert.equal(f.calls.filter((c) => c.method === 'POST').length, 1);
  const receipt = f.sqlite
    .prepare(
      'SELECT remote_id FROM deliveries WHERE owner=? AND provider_athlete_id=? AND workout_id=?',
    )
    .get(owner, athleteId, f.w.id);
  assert.equal(
    receipt?.remote_id,
    '77',
    'Known POST receipt was discarded before readback',
  );
});
void test('B02: matching durations with changed targets must not certify', async (t) => {
  const f = await fixture({ receipt: {}, badTargets: true });
  t.after(() => f.sqlite.close());
  const result = await outcome(f);
  assert.equal(f.calls.filter((c) => c.method === 'PUT').length, 1);
  notCertified(result);
});
void test('B03: reconnect generation cannot expose an old acceptance as current', async (t) => {
  const f = await fixture({ receipt: {} });
  t.after(() => f.sqlite.close());
  assert.equal((await outcome(f)).status, 'accepted');
  f.sqlite
    .prepare('UPDATE connections SET generation=? WHERE owner=?')
    .run('test-generation-2', owner);
  const response = await getState(privateRequest('/api/state'));
  assert.equal(response.status, 200);
  const data = await response.json(),
    row = data.deliveries.find((d) => d.workout_id === f.w.id);
  if (row)
    assert.ok(
      !['accepted', 'confirmed'].includes(row.status) ||
        row.current === false ||
        row.isCurrent === false,
      'Old generation exposed as currently accepted',
    );
});
void test('B04: bulk reconcile must not migrate another account receipt into the current account', async (t) => {
  const f = await fixture({ receipt: {}, absent: true });
  t.after(() => f.sqlite.close());
  f.sqlite
    .prepare(
      'UPDATE connections SET provider_athlete_id=?,generation=? WHERE owner=?',
    )
    .run('i900000001', 'account-b-generation', owner);
  const response = await reconcile(privateRequest('/api/reconcile', 'POST'));
  assert.equal(response.status, 200);
  assert.equal(
    f.calls.filter((c) => ['POST', 'PUT', 'DELETE'].includes(c.method)).length,
    0,
    'Old account candidate caused a new-account write',
  );
});
void test('B05: a connection change immediately before final SQL cannot certify acceptance', async (t) => {
  const f = await fixture({ receipt: {} });
  t.after(() => f.sqlite.close());
  f.options.beforeRun = (sqlite, sql, values) => {
    if (
      /^\s*UPDATE\s+deliveries/i.test(sql) &&
      values.includes('accepted') &&
      !f.options.rotated
    ) {
      f.options.rotated = true;
      sqlite
        .prepare('UPDATE connections SET generation=? WHERE owner=?')
        .run('changed-after-fence', owner);
    }
  };
  const result = await outcome(f);
  assert.equal(f.options.rotated, true, 'Final SQL race was not exercised');
  notCertified(result);
});
void test('B06: plan change immediately before confirmation SQL cannot certify the old prescription', async (t) => {
  const f = await fixture({ receipt: {} });
  t.after(() => f.sqlite.close());
  assert.equal((await outcome(f)).status, 'accepted');
  f.options.beforeRun = (sqlite, sql) => {
    if (
      /UPDATE\s+deliveries\s+SET\s+status='confirmed'/i.test(sql) &&
      !f.options.changedBeforeConfirm
    ) {
      f.options.changedBeforeConfirm = true;
      f.state.plan.workouts[0].steps[0].effort = 'Different prescribed effort';
      saveFixtureState(f, 4);
    }
  };
  const result = await outcome(f, 3, true);
  assert.equal(
    f.options.changedBeforeConfirm,
    true,
    'Confirmation SQL race was not exercised',
  );
  notCertified(result);
});
void test('B07: lost POST response followed by skip and undo remains recoverable', async (t) => {
  const f = await fixture({ absent: true, losePostResponseOnce: true });
  t.after(() => f.sqlite.close());
  notCertified(await outcome(f));
  assert.equal(f.options.postResponseLost, true);
  f.state.plan.workouts[0].status = 'skipped';
  saveFixtureState(f, 4);
  assert.equal((await outcome(f, 4)).status, 'removed');
  assert.equal(f.calls.filter((c) => c.method === 'DELETE').length, 1);
  f.state.plan.workouts[0].status = 'planned';
  saveFixtureState(f, 5);
  const restored = await outcome(f, 5);
  assert.equal(
    restored.status,
    'accepted',
    restored.error?.message ?? 'Verified cancellation was not reversible',
  );
  assert.equal(
    f.calls.filter((c) => c.method === 'POST').length,
    2,
    'Undo must create exactly one replacement after verified deletion',
  );
});
void test('B08: unchanged accepted prescription remains current after an unrelated journal edit', async (t) => {
  const f = await fixture({ receipt: {} });
  t.after(() => f.sqlite.close());
  assert.equal((await outcome(f)).status, 'accepted');
  saveFixtureState(f, 4);
  f.calls.length = 0;
  assert.equal((await outcome(f, 4)).status, 'accepted');
  assert.equal(
    f.calls.filter((c) => c.method === 'PUT').length,
    0,
    'Unchanged bytes should not be rewritten',
  );
  const response = await getState(privateRequest('/api/state')),
    data = await response.json();
  const row = data.deliveries.find((d) => d.workout_id === f.w.id);
  const stillUsesVersion = /d\.version\s*!==\s*data\.version/.test(
    readFileSync(new URL('components/stride-app.tsx', site), 'utf8'),
  );
  if (stillUsesVersion)
    assert.equal(
      row.version,
      data.version,
      'Existing UI still marks this unchanged receipt stale forever',
    );
  else
    assert.ok(
      row.current === true ||
        row.isCurrent === true ||
        row.version === data.version,
      'Expose a current-receipt fact for the UI',
    );
});
void test('B09: reconnect to same athlete revalidates old-generation accepted receipts', async (t) => {
  const f = await fixture({ receipt: {} });
  t.after(() => f.sqlite.close());
  assert.equal((await outcome(f)).status, 'accepted');
  f.calls.length = 0;
  f.sqlite
    .prepare('UPDATE connections SET generation=? WHERE owner=?')
    .run('test-generation-2', owner);
  const response = await reconcile(privateRequest('/api/reconcile', 'POST'));
  assert.equal(response.status, 200);
  assert.ok(
    f.calls.some((c) => c.method === 'GET' && c.path.includes('/events')),
    'Reconcile ignored generation mismatch at unchanged journal version',
  );
});
void test('B10: plan change immediately before final receipt SQL cannot certify old bytes', async (t) => {
  const f = await fixture({ receipt: {} });
  t.after(() => f.sqlite.close());
  f.options.beforeRun = (sqlite, sql, values) => {
    if (
      /^\s*UPDATE\s+deliveries/i.test(sql) &&
      values.includes('accepted') &&
      !f.options.changedBeforeFinal
    ) {
      f.options.changedBeforeFinal = true;
      f.state.plan.workouts[0].steps[0].effort =
        'A changed prescription after readback';
      saveFixtureState(f, 4);
    }
  };
  const result = await outcome(f);
  assert.equal(
    f.options.changedBeforeFinal,
    true,
    'Final receipt SQL race was not exercised',
  );
  notCertified(result);
});
void test('B11: a plan change while persisting unknown-create state must stop POST', async (t) => {
  const f = await fixture({ absent: true });
  t.after(() => f.sqlite.close());
  f.options.beforeRun = (sqlite, sql) => {
    if (
      /UPDATE\s+deliveries\s+SET\s+create_outcome='unknown'/i.test(sql) &&
      !f.options.changedBeforePost
    ) {
      f.options.changedBeforePost = true;
      f.state.plan.workouts[0].status = 'skipped';
      saveFixtureState(f, 4);
    }
  };
  const result = await outcome(f);
  assert.equal(
    f.options.changedBeforePost,
    true,
    'Pre-POST state persistence race was not exercised',
  );
  assert.equal(
    f.calls.filter((c) => c.method === 'POST').length,
    0,
    'Outdated workout was posted after its state changed',
  );
  notCertified(result);
});
void test('B12: PUT response identity must refer to the event that was actually updated', async (t) => {
  const f = await fixture({ receipt: {}, wrongPutReceipt: true });
  t.after(() => f.sqlite.close());
  const result = await outcome(f);
  assert.equal(
    f.calls.filter((c) => c.method === 'PUT' && c.path.endsWith('/77')).length,
    1,
  );
  notCertified(result);
  const receipt = f.sqlite
    .prepare(
      'SELECT remote_id FROM deliveries WHERE owner=? AND provider_athlete_id=? AND workout_id=?',
    )
    .get(owner, athleteId, f.w.id);
  assert.equal(
    receipt.remote_id,
    '77',
    'Wrong response redirected the saved event identity',
  );
});
void test('B13: matching durations and open targets with lost effort cues must not certify', async (t) => {
  const f = await fixture({ receipt: {}, badCues: true });
  t.after(() => f.sqlite.close());
  const result = await outcome(f);
  assert.equal(f.calls.filter((c) => c.method === 'PUT').length, 1);
  notCertified(result);
});
void test('C01: a previously sent workout moved beyond the initial seven-day window updates its existing event', async (t) => {
  const f = await fixture({
    receipt: {},
    workoutDate: addDays(today, 10),
    remoteDate: addDays(today, 5),
  });
  t.after(() => f.sqlite.close());
  assert.equal((await outcome(f)).status, 'accepted');
  const writes = f.calls.filter((c) =>
    ['POST', 'PUT', 'DELETE'].includes(c.method),
  );
  assert.equal(writes.length, 1);
  assert.equal(writes[0].method, 'PUT');
  assert.equal(
    JSON.parse(writes[0].body).start_date_local,
    addDays(today, 10) + 'T00:00:00',
  );
});
void test('C02: undo of a known removed upcoming event creates one replacement', async (t) => {
  const f = await fixture({
    receipt: { status: 'removed', create_outcome: 'known' },
    absent: true,
  });
  t.after(() => f.sqlite.close());
  assert.equal((await outcome(f)).status, 'accepted');
  assert.deepEqual(
    f.calls
      .filter((c) => ['POST', 'PUT', 'DELETE'].includes(c.method))
      .map((c) => c.method),
    ['POST'],
  );
});
void test('C03: replacing a plan preserves historical provider events', async (t) => {
  const f = await fixture({
    receipt: {},
    withoutWorkout: true,
    remoteDate: addDays(today, -1),
  });
  t.after(() => f.sqlite.close());
  assert.equal((await outcome(f)).status, 'preserved');
  assert.equal(
    f.calls.filter((c) => ['POST', 'PUT', 'DELETE'].includes(c.method)).length,
    0,
  );
});
void test('C04: replacing a plan preserves future provider events paired to an activity', async (t) => {
  const f = await fixture({
    receipt: {},
    withoutWorkout: true,
    activities: [{ paired_event_id: 77 }],
  });
  t.after(() => f.sqlite.close());
  assert.equal((await outcome(f)).status, 'preserved');
  assert.equal(
    f.calls.filter((c) => ['POST', 'PUT', 'DELETE'].includes(c.method)).length,
    0,
  );
});
void test('C05: today and foreign provider entries cannot be automatically deleted', async () => {
  for (const options of [{ remoteDate: today }, { foreignExternal: true }]) {
    const f = await fixture({ receipt: {}, skipped: true, ...options });
    try {
      const result = await outcome(f);
      notCertified(result);
      assert.notEqual(result.status, 'removed');
      assert.equal(
        f.calls.filter((c) => ['POST', 'PUT', 'DELETE'].includes(c.method))
          .length,
        0,
      );
    } finally {
      f.sqlite.close();
    }
  }
});
void test('C06: duplicate provider external IDs stop mutation rather than choosing a copy', async (t) => {
  const f = await fixture({ receipt: {}, duplicateExternal: true });
  t.after(() => f.sqlite.close());
  notCertified(await outcome(f));
  assert.equal(
    f.calls.filter((c) => ['POST', 'PUT', 'DELETE'].includes(c.method)).length,
    0,
  );
});
void test('C07: a skipped event already confirmed removed stays a no-op', async (t) => {
  const f = await fixture({
    receipt: { status: 'removed', create_outcome: 'known' },
    absent: true,
    skipped: true,
  });
  t.after(() => f.sqlite.close());
  assert.equal((await outcome(f)).status, 'removed');
  assert.equal(
    f.calls.filter((c) => ['POST', 'PUT', 'DELETE'].includes(c.method)).length,
    0,
  );
});

const syntheticActivity = (overrides = {}) => ({
  id: 'recording-123',
  type: 'Run',
  name: 'Synthetic provider recording',
  start_date_local: today + 'T07:31:22',
  start_date: today + 'T07:31:22Z',
  timezone: 'UTC',
  distance: 5432,
  moving_time: 1801,
  source: 'GARMIN',
  ...overrides,
});
const linkedActivityId = `${athleteId}:recording-123`;
const feedback = (overrides = {}) => ({
  actualDate: today,
  actualMinutes: 99,
  actualKm: 99,
  effort: 4,
  feeling: 'good',
  note: 'Synthetic feedback',
  activityId: linkedActivityId,
  source: 'Fabricated client source',
  ...overrides,
});
const extraRun = (overrides = {}) => ({
  date: today,
  minutes: 99,
  km: 99,
  effort: 4,
  feeling: 'good',
  note: 'Synthetic extra run',
  activityId: linkedActivityId,
  source: 'Fabricated client source',
  ...overrides,
});
async function planAction(payload) {
  const request = privateRequest('/api/plan', 'POST');
  const response = await updatePlan(
    new Request(request.url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify(payload),
    }),
  );
  return { status: response.status, data: await response.json() };
}
const routeSummary = (result) =>
  JSON.stringify({
    status: result.status,
    error: result.data.error,
    version: result.data.version,
  });
function savedJournal(f) {
  const row = f.sqlite
    .prepare('SELECT version,data FROM athlete_state WHERE owner=?')
    .get(owner);
  return { version: row.version, plan: JSON.parse(row.data) };
}
function assertNoJournalWrite(f, version = 3) {
  assert.equal(
    savedJournal(f).version,
    version,
    'Rejected recording changed the persisted journal',
  );
  assert.equal(
    f.calls.filter((c) => ['POST', 'PUT', 'DELETE'].includes(c.method)).length,
    0,
    'Import attempted a provider write',
  );
}
function assertProviderFeedback(actual) {
  assert.equal(actual.activityId, linkedActivityId);
  assert.equal(
    actual.actualMinutes,
    1801 / 60,
    'Client-supplied duration was trusted',
  );
  assert.equal(actual.actualKm, 5.432, 'Client-supplied distance was trusted');
  assert.equal(
    actual.source,
    'Intervals.icu · GARMIN',
    'Client-supplied provenance was trusted',
  );
}
void test('D01: disconnected recording claims are rejected by complete and freeRun routes without saving', async () => {
  for (const action of ['complete', 'freeRun']) {
    const f = await fixture({
      disconnected: true,
      keepFullPlan: true,
      workoutDate: today,
    });
    try {
      const result = await planAction({
        action,
        version: 3,
        id: f.w.id,
        feedback: feedback(),
        run: extraRun(),
      });
      assert.ok([409, 422].includes(result.status), routeSummary(result));
      assertNoJournalWrite(f);
      assert.equal(f.calls.length, 0);
    } finally {
      f.sqlite.close();
    }
  }
});
void test('D02: connected but fabricated recording claims are rejected by complete and freeRun routes', async () => {
  for (const action of ['complete', 'freeRun']) {
    const f = await fixture({
      keepFullPlan: true,
      workoutDate: today,
      activities: [],
    });
    try {
      const result = await planAction({
        action,
        version: 3,
        id: f.w.id,
        feedback: feedback(),
        run: extraRun(),
      });
      assert.equal(result.status, 409, routeSummary(result));
      assertNoJournalWrite(f);
      assert.equal(
        f.calls.filter((c) => c.path.endsWith('/activities')).length,
        1,
        'Claim was not checked with the provider',
      );
    } finally {
      f.sqlite.close();
    }
  }
});
void test('D03: a verified complete import saves provider duration, distance and source', async (t) => {
  const f = await fixture({
    keepFullPlan: true,
    workoutDate: today,
    activities: [syntheticActivity()],
  });
  t.after(() => f.sqlite.close());
  const result = await planAction({
    action: 'complete',
    version: 3,
    id: f.w.id,
    feedback: feedback(),
  });
  assert.equal(result.status, 200, routeSummary(result));
  const saved = savedJournal(f);
  assert.equal(saved.version, 4);
  assertProviderFeedback(
    saved.plan.workouts.find((w) => w.id === f.w.id).feedback,
  );
  const query = f.calls.find((c) => c.path.endsWith('/activities'));
  assert.equal(query.path, `/athlete/${athleteId}/activities`);
  assert.deepEqual(query.query, { oldest: today, newest: today });
});
void test('D04: a verified extra-run import saves provider values rather than client claims', async (t) => {
  const f = await fixture({
    keepFullPlan: true,
    workoutDate: today,
    activities: [syntheticActivity()],
  });
  t.after(() => f.sqlite.close());
  const result = await planAction({
    action: 'freeRun',
    version: 3,
    run: extraRun(),
  });
  assert.equal(result.status, 200, routeSummary(result));
  const run = savedJournal(f).plan.extraRuns.at(-1);
  assertProviderFeedback({
    ...run,
    actualMinutes: run.minutes,
    actualKm: run.km,
  });
});
void test('D05: identical raw recording ID from a different athlete account is rejected', async (t) => {
  const f = await fixture({
    keepFullPlan: true,
    workoutDate: today,
    activities: [syntheticActivity()],
  });
  t.after(() => f.sqlite.close());
  const result = await planAction({
    action: 'complete',
    version: 3,
    id: f.w.id,
    feedback: feedback({ activityId: 'i900000001:recording-123' }),
  });
  assert.equal(result.status, 409, routeSummary(result));
  assertNoJournalWrite(f);
});
void test('D06: provider record date must match the claimed local run date even if lookup returns it', async (t) => {
  const f = await fixture({
    keepFullPlan: true,
    workoutDate: today,
    activities: [
      syntheticActivity({ start_date_local: addDays(today, -1) + 'T23:31:22' }),
    ],
  });
  t.after(() => f.sqlite.close());
  const result = await planAction({
    action: 'complete',
    version: 3,
    id: f.w.id,
    feedback: feedback(),
  });
  assert.equal(result.status, 409, routeSummary(result));
  assertNoJournalWrite(f);
});
void test('D07: an imported extra run cannot be reused for a scheduled workout', async (t) => {
  const f = await fixture({
    keepFullPlan: true,
    workoutDate: today,
    activities: [syntheticActivity()],
  });
  t.after(() => f.sqlite.close());
  const first = await planAction({
    action: 'freeRun',
    version: 3,
    run: extraRun(),
  });
  assert.equal(first.status, 200, routeSummary(first));
  const second = await planAction({
    action: 'complete',
    version: 4,
    id: f.w.id,
    feedback: feedback(),
  });
  assert.equal(second.status, 422, routeSummary(second));
  assertNoJournalWrite(f, 4);
  assert.equal(
    savedJournal(f).plan.workouts.find((w) => w.id === f.w.id).status,
    'planned',
  );
  assert.equal(
    f.calls.filter((c) => c.path.endsWith('/activities')).length,
    1,
    'Duplicate should stop before another provider request',
  );
});
void test('D08: attaching a verified recording preserves journal effort and note while saving provider values', async (t) => {
  const f = await fixture({
    keepFullPlan: true,
    workoutDate: today,
    activities: [syntheticActivity()],
  });
  t.after(() => f.sqlite.close());
  const first = await planAction({
    action: 'complete',
    version: 3,
    id: f.w.id,
    feedback: feedback({
      activityId: undefined,
      effort: 6,
      note: 'Keep this original reflection',
    }),
  });
  assert.equal(first.status, 200, routeSummary(first));
  const result = await planAction({
    action: 'attachRecording',
    version: 4,
    id: f.w.id,
    run: extraRun({ effort: 1, note: 'Untrusted replacement reflection' }),
  });
  assert.equal(result.status, 200, routeSummary(result));
  const actual = savedJournal(f).plan.workouts.find(
    (w) => w.id === f.w.id,
  ).feedback;
  assertProviderFeedback(actual);
  assert.equal(actual.effort, 6);
  assert.equal(actual.note, 'Keep this original reflection');
});
void test('D09: correcting a verified log preserves its prescription and original saved revision', async (t) => {
  const f = await fixture({
    keepFullPlan: true,
    workoutDate: today,
    activities: [syntheticActivity()],
  });
  t.after(() => f.sqlite.close());
  const first = await planAction({
    action: 'complete',
    version: 3,
    id: f.w.id,
    feedback: feedback(),
  });
  assert.equal(first.status, 200, routeSummary(first));
  const original = savedJournal(f).plan.workouts.find((w) => w.id === f.w.id),
    { feedback: originalFeedback, ...prescription } = original;
  const result = await planAction({
    action: 'correctLog',
    version: 4,
    id: f.w.id,
    correctionReason: 'Watch paused during warm-up',
    feedback: {
      ...originalFeedback,
      actualMinutes: 35,
      actualKm: 5.7,
      note: 'Corrected after checking watch',
    },
  });
  assert.equal(result.status, 200, routeSummary(result));
  const { feedback: corrected, ...savedPrescription } = savedJournal(
    f,
  ).plan.workouts.find((w) => w.id === f.w.id);
  assert.deepEqual(
    savedPrescription,
    prescription,
    'Correcting a log rewrote its prescribed workout',
  );
  assert.equal(corrected.actualMinutes, 35);
  assert.equal(corrected.actualKm, 5.7);
  assert.equal(corrected.activityId, linkedActivityId);
  const revisions = f.sqlite
    .prepare(
      'SELECT version,data,label FROM revisions WHERE owner=? ORDER BY version',
    )
    .all(owner);
  assert.deepEqual(
    revisions.map((r) => r.version),
    [4, 5],
  );
  assert.deepEqual(
    JSON.parse(revisions[0].data).workouts.find((w) => w.id === f.w.id)
      .feedback,
    originalFeedback,
  );
  assert.equal(
    revisions[1].label,
    'Corrected a run log: Watch paused during warm-up',
  );
  assert.deepEqual(
    JSON.parse(revisions[1].data).workouts.find((w) => w.id === f.w.id)
      .feedback,
    corrected,
  );
});
void test('D10: correctLog cannot introduce an unverified recording into a manual log', async (t) => {
  const f = await fixture({
    disconnected: true,
    keepFullPlan: true,
    workoutDate: today,
  });
  t.after(() => f.sqlite.close());
  const first = await planAction({
    action: 'complete',
    version: 3,
    id: f.w.id,
    feedback: feedback({ activityId: undefined }),
  });
  assert.equal(first.status, 200, routeSummary(first));
  const result = await planAction({
    action: 'correctLog',
    version: 4,
    id: f.w.id,
    correctionReason: 'Changed my note',
    feedback: feedback(),
  });
  assert.ok([409, 422].includes(result.status), routeSummary(result));
  assertNoJournalWrite(f, 4);
  assert.equal(
    savedJournal(f).plan.workouts.find((w) => w.id === f.w.id).feedback
      .activityId,
    undefined,
  );
});
void test('D11: correctLog cannot rewrite verified recording provenance', async (t) => {
  const f = await fixture({
    keepFullPlan: true,
    workoutDate: today,
    activities: [syntheticActivity()],
  });
  t.after(() => f.sqlite.close());
  const first = await planAction({
    action: 'complete',
    version: 3,
    id: f.w.id,
    feedback: feedback(),
  });
  assert.equal(first.status, 200, routeSummary(first));
  const result = await planAction({
    action: 'correctLog',
    version: 4,
    id: f.w.id,
    correctionReason: 'Corrected my note',
    feedback: feedback({ actualMinutes: 35, actualKm: 5.7 }),
  });
  if (result.status === 200)
    assert.equal(
      savedJournal(f).plan.workouts.find((w) => w.id === f.w.id).feedback
        .source,
      'Intervals.icu · GARMIN',
      'Correction forged provider provenance',
    );
  else {
    assert.ok([409, 422].includes(result.status), routeSummary(result));
    assertNoJournalWrite(f, 4);
  }
});
void test('D12: correcting an imported log cannot drop or replace its original recording link', async () => {
  for (const activityId of [undefined, 'i900000000:another-recording']) {
    const f = await fixture({
      keepFullPlan: true,
      workoutDate: today,
      activities: [syntheticActivity()],
    });
    try {
      const first = await planAction({
        action: 'complete',
        version: 3,
        id: f.w.id,
        feedback: feedback(),
      });
      assert.equal(first.status, 200, routeSummary(first));
      const result = await planAction({
        action: 'correctLog',
        version: 4,
        id: f.w.id,
        correctionReason: 'Trying another link',
        feedback: feedback({ activityId }),
      });
      assert.equal(result.status, 422, routeSummary(result));
      assertNoJournalWrite(f, 4);
      assert.equal(
        savedJournal(f).plan.workouts.find((w) => w.id === f.w.id).feedback
          .activityId,
        linkedActivityId,
      );
    } finally {
      f.sqlite.close();
    }
  }
});
void test('D13: attaching a recording to a journal entry from another local date is rejected', async (t) => {
  const f = await fixture({
    keepFullPlan: true,
    workoutDate: today,
    activities: [
      syntheticActivity({ start_date_local: addDays(today, -1) + 'T07:00:00' }),
    ],
  });
  t.after(() => f.sqlite.close());
  const first = await planAction({
    action: 'complete',
    version: 3,
    id: f.w.id,
    feedback: feedback({ activityId: undefined }),
  });
  assert.equal(first.status, 200, routeSummary(first));
  const result = await planAction({
    action: 'attachRecording',
    version: 4,
    id: f.w.id,
    run: extraRun({ date: addDays(today, -1) }),
  });
  assert.equal(result.status, 422, routeSummary(result));
  assertNoJournalWrite(f, 4);
});
void test('D14: a connection generation change during verification prevents an import commit', async (t) => {
  const f = await fixture({
    keepFullPlan: true,
    workoutDate: today,
    activities: [syntheticActivity()],
    rotateActivityConnection: true,
  });
  t.after(() => f.sqlite.close());
  const result = await planAction({
    action: 'complete',
    version: 3,
    id: f.w.id,
    feedback: feedback(),
  });
  assert.equal(result.status, 409, routeSummary(result));
  assertNoJournalWrite(f);
});
void test('D15: a correction without an auditable reason cannot create a revision', async (t) => {
  const f = await fixture({
    keepFullPlan: true,
    workoutDate: today,
    activities: [syntheticActivity()],
  });
  t.after(() => f.sqlite.close());
  const first = await planAction({
    action: 'complete',
    version: 3,
    id: f.w.id,
    feedback: feedback(),
  });
  assert.equal(first.status, 200, routeSummary(first));
  const result = await planAction({
    action: 'correctLog',
    version: 4,
    id: f.w.id,
    correctionReason: '  ',
    feedback: feedback(),
  });
  assert.equal(result.status, 422, routeSummary(result));
  assertNoJournalWrite(f, 4);
  assert.deepEqual(
    f.sqlite
      .prepare('SELECT version FROM revisions WHERE owner=?')
      .all(owner)
      .map((r) => r.version),
    [4],
  );
});

void test('send eligibility matches the seven-day window while preserving future updates', async () => {
  const { workoutSendWindow } = await import('../lib/delivery-policy.ts');
  assert.equal(workoutSendWindow('2026-09-09', '2026-09-09').allowed, true);
  assert.equal(workoutSendWindow('2026-09-15', '2026-09-09').allowed, true);
  assert.equal(workoutSendWindow('2026-09-16', '2026-09-09').allowed, false);
  assert.equal(
    workoutSendWindow('2026-09-16', '2026-09-09').opens,
    '2026-09-10',
  );
  assert.equal(
    workoutSendWindow('2026-09-21', '2026-09-09', true).allowed,
    true,
  );
  assert.equal(
    workoutSendWindow('2026-09-08', '2026-09-09', true).allowed,
    false,
  );
});

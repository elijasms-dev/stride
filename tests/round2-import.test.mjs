// Expanded import-first acceptance. Original baseline retained in round2-integration-acceptance.mjs.
// Actual source and SQLite migrations, synthetic provider GETs only; never loads .env.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
let fixtureSqlite;
import { existsSync, readFileSync, readdirSync } from 'node:fs';
// Works here in work/, or copied unchanged to the checkout's tests/ directory.
const site = new URL(
    existsSync(new URL('./stride/', import.meta.url)) ? './stride/' : '../',
    import.meta.url,
  ),
  owner = 'round2-synthetic-owner',
  athlete = 'i900000000';
globalThis.round2IntegrationEnv = {
  DB: null,
  STRIDE_ENCRYPTION_KEY: 'synthetic-round2-cipher-secret',
};
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'cloudflare:workers')
      return {
        url: 'data:text/javascript,export const env=globalThis.round2IntegrationEnv;',
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
    return next(specifier, context);
  },
});
const { POST: connect } = await import(
  new URL('app/api/connections/route.ts', site)
);
const { GET: activities } = await import(
  new URL('app/api/activities/route.ts', site)
);
const { GET: stateRoute } = await import(
  new URL('app/api/state/route.ts', site)
);
const { POST: planRoute } = await import(
  new URL('app/api/plan/route.ts', site)
);
const { POST: recoveryRoute } = await import(
  new URL('app/api/recovery/route.ts', site)
);
const { GET: exportRoute } = await import(
  new URL('app/api/export/route.ts', site)
);
const { readAccount } = await import(new URL('lib/accounts.ts', site));
const { encrypt, saveState } = await import(new URL('lib/server.ts', site));
const { syncWorkout } = await import(new URL('lib/garmin.ts', site));
const { makePlan, demoProfile, todayInZone } = await import(
  new URL('lib/engine.ts', site)
);
const today = todayInZone('UTC');
const activeProfile = () => ({
  ...demoProfile(today),
  timezone: 'UTC',
  startDate: today,
});
const recording = (values = {}) => ({
  id: 'run-1',
  type: 'Run',
  name: 'Synthetic run',
  start_date_local: today + 'T07:30:00',
  start_date: today + 'T04:30:00Z',
  timezone: 'Europe/Vilnius',
  moving_time: 1801,
  distance: 5432,
  source: 'GARMIN',
  ...values,
});
async function fixture(options = {}) {
  const sqlite = (fixtureSqlite = new DatabaseSync(':memory:'));
  const migrations = new URL('drizzle/', site);
  for (const f of readdirSync(migrations)
    .filter((n) => /^\d+.*\.sql$/.test(n))
    .sort((a, b) => String(a).localeCompare(String(b))))
    sqlite.exec(readFileSync(new URL(f, migrations), 'utf8'));
  const prepare = (sql, values = []) => ({
    sql,
    bind: (...args) => prepare(sql, args),
    first: async (column) => {
      const r = sqlite.prepare(sql).get(...values) ?? null;
      return column ? (r?.[column] ?? null) : r;
    },
    all: async () => ({
      results: sqlite.prepare(sql).all(...values),
      success: true,
      meta: {},
    }),
    run: async () => {
      const r = sqlite.prepare(sql).run(...values);
      return {
        success: true,
        meta: {
          changes: Number(r.changes),
          last_row_id: Number(r.lastInsertRowid),
        },
      };
    },
  });
  globalThis.round2IntegrationEnv.DB = {
    prepare,
    batch: async (stmts) => {
      options.beforeBatch?.(sqlite, stmts);
      sqlite.exec('BEGIN');
      try {
        const rs = [];
        for (const s of stmts) rs.push(await s.run());
        sqlite.exec('COMMIT');
        return rs;
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
  await readAccount(owner);
  sqlite
    .prepare(
      'INSERT INTO profiles(owner,display_name,city,units,timezone,accent,updated_at) VALUES(?,?,?,?,?,?,?)',
    )
    .run(
      owner,
      'Synthetic runner',
      '',
      'km',
      options.timezone ?? 'UTC',
      'evergreen',
      new Date().toISOString(),
    );
  if (options.connected)
    sqlite
      .prepare(
        'INSERT INTO connections(owner,encrypted_key,athlete_name,connected_at,provider_athlete_id,generation) VALUES(?,?,?,?,?,?)',
      )
      .run(
        owner,
        await encrypt('synthetic-round2-api-key'),
        'Synthetic runner',
        new Date().toISOString(),
        athlete,
        'generation-1',
      );
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(
        typeof input === 'string' || input instanceof URL ? input : input.url,
      ),
      method = init.method ?? 'GET';
    assert.equal(url.origin, 'https://intervals.icu');
    assert.equal(
      method,
      'GET',
      'Synthetic acceptance prohibits provider writes',
    );
    calls.push(url.pathname + url.search);
    if (options.duringFetch) options.duringFetch(sqlite, url);
    if (url.pathname === '/api/v1/athlete/0')
      return Response.json({ id: athlete, name: 'Synthetic runner' });
    if (url.pathname.endsWith('/activities'))
      return Response.json(options.activities ?? [recording()]);
    throw new Error('Unmocked provider read prohibited');
  };
  return { sqlite, calls, options };
}
function request(path, payload, epoch = 0, accountOwner = owner) {
  return new Request('https://stride.test' + path, {
    method: payload ? 'POST' : 'GET',
    headers: {
      'oai-authenticated-user-id': accountOwner,
      'x-stride-account':
        fixtureSqlite
          .prepare('SELECT account_id FROM accounts WHERE owner=?')
          .get(accountOwner)?.account_id ?? '',
      'x-stride-epoch': String(epoch),
      origin: 'https://stride.test',
      'content-type': 'application/json',
    },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  });
}
const run = (values = {}) => ({
  date: today,
  minutes: 99,
  km: 99,
  effort: 4,
  feeling: 'good',
  note: 'Synthetic review',
  activityId: athlete + ':run-1',
  source: 'Untrusted client source',
  ...values,
});
const feedback = (values = {}) => ({
  actualDate: today,
  actualMinutes: 99,
  actualKm: 99,
  effort: 4,
  feeling: 'good',
  note: 'Synthetic review',
  activityId: athlete + ':run-1',
  source: 'Untrusted client source',
  ...values,
});
async function planAction(payload) {
  const response = await planRoute(request('/api/plan', payload));
  return { status: response.status, data: await response.json() };
}
void test('R01: API connection and provider retrieval already work before any personal plan exists', async (t) => {
  const f = await fixture();
  t.after(() => f.sqlite.close());
  const response = await connect(
    request('/api/connections', { key: 'synthetic-round2-api-key' }),
  );
  assert.equal(response.status, 200);
  const state = await (await stateRoute(request('/api/state'))).json();
  assert.equal(state.plan, null);
  assert.equal(state.version, 0);
  assert.equal(state.connection.provider_athlete_id, athlete);
  assert.ok(!JSON.stringify(state).includes('synthetic-round2-api-key'));
  assert.notEqual(
    f.sqlite
      .prepare('SELECT encrypted_key FROM connections WHERE owner=?')
      .get(owner).encrypted_key,
    'synthetic-round2-api-key',
  );
  const list = await activities(request('/api/activities'));
  assert.equal(list.status, 200);
  assert.equal((await list.json()).activities[0].id, athlete + ':run-1');
});
void test('R02: a reviewed provider recording can enter the journal before plan creation', async (t) => {
  const f = await fixture({ connected: true });
  t.after(() => f.sqlite.close());
  const result = await planAction({
    action: 'freeRun',
    version: 0,
    run: run(),
  });
  assert.equal(
    result.status,
    200,
    JSON.stringify({ status: result.status, error: result.data.error }),
  );
  assert.equal(
    result.data.plan,
    null,
    'Import-first logging must not invent a training plan',
  );
});
void test('R03: no-plan import window uses the saved training timezone near midnight', async (t) => {
  const NativeDate = Date,
    stamp = NativeDate.parse('2026-09-07T22:58:00Z');
  globalThis.Date = class extends NativeDate {
    constructor(...args) {
      super(...(args.length ? args : [stamp]));
    }
    static now() {
      return stamp;
    }
  };
  t.after(() => {
    globalThis.Date = NativeDate;
  });
  const f = await fixture({
    connected: true,
    timezone: 'Europe/Vilnius',
    activities: [recording({ start_date_local: '2026-09-08T01:30:00' })],
  });
  t.after(() => f.sqlite.close());
  const response = await activities(
    request('/api/activities?before=2026-09-08'),
  );
  const body = await response.json();
  assert.equal(response.status, 200, JSON.stringify(body));
  assert.ok(f.calls.some((c) => c.includes('newest=2026-09-08')));
});
void test('R04: running duration remains importable when provider distance is missing', async (t) => {
  const f = await fixture({
    connected: true,
    activities: [recording({ distance: null })],
  });
  t.after(() => f.sqlite.close());
  const response = await activities(request('/api/activities'));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(
    body.activities.length,
    1,
    'A missing distance erased known running duration',
  );
  assert.equal(body.activities[0].distance, null);
  assert.equal(body.activities[0].movingTime, 1801);
});
void test('R05: one malformed provider row does not discard other valid recordings', async (t) => {
  const f = await fixture({ connected: true, activities: [recording(), null] });
  t.after(() => f.sqlite.close());
  const response = await activities(request('/api/activities'));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.activities.length, 1);
  assert.equal(body.invalidCount, 1);
});
void test('R06: duplicate provider identities collapse to one reviewable recording', async (t) => {
  const f = await fixture({
    connected: true,
    activities: [recording(), recording()],
  });
  t.after(() => f.sqlite.close());
  const response = await activities(request('/api/activities'));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).activities.length, 1);
});
void test('R07: a connection generation change while retrieving recordings invalidates that response', async (t) => {
  const f = await fixture({
    connected: true,
    duringFetch: (sqlite) =>
      sqlite
        .prepare('UPDATE connections SET generation=? WHERE owner=?')
        .run('generation-2', owner),
  });
  t.after(() => f.sqlite.close());
  assert.equal((await activities(request('/api/activities'))).status, 409);
});
void test('R08: closing or changing the account while verifying a new connection prevents it being saved', async (t) => {
  const f = await fixture({
    duringFetch: (sqlite) =>
      sqlite
        .prepare(
          "UPDATE accounts SET epoch=epoch+1,status='closed' WHERE owner=?",
        )
        .run(owner),
  });
  t.after(() => f.sqlite.close());
  assert.equal(
    (
      await connect(
        request('/api/connections', { key: 'synthetic-round2-api-key' }),
      )
    ).status,
    409,
  );
  assert.equal(
    f.sqlite
      .prepare('SELECT COUNT(*) AS n FROM connections WHERE owner=?')
      .get(owner).n,
    0,
  );
});
void test('R09: no-plan provider connection does not permit prescription sending', async (t) => {
  const f = await fixture({ connected: true });
  t.after(() => f.sqlite.close());
  await assert.rejects(
    syncWorkout(owner, 'fabricated-workout', 0),
    (e) => e.status === 409,
  );
  assert.equal(f.calls.length, 0);
});
void test('R10: re-import cannot overwrite a corrected log or its preserved prescription', async (t) => {
  const f = await fixture({ connected: true });
  t.after(() => f.sqlite.close());
  const plan = makePlan(activeProfile(), today);
  plan.profile.timezone = 'UTC';
  plan.workouts[0].date = today;
  const id = plan.workouts[0].id;
  await saveState(owner, 0, plan, 'Synthetic initial plan', 0);
  const complete = await planAction({
    action: 'complete',
    version: 1,
    id,
    feedback: feedback(),
  });
  assert.equal(
    complete.status,
    200,
    JSON.stringify({ error: complete.data.error }),
  );
  const original = complete.data.plan.workouts.find((w) => w.id === id),
    { feedback: originalFeedback, ...prescription } = original;
  const corrected = await planAction({
    action: 'correctLog',
    version: 2,
    id,
    correctionReason: 'Corrected watch pause',
    feedback: { ...originalFeedback, actualMinutes: 35, actualKm: 5.7 },
  });
  assert.equal(corrected.status, 200);
  const repeated = await planAction({
    action: 'freeRun',
    version: 3,
    run: run(),
  });
  assert.equal(repeated.status, 422);
  const saved = JSON.parse(
      f.sqlite
        .prepare('SELECT data FROM athlete_state WHERE owner=?')
        .get(owner).data,
    ),
    { feedback: actual, ...prescribed } = saved.workouts.find(
      (w) => w.id === id,
    );
  assert.deepEqual(prescribed, prescription);
  assert.equal(actual.actualMinutes, 35);
  assert.equal(actual.actualKm, 5.7);
  assert.equal(actual.activityId, athlete + ':run-1');
  assert.match(actual.source, /Intervals\.icu.*GARMIN/);
  const old = JSON.parse(
    f.sqlite
      .prepare('SELECT data FROM revisions WHERE owner=? AND version=2')
      .get(owner).data,
  );
  assert.equal(
    old.workouts.find((w) => w.id === id).feedback.actualMinutes,
    1801 / 60,
  );
});

async function exported(epoch = 0) {
  const res = await exportRoute(
    request('/api/export?format=recovery', undefined, epoch),
  );
  return { status: res.status, data: await res.json() };
}
async function recovery(kind, file, epoch = 0) {
  const preview = await recoveryRoute(
      request(
        '/api/recovery',
        { action: 'preview', kind, ...(file ? { file } : {}) },
        epoch,
      ),
    ),
    review = await preview.json();
  if (preview.status !== 200) return { status: preview.status, data: review };
  const commit = await recoveryRoute(
    request(
      '/api/recovery',
      {
        action: 'commit',
        kind,
        id: review.id,
        confirm: { restore: 'REPLACE', delete: 'DELETE', reopen: 'OPEN' }[kind],
        ...(file ? { file } : {}),
      },
      epoch,
    ),
  );
  return { status: commit.status, data: await commit.json() };
}
const loose = (values = {}) => ({
  id: crypto.randomUUID(),
  date: today,
  minutes: 30,
  km: null,
  effort: 4,
  feeling: 'good',
  note: 'Synthetic loose run',
  recordedAt: new Date().toISOString(),
  source: 'Manual',
  ...values,
});
function seedRun(sqlite, r, accountOwner = owner) {
  sqlite
    .prepare(
      'INSERT INTO standalone_runs(owner,id,data,updated_at) VALUES(?,?,?,?)',
    )
    .run(accountOwner, r.id, JSON.stringify(r), r.recordedAt);
}
const countRuns = (f) =>
  f.sqlite
    .prepare('SELECT count(*) AS n FROM standalone_runs WHERE owner=?')
    .get(owner).n;

void test('R11: pre-plan import reloads authoritative facts and transfers once into activated plan and revision', async (t) => {
  const f = await fixture({ connected: true });
  t.after(() => f.sqlite.close());
  const added = await planAction({ action: 'freeRun', version: 0, run: run() });
  assert.equal(added.status, 200, JSON.stringify(added.data));
  const loaded = await (await stateRoute(request('/api/state'))).json();
  assert.equal(loaded.plan, null);
  assert.equal(loaded.standaloneRuns.length, 1);
  const r = loaded.standaloneRuns[0];
  assert.equal(r.minutes, 1801 / 60);
  assert.equal(r.km, 5.432);
  assert.equal(r.activityId, athlete + ':run-1');
  assert.notEqual(r.source, 'Untrusted client source');
  const profile = activeProfile();
  const activated = await planAction({
    action: 'activate',
    version: 0,
    profile,
    requestId: crypto.randomUUID(),
  });
  assert.equal(
    activated.status,
    200,
    JSON.stringify({ error: activated.data.error }),
  );
  assert.deepEqual(activated.data.plan.extraRuns, [r]);
  assert.equal(countRuns(f), 0);
  assert.deepEqual(
    JSON.parse(
      f.sqlite
        .prepare('SELECT data FROM revisions WHERE owner=? AND version=1')
        .get(owner).data,
    ).extraRuns,
    [r],
  );
  assert.equal(
    (await planAction({ action: 'freeRun', version: 1, run: run() })).status,
    422,
  );
});

void test('R12: reconnecting the same athlete cannot duplicate a previously imported recording', async (t) => {
  const f = await fixture({ connected: true });
  t.after(() => f.sqlite.close());
  assert.equal(
    (await planAction({ action: 'freeRun', version: 0, run: run() })).status,
    200,
  );
  assert.equal(
    (
      await connect(
        request('/api/connections', { key: 'synthetic-reconnected-key' }),
      )
    ).status,
    200,
  );
  assert.notEqual(
    f.sqlite
      .prepare('SELECT generation FROM connections WHERE owner=?')
      .get(owner).generation,
    'generation-1',
  );
  const repeated = await planAction({
    action: 'freeRun',
    version: 0,
    run: run(),
  });
  assert.ok([200, 409, 422].includes(repeated.status));
  assert.equal(countRuns(f), 1);
  const stored = JSON.parse(
    f.sqlite
      .prepare('SELECT data FROM standalone_runs WHERE owner=?')
      .get(owner).data,
  );
  assert.equal(stored.minutes, 1801 / 60);
});

void test('R13: closing the account during provider verification cannot save a standalone recording', async (t) => {
  const f = await fixture({
    connected: true,
    duringFetch: (sqlite) =>
      sqlite
        .prepare(
          "UPDATE accounts SET epoch=epoch+1,revision=revision+1,status='closed' WHERE owner=?",
        )
        .run(owner),
  });
  t.after(() => f.sqlite.close());
  const result = await planAction({
    action: 'freeRun',
    version: 0,
    run: run(),
  });
  assert.equal(result.status, 409);
  assert.equal(countRuns(f), 0);
});

void test('R14: pre-plan export/restore/delete preserves runs and isolates another owner', async (t) => {
  const f = await fixture({ connected: true });
  t.after(() => f.sqlite.close());
  const foreignOwner = 'round2-other-owner';
  await readAccount(foreignOwner);
  seedRun(f.sqlite, loose({ id: 'foreign-run' }), foreignOwner);
  assert.equal(
    (await planAction({ action: 'freeRun', version: 0, run: run() })).status,
    200,
  );
  const file = await exported();
  assert.equal(file.status, 200);
  assert.equal(file.data.plan, null);
  assert.equal(file.data.standaloneRuns.length, 1);
  assert.ok(!JSON.stringify(file.data).includes('synthetic-round2-api-key'));
  const restored = await recovery('restore', file.data);
  assert.equal(restored.status, 200, JSON.stringify(restored.data));
  assert.equal(restored.data.accountEpoch, 1);
  assert.equal(countRuns(f), 1);
  assert.equal(
    f.sqlite
      .prepare('SELECT count(*) AS n FROM connections WHERE owner=?')
      .get(owner).n,
    0,
  );
  assert.equal((await recovery('delete', null, 1)).status, 200);
  assert.equal(countRuns(f), 0);
  assert.equal(
    f.sqlite
      .prepare('SELECT count(*) AS n FROM standalone_runs WHERE owner=?')
      .get(foreignOwner).n,
    1,
  );
  const foreign = await (
    await stateRoute(request('/api/state', undefined, 0, foreignOwner))
  ).json();
  assert.equal(foreign.standaloneRuns[0].id, 'foreign-run');
  assert.equal(foreign.accountStatus, 'active');
});

void test('R15: restored standalone runs cannot use different local IDs for the same provider recording', async (t) => {
  const f = await fixture();
  t.after(() => f.sqlite.close());
  const file = (await exported()).data;
  file.standaloneRuns = [
    loose({ id: 'a', activityId: athlete + ':run-1' }),
    loose({ id: 'b', activityId: athlete + ':run-1' }),
  ];
  const res = await recoveryRoute(
    request('/api/recovery', { action: 'preview', kind: 'restore', file }),
  );
  assert.equal(
    res.status,
    422,
    'duplicate provider identities must not be restored as two runs',
  );
  assert.equal(countRuns(f), 0);
});

void test('R16: unknown distance imports and round-trips through pre-plan recovery', async (t) => {
  const f = await fixture({
    connected: true,
    activities: [recording({ distance: null })],
  });
  t.after(() => f.sqlite.close());
  assert.equal(
    (
      await planAction({
        action: 'freeRun',
        version: 0,
        run: run({ km: null }),
      })
    ).status,
    200,
  );
  const file = await exported();
  assert.equal(file.data.standaloneRuns[0].km, null);
  assert.equal(file.data.standaloneRuns[0].minutes, 1801 / 60);
  const restored = await recovery('restore', file.data);
  assert.equal(restored.status, 200);
  const loaded = await (
    await stateRoute(request('/api/state', undefined, 1))
  ).json();
  assert.equal(loaded.standaloneRuns[0].km, null);
});

void test('R17: authoritative provider facts obey journal bounds after replacing client fields', async (t) => {
  const f = await fixture({
    connected: true,
    activities: [recording({ moving_time: 180000, distance: 500000 })],
  });
  t.after(() => f.sqlite.close());
  const result = await planAction({
    action: 'freeRun',
    version: 0,
    run: run(),
  });
  assert.ok(
    [409, 422].includes(result.status),
    JSON.stringify({ status: result.status, error: result.data.error }),
  );
  assert.equal(countRuns(f), 0);
});

void test('R18: activation refuses a stale transfer revision without dropping a newly saved run', async (t) => {
  const f = await fixture();
  t.after(() => f.sqlite.close());
  seedRun(f.sqlite, loose({ id: 'first' }));
  f.options.beforeBatch = (sqlite, stmts) => {
    if (stmts.some((s) => s.sql.startsWith('INSERT INTO athlete_state'))) {
      f.options.beforeBatch = null;
      seedRun(sqlite, loose({ id: 'racing' }));
      sqlite
        .prepare('UPDATE accounts SET revision=revision+1 WHERE owner=?')
        .run(owner);
    }
  };
  const result = await planAction({
    action: 'activate',
    version: 0,
    profile: activeProfile(),
    requestId: crypto.randomUUID(),
  });
  assert.equal(result.status, 409);
  assert.equal(countRuns(f), 2);
  assert.equal(
    f.sqlite
      .prepare('SELECT count(*) AS n FROM athlete_state WHERE owner=?')
      .get(owner).n,
    0,
  );
});

void test('R19: saving a run refuses an account closure between validation and the write transaction', async (t) => {
  const f = await fixture();
  t.after(() => f.sqlite.close());
  f.options.beforeBatch = (sqlite, stmts) => {
    if (stmts.some((s) => s.sql.startsWith('INSERT INTO standalone_runs'))) {
      f.options.beforeBatch = null;
      sqlite
        .prepare(
          "UPDATE accounts SET epoch=epoch+1,revision=revision+1,status='closed' WHERE owner=?",
        )
        .run(owner);
    }
  };
  const result = await planAction({
    action: 'freeRun',
    version: 0,
    run: run({ activityId: undefined, source: 'Manual' }),
  });
  assert.equal(result.status, 409);
  assert.equal(countRuns(f), 0);
});

void test('R20: an unknown top-level provider payload returns a recoverable error without journal writes', async (t) => {
  const f = await fixture({
    connected: true,
    activities: { unexpected: 'shape' },
  });
  t.after(() => f.sqlite.close());
  assert.equal((await activities(request('/api/activities'))).status, 502);
  assert.equal(countRuns(f), 0);
});

void test('R21: a restored provider recording remains deduplicated even if its local ID differs', async (t) => {
  const f = await fixture();
  t.after(() => f.sqlite.close());
  const file = (await exported()).data;
  file.standaloneRuns = [
    loose({
      id: 'restored-record-1',
      activityId: athlete + ':run-1',
      source: 'Intervals.icu',
    }),
  ];
  assert.equal((await recovery('restore', file)).status, 200);
  assert.equal(
    (
      await connect(
        request('/api/connections', { key: 'synthetic-reconnected-key' }, 1),
      )
    ).status,
    200,
  );
  const result = await planRoute(
    request('/api/plan', { action: 'freeRun', version: 1, run: run() }, 1),
  );
  assert.ok([200, 409, 422].includes(result.status));
  assert.equal(
    countRuns(f),
    1,
    'identity deduplication must use activityId as well as local id',
  );
});

void test('R22: every accepted standalone journal export fits the recovery ingress limit', async (t) => {
  const f = await fixture();
  t.after(() => f.sqlite.close());
  // All seeded records individually satisfy the same public run contract; bulk seeding bypasses only repeated setup/rate waiting.
  for (let i = 0; i < 1100; i++)
    seedRun(f.sqlite, loose({ id: 'capacity-' + i, note: 'x'.repeat(2000) }));
  const saved = await planAction({
    action: 'freeRun',
    version: 0,
    run: run({ activityId: undefined, note: 'x'.repeat(2000) }),
  });
  if (saved.status === 413) {
    assert.equal(countRuns(f), 1100);
    return;
  }
  assert.equal(saved.status, 200);
  const file = await exported();
  assert.equal(file.status, 200);
  const preview = await recoveryRoute(
    request('/api/recovery', {
      action: 'preview',
      kind: 'restore',
      file: file.data,
    }),
  );
  assert.equal(
    preview.status,
    200,
    'accepted journal produces ' +
      new TextEncoder().encode(JSON.stringify(file.data)).byteLength +
      ' bytes but cannot be restored',
  );
});

void test('R23: pre-plan correction preserves the provider identity and source with prior values in audit', async (t) => {
  const f = await fixture({ connected: true });
  t.after(() => f.sqlite.close());
  const saved = await planAction({ action: 'freeRun', version: 0, run: run() });
  assert.equal(saved.status, 200);
  const original = saved.data.standaloneRuns[0];
  const corrected = await planAction({
    action: 'correctExtra',
    version: 0,
    id: original.id,
    run: { ...original, minutes: 35, km: 5.7, source: 'Client replacement' },
    correctionReason: 'Corrected a paused watch',
  });
  assert.equal(corrected.status, 200, JSON.stringify(corrected.data));
  const actual = corrected.data.standaloneRuns[0];
  assert.equal(actual.minutes, 35);
  assert.equal(actual.km, 5.7);
  assert.equal(actual.activityId, original.activityId);
  assert.equal(actual.source, original.source);
  assert.equal(actual.corrections.length, 1);
  assert.equal(actual.corrections[0].minutes, original.minutes);
  assert.equal(actual.corrections[0].km, original.km);
  const forbidden = await planAction({
    action: 'correctExtra',
    version: 0,
    id: original.id,
    run: { ...actual, activityId: athlete + ':foreign' },
    correctionReason: 'Synthetic correction',
  });
  assert.equal(forbidden.status, 422);
  const reimport = await planAction({
    action: 'freeRun',
    version: 0,
    run: run(),
  });
  assert.equal(reimport.status, 200);
  assert.equal(reimport.data.standaloneRuns[0].minutes, 35);
  const file = (await exported()).data;
  assert.equal((await recovery('restore', file)).status, 200);
  const after = await (
    await stateRoute(request('/api/state', undefined, 1))
  ).json();
  assert.deepEqual(after.standaloneRuns[0].corrections, actual.corrections);
});

void test('R24: first preview and activation protect days already recorded before a plan', async (t) => {
  const f = await fixture({ connected: true });
  t.after(() => f.sqlite.close());
  assert.equal(
    (await planAction({ action: 'freeRun', version: 0, run: run() })).status,
    200,
  );
  const weekday = (new Date(today + 'T12:00:00Z').getUTCDay() + 6) % 7,
    days = [
      weekday,
      (weekday + 2) % 7,
      (weekday + 4) % 7,
      (weekday + 6) % 7,
    ].sort((a, b) => String(a).localeCompare(String(b)));
  const profile = { ...activeProfile(), days, longDay: days.at(-1) };
  assert.ok(
    makePlan(profile).workouts.some((w) => w.date === today),
    'fixture must prescribe today before recorded-day protection',
  );
  const preview = await planAction({ action: 'preview', profile });
  assert.equal(preview.status, 200);
  assert.equal(
    preview.data.plan.workouts.filter(
      (w) => w.date === today && w.status === 'planned',
    ).length,
    0,
    'review must not offer an extra prescribed run on an imported date',
  );
  const activated = await planAction({
    action: 'activate',
    version: 0,
    profile,
    requestId: crypto.randomUUID(),
  });
  assert.equal(activated.status, 200);
  assert.equal(
    activated.data.plan.workouts.filter(
      (w) => w.date === today && w.status === 'planned',
    ).length,
    0,
  );
  assert.equal(activated.data.plan.extraRuns.length, 1);
});

for (const imported of [false, true])
  void test(`custom time ceilings permit truthful ${imported ? 'imported' : 'manual'} completion and correction`, async (t) => {
    const f = await fixture({
      connected: imported,
      activities: [recording({ moving_time: 180 * 60, distance: 18000 })],
    });
    t.after(() => f.sqlite.close());
    const plan = makePlan(
      { ...activeProfile(), weeklyMinutesLimit: 170 },
      today,
      false,
    );
    const first = plan.workouts[0];
    first.date = today;
    const before = JSON.parse(
      JSON.stringify(plan.workouts.filter((w) => w.id !== first.id)),
    );
    await saveState(owner, 0, plan, 'Synthetic time-ceiling plan', 0);
    const actual = feedback({
      actualMinutes: 180,
      actualKm: 18,
      ...(imported ? {} : { activityId: undefined, source: undefined }),
    });
    const complete = await planAction({
      action: 'complete',
      version: 1,
      id: first.id,
      feedback: actual,
    });
    assert.equal(complete.status, 200, JSON.stringify(complete.data));
    assert.equal(
      complete.data.plan.workouts.find((w) => w.id === first.id).feedback
        .actualMinutes,
      180,
    );
    assert.deepEqual(
      complete.data.plan.workouts.filter((w) => w.id !== first.id),
      before,
    );
    const corrected = await planAction({
      action: 'correctLog',
      version: 2,
      id: first.id,
      correctionReason: 'Corrected duration',
      feedback: {
        ...complete.data.plan.workouts.find((w) => w.id === first.id).feedback,
        actualMinutes: 190,
      },
    });
    assert.equal(corrected.status, 200, JSON.stringify(corrected.data));
    assert.equal(
      corrected.data.plan.workouts.find((w) => w.id === first.id).feedback
        .actualMinutes,
      190,
    );
    assert.equal(
      corrected.data.plan.workouts.find((w) => w.id === first.id).minutes,
      first.minutes,
    );
    assert.deepEqual(
      corrected.data.plan.workouts.filter((w) => w.id !== first.id),
      before,
    );
  });

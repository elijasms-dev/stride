// Current source + actual SQLite migrations. Synthetic provider GETs only. No .env or network.
// Portable unchanged into checkout/tests/. Run node --experimental-strip-types --test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
let fixtureSqlite;
import { existsSync, readFileSync, readdirSync } from 'node:fs';
const site = new URL(
  existsSync(new URL('./stride/', import.meta.url)) ? './stride/' : '../',
  import.meta.url,
);
const owner = 'activity-status-owner',
  other = 'activity-status-other',
  athlete = 'i920000001',
  sentinel = 'PRIVATE-PROVIDER-NOTE-SENTINEL';
globalThis.activityStatusTestEnv = {
  DB: null,
  STRIDE_ENCRYPTION_KEY: 'synthetic-status-cipher-secret',
};
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'cloudflare:workers')
      return {
        url: 'data:text/javascript,export const env=globalThis.activityStatusTestEnv;',
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
const { GET: activitiesRoute } = await import(
  new URL('app/api/activities/route.ts', site)
);
const { POST: planRoute } = await import(
  new URL('app/api/plan/route.ts', site)
);
const { POST: connectionRoute } = await import(
  new URL('app/api/connections/route.ts', site)
);
const { POST: recoveryRoute } = await import(
  new URL('app/api/recovery/route.ts', site)
);
const { GET: stateRoute } = await import(
  new URL('app/api/state/route.ts', site)
);
const { GET: exportRoute } = await import(
  new URL('app/api/export/route.ts', site)
);
const { readAccount } = await import(new URL('lib/accounts.ts', site));
const { encrypt, saveState } = await import(new URL('lib/server.ts', site));
const { makePlan, demoProfile, todayInZone, addDays } = await import(
  new URL('lib/engine.ts', site)
);
const today = todayInZone('UTC'),
  profile = () => ({
    ...demoProfile(today),
    startDate: today,
    timezone: 'UTC',
  });
const recording = (values = {}) => ({
  id: 'run-1',
  name: sentinel,
  type: 'Run',
  start_date_local: today + 'T07:30:00',
  start_date: today + 'T07:30:00Z',
  timezone: 'UTC',
  moving_time: 1801,
  distance: 5432,
  source: 'GARMIN',
  description: sentinel,
  ...values,
});
const run = (values = {}) => ({
  date: today,
  minutes: 40,
  km: 6,
  effort: 4,
  feeling: 'good',
  note: sentinel,
  source: 'Untrusted source',
  activityId: athlete + ':run-1',
  ...values,
});
function request(path, payload, epoch = 0, who = owner) {
  return new Request('https://fixture.invalid' + path, {
    method: payload ? 'POST' : 'GET',
    headers: {
      'oai-authenticated-user-id': who,
      'x-stride-account':
        fixtureSqlite
          .prepare('SELECT account_id FROM accounts WHERE owner=?')
          .get(who)?.account_id ?? '',
      'x-stride-epoch': String(epoch),
      origin: 'https://fixture.invalid',
      'content-type': 'application/json',
    },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  });
}
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
async function fixture(t, options = {}) {
  const sqlite = (fixtureSqlite = new DatabaseSync(':memory:')),
    migrations = new URL('drizzle/', site);
  for (const f of readdirSync(migrations)
    .filter((n) => /^\d+.*\.sql$/.test(n))
    .sort())
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
  globalThis.activityStatusTestEnv.DB = {
    prepare,
    batch: async (stmts) => {
      options.beforeBatch?.(sqlite, stmts);
      sqlite.exec('BEGIN');
      try {
        const results = [];
        for (const s of stmts) results.push(await s.run());
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
  t.after(() => sqlite.close());
  for (const who of [owner, other]) {
    await readAccount(who);
    sqlite
      .prepare(
        'INSERT INTO profiles(owner,display_name,city,units,timezone,accent,updated_at) VALUES(?,?,?,?,?,?,?)',
      )
      .run(
        who,
        'Fixture',
        '',
        'km',
        'UTC',
        'evergreen',
        new Date().toISOString(),
      );
    sqlite
      .prepare(
        'INSERT INTO connections(owner,encrypted_key,athlete_name,connected_at,provider_athlete_id,generation) VALUES(?,?,?,?,?,?)',
      )
      .run(
        who,
        await encrypt('synthetic-status-provider-key'),
        'Fixture',
        new Date().toISOString(),
        who === owner ? athlete : 'i920000002',
        'generation-1',
      );
  }
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(
      typeof input === 'string' || input instanceof URL ? input : input.url,
    );
    assert.equal(url.origin, 'https://intervals.icu');
    assert.equal(init.method ?? 'GET', 'GET', 'Provider mutations prohibited');
    calls.push(url.pathname + url.search);
    if (url.pathname === '/api/v1/athlete/0')
      return Response.json({ id: options.athlete ?? athlete, name: 'Fixture' });
    if (url.pathname.endsWith('/activities')) {
      if (options.onActivities) {
        const result = await options.onActivities(sqlite, url);
        if (result) return result;
      }
      if (options.failure)
        return new Response(sentinel, {
          status: options.failure,
          headers: options.failure === 429 ? { 'Retry-After': '60' } : {},
        });
      return Response.json(options.activities ?? [recording()]);
    }
    throw new Error('Unmocked provider URL prohibited');
  };
  return {
    sqlite,
    options,
    calls,
    status: (who = owner) => {
      const r = sqlite
        .prepare(
          'SELECT provider_athlete_id,generation,activity_check,activity_attempt,activity_imported_at,activity_import_count FROM connections WHERE owner=?',
        )
        .get(who);
      return r
        ? {
            ...r,
            check: r.activity_check ? JSON.parse(r.activity_check) : null,
            attempt: r.activity_attempt ? JSON.parse(r.activity_attempt) : null,
          }
        : null;
    },
    version: () =>
      sqlite
        .prepare('SELECT version FROM athlete_state WHERE owner=?')
        .get(owner)?.version ?? 0,
  };
}
async function check() {
  const response = await activitiesRoute(request('/api/activities'));
  return { status: response.status, data: await response.json() };
}
async function action(f, payload, epoch = 0) {
  const response = await planRoute(
    request('/api/plan', { version: f.version(), ...payload }, epoch),
  );
  return { status: response.status, data: await response.json() };
}
async function recover(kind, file, epoch = 0) {
  const preview = await recoveryRoute(
    request(
      '/api/recovery',
      { action: 'preview', kind, ...(file ? { file } : {}) },
      epoch,
    ),
  );
  assert.equal(preview.status, 200, await preview.clone().text());
  const { id } = await preview.json();
  const commit = await recoveryRoute(
    request(
      '/api/recovery',
      {
        action: 'commit',
        kind,
        id,
        confirm: kind === 'delete' ? 'DELETE' : 'REPLACE',
        ...(file ? { file } : {}),
      },
      epoch,
    ),
  );
  assert.equal(commit.status, 200, await commit.clone().text());
  return commit.json();
}
function emptyStatus(s) {
  assert.ok(s);
  assert.equal(s.check, null);
  assert.equal(s.attempt, null);
  assert.equal(s.activity_imported_at, null);
  assert.equal(s.activity_import_count, 0);
}
function replaceGeneration(sqlite, who = owner) {
  sqlite
    .prepare(
      'UPDATE connections SET generation=?,activity_check=NULL,activity_attempt=NULL,activity_imported_at=NULL,activity_import_count=0 WHERE owner=?',
    )
    .run('generation-2', who);
  sqlite
    .prepare('UPDATE accounts SET revision=revision+1 WHERE owner=?')
    .run(who);
}
async function seedPlan(_f) {
  const plan = makePlan(profile());
  plan.workouts[0].date = today;
  await saveState(owner, 0, plan, 'Fixture initial plan', 0);
  return plan;
}

void test('S01: explicit check persists bounded summary and owner-isolated status, never a journal import', async (t) => {
  const f = await fixture(t, { activities: [recording(), recording(), null] }),
    foreign = f.status(other),
    result = await check();
  assert.equal(result.status, 200);
  const s = f.status();
  assert.equal(s.check.count, 1);
  assert.equal(s.check.excluded, 1);
  assert.equal(s.check.duplicates, 1);
  assert.equal(s.check.from, addDays(today, -41));
  assert.equal(s.check.to, today);
  assert.ok(Number.isFinite(Date.parse(s.check.at)));
  assert.equal(s.attempt.outcome, 'success');
  assert.equal(s.activity_imported_at, null);
  assert.equal(s.activity_import_count, 0);
  assert.deepEqual(f.status(other), foreign);
  assert.deepEqual(Object.keys(s.check).sort(), [
    'at',
    'count',
    'duplicates',
    'excluded',
    'from',
    'to',
  ]);
  assert.ok(
    !JSON.stringify({ check: s.check, attempt: s.attempt }).includes(sentinel),
  );
  const loaded = await (await stateRoute(request('/api/state'))).json();
  assert.equal(loaded.connection.activity_check.count, 1);
  assert.ok(
    !JSON.stringify(loaded.connection).includes(
      'synthetic-status-provider-key',
    ),
  );
});
void test('S02: empty valid provider result is a successful zero check, with no saved recording', async (t) => {
  const f = await fixture(t, { activities: [] });
  assert.equal((await check()).status, 200);
  assert.equal(f.status().check.count, 0);
  assert.equal(f.status().attempt.outcome, 'success');
  assert.equal(f.status().activity_import_count, 0);
});
void test('S03: later failure preserves check and import success and stores only a safe error category', async (t) => {
  const f = await fixture(t);
  assert.equal((await check()).status, 200);
  assert.equal(
    (await action(f, { action: 'freeRun', run: run() })).status,
    200,
  );
  const previous = f.status();
  f.options.failure = 503;
  assert.equal((await check()).status, 502);
  const current = f.status();
  assert.deepEqual(current.check, previous.check);
  assert.equal(current.activity_imported_at, previous.activity_imported_at);
  assert.equal(current.activity_import_count, 1);
  assert.equal(current.attempt.outcome, 'failed');
  assert.equal(current.attempt.category, 'service-unavailable');
  assert.ok(!JSON.stringify(current.attempt).includes(sentinel));
});
void test('S04: manual logging and import verification do not count as activity checks', async (t) => {
  const f = await fixture(t);
  assert.equal(
    (
      await action(f, {
        action: 'freeRun',
        run: run({ activityId: undefined }),
      })
    ).status,
    200,
  );
  emptyStatus(f.status());
  assert.equal(
    (await action(f, { action: 'freeRun', run: run() })).status,
    200,
  );
  assert.equal(f.status().activity_import_count, 1);
  assert.ok(Number.isFinite(Date.parse(f.status().activity_imported_at)));
  assert.equal(f.status().check, null);
  assert.equal(f.status().attempt, null);
});
void test('S05: duplicate import, correction and plan activation transfer never stamp another import', async (t) => {
  const f = await fixture(t);
  const first = await action(f, { action: 'freeRun', run: run() });
  assert.equal(first.status, 200);
  const saved = f.status(),
    r = first.data.standaloneRuns[0];
  assert.equal(
    (await action(f, { action: 'freeRun', run: run() })).status,
    200,
  );
  assert.equal(
    (
      await action(f, {
        action: 'correctExtra',
        id: r.id,
        run: { ...r, minutes: 35 },
        correctionReason: 'Corrected pause',
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await action(f, {
        action: 'activate',
        profile: profile(),
        requestId: crypto.randomUUID(),
      })
    ).status,
    200,
  );
  assert.deepEqual(f.status(), saved);
});
void test('S06: active-plan extra import, first completion and first attachment each count exactly once', async (t) => {
  const f = await fixture(t),
    plan = await seedPlan(f);
  assert.equal(
    (await action(f, { action: 'freeRun', run: run() })).status,
    200,
  );
  assert.equal(f.status().activity_import_count, 1);
  f.options.activities = [recording({ id: 'run-2' })];
  const completed = await action(f, {
    action: 'complete',
    id: plan.workouts[0].id,
    feedback: {
      actualDate: today,
      actualMinutes: 40,
      actualKm: 6,
      effort: 4,
      feeling: 'good',
      note: sentinel,
      activityId: athlete + ':run-2',
      source: 'Untrusted',
    },
  });
  assert.equal(completed.status, 200, JSON.stringify(completed.data));
  assert.equal(f.status().activity_import_count, 2);
  const manual = await action(f, {
    action: 'freeRun',
    run: run({ activityId: undefined }),
  });
  assert.equal(manual.status, 200);
  assert.equal(f.status().activity_import_count, 2);
  const extra = manual.data.plan.extraRuns.find((r) => !r.activityId);
  f.options.activities = [recording({ id: 'run-3' })];
  const attached = await action(f, {
    action: 'attachRecording',
    id: extra.id,
    run: run({ activityId: athlete + ':run-3' }),
  });
  assert.equal(attached.status, 200, JSON.stringify(attached.data));
  assert.equal(f.status().activity_import_count, 3);
  assert.equal(f.status().check, null);
});
void test('S07: reconnect same athlete resets connection status without deleting journal records', async (t) => {
  const f = await fixture(t);
  await check();
  assert.equal(
    (await action(f, { action: 'freeRun', run: run() })).status,
    200,
  );
  const response = await connectionRoute(
    request('/api/connections', { key: 'synthetic-reconnect-key' }),
  );
  assert.equal(response.status, 200);
  emptyStatus(f.status());
  assert.notEqual(f.status().generation, 'generation-1');
  assert.equal(f.status().provider_athlete_id, athlete);
  assert.equal(
    f.sqlite
      .prepare('SELECT count(*) AS n FROM standalone_runs WHERE owner=?')
      .get(owner).n,
    1,
  );
});
void test('S08: different-athlete reconnect exposes none of the previous athlete status', async (t) => {
  const f = await fixture(t);
  await check();
  await action(f, { action: 'freeRun', run: run() });
  f.options.athlete = 'i920000003';
  assert.equal(
    (
      await connectionRoute(
        request('/api/connections', { key: 'synthetic-other-key' }),
      )
    ).status,
    200,
  );
  emptyStatus(f.status());
  assert.equal(f.status().provider_athlete_id, 'i920000003');
});
void test('S09: generation change during a check prevents old success or failure entering new status', async (t) => {
  const f = await fixture(t, {
    onActivities: (sqlite) => {
      replaceGeneration(sqlite);
    },
  });
  assert.equal((await check()).status, 409);
  emptyStatus(f.status());
});
void test('S10: older overlapping failed check cannot overwrite the latest successful attempt', async (t) => {
  const entered = deferred(),
    release = deferred();
  let first = true;
  const f = await fixture(t, {
    onActivities: async () => {
      if (first) {
        first = false;
        entered.resolve();
        return release.promise;
      }
    },
  });
  t.after(() => release.resolve(new Response('', { status: 503 })));
  const older = check();
  await entered.promise;
  assert.equal((await check()).status, 200);
  const latest = f.status();
  release.resolve(new Response(sentinel, { status: 503 }));
  assert.equal((await older).status, 502);
  assert.deepEqual(f.status(), latest);
});
void test('S11: provider switch after verification but before active-plan commit rejects journal and status writes', async (t) => {
  const f = await fixture(t);
  await seedPlan(f);
  const before = f.sqlite
    .prepare('SELECT version,data FROM athlete_state WHERE owner=?')
    .get(owner);
  f.options.beforeBatch = (sqlite, stmts) => {
    if (stmts.some((s) => s.sql.startsWith('INSERT INTO athlete_state'))) {
      f.options.beforeBatch = null;
      replaceGeneration(sqlite);
    }
  };
  const result = await action(f, { action: 'freeRun', run: run() });
  assert.equal(result.status, 409);
  assert.deepEqual(
    f.sqlite
      .prepare('SELECT version,data FROM athlete_state WHERE owner=?')
      .get(owner),
    before,
  );
  emptyStatus(f.status());
});
void test('S12: failed plan CAS does not stamp import success or erase the last successful check', async (t) => {
  const f = await fixture(t);
  await seedPlan(f);
  await check();
  const before = f.status();
  f.options.beforeBatch = (sqlite, stmts) => {
    if (stmts.some((s) => s.sql.startsWith('INSERT INTO athlete_state'))) {
      f.options.beforeBatch = null;
      sqlite
        .prepare('UPDATE athlete_state SET version=version+1 WHERE owner=?')
        .run(owner);
    }
  };
  assert.equal(
    (await action(f, { action: 'freeRun', run: run() })).status,
    409,
  );
  assert.deepEqual(f.status(), before);
});
void test('S13: deletion during a pending check clears status; the late response cannot recreate it', async (t) => {
  const entered = deferred(),
    release = deferred();
  const f = await fixture(t, {
      onActivities: async () => {
        entered.resolve();
        return release.promise;
      },
    }),
    foreign = f.status(other);
  t.after(() => release.resolve(Response.json([])));
  const pending = check();
  await entered.promise;
  await recover('delete');
  assert.equal(f.status(), null);
  release.resolve(Response.json([recording()]));
  assert.ok([401, 409].includes((await pending).status));
  assert.equal(f.status(), null);
  assert.deepEqual(f.status(other), foreign);
});
void test('S14: recovery exports exclude status; restore clears it and reconnect starts a fresh epoch', async (t) => {
  const f = await fixture(t);
  await check();
  await action(f, { action: 'freeRun', run: run() });
  const response = await exportRoute(request('/api/export?format=recovery'));
  assert.equal(response.status, 200);
  const file = await response.json(),
    foreign = f.status(other);
  for (const field of [
    'activity_check',
    'activity_attempt',
    'activity_imported_at',
    'activity_import_count',
    'encrypted_key',
  ])
    assert.ok(!JSON.stringify(file).includes(field));
  await recover('restore', file);
  assert.equal(f.status(), null);
  assert.deepEqual(f.status(other), foreign);
  assert.equal(
    (
      await connectionRoute(
        request('/api/connections', { key: 'synthetic-restored-key' }, 1),
      )
    ).status,
    200,
  );
  emptyStatus(f.status());
  assert.equal(
    f.sqlite.prepare('SELECT epoch FROM accounts WHERE owner=?').get(owner)
      .epoch,
    1,
  );
});

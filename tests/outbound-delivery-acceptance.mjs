// Offline acceptance tests against actual Stride adapters and actual receipt SQL.
// Run outside checkout: node work/outbound-delivery-acceptance.mjs --isolated-patch
// After copying into checkout/tests: node --test tests/outbound-delivery-acceptance.mjs
// Never loads .env or provider credentials. Only synthetic fetch responses are allowed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const site = new URL(
  existsSync(new URL('./stride/package.json', import.meta.url))
    ? './stride/'
    : '../',
  import.meta.url,
);
const isolatedPatch = process.argv.includes('--isolated-patch');
const actualGarmin = new URL('lib/garmin.ts', site).href;
const copiedGarmin = new URL('./outbound-patch/lib/garmin.ts', import.meta.url)
  .href;
const owner = 'integration-acceptance-owner';
const athleteId = 'i900000000';
const generation = 'test-generation-1';
globalThis.integrationAcceptanceEnv = {
  DB: null,
  STRIDE_ENCRYPTION_KEY: 'synthetic-test-secret-never-a-real-account-key',
};
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (isolatedPatch && specifier === actualGarmin)
      return { url: copiedGarmin, shortCircuit: true };
    const parentURL =
      isolatedPatch && context.parentURL === copiedGarmin
        ? actualGarmin
        : context.parentURL;
    if (specifier === 'cloudflare:workers')
      return {
        url: 'data:text/javascript,export const env=globalThis.integrationAcceptanceEnv;',
        shortCircuit: true,
      };
    if (parentURL?.startsWith(site.href)) {
      const base = specifier.startsWith('@/')
        ? new URL(specifier.slice(2), site)
        : specifier.startsWith('.')
          ? new URL(specifier, parentURL)
          : null;
      if (base)
        for (const suffix of ['', '.ts', '.tsx', '/index.ts']) {
          const url = new URL(base.href + suffix);
          if (existsSync(url))
            return {
              url:
                isolatedPatch && url.href === actualGarmin
                  ? copiedGarmin
                  : url.href,
              shortCircuit: true,
            };
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
const { GET: _getActivities } = await import(
  new URL('app/api/activities/route.ts', site)
);
const { GET: _getState } = await import(
  new URL('app/api/state/route.ts', site)
);
const { GET: _checkConnection } = await import(
  new URL('app/api/connections/route.ts', site)
);
const { POST: _reconcile } = await import(
  new URL('app/api/reconcile/route.ts', site)
);
const { POST: _updatePlan } = await import(
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
  const sqlite = new DatabaseSync(':memory:');
  const migrationDir = new URL('drizzle/', site);
  for (const filename of readdirSync(migrationDir)
    .filter((x) => /^\d+.*\.sql$/.test(x))
    .sort()) {
    sqlite.exec(readFileSync(new URL(filename, migrationDir), 'utf8'));
  }
  globalThis.integrationAcceptanceEnv.DB = d1(sqlite, options);
  const plan = makePlan(
    {
      ...demoProfile(today),
      startDate: today,
      runMeasure: options.runMeasure ?? 'distance',
    },
    today,
  );
  plan.profile.timezone = 'UTC';
  const w = {
    ...plan.workouts[0],
    date: options.workoutDate ?? addDays(today, 2),
    status: options.skipped ? 'skipped' : 'planned',
  };
  if (options.spacedCue)
    w.steps[0].effort = 'Conversational\n\u00a0  effort · 2–3 / 10';
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
    push_errors: options.pushErrors ?? null,
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
        text: options.spacedCue ? s.effort.replace(/\s+/g, ' ') : s.effort,
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
      return Response.json({
        id: athleteId,
        name: 'Synthetic runner',
        ...options.athlete,
      });
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

void test('E01: unchanged prescription should clear obsolete receipt version after a plan revision', async (t) => {
  const f = await fixture({ absent: true });
  t.after(() => f.sqlite.close());
  assert.equal((await outcome(f)).status, 'accepted');
  f.sqlite
    .prepare('UPDATE athlete_state SET version=4 WHERE owner=?')
    .run(owner);
  assert.equal((await outcome(f, 4)).status, 'accepted');
  const receipt = f.sqlite
    .prepare('SELECT version FROM deliveries WHERE owner=? AND workout_id=?')
    .get(owner, f.w.id);
  assert.equal(
    receipt.version,
    4,
    'Receipt version remains stale after successful resend',
  );
});
void test('E02: time prescription must reject a distance-terminated provider step', async (t) => {
  const f = await fixture({ absent: true, runMeasure: 'time' });
  t.after(() => f.sqlite.close());
  assert.equal(
    f.w.steps[0].metres,
    undefined,
    'The saved prescription must end on time.',
  );
  const providerFetch = globalThis.integrationAcceptanceFetch;
  globalThis.integrationAcceptanceFetch = async (url, init) => {
    const response = await providerFetch(url, init);
    if (
      (init?.method ?? 'GET') === 'GET' &&
      new URL(url).pathname.endsWith('/events/77')
    ) {
      const event = await response.json();
      event.workout_doc.steps[0].distance = 5000;
      return Response.json(event);
    }
    return response;
  };
  notCertified(await outcome(f));
});
void test('E03: explicit resend after remote deletion should verify the provider calendar', async (t) => {
  const f = await fixture({ absent: true });
  t.after(() => f.sqlite.close());
  assert.equal((await outcome(f)).status, 'accepted');
  const previousCalls = f.calls.length;
  const providerFetch = globalThis.integrationAcceptanceFetch;
  globalThis.integrationAcceptanceFetch = async (url, init) => {
    const path = new URL(url).pathname;
    if ((init?.method ?? 'GET') === 'GET' && path.endsWith('/events')) {
      f.calls.push({ path, method: 'GET' });
      return Response.json([]);
    }
    if ((init?.method ?? 'GET') === 'GET' && path.endsWith('/events/77')) {
      f.calls.push({ path, method: 'GET' });
      return new Response(null, { status: 404 });
    }
    return providerFetch(url, init);
  };
  await outcome(f);
  assert.ok(
    f.calls.length > previousCalls,
    'Explicit resend returns cached acceptance without a provider read',
  );
});

void test('E04: a matching current receipt performs readback without a redundant provider write', async (t) => {
  const f = await fixture({ absent: true });
  t.after(() => f.sqlite.close());
  assert.equal((await outcome(f)).status, 'accepted');
  const before = f.calls.length;
  assert.equal((await outcome(f)).status, 'accepted');
  assert.ok(f.calls.slice(before).some((c) => c.method === 'GET'));
  assert.equal(
    f.calls.slice(before).filter((c) => c.method !== 'GET').length,
    0,
  );
});
void test('E05: matching provider readback preserves user confirmation and updates receipt version', async (t) => {
  const f = await fixture({ absent: true });
  t.after(() => f.sqlite.close());
  assert.equal((await outcome(f)).status, 'accepted');
  f.sqlite
    .prepare("UPDATE deliveries SET status='confirmed' WHERE owner=?")
    .run(owner);
  f.sqlite
    .prepare('UPDATE athlete_state SET version=4 WHERE owner=?')
    .run(owner);
  assert.equal((await outcome(f, 4)).status, 'confirmed');
  assert.equal(
    f.sqlite.prepare('SELECT version FROM deliveries WHERE owner=?').get(owner)
      .version,
    4,
  );
});
void test('E06: known POST identity plus failed readback and subsequent404 must not create again', async (t) => {
  const f = await fixture({ absent: true, failReadbackOnce: true });
  t.after(() => f.sqlite.close());
  notCertified(await outcome(f));
  assert.equal(f.calls.filter((c) => c.method === 'POST').length, 1);
  const providerFetch = globalThis.integrationAcceptanceFetch;
  globalThis.integrationAcceptanceFetch = async (url, init) => {
    const path = new URL(url).pathname;
    if ((init?.method ?? 'GET') === 'GET' && path.endsWith('/events'))
      return Response.json([]);
    if ((init?.method ?? 'GET') === 'GET' && path.endsWith('/events/77'))
      return new Response(null, { status: 404 });
    return providerFetch(url, init);
  };
  notCertified(await outcome(f));
  assert.equal(
    f.calls.filter((c) => c.method === 'POST').length,
    1,
    'Known identity with unclear visibility was recreated',
  );
});
void test('E07: connection rotation during cached-receipt readback must not certify', async (t) => {
  const f = await fixture({ absent: true });
  t.after(() => f.sqlite.close());
  assert.equal((await outcome(f)).status, 'accepted');
  const before = f.calls.length;
  const providerFetch = globalThis.integrationAcceptanceFetch;
  globalThis.integrationAcceptanceFetch = async (url, init) => {
    const r = await providerFetch(url, init);
    if (
      (init?.method ?? 'GET') === 'GET' &&
      new URL(url).pathname.endsWith('/events')
    )
      f.sqlite
        .prepare('UPDATE connections SET generation=? WHERE owner=?')
        .run('other-generation', owner);
    return r;
  };
  notCertified(await outcome(f));
  assert.equal(
    f.calls.slice(before).filter((c) => c.method !== 'GET').length,
    0,
  );
});
void test('E08: computed_distance may coexist with a genuinely timed provider step', async (t) => {
  const f = await fixture({ absent: true, runMeasure: 'time' });
  t.after(() => f.sqlite.close());
  assert.equal(
    f.w.steps[0].metres,
    undefined,
    'The saved prescription must end on time.',
  );
  const providerFetch = globalThis.integrationAcceptanceFetch;
  globalThis.integrationAcceptanceFetch = async (url, init) => {
    const r = await providerFetch(url, init);
    if (
      (init?.method ?? 'GET') === 'GET' &&
      new URL(url).pathname.endsWith('/events/77')
    ) {
      const event = await r.json();
      event.workout_doc.steps[0]._distance = 5000;
      return Response.json(event);
    }
    return r;
  };
  assert.equal((await outcome(f)).status, 'accepted');
});
void test('E09: lost POST response and empty lookup retains unknown outcome and blocks a secondPOST', async (t) => {
  const f = await fixture({ absent: true, losePostResponseOnce: true });
  t.after(() => f.sqlite.close());
  notCertified(await outcome(f));
  const providerFetch = globalThis.integrationAcceptanceFetch;
  globalThis.integrationAcceptanceFetch = async (url, init) => {
    if (
      (init?.method ?? 'GET') === 'GET' &&
      new URL(url).pathname.endsWith('/events')
    )
      return Response.json([]);
    return providerFetch(url, init);
  };
  notCertified(await outcome(f));
  assert.equal(f.calls.filter((c) => c.method === 'POST').length, 1);
  assert.equal(
    f.sqlite
      .prepare('SELECT create_outcome FROM deliveries WHERE owner=?')
      .get(owner).create_outcome,
    'unknown',
  );
});

for (const restored of [false, true]) {
  for (const status of [401, 403, 429]) {
    void test(`a definitively rejected ${restored ? 'restored' : 'new'} upload (${status}) can be retried after the rejection is resolved`, async (t) => {
      const f = await fixture({
        absent: true,
        ...(restored ? { receipt: { status: 'removed' } } : {}),
      });
      t.after(() => f.sqlite.close());
      const providerFetch = globalThis.integrationAcceptanceFetch;
      let rejected = false;
      globalThis.integrationAcceptanceFetch = async (url, init = {}) => {
        if (init.method === 'POST' && !rejected) {
          rejected = true;
          return new Response(null, {
            status,
            headers: { 'Retry-After': '60' },
          });
        }
        return providerFetch(url, init);
      };
      notCertified(await outcome(f));
      assert.equal(rejected, true, 'Exercise the upload rejection');
      const receipt = f.sqlite
        .prepare('SELECT * FROM deliveries WHERE owner=?')
        .get(owner);
      assert.equal(receipt.status, 'failed');
      assert.equal(receipt.create_outcome, 'none');
      assert.equal(receipt.remote_id, null);
      if (status === 429) {
        const blocked = await outcome(f);
        assert.equal(
          blocked.error.status,
          429,
          'Respect cooldown before retrying',
        );
        assert.equal(f.calls.filter((c) => c.method === 'POST').length, 0);
      }
      f.sqlite
        .prepare(
          "DELETE FROM request_limits WHERE owner=? AND bucket='provider-cooldown'",
        )
        .run(owner);
      assert.equal((await outcome(f)).status, 'accepted');
      assert.equal(f.calls.filter((c) => c.method === 'POST').length, 1);
    });
  }
}

void test('a local cooldown between claiming creation and dispatch makes zero POSTs and does not poison retry', async (t) => {
  let inserted = false;
  const f = await fixture({
    absent: true,
    beforeRun(sqlite, sql) {
      if (!inserted && sql.includes("SET create_outcome='unknown'")) {
        inserted = true;
        sqlite
          .prepare(
            "INSERT INTO request_limits(owner,bucket,count,reset_at) VALUES(?,'provider-cooldown',0,?)",
          )
          .run(owner, Math.floor(Date.now() / 1000) + 60);
      }
    },
  });
  t.after(() => f.sqlite.close());
  assert.equal((await outcome(f)).error.status, 429);
  assert.equal(inserted, true);
  assert.equal(f.calls.filter((c) => c.method === 'POST').length, 0);
  assert.equal(
    f.sqlite
      .prepare('SELECT create_outcome FROM deliveries WHERE owner=?')
      .get(owner).create_outcome,
    'none',
  );
  f.sqlite
    .prepare(
      "DELETE FROM request_limits WHERE owner=? AND bucket='provider-cooldown'",
    )
    .run(owner);
  assert.equal((await outcome(f)).status, 'accepted');
  assert.equal(f.calls.filter((c) => c.method === 'POST').length, 1);
});

for (const restored of [false, true]) {
  void test(`a server failure during ${restored ? 'restored' : 'new'} creation remains ambiguous and cannot duplicate the upload`, async (t) => {
    const f = await fixture({
      absent: true,
      ...(restored ? { receipt: { status: 'removed' } } : {}),
    });
    t.after(() => f.sqlite.close());
    const providerFetch = globalThis.integrationAcceptanceFetch;
    let attempts = 0;
    globalThis.integrationAcceptanceFetch = async (url, init = {}) => {
      if (init.method === 'POST') {
        attempts++;
        return new Response(null, { status: 503 });
      }
      return providerFetch(url, init);
    };
    notCertified(await outcome(f));
    notCertified(await outcome(f));
    assert.equal(attempts, 1);
    assert.equal(
      f.sqlite
        .prepare('SELECT create_outcome FROM deliveries WHERE owner=?')
        .get(owner).create_outcome,
      'unknown',
    );
  });
}

void test('checking a restored removed workout does not resurrect its deleted event identity or prevent sending', async (t) => {
  const f = await fixture({ absent: true, receipt: { status: 'removed' } });
  t.after(() => f.sqlite.close());
  const checked = await syncWorkout(owner, f.w.id, 3, false, undefined, true);
  assert.equal(checked.status, 'review');
  const receipt = f.sqlite
    .prepare('SELECT * FROM deliveries WHERE owner=?')
    .get(owner);
  assert.equal(receipt.remote_id, null);
  assert.equal(receipt.create_outcome, 'none');
  assert.equal(
    f.calls.every((c) => c.method === 'GET'),
    true,
  );
  assert.equal((await outcome(f)).status, 'accepted');
  assert.equal(f.calls.filter((c) => c.method === 'POST').length, 1);
});

void test('a lookup failure while restoring a removed workout does not block the next send', async (t) => {
  const f = await fixture({ absent: true, receipt: { status: 'removed' } });
  t.after(() => f.sqlite.close());
  const providerFetch = globalThis.integrationAcceptanceFetch;
  let failed = false;
  globalThis.integrationAcceptanceFetch = async (url, init = {}) => {
    if (!failed && new URL(url).pathname.endsWith('/events')) {
      failed = true;
      return new Response(null, { status: 503 });
    }
    return providerFetch(url, init);
  };
  notCertified(await outcome(f));
  assert.equal(f.calls.filter((c) => c.method === 'POST').length, 0);
  assert.equal((await outcome(f)).status, 'accepted');
  assert.equal(f.calls.filter((c) => c.method === 'POST').length, 1);
});

void test('connection diagnostics expose only verified Garmin readiness fields', async () => {
  await fixture({
    athlete: {
      icu_garmin_training: true,
      icu_garmin_upload_workouts: true,
      icu_garmin_last_upload: '2026-09-07T14:33:30.255+00:00',
      icu_garmin_upload_filters: ['Run'],
      email: 'private@example.test',
      api_key: 'private-key',
    },
  });
  const response = await _checkConnection(
    new Request('https://stride.test/api/connections', {
      headers: { 'oai-authenticated-user-id': owner },
    }),
  );
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.deepEqual(
    Object.keys(result).sort(),
    [
      'checkedAt',
      'trainingAccess',
      'workoutUploads',
      'hasUploadFilters',
      'lastUploadAt',
    ].sort(),
  );
  assert.equal(result.trainingAccess, true);
  assert.equal(result.workoutUploads, true);
  assert.equal(result.hasUploadFilters, true);
  assert.ok(Number.isFinite(Date.parse(result.checkedAt)));
});

void test('connection diagnostics distinguish unknown flags and reject athlete mismatch', async () => {
  await fixture();
  const req = () =>
    new Request('https://stride.test/api/connections', {
      headers: { 'oai-authenticated-user-id': owner },
    });
  const unknown = await (await _checkConnection(req())).json();
  assert.equal(unknown.trainingAccess, null);
  assert.equal(unknown.workoutUploads, null);
  await fixture({ athlete: { id: 'i999' } });
  assert.equal((await _checkConnection(req())).status, 409);
  assert.equal(
    (await _checkConnection(new Request('https://stride.test/api/connections')))
      .status,
    401,
  );
});

void test('native uploads preserve open effort and do not invoke the provider FIT importer', async (t) => {
  const f = await fixture({ absent: true });
  t.after(() => f.sqlite.close());
  assert.equal((await outcome(f)).status, 'accepted');
  const uploaded = JSON.parse(
    f.calls.find((c) => c.method === 'POST' && c.path.endsWith('/events/bulk'))
      .body,
  )[0];
  assert.equal(uploaded.filename, undefined);
  assert.equal(uploaded.file_contents_base64, undefined);
  assert.equal(uploaded.workout_doc, undefined);
  const lines = uploaded.description.split('\n');
  assert.equal(lines.length, f.w.steps.length);
  f.w.steps.forEach((step, i) => {
    assert.ok(lines[i].startsWith(`- ${step.label} · ${step.effort} `));
    assert.ok(
      lines[i].includes(
        ` ${step.metres !== undefined ? step.metres + 'mtr' : step.seconds + 's'} freeride intensity=`,
      ),
    );
  });
});

void test('native distance and recovery encoding retain their termination rules', async () => {
  const { intervalsWorkoutText } = await import(
    new URL('lib/intervals-workout.ts', site)
  );
  const text = intervalsWorkoutText({
    steps: [
      {
        kind: 'work',
        label: 'Smooth running',
        effort: 'Controlled',
        seconds: 200,
        metres: 1000,
      },
      { kind: 'recovery', label: 'Recover', effort: 'Easy jog', seconds: 90 },
      { kind: 'cooldown', label: 'Cool down', effort: 'Relaxed', seconds: 300 },
    ],
  });
  assert.equal(
    text,
    '- Smooth running · Controlled 1000mtr freeride intensity=active\n- Recover · Easy jog 90s freeride intensity=recovery\n- Cool down · Relaxed 300s freeride intensity=cooldown',
  );
});

void test('native readback accepts harmless normalized whitespace in a restored cue', async (t) => {
  const f = await fixture({ absent: true, spacedCue: true });
  t.after(() => f.sqlite.close());
  assert.equal((await outcome(f)).status, 'accepted');
});

void test('a late Garmin failure is found by read-only recheck and cleared without resending', async (t) => {
  const errors = [];
  const f = await fixture({ absent: true, pushErrors: errors });
  t.after(() => f.sqlite.close());
  assert.equal((await outcome(f)).status, 'accepted');
  const before = f.calls.length;
  errors.push({
    service: 'GARMIN',
    message: 'Provider detail must not be echoed',
  });
  const failed = await syncWorkout(owner, f.w.id, 3, false, undefined, true);
  assert.equal(failed.status, 'review');
  assert.match(failed.message, /Garmin reported an upload problem/);
  assert.ok(!failed.message.includes('Provider detail'));
  assert.ok(f.calls.slice(before).every((c) => c.method === 'GET'));
  errors.length = 0;
  const recovered = await syncWorkout(owner, f.w.id, 3, false, undefined, true);
  assert.equal(recovered.status, 'accepted');
  assert.match(recovered.message, /check your watch/);
  assert.ok(f.calls.slice(before).every((c) => c.method === 'GET'));
});

void test('Garmin push errors are surfaced immediately; other providers do not imply Garmin failure', async (t) => {
  const f = await fixture({
    absent: true,
    pushErrors: [{ service: 'GARMIN_CONNECT', message: 'Denied' }],
  });
  t.after(() => f.sqlite.close());
  assert.equal((await outcome(f)).status, 'review');
  const { garminUploadFailed } = await import(
    new URL('lib/delivery-policy.ts', site)
  );
  for (const push_errors of [
    null,
    [],
    [{ service: 'ZWIFT', message: 'Denied' }],
    [{ message: 'Garmin' }],
  ])
    assert.equal(garminUploadFailed({ push_errors }), false);
});

void test('status recheck never recreates a missing provider event', async (t) => {
  const f = await fixture({ absent: true, receipt: {} });
  t.after(() => f.sqlite.close());
  const result = await syncWorkout(owner, f.w.id, 3, false, undefined, true);
  assert.equal(result.status, 'review');
  assert.match(result.message, /could not be found/);
  assert.ok(f.calls.every((c) => c.method === 'GET'));
});

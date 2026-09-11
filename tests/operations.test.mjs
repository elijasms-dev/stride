// Independent offline operations regressions. No existing delivery suite is imported or run.
// Run: node --expose-gc --experimental-strip-types --test work/operations-acceptance.mjs
// All SQL uses temporary in-memory SQLite; all provider responses are synthetic.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
let fixtureSqlite;
import { existsSync, readFileSync, readdirSync } from 'node:fs';
const site = new URL('../', import.meta.url);
const owner = 'synthetic-operations-owner',
  athlete = 'i900000000',
  generation = 'synthetic-operations-generation';
globalThis.operationsEnv = {
  DB: null,
  STRIDE_ENCRYPTION_KEY: 'synthetic-operations-cipher-key',
};
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'cloudflare:workers')
      return {
        url: 'data:text/javascript,export const env=globalThis.operationsEnv;',
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
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(
    typeof input === 'string' || input instanceof URL ? input : input.url,
  );
  assert.equal(
    url.origin,
    'https://intervals.icu',
    'No real network host is allowed',
  );
  if (!globalThis.operationsFetch)
    throw new Error('Unconfigured synthetic fetch');
  return globalThis.operationsFetch(url, init);
};
const { GET: exportJournal } = await import(
  new URL('app/api/export/route.ts', site)
);
const { POST: reconcile } = await import(
  new URL('app/api/reconcile/route.ts', site)
);
const { intervals, failure, saveState, encrypt, requestLimit } = await import(
  new URL('lib/server.ts', site)
);
const { readAccount, guardAccount } = await import(
  new URL('lib/accounts.ts', site)
);
const { makePlan, demoProfile, todayInZone } = await import(
  new URL('lib/engine.ts', site)
);
const today = todayInZone('UTC');
function fixture() {
  const sqlite = (fixtureSqlite = new DatabaseSync(':memory:')),
    stats = { largestHistoryBatchBytes: 0 };
  const migrationDir = new URL('drizzle/', site);
  for (const name of readdirSync(migrationDir)
    .filter((n) => /^\d+.*\.sql$/.test(n))
    .sort())
    sqlite.exec(readFileSync(new URL(name, migrationDir), 'utf8'));
  const prepare = (sql, values = []) => ({
    bind: (...args) => prepare(sql, args),
    first: async (column) => {
      const row = sqlite.prepare(sql).get(...values) ?? null;
      return column ? (row?.[column] ?? null) : row;
    },
    all: async () => {
      const rows = sqlite.prepare(sql).all(...values);
      if (/\bFROM\s+revisions\b/i.test(sql))
        stats.largestHistoryBatchBytes = Math.max(
          stats.largestHistoryBatchBytes,
          rows.reduce(
            (n, r) =>
              n + Buffer.byteLength(typeof r.data === 'string' ? r.data : ''),
            0,
          ),
        );
      return { results: rows, success: true, meta: {} };
    },
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
  globalThis.operationsEnv.DB = {
    prepare,
    batch: async (stmts) => {
      sqlite.exec('BEGIN');
      try {
        const result = [];
        for (const s of stmts) result.push(await s.run());
        sqlite.exec('COMMIT');
        return result;
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
  return { sqlite, stats };
}
function request(path, method = 'GET') {
  return new Request('https://stride.test' + path, {
    method,
    headers: {
      'oai-authenticated-user-id': owner,
      'x-stride-account':
        fixtureSqlite
          .prepare('SELECT account_id FROM accounts WHERE owner=?')
          .get(owner)?.account_id ?? '',
      'x-stride-epoch': '0',
      origin: 'https://stride.test',
      'content-type': 'application/json',
    },
    ...(method === 'POST' ? { body: '{}' } : {}),
  });
}
void test('structured program export is owner-scoped and excludes revision history and private connection data', async (t) => {
  const f = fixture();
  t.after(() => f.sqlite.close());
  await readAccount(owner);
  assert.equal(
    (await exportJournal(request('/api/export?format=program'))).status,
    404,
  );
  const plan = makePlan({ ...demoProfile(today), startDate: today }, today);
  await saveState(owner, 0, plan, 'Synthetic program export', 0);
  const response = await exportJournal(request('/api/export?format=program'));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.match(
    response.headers.get('content-disposition'),
    /stride-training-program\.json/,
  );
  const program = await response.json();
  assert.equal(program.format, 'stride-training-program-1');
  assert.equal(program.plan_id, plan.id);
  assert.equal(program.history, undefined);
  assert.equal(program.connection, undefined);
  assert.equal(f.stats.largestHistoryBatchBytes, 0);
  const denied = await exportJournal(
    new Request('https://stride.test/api/export?format=program'),
  );
  assert.equal(denied.status, 401);
});
void test('O01: large but supported revisions are byte-bounded before materializing history', async (t) => {
  const f = fixture();
  t.after(() => f.sqlite.close());
  await readAccount(owner);
  const plan = makePlan({ ...demoProfile(today), startDate: today }, today);
  plan.profile.timezone = 'UTC';
  plan.extraRuns = [];
  const run = {
    date: today,
    minutes: 30,
    km: 5,
    effort: 4,
    feeling: 'good',
    note: 'x'.repeat(1500),
    source: 'Manual',
    recordedAt: new Date().toISOString(),
  };
  let bytes = Buffer.byteLength(JSON.stringify(plan));
  while (bytes < 1485000) {
    plan.extraRuns.push({
      id: `synthetic-extra-${plan.extraRuns.length}`,
      ...run,
    });
    bytes = Buffer.byteLength(JSON.stringify(plan));
  }
  assert.ok(
    bytes < 1500000,
    'Fixture must remain within the actual saveState size limit',
  );
  for (let version = 0; version < 21; version++)
    await saveState(
      owner,
      version,
      plan,
      'Synthetic supported large revision',
      0,
    );
  globalThis.gc?.();
  const baseline = process.memoryUsage();
  const stringify = JSON.stringify;
  let peak = baseline;
  JSON.stringify = function (value, ...args) {
    const result = stringify(value, ...args);
    if (value?.format === 'stride-journal-1') peak = process.memoryUsage();
    return result;
  };
  let response;
  try {
    response = await exportJournal(request('/api/export'));
  } finally {
    JSON.stringify = stringify;
  }
  assert.equal(response.status, 200);
  let responseBytes = 0;
  for await (const chunk of response.body) responseBytes += chunk.byteLength;
  t.diagnostic(
    JSON.stringify({
      revisionBytes: bytes,
      largestHistoryBatchBytes: f.stats.largestHistoryBatchBytes,
      responseBytes,
      heapBefore: baseline.heapUsed,
      heapAtSerialization: peak.heapUsed,
      heapGrowth: peak.heapUsed - baseline.heapUsed,
    }),
  );
  assert.ok(
    f.stats.largestHistoryBatchBytes <= 2000000,
    `Fetched ${f.stats.largestHistoryBatchBytes} history bytes at once; a 20-row limit is insufficient`,
  );
});
void test('O02: provider 429 preserves an actual two-hour Retry-After instead of advising one minute', async (t) => {
  let count = 0;
  globalThis.operationsFetch = async () => {
    count++;
    return new Response('synthetic private provider body', {
      status: 429,
      headers: { 'Retry-After': '7200', 'X-RateLimit-Remaining': '0,0' },
    });
  };
  let error;
  try {
    await intervals('synthetic-api-key', '/athlete/0/activities');
  } catch (e) {
    error = e;
  }
  assert.ok(error);
  const response = failure(error),
    body = await response.json();
  t.diagnostic(
    JSON.stringify({
      providerStatus: 429,
      appStatus: response.status,
      retryAfter: response.headers.get('Retry-After'),
      body,
    }),
  );
  assert.equal(count, 1);
  assert.equal(response.status, 429);
  assert.equal(
    response.headers.get('Retry-After'),
    '7200',
    'Provider cooldown was discarded',
  );
  assert.ok(!JSON.stringify(body).includes('synthetic private provider body'));
});
void test('O03: provider IP-rate-limit response without headers receives a finite fallback cooldown', async () => {
  globalThis.operationsFetch = async () => new Response(null, { status: 429 });
  let error;
  try {
    await intervals('synthetic-api-key', '/athlete/0/activities');
  } catch (e) {
    error = e;
  }
  const response = failure(error),
    delay = Number(response.headers.get('Retry-After'));
  assert.equal(response.status, 429);
  assert.ok(
    Number.isFinite(delay) && delay >= 1,
    'Headerless provider throttling needs a finite positive cooldown',
  );
});
void test('O04: reconciliation stops on the first account-wide rate limit', async (t) => {
  const f = fixture();
  t.after(() => f.sqlite.close());
  await readAccount(owner);
  const plan = makePlan({ ...demoProfile(today), startDate: today }, today);
  plan.profile.timezone = 'UTC';
  plan.workouts = plan.workouts.slice(0, 3);
  await saveState(owner, 0, plan, 'Synthetic reconcile fixture', 0);
  f.sqlite
    .prepare(
      'INSERT INTO connections(owner,encrypted_key,athlete_name,connected_at,provider_athlete_id,generation) VALUES(?,?,?,?,?,?)',
    )
    .run(
      owner,
      await encrypt('synthetic-api-key'),
      'Synthetic runner',
      new Date().toISOString(),
      athlete,
      generation,
    );
  for (const w of plan.workouts)
    f.sqlite
      .prepare(
        'INSERT INTO deliveries(owner,provider_athlete_id,workout_id,connection_generation,version,status,updated_at,create_outcome) VALUES(?,?,?,?,?,?,?,?)',
      )
      .run(
        owner,
        athlete,
        w.id,
        generation,
        0,
        'failed',
        new Date(Date.now() - 300000).toISOString(),
        'none',
      );
  const calls = [];
  globalThis.operationsFetch = async (url, init) => {
    calls.push({ path: url.pathname, method: init.method ?? 'GET' });
    return new Response(null, {
      status: 429,
      headers: { 'Retry-After': '7200' },
    });
  };
  const response = await reconcile(request('/api/reconcile', 'POST')),
    body = await response.json();
  t.diagnostic(
    JSON.stringify({
      providerRequests: calls.length,
      appStatus: response.status,
      retryAfter: response.headers.get('Retry-After'),
      body,
    }),
  );
  assert.equal(
    calls.length,
    1,
    'The batch continued making provider requests after a global rate limit',
  );
  assert.equal(response.headers.get('Retry-After'), '7200');
  assert.equal(body.retryAfter, 7200);
  assert.equal(
    body.remaining,
    2,
    'Unattempted candidates were lost from the remaining count',
  );
  assert.equal(
    calls.filter((c) => ['POST', 'PUT', 'DELETE'].includes(c.method)).length,
    0,
  );
});
void test('O05: unexpected export errors emit a correlated, bounded and redacted diagnostic', async (t) => {
  const f = fixture();
  t.after(() => f.sqlite.close());
  await readAccount(owner);
  f.sqlite
    .prepare(
      'INSERT INTO athlete_state(owner,version,data,updated_at) VALUES(?,?,?,?)',
    )
    .run(
      owner,
      1,
      'synthetic-private-malformed-journal',
      new Date().toISOString(),
    );
  const entries = [],
    originals = {};
  for (const name of ['error', 'warn', 'info', 'log']) {
    originals[name] = console[name];
    console[name] = (...args) => entries.push(args);
  }
  let response;
  try {
    response = await exportJournal(request('/api/export'));
  } finally {
    for (const name of Object.keys(originals)) console[name] = originals[name];
  }
  const body = await response.json(),
    requestId = response.headers.get('X-Request-Id') ?? body.requestId;
  t.diagnostic(
    JSON.stringify({
      appStatus: response.status,
      requestId: requestId ?? null,
      diagnosticCount: entries.length,
    }),
  );
  assert.equal(response.status, 500);
  assert.ok(requestId, 'No request correlation identifier was returned');
  assert.ok(
    entries.some((e) => JSON.stringify(e).includes(requestId)),
    'No diagnostic matches the returned request identifier',
  );
  assert.ok(
    !JSON.stringify(entries).includes('synthetic-private-malformed-journal'),
    'Diagnostic leaked private journal bytes',
  );
  assert.ok(
    !JSON.stringify(entries).includes(owner),
    'Diagnostic leaked raw owner identity',
  );
  assert.ok(
    JSON.stringify(entries).length < 8000,
    'Diagnostic must be bounded',
  );
});
void test('O06: provider response classification records status without exposing the remote body', async (t) => {
  const observed = [];
  for (const status of [400, 401, 403, 404, 408, 422, 500, 503]) {
    globalThis.operationsFetch = async () =>
      new Response('synthetic-private-provider-error-body', { status });
    let error;
    try {
      await intervals('synthetic-api-key', '/athlete/0/events/77');
    } catch (e) {
      error = e;
    }
    assert.ok(error);
    const response = failure(error),
      body = await response.json();
    observed.push({ providerStatus: status, appStatus: response.status });
    assert.ok(
      !JSON.stringify(body).includes('synthetic-private-provider-error-body'),
    );
  }
  t.diagnostic(JSON.stringify(observed));
});
void test('O07: uncertain POST failure is never blindly retried by the provider wrapper', async () => {
  for (const mode of ['response-loss', '503']) {
    let count = 0;
    globalThis.operationsFetch = async () => {
      count++;
      if (mode === '503') return new Response(null, { status: 503 });
      throw new Error('Synthetic response loss after remote commit');
    };
    await assert.rejects(
      intervals('synthetic-api-key', '/athlete/0/events/bulk', {
        method: 'POST',
        body: '[]',
      }),
    );
    assert.equal(count, 1, `Blind POST retry after ${mode}`);
  }
});
void test('O08: allowed lookup and DELETE absence retain the original 404 response', async () => {
  globalThis.operationsFetch = async () => new Response(null, { status: 404 });
  assert.equal(
    (await intervals('synthetic-api-key', '/athlete/0/events/77', {}, true))
      .status,
    404,
  );
  assert.equal(
    (
      await intervals('synthetic-api-key', '/athlete/0/events/77', {
        method: 'DELETE',
      })
    ).status,
    404,
  );
});
function samplePlan(runCount, note = 'x'.repeat(1500)) {
  const plan = makePlan({ ...demoProfile(today), startDate: today }, today);
  plan.profile.timezone = 'UTC';
  plan.extraRuns = Array.from({ length: runCount }, (_, i) => ({
    id: `synthetic-extra-${i}`,
    date: today,
    minutes: 30,
    km: 5,
    effort: 4,
    feeling: 'good',
    note,
    source: 'Manual',
    recordedAt: new Date().toISOString(),
  }));
  return plan;
}
void test('O09: UTF-8 byte-bounded revision pages have no gaps, repeats or foreign-owner data', async (t) => {
  const f = fixture();
  t.after(() => f.sqlite.close());
  await readAccount(owner);
  for (let version = 0; version < 21; version++)
    await saveState(
      owner,
      version,
      samplePlan(version % 7 === 0 ? 370 : 1, 'é'.repeat(1500)),
      'Synthetic mixed-size revision',
      0,
    );
  f.sqlite
    .prepare(
      'INSERT INTO revisions(owner,version,data,label,created_at) VALUES(?,?,?,?,?)',
    )
    .run(
      'another-synthetic-owner',
      999,
      '{}',
      'Foreign revision',
      new Date().toISOString(),
    );
  const seen = [];
  let before,
    requests = 0;
  do {
    const response = await exportJournal(
      request('/api/export' + (before ? '?before=' + before : '')),
    );
    assert.equal(response.status, 200);
    const result = await response.json(),
      pageBytes = result.history.reduce(
        (n, r) => n + Buffer.byteLength(JSON.stringify(r.data)),
        0,
      );
    assert.ok(
      pageBytes <= 2000000,
      `Revision page exceeded the 2 MB UTF-8 byte budget: ${pageBytes}`,
    );
    assert.ok(result.history.length <= 20);
    assert.ok(
      result.history.length > 0,
      'Cursor requested an unnecessary empty page',
    );
    assert.ok(result.history.every((r) => r.label !== 'Foreign revision'));
    seen.push(...result.history.map((r) => r.version));
    const next = result.historyPage.nextBefore;
    if (next !== null) {
      assert.equal(next, result.history.at(-1).version);
      if (before) assert.ok(next < before, 'Cursor failed to make progress');
    }
    before = next;
    requests++;
    assert.ok(
      requests <= 12,
      'Revision pagination failed to terminate within its request allowance',
    );
  } while (before !== null);
  assert.deepEqual(
    seen,
    Array.from({ length: 21 }, (_, i) => 21 - i),
  );
  t.diagnostic(
    JSON.stringify({
      revisionCount: seen.length,
      pageCount: requests,
      largestHistoryBatchBytes: f.stats.largestHistoryBatchBytes,
    }),
  );
});
void test('O10: exactly twenty small revisions end without an empty trailing page', async (t) => {
  const f = fixture();
  t.after(() => f.sqlite.close());
  await readAccount(owner);
  const plan = samplePlan(0);
  for (let version = 0; version < 20; version++)
    await saveState(owner, version, plan, 'Small revision', 0);
  const response = await exportJournal(request('/api/export')),
    body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.history.length, 20);
  assert.equal(body.historyPage.nextBefore, null);
});
void test('O11: atomic request counters enforce the bound, isolate buckets and owners, and reset on expiry', async (t) => {
  const f = fixture();
  t.after(() => f.sqlite.close());
  const attempts = await Promise.allSettled(
    Array.from({ length: 5 }, () =>
      requestLimit(owner, 'synthetic-small-limit', 2, 60),
    ),
  );
  assert.equal(attempts.filter((x) => x.status === 'fulfilled').length, 2);
  for (const item of attempts.filter((x) => x.status === 'rejected')) {
    const r = failure(item.reason);
    assert.equal(r.status, 429);
    assert.ok(Number(r.headers.get('Retry-After')) >= 1);
  }
  const count = f.sqlite
    .prepare('SELECT count FROM request_limits WHERE owner=? AND bucket=?')
    .get(owner, 'synthetic-small-limit').count;
  assert.equal(count, 2);
  await requestLimit('different-owner', 'synthetic-small-limit', 2, 60);
  await requestLimit(owner, 'different-bucket', 2, 60);
  f.sqlite
    .prepare('UPDATE request_limits SET reset_at=? WHERE owner=? AND bucket=?')
    .run(Math.floor(Date.now() / 1000) - 1, owner, 'synthetic-small-limit');
  await requestLimit(owner, 'synthetic-small-limit', 2, 60);
  assert.equal(
    f.sqlite
      .prepare('SELECT count FROM request_limits WHERE owner=? AND bucket=?')
      .get(owner, 'synthetic-small-limit').count,
    1,
  );
});
void test('O12: export and account-write guards enforce their persisted rate limits', async (t) => {
  const f = fixture();
  t.after(() => f.sqlite.close());
  await readAccount(owner);
  await saveState(owner, 0, samplePlan(0), 'Guard fixture', 0);
  for (let i = 0; i < 12; i++) {
    const r = await exportJournal(request('/api/export?format=recovery'));
    assert.equal(r.status, 200);
    await r.body.cancel();
  }
  const denied = await exportJournal(request('/api/export?format=recovery'));
  assert.equal(denied.status, 429);
  assert.ok(Number(denied.headers.get('Retry-After')) >= 1);
  f.sqlite
    .prepare(
      'INSERT INTO request_limits(owner,bucket,count,reset_at) VALUES(?,?,?,?)',
    )
    .run(owner, 'write', 120, Math.floor(Date.now() / 1000) + 60);
  let error;
  try {
    await guardAccount(request('/api/plan', 'POST'), owner);
  } catch (e) {
    error = e;
  }
  assert.ok(error);
  assert.equal(failure(error).status, 429);
});
void test('O13: persisted provider cooldown blocks later requests, isolates owners and expires', async (t) => {
  const f = fixture();
  t.after(() => f.sqlite.close());
  let calls = 0;
  globalThis.operationsFetch = async () => {
    calls++;
    return calls === 1
      ? new Response(null, { status: 429, headers: { 'Retry-After': '7200' } })
      : Response.json({ ok: true });
  };
  await assert.rejects(
    intervals('synthetic-api-key', '/athlete/0/activities', {}, false, owner),
  );
  const row = f.sqlite
    .prepare(
      "SELECT reset_at FROM request_limits WHERE owner=? AND bucket='provider-cooldown'",
    )
    .get(owner);
  assert.ok(row.reset_at >= Math.floor(Date.now() / 1000) + 7199);
  await assert.rejects(
    intervals('synthetic-api-key', '/athlete/0/events', {}, false, owner),
  );
  assert.equal(calls, 1, 'Persisted cooldown did not stop a new request');
  assert.equal(
    (
      await intervals(
        'another-synthetic-key',
        '/athlete/0/events',
        {},
        false,
        'different-owner',
      )
    ).status,
    200,
  );
  assert.equal(calls, 2);
  f.sqlite
    .prepare(
      "UPDATE request_limits SET reset_at=? WHERE owner=? AND bucket='provider-cooldown'",
    )
    .run(Math.floor(Date.now() / 1000) - 1, owner);
  assert.equal(
    (
      await intervals(
        'synthetic-api-key',
        '/athlete/0/events',
        {},
        false,
        owner,
      )
    ).status,
    200,
  );
  assert.equal(calls, 3);
});
void test('O14: HTTP-date and malformed Retry-After values produce bounded valid delays', async () => {
  for (const raw of [
    new Date(Date.now() + 3600000).toUTCString(),
    'not-a-date',
    '99999999999999999999999999999999',
  ]) {
    globalThis.operationsFetch = async () =>
      new Response(null, { status: 429, headers: { 'Retry-After': raw } });
    let error;
    try {
      await intervals('synthetic-api-key', '/athlete/0/activities');
    } catch (e) {
      error = e;
    }
    const delay = Number(failure(error).headers.get('Retry-After'));
    assert.ok(Number.isInteger(delay) && delay >= 1 && delay <= 604800);
    if (raw.includes('GMT')) assert.ok(delay >= 3598 && delay <= 3600);
    if (raw === 'not-a-date') assert.equal(delay, 60);
  }
});
void test('O15: reconciliation stops on account-wide rejected authentication or denied access', async (t) => {
  const observed = [];
  for (const status of [401, 403]) {
    const f = fixture();
    try {
      await readAccount(owner);
      const plan = samplePlan(0);
      plan.workouts = plan.workouts.slice(0, 3);
      await saveState(owner, 0, plan, 'Authentication fixture', 0);
      f.sqlite
        .prepare(
          'INSERT INTO connections(owner,encrypted_key,athlete_name,connected_at,provider_athlete_id,generation) VALUES(?,?,?,?,?,?)',
        )
        .run(
          owner,
          await encrypt('synthetic-api-key'),
          'Synthetic runner',
          new Date().toISOString(),
          athlete,
          generation,
        );
      for (const w of plan.workouts)
        f.sqlite
          .prepare(
            'INSERT INTO deliveries(owner,provider_athlete_id,workout_id,connection_generation,version,status,updated_at,create_outcome) VALUES(?,?,?,?,?,?,?,?)',
          )
          .run(
            owner,
            athlete,
            w.id,
            generation,
            0,
            'failed',
            new Date(Date.now() - 300000).toISOString(),
            'none',
          );
      let calls = 0;
      globalThis.operationsFetch = async () => {
        calls++;
        return new Response(null, { status });
      };
      const response = await reconcile(request('/api/reconcile', 'POST')),
        body = await response.json();
      t.diagnostic(
        JSON.stringify({
          providerStatus: status,
          providerRequests: calls,
          appStatus: response.status,
          body,
        }),
      );
      observed.push({ status, calls });
    } finally {
      f.sqlite.close();
    }
  }
  assert.deepEqual(
    observed,
    [
      { status: 401, calls: 1 },
      { status: 403, calls: 1 },
    ],
    'Reconcile continued after an account-wide authentication/authorization rejection',
  );
});

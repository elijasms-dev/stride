// Actual-source, isolated SQLite acceptance. No network, .env, localhost or deployed writes.
// Portable: run in work/, or copy unchanged into the checkout's tests/ directory.
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
globalThis.measurementAcceptanceEnv = { DB: null };
globalThis.fetch = async () => {
  throw new Error('Network access prohibited by measurement acceptance');
};
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'cloudflare:workers')
      return {
        url: 'data:text/javascript,export const env=globalThis.measurementAcceptanceEnv;',
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
const { measure, measurementEvents } = await import(
  new URL('lib/measurement.ts', site)
);
const { readAccount } = await import(new URL('lib/accounts.ts', site));
const { POST: measurementRoute } = await import(
  new URL('app/api/measurement/route.ts', site)
);
const { GET: accountRoute } = await import(
  new URL('app/api/account/route.ts', site)
);
const { POST: recoveryRoute } = await import(
  new URL('app/api/recovery/route.ts', site)
);
const owner = 'measure-fixture-owner',
  other = 'measure-fixture-other';
async function fixture(t) {
  const sqlite = (fixtureSqlite = new DatabaseSync(':memory:')),
    migrations = new URL('drizzle/', site),
    boundValues = [];
  for (const f of readdirSync(migrations)
    .filter((n) => /^\d+.*\.sql$/.test(n))
    .sort())
    sqlite.exec(readFileSync(new URL(f, migrations), 'utf8'));
  const prepare = (sql, values = []) => ({
    bind: (...args) => {
      boundValues.push(args);
      return prepare(sql, args);
    },
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
  globalThis.measurementAcceptanceEnv.DB = {
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
  t.after(() => sqlite.close());
  await readAccount(owner);
  await readAccount(other);
  return {
    sqlite,
    boundValues,
    rows: (who = owner) =>
      sqlite
        .prepare('SELECT * FROM request_limits WHERE owner=? ORDER BY bucket')
        .all(who),
    counter: (event = 'field-invalid', who = owner) =>
      sqlite
        .prepare('SELECT * FROM request_limits WHERE owner=? AND bucket=?')
        .get(who, 'measure:' + event),
  };
}
function request(path, payload, epoch = 0, who = owner) {
  return new Request('https://fixture.invalid' + path, {
    method: payload ? 'POST' : 'GET',
    headers: {
      'oai-authenticated-user-id': who,
      origin: 'https://fixture.invalid',
      'content-type': 'application/json',
      'x-stride-account':
        fixtureSqlite
          .prepare('SELECT account_id FROM accounts WHERE owner=?')
          .get(who)?.account_id ?? '',
      'x-stride-epoch': String(epoch),
    },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  });
}
async function recover(kind, epoch = 0) {
  const file =
    kind === 'restore'
      ? {
          format: 'stride-recovery-2',
          exportedAt: new Date().toISOString(),
          profile: null,
          plan: null,
          standaloneRuns: [],
        }
      : undefined;
  const preview = await recoveryRoute(
    request(
      '/api/recovery',
      { action: 'preview', kind, ...(file ? { file } : {}) },
      epoch,
    ),
  );
  assert.equal(preview.status, 200, await preview.clone().text());
  const { id } = await preview.json();
  return recoveryRoute(
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
}

void test('M01: active matching epoch counts each allowlisted category independently', async (t) => {
  const f = await fixture(t);
  for (const event of measurementEvents) await measure(owner, 0, event);
  await measure(owner, 0, 'field-invalid');
  assert.equal(f.rows().length, measurementEvents.length);
  assert.equal(f.counter().count, 2);
  assert.equal(f.counter('preview-accepted').count, 1);
  assert.equal(
    f.sqlite
      .prepare('SELECT epoch,revision FROM accounts WHERE owner=?')
      .get(owner).revision,
    0,
    'diagnostics must not invalidate an otherwise current draft',
  );
});
void test('M02: stale epoch, future epoch and missing account cannot create or increment a counter', async (t) => {
  const f = await fixture(t);
  await measure(owner, 0, 'field-invalid');
  await measure(owner, 1, 'field-invalid');
  await measure(owner, -1, 'field-invalid');
  await measure('missing-account', 0, 'field-invalid');
  assert.equal(f.counter().count, 1);
  assert.equal(f.rows('missing-account').length, 0);
  assert.equal(
    f.sqlite.prepare('SELECT count(*) AS n FROM accounts').get().n,
    2,
  );
});
void test('M03: counters stay owner-scoped and closed accounts are ignored', async (t) => {
  const f = await fixture(t);
  await measure(owner, 0, 'field-invalid');
  await measure(other, 0, 'field-invalid');
  await measure(other, 0, 'field-invalid');
  f.sqlite
    .prepare("UPDATE accounts SET status='closed' WHERE owner=?")
    .run(owner);
  await measure(owner, 0, 'field-invalid');
  await measure(owner, 0, 'preview-accepted');
  assert.equal(f.counter().count, 1);
  assert.equal(f.counter('field-invalid', other).count, 2);
  assert.equal(f.counter('preview-accepted'), undefined);
});
void test('M04: daily UTC boundary resets to one and moves the reset timestamp', async (t) => {
  const f = await fixture(t),
    nativeNow = Date.now,
    stamp = Date.parse('2026-09-08T23:59:59Z');
  let clock = stamp;
  Date.now = () => clock;
  t.after(() => {
    Date.now = nativeNow;
  });
  await measure(owner, 0, 'field-invalid');
  await measure(owner, 0, 'field-invalid');
  assert.equal(f.counter().count, 2);
  assert.equal(f.counter().reset_at, Date.parse('2026-09-09T00:00:00Z') / 1000);
  clock += 1000;
  await measure(owner, 0, 'field-invalid');
  assert.equal(f.counter().count, 1);
  assert.equal(f.counter().reset_at, Date.parse('2026-09-10T00:00:00Z') / 1000);
});
void test('M05: SQL increment is atomic across callers and saturates at100000', async (t) => {
  const f = await fixture(t);
  await Promise.all(
    Array.from({ length: 50 }, () => measure(owner, 0, 'field-invalid')),
  );
  assert.equal(f.counter().count, 50);
  f.sqlite
    .prepare('UPDATE request_limits SET count=99999 WHERE owner=?')
    .run(owner);
  await Promise.all([
    measure(owner, 0, 'field-invalid'),
    measure(owner, 0, 'field-invalid'),
  ]);
  assert.equal(f.counter().count, 100000);
});
void test('M06: browser route accepts only field-invalid and never binds supplied notes or identities', async (t) => {
  const f = await fixture(t),
    sentinel = 'PRIVATE-NOTE-DO-NOT-RECORD';
  const accepted = await measurementRoute(
    request('/api/measurement', {
      event: 'field-invalid',
      note: sentinel,
      providerPayload: { secret: sentinel },
      owner: other,
      epoch: 999,
    }),
  );
  assert.equal(accepted.status, 200);
  assert.equal(f.counter().count, 1);
  assert.equal(f.rows(other).length, 0);
  for (const event of ['preview-accepted', 'activation-accepted', sentinel])
    assert.equal(
      (await measurementRoute(request('/api/measurement', { event }))).status,
      422,
    );
  assert.ok(!JSON.stringify(f.boundValues).includes(sentinel));
  assert.ok(!JSON.stringify(f.rows()).includes(sentinel));
  assert.deepEqual(Object.keys(f.counter()).sort(), [
    'bucket',
    'count',
    'owner',
    'reset_at',
  ]);
});
void test('M07: measurement endpoint rejects stale or closed accounts before counting', async (t) => {
  const f = await fixture(t);
  assert.equal(
    (
      await measurementRoute(
        request('/api/measurement', { event: 'field-invalid' }, 1),
      )
    ).status,
    409,
  );
  assert.equal(f.rows().length, 0);
  f.sqlite
    .prepare("UPDATE accounts SET status='closed' WHERE owner=?")
    .run(owner);
  assert.equal(
    (
      await measurementRoute(
        request('/api/measurement', { event: 'field-invalid' }),
      )
    ).status,
    409,
  );
  assert.equal(f.rows().length, 0);
});
void test('M08: account API returns only this owner current unexpired measurement rows', async (t) => {
  const f = await fixture(t);
  await measure(owner, 0, 'field-invalid');
  await measure(other, 0, 'activation-accepted');
  await measure(owner, 0, 'preview-accepted');
  f.sqlite
    .prepare('UPDATE request_limits SET reset_at=0 WHERE owner=? AND bucket=?')
    .run(owner, 'measure:preview-accepted');
  f.sqlite
    .prepare(
      "INSERT INTO request_limits(owner,bucket,count,reset_at) VALUES(?,'provider-cooldown',0,?)",
    )
    .run(owner, Math.floor(Date.now() / 1000) + 60);
  const response = await accountRoute(request('/api/account'));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(
    body.measurements.map((r) => r.bucket),
    ['measure:field-invalid'],
  );
  assert.ok(!JSON.stringify(body.measurements).includes(other));
});
void test('M09: actual account deletion clears counters and stale/deleted measurements cannot recreate them', async (t) => {
  const f = await fixture(t);
  await measure(owner, 0, 'field-invalid');
  await measure(other, 0, 'field-invalid');
  const response = await recover('delete');
  assert.equal(response.status, 200, await response.clone().text());
  assert.equal(f.rows().length, 0);
  assert.equal(f.counter('field-invalid', other).count, 1);
  await measure(owner, 0, 'field-invalid');
  await measure(owner, 1, 'field-invalid');
  assert.equal(f.rows().length, 0);
  const account = f.sqlite
    .prepare('SELECT epoch,status FROM accounts WHERE owner=?')
    .get(owner);
  assert.equal(account.epoch, 1);
  assert.equal(account.status, 'closed');
});
void test('M10: actual recovery clears old counters; only the restored active epoch can start a new day count', async (t) => {
  const f = await fixture(t);
  await measure(owner, 0, 'field-invalid');
  await measure(other, 0, 'field-invalid');
  const response = await recover('restore');
  assert.equal(response.status, 200, await response.clone().text());
  assert.equal(f.rows().length, 0);
  assert.equal(f.counter('field-invalid', other).count, 1);
  await measure(owner, 0, 'field-invalid');
  assert.equal(f.rows().length, 0);
  await measure(owner, 1, 'field-invalid');
  assert.equal(f.counter().count, 1);
});
void test('M11: diagnostic database failure never rejects a successful caller', async (t) => {
  const f = await fixture(t);
  f.sqlite.exec('DROP TABLE request_limits');
  await assert.doesNotReject(measure(owner, 0, 'field-invalid'));
});

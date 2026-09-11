// Offline tests of the real route. Only synthetic in-memory SQL and local fixtures.
// Run with Node 24+: node --experimental-strip-types --test tests/workout-variety-route.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const site = new URL('../', import.meta.url);
const owner = 'synthetic-variety-route-owner';
const initialInstant = '2026-09-09T23:30:00.000Z';
let instant = initialInstant;
const NativeDate = Date;
globalThis.Date = class extends NativeDate {
  constructor(...args) {
    super(...(args.length ? args : [instant]));
  }
  static now() {
    return NativeDate.parse(instant);
  }
};
globalThis.varietyRouteEnv = { DB: null };
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'cloudflare:workers')
      return {
        url: 'data:text/javascript,export const env=globalThis.varietyRouteEnv;',
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
          const candidate = new URL(base.href + suffix);
          if (existsSync(candidate))
            return { url: candidate.href, shortCircuit: true };
        }
    }
    return next(specifier, context);
  },
});
let fetchCalls = [];
globalThis.fetch = async (input, init = {}) => {
  fetchCalls.push({
    input: input instanceof Request ? input.url : String(input),
    method: init.method ?? 'GET',
  });
  throw new Error('Variety must never make network or provider requests');
};
const { POST } = await import(new URL('app/api/plan/route.ts', site));
const { readAccount } = await import(new URL('lib/accounts.ts', site));
const { readState, saveState } = await import(new URL('lib/server.ts', site));
const { addDays, todayInZone } = await import(new URL('lib/engine.ts', site));
const legacy = JSON.parse(
  readFileSync(
    new URL('fixtures/variety-legacy.json', import.meta.url),
    'utf8',
  ),
);

function databaseFixture(t) {
  instant = initialInstant;
  fetchCalls = [];
  const sqlite = new DatabaseSync(':memory:');
  const migrations = new URL('drizzle/', site);
  for (const file of readdirSync(migrations)
    .filter((n) => /^\d+.*\.sql$/.test(n))
    .sort())
    sqlite.exec(readFileSync(new URL(file, migrations), 'utf8'));
  const prepare = (sql, values = []) => ({
    bind: (...args) => prepare(sql, args),
    first: async (column) => {
      const row = sqlite.prepare(sql).get(...values) ?? null;
      return column ? (row?.[column] ?? null) : row;
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
  globalThis.varietyRouteEnv.DB = {
    prepare,
    batch: async (statements) => {
      sqlite.exec('BEGIN');
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
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
  t.after(() => {
    const calls = fetchCalls.slice();
    sqlite.close();
    instant = initialInstant;
    assert.deepEqual(calls, [], 'No network/provider requests are permitted');
  });
  return sqlite;
}

async function request(payload, headers = {}) {
  const response = await POST(
    new Request('https://stride.test/api/plan', {
      method: 'POST',
      headers: {
        'oai-authenticated-user-id': owner,
        'x-stride-account': (await readAccount(owner)).account_id,
        'x-stride-epoch': '0',
        origin: 'https://stride.test',
        'content-type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(payload),
    }),
  );
  return { status: response.status, data: await response.json() };
}
async function preview(version = 1) {
  const result = await request({ action: 'varietyPreview', version });
  assert.equal(result.status, 200, JSON.stringify(result.data));
  return result.data;
}
function applyPayload(p) {
  return {
    action: 'variety',
    version: p.version,
    effectiveDate: p.effectiveDate,
    fingerprint: p.fingerprint,
  };
}
function runMeasurePayload(p) {
  return {
    action: 'runMeasure',
    measure: 'distance',
    version: p.version,
    effectiveDate: p.effectiveDate,
    fingerprint: p.fingerprint,
  };
}
function snapshot(sqlite) {
  return JSON.stringify({
    state: sqlite.prepare('SELECT * FROM athlete_state ORDER BY owner').all(),
    revisions: sqlite
      .prepare('SELECT * FROM revisions ORDER BY owner,version')
      .all(),
    deliveries: sqlite
      .prepare(
        'SELECT * FROM deliveries ORDER BY owner,provider_athlete_id,workout_id',
      )
      .all(),
    accounts: sqlite.prepare('SELECT * FROM accounts ORDER BY owner').all(),
  });
}
function receipt(
  sqlite,
  id,
  {
    status = 'accepted',
    receiptOwner = owner,
    generation = 'old-generation',
    athlete = 'old-athlete',
  } = {},
) {
  sqlite
    .prepare(
      'INSERT INTO deliveries(owner,provider_athlete_id,workout_id,connection_generation,version,status,updated_at,create_outcome) VALUES(?,?,?,?,?,?,?,?)',
    )
    .run(receiptOwner, athlete, id, generation, 0, status, instant, 'none');
}
function changedRuns(before, after) {
  return after.workouts.filter(
    (w) =>
      JSON.stringify(w) !==
      JSON.stringify(before.workouts.find((old) => old.id === w.id)),
  );
}
async function seed(t) {
  const sqlite = databaseFixture(t);
  await readAccount(owner);
  const plan = structuredClone(legacy);
  const today = todayInZone(plan.profile.timezone);
  const completed = plan.workouts.find(
    (w) => w.date >= today && w.date < addDays(today, 7),
  );
  assert.ok(completed);
  completed.status = 'completed';
  completed.feedback = {
    effort: 3,
    feeling: 'good',
    actualMinutes: completed.minutes,
    actualKm: 5,
    note: 'Synthetic completed history',
    recordedAt: instant,
    actualDate: completed.date,
    enjoyment: 'yes',
  };
  const skipped = plan.workouts.find(
    (w) => w.date > completed.date && w.date < addDays(today, 7),
  );
  assert.ok(skipped);
  skipped.status = 'skipped';
  skipped.skipReason = 'Synthetic skipped record';
  plan.workouts.push({
    ...structuredClone(completed),
    id: 'synthetic-archived-completion',
    week: -1,
    date: addDays(today, -14),
    originalDate: addDays(today, -14),
    feedback: { ...completed.feedback, actualDate: addDays(today, -14) },
  });
  plan.extraRuns = [
    {
      id: 'synthetic-extra-run',
      date: addDays(today, -2),
      minutes: 25,
      km: 4,
      effort: 3,
      feeling: 'okay',
      note: 'Extra history is preserved',
      source: 'Manual',
      recordedAt: instant,
    },
  ];
  await saveState(owner, 0, plan, 'Synthetic legacy variety fixture', 0);
  return { sqlite, plan, today };
}

void test('distance preview and apply use the real route, preserve deliveries and require a matching review', async (t) => {
  const { sqlite, plan, today } = await seed(t);
  const first = await request({
    action: 'runMeasurePreview',
    measure: 'distance',
    version: 1,
  });
  assert.equal(first.status, 200, JSON.stringify(first.data));
  const eligible = changedRuns(plan, first.data.plan);
  assert.ok(eligible.length > 2);
  receipt(sqlite, eligible[0].id);
  const before = snapshot(sqlite);
  const review = await request({
    action: 'runMeasurePreview',
    measure: 'distance',
    version: 1,
  });
  assert.equal(review.status, 200, JSON.stringify(review.data));
  assert.equal(review.data.effectiveDate, today);
  assert.equal(snapshot(sqlite), before);
  assert.deepEqual(
    review.data.plan.workouts.find((w) => w.id === eligible[0].id),
    plan.workouts.find((w) => w.id === eligible[0].id),
  );
  const { prescriptionHash } = await import(new URL('lib/garmin.ts', site));
  assert.equal(
    await prescriptionHash(
      review.data.plan.workouts.find((w) => w.id === eligible[0].id),
    ),
    await prescriptionHash(plan.workouts.find((w) => w.id === eligible[0].id)),
  );
  assert.equal((await request(runMeasurePayload(first.data))).status, 409);
  assert.equal(snapshot(sqlite), before);
  const saved = await request(runMeasurePayload(review.data));
  assert.equal(saved.status, 200, JSON.stringify(saved.data));
  assert.equal(saved.data.version, 2);
  assert.deepEqual(saved.data.plan, review.data.plan);
  const again = await request({
    action: 'runMeasurePreview',
    measure: 'distance',
    version: 2,
  });
  assert.equal(again.status, 200);
  const noOp = await request(runMeasurePayload(again.data));
  assert.equal(
    noOp.data.version,
    2,
    'Applying an unchanged measurement must not create revisions',
  );
});

void test('distance review rejects malformed inputs, stale versions, wrong epochs and another account', async (t) => {
  const { sqlite } = await seed(t);
  const before = snapshot(sqlite);
  for (const measure of ['yards', '', null])
    assert.equal(
      (await request({ action: 'runMeasurePreview', measure, version: 1 }))
        .status,
      422,
    );
  assert.equal(
    (
      await request({
        action: 'runMeasurePreview',
        measure: 'distance',
        version: 0,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request(
        { action: 'runMeasurePreview', measure: 'distance', version: 1 },
        { 'x-stride-epoch': '1' },
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await request(
        { action: 'runMeasurePreview', measure: 'distance', version: 1 },
        { 'x-stride-account': 'another-account' },
      )
    ).status,
    409,
  );
  assert.equal(snapshot(sqlite), before);
});

void test('distance apply rejects a preview from the previous local training day', async (t) => {
  const { sqlite } = await seed(t);
  const review = await request({
    action: 'runMeasurePreview',
    measure: 'distance',
    version: 1,
  });
  assert.equal(review.status, 200);
  const before = snapshot(sqlite);
  instant = '2026-09-11T12:00:00.000Z';
  const saved = await request(runMeasurePayload(review.data));
  assert.equal(saved.status, 409);
  assert.equal(snapshot(sqlite), before);
});

void test('real variety preview is deterministic, read-only, and uses the runner timezone', async (t) => {
  const { sqlite, plan, today } = await seed(t);
  const before = snapshot(sqlite);
  const a = await preview(),
    b = await preview();
  assert.equal(
    today,
    '2026-09-10',
    'The fixture deliberately crosses the UTC day boundary',
  );
  assert.equal(a.effectiveDate, '2026-09-17');
  assert.equal(a.version, 1);
  assert.match(a.fingerprint, /^[a-f0-9]{64}$/);
  assert.deepEqual(a, b);
  assert.equal(
    snapshot(sqlite),
    before,
    'Preview must not save a revision or touch delivery receipts',
  );
  assert.ok(
    changedRuns(plan, a.plan).length >= 4,
    'Legacy fixture must exercise real eligible changes',
  );
});

void test('apply preserves seven days, history, schedule, duration and every owner delivery status', async (t) => {
  const { sqlite, plan, today } = await seed(t);
  const eligible = changedRuns(plan, (await preview()).plan);
  assert.ok(eligible.length >= 4);
  receipt(sqlite, eligible[0].id, { status: 'failed' });
  receipt(sqlite, eligible[1].id, { status: 'removed' });
  receipt(sqlite, eligible[2].id, {
    status: 'accepted',
    generation: 'previous-connection',
    athlete: 'previous-athlete',
  });
  const beforeOtherOwner = await preview();
  const otherOwnerWorkout = changedRuns(plan, beforeOtherOwner.plan)[0];
  assert.ok(otherOwnerWorkout);
  receipt(sqlite, otherOwnerWorkout.id, {
    receiptOwner: 'another-owner',
    status: 'accepted',
  });
  const protectedIds = new Set(eligible.slice(0, 3).map((w) => w.id));
  const p = await preview();
  assert.ok(
    changedRuns(plan, p.plan).some((w) => w.id === otherOwnerWorkout.id),
    "Another owner cannot freeze this runner's workout",
  );
  assert.deepEqual(
    p,
    beforeOtherOwner,
    'Another owner receipt cannot affect the candidate',
  );
  const saved = await request(applyPayload(p));
  assert.equal(saved.status, 200, JSON.stringify(saved.data));
  assert.equal(saved.data.version, 2);
  assert.deepEqual(saved.data.plan, p.plan);
  assert.deepEqual(saved.data.plan.profile, plan.profile);
  assert.deepEqual(saved.data.plan.extraRuns, plan.extraRuns);
  assert.equal(saved.data.plan.workouts.length, plan.workouts.length);
  for (const old of plan.workouts) {
    const next = saved.data.plan.workouts.find((w) => w.id === old.id);
    assert.ok(next, 'Stable workout IDs');
    for (const field of ['date', 'originalDate', 'week', 'minutes', 'status'])
      assert.equal(
        next[field],
        old[field],
        `${field} remains unchanged for ${old.id}`,
      );
    if (
      old.date < addDays(today, 7) ||
      old.status !== 'planned' ||
      old.week < 0 ||
      protectedIds.has(old.id)
    )
      assert.deepEqual(
        next,
        old,
        `Protected session stays byte-for-byte equivalent: ${old.id}`,
      );
  }
  assert.equal(
    sqlite.prepare('SELECT count(*) AS n FROM revisions').get().n,
    2,
  );
});

void test('missing/stale fingerprint, version and effective date reject without journal mutations', async (t) => {
  const { sqlite } = await seed(t);
  const p = await preview();
  for (const patch of [
    { fingerprint: undefined },
    { fingerprint: '0'.repeat(64) },
    { version: 0 },
    { effectiveDate: addDays(p.effectiveDate, -1) },
  ]) {
    const before = snapshot(sqlite);
    const result = await request({ ...applyPayload(p), ...patch });
    assert.equal(result.status, 409, JSON.stringify({ patch, result }));
    assert.equal(snapshot(sqlite), before);
  }
  const beforeMidnight = snapshot(sqlite);
  instant = '2026-09-10T23:30:00.000Z';
  const expired = await request(applyPayload(p));
  assert.equal(
    expired.status,
    409,
    "Crossing the runner's day requires a fresh preview",
  );
  assert.equal(snapshot(sqlite), beforeMidnight);
});

void test('a new delivery record invalidates an earlier preview and is preserved on re-review', async (t) => {
  const { sqlite, plan } = await seed(t);
  const p = await preview();
  const changing = changedRuns(plan, p.plan)[0];
  assert.ok(changing);
  receipt(sqlite, changing.id, { status: 'sending' });
  const before = snapshot(sqlite);
  const stale = await request(applyPayload(p));
  assert.equal(stale.status, 409);
  assert.equal(snapshot(sqlite), before);
  const fresh = await preview();
  assert.notEqual(fresh.fingerprint, p.fingerprint);
  assert.deepEqual(
    fresh.plan.workouts.find((w) => w.id === changing.id),
    plan.workouts.find((w) => w.id === changing.id),
  );
  assert.equal((await request(applyPayload(fresh))).status, 200);
});

void test('refreshing an already-current workout mix is an idempotent no-op', async (t) => {
  const { sqlite } = await seed(t);
  const first = await preview();
  assert.equal((await request(applyPayload(first))).status, 200);
  const saved = await readState(owner);
  const before = snapshot(sqlite);
  const current = await preview(saved.version);
  assert.deepEqual(current.plan, saved.plan);
  const repeated = await request(applyPayload(current));
  assert.equal(repeated.status, 200);
  assert.equal(repeated.data.version, saved.version);
  assert.equal(snapshot(sqlite), before);
});

void test('closed accounts and wrong account epochs cannot preview or apply variety', async (t) => {
  const { sqlite } = await seed(t);
  const p = await preview();
  let before = snapshot(sqlite);
  const epoch = await request(applyPayload(p), { 'x-stride-epoch': '1' });
  assert.equal(epoch.status, 409);
  assert.equal(snapshot(sqlite), before);
  sqlite
    .prepare("UPDATE accounts SET status='closed' WHERE owner=?")
    .run(owner);
  before = snapshot(sqlite);
  for (const payload of [
    { action: 'varietyPreview', version: 1 },
    applyPayload(p),
  ]) {
    const result = await request(payload);
    assert.equal(result.status, 409);
    assert.match(result.data.error, /closed/i);
    assert.equal(snapshot(sqlite), before);
  }
});

void test('target review persists real ranges without changing protected runs or contacting providers', async (t) => {
  const { sqlite, plan, today } = await seed(t);
  const upcoming = plan.workouts.find(
    (w) => w.date >= today && w.status === 'planned',
  );
  receipt(sqlite, upcoming.id, {
    status: 'review',
    athlete: 'previous-athlete',
  });
  const targets = {
    mode: 'pace',
    pace: { easy: { low: 330, high: 390 }, tempo: { low: 285, high: 300 } },
  };
  const before = snapshot(sqlite);
  const review = await request({
    action: 'targetsPreview',
    version: 1,
    targets,
  });
  assert.equal(review.status, 200, JSON.stringify(review.data));
  assert.equal(snapshot(sqlite), before);
  assert.equal(review.data.protectedCount, 1);
  assert.deepEqual(
    review.data.plan.workouts.find((w) => w.id === upcoming.id),
    upcoming,
  );
  assert.ok(
    review.data.plan.workouts.some((w) => w.steps.some((s) => s.target)),
  );
  const saved = await request({
    action: 'targets',
    targets,
    version: 1,
    effectiveDate: review.data.effectiveDate,
    fingerprint: review.data.fingerprint,
  });
  assert.equal(saved.status, 200, JSON.stringify(saved.data));
  assert.equal(saved.data.version, 2);
  assert.equal(saved.data.plan.profile.workoutTargets.mode, 'pace');
  assert.equal(
    sqlite.prepare('SELECT COUNT(*) AS n FROM deliveries').get().n,
    1,
  );
});
void test('target changes reject stale previews, newly sent workouts and invalid ranges', async (t) => {
  const { sqlite, plan, today } = await seed(t);
  const targets = {
    mode: 'heart-rate',
    heartRate: { easy: { low: 130, high: 150 } },
  };
  const invalid = await request({
    action: 'targetsPreview',
    version: 1,
    targets: { mode: 'pace' },
  });
  assert.equal(invalid.status, 422);
  const review = await request({
    action: 'targetsPreview',
    version: 1,
    targets,
  });
  assert.equal(review.status, 200);
  receipt(
    sqlite,
    plan.workouts.find((w) => w.date >= today && w.status === 'planned').id,
  );
  const saved = await request({
    action: 'targets',
    targets,
    version: 1,
    effectiveDate: review.data.effectiveDate,
    fingerprint: review.data.fingerprint,
  });
  assert.equal(saved.status, 409);
  assert.equal((await readState(owner)).version, 1);
  assert.equal(
    (await request({ action: 'targetsPreview', version: 0, targets })).status,
    409,
  );
  assert.equal(
    (
      await request(
        { action: 'targetsPreview', version: 1, targets },
        { origin: 'https://elsewhere.test' },
      )
    ).status,
    403,
  );
});

void test('stale account A form cannot write into account B at the same epoch', async (t) => {
  const sqlite = databaseFixture(t);
  const a = await readAccount(owner),
    b = await readAccount('synthetic-account-B');
  const { POST: profilePOST } = await import(
    new URL('app/api/profile/route.ts', site)
  );
  const { POST: recoveryPOST } = await import(
    new URL('app/api/recovery/route.ts', site)
  );
  for (const route of [POST, profilePOST, recoveryPOST]) {
    const response = await route(
      new Request('https://stride.test/api/test', {
        method: 'POST',
        headers: {
          'oai-authenticated-user-id': b.owner,
          'x-stride-account': a.account_id,
          'x-stride-epoch': '0',
          origin: 'https://stride.test',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          action: 'commit',
          kind: 'delete',
          id: 'old-operation',
          display_name: 'Wrong account',
        }),
      }),
    );
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, 'ACCOUNT_CONTEXT_CHANGED');
  }
  for (const table of [
    'profiles',
    'athlete_state',
    'recovery_operations',
    'request_limits',
  ])
    assert.equal(
      sqlite
        .prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE owner=?`)
        .get(b.owner).count,
      0,
      table,
    );
  assert.equal((await readAccount(b.owner)).revision, 0);
});
void test('legacy form without account identity is rejected before write work', async (t) => {
  const sqlite = databaseFixture(t);
  await readAccount(owner);
  const response = await request(
    { action: 'preview' },
    { 'x-stride-account': '' },
  );
  assert.equal(response.status, 409);
  assert.equal(response.data.code, 'ACCOUNT_CONTEXT_CHANGED');
  assert.equal(
    sqlite.prepare('SELECT COUNT(*) AS count FROM request_limits').get().count,
    0,
  );
});

void test('actual plan-save response preserves pinned client identity', async (t) => {
  databaseFixture(t);
  const account = await readAccount(owner);
  const { createApiClient } = await import(new URL('lib/client-api.ts', site));
  const { demoPlan } = await import(new URL('lib/engine.ts', site));
  const client = createApiClient(async (path) =>
    Response.json(
      path === '/api/account'
        ? { accountId: account.account_id, accountEpoch: account.epoch }
        : await saveState(
            owner,
            0,
            demoPlan('2026-09-10'),
            'Synthetic plan save',
            account.epoch,
          ),
    ),
  );
  await client.api('/api/account');
  const result = await client.api(
    '/api/plan',
    { method: 'POST', body: '{}' },
    false,
  );
  assert.equal(result.accountId, account.account_id);
  assert.equal(result.accountEpoch, account.epoch);
  assert.equal(client.isInvalid(), false);
});

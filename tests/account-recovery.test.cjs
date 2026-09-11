/* oxlint-disable typescript/no-require-imports, next/no-assign-module-variable -- The isolated Node VM loads real TypeScript modules as CommonJS, with its own module binding. */
// Audits the actual draft account/recovery implementation, outside the Site.
// All DB state is in-memory; fetch is a synthetic provider stub, never network.
const fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm'),
  assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite'),
  { webcrypto, createHash } = require('node:crypto');
const site = [
  process.argv[2],
  path.resolve(__dirname, '..'),
  path.resolve(__dirname, '../stride'),
]
  .filter(Boolean)
  .map((p) => path.resolve(p))
  .find((p) => fs.existsSync(path.join(p, 'lib/server.ts')));
if (!site)
  throw new Error('Pass the Stride source directory as the first argument.');
const reportPath = process.argv[3] ? path.resolve(process.argv[3]) : null;
const ts = require(path.join(site, 'node_modules/typescript'));
const sql = new DatabaseSync(':memory:');
for (const file of fs
  .readdirSync(path.join(site, 'drizzle'))
  .filter((f) => /^\d+.*\.sql$/.test(f))
  .sort())
  sql.exec(fs.readFileSync(path.join(site, 'drizzle', file), 'utf8'));
let nextBatchHook = null,
  providerHook = null,
  providerCalls = 0;
const env = {
  STRIDE_ENCRYPTION_KEY: webcrypto.randomUUID(),
  DB: {
    prepare(query) {
      let args = [];
      const s = {
        query,
        bind(...v) {
          args = v;
          return s;
        },
        first() {
          return sql.prepare(query).get(...args) ?? null;
        },
        all() {
          return { results: sql.prepare(query).all(...args) };
        },
        run() {
          const r = sql.prepare(query).run(...args);
          return { meta: { changes: Number(r.changes) } };
        },
      };
      return s;
    },
    async batch(statements) {
      let failAt = null;
      if (nextBatchHook && nextBatchHook.match(statements)) {
        const hook = nextBatchHook;
        nextBatchHook = null;
        failAt = hook.failAt ?? null;
        if (hook.wait) await hook.wait();
      }
      sql.exec('BEGIN');
      try {
        const out = [];
        for (let i = 0; i < statements.length; i++) {
          if (i === failAt) throw new Error('Synthetic batch failure');
          out.push(statements[i].run());
        }
        sql.exec('COMMIT');
        return out;
      } catch (e) {
        sql.exec('ROLLBACK');
        throw e;
      }
    },
  },
};
const cache = new Map(),
  sourceHashes = {};
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file).exports;
  if (!file.startsWith(site + path.sep))
    throw new Error('Outside source scope');
  const module = { exports: {} };
  cache.set(file, module);
  const source = fs.readFileSync(file, 'utf8');
  sourceHashes[path.relative(site, file)] = createHash('sha256')
    .update(source)
    .digest('hex');
  const js = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
  }).outputText;
  const req = (spec) => {
    if (spec === 'cloudflare:workers') return { env };
    if (spec === '@garmin/fitsdk')
      return require(path.join(site, 'node_modules/@garmin/fitsdk'));
    let p = spec.startsWith('@/')
      ? path.join(site, spec.slice(2))
      : spec.startsWith('.')
        ? path.resolve(path.dirname(file), spec)
        : null;
    if (!p) throw new Error('Unapproved dependency ' + spec);
    if (p.endsWith('.json')) return JSON.parse(fs.readFileSync(p, 'utf8'));
    if (!p.endsWith('.ts')) p += '.ts';
    return load(p);
  };
  vm.runInNewContext(
    js,
    {
      module,
      exports: module.exports,
      require: req,
      Request,
      Response,
      Headers,
      URL,
      TextEncoder,
      TextDecoder,
      AbortSignal,
      crypto: webcrypto,
      structuredClone,
      Uint8Array,
      ArrayBuffer,
      DataView,
      Intl,
      Date,
      Math,
      Set,
      Map,
      Buffer,
      btoa,
      atob,
      setTimeout,
      clearTimeout,
      async fetch(url) {
        providerCalls++;
        if (providerHook) {
          const h = providerHook;
          providerHook = null;
          await h();
        }
        if (String(url) !== 'https://intervals.icu/api/v1/athlete/0')
          throw new Error('Unexpected synthetic provider path');
        return Response.json({ id: 'i100', name: 'Synthetic provider' });
      },
    },
    { filename: file, timeout: 10000 },
  );
  return module.exports;
}
const server = load(path.join(site, 'lib/server.ts')),
  accounts = load(path.join(site, 'lib/accounts.ts')),
  engine = load(path.join(site, 'lib/engine.ts')),
  recovery = load(path.join(site, 'app/api/recovery/route.ts')),
  recoveryLib = load(path.join(site, 'lib/recovery.ts')),
  profile = load(path.join(site, 'app/api/profile/route.ts')),
  connections = load(path.join(site, 'app/api/connections/route.ts')),
  exportRoute = load(path.join(site, 'app/api/export/route.ts'));
const planRoute = load(path.join(site, 'app/api/plan/route.ts'));
const asOf = engine.todayInZone('UTC'),
  basePlan = engine.makePlan(
    {
      ...engine.demoProfile(asOf),
      startDate: asOf,
      raceDate: engine.addDays(asOf, 55),
      timezone: 'UTC',
    },
    asOf,
  );
const file = {
  format: 'stride-recovery-2',
  exportedAt: new Date().toISOString(),
  profile: {
    display_name: 'Restored runner',
    city: 'Synthetic city',
    units: 'km',
    timezone: 'UTC',
    accent: 'evergreen',
  },
  plan: basePlan,
};
let serial = 0;
const results = [];
function request(owner, route, epoch, payload) {
  return new Request('https://synthetic-audit.invalid' + route, {
    method: payload ? 'POST' : 'GET',
    headers: {
      ...(owner ? { 'oai-authenticated-user-id': owner } : {}),
      origin: 'https://synthetic-audit.invalid',
      'content-type': 'application/json',
      'x-stride-account': owner
        ? (sql
            .prepare('SELECT account_id FROM accounts WHERE owner=?')
            .get(owner)?.account_id ?? '')
        : '',
      ...(epoch !== undefined ? { 'x-stride-epoch': String(epoch) } : {}),
    },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  });
}
async function call(route, owner, epoch, payload) {
  const response = await route.POST(
    request(owner, '/api/test', epoch, payload),
  );
  return { status: response.status, data: await response.json() };
}
async function seed() {
  const owner = 'synthetic-' + ++serial;
  const a = await accounts.readAccount(owner);
  await server.saveState(
    owner,
    0,
    structuredClone(basePlan),
    'Initial plan',
    a.epoch,
  );
  sql
    .prepare(
      'INSERT INTO profiles(owner,display_name,city,units,timezone,accent,updated_at) VALUES(?,?,?,?,?,?,?)',
    )
    .run(
      owner,
      'Original ' + owner,
      '',
      'km',
      'UTC',
      'evergreen',
      new Date().toISOString(),
    );
  return owner;
}
function snapshot(owner) {
  const tables = [
    'accounts',
    'athlete_state',
    'revisions',
    'profiles',
    'connections',
    'deliveries',
    'recovery_operations',
  ];
  return JSON.stringify(
    tables.map((t) => [
      t,
      sql.prepare(`SELECT * FROM ${t} WHERE owner=? ORDER BY rowid`).all(owner),
    ]),
  );
}
async function preview(owner, kind = 'restore', source = file) {
  const account = await accounts.readAccount(owner);
  const r = await call(recovery, owner, account.epoch, {
    action: 'preview',
    kind,
    ...(kind === 'restore' ? { file: source } : {}),
  });
  assert.equal(r.status, 200, r.data.error);
  return { ...r.data, source };
}
async function commit(owner, p, extra = {}) {
  return call(recovery, owner, p.accountEpoch, {
    action: 'commit',
    kind: p.kind,
    id: p.id,
    confirm:
      p.kind === 'delete'
        ? 'DELETE'
        : p.kind === 'restore'
          ? 'REPLACE'
          : 'OPEN',
    ...(p.kind === 'restore' ? { file: p.source } : {}),
    ...extra,
  });
}
async function remove(owner) {
  const p = await preview(owner, 'delete');
  const r = await commit(owner, p);
  assert.equal(r.status, 200, r.data.error);
  return r;
}
const profilePayload = {
  displayName: 'New profile',
  city: '',
  units: 'km',
  timezone: 'UTC',
  accent: 'evergreen',
};
function gateBatch(match) {
  let entered, release;
  const reached = new Promise((r) => (entered = r)),
    done = new Promise((r) => (release = r));
  nextBatchHook = {
    match,
    wait: async () => {
      entered();
      await done;
    },
  };
  return { reached, release };
}
async function check(name, fn) {
  try {
    results.push({ name, passed: true, detail: await fn() });
  } catch (e) {
    results.push({ name, passed: false, error: e.message });
    nextBatchHook = null;
    providerHook = null;
  }
}

(async () => {
  await check('Restore replaces only A and remaps identities', async () => {
    const a = await seed(),
      b = await seed(),
      beforeB = snapshot(b),
      p = await preview(a),
      r = await commit(a, p);
    assert.equal(r.status, 200, r.data.error);
    assert.equal(r.data.accountEpoch, 1);
    assert.equal(r.data.version, 2);
    assert.notEqual(r.data.plan.id, file.plan.id);
    assert.notEqual(r.data.plan.workouts[0].id, file.plan.workouts[0].id);
    assert.equal(
      sql.prepare('SELECT display_name FROM profiles WHERE owner=?').get(a)
        .display_name,
      'Restored runner',
    );
    assert.equal(snapshot(b), beforeB);
    return 'A restored, B unchanged, server-generated IDs';
  });
  await check(
    'Completed commit retry is a no-op and returns current epoch',
    async () => {
      const a = await seed(),
        p = await preview(a);
      assert.equal((await commit(a, p)).status, 200);
      const before = snapshot(a),
        r = await commit(a, p);
      assert.equal(r.status, 200);
      assert.equal(r.data.alreadyCompleted, true);
      assert.equal(r.data.accountEpoch, 1);
      assert.equal(snapshot(a), before);
      return '200 alreadyCompleted, no second write';
    },
  );
  await check('Changed payload cannot reuse completed operation', async () => {
    const a = await seed(),
      p = await preview(a);
    await commit(a, p);
    const before = snapshot(a),
      changed = structuredClone(file);
    changed.profile.display_name = 'Changed after commit';
    const r = await commit(a, { ...p, source: changed });
    assert.equal(r.status, 409);
    assert.equal(snapshot(a), before);
    return '409';
  });
  await check('A cannot use B recovery operation ID', async () => {
    const a = await seed(),
      b = await seed(),
      p = await preview(b),
      beforeA = snapshot(a),
      beforeB = snapshot(b),
      r = await commit(a, p);
    assert.equal(r.status, 409);
    assert.equal(snapshot(a), beforeA);
    assert.equal(snapshot(b), beforeB);
    return '409 and both owners unchanged';
  });
  await check('Profile change invalidates existing preview', async () => {
    const a = await seed(),
      p = await preview(a);
    assert.equal((await call(profile, a, 0, profilePayload)).status, 200);
    const before = snapshot(a),
      r = await commit(a, p);
    assert.equal(r.status, 409);
    assert.equal(snapshot(a), before);
    return '409';
  });
  await check('Plan change invalidates existing preview', async () => {
    const a = await seed(),
      p = await preview(a);
    await server.saveState(
      a,
      1,
      structuredClone(basePlan),
      'New plan revision',
      0,
    );
    const before = snapshot(a),
      r = await commit(a, p);
    assert.equal(r.status, 409);
    assert.equal(snapshot(a), before);
    return '409';
  });
  await check('Connection mutation invalidates preview', async () => {
    const a = await seed(),
      p = await preview(a);
    assert.equal(
      (await call(connections, a, 0, { action: 'disconnect' })).status,
      200,
    );
    const before = snapshot(a),
      r = await commit(a, p);
    assert.equal(r.status, 409);
    assert.equal(snapshot(a), before);
    return '409';
  });
  await check('Expired review rejects commit', async () => {
    const a = await seed(),
      p = await preview(a);
    sql
      .prepare(
        'UPDATE recovery_operations SET expires_at=? WHERE owner=? AND id=?',
      )
      .run('2000-01-01T00:00:00.000Z', a, p.id);
    const before = snapshot(a),
      r = await commit(a, p);
    assert.equal(r.status, 409);
    assert.equal(snapshot(a), before);
    return '409';
  });
  await check('Wrong confirmation rejects without mutation', async () => {
    const a = await seed(),
      p = await preview(a),
      before = snapshot(a),
      r = await commit(a, p, { confirm: 'WRONG' });
    assert.equal(r.status, 422);
    assert.equal(snapshot(a), before);
    return '422';
  });
  await check('Missing epoch rejects preview', async () => {
    const a = await seed(),
      before = snapshot(a),
      r = await call(recovery, a, undefined, {
        action: 'preview',
        kind: 'delete',
      });
    assert.equal(r.status, 409);
    assert.equal(snapshot(a), before);
    return '409';
  });
  await check(
    'Mid-commit profile write defeats recovery CAS safely',
    async () => {
      const a = await seed(),
        p = await preview(a),
        g = gateBatch((s) =>
          s[0].query.startsWith('UPDATE accounts SET epoch=epoch+1'),
        );
      const pending = commit(a, p);
      await g.reached;
      assert.equal((await call(profile, a, 0, profilePayload)).status, 200);
      const before = snapshot(a);
      g.release();
      const r = await pending;
      assert.equal(r.status, 409);
      assert.equal(snapshot(a), before);
      return '409, profile retained, recovery statements gated';
    },
  );
  await check(
    'Stale plan request cannot resurrect after deletion',
    async () => {
      const a = await seed(),
        g = gateBatch((s) =>
          s[0].query.startsWith('INSERT INTO athlete_state'),
        );
      const pending = server
        .saveState(a, 1, structuredClone(basePlan), 'Stale in-flight plan', 0)
        .then(
          () => ({ ok: true }),
          (e) => ({ status: e.status }),
        );
      await g.reached;
      await remove(a);
      const before = snapshot(a);
      g.release();
      assert.equal((await pending).status, 409);
      assert.equal(snapshot(a), before);
      assert.equal((await server.readState(a)).plan, null);
      return '409, no resurrection';
    },
  );
  await check(
    'Stale profile request cannot resurrect after deletion',
    async () => {
      const a = await seed(),
        g = gateBatch((s) =>
          s[0].query.startsWith('UPDATE accounts SET revision=revision+1'),
        );
      const pending = call(profile, a, 0, profilePayload);
      await g.reached;
      await remove(a);
      const before = snapshot(a);
      g.release();
      assert.equal((await pending).status, 409);
      assert.equal(snapshot(a), before);
      assert(!sql.prepare('SELECT owner FROM profiles WHERE owner=?').get(a));
      return '409, no profile recreated';
    },
  );
  await check(
    'Provider response arriving after deletion cannot save connection',
    async () => {
      const a = await seed();
      let entered, release;
      const reached = new Promise((r) => (entered = r)),
        gate = new Promise((r) => (release = r));
      providerHook = async () => {
        entered();
        await gate;
      };
      const pending = call(connections, a, 0, {
        key: 'synthetic-test-key-only',
      });
      await reached;
      await remove(a);
      const before = snapshot(a);
      release();
      const r = await pending;
      assert.equal(r.status, 409);
      assert.equal(snapshot(a), before);
      assert(
        !sql.prepare('SELECT owner FROM connections WHERE owner=?').get(a),
      );
      return '409; synthetic provider only';
    },
  );
  await check(
    'Restore batch failure rolls back account and all data',
    async () => {
      const a = await seed(),
        p = await preview(a),
        before = snapshot(a);
      nextBatchHook = {
        match: (s) =>
          s[0].query.startsWith('UPDATE accounts SET epoch=epoch+1'),
        failAt: 5,
      };
      const r = await commit(a, p);
      assert.equal(r.status, 500);
      assert.equal(snapshot(a), before);
      return '500, pre-operation state byte-equivalent';
    },
  );
  await check(
    'Deletion batch failure rolls back account and all data',
    async () => {
      const a = await seed(),
        p = await preview(a, 'delete'),
        before = snapshot(a);
      nextBatchHook = {
        match: (s) =>
          s[0].query.startsWith('UPDATE accounts SET epoch=epoch+1'),
        failAt: 5,
      };
      const r = await commit(a, p);
      assert.equal(r.status, 500);
      assert.equal(snapshot(a), before);
      return '500, no partial erasure';
    },
  );
  await check(
    'Closed account rejects normal writes even with fresh epoch',
    async () => {
      const a = await seed();
      await remove(a);
      const before = snapshot(a),
        r = await call(profile, a, 1, profilePayload);
      assert.equal(r.status, 409);
      await assert.rejects(
        server.saveState(a, 2, basePlan, 'Closed write', 1),
        (e) => e.status === 409,
      );
      assert.equal(snapshot(a), before);
      return '409';
    },
  );
  await check(
    'Explicit reopen advances epoch; pre-delete requests stay blocked',
    async () => {
      const a = await seed();
      await remove(a);
      const p = await preview(a, 'reopen'),
        r = await commit(a, p);
      assert.equal(r.status, 200);
      assert.equal(r.data.accountEpoch, 2);
      assert.equal(r.data.plan, null);
      const before = snapshot(a);
      await assert.rejects(
        server.saveState(a, 1, basePlan, 'Old pre-delete request', 0),
        (e) => e.status === 409,
      );
      assert.equal(snapshot(a), before);
      const current = await server.readState(a);
      const saved = await server.saveState(
        a,
        current.version,
        basePlan,
        'Legitimate reopened activation',
        2,
      );
      assert.equal(saved.accountEpoch, 2);
      return 'Reopen works; stale write blocked; fresh activation succeeds';
    },
  );
  await check('Profile-only recovery works with null plan', async () => {
    const a = await seed(),
      p = await preview(a, 'restore', { ...file, plan: null }),
      r = await commit(a, p);
    assert.equal(r.status, 200, r.data.error);
    assert.equal(r.data.plan, null);
    assert.equal(
      sql.prepare('SELECT display_name FROM profiles WHERE owner=?').get(a)
        .display_name,
      file.profile.display_name,
    );
    return 'Profile restored, plan null';
  });
  await check('Profile-only export returns saved profile', async () => {
    const a = 'profile-only-' + ++serial;
    await accounts.readAccount(a);
    assert.equal((await call(profile, a, 0, profilePayload)).status, 200);
    const response = await exportRoute.GET(request(a, '/api/export', 0));
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.plan, null);
    assert.equal(data.profile.display_name, profilePayload.displayName);
    assert.equal(data.history.length, 0);
    return '200, null plan and saved profile';
  });
  await check(
    'Concurrent exact commit retries both succeed without a second write',
    async () => {
      const a = await seed(),
        p = await preview(a),
        g = gateBatch((s) =>
          s[0].query.startsWith('UPDATE accounts SET epoch=epoch+1'),
        );
      const first = commit(a, p);
      await g.reached;
      const second = await commit(a, p);
      assert.equal(second.status, 200);
      const before = snapshot(a);
      g.release();
      const r = await first;
      assert.equal(r.status, 200, r.data.error);
      assert.equal(r.data.alreadyCompleted, true);
      assert.equal(snapshot(a), before);
      assert.equal((await accounts.readAccount(a)).epoch, 1);
      return 'Both 200, losing twin returns alreadyCompleted, epoch increments once';
    },
  );
  await check(
    'Preview racing with profile mutation returns a conflict without an invented ID',
    async () => {
      const a = await seed(),
        g = gateBatch((s) =>
          s[0].query.startsWith('DELETE FROM recovery_operations'),
        );
      const pending = call(recovery, a, 0, {
        action: 'preview',
        kind: 'restore',
        file,
      });
      await g.reached;
      assert.equal((await call(profile, a, 0, profilePayload)).status, 200);
      g.release();
      const r = await pending;
      assert.equal(r.status, 409, r.data.error);
      assert.equal(r.data.id, undefined);
      assert.equal(
        sql
          .prepare(
            'SELECT COUNT(*) AS n FROM recovery_operations WHERE owner=?',
          )
          .get(a).n,
        0,
      );
      return '409 and no preview row';
    },
  );
  await check(
    'Zero-data account exports JSON and recovery; FIT remains 404',
    async () => {
      const a = 'zero-data-' + ++serial;
      const ordinary = await exportRoute.GET(request(a, '/api/export', 0));
      assert.equal(ordinary.status, 200);
      const data = await ordinary.json();
      assert.equal(data.version, 0);
      assert.equal(data.plan, null);
      assert.equal(data.profile, null);
      assert.equal(data.history.length, 0);
      const response = await exportRoute.GET(
        request(a, '/api/export?format=recovery', 0),
      );
      assert.equal(response.status, 200);
      const backup = await response.json();
      assert.equal(backup.format, 'stride-recovery-2');
      assert.equal(backup.plan, null);
      assert.equal(backup.profile, null);
      assert.equal(
        (
          await exportRoute.GET(
            request(a, '/api/export?format=fit&id=missing', 0),
          )
        ).status,
        404,
      );
      return 'Both JSON formats work without a plan; FIT correctly rejects';
    },
  );
  await check(
    'Zero-data recovery round trip clears only the destination journal/profile',
    async () => {
      const a = 'empty-source-' + ++serial,
        response = await exportRoute.GET(
          request(a, '/api/export?format=recovery', 0),
        ),
        backup = await response.json(),
        destination = await seed(),
        b = await seed(),
        beforeB = snapshot(b),
        p = await preview(destination, 'restore', backup),
        r = await commit(destination, p);
      assert.equal(r.status, 200, r.data.error);
      assert.equal(r.data.plan, null);
      assert.equal(r.data.accountStatus, 'active');
      assert(
        !sql
          .prepare('SELECT owner FROM profiles WHERE owner=?')
          .get(destination),
      );
      assert.equal(snapshot(b), beforeB);
      return 'Explicit empty replacement succeeds; unrelated B unchanged';
    },
  );
  await check(
    'Exported profile-only recovery round trip retains profile values',
    async () => {
      const a = 'profile-source-' + ++serial;
      await accounts.readAccount(a);
      assert.equal((await call(profile, a, 0, profilePayload)).status, 200);
      const response = await exportRoute.GET(
          request(a, '/api/export?format=recovery', 0),
        ),
        backup = await response.json(),
        destination = await seed(),
        p = await preview(destination, 'restore', backup),
        r = await commit(destination, p);
      assert.equal(r.status, 200, r.data.error);
      assert.equal(r.data.plan, null);
      assert.equal(
        sql
          .prepare('SELECT display_name FROM profiles WHERE owner=?')
          .get(destination).display_name,
        profilePayload.displayName,
      );
      return 'Downloaded file restores the saved profile';
    },
  );
  function multibyteFile(noteLength) {
    const candidate = structuredClone(file);
    candidate.plan.extraRuns = Array.from({ length: 1000 }, (_, i) => ({
      id: 'u-' + i,
      date: asOf,
      minutes: 30,
      km: 5,
      effort: 3,
      feeling: 'okay',
      note: '界'.repeat(noteLength),
      recordedAt: new Date().toISOString(),
    }));
    return candidate;
  }
  await check(
    'saveState rejects non-ASCII bytes exceeding the cap even below the code-unit cap',
    async () => {
      const a = await seed(),
        candidate = multibyteFile(500),
        serialized = JSON.stringify(candidate.plan);
      assert(serialized.length < 1500000);
      assert(Buffer.byteLength(serialized) > 1500000);
      const before = snapshot(a);
      await assert.rejects(
        server.saveState(a, 1, candidate.plan, 'Oversized multibyte plan', 0),
        (e) => e.status === 413,
      );
      assert.equal(snapshot(a), before);
      return {
        codeUnits: serialized.length,
        utf8Bytes: Buffer.byteLength(serialized),
        status: 413,
        unchanged: true,
      };
    },
  );
  await check(
    'Recovery rejects payload growth after normalization and ID remapping',
    async () => {
      let candidate, inputBytes, normalizedBytes;
      for (let n = 300; n <= 500; n += 5) {
        const trial = multibyteFile(n),
          raw = Buffer.byteLength(JSON.stringify(trial));
        const normalized = recoveryLib.prepareRestoredPlan(
            recoveryLib.validateRecovery(trial).plan,
          ),
          size = Buffer.byteLength(JSON.stringify(normalized));
        if (raw < 1500000 && size > 1500000) {
          candidate = trial;
          inputBytes = raw;
          normalizedBytes = size;
          break;
        }
      }
      assert(candidate, 'Could not construct normalization-boundary fixture');
      const a = await seed(),
        p = await preview(a, 'restore', candidate),
        before = snapshot(a),
        r = await commit(a, p);
      assert.equal(r.status, 413, r.data.error);
      assert.equal(snapshot(a), before);
      return {
        inputBytes,
        normalizedPlanBytes: normalizedBytes,
        status: 413,
        unchanged: true,
      };
    },
  );
  await check('Undo cannot cross an empty recovery boundary', async () => {
    const a = await seed(),
      p = await preview(a, 'restore', { ...file, plan: null });
    assert.equal((await commit(a, p)).status, 200);
    const state = await server.readState(a);
    assert.equal(
      (
        await call(planRoute, a, 1, {
          action: 'activate',
          version: state.version,
          profile: basePlan.profile,
        })
      ).status,
      200,
    );
    const before = snapshot(a),
      r = await call(planRoute, a, 1, {
        action: 'undo',
        version: (await server.readState(a)).version,
      });
    assert.equal(r.status, 422, r.data.error);
    assert.equal(snapshot(a), before);
    return '422 with unchanged journal';
  });
  await check(
    'Undo new block restores the completed run to its original week',
    async () => {
      const a = await seed(),
        p = structuredClone(basePlan),
        w = p.workouts[0];
      w.status = 'completed';
      w.feedback = {
        actualDate: asOf,
        actualMinutes: 30,
        actualKm: 5.125,
        effort: 3,
        feeling: 'good',
        note: 'Keep actual facts',
        recordedAt: new Date().toISOString(),
      };
      await server.saveState(a, 1, p, 'Recorded first run', 0);
      const activated = await call(planRoute, a, 0, {
        action: 'activate',
        version: 2,
        profile: basePlan.profile,
      });
      assert.equal(activated.status, 200, activated.data.error);
      assert.equal(
        activated.data.plan.workouts.find((s) => s.id === w.id).week,
        -1,
      );
      const undone = await call(planRoute, a, 0, {
        action: 'undo',
        version: 3,
      });
      assert.equal(undone.status, 200, undone.data.error);
      const restored = undone.data.plan.workouts.find((s) => s.id === w.id);
      assert.equal(restored.week, w.week);
      assert.equal(restored.feedback.actualKm, 5.125);
      return 'Original week restored; actual facts retained';
    },
  );
  const report = {
    scope:
      'Actual draft Site modules loaded into an isolated VM with in-memory SQLite using current migrations. Synthetic provider responses only; no HTTP network, production credentials, persistent DB, Site edits, or deployments.',
    generatedAt: new Date().toISOString(),
    sourceHashes,
    providerCalls,
    passed: results.filter((r) => r.passed).length,
    total: results.length,
    results,
  };
  if (reportPath)
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  process.stdout.write(
    JSON.stringify(
      { passed: report.passed, total: report.total, results },
      null,
      2,
    ) + '\n',
  );
  sql.close();
  if (report.passed !== report.total) process.exitCode = 1;
})().catch((e) => {
  process.stderr.write(e.stack + '\n');
  process.exitCode = 1;
});

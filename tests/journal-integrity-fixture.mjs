// In-memory SQLite using the real migrations/routes. No network or saved user data.
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
const root = new URL('../', import.meta.url);
globalThis.journalIntegrityEnv = {
  DB: null,
  STRIDE_ENCRYPTION_KEY: 'synthetic-test-secret',
};
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'cloudflare:workers')
      return {
        url: 'data:text/javascript,export const env=globalThis.journalIntegrityEnv;',
        shortCircuit: true,
      };
    if (context.parentURL?.startsWith(root.href)) {
      const base = specifier.startsWith('@/')
        ? new URL(specifier.slice(2), root)
        : specifier.startsWith('.')
          ? new URL(specifier, context.parentURL)
          : null;
      if (base)
        for (const suffix of ['', '.ts', '/index.ts']) {
          const url = new URL(base.href + suffix);
          if (existsSync(url)) return { url: url.href, shortCircuit: true };
        }
    }
    return next(specifier, context);
  },
});
const { POST } = await import('../app/api/plan/route.ts');
const { POST: recovery } = await import('../app/api/recovery/route.ts');
const { readAccount } = await import('../lib/accounts.ts');
const { readState, saveState, encrypt, journalMutation } =
  await import('../lib/server.ts');
const { makePlan, demoProfile, todayInZone, addDays } =
  await import('../lib/engine.ts');
const { normalizeActivity } = await import('../lib/provider-activities.ts');
const { validateRun } = await import('../lib/run-input.ts');
const { validateRecovery } = await import('../lib/recovery.ts');
const { trainingRecords } = await import('../lib/run-records.ts');
const today = todayInZone('UTC');
const owner = 'synthetic-owner';
const run = (overrides = {}) => ({
  date: today,
  minutes: 40,
  km: 6,
  effort: 4,
  feeling: 'good',
  note: 'private-note',
  ...overrides,
});
const record = (overrides = {}) => ({
  id: 'record-1',
  type: 'Run',
  start_date_local: today + 'T23:30:00',
  start_date: today + 'T10:30:00Z',
  timezone: 'Pacific/Auckland',
  moving_time: 2400,
  distance: 6000,
  ...overrides,
});
const feedback = (overrides = {}) => ({
  actualDate: today,
  actualMinutes: 40,
  actualKm: 6,
  effort: 4,
  feeling: 'good',
  note: '',
  ...overrides,
});
const time = (r) => ({
  startLocal: r.startLocal,
  startUtc: r.startUtc,
  timezone: r.timezone,
});

async function fixture(t) {
  const db = new DatabaseSync(':memory:');
  for (const file of readdirSync(new URL('../drizzle/', import.meta.url))
    .filter((f) => /\.sql$/.test(f))
    .sort())
    db.exec(
      readFileSync(new URL('../drizzle/' + file, import.meta.url), 'utf8'),
    );
  const prepare = (sql, values = []) => ({
    sql,
    bind: (...args) => prepare(sql, args),
    first: async (column) => {
      const row = db.prepare(sql).get(...values) ?? null;
      return column ? (row?.[column] ?? null) : row;
    },
    all: async () => ({
      results: db.prepare(sql).all(...values),
      success: true,
      meta: {},
    }),
    run: async () => {
      const r = db.prepare(sql).run(...values);
      return { success: true, meta: { changes: Number(r.changes) } };
    },
  });
  let queue = Promise.resolve();
  const env = globalThis.journalIntegrityEnv;
  const options = {};
  env.DB = {
    prepare,
    batch: (statements) => {
      const result = queue.then(async () => {
        options.beforeBatch?.(statements);
        db.exec('BEGIN');
        try {
          const results = [];
          for (const statement of statements)
            results.push(await statement.run());
          db.exec('COMMIT');
          return results;
        } catch (error) {
          db.exec('ROLLBACK');
          throw error;
        }
      });
      queue = result.catch(() => {});
      return result;
    },
  };
  await readAccount(owner);
  const fetchBefore = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('Unexpected network call');
  };
  t.after(() => {
    globalThis.fetch = fetchBefore;
    db.close();
  });
  function request(payload, who = owner, epoch = 0) {
    const account = db
      .prepare('SELECT account_id FROM accounts WHERE owner=?')
      .get(who);
    return new Request('https://fixture.test/api/plan', {
      method: 'POST',
      headers: {
        'oai-authenticated-user-id': who,
        'x-stride-account': account?.account_id ?? '',
        'x-stride-epoch': String(epoch),
        'content-type': 'application/json',
        origin: 'https://fixture.test',
      },
      body: JSON.stringify(payload),
    });
  }
  async function action(payload, who, epoch) {
    const r = await POST(request(payload, who, epoch));
    return { status: r.status, data: await r.json() };
  }
  async function seedPlan() {
    const p = makePlan({ ...demoProfile(addDays(today, -7)), timezone: 'UTC' });
    await saveState(owner, 0, p, 'Synthetic plan', 0);
    return p;
  }
  async function connect(records = [record()]) {
    db.prepare(
      'INSERT INTO connections(owner,encrypted_key,athlete_name,connected_at,provider_athlete_id,generation) VALUES(?,?,?,?,?,?)',
    ).run(
      owner,
      await encrypt('synthetic-key'),
      'Fixture',
      new Date().toISOString(),
      'athlete',
      'connection-1',
    );
    globalThis.fetch = async (input) => {
      assert.ok(
        String(input).startsWith(
          'https://intervals.icu/api/v1/athlete/athlete/activities?',
        ),
      );
      return Response.json(records);
    };
  }
  return { db, options, request, action, seedPlan, connect };
}

export {
  fixture,
  owner,
  today,
  run,
  feedback,
  record,
  time,
  readAccount,
  readState,
  saveState,
  journalMutation,
  normalizeActivity,
  validateRun,
  validateRecovery,
  trainingRecords,
  recovery,
  demoProfile,
  addDays,
};

// Portable contract: real pure engine and real plan route with SQLite :memory: only.
// No .env, hosted owner, cookies, provider calls or filesystem database are used.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const site = new URL(
  existsSync(new URL('./stride/', import.meta.url)) ? './stride/' : '../',
  import.meta.url,
);
globalThis.historicalStartAcceptanceEnv = { DB: null };
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'cloudflare:workers')
      return {
        url: 'data:text/javascript,export const env=globalThis.historicalStartAcceptanceEnv;',
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
const engine = await import(new URL('lib/engine.ts', site));
const { reconcileStartDate } = await import(
  new URL('lib/form-values.ts', site)
);
const { trainingRecords, currentTrainingBaseline } = await import(
  new URL('lib/training-history.ts', site)
);
const { changeEvent } = await import(new URL('lib/event-transition.ts', site));
const { POST: planRoute } = await import(
  new URL('app/api/plan/route.ts', site)
);
const { readAccount } = await import(new URL('lib/accounts.ts', site));
const { saveState, readState } = await import(new URL('lib/server.ts', site));
const {
  makePlan,
  demoProfile,
  addDays,
  todayInZone,
  revisePreferences,
  validatePlan,
} = engine;
globalThis.fetch = async () => {
  throw new Error(
    'Historical-start acceptance prohibits every external request',
  );
};
const today = todayInZone('UTC');
const profile = (start = addDays(today, -28), patch = {}) => ({
  ...demoProfile(start),
  timezone: 'UTC',
  goal: 'base',
  raceName: 'Synthetic historical-start acceptance',
  startDate: start,
  raceDate: addDays(start, 83),
  weeklyKm: 30,
  longestKm: 10,
  currentRuns: 4,
  days: [0, 2, 4, 6],
  longDay: 6,
  weekdayMinutes: 60,
  longMinutes: 100,
  experience: 'established',
  volume: 'gradual',
  ...patch,
});
const freeze = (o) => {
  Object.freeze(o);
  for (const value of Object.values(o))
    if (value && typeof value === 'object' && !Object.isFrozen(value))
      freeze(value);
  return o;
};
const facts = (w) => ({
  ...w,
  feedback: w.feedback ? structuredClone(w.feedback) : undefined,
});
function withHistory() {
  const plan = makePlan(profile(), addDays(today, -28));
  const completed = plan.workouts.find((w) => w.date < addDays(today, -10));
  Object.assign(completed, {
    status: 'completed',
    feedback: {
      actualDate: addDays(completed.date, 1),
      actualMinutes: 42.25,
      actualKm: null,
      effort: 4,
      feeling: 'okay',
      execution: 'unknown',
      note: 'Synthetic exact historical feedback',
      recordedAt: today + 'T10:00:00Z',
    },
  });
  const skipped = plan.workouts.find((w) => w !== completed && w.date < today);
  Object.assign(skipped, {
    status: 'skipped',
    skipReason: 'Deliberate synthetic rest',
  });
  plan.extraRuns = [
    {
      id: 'synthetic-extra-history',
      date: addDays(today, -3),
      minutes: 31.125,
      km: 5.1234,
      effort: 3,
      feeling: 'good',
      note: 'Synthetic extra',
      recordedAt: today + 'T10:01:00Z',
    },
  ];
  return plan;
}
async function fixture(t) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  for (const name of readdirSync(new URL('drizzle/', site))
    .filter((n) => /^\d+.*\.sql$/.test(n))
    .sort())
    sqlite.exec(readFileSync(new URL('drizzle/' + name, site), 'utf8'));
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
  globalThis.historicalStartAcceptanceEnv.DB = {
    prepare,
    batch: async (stmts) => {
      sqlite.exec('BEGIN');
      try {
        const values = [];
        for (const s of stmts) values.push(await s.run());
        sqlite.exec('COMMIT');
        return values;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
    exec: async (sql) => {
      sqlite.exec(sql);
      return { count: 1, duration: 0 };
    },
  };
  const owner = 'synthetic-historical-start-' + randomUUID();
  const account = await readAccount(owner);
  const action = async (payload) => {
    const response = await planRoute(
      new Request('https://stride.test/api/plan', {
        method: 'POST',
        headers: {
          'oai-authenticated-user-id': owner,
          'x-stride-account': account.account_id,
          'x-stride-epoch': '0',
          origin: 'https://stride.test',
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      }),
    );
    return { status: response.status, data: await response.json() };
  };
  return { owner, action };
}

void test('H01: selected historical start survives timezone midnight without roll-forward', () => {
  const instant = new Date('2026-09-07T22:58:00Z');
  assert.deepEqual(
    reconcileStartDate('2026-09-07', 'Europe/Vilnius', instant),
    { today: '2026-09-08', start: '2026-09-07', corrected: false },
  );
  assert.deepEqual(
    reconcileStartDate('2024-02-29', 'America/Los_Angeles', instant),
    { today: '2026-09-07', start: '2024-02-29', corrected: false },
  );
});
void test('H02: incomplete dates stay incomplete and future dates stay deliberate', () => {
  for (const start of ['', '2026-02-30', '2027-01-01'])
    assert.equal(
      reconcileStartDate(start, 'UTC', new Date('2026-09-08T01:00:00Z')).start,
      start,
    );
});
void test('H03: historical plan preserves exact partial-week date, original profile and all unlogged statuses', () => {
  const p = freeze(profile('2026-08-06', { raceDate: '2026-10-28' }));
  const plan = makePlan(p, '2026-09-08');
  assert.equal(plan.profile.startDate, p.startDate);
  for (const key of [
    'weeklyKm',
    'longestKm',
    'currentRuns',
    'raceDate',
    'days',
  ])
    assert.deepEqual(plan.profile[key], p[key]);
  assert.ok(plan.workouts.some((w) => w.date < '2026-09-08'));
  assert.ok(plan.workouts.some((w) => w.date >= '2026-09-08'));
  assert.ok(
    plan.workouts.every(
      (w) =>
        w.date >= p.startDate &&
        w.date <= p.raceDate &&
        w.status === 'planned' &&
        !w.feedback &&
        w.originalDate === w.date,
    ),
  );
  assert.deepEqual(trainingRecords(plan), []);
  assert.deepEqual(validatePlan(plan), []);
});
void test('H04: elapsed time cannot move old sessions or add catch-up work to the dated forecast', () => {
  const p = profile(),
    original = makePlan(p, p.startDate),
    later = makePlan(p, today);
  assert.deepEqual(later.workouts, original.workouts);
  assert.deepEqual(later.weeks, original.weeks);
  assert.equal(
    currentTrainingBaseline(later, today).supportsProgression,
    false,
  );
  assert.equal(
    currentTrainingBaseline(later, today).source,
    'declared-baseline',
  );
});
void test('H05: old calendar dates have no today-based lower bound', () => {
  const p = profile('1968-02-29', { raceDate: '1968-05-22' });
  const plan = makePlan(p, today);
  assert.equal(plan.profile.startDate, '1968-02-29');
  assert.ok(plan.workouts.every((w) => w.status === 'planned'));
});
void test('H06: invalid and reversed dates remain invalid', () => {
  for (const patch of [
    { startDate: '2026-02-30' },
    { raceDate: '2026-02-30' },
    { raceDate: addDays(today, -29) },
  ])
    assert.throws(() => makePlan(profile(undefined, patch), today));
});
void test('H07: structural preference replan preserves past planned/skipped/completed sessions and precise actual facts', () => {
  const p = withHistory(),
    before = structuredClone(p),
    historical = p.workouts.filter((w) => w.date < today).map(facts);
  const next = revisePreferences(freeze(p), { difficulty: 'gentle' }, today);
  assert.deepEqual(
    next.workouts.filter((w) => w.date < today).map(facts),
    historical,
  );
  assert.deepEqual(trainingRecords(next), trainingRecords(before));
  assert.deepEqual(next.extraRuns, before.extraRuns);
  assert.equal(next.profile.startDate, before.profile.startDate);
  const existing = new Set(before.workouts.map((w) => w.id));
  assert.ok(
    next.workouts
      .filter((w) => !existing.has(w.id))
      .every((w) => w.date >= today),
  );
  assert.deepEqual(p, before);
});
void test('H08: local time-limit replan never rewrites historical prescriptions or logged facts', () => {
  const p = withHistory(),
    before = structuredClone(p);
  const next = revisePreferences(freeze(p), { weekdayMinutes: 55 }, today);
  assert.deepEqual(
    next.workouts.filter((w) => w.date < today),
    before.workouts.filter((w) => w.date < today),
  );
  assert.deepEqual(trainingRecords(next), trainingRecords(before));
});
void test('H09: starting a new event changes future dates only and archives historical unknowns intact', () => {
  const p = withHistory(),
    before = structuredClone(p);
  const next = changeEvent(
    freeze(p),
    {
      goal: 'base',
      raceName: 'Synthetic next block',
      raceDate: addDays(today, 55),
      raceTerrain: 'road',
    },
    today,
  );
  assert.equal(next.profile.startDate, today);
  for (const old of before.workouts.filter((w) => w.date < today))
    assert.deepEqual(
      next.workouts.find((w) => w.id === old.id),
      { ...old, week: -1 },
    );
  assert.deepEqual(trainingRecords(next), trainingRecords(before));
  assert.ok(
    next.workouts.filter((w) => w.week >= 0).every((w) => w.date >= today),
  );
});
void test('H10: real preview route accepts historical start without writing or inventing observations', async (t) => {
  const { owner, action } = await fixture(t),
    p = profile();
  const result = await action({ action: 'preview', profile: p });
  assert.equal(result.status, 200, JSON.stringify(result.data));
  assert.equal(result.data.plan.profile.startDate, p.startDate);
  assert.deepEqual(trainingRecords(result.data.plan), []);
  assert.equal((await readState(owner)).version, 0);
});
void test('H11: real activation preserves selected start across save and retry without duplicate sessions', async (t) => {
  const { action } = await fixture(t),
    p = profile(),
    payload = {
      action: 'activate',
      version: 0,
      requestId: randomUUID(),
      profile: p,
    };
  const first = await action(payload);
  assert.equal(first.status, 200, JSON.stringify(first.data));
  assert.equal(first.data.plan.profile.startDate, p.startDate);
  assert.equal(first.data.version, 1);
  assert.ok(
    first.data.plan.workouts.every(
      (w) => w.status === 'planned' && !w.feedback,
    ),
  );
  const second = await action(payload);
  assert.equal(second.status, 200);
  assert.deepEqual(second.data.plan, first.data.plan);
  assert.equal(second.data.version, 1);
});
void test('H12: real replacement activation keeps existing actual dates/duration/unknown distance and extra runs', async (t) => {
  const { owner, action } = await fixture(t),
    old = withHistory();
  await saveState(owner, 0, old, 'Synthetic historical acceptance seed', 0);
  const result = await action({
    action: 'activate',
    version: 1,
    requestId: randomUUID(),
    profile: profile(addDays(today, -14)),
  });
  assert.equal(result.status, 200, JSON.stringify(result.data));
  assert.equal(result.data.version, 2);
  assert.deepEqual(trainingRecords(result.data.plan), trainingRecords(old));
  const recordedDays = new Set(trainingRecords(old).map((r) => r.date));
  assert.ok(
    result.data.plan.workouts
      .filter((w) => w.week >= 0)
      .every((w) => !recordedDays.has(w.date)),
  );
});

for (const span of [0, 6])
  void test(`real preview and activation accept a ${span + 1}-day marathon block`, async (t) => {
    const { owner, action } = await fixture(t);
    const p = profile(today, {
      goal: 'marathon',
      raceDate: addDays(today, span),
      weeklyKm: 70,
      longestKm: 25,
      currentRuns: 5,
      runsPerWeek: 5,
      days: [0, 1, 2, 3, 5],
      availableDays: [0, 1, 2, 3, 4, 5, 6],
      longDay: 5,
      weekdayMinutes: 90,
      longMinutes: 180,
    });
    const preview = await action({ action: 'preview', profile: p });
    assert.equal(preview.status, 200, JSON.stringify(preview.data));
    assert.equal((await readState(owner)).version, 0);
    const payload = {
      action: 'activate',
      version: 0,
      requestId: randomUUID(),
      profile: p,
    };
    const saved = await action(payload);
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
    assert.equal(saved.data.plan.profile.startDate, today);
    assert.equal(saved.data.plan.profile.raceDate, p.raceDate);
    assert.ok(
      saved.data.plan.workouts.every(
        (w) => w.date >= today && w.date <= p.raceDate,
      ),
    );
    assert.equal(
      saved.data.plan.workouts.filter((w) => w.kind === 'race').length,
      1,
    );
    const retried = await action(payload);
    assert.equal(retried.status, 200);
    assert.deepEqual(retried.data.plan, saved.data.plan);
  });

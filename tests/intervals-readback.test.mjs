// Offline acceptance tests against actual Stride adapters and actual receipt SQL.
// Run with the bundled Node: node --experimental-strip-types --test tests/intervals-readback.test.mjs
// Never loads .env or provider credentials. Only synthetic fetch responses are allowed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const site = existsSync(new URL('./stride/lib/garmin.ts', import.meta.url))
  ? new URL('./stride/', import.meta.url)
  : new URL('../', import.meta.url);
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
      if (options.readbackStepPatch)
        remote.workout_doc.steps = remote.workout_doc.steps.map((s) => ({
          ...s,
          ...options.readbackStepPatch,
        }));
      if (options.readbackGroupPatch)
        remote.workout_doc.steps = [
          {
            ...options.readbackGroupPatch,
            reps: 1,
            steps: remote.workout_doc.steps,
          },
        ];
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

// Official provider schema documents until_lap_press separately from duration.
// https://forum.intervals.icu/t/downloading-planned-workouts-from-the-api/93737
for (const [name, patch] of [
  ['absent', {}],
  ['explicit false', { until_lap_press: false }],
]) {
  void test(`I01 control: timed readback with ${JSON.stringify(name)} lap flag remains accepted`, async (t) => {
    const f = await fixture({ receipt: {}, readbackStepPatch: patch });
    t.after(() => f.sqlite.close());
    assert.equal((await outcome(f)).status, 'accepted');
    assert.equal(f.calls.filter((c) => c.method === 'PUT').length, 1);
  });
}
for (const [name, options] of [
  [
    'leaf step waits for manual lap',
    { readbackStepPatch: { until_lap_press: true } },
  ],
  [
    'group waits for manual lap',
    { readbackGroupPatch: { until_lap_press: true } },
  ],
  ['malformed lap flag', { readbackStepPatch: { until_lap_press: 'true' } }],
  ['ramped open step', { readbackStepPatch: { ramp: true } }],
  ['max-effort open step', { readbackStepPatch: { maxeffort: true } }],
  [
    'contradictory rest intensity',
    { readbackStepPatch: { intensity: 'rest' } },
  ],
  ['ramped group', { readbackGroupPatch: { ramp: true } }],
]) {
  void test(`I02: do not certify an altered duration rule: ${JSON.stringify(name)}`, async (t) => {
    const f = await fixture({ receipt: {}, ...options });
    t.after(() => f.sqlite.close());
    const before = f.sqlite
      .prepare('SELECT data FROM athlete_state WHERE owner=?')
      .get(owner).data;
    const result = await outcome(f);
    assert.equal(
      f.calls.filter((c) => c.method === 'PUT').length,
      1,
      'Reach the actual provider readback',
    );
    assert.equal(
      f.sqlite
        .prepare('SELECT data FROM athlete_state WHERE owner=?')
        .get(owner).data,
      before,
      'Sending never mutates journal or prescription',
    );
    notCertified(result);
  });
}

void test('readback preserves distinct warm-up, walking recovery, active float and cooldown roles', async () => {
  const { structuredMatch } = await import(new URL('lib/garmin.ts', site));
  const w = {
    steps: [
      { kind: 'warmup', seconds: 600, effort: 'Conversational' },
      { kind: 'work', seconds: 240, effort: 'Controlled fast' },
      {
        kind: 'recovery',
        seconds: 60,
        effort: 'Walk to recover',
        movement: 'walk',
      },
      { kind: 'work', seconds: 300, effort: 'Easy float' },
      { kind: 'cooldown', seconds: 600, effort: 'Gentle jog' },
    ],
  };
  const remote = {
    workout_doc: {
      steps: w.steps.map((s) => ({
        duration: s.seconds,
        text: s.effort,
        intensity: s.kind === 'work' ? 'active' : s.kind,
      })),
    },
  };
  assert.equal(structuredMatch(remote, w), true);
  for (let i = 0; i < w.steps.length; i++) {
    const changed = structuredClone(remote);
    changed.workout_doc.steps[i].intensity = i === 2 ? 'active' : 'recovery';
    assert.equal(
      structuredMatch(changed, w),
      false,
      `Reject changed role at step ${i}`,
    );
  }
});

void test('custom target hashes retain legacy effort receipts and distinguish new pace alerts', async () => {
  const { prescriptionHash, structuredMatch } = await import(
    new URL('lib/garmin.ts', site)
  );
  const { intervalsWorkoutText } = await import(
    new URL('lib/intervals-workout.ts', site)
  );
  const w = makePlan({ ...demoProfile(today), runMeasure: 'time' }).workouts[0];
  const oldHash = await prescriptionHash(w);
  const original = JSON.stringify({
    date: w.date,
    time: w.startTime ?? '00:00',
    title: w.title,
    steps: w.steps.map((s) => ({
      seconds: s.seconds,
      metres: s.metres ?? null,
      effort: s.effort,
      label: s.label,
      kind: s.kind,
    })),
  });
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(original),
  );
  assert.equal(
    oldHash,
    Array.from(new Uint8Array(bytes), (n) =>
      n.toString(16).padStart(2, '0'),
    ).join(''),
  );
  w.steps[0].target = { mode: 'pace', low: 300, high: 330 };
  assert.notEqual(await prescriptionHash(w), oldHash);
  assert.match(intervalsWorkoutText(w), /5:00-5:30\/km Pace/);
  const remote = {
    workout_doc: {
      steps: w.steps.map((s, i) => ({
        text: s.effort,
        duration: s.seconds,
        ...(i === 0
          ? {
              pace: { start: 300, end: 330, units: 'secs_km' },
              _pace: { start: 1000 / 330, end: 1000 / 300 },
            }
          : {}),
      })),
    },
  };
  assert.equal(structuredMatch(remote, w), true);
  delete remote.workout_doc.steps[0]._pace;
  assert.equal(structuredMatch(remote, w), false);
  remote.workout_doc.steps[0]._pace = { start: 3, end: 3.8 };
  assert.equal(structuredMatch(remote, w), false);
  remote.workout_doc.steps[0]._pace = { start: 1000 / 330, end: 1000 / 300 };
  remote.workout_doc.steps[0].hr = { value: 80 };
  assert.equal(structuredMatch(remote, w), false);
  w.steps[0].target = { mode: 'heart-rate', low: 135, high: 155 };
  assert.throws(() => intervalsWorkoutText(w), /BPM/);
});
void test('BPM direct send stops before any provider request or receipt write', async () => {
  const f = await fixture();
  f.w.steps[0].target = { mode: 'heart-rate', low: 135, high: 155 };
  f.sqlite
    .prepare('UPDATE athlete_state SET data=? WHERE owner=?')
    .run(JSON.stringify(f.state.plan), owner);
  const result = await outcome(f);
  assert.equal(result.status, 'rejected');
  assert.equal(result.error.status, 422);
  assert.match(result.error.message, /FIT/);
  assert.equal(f.calls.length, 0);
  assert.equal(
    f.sqlite.prepare('SELECT COUNT(*) AS n FROM deliveries').get().n,
    0,
  );
  f.sqlite.close();
});

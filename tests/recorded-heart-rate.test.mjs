// Measured heart-rate import contract; all persistence uses in-memory SQLite.
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
  owner = 'heart-rate-synthetic-owner',
  athlete = 'i900000000';
globalThis.heartRateTestEnv = {
  DB: null,
  STRIDE_ENCRYPTION_KEY: 'synthetic-round2-cipher-secret',
};
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'cloudflare:workers')
      return {
        url: 'data:text/javascript,export const env=globalThis.heartRateTestEnv;',
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
const { GET: activities } = await import(
  new URL('app/api/activities/route.ts', site)
);
const { POST: planRoute } = await import(
  new URL('app/api/plan/route.ts', site)
);
const { GET: exportRoute } = await import(
  new URL('app/api/export/route.ts', site)
);
const { readAccount } = await import(new URL('lib/accounts.ts', site));
const { encrypt, saveState, readState } = await import(
  new URL('lib/server.ts', site)
);
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
  globalThis.heartRateTestEnv.DB = {
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

const { normalizeActivity } = await import(
  new URL('lib/provider-activities.ts', site)
);
const { recordedHeartRate, validRecordedHeartRate } = await import(
  new URL('lib/recorded-heart-rate.ts', site)
);
const { trainingRecords } = await import(new URL('lib/run-records.ts', site));
const { validateRecovery } = await import(new URL('lib/recovery.ts', site));
const { validatePlan } = await import(new URL('lib/plan/validate.ts', site));
const { validateRun } = await import(new URL('lib/run-input.ts', site));
const { exportProgram } = await import(new URL('lib/program-export.ts', site));
const measured = { averageHeartRate: 154.5, maxHeartRate: 179 };
const providerSummary = { average_heartrate: 154.5, max_heartrate: 179 };
const fakeClient = { averageHeartRate: 220, maxHeartRate: 240 };

async function exportRecovery() {
  const response = await exportRoute(request('/api/export?format=recovery'));
  assert.equal(response.status, 200);
  return response.json();
}

test('provider summaries preserve measured bpm while missing, malformed and contradictory data stay unknown', () => {
  assert.deepEqual(
    recordedHeartRate(normalizeActivity(recording(providerSummary), athlete)),
    measured,
  );
  for (const values of [
    {},
    { average_heartrate: null, max_heartrate: null },
    { average_heartrate: 0, max_heartrate: 0 },
    { average_heartrate: '150', max_heartrate: '180' },
    { average_heartrate: NaN, max_heartrate: Infinity },
    { average_heartrate: -1, max_heartrate: 301 },
    { average_heartrate: 180, max_heartrate: 150 },
    { ...providerSummary, has_heartrate: false },
    { ...providerSummary, icu_ignore_hr: true },
    { hr_max: 190, hr_z2: 150, icu_resting_hr: 50 },
  ]) {
    const activity = normalizeActivity(recording(values), athlete);
    assert.ok(
      activity,
      'bad optional HR must not discard otherwise valid running',
    );
    assert.equal(activity.movingTime, 1801);
    assert.deepEqual(recordedHeartRate(activity), {}, JSON.stringify(values));
    assert.equal(Object.hasOwn(activity, 'averageHeartRate'), false);
    assert.equal(Object.hasOwn(activity, 'maxHeartRate'), false);
  }
  assert.deepEqual(
    recordedHeartRate(
      normalizeActivity(
        recording({ average_heartrate: 152, max_heartrate: 0 }),
        athlete,
      ),
    ),
    { averageHeartRate: 152 },
  );
  assert.deepEqual(
    recordedHeartRate(
      normalizeActivity(recording({ max_heartrate: 177 }), athlete),
    ),
    { maxHeartRate: 177 },
  );
});

test('verified completion survives correction, state reads, canonical ledger and recovery/program exports', async (t) => {
  const f = await fixture({
    connected: true,
    activities: [recording(providerSummary)],
  });
  t.after(() => f.sqlite.close());
  const listed = await activities(request('/api/activities'));
  assert.equal(listed.status, 200);
  assert.deepEqual(
    recordedHeartRate((await listed.json()).activities[0]),
    measured,
  );
  const plan = makePlan(activeProfile(), today);
  await saveState(owner, 0, plan, 'Synthetic HR fixture', 0);
  const workout = plan.workouts.find((w) => w.date === today);
  assert.ok(workout);
  const originalSteps = JSON.stringify(workout.steps);
  const imported = await planAction({
    action: 'complete',
    version: 1,
    id: workout.id,
    feedback: feedback(fakeClient),
  });
  assert.equal(imported.status, 200, JSON.stringify(imported.data));
  const log = imported.data.plan.workouts.find(
    (w) => w.id === workout.id,
  ).feedback;
  assert.deepEqual(recordedHeartRate(log), measured);
  const corrected = await planAction({
    action: 'correctLog',
    version: 2,
    id: workout.id,
    correctionReason: 'Corrected pause duration',
    feedback: { ...log, actualMinutes: 35, ...fakeClient },
  });
  assert.equal(corrected.status, 200, JSON.stringify(corrected.data));
  const current = await readState(owner);
  const saved = current.plan.workouts.find((w) => w.id === workout.id);
  assert.deepEqual(recordedHeartRate(saved.feedback), measured);
  assert.equal(saved.feedback.actualMinutes, 35);
  assert.equal(JSON.stringify(saved.steps), originalSteps);
  assert.deepEqual(
    recordedHeartRate(trainingRecords(current.plan)[0]),
    measured,
  );
  assert.deepEqual(validatePlan(current.plan), []);
  const recovered = validateRecovery(await exportRecovery());
  assert.deepEqual(
    recordedHeartRate(
      recovered.plan.workouts.find((w) => w.id === workout.id).feedback,
    ),
    measured,
  );
  const exported = exportProgram(current.plan)
    .weeks.flatMap((week) => week.days)
    .flatMap((day) => day.sessions)
    .find((session) => session.id === workout.id);
  assert.equal(
    exported.recorded.average_heart_rate_bpm,
    measured.averageHeartRate,
  );
  assert.equal(exported.recorded.max_heart_rate_bpm, measured.maxHeartRate);
  const revision = JSON.parse(
    f.sqlite
      .prepare('SELECT data FROM revisions WHERE owner=? AND version=2')
      .get(owner).data,
  );
  assert.equal(
    revision.workouts.find((w) => w.id === workout.id).feedback.actualMinutes,
    1801 / 60,
  );
  assert.deepEqual(
    recordedHeartRate(
      revision.workouts.find((w) => w.id === workout.id).feedback,
    ),
    measured,
  );
});

for (const activePlan of [false, true])
  test(`verified ${activePlan ? 'plan extra' : 'standalone'} runs preserve HR through correction and export`, async (t) => {
    const f = await fixture({
      connected: true,
      activities: [recording(providerSummary)],
    });
    t.after(() => f.sqlite.close());
    if (activePlan)
      await saveState(
        owner,
        0,
        makePlan(activeProfile(), today),
        'Synthetic HR fixture',
        0,
      );
    const imported = await planAction({
      action: 'freeRun',
      version: activePlan ? 1 : 0,
      run: run(fakeClient),
    });
    assert.equal(imported.status, 200, JSON.stringify(imported.data));
    const entry = activePlan
      ? imported.data.plan.extraRuns[0]
      : imported.data.standaloneRuns[0];
    assert.deepEqual(recordedHeartRate(entry), measured);
    const corrected = await planAction({
      action: 'correctExtra',
      version: imported.data.version,
      id: entry.id,
      correctionReason: 'Corrected distance entry',
      run: { ...entry, km: 5.5, ...fakeClient },
    });
    assert.equal(corrected.status, 200, JSON.stringify(corrected.data));
    const current = await readState(owner);
    const saved = activePlan
      ? trainingRecords(current.plan)[0]
      : current.standaloneRuns[0];
    assert.equal(saved.km, 5.5);
    assert.deepEqual(recordedHeartRate(saved), measured);
    const recovered = validateRecovery(await exportRecovery());
    assert.deepEqual(
      recordedHeartRate(
        activePlan ? recovered.plan.extraRuns[0] : recovered.standaloneRuns[0],
      ),
      measured,
    );
  });

for (const target of ['workout', 'extra'])
  for (const hasHeartRate of [true, false])
    test(`attaching to a manual ${target} ${hasHeartRate ? 'replaces old HR with provider measurements' : 'clears old HR when the provider has none'}`, async (t) => {
      const f = await fixture({
        connected: true,
        activities: [recording(hasHeartRate ? providerSummary : {})],
      });
      t.after(() => f.sqlite.close());
      const plan = makePlan(activeProfile(), today);
      const workout = plan.workouts.find((w) => w.date === today);
      let id;
      if (target === 'workout') {
        id = workout.id;
        workout.status = 'completed';
        workout.feedback = feedback({
          ...fakeClient,
          activityId: undefined,
          actualMinutes: 30,
          actualKm: 5,
          source: 'Manual',
          recordedAt: `${today}T12:00:00Z`,
        });
      } else {
        id = 'manual-extra';
        plan.extraRuns = [
          {
            ...run({
              ...fakeClient,
              activityId: undefined,
              minutes: 30,
              km: 5,
              source: 'Manual',
            }),
            id,
            recordedAt: `${today}T12:00:00Z`,
          },
        ];
      }
      await saveState(owner, 0, plan, 'Manual fixture', 0);
      const attached = await planAction({
        action: 'attachRecording',
        version: 1,
        id,
        run: run(fakeClient),
      });
      assert.equal(attached.status, 200, JSON.stringify(attached.data));
      const saved = trainingRecords((await readState(owner)).plan).find(
        (record) => record.id === id,
      );
      assert.deepEqual(recordedHeartRate(saved), hasHeartRate ? measured : {});
      assert.equal(Object.hasOwn(saved, 'averageHeartRate'), hasHeartRate);
      assert.equal(Object.hasOwn(saved, 'maxHeartRate'), hasHeartRate);
      assert.equal(saved.note, 'Synthetic review');
      assert.equal(saved.activityId, athlete + ':run-1');
    });

test('unmeasured imports and manual completion never inherit client HR or prescribed heart-rate targets', async (t) => {
  const f = await fixture({
    connected: true,
    activities: [recording({ average_heartrate: 0, max_heartrate: 0 })],
  });
  t.after(() => f.sqlite.close());
  const plan = makePlan(activeProfile(), today);
  const workout = plan.workouts.find((w) => w.date === today);
  await saveState(owner, 0, plan, 'Synthetic HR fixture', 0);
  const imported = await planAction({
    action: 'freeRun',
    version: 1,
    run: run(fakeClient),
  });
  assert.equal(imported.status, 200, JSON.stringify(imported.data));
  assert.deepEqual(recordedHeartRate(imported.data.plan.extraRuns[0]), {});
  const manual = await planAction({
    action: 'complete',
    version: 2,
    id: workout.id,
    feedback: feedback({
      activityId: undefined,
      actualMinutes: 30,
      actualKm: 5,
      ...fakeClient,
    }),
  });
  assert.equal(manual.status, 200, JSON.stringify(manual.data));
  assert.deepEqual(
    recordedHeartRate(
      manual.data.plan.workouts.find((w) => w.id === workout.id).feedback,
    ),
    {},
  );
  assert.deepEqual(
    recordedHeartRate({ target: { mode: 'heart-rate', low: 140, high: 165 } }),
    {},
  );
});

test('stored and restored HR reject malformed numbers and contradictions while legacy records remain valid', () => {
  const legacy = run({
    id: 'legacy',
    activityId: undefined,
    minutes: 30,
    km: 5,
    recordedAt: `${today}T12:00:00Z`,
  });
  assert.equal(validRecordedHeartRate(legacy), true);
  assert.deepEqual(recordedHeartRate(validateRun(legacy, today)), {});
  const file = {
    format: 'stride-recovery-2',
    exportedAt: `${today}T12:00:00Z`,
    profile: null,
    plan: null,
    standaloneRuns: [legacy],
  };
  assert.doesNotThrow(() => validateRecovery(file));
  for (const invalid of [
    { averageHeartRate: null },
    { averageHeartRate: '150' },
    { maxHeartRate: 0 },
    { averageHeartRate: NaN },
    { maxHeartRate: Infinity },
    { maxHeartRate: -1 },
    { maxHeartRate: 301 },
    { averageHeartRate: 190, maxHeartRate: 160 },
  ]) {
    assert.equal(validRecordedHeartRate(invalid), false);
    assert.throws(
      () => validateRun({ ...legacy, ...invalid }, today),
      /heart rate/,
    );
    assert.throws(
      () =>
        validateRecovery({
          ...file,
          standaloneRuns: [{ ...legacy, ...invalid }],
        }),
      /heart rate/,
    );
  }
});

test('plan recovery validates measured summaries on both completed workouts and extra runs', () => {
  for (const target of ['workout', 'extra']) {
    const plan = makePlan(activeProfile(), today);
    const workout = plan.workouts.find((w) => w.date === today);
    const invalid = { averageHeartRate: 180, maxHeartRate: 150 };
    if (target === 'workout') {
      workout.status = 'completed';
      workout.feedback = feedback({
        activityId: undefined,
        actualMinutes: 30,
        actualKm: 5,
        recordedAt: `${today}T12:00:00Z`,
        ...invalid,
      });
    } else {
      plan.extraRuns = [
        {
          ...run({ activityId: undefined, minutes: 30, km: 5 }),
          id: 'extra',
          recordedAt: `${today}T12:00:00Z`,
          ...invalid,
        },
      ];
    }
    assert.ok(
      validatePlan(plan).includes('Invalid recorded heart-rate summary.'),
    );
    assert.throws(
      () =>
        validateRecovery({
          format: 'stride-recovery-2',
          exportedAt: `${today}T12:00:00Z`,
          profile: null,
          plan,
        }),
      /heart-rate/,
    );
  }
});

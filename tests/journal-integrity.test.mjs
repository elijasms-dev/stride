import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fixture,
  owner,
  today,
  run,
  feedback,
  record,
  time,
  readAccount,
  readState,
  journalMutation,
  normalizeActivity,
  validateRun,
  validateRecovery,
  trainingRecords,
  recovery,
  demoProfile,
} from './journal-integrity-fixture.mjs';
import { createOfflineJournal, replayPending } from '../lib/offline-journal.ts';

test('lost-response free-run retry returns the same record, receipt and latest state without a second write', async (t) => {
  const f = await fixture(t);
  const payload = {
    action: 'freeRun',
    version: 0,
    mutationId: crypto.randomUUID(),
    run: run(),
  };
  const first = await f.action(payload);
  assert.equal(first.status, 200, JSON.stringify(first.data));
  const revision = (await readAccount(owner)).revision;
  const second = await f.action({ ...payload, version: 999 });
  assert.equal(second.status, 200);
  assert.deepEqual(second.data.standaloneRuns, first.data.standaloneRuns);
  assert.equal(second.data.acknowledgedMutationId, payload.mutationId);
  assert.equal((await readAccount(owner)).revision, revision);
  const receipt = f.db.prepare('SELECT * FROM journal_mutations').get();
  assert.equal(receipt.id, payload.mutationId);
  assert.ok(!JSON.stringify(receipt).includes('private-note'));
  const conflict = await f.action({ ...payload, run: run({ km: 7 }) });
  assert.equal(conflict.status, 409);
  assert.equal(conflict.data.code, 'MUTATION_CONFLICT');
  assert.equal((await readState(owner)).standaloneRuns.length, 1);
});

test('concurrent copies and changed-payload races commit only once', async (t) => {
  const f = await fixture(t);
  const payload = {
    action: 'freeRun',
    version: 0,
    mutationId: crypto.randomUUID(),
    run: run(),
  };
  const result = await Promise.all([f.action(payload), f.action(payload)]);
  assert.deepEqual(
    result.map((r) => r.status),
    [200, 200],
  );
  assert.equal((await readState(owner)).standaloneRuns.length, 1);
  const changed = { ...payload, mutationId: crypto.randomUUID() };
  const race = await Promise.all([
    f.action(changed),
    f.action({ ...changed, run: run({ minutes: 45 }) }),
  ]);
  assert.deepEqual(race.map((r) => r.status).sort(), [200, 409]);
  assert.equal((await readState(owner)).standaloneRuns.length, 2);
});

test('mutation identities are scoped to account and epoch, with stale-account writes rejected', async (t) => {
  const f = await fixture(t);
  const payload = {
    action: 'freeRun',
    version: 0,
    mutationId: crypto.randomUUID(),
    run: run(),
  };
  assert.equal((await f.action(payload)).status, 200);
  await readAccount('other');
  assert.equal((await f.action(payload, 'other')).status, 200);
  assert.equal((await readState('other')).standaloneRuns.length, 1);
  f.db.prepare('UPDATE accounts SET epoch=1 WHERE owner=?').run(owner);
  const stale = await f.action(payload);
  assert.equal(stale.status, 409);
  assert.equal(stale.data.code, 'ACCOUNT_CONTEXT_CHANGED');
});

test('failure before transactional completion rolls back both run and receipt and permits safe retry', async (t) => {
  const f = await fixture(t);
  f.db.exec(
    "CREATE TRIGGER fail_receipt BEFORE INSERT ON journal_mutations BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END",
  );
  const payload = {
    action: 'freeRun',
    version: 0,
    mutationId: crypto.randomUUID(),
    run: run(),
  };
  const first = await f.action(payload);
  assert.equal(first.status, 500);
  assert.equal((await readState(owner)).standaloneRuns.length, 0);
  assert.equal((await readAccount(owner)).revision, 0);
  f.db.exec('DROP TRIGGER fail_receipt');
  assert.equal((await f.action(payload)).status, 200);
});

test('active-plan free runs and completed/corrected workouts acknowledge retries before stale-version validation', async (t) => {
  const f = await fixture(t),
    plan = await f.seedPlan();
  const extra = {
    action: 'freeRun',
    version: 1,
    mutationId: crypto.randomUUID(),
    run: run(),
  };
  const first = await f.action(extra);
  assert.equal(first.status, 200, JSON.stringify(first.data));
  assert.equal((await f.action(extra)).status, 200);
  assert.equal((await readState(owner)).plan.extraRuns.length, 1);
  const w = plan.workouts.find((w) => w.date <= today);
  const done = {
    action: 'complete',
    version: 2,
    mutationId: crypto.randomUUID(),
    id: w.id,
    feedback: feedback({ actualDate: w.date }),
  };
  assert.equal((await f.action(done)).status, 200);
  assert.equal((await f.action(done)).status, 200);
  const corrected = {
    ...done,
    action: 'correctLog',
    version: 3,
    mutationId: crypto.randomUUID(),
    feedback: feedback({ actualDate: w.date, actualMinutes: 45 }),
    correctionReason: 'Timer correction',
  };
  const correction = await f.action(corrected);
  assert.equal(correction.status, 200, JSON.stringify(correction.data));
  assert.equal((await f.action(corrected)).status, 200);
  const replay = await f.action(done);
  assert.equal(replay.status, 200);
  assert.equal(
    replay.data.version,
    4,
    'replay returns current journal, not stale original snapshot',
  );
  assert.equal(
    replay.data.plan.workouts.find((x) => x.id === w.id).feedback.actualMinutes,
    45,
  );
});

test('legacy clients remain accepted; invalid id and mismatched manual totals do not mutate the journal', async (t) => {
  const f = await fixture(t);
  assert.equal(
    (await f.action({ action: 'freeRun', version: 0, run: run() })).status,
    200,
  );
  assert.equal(
    (
      await f.action({
        action: 'freeRun',
        version: 0,
        mutationId: 'bad-id',
        run: run(),
      })
    ).status,
    400,
  );
  for (const minutes of [2 / 60, 1, 2]) {
    const bad = await f.action({
      action: 'freeRun',
      version: 0,
      mutationId: crypto.randomUUID(),
      run: run({ minutes, km: 100 }),
    });
    assert.equal(bad.status, 422);
  }
  assert.equal((await readState(owner)).standaloneRuns.length, 1);
});

test('plausibility bounds admit elite sprint summaries, ultra hiking, missing distance and ordinary running', () => {
  for (const values of [
    { minutes: 1, km: 0.7 },
    { minutes: 27, km: 10 },
    { minutes: 120, km: 42.195 },
    { minutes: 4320, km: 250 },
    { minutes: 200, km: 1 },
    { minutes: 20, km: null },
  ])
    assert.doesNotThrow(() => validateRun(run(values), today));
  assert.equal(
    normalizeActivity(record({ type: 'Ride' }), 'athlete'),
    null,
    'a cycling summary cannot become running evidence',
  );
  assert.equal(
    normalizeActivity(record({ moving_time: 2, distance: 100000 }), 'athlete'),
    null,
  );
  assert.equal(
    normalizeActivity(record({ moving_time: 60, distance: 100000 }), 'athlete'),
    null,
  );
  assert.equal(
    normalizeActivity(
      record({ start_date_local: today + 'T99:99:00' }),
      'athlete',
    ),
    null,
  );
});

test('provider timestamps survive saving, corrections, activation and recovery while bad provider records are excluded', async (t) => {
  const f = await fixture(t);
  await f.connect();
  const payload = {
    action: 'freeRun',
    version: 0,
    mutationId: crypto.randomUUID(),
    run: run({ activityId: 'athlete:record-1', km: 99, minutes: 99 }),
  };
  const first = await f.action(payload);
  assert.equal(first.status, 200, JSON.stringify(first.data));
  const saved = first.data.standaloneRuns[0];
  const expected = time(normalizeActivity(record(), 'athlete'));
  assert.deepEqual(time(saved), expected);
  assert.equal(
    saved.km,
    6,
    'untrusted client summary is replaced by validated provider facts',
  );
  const corrected = {
    action: 'correctExtra',
    version: 0,
    mutationId: crypto.randomUUID(),
    id: saved.id,
    correctionReason: 'Corrected effort',
    run: { ...saved, effort: 5 },
  };
  assert.equal((await f.action(corrected)).status, 200);
  assert.equal((await f.action(corrected)).status, 200);
  const current = await readState(owner);
  const restored = validateRecovery({
    format: 'stride-recovery-2',
    exportedAt: new Date().toISOString(),
    profile: null,
    plan: null,
    standaloneRuns: current.standaloneRuns,
  });
  assert.deepEqual(time(restored.standaloneRuns[0]), expected);
  const activation = await f.action({
    action: 'activate',
    version: 0,
    requestId: crypto.randomUUID(),
    profile: { ...demoProfile(today), timezone: 'UTC' },
  });
  assert.equal(activation.status, 200, JSON.stringify(activation.data));
  assert.deepEqual(time(activation.data.plan.extraRuns[0]), expected);
  const badFile = {
    ...restored,
    standaloneRuns: [
      { ...restored.standaloneRuns[0], startUtc: today + 'T09:00:00' },
    ],
  };
  assert.throws(() => validateRecovery(badFile), /start time/);
});

test('completed imports and later attachment preserve activity timing in canonical records and backups', async (t) => {
  const f = await fixture(t),
    plan = await f.seedPlan();
  await f.connect();
  const w = plan.workouts.find((w) => w.date <= today);
  const done = {
    action: 'complete',
    version: 1,
    mutationId: crypto.randomUUID(),
    id: w.id,
    feedback: feedback(),
  };
  assert.equal((await f.action(done)).status, 200);
  const attach = {
    action: 'attachRecording',
    version: 2,
    mutationId: crypto.randomUUID(),
    id: w.id,
    run: run({ activityId: 'athlete:record-1' }),
  };
  const result = await f.action(attach);
  assert.equal(result.status, 200, JSON.stringify(result.data));
  assert.equal((await f.action(attach)).status, 200);
  const expected = time(normalizeActivity(record(), 'athlete'));
  assert.deepEqual(
    time(result.data.plan.workouts.find((x) => x.id === w.id).feedback),
    expected,
  );
  assert.deepEqual(time(trainingRecords(result.data.plan)[0]), expected);
  const file = validateRecovery({
    format: 'stride-recovery-2',
    exportedAt: new Date().toISOString(),
    profile: null,
    plan: result.data.plan,
    standaloneRuns: [],
  });
  assert.deepEqual(
    time(file.plan.workouts.find((x) => x.id === w.id).feedback),
    expected,
  );
});

test('account deletion clears mutation receipts and stale retries cannot recreate deleted activity', async (t) => {
  const f = await fixture(t);
  const payload = {
    action: 'freeRun',
    version: 0,
    mutationId: crypto.randomUUID(),
    run: run(),
  };
  assert.equal((await f.action(payload)).status, 200);
  const preview = await (
    await recovery(f.request({ action: 'preview', kind: 'delete' }))
  ).json();
  assert.ok(preview.id);
  const committed = await recovery(
    f.request({
      action: 'commit',
      kind: 'delete',
      id: preview.id,
      confirm: 'DELETE',
    }),
  );
  assert.equal(committed.status, 200);
  assert.equal(
    f.db.prepare('SELECT count(*) AS n FROM journal_mutations').get().n,
    0,
  );
  assert.equal((await f.action(payload)).status, 409);
});

test('payload hashing ignores property order and transport version, but covers semantic changes', async () => {
  const mutationId = crypto.randomUUID();
  const a = await journalMutation({
    mutationId,
    version: 1,
    action: 'freeRun',
    run: { km: 6, minutes: 40 },
  });
  const b = await journalMutation({
    run: { minutes: 40, km: 6 },
    action: 'freeRun',
    version: 2,
    mutationId,
  });
  assert.deepEqual(a, b);
  const c = await journalMutation({
    mutationId,
    version: 1,
    action: 'freeRun',
    run: { km: 7, minutes: 40 },
  });
  assert.notEqual(a.requestHash, c.requestHash);
});

test('actual device outbox recovers a committed but lost response and rebases only its own sequential saves', async (t) => {
  for (const withPlan of [false, true]) {
    await t.test(withPlan ? 'active plan' : 'pre-plan journal', async (t) => {
      const f = await fixture(t);
      if (withPlan) await f.seedPlan();
      const account = await readAccount(owner),
        scope = `${account.account_id}:${account.epoch}`;
      let stored = null;
      const store = async (change) => {
        if (change) stored = structuredClone(change(stored));
        return structuredClone(stored);
      };
      const journal = createOfflineJournal(store);
      await journal.bind(scope);
      for (const km of [6, 7]) {
        const id = crypto.randomUUID();
        await journal.enqueue(scope, {
          id,
          createdAt: new Date().toISOString(),
          status: 'pending',
          body: {
            mutationId: id,
            action: 'freeRun',
            version: withPlan ? 1 : 0,
            run: run({ km }),
          },
        });
      }
      let loseResponse = true;
      const request = async (path, options) => {
        if (path === '/api/account')
          return { accountId: account.account_id, accountEpoch: account.epoch };
        const response = await f.action(JSON.parse(options.body));
        if (response.status !== 200) throw new Error(response.data.error);
        if (loseResponse) {
          loseResponse = false;
          throw new TypeError('Synthetic network loss after commit');
        }
        return response.data;
      };
      assert.equal(
        await replayPending(
          journal,
          scope,
          request,
          (error) => error instanceof TypeError,
        ),
        0,
      );
      assert.equal((await journal.read()).pending.length, 2);
      const restarted = createOfflineJournal(store);
      assert.equal(
        await replayPending(
          restarted,
          scope,
          request,
          (error) => error instanceof TypeError,
        ),
        2,
      );
      assert.equal((await restarted.read()).pending.length, 0);
      const state = await readState(owner);
      assert.equal((state.plan?.extraRuns ?? state.standaloneRuns).length, 2);
      assert.deepEqual(
        (state.plan?.extraRuns ?? state.standaloneRuns).map((r) => r.km).sort(),
        [6, 7],
      );
      assert.equal(state.version, withPlan ? 3 : 0);
    });
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createOfflineJournal, replayPending } from '../lib/offline-journal.ts';
const scope = 'runner-A:1';
const identity = { accountId: 'runner-A', accountEpoch: 1 };
const cmd = (id = 'one', action = 'freeRun') => ({
  id,
  createdAt: '2026-09-24T10:00:00Z',
  status: 'pending',
  body: {
    action,
    version: 3,
    mutationId: id,
    run: { date: '2026-09-24', minutes: 30, km: 5 },
  },
});
async function fixture() {
  let value = null;
  const journal = createOfflineJournal(async (change) => {
    if (change) value = change(structuredClone(value));
    return structuredClone(value);
  });
  await journal.bind(scope);
  return journal;
}
test('device plan caching is opt-in and account/epoch changes clear old data', async () => {
  const journal = await fixture();
  await journal.snapshot(scope, { plan: 'private' });
  assert.equal((await journal.read()).snapshot, null);
  await journal.enable(scope, { plan: 'private' });
  await journal.enqueue(scope, cmd());
  await journal.bind('runner-A:2');
  assert.deepEqual((await journal.read()).pending, []);
  assert.equal((await journal.read()).snapshot, null);
  await assert.rejects(journal.enqueue(scope, cmd()), /Refresh this account/);
});
test('removing the offline plan preserves unconfirmed run entries', async () => {
  const journal = await fixture();
  await journal.enable(scope, { plan: 'private' });
  await journal.enqueue(scope, cmd());
  await journal.disable(scope);
  assert.equal((await journal.read()).snapshot, null);
  assert.equal((await journal.read()).pending.length, 1);
});
test('duplicate queue insertion is idempotent and a changed payload is rejected', async () => {
  const journal = await fixture();
  await journal.enqueue(scope, cmd());
  await journal.enqueue(scope, cmd());
  const changed = cmd();
  changed.body.run.km = 10;
  await assert.rejects(journal.enqueue(scope, changed), /cannot be changed/);
  assert.equal((await journal.read()).pending.length, 1);
});
test('offline queue rejects non-logging side effects and bounds local growth', async () => {
  const journal = await fixture();
  await assert.rejects(
    journal.enqueue(scope, cmd('x', 'sync')),
    /requires a connection/,
  );
  for (let i = 0; i < 100; i++) await journal.enqueue(scope, cmd(String(i)));
  await assert.rejects(
    journal.enqueue(scope, cmd('overflow')),
    /Sync your pending/,
  );
});
test('lost response retries the same mutation and removes it only after exact acknowledgement', async () => {
  const journal = await fixture();
  await journal.enqueue(scope, cmd());
  const server = new Set();
  let loseResponse = true;
  const bodies = [];
  const request = async (path, init) => {
    if (path === '/api/account') return identity;
    const body = JSON.parse(init.body);
    bodies.push(body);
    server.add(body.mutationId);
    if (loseResponse) throw new TypeError('connection dropped after commit');
    return { acknowledgedMutationId: body.mutationId };
  };
  assert.equal(
    await replayPending(journal, scope, request, (e) => e instanceof TypeError),
    0,
  );
  assert.equal((await journal.read()).pending.length, 1);
  loseResponse = false;
  assert.equal(
    await replayPending(journal, scope, request, (e) => e instanceof TypeError),
    1,
  );
  assert.equal(server.size, 1);
  assert.deepEqual(bodies[0], bodies[1]);
  assert.equal((await journal.read()).pending.length, 0);
});
test('replay verifies current identity before any write', async () => {
  const journal = await fixture();
  await journal.enqueue(scope, cmd());
  let posts = 0;
  await assert.rejects(
    replayPending(
      journal,
      scope,
      async (path) => {
        if (path !== '/api/account') posts++;
        return { ...identity, accountEpoch: 2 };
      },
      () => false,
    ),
    /different account/,
  );
  assert.equal(posts, 0);
  assert.equal((await journal.read()).pending.length, 1);
});
test('a conflict stops ordered replay and waits for explicit review', async () => {
  const journal = await fixture();
  await journal.enqueue(scope, cmd());
  await journal.enqueue(scope, cmd('two'));
  let attempts = 0;
  const request = async (path) => {
    if (path === '/api/account') return identity;
    attempts++;
    throw new Error('Journal version changed');
  };
  await replayPending(journal, scope, request, () => false);
  await replayPending(journal, scope, request, () => false);
  assert.equal(attempts, 1);
  assert.equal((await journal.read()).pending[0].status, 'review');
  await journal.retryReviewed(scope, 'one', 9);
  const pending = (await journal.read()).pending;
  assert.equal(pending[0].body.version, 9);
  assert.equal(pending[0].id, 'one');
  assert.equal(pending[1].body.version, 3);
});
test('an unacknowledged success never drops the local save', async () => {
  const journal = await fixture();
  await journal.enqueue(scope, cmd());
  await replayPending(
    journal,
    scope,
    async (path) => (path === '/api/account' ? identity : { ok: true }),
    () => false,
  );
  assert.equal((await journal.read()).pending[0].status, 'review');
});
test('storage failure is reported rather than claimed as a durable save', async () => {
  const journal = createOfflineJournal(async () => {
    throw new Error('quota');
  });
  await assert.rejects(journal.enqueue(scope, cmd()), /quota/);
});
test('service worker only caches public offline assets and never intercepts API/auth/export responses', async () => {
  const handlers = {};
  const scope = {
    self: {
      location: { origin: 'https://stride.test' },
      addEventListener: (name, fn) => {
        handlers[name] = fn;
      },
    },
    URL,
    fetch: async () => {
      throw new Error('offline');
    },
    caches: { match: async (path) => ({ path }) },
  };
  vm.runInNewContext(
    readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'),
    scope,
  );
  for (const path of ['/api/state', '/api/export', '/api/account', '/login']) {
    let intercepted = false;
    handlers.fetch({
      request: {
        url: `https://stride.test${path}`,
        method: 'GET',
        mode: 'navigate',
      },
      respondWith: () => {
        intercepted = true;
      },
    });
    assert.equal(intercepted, false, path);
  }
  let result;
  handlers.fetch({
    request: {
      url: 'https://stride.test/?view=plan',
      method: 'GET',
      mode: 'navigate',
    },
    respondWith: (promise) => {
      result = promise;
    },
  });
  assert.equal((await result).path, '/offline.html');
});
test('queued commands advance only through their own consecutively acknowledged revisions', async () => {
  const journal = await fixture();
  await journal.enqueue(scope, cmd('one'));
  await journal.enqueue(scope, cmd('two'));
  const bodies = [];
  assert.equal(
    await replayPending(
      journal,
      scope,
      async (path, init) => {
        if (path === '/api/account') return identity;
        const body = JSON.parse(init.body);
        bodies.push(body);
        return {
          acknowledgedMutationId: body.mutationId,
          version: body.version + 1,
        };
      },
      () => false,
    ),
    2,
  );
  assert.deepEqual(
    bodies.map((body) => body.version),
    [3, 4],
  );
});
test('a receipt readback that includes unrelated revisions does not rebase other entries', async () => {
  const journal = await fixture();
  await journal.enqueue(scope, cmd('one'));
  await journal.enqueue(scope, cmd('two'));
  await journal.acknowledge(scope, 'one', 9);
  assert.equal((await journal.read()).pending[0].body.version, 3);
});

test('a stale account invalidation cannot erase the newly active account pending saves', async () => {
  let state = null;
  const journal = createOfflineJournal(async (change) => {
    if (change) state = change(state);
    return structuredClone(state);
  });
  await journal.bind('runner-A:1');
  await journal.bind('runner-B:1');
  await journal.enable('runner-B:1', { version: 1, plan: 'B private plan' });
  await journal.enqueue('runner-B:1', cmd());
  await journal.invalidateScope('runner-A:1');
  assert.equal((await journal.read()).scope, 'runner-B:1');
  assert.equal((await journal.read()).pending.length, 1);
  await journal.invalidateScope('');
  assert.equal((await journal.read()).pending.length, 1);
  await journal.invalidateScope('runner-B:1');
  assert.equal(await journal.read(), null);
});

test('a late identity preflight cannot replace a newer account vault or lose its pending saves', async () => {
  let state = null;
  const journal = createOfflineJournal(async (change) => {
    if (change) state = change(state);
    return structuredClone(state);
  });
  // Both tabs start authentication while there is no local journal.
  const beforeA = await journal.read(),
    beforeB = await journal.read();
  await journal.bind('runner-B:1', beforeB?.scope ?? null);
  await journal.enqueue('runner-B:1', cmd());
  // A returns after B has confirmed and stored a pending run.
  await assert.rejects(
    journal.bind('runner-A:1', beforeA?.scope ?? null),
    /Another account/,
  );
  assert.equal((await journal.read()).scope, 'runner-B:1');
  assert.equal((await journal.read()).pending.length, 1);
  // Rebinding the same epoch is harmless, even from an older preflight.
  await journal.bind('runner-B:1', null);
  assert.equal((await journal.read()).pending.length, 1);
  const beforeEpochChange = await journal.read();
  await journal.bind('runner-B:2', beforeEpochChange.scope);
  await assert.rejects(
    journal.bind('runner-B:1', beforeEpochChange.scope),
    /Another account/,
  );
  assert.equal((await journal.read()).scope, 'runner-B:2');
});
const { prepareOfflineShell } = await import('../lib/offline-shell.ts');
test('offline access waits for installation instead of treating registration as readiness', async () => {
  let activate;
  const ready = new Promise((resolve) => {
    activate = resolve;
  });
  let installed = false;
  const operation = prepareOfflineShell(
    { register: async () => ({}), ready },
    1000,
  ).then(() => {
    installed = true;
  });
  await Promise.resolve();
  assert.equal(installed, false);
  activate({ active: true });
  await operation;
  assert.equal(installed, true);
});
test('unsupported or stalled shell installation cannot claim offline access', async () => {
  await assert.rejects(prepareOfflineShell(undefined), /cannot reopen/);
  await assert.rejects(
    prepareOfflineShell(
      { register: async () => ({}), ready: new Promise(() => {}) },
      1,
    ),
    /not ready/,
  );
});

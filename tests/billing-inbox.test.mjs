import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import Stripe from 'stripe';
const root = new URL('../', import.meta.url);
globalThis.billingInboxEnv = {};
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'cloudflare:workers')
      return {
        url: 'data:text/javascript,export const env=globalThis.billingInboxEnv;',
        shortCircuit: true,
      };
    if (context.parentURL?.startsWith(root.href)) {
      const base = specifier.startsWith('@/')
        ? new URL(specifier.slice(2), root)
        : specifier.startsWith('.')
          ? new URL(specifier, context.parentURL)
          : null;
      if (base)
        for (const suffix of ['', '.ts', '.tsx'])
          if (existsSync(new URL(base.href + suffix)))
            return { url: base.href + suffix, shortCircuit: true };
    }
    return next(specifier, context);
  },
});
const {
  enqueueBillingEvent,
  processBillingInbox,
  readSandboxEntitlement,
  queueBillingReconciliation,
  retryBillingEvent,
} = await import('../lib/billing-store.ts');
const { sandboxBillingRuntime } = await import('../lib/billing-runtime.ts');
const { readAccount } = await import('../lib/accounts.ts');
const { POST: webhook } = await import('../app/api/billing/webhook/route.ts');
const { POST: processor } = await import('../app/api/billing/process/route.ts');
const { GET: entitlement } = await import('../app/api/billing/route.ts');
const signingSecret = 'whsec_synthetic_fixture_only';
const machineToken = 'synthetic-machine-token-not-a-real-secret-123456';
let upstream;
globalThis.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  assert.equal(
    url.origin,
    'https://api.stripe.com',
    'Only intercepted synthetic Stripe URLs allowed',
  );
  if (!upstream) throw new Error('No real provider access permitted');
  return upstream(url, init);
};
function fixture(t) {
  upstream = null;
  const sqlite = new DatabaseSync(':memory:');
  for (const file of readdirSync(new URL('drizzle/', root))
    .filter((file) => /^\d+.*\.sql$/.test(file))
    .sort())
    sqlite.exec(readFileSync(new URL(`drizzle/${file}`, root), 'utf8'));
  const prepare = (sql, values = []) => {
    const execute = () => {
      const r = sqlite.prepare(sql).run(...values);
      return {
        success: true,
        meta: {
          changes: Number(r.changes),
          last_row_id: Number(r.lastInsertRowid),
        },
      };
    };
    return {
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
      run: async () => execute(),
      execute,
    };
  };
  Object.assign(globalThis.billingInboxEnv, {
    DB: {
      prepare,
      batch: async (statements) => {
        sqlite.exec('BEGIN');
        try {
          const results = statements.map((statement) => statement.execute());
          sqlite.exec('COMMIT');
          return results;
        } catch (e) {
          sqlite.exec('ROLLBACK');
          throw e;
        }
      },
    },
    STRIDE_BILLING_MODE: 'sandbox',
    STRIPE_TEST_SECRET_KEY: 'sk_test_synthetic_fixture_only',
    STRIPE_TEST_PRICE_ID: 'price_synthetic',
    STRIDE_BILLING_ORIGIN: 'https://stride.test',
    STRIPE_TEST_WEBHOOK_SECRET: signingSecret,
    STRIDE_BILLING_PROCESS_TOKEN: machineToken,
    STRIDE_BILLING_GRACE_SECONDS: '0',
  });
  t.after(() => sqlite.close());
  let now = Math.floor(Date.now() / 1000);
  return {
    sqlite,
    clock: () => now,
    advance: (n) => {
      now += n;
    },
  };
}
async function context(t) {
  const f = fixture(t),
    a = await readAccount('synthetic-billing-owner');
  const account = {
    accountId: a.account_id,
    epoch: a.epoch,
    customerId: 'cus_A',
    subscriptionId: 'sub_A',
  };
  const snapshot = {
    id: 'sub_A',
    customerId: 'cus_A',
    status: 'active',
    periodEnd: f.clock() + 86400,
    cancelAtPeriodEnd: false,
    livemode: false,
  };
  return {
    ...f,
    a,
    account,
    snapshot,
    reader: { discoverSubscription: async () => ({ account, snapshot }) },
  };
}
const event = (id = 'evt_A', created = 1000, status = 'canceled') => ({
  id,
  object: 'event',
  created,
  livemode: false,
  type: 'customer.subscription.updated',
  data: { object: { id: 'sub_A', status } },
});
const queue = (e = event(), now) =>
  enqueueBillingEvent(e, 'synthetic-payload-hash', now);
const readEvent = (f, id = 'evt_A') =>
  f.sqlite.prepare('SELECT * FROM billing_events WHERE id=?').get(id);
const readSub = (f) =>
  f.sqlite
    .prepare('SELECT * FROM billing_subscriptions WHERE id=?')
    .get('sub_A');
const apply = (f, options = {}) =>
  processBillingInbox(f.reader, { now: f.clock, ...options });
function webhookRequest(e = event(), patch = {}) {
  const raw = JSON.stringify(e);
  const stripe = new Stripe('sk_test_synthetic_fixture_only');
  const signature = stripe.webhooks.generateTestHeaderString({
    payload: raw,
    secret: signingSecret,
  });
  return new Request('https://stride.test/api/billing/webhook', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'stripe-signature': signature,
      ...patch.headers,
    },
    body: patch.body ?? raw,
  });
}
const processRequest = (
  payload = { action: 'process' },
  auth = `Bearer ${machineToken}`,
) =>
  new Request('https://stride.test/api/billing/process', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: auth },
    body: JSON.stringify(payload),
  });
const getRequest = (a) =>
  new Request('https://stride.test/api/billing', {
    headers: {
      'oai-authenticated-user-id': a.owner,
      'x-stride-account': a.account_id,
      'x-stride-epoch': String(a.epoch),
    },
  });

test('signed webhook persists and acknowledges before any provider request; duplicate delivery has one inbox identity', async (t) => {
  const f = await context(t);
  assert.equal((await webhook(webhookRequest())).status, 200);
  assert.equal(readEvent(f).status, 'pending');
  assert.equal((await webhook(webhookRequest())).status, 200);
  assert.equal(
    f.sqlite.prepare('SELECT count(*) n FROM billing_events').get().n,
    1,
  );
  assert.equal(readSub(f), undefined);
  assert.equal((await apply(f)).processed, 1);
  assert.equal(readEvent(f).status, 'done');
  assert.equal((await readSandboxEntitlement(f.a, f.clock())).entitled, true);
  assert.equal(
    readSub(f).status,
    'active',
    'Embedded canceled payload is never used to grant/revoke; fresh provider state is authoritative',
  );
});

test('invalid signature, mutated payload, live event and oversized bodies never enter inbox', async (t) => {
  const f = await context(t);
  for (const request of [
    webhookRequest(event(), { headers: { 'stripe-signature': '' } }),
    webhookRequest(event(), { body: JSON.stringify(event('evt_B')) }),
    webhookRequest({ ...event(), livemode: true }),
  ])
    assert.equal((await webhook(request)).status, 400);
  assert.equal(
    (await webhook(webhookRequest(event(), { body: 'x'.repeat(100001) })))
      .status,
    413,
  );
  assert.equal(
    f.sqlite.prepare('SELECT count(*) n FROM billing_events').get().n,
    0,
  );
});

test('delayed and out-of-order events reconcile current status, without trusting event.created order', async (t) => {
  const f = await context(t);
  await queue(event('evt_newer', 2000), f.clock());
  await apply(f);
  f.snapshot.status = 'canceled';
  await queue(event('evt_older', 1000, 'active'), f.clock());
  await apply(f);
  assert.equal(readSub(f).status, 'canceled');
  assert.equal(readSub(f).last_event_at, 2000);
  assert.equal((await readSandboxEntitlement(f.a, f.clock())).entitled, false);
});

test('duplicates remain deduplicated beyond the old 100-event reducer window', async (t) => {
  const f = await context(t);
  await queue(event(), f.clock());
  await apply(f);
  for (let i = 0; i < 110; i++) await queue(event(`evt_later${i}`), f.clock());
  assert.equal((await queue(event(), f.clock())).queued, false);
  assert.equal(readEvent(f).attempts, 1);
  assert.equal(
    f.sqlite
      .prepare("SELECT count(*) n FROM billing_events WHERE id='evt_A'")
      .get().n,
    1,
  );
});

test('changed signed event identity conflicts without replacing the original subject', async (t) => {
  const f = await context(t);
  await queue();
  await assert.rejects(
    () => queue({ ...event(), data: { object: { id: 'sub_B' } } }),
    /identity conflict/,
  );
  assert.equal(readEvent(f).subscription_id, 'sub_A');
});

test('a process loss after receipt or lease acquisition resumes from durable inbox and expired lease', async (t) => {
  const f = await context(t);
  await queue(event(), f.clock());
  f.sqlite
    .prepare(
      'INSERT INTO billing_subscriptions(id,lease_token,lease_until) VALUES(?,?,?)',
    )
    .run('sub_A', 'lost-worker', f.clock() + 60);
  assert.equal((await apply(f)).busy, 1);
  f.advance(61);
  assert.equal((await apply(f)).processed, 1);
  assert.equal(readEvent(f).status, 'done');
});

test('a concurrent consumer cannot read Stripe while the subscription lease is held', async (t) => {
  const f = await context(t);
  await queue(event(), f.clock());
  let release, started;
  const ready = new Promise((r) => {
    started = r;
  });
  const pending = processBillingInbox(
    {
      discoverSubscription: () => {
        started();
        return new Promise((r) => {
          release = r;
        });
      },
    },
    { now: f.clock },
  );
  await ready;
  let calls = 0;
  const rival = await processBillingInbox(
    {
      discoverSubscription: async () => {
        calls++;
        return { account: f.account, snapshot: f.snapshot };
      },
    },
    { now: f.clock },
  );
  assert.equal(rival.busy, 1);
  assert.equal(calls, 0);
  release({ account: f.account, snapshot: f.snapshot });
  assert.equal((await pending).processed, 1);
});

test('an expired worker cannot overwrite a successor snapshot or acknowledge its event', async (t) => {
  const f = await context(t);
  await queue(event(), f.clock());
  let release, started;
  const ready = new Promise((r) => {
    started = r;
  });
  const stale = structuredClone(f.snapshot);
  const pending = processBillingInbox(
    {
      discoverSubscription: () => {
        started();
        return new Promise((r) => {
          release = r;
        });
      },
    },
    { now: f.clock },
  );
  await ready;
  f.advance(61);
  f.snapshot.status = 'canceled';
  assert.equal((await apply(f)).processed, 1);
  release({ account: f.account, snapshot: stale });
  await pending;
  assert.equal(readSub(f).status, 'canceled');
  assert.equal(readSub(f).revision, 1);
  assert.equal(readEvent(f).attempts, 1);
});

test('provider outage backs off durably, then retries with a fresh provider read', async (t) => {
  const f = await context(t);
  await queue(event(), f.clock());
  const failure = {
    discoverSubscription: async () => {
      throw new Error('Synthetic network handover');
    },
  };
  assert.equal((await processBillingInbox(failure, { now: f.clock })).retry, 1);
  assert.equal(readEvent(f).status, 'retry');
  assert.ok(readEvent(f).next_attempt_at > f.clock());
  assert.equal((await apply(f)).processed, 0);
  f.advance(31);
  assert.equal((await apply(f)).processed, 1);
  assert.equal(readEvent(f).attempts, 2);
});

test('repeated failure reaches a durable review queue and authorized retry can recover it', async (t) => {
  const f = await context(t);
  await queue(event(), f.clock());
  const failure = {
    discoverSubscription: async () => {
      throw new Error('Provider unavailable');
    },
  };
  for (let n = 0; n < 8; n++) {
    await processBillingInbox(failure, { now: f.clock });
    f.advance(3601);
  }
  assert.equal(readEvent(f).status, 'dead');
  assert.equal(readEvent(f).attempts, 8);
  assert.equal((await retryBillingEvent('evt_A')).queued, true);
  assert.equal((await apply(f)).processed, 1);
});

test('a closed or reset account cannot gain entitlement from a delayed old-epoch event', async (t) => {
  const f = await context(t);
  await queue(event(), f.clock());
  f.sqlite
    .prepare('UPDATE accounts SET epoch=epoch+1 WHERE owner=?')
    .run(f.a.owner);
  assert.equal((await apply(f)).ignored, 1);
  const fresh = await readAccount(f.a.owner);
  assert.equal(
    (await readSandboxEntitlement(fresh, f.clock())).entitled,
    false,
  );
  assert.equal(readSub(f).account_id, null);
});

test('account closure while a Stripe refresh is in flight prevents the commit', async (t) => {
  const f = await context(t);
  await queue(event(), f.clock());
  const reader = {
    discoverSubscription: async () => {
      f.sqlite
        .prepare("UPDATE accounts SET status='closed' WHERE owner=?")
        .run(f.a.owner);
      return { account: f.account, snapshot: f.snapshot };
    },
  };
  assert.equal(
    (await processBillingInbox(reader, { now: f.clock })).ignored,
    1,
  );
  assert.equal(readSub(f).account_id, null);
});

test('binding changes and unrelated snapshots cannot move an entitlement to another account', async (t) => {
  const f = await context(t);
  await queue(event(), f.clock());
  await apply(f);
  const other = await readAccount('synthetic-other');
  await queue(event('evt_changed'), f.clock());
  const reader = {
    discoverSubscription: async () => ({
      account: { ...f.account, accountId: other.account_id },
      snapshot: f.snapshot,
    }),
  };
  assert.equal((await processBillingInbox(reader, { now: f.clock })).retry, 1);
  assert.equal(
    (await readSandboxEntitlement(other, f.clock())).entitled,
    false,
  );
  assert.equal(readSub(f).account_id, f.a.account_id);
});

test('trial expiry, cancellation-at-end, payment hold and revoked statuses use current provider limits', async (t) => {
  const f = await context(t);
  f.snapshot.status = 'trialing';
  f.snapshot.trialEnd = f.clock() + 60;
  f.snapshot.cancelAtPeriodEnd = true;
  await queue(event(), f.clock());
  await apply(f);
  assert.equal(
    (await readSandboxEntitlement(f.a, f.clock())).validUntil,
    f.clock() + 60,
  );
  f.advance(60);
  assert.equal((await readSandboxEntitlement(f.a, f.clock())).entitled, false);
  for (const [i, status] of [
    'unpaid',
    'paused',
    'incomplete',
    'incomplete_expired',
    'canceled',
  ].entries()) {
    f.snapshot.status = status;
    await queue(event(`evt_status${i}`), f.clock());
    await apply(f);
    assert.equal(
      (await readSandboxEntitlement(f.a, f.clock())).entitled,
      false,
    );
  }
});

test('explicit configured grace is anchored to the previous verified paid period and cannot extend on retries', async (t) => {
  const f = await context(t);
  f.snapshot.periodEnd = f.clock() + 10;
  await queue(event(), f.clock());
  await apply(f, { graceSeconds: 30 });
  const paidEnd = f.snapshot.periodEnd;
  f.advance(11);
  f.snapshot.status = 'past_due';
  f.snapshot.periodEnd = f.clock() + 86400;
  await queue(event('evt_failure'), f.clock());
  await apply(f, { graceSeconds: 30 });
  assert.equal((await readSandboxEntitlement(f.a, f.clock())).status, 'grace');
  assert.equal(readSub(f).grace_until, paidEnd + 30);
  f.advance(5);
  await queue(event('evt_repeat'), f.clock());
  await apply(f, { graceSeconds: 30 });
  assert.equal(readSub(f).grace_until, paidEnd + 30);
  f.advance(25);
  assert.equal((await readSandboxEntitlement(f.a, f.clock())).entitled, false);
  f.snapshot.status = 'active';
  await queue(event('evt_recovered'), f.clock());
  await apply(f, { graceSeconds: 30 });
  assert.equal(readSub(f).grace_until, 0);
  assert.equal((await readSandboxEntitlement(f.a, f.clock())).entitled, true);
});

test('default policy grants no implicit grace and missed-webhook reconciliation refreshes stale access', async (t) => {
  const f = await context(t);
  await queue(event(), f.clock());
  await apply(f);
  f.advance(3601);
  assert.equal((await readSandboxEntitlement(f.a, f.clock())).stale, true);
  assert.equal((await readSandboxEntitlement(f.a, f.clock())).entitled, false);
  assert.equal((await queueBillingReconciliation(f.clock())).queued, 1);
  await apply(f);
  assert.equal((await readSandboxEntitlement(f.a, f.clock())).entitled, true);
  f.snapshot.status = 'past_due';
  f.snapshot.periodEnd = f.clock() - 1;
  await queue(event('evt_defaultGrace'), f.clock());
  await apply(f);
  assert.equal((await readSandboxEntitlement(f.a, f.clock())).entitled, false);
});

test('processor route requires its separate machine token and configured sandbox, not browser identity', async (t) => {
  const f = await context(t);
  assert.equal((await processor(processRequest(undefined, ''))).status, 401);
  assert.equal(
    (await processor(processRequest(undefined, 'Bearer wrong'))).status,
    401,
  );
  assert.equal((await processor(processRequest())).status, 200);
  globalThis.billingInboxEnv.STRIPE_TEST_SECRET_KEY = 'sk_live_rejected';
  assert.equal((await processor(processRequest())).status, 503);
  assert.equal((await webhook(webhookRequest())).status, 503);
  assert.equal(
    f.sqlite.prepare('SELECT count(*) n FROM billing_events').get().n,
    0,
  );
});

test('entitlement GET is account scoped, bounded and never enables live checkout', async (t) => {
  const f = await context(t);
  await queue(event(), f.clock());
  await apply(f);
  const response = await entitlement(getRequest(f.a));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.mode, 'sandbox');
  assert.equal(result.enabled, false);
  assert.equal(result.checkoutEnabled, false);
  assert.equal(result.entitlement.entitled, true);
  assert.equal(result.accountId, f.a.account_id);
  assert.equal(result.accountEpoch, f.a.epoch);
  assert.equal(JSON.stringify(result).includes('cus_A'), false);
  const other = await readAccount('synthetic-other');
  assert.equal(
    (await (await entitlement(getRequest(other))).json()).entitlement.entitled,
    false,
  );
  assert.equal(
    (await entitlement(new Request('https://stride.test/api/billing'))).status,
    401,
  );
  assert.equal(
    (await entitlement(getRequest({ ...f.a, account_id: other.account_id })))
      .status,
    409,
  );
  assert.match(response.headers.get('cache-control'), /no-store/);
});

test('fresh Stripe discovery checks both customer and subscription metadata before binding', async (t) => {
  const f = await context(t);
  let badCustomer = false;
  upstream = async (url) =>
    Response.json(
      url.pathname.includes('/subscriptions/')
        ? {
            id: 'sub_A',
            object: 'subscription',
            customer: 'cus_A',
            livemode: false,
            status: 'active',
            cancel_at_period_end: false,
            metadata: {
              stride_account: f.account.accountId,
              stride_epoch: String(f.account.epoch),
            },
            items: {
              data: [
                {
                  price: { id: 'price_synthetic' },
                  current_period_end: f.clock() + 86400,
                },
              ],
            },
          }
        : {
            id: 'cus_A',
            object: 'customer',
            livemode: false,
            metadata: {
              stride_account: badCustomer
                ? 'another-account'
                : f.account.accountId,
              stride_epoch: String(f.account.epoch),
            },
          },
    );
  const runtime = sandboxBillingRuntime();
  assert.equal(
    (await runtime.billing.discoverSubscription('sub_A')).account.accountId,
    f.account.accountId,
  );
  badCustomer = true;
  await assert.rejects(
    () => runtime.billing.discoverSubscription('sub_A'),
    /ownership/,
  );
  await queue(event(), f.clock());
  assert.equal((await processor(processRequest())).status, 200);
  assert.equal(readEvent(f).status, 'retry');
  badCustomer = false;
  f.sqlite.prepare('UPDATE billing_events SET next_attempt_at=0').run();
  assert.equal((await processor(processRequest())).status, 200);
  assert.equal(readEvent(f).status, 'done');
});

test('invoice renewals support both current and legacy signed subscription references', async (t) => {
  const f = await context(t);
  for (const [id, object] of [
    [
      'evt_invoice1',
      { parent: { subscription_details: { subscription: 'sub_A' } } },
    ],
    ['evt_invoice2', { subscription: { id: 'sub_A' } }],
  ]) {
    const response = await webhook(
      webhookRequest({ ...event(id), type: 'invoice.paid', data: { object } }),
    );
    assert.equal(response.status, 200);
  }
  assert.equal((await apply(f)).processed, 2);
  assert.equal(readSub(f).revision, 2);
});

test('an atomic commit failure cannot grant access before acknowledging its event', async (t) => {
  const f = await context(t);
  await queue(event(), f.clock());
  f.sqlite.exec(
    "CREATE TRIGGER synthetic_failure BEFORE UPDATE OF status ON billing_events WHEN NEW.status='done' BEGIN SELECT RAISE(ABORT,'synthetic write failure'); END",
  );
  assert.equal((await apply(f)).retry, 1);
  assert.equal(readSub(f).account_id, null);
  assert.equal((await readSandboxEntitlement(f.a, f.clock())).entitled, false);
  assert.equal(readEvent(f).status, 'retry');
  f.sqlite.exec('DROP TRIGGER synthetic_failure');
  f.advance(31);
  assert.equal((await apply(f)).processed, 1);
});

test('a fresh snapshot for a different subscription cannot satisfy a queued event', async (t) => {
  const f = await context(t);
  await queue(event(), f.clock());
  const reader = {
    discoverSubscription: async () => ({
      account: { ...f.account, subscriptionId: 'sub_B' },
      snapshot: { ...f.snapshot, id: 'sub_B' },
    }),
  };
  assert.equal((await processBillingInbox(reader, { now: f.clock })).retry, 1);
  assert.equal(readSub(f).account_id, null);
});

async function recover(account, kind, file) {
  const { POST } = await import('../app/api/recovery/route.ts');
  const request = (payload) =>
    new Request('https://stride.test/api/recovery', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://stride.test',
        'oai-authenticated-user-id': account.owner,
        'x-stride-account': account.account_id,
        'x-stride-epoch': String(account.epoch),
      },
      body: JSON.stringify(payload),
    });
  const previewResponse = await POST(
    request({ action: 'preview', kind, file }),
  );
  const preview = await previewResponse.json();
  assert.equal(previewResponse.status, 200, JSON.stringify(preview));
  const commit = await POST(
    request({
      action: 'commit',
      kind,
      file,
      id: preview.id,
      confirm:
        kind === 'delete' ? 'DELETE' : kind === 'restore' ? 'REPLACE' : 'OPEN',
    }),
  );
  assert.equal(commit.status, 200, JSON.stringify(await commit.json()));
  return readAccount(account.owner);
}

test('account deletion atomically purges its sandbox records and reopening cannot revive old ownership', async (t) => {
  const f = await context(t);
  await queue(event(), f.clock());
  await apply(f);
  const other = await readAccount('unrelated-billing-account');
  f.sqlite
    .prepare(
      'INSERT INTO billing_subscriptions(id,account_id,account_epoch,customer_id) VALUES(?,?,?,?)',
    )
    .run('sub_B', other.account_id, other.epoch, 'cus_B');
  f.sqlite
    .prepare(
      "INSERT INTO billing_events(id,subscription_id,type,event_created,payload_hash,received_at) VALUES('evt_B','sub_B','test',1000,'hash',1000)",
    )
    .run();
  const closed = await recover(f.a, 'delete');
  assert.equal(closed.status, 'closed');
  assert.equal(readSub(f), undefined);
  assert.equal(readEvent(f), undefined);
  assert.ok(
    f.sqlite
      .prepare("SELECT id FROM billing_subscriptions WHERE id='sub_B'")
      .get(),
  );
  assert.ok(
    f.sqlite.prepare("SELECT id FROM billing_events WHERE id='evt_B'").get(),
  );
  const reopened = await recover(closed, 'reopen');
  assert.equal(reopened.status, 'active');
  await queue(event('evt_late'), f.clock());
  await apply(f);
  assert.equal(
    (await readSandboxEntitlement(reopened, f.clock())).entitled,
    false,
  );
  assert.equal(readEvent(f, 'evt_late').status, 'ignored');
  assert.equal(
    (await entitlement(getRequest({ ...reopened, epoch: f.a.epoch }))).status,
    409,
  );
  // Only a fresh provider response with the new legitimate epoch can bind again.
  f.account.epoch = reopened.epoch;
  await queue(event('evt_currentEpoch'), f.clock());
  await apply(f);
  assert.equal(
    (await readSandboxEntitlement(reopened, f.clock())).entitled,
    true,
  );
});

test('restore advances the epoch without inheriting sandbox entitlement from the replaced journal', async (t) => {
  const f = await context(t);
  await queue(event(), f.clock());
  await apply(f);
  const replacement = {
    format: 'stride-recovery-2',
    exportedAt: new Date().toISOString(),
    profile: null,
    plan: null,
  };
  const restored = await recover(f.a, 'restore', replacement);
  assert.ok(restored.epoch > f.a.epoch);
  assert.equal(
    (await readSandboxEntitlement(restored, f.clock())).entitled,
    false,
  );
  await queue(event('evt_delayedBeforeRestore'), f.clock());
  await apply(f);
  assert.equal(
    (await readSandboxEntitlement(restored, f.clock())).entitled,
    false,
  );
  // Deleting after a restore also purges retained previous-epoch sandbox rows.
  await recover(restored, 'delete');
  assert.equal(readSub(f), undefined);
  assert.equal(readEvent(f), undefined);
});

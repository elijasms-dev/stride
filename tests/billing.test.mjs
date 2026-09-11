import test from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import {
  billingConfig,
  createSandboxBilling,
  applyBillingSnapshot,
  sandboxEntitled,
} from '../lib/billing.ts';
const config = {
  secretKey: 'sk_test_synthetic_only',
  priceId: 'price_synthetic',
  returnOrigin: 'https://stride.invalid',
  webhookSecret: 'whsec_synthetic_fixture_only',
};
const account = {
  accountId: 'account-A',
  epoch: 3,
  customerId: 'cus_A',
  subscriptionId: 'sub_A',
};
function transport() {
  const calls = [];
  return {
    calls,
    customers: {
      retrieve: async () => ({
        id: 'cus_A',
        livemode: false,
        metadata: { stride_account: 'account-A', stride_epoch: '3' },
      }),
      create: async (payload, options) => {
        calls.push({ payload, options });
        return { id: 'cus_A' };
      },
    },
    checkout: {
      sessions: {
        create: async (payload, options) => {
          calls.push({ payload, options });
          return {
            id: 'cs_test_A',
            url: 'https://checkout.stripe.com/synthetic',
          };
        },
      },
    },
    subscriptions: {
      retrieve: async () => ({
        id: 'sub_A',
        customer: 'cus_A',
        livemode: false,
        status: 'active',
        cancel_at_period_end: false,
        metadata: { stride_account: 'account-A', stride_epoch: '3' },
        items: {
          data: [{ price: { id: config.priceId }, current_period_end: 2000 }],
        },
      }),
    },
  };
}
void test('billing is gated without configuration and always refuses live keys or unsafe returns', () => {
  assert.throws(() => billingConfig({}), /not configured/);
  assert.throws(
    () => billingConfig({ ...config, secretKey: 'sk_live_fake' }),
    /Live billing/,
  );
  for (const origin of [
    'http://example.com',
    'https://stride.invalid/?return=evil',
    'https://user:pass@stride.invalid',
    'https://stride.invalid/account',
  ])
    assert.throws(() => billingConfig({ ...config, returnOrigin: origin }));
});
void test('sandbox checkout binds account, price and return URLs, retaining an intent key across retries', async () => {
  const t = transport(),
    billing = createSandboxBilling(config, t);
  await billing.createCheckout(account, 'persisted-intent-1234');
  await billing.createCheckout(account, 'persisted-intent-1234');
  assert.equal(
    t.calls[0].options.idempotencyKey,
    t.calls[1].options.idempotencyKey,
  );
  assert.equal(t.calls[0].payload.customer, 'cus_A');
  assert.equal(t.calls[0].payload.line_items[0].price, config.priceId);
  assert.equal(
    t.calls[0].payload.success_url,
    'https://stride.invalid/?billing=review',
  );
  assert.equal(t.calls[0].payload.subscription_data.metadata.stride_epoch, '3');
});
void test('checkout and subscription refresh reject another account or stale customer epoch', async () => {
  const t = transport(),
    billing = createSandboxBilling(config, t);
  await assert.rejects(
    () =>
      billing.createCheckout(
        { ...account, accountId: 'account-B' },
        'persisted-intent-1234',
      ),
    /belong/,
  );
  await assert.rejects(
    () =>
      billing.createCheckout({ ...account, epoch: 4 }, 'persisted-intent-1234'),
    /belong/,
  );
  assert.equal(t.calls.length, 0);
  await assert.rejects(
    () => billing.refresh({ ...account, customerId: 'cus_B' }),
    /belong/,
  );
  await assert.rejects(
    () => billing.refresh({ ...account, epoch: 4 }),
    /belong/,
  );
  assert.equal((await billing.refresh(account)).periodEnd, 2000);
});
void test('official Stripe verifier rejects altered, expired, missing and live-mode webhook events', async () => {
  const stripe = new Stripe(config.secretKey),
    billing = createSandboxBilling(config);
  const event = {
    id: 'evt_fixture',
    object: 'event',
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    type: 'customer.subscription.updated',
    data: { object: { id: 'sub_A' } },
  };
  const raw = JSON.stringify(event),
    header = stripe.webhooks.generateTestHeaderString({
      payload: raw,
      secret: config.webhookSecret,
    });
  assert.equal((await billing.verifyWebhook(raw, header)).id, event.id);
  await assert.rejects(() => billing.verifyWebhook(raw + ' ', header));
  await assert.rejects(() => billing.verifyWebhook(raw, ''));
  const old = stripe.webhooks.generateTestHeaderString({
    payload: raw,
    secret: config.webhookSecret,
    timestamp: 1,
  });
  await assert.rejects(() => billing.verifyWebhook(raw, old));
  const live = JSON.stringify({ ...event, livemode: true }),
    signed = stripe.webhooks.generateTestHeaderString({
      payload: live,
      secret: config.webhookSecret,
    });
  await assert.rejects(
    () => billing.verifyWebhook(live, signed),
    /Live events/,
  );
});
void test('subscription reducer deduplicates IDs and accepts current snapshots triggered by older events', () => {
  const snap = {
    id: 'sub_A',
    customerId: 'cus_A',
    status: 'active',
    periodEnd: 2000,
    cancelAtPeriodEnd: false,
    livemode: false,
  };
  const event = { id: 'evt_1', created: 1000, livemode: false };
  const first = applyBillingSnapshot(null, account, event, snap);
  assert.equal(
    applyBillingSnapshot(first, account, event, {
      ...snap,
      status: 'canceled',
    }),
    first,
  );
  assert.equal(
    applyBillingSnapshot(
      first,
      account,
      { ...event, id: 'evt_old', created: 999 },
      { ...snap, status: 'canceled' },
    ).status,
    'canceled',
  );
  assert.throws(
    () =>
      applyBillingSnapshot(
        first,
        account,
        { ...event, id: 'evt_B' },
        { ...snap, customerId: 'cus_B' },
      ),
    /Unrelated/,
  );
});
void test('unpaid, renewal failure, cancellation and expiration do not grant a sandbox entitlement', () => {
  const record = { status: 'active', periodEnd: 2000 };
  assert.equal(sandboxEntitled(record, 1000), true);
  assert.equal(
    sandboxEntitled({ ...record, cancelAtPeriodEnd: true }, 1000),
    true,
  );
  for (const status of [
    'incomplete',
    'incomplete_expired',
    'past_due',
    'unpaid',
    'paused',
    'canceled',
  ])
    assert.equal(sandboxEntitled({ ...record, status }, 1000), false);
  assert.equal(sandboxEntitled(record, 2000), false);
  assert.equal(sandboxEntitled(null, 1000), false);
});

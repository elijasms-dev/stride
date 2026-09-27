/** Server-side sandbox adapter. Live keys and events remain disabled. */
import Stripe from 'stripe';
export type BillingConfig = {
  secretKey: string;
  priceId: string;
  returnOrigin: string;
  webhookSecret?: string;
};
export type BillingBinding = {
  accountId: string;
  epoch: number;
  customerId: string;
  subscriptionId?: string;
};
export type SubscriptionSnapshot = {
  id: string;
  customerId: string;
  status: string;
  periodEnd: number;
  cancelAtPeriodEnd: boolean;
  livemode: boolean;
  trialEnd?: number | null;
};
export type BillingRecord = {
  subscriptionId: string;
  customerId: string;
  status: string;
  periodEnd: number;
  cancelAtPeriodEnd: boolean;
  lastEventAt: number;
  seenEventIds: string[];
};
export function billingConfig(input: Partial<BillingConfig>): BillingConfig {
  if (!input.secretKey || !input.priceId || !input.returnOrigin)
    throw new Error('Sandbox billing is not configured.');
  if (!input.secretKey.startsWith('sk_test_'))
    throw new Error(
      'Only Stripe sandbox keys are accepted. Live billing is disabled.',
    );
  if (!/^price_[A-Za-z0-9]+$/.test(input.priceId))
    throw new Error('Choose the configured sandbox Price.');
  const url = new URL(input.returnOrigin);
  if (
    url.protocol !== 'https:' &&
    !(
      url.protocol === 'http:' &&
      ['localhost', '127.0.0.1'].includes(url.hostname)
    )
  )
    throw new Error('Use HTTPS or a loopback sandbox return origin.');
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  )
    throw new Error(
      'Use a fixed return origin without credentials, path or query.',
    );
  return { ...input, returnOrigin: url.origin } as BillingConfig;
}
export function createSandboxBilling(
  raw: Partial<BillingConfig>,
  transport?: Stripe,
) {
  const config = billingConfig(raw),
    stripe =
      transport ??
      new Stripe(config.secretKey, {
        httpClient: Stripe.createFetchHttpClient(),
        maxNetworkRetries: 0,
        timeout: 10000,
      });
  function binding(value: BillingBinding) {
    if (
      !value.accountId ||
      !Number.isSafeInteger(value.epoch) ||
      value.epoch < 0 ||
      !/^cus_[A-Za-z0-9]+$/.test(value.customerId)
    )
      throw new Error('A server-owned account/customer binding is required.');
  }
  function subscriptionSnapshot(
    sub: Stripe.Subscription,
    account: BillingBinding,
  ): SubscriptionSnapshot {
    const customer =
      typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
    if (
      sub.livemode ||
      sub.id !== account.subscriptionId ||
      customer !== account.customerId ||
      sub.metadata.stride_account !== account.accountId ||
      sub.metadata.stride_epoch !== String(account.epoch)
    )
      throw new Error(
        'This subscription does not belong to the active sandbox account.',
      );
    const items = sub.items.data.filter(
      (item) => item.price.id === config.priceId,
    );
    if (items.length !== 1)
      throw new Error(
        'This subscription does not include exactly one configured Stride Price.',
      );
    return {
      id: sub.id,
      customerId: customer,
      status: sub.status,
      periodEnd: items[0].current_period_end,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      livemode: sub.livemode,
      trialEnd: sub.trial_end ?? null,
    };
  }
  return {
    async createCustomer(accountId: string, epoch: number) {
      if (!accountId || !Number.isSafeInteger(epoch) || epoch < 0)
        throw new Error('A stable account is required.');
      return stripe.customers.create(
        {
          metadata: { stride_account: accountId, stride_epoch: String(epoch) },
        },
        { idempotencyKey: `stride-customer:${accountId}:${epoch}` },
      );
    },
    async createCheckout(account: BillingBinding, intentId: string) {
      binding(account);
      if (!/^[A-Za-z0-9-]{16,80}$/.test(intentId))
        throw new Error(
          'Persist a unique checkout intent before contacting Stripe.',
        );
      // These IDs and URLs are supplied by server configuration, never redirect parameters.
      const customer = await stripe.customers.retrieve(account.customerId);
      if (
        customer.deleted ||
        customer.livemode ||
        customer.metadata.stride_account !== account.accountId ||
        customer.metadata.stride_epoch !== String(account.epoch)
      )
        throw new Error(
          'The Stripe customer does not belong to this active sandbox account.',
        );
      return stripe.checkout.sessions.create(
        {
          mode: 'subscription',
          customer: account.customerId,
          client_reference_id: account.accountId,
          line_items: [{ price: config.priceId, quantity: 1 }],
          success_url: config.returnOrigin + '/?billing=review',
          cancel_url: config.returnOrigin + '/?billing=canceled',
          subscription_data: {
            metadata: {
              stride_account: account.accountId,
              stride_epoch: String(account.epoch),
            },
          },
        },
        {
          idempotencyKey: `stride-checkout:${account.accountId}:${account.epoch}:${intentId}`,
        },
      );
    },
    async refresh(account: BillingBinding): Promise<SubscriptionSnapshot> {
      binding(account);
      if (!account.subscriptionId)
        throw new Error('No server-recorded subscription exists.');
      return subscriptionSnapshot(
        await stripe.subscriptions.retrieve(account.subscriptionId),
        account,
      );
    },
    /** Establish ownership from fresh provider state, never from user redirect parameters
     * or a delayed webhook's embedded entitlement status. */
    async discoverSubscription(subscriptionId: string) {
      if (!/^sub_[A-Za-z0-9]+$/.test(subscriptionId))
        throw new Error('Invalid sandbox subscription.');
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      const account: BillingBinding = {
        accountId: sub.metadata.stride_account,
        epoch: Number(sub.metadata.stride_epoch),
        customerId:
          typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
        subscriptionId: sub.id,
      };
      if (!/^\d+$/.test(sub.metadata.stride_epoch ?? ''))
        throw new Error('No sandbox account epoch.');
      binding(account);
      const customer = await stripe.customers.retrieve(account.customerId);
      if (
        customer.deleted ||
        customer.livemode ||
        customer.metadata.stride_account !== account.accountId ||
        customer.metadata.stride_epoch !== String(account.epoch)
      )
        throw new Error(
          'Customer ownership does not match the sandbox account.',
        );
      return { account, snapshot: subscriptionSnapshot(sub, account) };
    },
    async verifyWebhook(rawBody: string, signature: string) {
      if (!config.webhookSecret)
        throw new Error('A sandbox signing secret is required.');
      if (new TextEncoder().encode(rawBody).length > 100000)
        throw new Error('Webhook too large.');
      const event = await stripe.webhooks.constructEventAsync(
        rawBody,
        signature,
        config.webhookSecret,
        300,
        Stripe.createSubtleCryptoProvider(),
      );
      if (event.livemode) throw new Error('Live events are disabled.');
      return event;
    },
  };
}
/** Call only inside serialized per-subscription processing with a durable event inbox and CAS. Event creation time is not delivery order; refresh Stripe after acquiring the lease. The durable sandbox inbox implements that contract; no live consumer is enabled. */
export function applyBillingSnapshot(
  current: BillingRecord | null,
  account: BillingBinding,
  event: { id: string; created: number; livemode: boolean },
  snapshot: SubscriptionSnapshot,
): BillingRecord {
  if (
    event.livemode ||
    snapshot.livemode ||
    snapshot.customerId !== account.customerId ||
    snapshot.id !== account.subscriptionId
  )
    throw new Error('Unrelated or live subscription rejected.');
  if (
    !Number.isSafeInteger(event.created) ||
    !Number.isFinite(snapshot.periodEnd) ||
    snapshot.periodEnd < 0
  )
    throw new Error('Invalid subscription timestamp.');
  if (current && current.seenEventIds.includes(event.id)) return current;
  return {
    subscriptionId: snapshot.id,
    customerId: snapshot.customerId,
    status: snapshot.status,
    periodEnd: snapshot.periodEnd,
    cancelAtPeriodEnd: snapshot.cancelAtPeriodEnd,
    lastEventAt: Math.max(current?.lastEventAt ?? 0, event.created),
    seenEventIds: [...(current?.seenEventIds ?? []), event.id].slice(-100),
  };
}
export function sandboxEntitled(
  record: BillingRecord | null,
  nowSeconds: number,
) {
  return (
    !!record &&
    ['active', 'trialing'].includes(record.status) &&
    record.periodEnd > nowSeconds
  );
}

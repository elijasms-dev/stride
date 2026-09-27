import type Stripe from 'stripe';
import { database, HttpError } from './server.ts';
import type { Account } from './accounts.ts';
import {
  applyBillingSnapshot,
  type BillingBinding,
  type SubscriptionSnapshot,
} from './billing.ts';

export const BILLING_VERIFICATION_SECONDS = 3600;
const LEASE_SECONDS = 60;
const MAX_ATTEMPTS = 8;
type BillingEvent = {
  id: string;
  subscription_id: string;
  type: string;
  event_created: number;
  attempts: number;
  status: string;
};
type StoredSubscription = {
  id: string;
  account_id: string | null;
  account_epoch: number | null;
  customer_id: string | null;
  status: string;
  period_end: number;
  last_entitled_period_end: number;
  grace_until: number;
  cancel_at_period_end: number;
  verified_at: number;
  last_event_at: number;
  revision: number;
  lease_token: string | null;
  lease_until: number;
};
type SnapshotReader = {
  discoverSubscription: (
    id: string,
  ) => Promise<{ account: BillingBinding; snapshot: SubscriptionSnapshot }>;
};
const seconds = () => Math.floor(Date.now() / 1000);

function subscriptionId(event: Stripe.Event): string | null {
  const object = event.data.object as unknown as Record<string, unknown>;
  if (event.type.startsWith('customer.subscription.'))
    return typeof object.id === 'string' ? object.id : null;
  if (
    [
      'invoice.paid',
      'invoice.payment_failed',
      'invoice.payment_action_required',
    ].includes(event.type)
  ) {
    // Support both current subscription_details and older signed invoice events.
    const parent = object.parent as {
      subscription_details?: { subscription?: unknown };
    } | null;
    const id =
      parent?.subscription_details?.subscription ?? object.subscription;
    return typeof id === 'string'
      ? id
      : id && typeof id === 'object' && 'id' in id && typeof id.id === 'string'
        ? id.id
        : null;
  }
  return null;
}

/** Called only after Stripe signature verification. Ack after the durable insert,
 * before any Stripe network reads. Entitlements never come from this payload. */
export async function enqueueBillingEvent(
  event: Stripe.Event,
  payloadHash: string,
  now = seconds(),
) {
  if (event.livemode)
    throw new HttpError(400, 'Live billing events are disabled.');
  const sub = subscriptionId(event);
  if (!sub) return { received: true, ignored: true };
  if (
    !/^evt_[A-Za-z0-9]+$/.test(event.id) ||
    !/^sub_[A-Za-z0-9]+$/.test(sub) ||
    !Number.isSafeInteger(event.created) ||
    event.created < 0
  )
    throw new HttpError(400, 'Invalid sandbox event identifiers.');
  await database()
    .prepare(
      'INSERT OR IGNORE INTO billing_events(id,subscription_id,type,event_created,payload_hash,received_at) VALUES(?,?,?,?,?,?)',
    )
    .bind(event.id, sub, event.type, event.created, payloadHash, now)
    .run();
  const saved = await database()
    .prepare('SELECT * FROM billing_events WHERE id=?')
    .bind(event.id)
    .first<BillingEvent>();
  if (
    !saved ||
    saved.subscription_id !== sub ||
    saved.type !== event.type ||
    saved.event_created !== event.created
  )
    throw new HttpError(409, 'Event identity conflict.');
  // Delivery metadata can differ on a legitimate retry; the event identity and
  // subject are immutable, while the initial payload hash remains an audit aid.
  return {
    received: true,
    queued: ['pending', 'retry'].includes(saved.status),
  };
}

async function releaseLease(id: string, token: string) {
  await database()
    .prepare(
      'UPDATE billing_subscriptions SET lease_token=NULL,lease_until=0 WHERE id=? AND lease_token=?',
    )
    .bind(id, token)
    .run();
}
async function finishEvent(
  id: string,
  sub: string,
  token: string,
  status: 'ignored' | 'retry' | 'dead',
  now: number,
  attempts: number,
  reason: string,
) {
  const next =
    status === 'retry'
      ? now + Math.min(3600, 30 * 2 ** Math.min(attempts - 1, 7))
      : 0;
  await database().batch([
    database()
      .prepare(
        'UPDATE billing_events SET status=?,attempts=?,next_attempt_at=?,last_error=?,processed_at=? WHERE id=? AND EXISTS(SELECT 1 FROM billing_subscriptions WHERE id=? AND lease_token=? AND lease_until>?)',
      )
      .bind(
        status,
        attempts,
        next,
        reason,
        status === 'ignored' ? now : null,
        id,
        sub,
        token,
        now,
      ),
    database()
      .prepare(
        'UPDATE billing_subscriptions SET lease_token=NULL,lease_until=0 WHERE id=? AND lease_token=?',
      )
      .bind(sub, token),
  ]);
}

/** Each provider read happens after claiming a subscription lease. A token and
 * expiry fence every commit, so a suspended worker cannot overwrite its successor. */
export async function processBillingInbox(
  reader: SnapshotReader,
  options: { limit?: number; graceSeconds?: number; now?: () => number } = {},
) {
  const now = options.now ?? seconds;
  const limit = Math.min(10, Math.max(1, Math.floor(options.limit ?? 5)));
  const graceSeconds = options.graceSeconds ?? 0;
  if (
    !Number.isSafeInteger(graceSeconds) ||
    graceSeconds < 0 ||
    graceSeconds > 604800
  )
    throw new Error(
      'Sandbox grace must be explicitly configured between zero and seven days.',
    );
  const queue = await database()
    .prepare(
      "SELECT * FROM billing_events WHERE status IN ('pending','retry') AND next_attempt_at<=? ORDER BY received_at,id LIMIT ?",
    )
    .bind(now(), limit)
    .all<BillingEvent>();
  const counts = { processed: 0, retry: 0, dead: 0, ignored: 0, busy: 0 };
  for (const queued of queue.results) {
    const token = crypto.randomUUID();
    const claimed = await database().batch([
      database()
        .prepare('INSERT OR IGNORE INTO billing_subscriptions(id) VALUES(?)')
        .bind(queued.subscription_id),
      database()
        .prepare(
          'UPDATE billing_subscriptions SET lease_token=?,lease_until=? WHERE id=? AND lease_until<=?',
        )
        .bind(token, now() + LEASE_SECONDS, queued.subscription_id, now()),
    ]);
    if (claimed[1].meta.changes !== 1) {
      counts.busy++;
      continue;
    }
    const previous = await database()
      .prepare(
        'SELECT * FROM billing_subscriptions WHERE id=? AND lease_token=?',
      )
      .bind(queued.subscription_id, token)
      .first<StoredSubscription>();
    const event = await database()
      .prepare(
        "SELECT * FROM billing_events WHERE id=? AND status IN ('pending','retry') AND next_attempt_at<=?",
      )
      .bind(queued.id, now())
      .first<BillingEvent>();
    if (!previous || !event) {
      await releaseLease(queued.subscription_id, token);
      continue;
    }
    try {
      const { account, snapshot } = await reader.discoverSubscription(
        event.subscription_id,
      );
      if (
        account.subscriptionId !== event.subscription_id ||
        snapshot.id !== event.subscription_id
      )
        throw new Error(
          'The refreshed subscription does not match the queued subject.',
        );
      if (
        previous.account_id !== null &&
        (previous.account_id !== account.accountId ||
          previous.account_epoch !== account.epoch ||
          previous.customer_id !== account.customerId)
      )
        throw new Error('Subscription binding changed.');
      if (
        ![
          'active',
          'trialing',
          'past_due',
          'unpaid',
          'incomplete',
          'incomplete_expired',
          'canceled',
          'paused',
        ].includes(snapshot.status)
      )
        throw new Error('Unsupported subscription state.');
      const currentAccount = await database()
        .prepare(
          "SELECT account_id FROM accounts WHERE account_id=? AND epoch=? AND status='active'",
        )
        .bind(account.accountId, account.epoch)
        .first();
      if (!currentAccount) {
        await finishEvent(
          event.id,
          event.subscription_id,
          token,
          'ignored',
          now(),
          event.attempts + 1,
          'inactive_account',
        );
        counts.ignored++;
        continue;
      }
      const reduced = applyBillingSnapshot(
        previous.account_id
          ? {
              subscriptionId: previous.id,
              customerId: previous.customer_id!,
              status: previous.status,
              periodEnd: previous.period_end,
              cancelAtPeriodEnd: !!previous.cancel_at_period_end,
              lastEventAt: previous.last_event_at,
              seenEventIds: [],
            }
          : null,
        account,
        { id: event.id, created: event.event_created, livemode: false },
        snapshot,
      );
      const eligiblePeriod =
        snapshot.status === 'trialing' && snapshot.trialEnd != null
          ? Math.min(snapshot.periodEnd, snapshot.trialEnd)
          : snapshot.periodEnd;
      if (!Number.isSafeInteger(eligiblePeriod) || eligiblePeriod < 0)
        throw new Error('Invalid entitlement expiry.');
      const entitledPeriod = ['active', 'trialing'].includes(snapshot.status)
        ? eligiblePeriod
        : previous.last_entitled_period_end;
      const grace =
        snapshot.status === 'past_due' && entitledPeriod > 0 && graceSeconds > 0
          ? entitledPeriod + graceSeconds
          : 0;
      const at = now();
      const committed = await database().batch([
        database()
          .prepare(
            "UPDATE billing_subscriptions SET account_id=?,account_epoch=?,customer_id=?,status=?,period_end=?,last_entitled_period_end=?,grace_until=?,cancel_at_period_end=?,verified_at=?,last_event_at=?,revision=revision+1 WHERE id=? AND lease_token=? AND lease_until>? AND EXISTS(SELECT 1 FROM accounts WHERE account_id=? AND epoch=? AND status='active')",
          )
          .bind(
            account.accountId,
            account.epoch,
            account.customerId,
            reduced.status,
            eligiblePeriod,
            entitledPeriod,
            grace,
            Number(reduced.cancelAtPeriodEnd),
            at,
            reduced.lastEventAt,
            event.subscription_id,
            token,
            at,
            account.accountId,
            account.epoch,
          ),
        database()
          .prepare(
            "UPDATE billing_events SET status='done',attempts=attempts+1,next_attempt_at=0,last_error=NULL,processed_at=? WHERE id=? AND EXISTS(SELECT 1 FROM billing_subscriptions WHERE id=? AND lease_token=? AND lease_until>? AND revision=? AND verified_at=?)",
          )
          .bind(
            at,
            event.id,
            event.subscription_id,
            token,
            at,
            previous.revision + 1,
            at,
          ),
        database()
          .prepare(
            'UPDATE billing_subscriptions SET lease_token=NULL,lease_until=0 WHERE id=? AND lease_token=?',
          )
          .bind(event.subscription_id, token),
      ]);
      if (committed[0].meta.changes === 1 && committed[1].meta.changes === 1)
        counts.processed++;
      else counts.busy++;
    } catch {
      const attempts = event.attempts + 1;
      const outcome = attempts >= MAX_ATTEMPTS ? 'dead' : 'retry';
      await finishEvent(
        event.id,
        event.subscription_id,
        token,
        outcome,
        now(),
        attempts,
        'reconciliation_failed',
      );
      counts[outcome]++;
    }
  }
  return counts;
}

/** Operator-triggered reconciliation also covers missed webhooks. It only uses
 * previously verified server bindings; no user-provided customer IDs are accepted. */
export async function queueBillingReconciliation(now = seconds()) {
  const subscriptions = await database()
    .prepare(
      "SELECT s.id FROM billing_subscriptions s JOIN accounts a ON a.account_id=s.account_id AND a.epoch=s.account_epoch WHERE a.status='active' AND s.verified_at<? ORDER BY s.verified_at LIMIT 10",
    )
    .bind(now - 300)
    .all<{ id: string }>();
  for (const sub of subscriptions.results) {
    await database()
      .prepare(
        "INSERT OR IGNORE INTO billing_events(id,subscription_id,type,event_created,payload_hash,received_at) VALUES(?,?,'internal.reconcile',?,'internal',?)",
      )
      .bind(`reconcile_${sub.id}_${Math.floor(now / 300)}`, sub.id, now, now)
      .run();
  }
  return { queued: subscriptions.results.length };
}
export async function retryBillingEvent(id: string) {
  if (!/^(?:evt_[A-Za-z0-9]+|reconcile_sub_[A-Za-z0-9]+_\d+)$/.test(id))
    throw new HttpError(400, 'Invalid event identifier.');
  const result = await database()
    .prepare(
      "UPDATE billing_events SET status='retry',attempts=0,next_attempt_at=0,last_error=NULL WHERE id=? AND status='dead'",
    )
    .bind(id)
    .run();
  return { queued: result.meta.changes === 1 };
}

export async function readSandboxEntitlement(
  account: Account,
  now = seconds(),
) {
  if (account.status !== 'active')
    return { entitled: false, status: 'closed', validUntil: 0 };
  const rows = await database()
    .prepare(
      'SELECT * FROM billing_subscriptions WHERE account_id=? AND account_epoch=? ORDER BY verified_at DESC',
    )
    .bind(account.account_id, account.epoch)
    .all<StoredSubscription>();
  const values = rows.results.map((row) => {
    const expiry = ['active', 'trialing'].includes(row.status)
      ? row.period_end
      : row.status === 'past_due'
        ? row.grace_until
        : 0;
    const validUntil = Math.min(
      expiry,
      row.verified_at + BILLING_VERIFICATION_SECONDS,
    );
    return {
      entitled: validUntil > now,
      status:
        row.status === 'past_due' && validUntil > now ? 'grace' : row.status,
      validUntil,
      verifiedAt: row.verified_at,
      cancelAtPeriodEnd: !!row.cancel_at_period_end,
      stale: row.verified_at + BILLING_VERIFICATION_SECONDS <= now,
    };
  });
  return (
    values.find((value) => value.entitled) ??
    values[0] ?? { entitled: false, status: 'none', validUntil: 0 }
  );
}

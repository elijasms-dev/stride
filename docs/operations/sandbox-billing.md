# Durable sandbox billing

Implemented 24 September 2026. This is an operational **sandbox verification pipeline**, not a paid launch. `/api/billing` continues to return `enabled: false` and `checkoutEnabled: false`. Existing planner/journal functions remain available without payment. No prices, trial offers, premium feature list, live purchase route, native store products, or commercial terms have been invented.

## Implemented contract

- `POST /api/billing/webhook` verifies the exact raw body through Stripe's official SDK, enforces a 100 KB streaming limit and rejects live events. The signature is the machine identity; a browser's login header is insufficient.
- Accepted subscription lifecycle events and invoice renewal/payment events enter a durable D1 inbox. Event IDs are unique while retained; explicitly deleting an account purges its associated sandbox records. Only event identifiers, subscription identifiers, timestamps and the first payload hash are retained; raw webhook payloads and card information are not stored.
- The endpoint acknowledges after D1 insertion, before provider calls. A duplicate delivery does not create a second job. Conflicting event subjects fail closed.
- `POST /api/billing/process` requires its own machine bearer token. It processes bounded batches under 60-second per-subscription leases. Every state commit is fenced by the token, its expiry and the active account epoch. Subscription and inbox acknowledgement changes commit in one D1 transaction.
- Provider status is re-read **after** acquiring the lease. Both the subscription and customer metadata must identify the same existing Stride account/epoch, and the configured sandbox Price must be present. Embedded event status and arrival order cannot grant access.
- Provider failures receive persisted exponential backoff and enter `dead` review status after eight attempts. An authenticated retry action is available. Expired leases recover process loss; old workers cannot overwrite a successor.
- Explicit account deletion atomically purges associated sandbox subscription bindings and their inbox events across prior account epochs. Restore/reopen never grants old-epoch access. A later delivery still needs fresh matching provider metadata for the current active account before it can establish any access. Unbound events contain no Stride account identity and cannot yet be associated with an account deletion.
- Authenticated account-bound `GET /api/billing` reports sandbox entitlement, verification time and expiry without exposing customer or subscription IDs. The response is `no-store` and rejects another account or stale epoch.
- Active/trial access lasts only to the provider's period/trial expiry, capped at one hour after the last successful verification. Cancel-at-period-end retains that remaining access. Unpaid, canceled, paused and incomplete subscriptions do not grant access.
- Grace defaults to **zero**. If explicitly configured for sandbox testing, a `past_due` grace window is anchored to the last verified entitled period and is not renewed by repeated failure events. A recovered active subscription clears the grace state.
- A reconciliation action queues verified bindings whose snapshots are at least five minutes old, covering missed webhooks. It excludes closed/old-epoch accounts.

The existing checkout adapter remains an unexposed sandbox helper. No endpoint initiates a purchase. Refund/dispute policy is not inferred from a refund event: Stripe refunds do not inherently define whether an otherwise-active subscription should be revoked. That commercial policy must be specified before enabling real payments.

## External setup still required

1. Apply `0009_greedy_manta.sql` after the existing migrations to the chosen **sandbox** database. This task does not migrate a deployed database.
2. Store deployment secrets/configuration outside source control:
   - `STRIDE_BILLING_MODE=sandbox`
   - `STRIPE_TEST_SECRET_KEY` beginning `sk_test_`
   - `STRIPE_TEST_PRICE_ID` for the operator's actual sandbox product
   - `STRIDE_BILLING_ORIGIN`, a fixed HTTPS origin (loopback HTTP is accepted locally)
   - `STRIPE_TEST_WEBHOOK_SECRET` for this endpoint
   - `STRIDE_BILLING_PROCESS_TOKEN`, an independently generated random token of at least 32 characters
   - Optional `STRIDE_BILLING_GRACE_SECONDS`, an explicit integer from 0 through 604800; absent means zero
3. Register the sandbox Stripe endpoint and lifecycle/invoice event types. The hosting gateway must deliver `/api/billing/webhook` without requiring a browser session; Stripe signature verification remains mandatory. The process route similarly needs machine ingress protected by its separate bearer token. Verify both at the deployed gateway rather than trusting local-route tests.
4. Establish sandbox subscriptions using the existing server adapter/operator tooling, ensuring **both** customer and subscription metadata contain the server account ID (`stride_account`) and epoch (`stride_epoch`). The pipeline cannot bind a generic dashboard subscription that lacks those matching values. Do not accept account/customer identifiers from a return URL.
5. Configure a trusted scheduler/queue consumer to POST `{"action":"process","limit":5}` regularly, and `{"action":"reconcile","limit":5}` at least every five minutes while sandbox testing. Repeated batches may be required for larger queues. No scheduler was deployed or registered by this implementation. Receiving a webhook alone intentionally does not perform provider reconciliation.
6. Monitor oldest pending age, retry/dead count, provider latency, entitlement verification age and machine-route failures. For a reviewed dead-letter event, POST `{"action":"retry","eventId":"evt_…"}` with the machine token, then process again. Investigate ownership/Price errors before retrying; do not copy arbitrary provider error bodies into public responses.
7. Exercise test-clock trial conversion, renewal failure/recovery, cancellation, actual Stripe delivery retries and a deployed gateway outage. Source-level tests cannot establish the real scheduler, secrets, ingress, Price or store configuration.

## Commercial release gates

Live keys/events stay rejected. Before adding a paywall, the operator still needs product/price/trial/renewal/refund/grace definitions; taxes and public terms/support; checkout and restore/manage flows; a customer/checkout-intent lifecycle; production webhook/scheduler provisioning and monitoring; an explicit financial-record retention/deletion policy for any future live payments (current sandbox records are purged on account deletion); and reviewed paid-server-action gates. None of the current app's functions is classified as premium, so this change does not arbitrarily gate personal records or training.

For native distribution, StoreKit/Google Play signed transaction verification and their server notifications remain separate unimplemented integrations. A Stripe sandbox entitlement is not an App Store or Play purchase receipt. Offline entitlement storage must remain account-bound and cannot extend the returned validity boundary; an active recorded run must never depend on refreshing a paywall.

## Verification

`tests/billing-inbox.test.mjs` uses the real routes, official Stripe verifier, an isolated in-memory SQLite database with all migrations, and intercepted synthetic provider responses. It covers duplicate/delayed/out-of-order events, crash/lease recovery, concurrent consumers, expired-worker fencing, failed atomic commits, provider outages/backoff/dead-letter retry, epoch changes/closed accounts, ownership mismatches, trial/cancellation/grace expiry, reconciliation, signatures/body bounds, machine auth and account isolation. No live payment or external Stripe request is made by these tests.

Implementation follows Stripe's [webhook signature, delivery and asynchronous-processing guidance](https://docs.stripe.com/webhooks) and [subscription lifecycle documentation](https://docs.stripe.com/billing/subscriptions/webhooks). Provider API reads, rather than event creation timestamps, are the authority for current subscription status.

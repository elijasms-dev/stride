import { ownerId, json, failure, AccountContextError } from '@/lib/server';
import { readAccount, assertAccountIdentity } from '@/lib/accounts';
import { sandboxBillingRuntime } from '@/lib/billing-runtime';
import { readSandboxEntitlement } from '@/lib/billing-store';
export async function GET(request: Request) {
  try {
    const account = await readAccount(ownerId(request));
    assertAccountIdentity(request, account);
    if (request.headers.get('x-stride-epoch') !== String(account.epoch))
      throw new AccountContextError();
    let ready = false;
    try {
      ready = !!sandboxBillingRuntime();
    } catch {
      /* Misconfiguration cannot enable a paywall. */
    }
    return json({
      enabled: false,
      mode: ready ? 'sandbox' : 'disabled',
      checkoutEnabled: false,
      accountId: account.account_id,
      accountEpoch: account.epoch,
      entitlement: ready
        ? await readSandboxEntitlement(account)
        : { entitled: false, status: 'disabled', validUntil: 0 },
      reason: ready
        ? 'Sandbox entitlement verification is available. Checkout and live payments remain disabled; no payment is required for this private preview.'
        : 'Billing is not enabled. No payment is required for this private preview.',
    });
  } catch (e) {
    return failure(e);
  }
}

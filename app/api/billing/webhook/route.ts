import { json, failure, HttpError } from '@/lib/server';
import {
  requireSandboxBillingRuntime,
  rawBillingBody,
} from '@/lib/billing-runtime';
import { enqueueBillingEvent } from '@/lib/billing-store';

/** Dedicated machine endpoint: Stripe signature replaces browser session auth. */
export async function POST(request: Request) {
  try {
    const { billing } = requireSandboxBillingRuntime();
    const raw = await rawBillingBody(request);
    let event;
    try {
      event = await billing.verifyWebhook(
        raw,
        request.headers.get('stripe-signature') ?? '',
      );
    } catch {
      throw new HttpError(400, 'Invalid sandbox webhook signature or event.');
    }
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(raw),
    );
    const hash = Array.from(new Uint8Array(digest), (n) =>
      n.toString(16).padStart(2, '0'),
    ).join('');
    return json(await enqueueBillingEvent(event, hash));
  } catch (e) {
    return failure(e);
  }
}

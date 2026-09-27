import { json, failure, body, HttpError } from '@/lib/server';
import {
  requireSandboxBillingRuntime,
  verifyBillingProcessor,
} from '@/lib/billing-runtime';
import {
  processBillingInbox,
  queueBillingReconciliation,
  retryBillingEvent,
} from '@/lib/billing-store';

/** Invoke from the configured scheduler/queue worker, never a browser session. */
export async function POST(request: Request) {
  try {
    const runtime = requireSandboxBillingRuntime();
    await verifyBillingProcessor(request, runtime.processToken);
    const input = await body(request, 1000);
    if (input.action === 'retry') {
      if (typeof input.eventId !== 'string')
        throw new HttpError(400, 'Choose a failed event.');
      return json(await retryBillingEvent(input.eventId));
    }
    if (!['process', 'reconcile'].includes(String(input.action)))
      throw new HttpError(400, 'Choose process or reconcile.');
    if (
      input.limit !== undefined &&
      (!Number.isSafeInteger(input.limit) ||
        Number(input.limit) < 1 ||
        Number(input.limit) > 10)
    )
      throw new HttpError(400, 'Use a batch size from one to ten.');
    if (input.action === 'reconcile') await queueBillingReconciliation();
    return json(
      await processBillingInbox(runtime.billing, {
        graceSeconds: runtime.graceSeconds,
        limit: input.limit as number | undefined,
      }),
    );
  } catch (e) {
    return failure(e);
  }
}

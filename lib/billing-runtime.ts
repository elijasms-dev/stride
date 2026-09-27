import { env } from 'cloudflare:workers';
import { billingConfig, createSandboxBilling } from './billing.ts';
import { HttpError } from './server.ts';

type SandboxEnvironment = {
  STRIDE_BILLING_MODE?: string;
  STRIPE_TEST_SECRET_KEY?: string;
  STRIPE_TEST_PRICE_ID?: string;
  STRIDE_BILLING_ORIGIN?: string;
  STRIPE_TEST_WEBHOOK_SECRET?: string;
  STRIDE_BILLING_PROCESS_TOKEN?: string;
  STRIDE_BILLING_GRACE_SECONDS?: string;
};
export function sandboxBillingRuntime(
  source: SandboxEnvironment = env as SandboxEnvironment,
) {
  if (source.STRIDE_BILLING_MODE !== 'sandbox') return null;
  const config = billingConfig({
    secretKey: source.STRIPE_TEST_SECRET_KEY,
    priceId: source.STRIPE_TEST_PRICE_ID,
    returnOrigin: source.STRIDE_BILLING_ORIGIN,
    webhookSecret: source.STRIPE_TEST_WEBHOOK_SECRET,
  });
  if (
    !config.webhookSecret?.startsWith('whsec_') ||
    !source.STRIDE_BILLING_PROCESS_TOKEN ||
    source.STRIDE_BILLING_PROCESS_TOKEN.length < 32
  )
    throw new Error(
      'Sandbox webhook signing and a separate machine token are required.',
    );
  const grace = source.STRIDE_BILLING_GRACE_SECONDS ?? '0';
  if (!/^\d+$/.test(grace) || Number(grace) > 604800)
    throw new Error(
      'Choose an explicit sandbox grace period between zero and seven days.',
    );
  return {
    billing: createSandboxBilling(config),
    processToken: source.STRIDE_BILLING_PROCESS_TOKEN,
    graceSeconds: Number(grace),
  };
}
export function requireSandboxBillingRuntime() {
  try {
    const runtime = sandboxBillingRuntime();
    if (runtime) return runtime;
  } catch {
    // Never expose secret configuration or provider diagnostics to a public caller.
  }
  throw new HttpError(
    503,
    'Sandbox billing is not configured. Live payments remain disabled.',
  );
}
export async function verifyBillingProcessor(
  request: Request,
  expected: string,
) {
  const actual = request.headers.get('authorization') ?? '';
  if (actual.length > 512)
    throw new HttpError(401, 'Machine authentication required.');
  const hash = (text: string) =>
    crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  const [a, b] = await Promise.all([hash(actual), hash(`Bearer ${expected}`)]);
  let difference = 0;
  const left = new Uint8Array(a),
    right = new Uint8Array(b);
  for (let i = 0; i < left.length; i++) difference |= left[i] ^ right[i];
  if (difference !== 0)
    throw new HttpError(401, 'Machine authentication required.');
}
export async function rawBillingBody(request: Request) {
  const limit = 100000;
  if (Number(request.headers.get('content-length') ?? 0) > limit)
    throw new HttpError(413, 'Webhook too large.');
  const reader = request.body?.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let raw = '',
    size = 0;
  if (reader)
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new HttpError(413, 'Webhook too large.');
      }
      raw += decoder.decode(part.value, { stream: true });
    }
  return raw + decoder.decode();
}

import { ownerId, json, failure } from '@/lib/server';
import { readAccount } from '@/lib/accounts';
export async function GET(request: Request) {
  try {
    await readAccount(ownerId(request));
    return json({
      enabled: false,
      mode: 'disabled',
      reason:
        'Sandbox adapter prepared. Payment setup and an authenticated machine delivery path are required before billing can be enabled. No payment is required for this private preview.',
    });
  } catch (e) {
    return failure(e);
  }
}

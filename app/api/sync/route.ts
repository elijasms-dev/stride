import { guardAccount } from '@/lib/accounts';
import { ownerId, guardWrite, body, json, failure } from '@/lib/server';
import { syncWorkout } from '@/lib/garmin';
export async function POST(request: Request) {
  try {
    const owner = ownerId(request);
    guardWrite(request);
    const accountContext = await guardAccount(request, owner);
    const b = await body(request);
    return json(
      await syncWorkout(
        owner,
        String(b.id),
        Number(b.version),
        b.action === 'confirm',
        accountContext.epoch,
        b.action === 'check',
      ),
    );
  } catch (e) {
    return failure(e);
  }
}

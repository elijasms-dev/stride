import { beginRequestObservation } from '@/lib/request-observation';
import { guardAccount } from '@/lib/accounts';
import {
  ownerId,
  guardWrite,
  body,
  json,
  failure,
  HttpError,
} from '@/lib/server';
import { syncWorkout } from '@/lib/garmin';
import { enqueueDelivery, runDeliveryJob } from '@/lib/delivery-jobs';
export async function POST(request: Request) {
  const observation = beginRequestObservation(request);
  try {
    const owner = ownerId(request);
    guardWrite(request);
    const accountContext = await guardAccount(request, owner);
    const b = await body(request);
    if (
      b.action !== undefined &&
      (typeof b.action !== 'string' ||
        !['send', 'check', 'confirm'].includes(b.action))
    )
      throw new HttpError(422, 'Choose send, check, or watch confirmation.');
    if (b.action !== 'confirm') {
      const jobId = await enqueueDelivery(
        owner,
        accountContext.epoch,
        typeof b.id === 'string' ? b.id : '',
        Number(b.version),
        b.action === 'check' ? 'check' : 'send',
      );
      return json(await runDeliveryJob(owner, accountContext.epoch, jobId));
    }
    return json(
      await syncWorkout(
        owner,
        String(b.id),
        Number(b.version),
        b.action === 'confirm',
        accountContext.epoch,
        false,
      ),
    );
  } catch (e) {
    return failure(e, observation);
  }
}

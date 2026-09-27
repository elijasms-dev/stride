import { guardAccount, readAccount } from '@/lib/accounts';
import {
  body,
  database,
  failure,
  guardWrite,
  HttpError,
  json,
  ownerId,
} from '@/lib/server';
import { listDeliveryJobs, resumeDeliveryJobs } from '@/lib/delivery-jobs';
import { beginRequestObservation } from '@/lib/request-observation';

export async function GET(request: Request) {
  const observation = beginRequestObservation(request);
  try {
    const owner = ownerId(request),
      account = await readAccount(owner);
    return json({ jobs: await listDeliveryJobs(owner, account.epoch) });
  } catch (error) {
    return failure(error, observation);
  }
}

export async function POST(request: Request) {
  const observation = beginRequestObservation(request);
  try {
    const owner = ownerId(request);
    guardWrite(request);
    const account = await guardAccount(request, owner),
      input = await body(request);
    if (input.action === 'resume')
      return json(await resumeDeliveryJobs(owner, account.epoch));
    if (input.action === 'cancel' && typeof input.id === 'string') {
      const result = await database()
        .prepare(
          "UPDATE delivery_jobs SET status='cancelled',result=?,updated_at=? WHERE owner=? AND epoch=? AND id=? AND status IN ('queued','retry','review') AND EXISTS(SELECT 1 FROM accounts a WHERE a.owner=delivery_jobs.owner AND a.epoch=delivery_jobs.epoch AND a.status='active')",
        )
        .bind(
          JSON.stringify({
            status: 'cancelled',
            message:
              'Pending delivery cancelled; no provider entry was removed.',
          }),
          new Date().toISOString(),
          owner,
          account.epoch,
          input.id,
        )
        .run();
      if (result.meta.changes !== 1)
        throw new HttpError(
          409,
          'This delivery has started or already finished. Refresh to check its status.',
        );
      return json({ jobs: await listDeliveryJobs(owner, account.epoch) });
    }
    throw new HttpError(422, 'Choose resume or cancel for a saved delivery.');
  } catch (error) {
    return failure(error, observation);
  }
}

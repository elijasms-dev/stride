import {
  ownerId,
  guardWrite,
  body,
  json,
  failure,
  HttpError,
  requestLimit,
} from '@/lib/server';
import { guardAccount } from '@/lib/accounts';
import { measure } from '@/lib/measurement';
export async function POST(request: Request) {
  try {
    const owner = ownerId(request);
    guardWrite(request);
    const account = await guardAccount(request, owner),
      b = await body(request, 1000);
    if (b.event !== 'field-invalid')
      throw new HttpError(422, 'Unsupported measurement category.');
    await requestLimit(owner, 'measurement', 20);
    await measure(owner, account.epoch, 'field-invalid');
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}

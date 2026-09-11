import { database } from './server';
export const measurementEvents = [
  'field-invalid',
  'preview-accepted',
  'preview-rejected',
  'activation-accepted',
  'first-workout-completed',
] as const;
export type MeasurementEvent = (typeof measurementEvents)[number];
/** Private daily funnel counters. No runner input, notes, provider payload or cross-site identifier. */
export async function measure(
  owner: string,
  epoch: number,
  event: MeasurementEvent,
) {
  try {
    const now = Math.floor(Date.now() / 1000),
      reset = (Math.floor(now / 86400) + 1) * 86400;
    await database()
      .prepare(
        "INSERT INTO request_limits(owner,bucket,count,reset_at) SELECT owner,?,1,? FROM accounts WHERE owner=? AND epoch=? AND status='active' ON CONFLICT(owner,bucket) DO UPDATE SET count=CASE WHEN reset_at<=? THEN 1 ELSE MIN(count+1,100000) END,reset_at=excluded.reset_at",
      )
      .bind('measure:' + event, reset, owner, epoch, now)
      .run();
  } catch {
    /* Diagnostic availability never changes a successful user action. */
  }
}

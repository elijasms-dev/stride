import { addDays, type Workout } from './engine.ts';

export type DeliveryReceipt = {
  workout_id: string;
  version: number;
  status: string;
  remote_id?: string | null;
  message?: string;
  updated_at?: string;
};

export function shouldReconcile(
  receipt: DeliveryReceipt,
  workout: Workout | undefined,
  version: number,
  today: string,
) {
  if (workout?.status === 'completed') return false;
  if (workout?.status === 'planned' && workout.date < today) return false;
  if (
    (!workout || workout.status === 'skipped') &&
    receipt.status === 'removed'
  )
    return false;
  return (
    receipt.version !== version ||
    ['failed', 'stale', 'sending', 'removed', 'review'].includes(receipt.status)
  );
}

export type RemoteEvent = {
  id?: string | number;
  external_id?: string;
  category?: string;
  start_date_local?: string;
  [key: string]: unknown;
};

// Only our own future, unpaired calendar entries may be cancelled automatically.
export function cancellationDecision(
  event: RemoteEvent,
  id: string,
  today: string,
  pairedEventIds: Set<string>,
) {
  if (event.external_id !== `stride:${id}` || event.category !== 'WORKOUT')
    return 'foreign';
  const date = event.start_date_local?.slice(0, 10);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'unknown';
  if (date < today || pairedEventIds.has(String(event.id))) return 'preserve';
  if (date === today) return 'review';
  return 'remove';
}

/** First uploads use Garmin's rolling seven-day window; existing receipts may need updating. */
export function workoutSendWindow(
  date: string,
  today: string,
  hasReceipt = false,
) {
  if (date < today)
    return {
      allowed: false,
      opens: null,
      reason:
        'This workout is in the past. Download its FIT file if you still need a copy.',
    };
  if (!hasReceipt && date > addDays(today, 6))
    return {
      allowed: false,
      opens: addDays(date, -6),
      reason:
        'Garmin receives the next seven days. This workout can be sent closer to its date.',
    };
  return { allowed: true, opens: null, reason: '' };
}

export function deliveryLabel(
  receipt?: Pick<DeliveryReceipt, 'status' | 'version'>,
  version?: number,
) {
  if (!receipt) return 'Not sent';
  if (version !== undefined && receipt.version !== version)
    return 'Update needed';
  return (
    (
      {
        accepted: 'In Intervals',
        confirmed: 'Seen on your watch',
        stale: 'Update needed',
        review: 'Needs attention',
        failed: 'Needs attention',
        sending: 'Checking delivery',
        removed: 'Removed',
        preserved: 'Previous workout preserved',
      } as Record<string, string>
    )[receipt.status] ?? 'Check delivery'
  );
}

export function garminUploadFailed(event: RemoteEvent): boolean {
  return (
    Array.isArray(event.push_errors) &&
    event.push_errors.some(
      (error: unknown) =>
        !!error &&
        typeof error === 'object' &&
        'service' in error &&
        typeof error.service === 'string' &&
        /garmin/i.test(error.service),
    )
  );
}
export const GARMIN_UPLOAD_ERROR =
  'Your workout is in Intervals.icu, but Garmin reported an upload problem. Check the Garmin connection in Intervals Settings, then check delivery again.';

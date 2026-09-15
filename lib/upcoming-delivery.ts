import { addDays, todayInZone } from './plan/calendar.ts';
import { type Plan } from './plan/types.ts';
import { shouldReconcile, type DeliveryReceipt } from './delivery-policy.ts';

export const GARMIN_CALENDAR_URL = 'https://connect.garmin.com/modern/calendar';
export const MAX_WATCH_SYNC_JOBS = 20;
export type WatchSyncJob = {
  id: string;
  action: 'send' | 'check';
  kind: 'calendar' | 'workout';
};

/** Update old calendar entries first, then send/check the upcoming week once. */
export function watchSyncJobs(
  plan: Plan,
  version: number,
  deliveries: DeliveryReceipt[],
  today = todayInZone(plan.profile.timezone),
): WatchSyncJob[] {
  const upcoming = upcomingWorkouts(plan, today);
  const ids = new Set(upcoming.map((w) => w.id));
  const seen = new Set<string>();
  const jobs: WatchSyncJob[] = [];
  for (const receipt of deliveries) {
    if (ids.has(receipt.workout_id) || seen.has(receipt.workout_id)) continue;
    const workout = plan.workouts.find((w) => w.id === receipt.workout_id);
    if (
      workout?.status === 'planned' &&
      workout.steps.some((s) => s.target?.mode === 'heart-rate')
    )
      continue;
    if (!shouldReconcile(receipt, workout, version, today)) continue;
    seen.add(receipt.workout_id);
    jobs.push({ id: receipt.workout_id, action: 'send', kind: 'calendar' });
  }
  for (const workout of upcoming) {
    if (
      workout.steps.some((s) => s.target?.mode === 'heart-rate') ||
      seen.has(workout.id)
    )
      continue;
    seen.add(workout.id);
    const current = deliveries.some(
      (d) =>
        d.workout_id === workout.id &&
        d.version === version &&
        ['accepted', 'confirmed'].includes(d.status),
    );
    jobs.push({
      id: workout.id,
      action: current ? 'check' : 'send',
      kind: 'workout',
    });
  }
  return jobs;
}

/** Only saved, unfinished prescriptions inside the provider's initial send window. */
export function upcomingWorkouts(
  plan: Plan,
  today = todayInZone(plan.profile.timezone),
) {
  const end = addDays(today, 6);
  return plan.workouts
    .filter((w) => w.status === 'planned' && w.date >= today && w.date <= end)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (a.startTime ?? '').localeCompare(b.startTime ?? ''),
    );
}

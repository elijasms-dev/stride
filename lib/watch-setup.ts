import { type ConnectionSummary } from './connection-status.ts';
import { type DeliveryReceipt } from './delivery-policy.ts';
import { todayInZone } from './plan/calendar.ts';
import { type Plan } from './plan/types.ts';
import { upcomingWorkouts } from './upcoming-delivery.ts';

/** Public receipt metadata returned by /api/state after prescription readback. */
type SetupReceipt = DeliveryReceipt & { connection_generation?: string | null };
export type WatchSetupInput = {
  plan: Plan;
  version: number;
  connection: ConnectionSummary | null;
  deliveries: SetupReceipt[];
  isDemo?: boolean;
  today?: string;
};

/** Pick an existing prescription, never create or upload a synthetic workout. */
export function watchSetupState({
  plan,
  version,
  connection,
  deliveries,
  isDemo = false,
  today = todayInZone(plan.profile.timezone),
}: WatchSetupInput) {
  const upcoming = isDemo
    ? []
    : upcomingWorkouts(plan, today).filter((w) => w.steps.length > 0);
  const direct = upcoming.find(
    (w) => !w.steps.some((s) => s.target?.mode === 'heart-rate'),
  );
  const workout = direct ?? upcoming[0];
  const receipt = workout
    ? deliveries.find((d) => d.workout_id === workout.id)
    : undefined;
  // A reconnect or changed prescription requires fresh evidence. A provider
  // receipt proves receipt in Intervals, while only the user's acknowledgement
  // can establish that they saw this particular workout on their watch.
  const currentReceipt =
    !!connection?.generation &&
    receipt?.connection_generation === connection.generation &&
    receipt?.version === version;
  const providerReceived =
    !!direct &&
    currentReceipt &&
    !!receipt &&
    ['accepted', 'confirmed'].includes(receipt.status);
  const watchConfirmed = providerReceived && receipt?.status === 'confirmed';
  return {
    workout,
    connected: !!connection,
    mode: isDemo ? 'demo' : direct ? 'direct' : workout ? 'fit' : 'empty',
    providerReceived,
    watchConfirmed,
    needsReview: !!direct && !!receipt && !providerReceived,
    completedSteps: [
      !!connection,
      providerReceived,
      providerReceived,
      watchConfirmed,
    ],
  } as const;
}

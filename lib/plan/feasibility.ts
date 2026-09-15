/** Plan feasibility responsibilities; extracted without changing policy or behavior. */
import { schedulingEasyPace } from '../fitness-pacing.ts';
import {
  isLongUltra,
  LONG_ULTRA_POLICY,
  longUltraCapacityMessage,
} from '../ultra-policy.ts';
import { round } from './math.ts';
import { TRAINING_POLICY } from './policy.ts';
import { customExposureKm, raceDistance, trainingFamily } from './profile.ts';
import { type Plan } from './types.ts';

export function refreshFeasibility(plan: Plan, asOf: string) {
  if (
    plan.profile.goal === 'base' ||
    plan.feasibility?.status === 'event-deferred'
  )
    return;
  if (isLongUltra(plan.profile)) {
    const exposure = Math.max(
      0,
      ...plan.workouts
        .filter((w) => w.kind === 'long' && w.status !== 'skipped')
        .map((w) =>
          w.status === 'completed'
            ? (w.feedback?.actualMinutes ?? 0)
            : w.date >= asOf
              ? w.minutes
              : 0,
        ),
    );
    const previousReasons = (plan.feasibility?.reasons ?? []).filter(
      (r) =>
        !r.startsWith('The six weeks before taper') &&
        !r.startsWith('The remaining long-ultra block') &&
        !r.startsWith('The remaining block reaches'),
    );
    const reasons = [
      ...previousReasons,
      exposure < LONG_ULTRA_POLICY.rehearsalMinutes
        ? 'The remaining long-ultra block no longer includes a three-hour endurance rehearsal. Review the event or available time; missing training is not made up.'
        : null,
      longUltraCapacityMessage(plan, asOf),
    ].filter((s): s is string => !!s);
    plan.feasibility = {
      status: reasons.length ? 'review-required' : 'forecast',
      asOf,
      reasons,
    };
    return;
  }
  const required = ['custom', 'ultra'].includes(plan.profile.goal)
    ? customExposureKm(raceDistance(plan.profile))
    : TRAINING_POLICY.family[trainingFamily(plan.profile)]
        .minimumTrainingExposureKm;
  const exposure = Math.max(
    0,
    ...plan.workouts
      .filter((w) => w.kind === 'long' && w.status !== 'skipped')
      .map((w) =>
        w.status === 'completed'
          ? (w.feedback?.actualKm ??
            (w.feedback?.actualMinutes ?? 0) / schedulingEasyPace(plan.profile))
          : w.estimatedKm,
      ),
  );
  if (exposure + 0.01 < required)
    plan.feasibility = {
      status: 'review-required',
      asOf,
      reasons: [
        `These limits leave a longest training exposure of ${round(exposure)} km, below this event policy's ${round(required)} km. Consider more available time, a later event, a shorter distance or a base block. Distance without recorded pace remains an estimate.`,
      ],
    };
}

import { schedulingEasyPace } from './fitness-pacing.ts';
import {
  isRoadRaceProfile,
  roadPeakLongKm,
  roadTrainingPolicy,
} from './road-training-policy.ts';
import { runningDayLimit } from './runner-customization.ts';
import { longRunShareLimit } from './training-structure.ts';
import type { Profile } from './plan/types.ts';

/** Explain binding capacity, rather than promising that a later date fixes it. */
export function roadPreparationConstraint(
  p: Profile,
  requiredKm: number,
): string {
  if (!isRoadRaceProfile(p)) return '';
  const pace = Math.max(
    schedulingEasyPace(p),
    p.workoutTargets?.mode === 'pace'
      ? (p.workoutTargets.pace?.easy?.high ?? 0) / 60
      : 0,
  );
  const weeklyCeiling = Math.min(
    p.weeklyKm *
      (p.volume === 'maintain' ? 1 : roadTrainingPolicy(p).forecastFactor),
    p.peakWeeklyKm ?? Infinity,
    (p.weeklyMinutesLimit ?? Infinity) / pace,
  );
  const ceiling = Math.min(
    roadPeakLongKm(p, p.longestKm, pace),
    p.longLimitKm ?? Infinity,
    p.longMinutes / pace,
    runningDayLimit(p, p.longDay) / pace,
    Math.max(p.longestKm, weeklyCeiling * longRunShareLimit(p)),
  );
  if (ceiling + 0.01 >= requiredKm) return '';
  return ` Current starting-capacity, volume and duration limits cap this forecast below the ${requiredKm} km preparation check. Extra calendar weeks alone do not remove those limits. Build and log a base, then review from recorded running; review any incorrectly entered limits or the event choice. The preparation check is a planning policy, not proof of individual race readiness.`;
}

import { ensureGeneratedQualityRhythm } from './generation-rhythm.ts';
import { PLAN_LOAD_LIMITS } from './policy-constants.ts';
/** Plan generation-reconcile responsibilities; extracted without changing policy or behavior. */
import { schedulingEasyPace } from '../fitness-pacing.ts';
import { peakLongRunKm } from '../progression-engine.ts';
import { runningDayLimit } from '../runner-customization.ts';
import { withWorkoutTargets } from '../workout-targets.ts';
import { addDays, weekday } from './calendar.ts';
import { hasOpeningBaseline } from './generation-baseline.ts';
import { TRAINING_POLICY } from './policy.ts';
import { taperFactor } from './generation-calendar.ts';
import { trainingFamily } from './profile.ts';
import { refreshWeekTotals } from './totals.ts';
import { type Plan } from './types.ts';

/** Intersect the whole-kilometre forecast with every final session capacity.
 * A backward pass lowers earlier targets when a later ordinary week cannot fund
 * them; it never adds minutes, alters history, or creates an unmarked cutback. */
export function normalizeGeneratedLongRuns(
  plan: Plan,
  from: string,
  protectedIds: readonly string[] = [],
) {
  if (plan.policyVersion !== TRAINING_POLICY.version || plan.returnState)
    return;
  const ceiling =
    trainingFamily(plan.profile) === 'marathon'
      ? PLAN_LOAD_LIMITS.maximumMarathonLongKm
      : Infinity;
  const longPace = Math.max(
    schedulingEasyPace(plan.profile),
    plan.profile.workoutTargets?.mode === 'pace'
      ? (plan.profile.workoutTargets.pace?.easy?.high ?? 0) / 60
      : 0,
  );
  let nextBuildCeiling = ceiling;
  const opening = hasOpeningBaseline(plan);
  const familiarLong = plan.baselineEvidence
    ? Math.min(
        plan.baselineEvidence.longestKm,
        (plan.baselineEvidence.longestMinutes ?? Infinity) / longPace,
      )
    : plan.profile.longestKm;
  for (const week of [...plan.weeks].reverse()) {
    if (week.start < from) continue;
    const long = plan.workouts.find(
      (w) => w.week === week.index && w.kind === 'long',
    );
    if (
      !long ||
      protectedIds.includes(long.id) ||
      long.status !== 'planned' ||
      long.returnRole ||
      (long.changed && long.changeSource !== 'preferences')
    )
      continue;
    const ordinary =
      !['Recovery', 'Taper', 'Race week'].includes(week.phase) &&
      taperFactor(plan.profile, addDays(week.start, 6)) >= 1;
    const keepBaseline = ordinary && opening && week.index === 0;
    const fractionalHold =
      ordinary &&
      Math.abs(long.estimatedKm - familiarLong) < 1e-6 &&
      (plan.profile.volume === 'maintain' ||
        Math.ceil(long.estimatedKm) >
          Math.min(
            // An already familiar distance above the family forecast is a hold,
            // not permission to round upward past that forecast or downward.
            peakLongRunKm(
              trainingFamily(plan.profile),
              familiarLong,
              plan.profile.intent,
            ),
            plan.profile.longLimitKm ?? Infinity,
            plan.profile.longMinutes / longPace,
            runningDayLimit(plan.profile, weekday(long.date)) / longPace,
            ((plan.profile.weeklyMinutesLimit ?? Infinity) -
              plan.workouts
                .filter(
                  (w) =>
                    w.week === week.index &&
                    w !== long &&
                    w.kind !== 'race' &&
                    w.status !== 'skipped',
                )
                .reduce((sum, w) => sum + w.minutes, 0)) /
              longPace,
          ));
    const km = Math.min(
      ceiling,
      keepBaseline || fractionalHold
        ? long.estimatedKm
        : long.estimatedKm < 1
          ? long.estimatedKm
          : Math.floor(long.estimatedKm + 1e-6),
      ordinary ? nextBuildCeiling : ceiling,
    );
    if (ordinary) nextBuildCeiling = km;
    if (long.estimatedKm !== km) {
      long.estimatedKm = km;
      Object.assign(long, withWorkoutTargets(long, plan.profile));
    }
  }
  refreshWeekTotals(plan);
}

/** Backward-compatible entry point; standard rhythm now covers all event families. */
export function ensureGeneratedMarathonRhythm(plan: Plan, from: string) {
  ensureGeneratedQualityRhythm(plan, from);
}

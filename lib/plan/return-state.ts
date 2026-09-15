import {
  PLAN_LOAD_LIMITS,
  RETURN_TRAINING_POLICY,
} from './policy-constants.ts';
/** Plan return-state responsibilities; extracted without changing policy or behavior. */
import { schedulingEasyPace } from '../fitness-pacing.ts';
import { distanceEstimate, runWalkIntervalSeconds } from '../prescription.ts';
import { isRunWalkWorkout } from '../run-walk.ts';
import { trainingRecords } from '../training-history.ts';
import { desiredRuns } from '../training-structure.ts';
import { resizeWorkout } from '../workout-library.ts';
import { rebalanceFutureQuality } from './allocate.ts';
import { addDays, dayDiff } from './calendar.ts';
import { PlanError } from './errors.ts';
import { type Plan } from './types.ts';

export function applyReturnStage(plan: Plan, asOf: string) {
  const state = plan.returnState!;
  const pace = schedulingEasyPace(plan.profile);
  const factor =
    state.stage === 1
      ? RETURN_TRAINING_POLICY.firstStageFraction
      : RETURN_TRAINING_POLICY.secondStageFraction;
  // Keep recorded time and distance as independent ceilings. Older saved
  // stages predate time evidence and retain their distance-based fallback.
  const baselineMinutes = Math.min(
    state.baselineKm * pace,
    state.baselineMinutes ?? Infinity,
  );
  const longestMinutes = Math.min(
    state.longestKm * pace,
    state.longestMinutes ?? Infinity,
  );
  const insufficientDuration = () =>
    new PlanError(
      'Your recent recorded running is too limited for an automatic return on these training days. Review your starting routine before creating a return schedule. Your saved journal has not changed.',
    );
  if (
    baselineMinutes * factor <
    plan.profile.days.length * PLAN_LOAD_LIMITS.minimumSessionMinutes
  )
    throw insufficientDuration();
  for (const week of plan.weeks) {
    const upcoming = plan.workouts.filter(
      (w) =>
        w.week === week.index &&
        w.status === 'planned' &&
        w.kind !== 'race' &&
        w.date > state.to &&
        w.date >= asOf,
    );
    for (const w of upcoming) {
      w.returnRole ??= w.kind;
      w.returnCeilingMinutes ??= w.minutes;
      if (w.session === 'PM') {
        w.status = 'skipped';
        w.skipReason = 'Return stage: single sessions only';
        w.changeSource = 'preferences';
        continue;
      }
      const long = state.stage === 2 && w.returnRole === 'long' && !w.pairId;
      const roleCap = long
        ? Math.min(
            longestMinutes * RETURN_TRAINING_POLICY.longRunFraction,
            plan.profile.longMinutes,
            (plan.profile.longLimitKm ?? Infinity) * pace,
          )
        : Math.min(
            plan.profile.weekdayMinutes,
            (plan.profile.easyLimitKm ?? Infinity) * pace,
          );
      const normal = (baselineMinutes * factor) / plan.profile.days.length;
      const minutes = Math.floor(
        Math.min(
          w.returnCeilingMinutes,
          roleCap,
          long
            ? longestMinutes * RETURN_TRAINING_POLICY.longRunFraction
            : normal,
        ),
      );
      if (minutes < PLAN_LOAD_LIMITS.minimumSessionMinutes)
        throw insufficientDuration();
      Object.assign(
        w,
        resizeWorkout(
          {
            ...w,
            minutes: w.returnCeilingMinutes,
            estimatedKm: w.returnCeilingMinutes / pace,
            templateId: undefined,
            kind: long ? 'long' : 'easy',
          },
          plan.profile,
          'Recovery',
          minutes,
        ),
        {
          title: long ? 'Return: easy long run' : 'Return: short easy run',
          returnStage: state.stage,
          returnStageStarted: state.stageStarted,
          purpose:
            state.stage === 1
              ? 'Short, conversational running. Stay at this stage until recent logs show comfortable tolerance.'
              : 'Reintroduce an easy long run within the reduced baseline; intensity remains paused.',
          changed: true,
        },
      );
      if (w.changeSource !== 'manual') w.changeSource = 'preferences';
      w.distanceEstimate = distanceEstimate(w.steps, plan.profile);
    }
    const remaining = upcoming.filter((w) => w.status === 'planned');
    const total = remaining.reduce((n, w) => n + w.minutes, 0),
      ceiling = baselineMinutes * factor;
    if (total > ceiling)
      for (const w of remaining) {
        const minutes = Math.floor((w.minutes * ceiling) / total);
        if (minutes < PLAN_LOAD_LIMITS.minimumSessionMinutes)
          throw insufficientDuration();
        Object.assign(w, resizeWorkout(w, plan.profile, 'Recovery', minutes));
      }
  }
  return rebalanceFutureQuality(plan, asOf);
}

/** Three observed outings must fit the selected routine without adding runs.
 * This observation window is a product heuristic, not a rehabilitation rule. */
export function progressionReviewWindow(
  plan: Plan,
  asOf: string,
  stageStarted: string,
) {
  const windowDays =
    desiredRuns(plan.profile) === RETURN_TRAINING_POLICY.lowFrequencyRuns
      ? RETURN_TRAINING_POLICY.lowFrequencyReviewDays
      : RETURN_TRAINING_POLICY.regularReviewDays;
  return {
    windowDays,
    from: [stageStarted, addDays(asOf, -windowDays)].sort().at(-1)!,
    period:
      windowDays === RETURN_TRAINING_POLICY.lowFrequencyReviewDays
        ? 'the last two weeks'
        : 'the last week',
  };
}

export function returnReview(plan: Plan, asOf: string) {
  const state = plan.returnState;
  if (!state || state.stage === 3 || asOf <= state.to) return null;
  const { from, windowDays, period } = progressionReviewWindow(
    plan,
    asOf,
    state.stageStarted,
  );
  const recent = trainingRecords(plan).filter(
    (r) => r.date >= from && r.date <= asOf,
  );
  const prescriptions = new Map(plan.workouts.map((w) => [w.id, w]));
  const runs = recent.filter((r) => {
    if (!r.workoutId || r.date >= asOf) return false;
    const workout = prescriptions.get(r.workoutId);
    if (workout?.returnStage !== undefined)
      return (
        workout.returnStage === state.stage &&
        workout.returnStageStarted === state.stageStarted
      );
    // Legacy prescriptions have no stage stamp. The transition date may hold
    // a completed prior-stage run; do not infer that it belongs to stage two.
    return state.stage === 1 || r.date > state.stageStarted;
  });
  const comfortable = runs.filter(
    (r) =>
      r.expectedEasy &&
      r.feeling !== 'tired' &&
      r.effort <= RETURN_TRAINING_POLICY.comfortableReturnEffort &&
      r.minutes >=
        r.prescribedMinutes! * RETURN_TRAINING_POLICY.returnCompletionFraction,
  );
  const fatigue = recent.some(
    (r) =>
      r.feeling === 'tired' || r.effort >= RETURN_TRAINING_POLICY.fatigueEffort,
  );
  const enough =
    dayDiff(state.stageStarted, asOf) >=
      RETURN_TRAINING_POLICY.minimumStageDays &&
    comfortable.length >= RETURN_TRAINING_POLICY.requiredComfortableRuns &&
    new Set(comfortable.map((r) => r.date)).size >=
      RETURN_TRAINING_POLICY.requiredComfortableRuns &&
    !fatigue;
  return {
    ready: enough,
    stage: state.stage,
    completed: comfortable.length,
    required: RETURN_TRAINING_POLICY.requiredComfortableRuns,
    windowDays,
    evidence: `return:${state.stage}:${recent.map((r) => [r.id, r.date, r.recordedAt, r.feeling, r.effort].join(':')).join('|')}`,
    reason: enough
      ? `At least three completed easy runs at this stage during ${period} felt comfortable. Preview the next stage.`
      : fatigue
        ? 'Recent running, including today and any extra runs, includes tired feedback or a high effort. Stay at this stage and review recovery before progressing.'
        : `Log three comfortable easy runs on separate days at this stage during ${period}, with at least a week at this stage. Keep your usual running days; unlogged sessions and today's run do not count toward progression.`,
  };
}

export function noviceReview(plan: Plan, asOf: string) {
  if (
    plan.profile.experience !== 'new' ||
    (plan.profile.runWalkStage ?? 0) >=
      RETURN_TRAINING_POLICY.finalRunWalkStage ||
    (plan.returnState && plan.returnState.stage < 3)
  )
    return null;
  const stage = plan.profile.runWalkStage ?? 0;
  const changed = plan.baselineEvidence?.asOf ?? plan.profile.startDate;
  const { from, windowDays, period } = progressionReviewWindow(
    plan,
    asOf,
    changed,
  );
  const recent = trainingRecords(plan).filter(
    (r) => r.date >= from && r.date <= asOf,
  );
  const workoutsById = new Map(plan.workouts.map((w) => [w.id, w]));
  const currentStageIds = new Set(
    plan.workouts
      .filter(
        (w) =>
          isRunWalkWorkout(w) &&
          Math.max(
            0,
            ...w.steps
              .filter((s) => s.movement === 'run')
              .map((s) => s.seconds),
          ) === runWalkIntervalSeconds(stage),
      )
      .map((w) => w.id),
  );
  const comfortable = recent.filter(
    (r) =>
      r.workoutId &&
      currentStageIds.has(r.workoutId) &&
      r.expectedEasy &&
      r.date < asOf &&
      r.feeling !== 'tired' &&
      r.effort <= RETURN_TRAINING_POLICY.comfortableNoviceEffort &&
      r.minutes >=
        r.prescribedMinutes! * RETURN_TRAINING_POLICY.noviceCompletionFraction,
  );
  // Total outing time includes walking. Only the runner can confirm that the
  // intended running intervals were completed; provider summaries cannot.
  const executionFor = (id: string | undefined) =>
    id ? workoutsById.get(id)?.feedback?.execution : undefined;
  const runs = comfortable.filter(
    (r) => executionFor(r.workoutId) === 'as-planned',
  );
  const completedDates = new Set(runs.map((r) => r.date));
  const unconfirmedWorkoutIds = comfortable
    .filter((r) => {
      const execution = executionFor(r.workoutId);
      return (
        !completedDates.has(r.date) &&
        (execution === undefined || execution === 'unknown')
      );
    })
    .map((r) => r.workoutId!);
  const fatigue = recent.some(
    (r) =>
      r.feeling === 'tired' || r.effort >= RETURN_TRAINING_POLICY.fatigueEffort,
  );
  return {
    ready:
      !fatigue &&
      completedDates.size >= RETURN_TRAINING_POLICY.requiredComfortableRuns &&
      dayDiff(changed, asOf) >= RETURN_TRAINING_POLICY.minimumStageDays,
    stage,
    completed: completedDates.size,
    unconfirmedWorkoutIds,
    required: RETURN_TRAINING_POLICY.requiredComfortableRuns,
    windowDays,
    heldForFatigue: fatigue,
    reason: fatigue
      ? 'Recent running, including today and any extra runs, includes tired feedback or a high effort. Keep the current running intervals and review recovery before progressing.'
      : `Log three comfortable easy sessions on separate days at the current run-walk stage during ${period}, confirming that you completed the running intervals, with at least a week at this stage. Keep your usual running days; today's run does not yet count toward progression.`,
    evidence: `walk:${stage}:${recent.map((r) => [r.id, r.date, r.recordedAt, r.feeling, r.effort, r.minutes, executionFor(r.workoutId)].join(':')).join('|')}`,
  };
}

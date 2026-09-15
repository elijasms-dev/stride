import {
  PLAN_LOAD_LIMITS,
  RETURN_TRAINING_POLICY,
} from './policy-constants.ts';
/** Plan adjust responsibilities; extracted without changing policy or behavior. */
import { schedulingEasyPace } from '../fitness-pacing.ts';
import { distanceEstimate } from '../prescription.ts';
import { applyPreferredStartTimes } from '../runner-customization.ts';
import {
  currentTrainingBaseline,
  trainingRecords,
} from '../training-history.ts';
import { resizeWorkout } from '../workout-library.ts';
import { rebalanceFutureQuality } from './allocate.ts';
import {
  addDays,
  dayDiff,
  monday,
  todayInZone,
  validDate,
  weekday,
} from './calendar.ts';
import { PlanError } from './errors.ts';
import { trainingPhaseOn } from './generation-calendar.ts';
import { applyReturnStage } from './return-state.ts';
import { type Plan } from './types.ts';
import { validatePlan } from './validate.ts';

export function shortenWorkout(
  plan: Plan,
  id: string,
  minutes: number,
  asOf: string,
): Plan {
  const next = structuredClone(plan),
    w = next.workouts.find((w) => w.id === id);
  if (
    !w ||
    w.status !== 'planned' ||
    w.date < asOf ||
    w.kind === 'race' ||
    !Number.isInteger(minutes) ||
    minutes < PLAN_LOAD_LIMITS.minimumSessionMinutes ||
    minutes > w.minutes
  )
    throw new PlanError(
      'Choose an upcoming training session and a shorter duration of at least five minutes.',
    );
  Object.assign(
    w,
    resizeWorkout(
      w,
      next.profile,
      trainingPhaseOn(next.profile, next.weeks[w.week].phase, w.date),
      minutes,
    ),
    {
      changed: true,
      changeSource: 'manual',
    },
  );
  w.distanceEstimate = distanceEstimate(w.steps, next.profile);
  rebalanceFutureQuality(next, asOf);
  const errors = validatePlan(next);
  if (errors.length) throw new PlanError(errors[0]);
  return next;
}

export function moveWorkout(
  plan: Plan,
  id: string,
  date: string,
  asOf: string,
): Plan {
  const next = structuredClone(plan),
    s = next.workouts.find((s) => s.id === id);
  if (!s || s.status !== 'planned' || s.kind === 'race')
    throw new PlanError('Only upcoming training sessions can be moved.');
  if (s.date < asOf)
    throw new PlanError(
      'Past sessions stay in your history. Mark a missed run as skipped.',
    );
  if (!validDate(date) || date < asOf || monday(date) !== monday(s.date))
    throw new PlanError(
      'Move a session to today or later within the same week. Use plan adjustments for a longer break.',
    );
  if (s.pairId) {
    const pair = next.workouts.filter((w) => w.pairId === s.pairId);
    if (
      pair.some((w) => w.status !== 'planned') ||
      next.workouts.some((w) => w.date === date && w.pairId !== s.pairId)
    )
      throw new PlanError(
        'Move both paired sessions to an empty day before either is completed.',
      );
    for (const w of pair) {
      w.date = date;
      w.changed = true;
      w.changeSource = 'manual';
    }
    const timingError = applyPreferredStartTimes(pair, next.profile);
    if (timingError) throw new PlanError(timingError);
    const errors = validatePlan(next);
    if (errors.length) throw new PlanError(errors[0]);
    return next;
  }
  const previousDate = s.date;
  const other = next.workouts.find((w) => w.date === date && w.id !== id);
  if (other) {
    if (other.status !== 'planned' || other.kind === 'race' || other.pairId)
      throw new PlanError('That date has a completed session or race.');
    other.date = s.date;
    other.changed = true;
    other.changeSource = 'manual';
  }
  s.date = date;
  s.changed = true;
  s.changeSource = 'manual';
  const moved = [s, ...(other ? [other] : [])];
  for (const w of moved) {
    const oldPreference = next.profile.dayPreferences?.find(
      (d) => d.day === weekday(w === s ? previousDate : date),
    );
    if (oldPreference?.startTime === w.startTime) delete w.startTime;
  }
  const timingError = applyPreferredStartTimes(moved, next.profile);
  if (timingError) throw new PlanError(timingError);
  const errors = validatePlan(next);
  if (errors.length) throw new PlanError(errors[0]);
  return next;
}

export function adjustPlan(
  plan: Plan,
  from: string,
  to: string,
  mode: 'easy' | 'rest',
  asOf: string,
): Plan {
  if (
    !validDate(from) ||
    !validDate(to) ||
    from < plan.profile.startDate ||
    to < from ||
    dayDiff(from, to) > RETURN_TRAINING_POLICY.maximumBreakDayDifference ||
    from > plan.profile.raceDate ||
    to < addDays(asOf, -RETURN_TRAINING_POLICY.recentBreakWindowDays)
  )
    throw new PlanError(
      'Choose a break of 1–21 days beginning within the plan, or a recent break to record.',
    );
  const next = structuredClone(plan),
    baseline = currentTrainingBaseline(plan, from > asOf ? asOf : from);
  for (const w of next.workouts) {
    if (w.status !== 'planned' || w.date < from || w.date > to) continue;
    if (mode === 'rest' || w.kind === 'race') {
      w.status = 'skipped';
      w.skipReason =
        w.kind === 'race'
          ? 'Race deferred during requested recovery'
          : 'Planned break';
    } else {
      w.returnRole ??= w.kind;
      w.returnCeilingMinutes ??= w.minutes;
      const minutes = Math.max(
        PLAN_LOAD_LIMITS.minimumSessionMinutes,
        Math.floor(
          Math.min(
            w.minutes * RETURN_TRAINING_POLICY.easyAdjustmentFraction,
            next.profile.weekdayMinutes,
            (next.profile.easyLimitKm ?? Infinity) *
              schedulingEasyPace(next.profile),
          ),
        ),
      );
      Object.assign(
        w,
        resizeWorkout(
          { ...w, templateId: undefined, kind: 'easy' },
          next.profile,
          'Recovery',
          minutes,
        ),
        { title: 'Gentle easy run' },
      );
    }
    w.changed = true;
    w.changeSource = 'manual';
    w.distanceEstimate = distanceEstimate(w.steps, next.profile);
  }
  next.returnState = {
    from,
    to,
    stage: 1,
    stageStarted: addDays(to, 1),
    baselineKm: baseline.weeklyKm,
    longestKm: baseline.longestKm,
    baselineMinutes: baseline.weeklyMinutes,
    longestMinutes: baseline.longestMinutes,
    reason:
      mode === 'rest'
        ? 'Return after time away'
        : 'Return after reduced training',
  };
  next.feasibility = {
    status: to >= plan.profile.raceDate ? 'event-deferred' : 'review-required',
    asOf,
    reasons: [
      to >= plan.profile.raceDate
        ? 'Your recovery decision includes race day. The event is deferred; choose a new date or a new block when ready.'
        : 'Training restarts below the recent baseline. Advance through the return stages only after logged comfortable running; the old peak forecast is paused.',
    ],
  };
  next.notes.push(
    'Return stages: short easy running → easy running with a capped long run → a reviewed, newly based training block. Missing logs never advance a stage.',
  );
  return applyReturnStage(next, asOf);
}

export function suggestedAdjustment(
  plan: Plan,
  asOf = todayInZone(plan.profile.timezone),
) {
  const recent = trainingRecords(plan)
    .filter(
      (r) =>
        r.date <= asOf &&
        dayDiff(r.date, asOf) <= RETURN_TRAINING_POLICY.suggestionWindowDays,
    )
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, RETURN_TRAINING_POLICY.suggestionSampleRuns);
  if (
    recent.length >= RETURN_TRAINING_POLICY.suggestionTriggerRuns &&
    recent.filter(
      (r) =>
        r.feeling === 'tired' ||
        (r.expectedEasy && r.effort >= RETURN_TRAINING_POLICY.fatigueEffort),
    ).length >= RETURN_TRAINING_POLICY.suggestionTriggerRuns
  )
    return {
      title: 'Make some room to recover',
      reason:
        'At least two of your last three runs included tiredness or unexpectedly high effort on an easy day. Review a lighter stretch.',
      evidence: recent
        .map((r) => [r.id, r.date, r.recordedAt, r.feeling, r.effort].join(':'))
        .join('|'),
    };
  const missed = plan.workouts.filter(
    (s) =>
      s.week >= 0 &&
      s.status === 'skipped' &&
      s.date <= asOf &&
      dayDiff(s.date, asOf) <= RETURN_TRAINING_POLICY.suggestionWindowDays,
  );
  if (missed.length >= RETURN_TRAINING_POLICY.suggestionTriggerRuns)
    return {
      title: 'Find your rhythm again',
      reason:
        'You skipped at least two runs in the last fortnight. Review a lighter stretch before continuing the forecast.',
      evidence: 'missed:' + missed.map((s) => s.id).join(':'),
    };
  return null;
}

import {
  PLAN_LOAD_LIMITS,
  PROFILE_TRAINING_LIMITS,
  RETURN_TRAINING_POLICY,
} from './policy-constants.ts';
/** Plan revise responsibilities; extracted without changing policy or behavior. */
import { schedulingEasyPace } from '../fitness-pacing.ts';
import { applyPreferredStartTimes } from '../runner-customization.ts';
import { currentTrainingBaseline } from '../training-history.ts';
import { isLongUltra } from '../ultra-policy.ts';
import { resizeWorkout } from '../workout-library.ts';
import {
  applyActualTrainingEnvelope,
  rebalanceFutureQuality,
} from './allocate.ts';
import { dateLabel } from './calendar.ts';
import { PlanError } from './errors.ts';
import { refreshFeasibility } from './feasibility.ts';
import { makePlan } from './generate.ts';
import { trainingPhaseOn, usesDailyTaperPhase } from './generation-calendar.ts';
import { TRAINING_POLICY } from './policy.ts';
import { validateProfile } from './profile.ts';
import {
  applyReturnStage,
  noviceReview,
  returnReview,
} from './return-state.ts';
import { refreshWeekTotals } from './totals.ts';
import { type Plan, type PreferencePatch, type Profile } from './types.ts';
import { validatePlan } from './validate.ts';

export function advanceReturn(plan: Plan, asOf: string): Plan {
  const review = returnReview(plan, asOf);
  if (!review?.ready)
    throw new PlanError(
      review?.reason ?? 'There is no active return stage to advance.',
    );
  if (plan.returnState!.stage === 1) {
    const next = structuredClone(plan);
    next.returnState!.stage = 2;
    next.returnState!.stageStarted = asOf;
    return applyReturnStage(next, asOf);
  }
  const next = revisePreferences(
    { ...plan, returnState: undefined },
    {
      method: 'balanced',
      difficulty: 'gentle',
      volume: 'maintain',
      marathonApproach: 'balanced',
    } as PreferencePatch,
    asOf,
    true,
  );
  next.returnState = { ...plan.returnState!, stage: 3, stageStarted: asOf };
  next.notes.push(
    'Return review completed. The next block of work uses the recorded baseline, gentle quality and maintained volume. Advanced pairs remain off until deliberately reviewed again.',
  );
  return next;
}

export function revisePreferences(
  plan: Plan,
  patch: PreferencePatch,
  asOf: string,
  forceReplan = false,
): Plan {
  if (asOf > plan.profile.raceDate)
    throw new PlanError('This block has finished. Start a new plan.');
  // A reviewed policy upgrade must rebuild upcoming prescriptions even when
  // the runner keeps the same preferences. Preview and apply share this path.
  forceReplan ||= plan.policyVersion !== TRAINING_POLICY.version;
  const allowed = [
    'days',
    'longDay',
    'weekdayMinutes',
    'longMinutes',
    'volume',
    'difficulty',
    'qualitySessions',
    'availableDays',
    'runsPerWeek',
    'qualityMode',
    'recoveryWeeks',
    'terrain',
    'easyLimitKm',
    'qualityLimitKm',
    'longLimitKm',
    'peakWeeklyKm',
    'intent',
    'recentQualitySessions',
    'marathonApproach',
    'method',
    'stableWeeks',
    'easyDoubleWeeks',
    'recentSessionsPerWeek',
    'recentQualityMinutes',
    'doubleDays',
    'doubleGapHours',
    'thresholdControl',
    'thresholdCeiling',
    'preferredHardDays',
    'crossTraining',
    'carbsPerHour',
    'practiceInDark',
    'dayPreferences',
    'weeklyMinutesLimit',
    'workoutFormat',
    'workoutVariety',
    'recentRace',
  ] as const;
  const profile = { ...plan.profile };
  for (const key of allowed)
    if (patch[key] !== undefined) Object.assign(profile, { [key]: patch[key] });
  const defaults: Partial<Record<keyof Profile, unknown>> = {
    terrain: 'flat',
    qualitySessions:
      plan.profile.goal === 'base'
        ? 0
        : PLAN_LOAD_LIMITS.weekdayQualitySessions,
    recoveryWeeks: PROFILE_TRAINING_LIMITS.defaultRecoveryWeeks,
    intent: 'improve',
    method: 'balanced',
    marathonApproach: 'balanced',
    preferredHardDays: [],
    crossTraining: [],
    carbsPerHour: null,
    practiceInDark: false,
    dayPreferences: [],
    weeklyMinutesLimit: null,
    workoutFormat: 'automatic',
    workoutVariety: 'varied',
  };
  const comparable = (p: Profile, key: (typeof allowed)[number]) => {
    const value = p[key] ?? defaults[key] ?? null;
    return JSON.stringify(
      Array.isArray(value)
        ? [...value].sort((a, b) =>
            typeof a === 'number' && typeof b === 'number'
              ? a - b
              : a.day - b.day,
          )
        : value,
    );
  };
  if (
    !forceReplan &&
    allowed.every(
      (key) => comparable(profile, key) === comparable(plan.profile, key),
    )
  )
    return structuredClone(plan);
  const changedKeys = allowed.filter(
    (key) => comparable(profile, key) !== comparable(plan.profile, key),
  );
  if (
    !forceReplan &&
    changedKeys.every((key) => ['carbsPerHour', 'practiceInDark'].includes(key))
  ) {
    const next = structuredClone(plan);
    next.profile = validateProfile(profile, profile.startDate);
    return next;
  }
  const localKeys = [
    'dayPreferences',
    'weeklyMinutesLimit',
    'terrain',
    'easyLimitKm',
    'qualityLimitKm',
    'longLimitKm',
    'peakWeeklyKm',
    'weekdayMinutes',
    'longMinutes',
    'carbsPerHour',
    'practiceInDark',
  ];
  // Raising a session limit should let a reviewed rebuild use the runner's
  // existing baseline. It does not establish a higher baseline: recent history,
  // elapsed allocations, manual edits and taper still govern the rebuild.
  const moreSessionRoom =
    profile.weekdayMinutes > plan.profile.weekdayMinutes ||
    profile.longMinutes > plan.profile.longMinutes;
  if (
    !forceReplan &&
    !moreSessionRoom &&
    changedKeys.every((key) => localKeys.includes(key))
  ) {
    const next = structuredClone(plan);
    next.profile = validateProfile(profile, profile.startDate);
    next.constraintsFrom = asOf;
    const pace = schedulingEasyPace(profile);
    for (const w of next.workouts) {
      if (w.date < asOf || w.status !== 'planned' || w.kind === 'race')
        continue;
      const cap =
        w.kind === 'long'
          ? Math.min(
              profile.longMinutes,
              (profile.longLimitKm ?? Infinity) * pace,
            )
          : Math.min(
              profile.weekdayMinutes,
              (w.hard
                ? (profile.qualityLimitKm ?? Infinity)
                : (profile.easyLimitKm ?? Infinity)) * pace,
            );
      if (w.minutes <= cap) continue;
      if (w.changed && w.changeSource !== 'preferences')
        throw new PlanError(
          `Your deliberate edit on ${dateLabel(w.date)} exceeds this new limit. Review that workout before lowering the ceiling.`,
        );
      Object.assign(
        w,
        resizeWorkout(
          w,
          profile,
          trainingPhaseOn(next.profile, next.weeks[w.week].phase, w.date),
          Math.max(PLAN_LOAD_LIMITS.minimumSessionMinutes, Math.floor(cap)),
        ),
        { changed: true, changeSource: 'preferences' },
      );
      w.reason =
        'Your lower session ceiling reduced this workout. The block phase and other sessions remain in place.';
    }
    for (const week of next.weeks) {
      const upcoming = next.workouts.filter(
        (w) =>
          w.week === week.index &&
          w.date >= asOf &&
          w.status === 'planned' &&
          w.kind !== 'race',
      );
      const retained = next.workouts
        .filter(
          (w) =>
            w.week === week.index &&
            w.kind !== 'race' &&
            w.status !== 'skipped' &&
            !upcoming.includes(w),
        )
        .reduce((n, w) => n + w.minutes, 0);
      const total = upcoming.reduce((n, w) => n + w.minutes, 0);
      const available = (profile.peakWeeklyKm ?? Infinity) * pace - retained;
      if (available < 0 && upcoming.length)
        throw new PlanError(
          'Completed running already exceeds that weekly ceiling. Choose a ceiling that leaves room for the remaining week, or rest individual sessions.',
        );
      if (total > available)
        for (const w of upcoming) {
          if (w.changed && w.changeSource !== 'preferences')
            throw new PlanError(
              'A deliberate future edit conflicts with the new weekly ceiling. Review that workout first.',
            );
          Object.assign(
            w,
            resizeWorkout(
              w,
              profile,
              usesDailyTaperPhase(profile)
                ? trainingPhaseOn(profile, week.phase, w.date)
                : week.phase,
              Math.max(
                PLAN_LOAD_LIMITS.minimumSessionMinutes,
                Math.floor((w.minutes * available) / total),
              ),
            ),
            { changed: true, changeSource: 'preferences' },
          );
        }
    }
    next.notes.push(
      'Session limits are ceilings. Lower limits affect the relevant upcoming work; larger limits do not automatically add training. Terrain describes routes available for appropriate alternatives.',
    );
    applyActualTrainingEnvelope(next, asOf);
    rebalanceFutureQuality(next, asOf);
    const timeCandidates = structuredClone(
      next.workouts.filter((w) => w.date >= asOf),
    );
    const timingError = applyPreferredStartTimes(
      timeCandidates,
      next.profile,
      plan.profile,
    );
    if (timingError) throw new PlanError(timingError);
    for (const timed of timeCandidates) {
      const saved = next.workouts.find((w) => w.id === timed.id)!;
      if (timed.startTime === saved.startTime) continue;
      if (saved.changed && saved.changeSource !== 'preferences')
        throw new PlanError(
          `Your deliberate edit on ${dateLabel(saved.date)} keeps its start time. Review that workout before changing this day’s timing.`,
        );
      saved.startTime = timed.startTime;
      saved.changed = true;
      saved.changeSource = 'preferences';
      saved.reason =
        'The start time follows your reviewed day-by-day schedule.';
    }
    refreshFeasibility(next, asOf);
    const issues = validatePlan(next);
    if (issues.length) throw new PlanError(issues[0]);
    return next;
  }
  const baseline = currentTrainingBaseline(plan, asOf);
  const generated = makePlan(profile, profile.startDate, false, {
    from: asOf,
    baseline,
    preserveProgression: baseline.supportsProgression,
    referenceRuns: plan.profile.days.length,
    history: plan.workouts.filter((w) => w.status === 'completed'),
    retainedPrefix: plan.workouts.filter(
      (w) => w.date < asOf || w.status === 'completed',
    ),
  });
  generated.notes.push(baseline.explanation);
  const history = plan.workouts.filter(
    (w) => w.date < asOf || w.status === 'completed',
  );
  const overrides = plan.workouts.filter(
    (w) =>
      w.date >= asOf &&
      w.status !== 'completed' &&
      ((w.status === 'skipped' &&
        w.skipReason !== 'Return stage: single sessions only') ||
        (w.changed && w.changeSource !== 'preferences')),
  );
  const retainedDates = new Set(
    [...history, ...overrides]
      .filter((w) => w.week >= 0)
      .flatMap((w) => [w.date, w.originalDate]),
  );
  for (const w of plan.workouts.filter(
    (w) => w.date >= asOf && w.status !== 'completed',
  ))
    if (
      w.pairId &&
      [...history, ...overrides].some((o) => o.pairId === w.pairId) &&
      !overrides.some((o) => o.id === w.id)
    )
      overrides.push(w);
  const reservedIds = new Set(plan.workouts.map((w) => w.id));
  const future = generated.workouts
    .filter((w) => w.date >= asOf && !retainedDates.has(w.date))
    .map((w) => {
      const existing = plan.workouts.find(
        (old) =>
          old.date === w.date &&
          old.week >= 0 &&
          (old.session ?? 'AM') === (w.session ?? 'AM'),
      );
      let id = existing?.id;
      if (!id) {
        let suffix = 0;
        do {
          id = `${plan.id}:revised:${w.date}:${w.session ?? 'single'}:${suffix++}`;
        } while (reservedIds.has(id));
        reservedIds.add(id);
      }
      return { ...w, id, changed: true, changeSource: 'preferences' as const };
    });
  const next = {
    ...generated,
    id: plan.id,
    createdAt: plan.createdAt,
    extraRuns: plan.extraRuns,
    constraintsFrom: asOf,
    workouts: [...history, ...overrides, ...future],
  };
  if (
    plan.feasibility?.status === 'event-deferred' &&
    next.workouts.some((w) => w.kind === 'race' && w.status === 'skipped')
  )
    next.feasibility = plan.feasibility;
  refreshWeekTotals(next);
  if (plan.returnState && plan.returnState.stage < 3) {
    next.returnState = plan.returnState;
    applyReturnStage(next, asOf);
  }
  applyActualTrainingEnvelope(next, asOf);
  rebalanceFutureQuality(next, asOf);
  if (isLongUltra(next.profile)) refreshFeasibility(next, asOf);
  const issues = validatePlan(next);
  if (issues.length) throw new PlanError(issues[0]);
  return next;
}

export function advanceRunWalk(plan: Plan, asOf: string): Plan {
  const review = noviceReview(plan, asOf);
  if (!review?.ready)
    throw new PlanError(
      review?.reason ?? 'There is no active run-walk stage to advance.',
    );
  const current = {
    ...plan,
    profile: {
      ...plan.profile,
      runWalkStage: Math.min(
        RETURN_TRAINING_POLICY.finalRunWalkStage,
        (plan.profile.runWalkStage ?? 0) + 1,
      ) as 0 | 1 | 2 | 3 | 4,
    },
  };
  const next = revisePreferences(
    current,
    { volume: 'maintain' } as PreferencePatch,
    asOf,
    true,
  );
  next.notes.push(
    'Run-walk intervals advanced after completed comfortable sessions. Weekly volume is held during this change.',
  );
  return next;
}

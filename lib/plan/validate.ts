import { PLAN_LOAD_LIMITS } from './policy-constants.ts';
/** Plan validate responsibilities; extracted without changing policy or behavior. */
import { qualityWorkMinutes } from '../prescription.ts';
import { schedulingEasyPace } from '../fitness-pacing.ts';
import { peakLongRunKm } from '../progression-engine.ts';
import {
  clockMinutes,
  runningDayLimit,
  validStartTime,
} from '../runner-customization.ts';
import { usesMarathonRhythm } from '../training-structure.ts';
import {
  isLongUltra,
  LONG_ULTRA_POLICY,
  longUltraOpeningBaselineMessage,
} from '../ultra-policy.ts';
import { addDays, dateLabel, dayDiff, dayNames, weekday } from './calendar.ts';
import { taperFactor } from './generation-calendar.ts';
import { standardQualityRhythmErrors } from './generation-rhythm.ts';
import { ENGINE_VERSION, TRAINING_POLICY } from './policy.ts';
import { trainingFamily } from './profile.ts';
import { type Plan, type Workout } from './types.ts';

export function validatePlan(plan: Plan): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const w of plan.workouts) {
    if (ids.has(w.id))
      errors.push(
        'Duplicate workout identity. Rebuild the affected future schedule.',
      );
    ids.add(w.id);
  }
  const ordered = plan.workouts
    .filter((w) => w.week >= 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  const dates = new Set<string>();
  let lastHard: Workout | undefined;
  let lastDemanding: Workout | undefined;
  for (const s of ordered) {
    if (
      dates.has(s.date) &&
      !(
        s.pairId &&
        ordered.filter((w) => w.date === s.date).length === 2 &&
        ordered
          .filter((w) => w.date === s.date)
          .every((w) => w.pairId === s.pairId)
      )
    )
      errors.push(
        `Two sessions would fall on ${dateLabel(s.date)}. Choose another date.`,
      );
    dates.add(s.date);
    if (
      isLongUltra(plan.profile) &&
      s.kind === 'long' &&
      s.status === 'planned' &&
      s.minutes > LONG_ULTRA_POLICY.longMinutes
    )
      errors.push('Long-ultra training runs are capped at four hours.');
    if (
      s.kind !== 'race' &&
      s.status === 'planned' &&
      s.date >= (plan.constraintsFrom ?? plan.profile.startDate) &&
      plan.profile.crossTraining?.some((c) => c.day === weekday(s.date))
    )
      errors.push(
        'That day is reserved for cross-training without running. Move the run or revise your cross-training days.',
      );
    if (!Number.isFinite(s.estimatedKm) || s.estimatedKm < 0)
      errors.push(
        'Workout distance estimates must be finite and non-negative.',
      );
    if (
      !Number.isFinite(s.minutes) ||
      s.minutes <= 0 ||
      s.steps.some((x) => !Number.isFinite(x.seconds) || x.seconds <= 0)
    )
      errors.push('The session must contain positive, timed steps.');
    if (
      s.steps.some(
        (x) =>
          x.metres !== undefined &&
          (!Number.isFinite(x.metres) ||
            x.metres <= 0 ||
            x.metres > PLAN_LOAD_LIMITS.maximumStepMetres),
      )
    )
      errors.push('Workout distances must be positive, finite metres.');
    if (
      s.steps.some(
        (x) =>
          x.planningPaceSecondsPerKm !== undefined &&
          (x.metres === undefined ||
            !Number.isFinite(x.planningPaceSecondsPerKm) ||
            x.planningPaceSecondsPerKm <
              PLAN_LOAD_LIMITS.minimumPlanningSecondsPerKm ||
            x.planningPaceSecondsPerKm >
              PLAN_LOAD_LIMITS.maximumPlanningSecondsPerKm ||
            (x.metres * x.planningPaceSecondsPerKm) / 1000 > x.seconds + 1),
      )
    )
      errors.push('Distance repetitions need a valid planning-time allowance.');
    if (
      Math.abs(s.steps.reduce((n, x) => n + x.seconds, 0) - s.minutes * 60) > 1
    )
      errors.push('Workout steps do not match the total duration.');
    if (
      s.kind !== 'race' &&
      s.status === 'planned' &&
      s.date >= (plan.constraintsFrom ?? plan.profile.startDate) &&
      s.minutes >
        (s.kind === 'long'
          ? plan.profile.longMinutes
          : plan.profile.weekdayMinutes)
    )
      errors.push('This workout exceeds your session time limit.');
    if (
      s.kind !== 'race' &&
      s.status === 'planned' &&
      s.date >= (plan.constraintsFrom ?? plan.profile.startDate) &&
      s.startTime !== undefined &&
      (!validStartTime(s.startTime) ||
        clockMinutes(s.startTime) + s.minutes > 1440)
    )
      errors.push(
        'Choose a valid start time that leaves the whole run on the same day.',
      );
    const distanceCap =
      s.kind === 'long'
        ? plan.profile.longLimitKm
        : s.hard
          ? plan.profile.qualityLimitKm
          : plan.profile.easyLimitKm;
    if (
      s.kind !== 'race' &&
      s.status === 'planned' &&
      s.date >= (plan.constraintsFrom ?? plan.profile.startDate) &&
      distanceCap != null &&
      s.estimatedKm > distanceCap + 0.01
    )
      errors.push(
        'A distance cap is too short for this session. Allow at least five minutes at your estimated easy pace, or increase the cap.',
      );
    if (s.date < plan.profile.startDate || s.date > plan.profile.raceDate)
      errors.push('Keep sessions inside the plan dates.');
    if (s.hard && s.status !== 'skipped') {
      if (
        lastHard &&
        !(s.pairId && s.pairId === lastHard.pairId) &&
        dayDiff(lastHard.date, s.date) <
          TRAINING_POLICY.minimumDemandingSpacingDays
      )
        errors.push(
          'Keep at least one easy or rest day between hard sessions.',
        );
      lastHard = s;
    }
    if ((s.hard || s.kind === 'long') && s.status !== 'skipped') {
      if (
        lastDemanding &&
        !(s.pairId && s.pairId === lastDemanding.pairId) &&
        dayDiff(lastDemanding.date, s.date) <
          TRAINING_POLICY.minimumDemandingSpacingDays
      )
        errors.push(
          'Keep at least one easy or rest day between long or hard sessions.',
        );
      lastDemanding = s;
    }
  }
  const pairs = new Map<string, Workout[]>();
  for (const w of ordered)
    if (w.pairId) pairs.set(w.pairId, [...(pairs.get(w.pairId) ?? []), w]);
  for (const pair of pairs.values()) {
    if (
      pair.length !== 2 ||
      pair[0].date !== pair[1].date ||
      new Set(pair.map((w) => w.session)).size !== 2 ||
      pair.some(
        (w) =>
          !['AM', 'PM'].includes(w.session ?? '') ||
          !/^([01]\d|2[0-3]):[0-5]\d$/.test(w.startTime ?? '') ||
          !['easy-doubles', 'double-threshold'].includes(w.pairType ?? ''),
      ) ||
      pair[0].pairType !== pair[1].pairType
    ) {
      errors.push(
        'A paired day needs exactly one morning and one evening session on the same date.',
      );
      continue;
    }
    const am = pair.find((w) => w.session === 'AM')!,
      pm = pair.find((w) => w.session === 'PM')!;
    const minute = (v: string) => {
      const [h, m] = v.split(':').map(Number);
      return h * 60 + m;
    };
    if (
      minute(pm.startTime!) - minute(am.startTime!) - am.minutes <
        PLAN_LOAD_LIMITS.pairedRecoveryMinutes ||
      minute(pm.startTime!) + pm.minutes > 1440
    )
      errors.push(
        'Keep at least six hours after the morning session, with both runs finishing on the same day.',
      );
    if (pair.some((w) => w.kind === 'long' || w.kind === 'race'))
      errors.push('Long runs and races cannot be split into ordinary doubles.');
    if (
      pair.every((w) => w.status === 'planned') &&
      pair[0].date >= (plan.constraintsFrom ?? plan.profile.startDate) &&
      am.minutes + pm.minutes > plan.profile.weekdayMinutes
    )
      errors.push('Both sessions together exceed the weekday time budget.');
    if (
      pair[0].pairType === 'double-threshold' &&
      pair.reduce((n, w) => n + (w.qualityMinutes ?? 0), 0) >
        PLAN_LOAD_LIMITS.pairedThresholdWorkMinutes
    )
      errors.push(
        'The paired threshold day exceeds the 40-minute work ceiling.',
      );
  }
  // Validate prescriptions, never observed overruns: truthful logging must save.
  // Actual running reserves capacity when a future-plan review is requested.
  const running = ordered.filter(
    (w) => w.week >= 0 && w.kind !== 'race' && w.status !== 'skipped',
  );
  const checkBudget = (runs: Workout[], limit: number, message: string) => {
    if (
      !Number.isFinite(limit) ||
      !runs.some(
        (w) =>
          w.status === 'planned' &&
          w.date >= (plan.constraintsFrom ?? plan.profile.startDate),
      )
    )
      return;
    const total = runs.reduce((n, w) => n + w.minutes, 0);
    if (total > limit + 0.01) errors.push(message);
  };
  for (const date of new Set(
    running
      .filter((w) =>
        Number.isFinite(runningDayLimit(plan.profile, weekday(w.date))),
      )
      .map((w) => w.date),
  ))
    checkBudget(
      running.filter((w) => w.date === date),
      runningDayLimit(plan.profile, weekday(date)),
      `${dayNames[weekday(date)]}’s runs exceed your daily time ceiling. Move or shorten the run, or review that day’s limit.`,
    );
  for (const week of plan.profile.weeklyMinutesLimit != null ? plan.weeks : [])
    checkBudget(
      running.filter(
        (w) => w.date >= week.start && w.date <= addDays(week.start, 6),
      ),
      plan.profile.weeklyMinutesLimit ?? Infinity,
      'This week exceeds your running-time ceiling. Review the remaining sessions or increase the ceiling.',
    );
  errors.push(...qualityBudgetErrors(plan));
  errors.push(...baselineAndLongRunErrors(plan));
  return [...new Set(errors)];
}

/** New prescriptions retain the declared opening load and clean long-run steps.
 * Older saved policies, observed history and deliberate edits keep their meaning. */
function baselineAndLongRunErrors(plan: Plan): string[] {
  if (plan.policyVersion !== TRAINING_POLICY.version || plan.returnState)
    return [];
  const errors: string[] = [];
  // A metre tolerates arithmetic noise without accepting hundred-metre drift.
  const toleranceKm = 0.001 + 1e-9;
  const from = plan.constraintsFrom ?? plan.profile.startDate;
  const ordinary = (week: Plan['weeks'][number]) =>
    week.start >= from &&
    !['Recovery', 'Taper', 'Race week'].includes(week.phase) &&
    taperFactor(plan.profile, addDays(week.start, 6)) >= 1;
  const first = plan.weeks[0];
  const openingRuns = first
    ? plan.workouts.filter((w) => w.week === first.index && w.kind !== 'race')
    : [];
  const freshOpening =
    first &&
    first.start === plan.profile.startDate &&
    addDays(first.start, 6) <= plan.profile.raceDate &&
    ordinary(first) &&
    !plan.baselineEvidence &&
    (!plan.constraintsFrom ||
      plan.constraintsFrom === plan.profile.startDate) &&
    openingRuns.every(
      (w) => w.status === 'planned' && !w.changed && !w.returnRole,
    );
  if (freshOpening) {
    const ultraConflict = longUltraOpeningBaselineMessage(
      plan.profile,
      openingRuns.reduce((sum, run) => sum + run.minutes, 0),
      openingRuns.find((run) => run.kind === 'long')?.minutes ?? 0,
    );
    if (ultraConflict) errors.push(ultraConflict);
    const totalKm = openingRuns.reduce((sum, w) => sum + w.estimatedKm, 0);
    if (
      plan.profile.weeklyKm > 0 &&
      Math.abs(totalKm - plan.profile.weeklyKm) > toleranceKm
    )
      errors.push(
        'The first complete training week must retain your declared weekly distance. Review the starting baseline and available time together.',
      );
    // Two-day routines distribute endurance between two ordinary runs.
    if (plan.profile.days.length > 2 && plan.profile.longestKm > 0) {
      const long = openingRuns.find((w) => w.kind === 'long');
      if (
        !long ||
        Math.abs(long.estimatedKm - plan.profile.longestKm) > toleranceKm
      )
        errors.push(
          'The first complete training week must retain your declared long-run distance. Review the starting baseline and long-run limits together.',
        );
    }
  }
  const pace = Math.max(
    schedulingEasyPace(plan.profile),
    plan.profile.workoutTargets?.mode === 'pace'
      ? (plan.profile.workoutTargets.pace?.easy?.high ?? 0) / 60
      : 0,
  );
  const familiarLongKm = plan.baselineEvidence
    ? Math.min(
        plan.baselineEvidence.longestKm,
        (plan.baselineEvidence.longestMinutes ?? Infinity) / pace,
      )
    : plan.profile.longestKm;
  const untouchedForecast =
    !plan.baselineEvidence &&
    from === plan.profile.startDate &&
    plan.workouts.every(
      (w) => w.status === 'planned' && !w.changed && !w.returnRole,
    );
  let previousWeeklyKm: number | undefined;
  let previousLongKm: number | undefined;
  for (const week of plan.weeks) {
    if (!ordinary(week)) continue;
    if (untouchedForecast && addDays(week.start, 6) <= plan.profile.raceDate) {
      const runs = plan.workouts.filter(
        (w) => w.week === week.index && w.kind !== 'race',
      );
      if (new Set(runs.map((w) => w.date)).size === plan.profile.days.length) {
        const total = runs.reduce((sum, w) => sum + w.estimatedKm, 0);
        if (
          previousWeeklyKm !== undefined &&
          total + toleranceKm < previousWeeklyKm
        )
          errors.push(
            `Week ${week.index + 1} reduces weekly distance outside a recovery or taper week. Review the progression and available time together.`,
          );
        previousWeeklyKm = Math.max(previousWeeklyKm ?? 0, total);
      }
    }
    const long = plan.workouts.find(
      (w) => w.week === week.index && w.kind === 'long',
    );
    if (
      !long ||
      long.status !== 'planned' ||
      long.returnRole ||
      (long.changed && long.changeSource !== 'preferences')
    )
      continue;
    const otherRuns = plan.workouts.filter(
      (w) =>
        w.week === week.index &&
        w !== long &&
        w.kind !== 'race' &&
        w.status !== 'skipped',
    );
    const hardCapKm = Math.min(
      plan.profile.longLimitKm ?? Infinity,
      plan.profile.longMinutes / pace,
      runningDayLimit(plan.profile, weekday(long.date)) / pace,
      ((plan.profile.weeklyMinutesLimit ?? Infinity) -
        otherRuns.reduce((sum, w) => sum + w.minutes, 0)) /
        pace,
      isLongUltra(plan.profile)
        ? LONG_ULTRA_POLICY.longMinutes / pace
        : Infinity,
    );
    // Logging another run does not invalidate a fractional baseline already
    // prescribed at the original opening of the plan.
    const openingAnchor =
      week === first &&
      first.start === plan.profile.startDate &&
      Math.abs(long.estimatedKm - plan.profile.longestKm) <= toleranceKm;
    const cappedFractionalAnchor =
      Math.abs(long.estimatedKm - familiarLongKm) <= toleranceKm &&
      Math.ceil(familiarLongKm) >
        Math.min(
          hardCapKm,
          peakLongRunKm(
            trainingFamily(plan.profile),
            familiarLongKm,
            plan.profile.intent,
          ),
        ) +
          toleranceKm;
    const maintainedFractionalAnchor =
      plan.profile.volume === 'maintain' &&
      Math.abs(long.estimatedKm - familiarLongKm) <= toleranceKm;
    if (
      !openingAnchor &&
      !cappedFractionalAnchor &&
      !maintainedFractionalAnchor &&
      Math.abs(long.estimatedKm - Math.round(long.estimatedKm)) > toleranceKm
    )
      errors.push(
        `Week ${week.index + 1} needs a whole-kilometre long-run distance after the starting baseline.`,
      );
    if (
      previousLongKm !== undefined &&
      long.estimatedKm + toleranceKm < previousLongKm
    )
      errors.push(
        `Week ${week.index + 1} reduces the long run outside a recovery or taper week. Review the progression and available time together.`,
      );
    previousLongKm = long.estimatedKm;
  }
  return errors;
}

export function qualityBudgetErrors(plan: Plan): string[] {
  const errors: string[] = [];
  for (const week of plan.weeks) {
    if (
      addDays(week.start, 6) < (plan.constraintsFrom ?? plan.profile.startDate)
    )
      continue;
    const sessions = plan.workouts.filter(
      (w) =>
        w.week === week.index && w.kind !== 'race' && w.status !== 'skipped',
    );
    const minutes = sessions.reduce((n, w) => n + w.minutes, 0),
      work = sessions.reduce((n, w) => n + qualityWorkMinutes(w), 0);
    const upcoming = sessions.filter(
      (w) =>
        w.status === 'planned' &&
        w.date >= (plan.constraintsFrom ?? plan.profile.startDate),
    );
    if (!upcoming.some((w) => qualityWorkMinutes(w) > 0)) continue;
    const fraction = ['threshold-singles', 'double-threshold'].includes(
      plan.profile.method ?? '',
    )
      ? PLAN_LOAD_LIMITS.thresholdMethodQualityFraction
      : PLAN_LOAD_LIMITS.standardQualityFraction;
    if (work > minutes * fraction + 0.1)
      errors.push(
        'This change leaves too much quality work for the remaining weekly volume. Reduce quality work or review the week together.',
      );
  }
  if (
    plan.engineVersion === ENGINE_VERSION &&
    usesMarathonRhythm(plan.profile) &&
    !plan.returnState
  ) {
    let previousLongKm = 0;
    for (const week of plan.weeks) {
      if (
        ['Recovery', 'Taper', 'Race week'].includes(week.phase) ||
        week.start < (plan.constraintsFrom ?? plan.profile.startDate) ||
        taperFactor(plan.profile, addDays(week.start, 6)) < 1
      )
        continue;
      const sessions = plan.workouts.filter((w) => w.week === week.index);
      if (
        sessions.some(
          (w) => w.status !== 'planned' || w.changed || w.returnRole,
        )
      )
        continue;
      const quality = sessions.filter((w) => w.hard || w.kind === 'long');
      const long = quality.find((w) => w.kind === 'long');
      if (long && long.estimatedKm + 0.001 < previousLongKm)
        errors.push(
          `Week ${week.index + 1} cannot retain the preceding long-run distance within its allocated volume. Review the weekly and session limits.`,
        );
      if (long) previousLongKm = long.estimatedKm;
    }
  }
  errors.push(...standardQualityRhythmErrors(plan));
  return errors;
}

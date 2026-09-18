import {
  GENERATION_POLICY,
  SESSION_POLICY,
  LATE_LONG_CAP_MINUTES,
  DAYS_PER_WEEK,
} from './generation-constants.ts';

import {
  marathonMediumTargetKm,
  marathonPaceOpportunity,
} from '../marathon-book.ts';
import { runningDayLimit } from '../runner-customization.ts';

import { isLongUltra, LONG_ULTRA_POLICY } from '../ultra-policy.ts';
import {
  usesMarathonRhythm,
  usesStandardQualityRhythm,
  desiredRuns,
  allocateRunningMinutes,
  longRunShareLimit,
  recoveryRunCap,
  sessionWeight,
} from '../training-structure.ts';

import { marathonLongCeiling } from '../marathon-model.ts';

import { selectTemplate } from '../workout-library.ts';
import { isShortTimeline, usesFiveDaySplit } from '../progression-engine.ts';
import { addDays, dayDiff, weekday, monday } from './calendar.ts';
import { PlanError } from './errors.ts';
import { TRAINING_POLICY } from './policy.ts';
import { type Week, type Workout } from './types.ts';
import {
  trainingPhaseOn,
  usesDailyTaperPhase,
  taperFactor,
  raceWeekSessionCap,
  marathonRaceWeekRunCount,
} from './generation-calendar.ts';

import type { GenerationWeekLoad } from './generation-load.ts';
import type { GenerationPolicy, ReplanContext } from './generation-policy.ts';

/** Allocate one week from its remaining budget; elapsed prescriptions never fund catch-up. */
export function allocateGenerationWeek(
  context: GenerationPolicy,
  weekLoad: GenerationWeekLoad,
  w: number,
  workouts: readonly Workout[],
  weeks: readonly Week[],
  replan?: ReplanContext,
) {
  const {
    p,
    bookMarathon,
    recoveryFactor,
    start,
    recordedQuality,
    pace,
    isNovice,
    policy,
    family,
    longPace,
    weeksUntilRace,
    startLong,
    marathonLongBaseline,
    qualityDays,
    mediumDay,
  } = context;
  const { taper, recovery, phase, long, load } = weekLoad;
  const retainedPrefix = (replan?.retainedPrefix ?? []).filter(
    (s) => s.week === w && s.kind !== 'race',
  );
  const retainedDates = new Set(
    (replan?.retainedPrefix ?? []).flatMap((s) => [s.date, s.originalDate]),
  );
  const wholeWeekDates = p.days
    .map((d) => addDays(start, w * DAYS_PER_WEEK + d))
    .filter(
      (d) =>
        d >= p.startDate &&
        d <= p.raceDate &&
        (p.goal === 'base' || d < p.raceDate),
    );
  // Race day occupies a running day; it is not an extra outing on top of the
  // requested week. Remove its ordinary slot before allocating any minutes.
  if (
    p.goal !== 'base' &&
    monday(p.raceDate) === addDays(start, w * DAYS_PER_WEEK)
  ) {
    const prescribedDays = () =>
      new Set([
        ...wholeWeekDates,
        ...retainedPrefix
          .filter((s) => s.status !== 'skipped')
          .map((s) => s.date),
        p.raceDate,
      ]).size;
    const editable = wholeWeekDates
      .filter(
        (d) => d >= (replan?.from ?? p.startDate) && !retainedDates.has(d),
      )
      .sort(
        (a, b) =>
          Number(weekday(b) === p.longDay) - Number(weekday(a) === p.longDay) ||
          b.localeCompare(a),
      );
    for (const date of editable) {
      if (prescribedDays() <= desiredRuns(p)) break;
      wholeWeekDates.splice(wholeWeekDates.indexOf(date), 1);
    }
  }
  const dates = wholeWeekDates.filter(
    (d) => d >= (replan?.from ?? p.startDate) && !retainedDates.has(d),
  );
  const allocationForDate = (date: string) =>
    (load /
      (bookMarathon && dayDiff(date, p.raceDate) < DAYS_PER_WEEK
        ? marathonRaceWeekRunCount(p)
        : p.days.length)) *
    (recovery ? recoveryFactor : taperFactor(p, date));
  const remainingAllocation = dates.reduce(
    (n, d) => n + allocationForDate(d),
    0,
  );
  const activeReviewWeek =
    replan &&
    (monday(replan.from) === addDays(start, w * DAYS_PER_WEEK) ||
      retainedPrefix.length > 0);
  const wholeWeekAllocation = wholeWeekDates.reduce(
    (n, d) => n + allocationForDate(d),
    0,
  );
  // Reserve elapsed prescriptions even if unlogged, skipped or shorter than
  // planned. Missed time never funds catch-up work; extra recorded time reduces
  // what remains. The prefix is allocation context, never completed evidence.
  const reservedMinutes = retainedPrefix.reduce(
    (n, s) =>
      n +
      Math.max(
        s.minutes,
        s.status === 'completed'
          ? (s.feedback?.actualMinutes ?? s.minutes)
          : s.minutes,
      ),
    0,
  );
  // A newly enabled day that has already passed cannot contribute catch-up
  // time. Reserve its ordinary share when no retained prescription accounts for it.
  const unavailableAllocation = replan
    ? wholeWeekDates
        .filter((d) => d < replan.from && !retainedDates.has(d))
        .reduce((n, d) => n + allocationForDate(d), 0)
    : 0;
  const desired =
    activeReviewWeek && dates.length
      ? Math.max(
          0,
          wholeWeekAllocation - reservedMinutes / pace - unavailableAllocation,
        )
      : remainingAllocation;
  const longShareBudget = activeReviewWeek ? wholeWeekAllocation : desired;
  const longDate = dates.find(
    (d) =>
      p.days.length > SESSION_POLICY.easyOnlyMaximumRuns &&
      weekday(d) === p.longDay &&
      (p.goal === 'base' ||
        dayDiff(d, p.raceDate) >=
          (bookMarathon
            ? SESSION_POLICY.bookLongMinimumDaysBeforeRace
            : SESSION_POLICY.longMinimumDaysBeforeRace)),
  );
  if (
    Math.floor(desired * pace) <
    dates.length * GENERATION_POLICY.minimumSessionMinutes
  )
    throw new PlanError(
      'The available running time cannot support minimum-length sessions in every week, including recovery weeks. Review your starting routine or running days; no extra training has been added.',
    );
  const previousLong = workouts.findLast(
    (s) => s.kind === 'long' && weeks[s.week]?.phase !== 'Recovery',
  );
  // A short opening calendar week is not evidence that the runner lost their
  // declared long-run capacity. Its reduced outing must not rebase the next
  // full week; the same-week volume/time limits still apply independently.
  const previousLongKm =
    previousLong &&
    bookMarathon &&
    previousLong.week === 0 &&
    start < p.startDate &&
    dayDiff(p.startDate, longDate ?? addDays(start, w * DAYS_PER_WEEK)) <=
      SESSION_POLICY.openingBaselineRetentionDays
      ? Math.max(previousLong.estimatedKm, marathonLongBaseline)
      : previousLong?.estimatedKm;
  // Reserve the complete weekday stimulus before forecasting a longer outing.
  // Otherwise a whole-kilometre advance can consume the final quality minute.
  const qualityReserve =
    !recovery &&
    !taper &&
    usesStandardQualityRhythm(p) &&
    dates.some((d) => qualityDays.includes(weekday(d)))
      ? SESSION_POLICY.introductoryWorkoutMinutes -
        GENERATION_POLICY.minimumSessionMinutes
      : 0;
  const usualLongDistance = Math.min(
    long,
    Math.max(startLong, policy.longCeilingKm),
    family === 'marathon'
      ? marathonLongCeiling(
          // Staging must leave room for the first whole-kilometre target above
          // a fractional familiar baseline. Explicit time/distance caps still win.
          p.volume === 'gradual'
            ? Math.ceil(marathonLongBaseline)
            : marathonLongBaseline,
          dayDiff(
            longDate ?? addDays(start, w * DAYS_PER_WEEK + p.longDay),
            p.raceDate,
          ),
          Math.max(startLong, policy.longCeilingKm),
        )
      : Infinity,
    family === 'marathon' &&
      previousLong &&
      !recovery &&
      !taper &&
      !isShortTimeline(weeksUntilRace)
      ? previousLongKm! + TRAINING_POLICY.family.marathon.longStepKm
      : Infinity,
    family === 'marathon' && previousLong && recovery
      ? previousLong.estimatedKm * SESSION_POLICY.marathonRecoveryLongFraction
      : Infinity,
    Math.max(
      !taper && !recovery && !usesMarathonRhythm(p) ? startLong : 0,
      (longShareBudget * pace * longRunShareLimit(p)) / longPace,
    ),
    // Minimum useful easy outings are funded before the long run; a familiar
    // baseline cannot override the actual minutes available in this week.
    (desired * pace -
      Math.max(0, dates.length - 1) * GENERATION_POLICY.minimumSessionMinutes -
      qualityReserve) /
      longPace,
    p.longMinutes / longPace,
    isLongUltra(p) ? LONG_ULTRA_POLICY.longMinutes / pace : Infinity,
    longDate &&
      p.goal !== 'base' &&
      !bookMarathon &&
      dayDiff(longDate, p.raceDate) <= SESSION_POLICY.lateLongCapDays
      ? (family === 'ultra'
          ? LATE_LONG_CAP_MINUTES.ultra
          : family === 'marathon'
            ? LATE_LONG_CAP_MINUTES.marathon
            : family === 'half'
              ? LATE_LONG_CAP_MINUTES.half
              : LATE_LONG_CAP_MINUTES.shortRoad) / pace
      : Infinity,
    p.longLimitKm ?? Infinity,
  );
  const cappedLong = Math.min(
    usualLongDistance,
    runningDayLimit(p, longDate ? weekday(longDate) : p.longDay) / longPace,
  );
  let longDistance =
    !recovery && !taper && cappedLong >= startLong - 1e-7
      ? // A cap between a fractional baseline and the next integer permits a
        // familiar hold, not a regression caused only by rounding (16.9 -> 16).
        Math.max(startLong, Math.floor(cappedLong + 1e-9))
      : Math.floor(cappedLong + 1e-9);
  if (
    longDate &&
    longDistance * longPace < GENERATION_POLICY.minimumSessionMinutes
  ) {
    const fundedMinutes = Math.min(
      p.longMinutes,
      runningDayLimit(p, weekday(longDate)),
      (p.longLimitKm ?? Infinity) * longPace,
      desired * pace -
        Math.max(0, dates.length - 1) * GENERATION_POLICY.minimumSessionMinutes,
    );
    if (fundedMinutes < GENERATION_POLICY.minimumSessionMinutes - 1e-7)
      throw new PlanError(
        'The long-run limits cannot fit the minimum five-minute outing. Review the starting distance, running days or session limits.',
      );
    // A whole-kilometre cutback can round a tiny run to zero. The scheduler
    // already funds at least five minutes; retain its positive distance too.
    longDistance = GENERATION_POLICY.minimumSessionMinutes / longPace;
  }
  const previousSpecific = workouts.filter(
    (s) =>
      s.stimulus === 'race-rhythm' && s.kind !== 'long' && s.kind !== 'race',
  );
  const mixedLong = bookMarathon
    ? !!longDate &&
      !recovery &&
      !taper &&
      longDistance * pace >= SESSION_POLICY.bookMixedLongMinimumMinutes &&
      marathonPaceOpportunity(p, longDate, [...recordedQuality, ...workouts])
    : family === 'marathon' &&
      phase === 'Race preparation' &&
      !!longDate &&
      taperFactor(p, longDate) === 1 &&
      p.experience === 'established' &&
      p.intent !== 'finish' &&
      p.difficulty !== 'gentle' &&
      (!p.method || p.method === 'balanced') &&
      p.weeklyKm >= SESSION_POLICY.mixedLongMinimumWeeklyKm &&
      p.longestKm >= SESSION_POLICY.mixedLongMinimumBaselineKm &&
      (p.recentQualitySessions ?? 0) >=
        SESSION_POLICY.mixedLongMinimumQualitySessions &&
      qualityDays.length >= SESSION_POLICY.mixedLongMinimumQualitySessions &&
      previousSpecific.length >=
        SESSION_POLICY.mixedLongMinimumSpecificSessions &&
      longDistance * pace >= SESSION_POLICY.mixedLongMinimumMinutes &&
      weeks.filter((week) => week.phase === 'Race preparation').length %
        SESSION_POLICY.mixedLongEveryWeeks ===
        0;
  // A marathon-effort long run consumes a workout slot. With an explicit
  // second book workout it replaces the secondary, never adds a third effort.
  const weekQualityDays =
    mixedLong && !usesMarathonRhythm(p)
      ? bookMarathon &&
        p.qualityMode === 'custom' &&
        p.qualitySessions === SESSION_POLICY.mixedLongMinimumQualitySessions
        ? qualityDays.slice(0, -1)
        : qualityDays.slice(1)
      : qualityDays;
  const support =
    !recovery &&
    !taper &&
    dates.length >= SESSION_POLICY.mediumLongMinimumRuns &&
    (!usesFiveDaySplit(p) || usesMarathonRhythm(p))
      ? mediumDay
      : undefined;
  const strideDay =
    bookMarathon &&
    !recovery &&
    !taper &&
    phase !== 'Maintenance' &&
    p.experience === 'established' &&
    p.intent !== 'finish' &&
    p.difficulty !== 'gentle' &&
    (p.recentQualitySessions ?? 0) > 0 &&
    (p.qualitySessions ?? 0) > 0
      ? p.days.find(
          (d) =>
            d !== p.longDay &&
            d !== support &&
            !qualityDays.includes(d) &&
            Math.min(
              Math.abs(d - p.longDay),
              DAYS_PER_WEEK - Math.abs(d - p.longDay),
            ) >= TRAINING_POLICY.minimumDemandingSpacingDays,
        )
      : undefined;
  const regularDates = dates.filter((d) => d !== longDate);
  const regularBudget =
    Math.floor(desired * pace) -
    (longDate ? Math.ceil(longDistance * longPace - 1e-9) : 0);
  const weights = new Map(
    regularDates.map((d) => [
      d,
      isNovice ||
      p.days.length <= SESSION_POLICY.equalWeightMaximumRuns ||
      ['easy-doubles', 'double-threshold'].includes(p.method ?? '')
        ? 1
        : sessionWeight(
            weekday(d),
            p.longDay,
            weekQualityDays,
            support,
            p.marathonApproach === 'endurance',
          ),
    ]),
  );
  const regularSlots = regularDates.map((d) => ({
    key: d,
    weight: weights.get(d)!,
    cap: Math.min(
      usesMarathonRhythm(p) ? runningDayLimit(p, weekday(d)) : Infinity,
      p.weekdayMinutes,
      !isNovice &&
        longDate &&
        !weekQualityDays.includes(weekday(d)) &&
        weekday(d) !== support
        ? Math.floor(longDistance * pace)
        : Infinity,
      (weights.get(d) ?? 1) < 1 &&
        !['easy-doubles', 'double-threshold'].includes(p.method ?? '')
        ? recoveryRunCap(
            p,
            (activeReviewWeek ? wholeWeekAllocation : desired) * pace,
          )
        : Infinity,
      raceWeekSessionCap(p, d),
      (weekQualityDays.includes(weekday(d))
        ? (p.qualityLimitKm ?? Infinity)
        : (p.easyLimitKm ?? Infinity)) *
        pace *
        (p.method === 'double-threshold' &&
        p.doubleDays?.includes(weekday(d)) &&
        w >= SESSION_POLICY.pairedIntroductionWeeks &&
        ['Build', 'Race preparation'].includes(
          usesDailyTaperPhase(p) ? trainingPhaseOn(p, phase, d) : phase,
        )
          ? SESSION_POLICY.pairedSessionCount
          : 1),
    ),
  }));
  const supportSlot =
    bookMarathon && support !== undefined
      ? regularSlots.find((s) => weekday(s.key) === support)
      : undefined;
  const mediumMinutes = supportSlot
    ? Math.max(
        GENERATION_POLICY.minimumSessionMinutes,
        Math.floor(
          Math.min(
            marathonMediumTargetKm(
              p,
              activeReviewWeek ? wholeWeekAllocation : desired,
              longDistance || long,
            ) * pace,
            supportSlot.cap,
            regularBudget -
              (regularSlots.length - 1) *
                GENERATION_POLICY.minimumSessionMinutes,
          ),
        ),
      )
    : 0;
  const allocation = supportSlot
    ? new Map([
        ...allocateRunningMinutes(
          regularBudget - mediumMinutes,
          regularSlots.filter((s) => s !== supportSlot),
        ),
        [supportSlot.key, mediumMinutes],
      ])
    : allocateRunningMinutes(regularBudget, regularSlots);
  // Busy-day limits reduce that outing; spare minutes are not forced onto
  // another day. The final workload pass also checks paired sessions.
  for (const date of regularDates)
    allocation.set(
      date,
      Math.min(allocation.get(date)!, runningDayLimit(p, weekday(date))),
    );
  // A complete introductory workout needs 30 minutes. Move existing easy
  // minutes into that slot when they fit, without adding weekly volume.
  if (
    !isNovice &&
    !recovery &&
    !taper &&
    p.goal !== 'base' &&
    (p.intent !== 'finish' || usesStandardQualityRhythm(p))
  ) {
    for (const date of regularDates.filter((d) =>
      weekQualityDays.includes(weekday(d)),
    )) {
      const cap = Math.min(
        p.weekdayMinutes,
        runningDayLimit(p, weekday(date)),
        (p.qualityLimitKm ?? Infinity) * pace,
      );
      // Preserve the primary session's familiar complete dose before filling
      // optional aerobic support. Move existing minutes; never add volume.
      const desiredWork =
        usesMarathonRhythm(p) &&
        cap >= SESSION_POLICY.introductoryWorkoutMinutes
          ? selectTemplate(p, phase, {
              previous: [...workouts],
              availableMinutes: cap,
              week: w,
              slot: 0,
              marathonModel: true,
            }).targetWorkMinutes
          : 0;
      const targetMinutes = Math.max(
        SESSION_POLICY.introductoryWorkoutMinutes,
        Math.min(
          cap,
          Math.ceil(
            SESSION_POLICY.qualityAerobicAllowanceMinutes + desiredWork,
          ),
        ),
      );
      const missing = targetMinutes - (allocation.get(date) ?? 0);
      if (missing <= 0 || cap < SESSION_POLICY.introductoryWorkoutMinutes)
        continue;
      const easyDates = regularDates.filter(
        (d) => !weekQualityDays.includes(weekday(d)),
      );
      if (
        easyDates.reduce(
          (n, d) =>
            n +
            Math.max(
              0,
              allocation.get(d)! - GENERATION_POLICY.minimumSessionMinutes,
            ),
          0,
        ) < missing
      )
        continue;
      let remaining = missing;
      for (const easy of easyDates) {
        const taken = Math.min(
          remaining,
          Math.max(
            0,
            allocation.get(easy)! - GENERATION_POLICY.minimumSessionMinutes,
          ),
        );
        allocation.set(easy, allocation.get(easy)! - taken);
        remaining -= taken;
      }
      allocation.set(date, targetMinutes);
    }
  }
  return {
    dates,
    regularDates,
    longDate,
    allocation,
    weights,
    longDistance,
    desired,
    wholeWeekAllocation,
    activeReviewWeek,
    weekQualityDays,
    support,
    strideDay,
    mixedLong,
    previousSpecific,
  };
}

import {
  GENERATION_POLICY,
  DAYS_PER_WEEK,
  FINAL_WEEKDAY_OFFSET,
} from './generation-constants.ts';

import { marathonBlockPhase, marathonTaperDays } from '../marathon-book.ts';

import { longRunForWeek } from '../progression-engine.ts';
import { dayDiff, addDays, TRAINING_POLICY, type Phase } from '../engine.ts';
import { racePreparationDays, taperFactor } from './generation-calendar.ts';
import type { GenerationPolicy } from './generation-policy.ts';

/** Advance a forecast without changing the profile, history, or prior week state. */
export function calculateWeekLoad(
  context: GenerationPolicy,
  w: number,
  previousLoad: number,
) {
  const {
    p,
    bookMarathon,
    start,
    count,
    pace,
    progressionStart,
    isNovice,
    policy,
    base,
    family,
    longPace,
    absoluteCeiling,
    taperWeeks,
    startLong,
    peakLong,
    peakWeek,
    preparationWeeks,
    longProgressionStart,
  } = context;
  let load = previousLoad;
  const remaining = count - w;
  const maintenance =
    p.goal !== 'base' &&
    remaining > preparationWeeks &&
    p.experience === 'established' &&
    (p.recentQualitySessions ?? 0) >=
      GENERATION_POLICY.maintenanceQualitySessions &&
    !isNovice;
  const taper =
    taperWeeks > 0 &&
    dayDiff(
      addDays(start, w * DAYS_PER_WEEK + FINAL_WEEKDAY_OFFSET),
      p.raceDate,
    ) <= (bookMarathon ? marathonTaperDays(p) - 1 : taperWeeks * DAYS_PER_WEEK);
  // A boundary week may contain a tapered Sunday without making its Monday
  // workout a taper session. Keep suppressing load growth across that boundary.
  const taperAtWeekStart =
    p.goal !== 'base' &&
    dayDiff(addDays(start, w * DAYS_PER_WEEK), p.raceDate) <=
      (bookMarathon ? marathonTaperDays(p) - 1 : taperWeeks * DAYS_PER_WEEK);
  const recovery =
    !taper &&
    w > 0 &&
    (w + 1) % (p.recoveryWeeks ?? TRAINING_POLICY.recoveryEveryWeeks) === 0;
  const raceSpecificEntry =
    p.goal !== 'base' &&
    dayDiff(
      addDays(start, w * DAYS_PER_WEEK) < p.startDate
        ? p.startDate
        : addDays(start, w * DAYS_PER_WEEK),
      p.raceDate,
    ) <= racePreparationDays(p);
  const phase: Phase = bookMarathon
    ? recovery
      ? 'Recovery'
      : marathonBlockPhase(p, addDays(start, w * DAYS_PER_WEEK))
    : p.goal !== 'base' && remaining === 1
      ? 'Race week'
      : taperAtWeekStart
        ? 'Taper'
        : recovery
          ? 'Recovery'
          : maintenance && w >= 1
            ? 'Maintenance'
            : (w < GENERATION_POLICY.foundationWeeks && !raceSpecificEntry) ||
                remaining > preparationWeeks
              ? 'Foundation'
              : raceSpecificEntry
                ? 'Race preparation'
                : 'Build';
  const weekTaperFraction = taperFactor(
    p,
    addDays(start, w * DAYS_PER_WEEK + p.longDay),
  );
  const long = Math.min(
    longRunForWeek({
      weekIndex: Math.max(0, w - longProgressionStart),
      startLongKm: startLong,
      peakKm: Math.max(startLong, peakLong),
      peakWeekIndex: Math.max(0, peakWeek - longProgressionStart),
      recovery,
      taper: taper || taperAtWeekStart,
      taperFraction: weekTaperFraction,
      wholeKilometres: family === 'marathon',
      recoveryEveryWeeks: p.recoveryWeeks,
      recoveryOffset: longProgressionStart,
    }),
    Math.max(startLong, policy.longCeilingKm),
    p.longLimitKm ?? Infinity,
    p.longMinutes / longPace,
  );
  if (
    w > progressionStart &&
    remaining <= preparationWeeks &&
    !(
      p.method === 'easy-doubles' &&
      w < GENERATION_POLICY.easyDoublesSettlingWeeks
    ) &&
    !recovery &&
    !taper &&
    p.volume === 'gradual' &&
    !(
      p.days.length > p.currentRuns &&
      w < GENERATION_POLICY.addedDaySettlingWeeks
    ) &&
    (!bookMarathon ||
      (phase !== 'Race preparation' &&
        (w - progressionStart) %
          GENERATION_POLICY.marathonLoadStepEveryWeeks ===
          0))
  ) {
    load = Math.min(
      load +
        (isNovice
          ? GENERATION_POLICY.noviceWeeklyStepKm
          : Math.min(
              policy.weeklyStepKm,
              load *
                (family === 'ultra'
                  ? GENERATION_POLICY.ultraWeeklyGrowthFraction
                  : GENERATION_POLICY.roadWeeklyGrowthFraction),
            )),
      absoluteCeiling,
      base * policy.maxForecast,
      p.peakWeeklyKm ?? Infinity,
      (p.weeklyMinutesLimit ?? Infinity) / pace,
    );
  }
  return {
    remaining,
    maintenance,
    taper,
    taperAtWeekStart,
    recovery,
    phase,
    weekTaperFraction,
    long,
    load,
  };
}
export type GenerationWeekLoad = ReturnType<typeof calculateWeekLoad>;

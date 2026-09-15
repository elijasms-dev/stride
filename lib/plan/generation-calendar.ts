import {
  GENERATION_POLICY,
  PREPARATION_WEEKS,
  TAPER_POLICY,
  RACE_WEEK_CAPS,
  DAYS_PER_WEEK,
  FINAL_WEEKDAY_OFFSET,
} from './generation-constants.ts';
import {
  addDays,
  dayDiff,
  monday,
  weekday,
  trainingFamily,
  type Profile,
  type Phase,
} from '../engine.ts';
import {
  usesMarathonBook,
  marathonTaperFraction,
  marathonBlockPhase,
} from '../marathon-book.ts';
import { isLongUltra } from '../ultra-policy.ts';

/** Race-relative taper: calendar week boundaries must not delay race recovery. */
export function taperFactor(
  p: Pick<Profile, 'goal' | 'raceDistanceKm' | 'raceDate'> &
    Partial<Pick<Profile, 'startDate' | 'method'>>,
  date: string,
) {
  if (p.goal === 'base') return 1;
  if (usesMarathonBook(p) && p.startDate)
    return marathonTaperFraction(
      { startDate: p.startDate, raceDate: p.raceDate },
      date,
    );
  const days = dayDiff(date, p.raceDate);
  if (days <= DAYS_PER_WEEK) return TAPER_POLICY.finalWeekFraction;
  if (days <= TAPER_POLICY.secondWeekDays)
    return TAPER_POLICY.secondWeekFraction;
  if (
    days <= TAPER_POLICY.thirdWeekDays &&
    ['half', 'marathon', 'ultra'].includes(trainingFamily(p))
  )
    return TAPER_POLICY.thirdWeekFraction;
  return 1;
}
/** Race-specific entry is a position before the event, not time since signup.
 * Fitness and quality-history gates remain independent of this phase window.
 */
export function racePreparationDays(p: Profile) {
  const family = trainingFamily(p);
  const referenceWeeks =
    family === 'ultra'
      ? isLongUltra(p)
        ? PREPARATION_WEEKS.longUltra
        : PREPARATION_WEEKS.ultra
      : family === 'marathon'
        ? PREPARATION_WEEKS.marathon
        : family === 'half'
          ? PREPARATION_WEEKS.half
          : PREPARATION_WEEKS.shortRoad;
  return (
    Math.max(
      GENERATION_POLICY.minimumRacePreparationWeeks,
      Math.ceil(referenceWeeks * GENERATION_POLICY.racePreparationFraction),
    ) * DAYS_PER_WEEK
  );
}
export function trainingPhaseOn(
  p: Profile,
  weekPhase: Phase,
  date: string,
): Phase {
  if (usesMarathonBook(p))
    return weekPhase === 'Recovery' ? 'Recovery' : marathonBlockPhase(p, date);
  if (usesDailyTaperPhase(p) && weekPhase !== 'Race week') {
    if (taperFactor(p, date) < 1) return 'Taper';
    // Older plans labelled the whole boundary week Taper. Explicit workout
    // reviews must not keep that premature phase on dates outside the taper.
    if (weekPhase === 'Taper')
      return dayDiff(date, p.raceDate) <= racePreparationDays(p)
        ? 'Race preparation'
        : dayDiff(monday(p.startDate), date) <
            GENERATION_POLICY.foundationWeeks * DAYS_PER_WEEK
          ? 'Foundation'
          : 'Build';
  }
  return trainingFamily(p) === 'marathon' &&
    weekPhase !== 'Race week' &&
    taperFactor(p, date) < 1
    ? 'Taper'
    : weekPhase;
}
// These road preparation families share the daily taper resolver. Marathon
// and ultra retain their own phase models and are reviewed separately.
export function usesDailyTaperPhase(
  p: Pick<Profile, 'goal' | 'raceDistanceKm'>,
) {
  return ['5k', '10k', 'half'].includes(trainingFamily(p));
}
export function raceWeekSessionCap(
  p: Pick<Profile, 'goal' | 'raceDate'> & Partial<Pick<Profile, 'method'>>,
  date: string,
) {
  if (p.goal === 'base') return Infinity;
  const days = dayDiff(date, p.raceDate);
  // Marathon taper volume is already budgeted across the actual running days.
  // Keep the last two days modest without imposing short-race caps all week.
  if (usesMarathonBook(p))
    return days <= RACE_WEEK_CAPS.finalDay.days
      ? RACE_WEEK_CAPS.marathonFinalDayMinutes
      : days <= RACE_WEEK_CAPS.penultimateDay.days
        ? RACE_WEEK_CAPS.marathonPenultimateDayMinutes
        : Infinity;
  return days <= RACE_WEEK_CAPS.finalDay.days
    ? RACE_WEEK_CAPS.finalDay.minutes
    : days <= RACE_WEEK_CAPS.penultimateDay.days
      ? RACE_WEEK_CAPS.penultimateDay.minutes
      : days <= RACE_WEEK_CAPS.thirdDay.days
        ? RACE_WEEK_CAPS.thirdDay.minutes
        : days <= DAYS_PER_WEEK
          ? RACE_WEEK_CAPS.earlierDaysMinutes
          : Infinity;
}
/** Expected running outings in the complete six-day pre-marathon window.
 * The race consumes a normal slot only in its own calendar week. Partial blocks
 * keep this full-window denominator so starting late never creates catch-up.
 */
export function marathonRaceWeekRunCount(p: Profile) {
  const dates = Array.from({ length: FINAL_WEEKDAY_OFFSET }, (_, i) =>
    addDays(p.raceDate, i - FINAL_WEEKDAY_OFFSET),
  ).filter((date) => p.days.includes(weekday(date)));
  const raceWeek = dates.filter((date) => monday(date) === monday(p.raceDate));
  return Math.max(1, dates.length - Number(raceWeek.length >= p.days.length));
}

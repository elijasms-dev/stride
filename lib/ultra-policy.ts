import type { Plan, Profile } from './engine';
import { trainingRecords } from './run-records.ts';

export const FIFTY_MILES_KM = 80.4672;
export const HUNDRED_MILES_KM = 160.9344;
export const MAX_RECORDED_MINUTES = 4320;

export const isLongUltra = (p: Pick<Profile, 'goal' | 'raceDistanceKm'>) =>
  ['ultra', 'custom'].includes(p.goal) &&
  (p.raceDistanceKm ?? 0) > FIFTY_MILES_KM;

/** Authored runnable-course model, not clinical or universal readiness thresholds.
 * Rationale and source distinctions: outputs/Stride-100-Mile-Training-Review.md.
 */
export const LONG_ULTRA_POLICY = {
  stableWeeks: 12,
  longCeilingKm: 40,
  longMinutes: 240,
  rehearsalMinutes: 180,
  checkpointWeeks: 6,
  averageWeeklyMinutes: 540,
  fullWeeksAtTarget: 3,
  recoveryDays: 21,
} as const;

/** Recent minutes are independent evidence for long ultras, not spare capacity.
 * Exact opening kilometres must fit that evidence at the prescribed pace. */
export function longUltraOpeningBaselineMessage(
  profile: Profile,
  weeklyMinutes: number,
  longMinutes: number,
) {
  if (!isLongUltra(profile)) return null;
  const oneSecond = 1 / 60 + 1e-6;
  return weeklyMinutes > profile.ultraWeeklyMinutes! + oneSecond ||
    longMinutes > profile.ultraLongestMinutes! + oneSecond
    ? 'Your long-ultra distance baseline needs more running time at the planning pace than your recent weekly or longest-run minutes. Review the distance, recent minutes and easy pace together; the opening week cannot silently increase either baseline.'
    : null;
}

/** Six race-relative weeks before the 21-day taper, including lighter weeks.
 * This average-based product check differs from Koop's six consecutive 9h weeks.
 * It never adds training to reach a target or counts an unlogged past run as done.
 */
export function longUltraCapacity(plan: Plan, asOf = plan.profile.startDate) {
  const race = Date.parse(plan.profile.raceDate + 'T12:00:00Z');
  const weeklyMinutes = Array.from({ length: 6 }, () => 0);
  const raceIds = new Set(
    plan.workouts.filter((w) => w.kind === 'race').map((w) => w.id),
  );
  const raceActivities = new Set(
    plan.workouts
      .filter((w) => w.kind === 'race' && w.feedback?.activityId)
      .map((w) => w.feedback!.activityId!),
  );
  const addMinutes = (date: string, minutes: number) => {
    const gap = Math.round((race - Date.parse(date + 'T12:00:00Z')) / 86400000);
    if (!Number.isFinite(gap) || gap < 22 || gap > 63) return;
    weeklyMinutes[Math.floor((63 - gap) / 7)] += minutes;
  };
  // Actual running uses the same deduplicated ledger as Progress. Keep archived
  // facts and extra runs, but never treat an imported race as preparation time.
  for (const r of trainingRecords(plan)) {
    if (
      r.date > asOf ||
      (r.workoutId && raceIds.has(r.workoutId)) ||
      (r.activityId && raceActivities.has(r.activityId))
    )
      continue;
    addMinutes(r.date, r.minutes);
  }
  for (const w of plan.workouts)
    if (
      w.week >= 0 &&
      w.kind !== 'race' &&
      w.status === 'planned' &&
      w.date >= asOf
    )
      addMinutes(w.date, w.minutes);
  const averageMinutes = weeklyMinutes.reduce((n, m) => n + m, 0) / 6;
  const targetWeeks = weeklyMinutes.filter(
    (m) => m >= LONG_ULTRA_POLICY.averageWeeklyMinutes,
  ).length;
  return {
    weeklyMinutes,
    averageMinutes,
    targetWeeks,
    fits:
      averageMinutes >= LONG_ULTRA_POLICY.averageWeeklyMinutes &&
      targetWeeks >= LONG_ULTRA_POLICY.fullWeeksAtTarget,
  };
}

export function longUltraCapacityMessage(plan: Plan, asOf?: string) {
  const capacity = longUltraCapacity(plan, asOf);
  return capacity.fits
    ? null
    : `The six weeks before taper average ${(capacity.averageMinutes / 60).toFixed(1)} hours of running, with ${capacity.targetWeeks} weeks at nine hours. This long-ultra model needs a nine-hour average and at least three nine-hour weeks, while retaining recovery weeks. Review your genuine time availability and recent baseline, or choose a shorter event. Extra time alone does not create training volume.`;
}

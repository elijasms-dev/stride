import { isRoadRaceProfile } from '../road-training-policy.ts';
import { schedulingEasyPace } from '../fitness-pacing.ts';
import { weekday } from './calendar.ts';
import { taperFactor } from './generation-calendar.ts';
import type { Plan, Profile, Workout } from './types.ts';

/** Authored roles for standard road plans, not a universal coaching ratio.
 * Foundation courses and saved plans retain their own prescription contracts. */
export const SESSION_BALANCE_VERSION = 'distinct-long-v1';

export function easyLongRoleCapKm(
  profile: Profile,
  date: string,
  long: Pick<Workout, 'date' | 'estimatedKm'>,
  role?: Workout['role'],
) {
  // A Sunday already inside taper must not retrospectively shorten an earlier
  // training day outside taper. Recovery weeks still scale every easy outing.
  if (taperFactor(profile, date) === 1 && taperFactor(profile, long.date) < 1)
    return Infinity;
  const gap = (weekday(date) - weekday(long.date) + 7) % 7;
  const beforeConsecutiveDay = profile.days.includes((weekday(date) + 1) % 7);
  const fraction =
    profile.goal === 'marathon' && role === 'medium-long'
      ? 0.9
      : gap === 1 || gap === 6 || beforeConsecutiveDay
        ? 0.65
        : 0.8;
  const pace = Math.max(
    schedulingEasyPace(profile),
    profile.workoutTargets?.mode === 'pace'
      ? (profile.workoutTargets.pace?.easy?.high ?? 0) / 60
      : 0,
  );
  // Minimum-length sessions remain executable for a very short familiar long.
  return Math.max(
    Math.ceil((5 / pace) * 1000) / 1000,
    Math.floor(long.estimatedKm * fraction * 1000) / 1000,
  );
}

export function usesDistinctLongBalance(plan: Plan) {
  return (
    plan.sessionBalanceVersion === SESSION_BALANCE_VERSION &&
    (isRoadRaceProfile(plan.profile) || plan.profile.goal === 'marathon') &&
    !plan.beginner &&
    !plan.firstRace
  );
}

export function needsSessionBalanceReview(plan: Plan) {
  return (
    !plan.sessionBalanceVersion &&
    !plan.firstRace &&
    !plan.beginner &&
    plan.profile.experience === 'established' &&
    (!plan.profile.method || plan.profile.method === 'balanced') &&
    (isRoadRaceProfile(plan.profile) || plan.profile.goal === 'marathon')
  );
}

export function sessionBalanceErrors(plan: Plan) {
  if (!usesDistinctLongBalance(plan) || plan.returnState) return [];
  const errors: string[] = [];
  for (const week of plan.weeks) {
    const runs = plan.workouts.filter(
      (w) => w.week === week.index && w.status !== 'skipped',
    );
    const long = balanceReferenceLong(plan, week.index);
    if (
      !long ||
      long.returnRole ||
      long.distanceRevision === 'pace-edited-time' ||
      (long.changed && long.changeSource !== 'preferences')
    )
      continue;
    for (const run of runs) {
      if (
        run.kind !== 'easy' ||
        run.hard ||
        run.pairId ||
        run.status !== 'planned' ||
        run.date < (plan.constraintsFrom ?? plan.profile.startDate) ||
        run.returnRole ||
        run.distanceRevision === 'pace-edited-time' ||
        (run.changed && run.changeSource !== 'preferences')
      )
        continue;
      if (
        run.estimatedKm >
        easyLongRoleCapKm(plan.profile, run.date, long, run.role) + 0.001
      )
        errors.push(
          `Week ${week.index + 1}: the easy run on ${run.date} crowds the long run. Shorten supporting runs within their roles instead of filling unused mileage.`,
        );
    }
  }
  return errors;
}

/** After the last long run, taper support cannot rebound above its old role. */
export function balanceReferenceLong(plan: Plan, week: number) {
  return (
    plan.workouts.find(
      (w) => w.week === week && w.kind === 'long' && w.status !== 'skipped',
    ) ??
    plan.workouts
      .filter(
        (w) =>
          w.week < week &&
          w.kind === 'long' &&
          w.status !== 'skipped' &&
          plan.weeks[w.week]?.phase !== 'Recovery',
      )
      .sort((a, b) => b.date.localeCompare(a.date))[0]
  );
}

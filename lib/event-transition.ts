import { schedulingEasyPace } from './fitness-pacing.ts';
import {
  FIFTY_MILES_KM,
  LONG_ULTRA_POLICY,
  isLongUltra,
} from './ultra-policy.ts';
import { addDays, dayDiff, todayInZone } from './plan/calendar.ts';
import { makePlan } from './plan/generate.ts';
import { adjustPlan } from './plan/adjust.ts';
import { refreshWeekTotals } from './plan/totals.ts';
import { refreshFeasibility } from './plan/feasibility.ts';
import { rebalanceFutureQuality } from './plan/allocate.ts';
import { validatePlan } from './plan/validate.ts';
import { PlanError } from './plan/errors.ts';
import { type Goal, type Plan, type Profile } from './plan/types.ts';
import { currentTrainingBaseline } from './training-history.ts';
export type EventPatch = Pick<
  Profile,
  | 'goal'
  | 'raceName'
  | 'raceDate'
  | 'raceDistanceKm'
  | 'raceTerrain'
  | 'stableWeeks'
  | 'ultraWeeklyMinutes'
  | 'ultraLongestMinutes'
>;
/** A new block starts from recent evidence, never from the outgoing peak forecast. */
export function changeEvent(plan: Plan, patch: EventPatch, asOf: string): Plan {
  if (!patch || typeof patch !== 'object')
    throw new PlanError('Choose an event or a base block.');
  if (plan.returnState && plan.returnState.stage < 3)
    throw new PlanError(
      'Complete the current return review before starting another block. You can extend rest or defer the race in Adjust training.',
    );
  const baseline = currentTrainingBaseline(plan, asOf);
  const recentRace = plan.workouts
    .filter(
      (w) =>
        w.kind === 'race' &&
        w.status === 'completed' &&
        w.feedback &&
        (w.feedback.actualDate ?? w.date) <= asOf,
    )
    .sort((a, b) =>
      (b.feedback!.actualDate ?? b.date).localeCompare(
        a.feedback!.actualDate ?? a.date,
      ),
    )[0];
  const raceDays = recentRace
    ? dayDiff(recentRace.feedback!.actualDate ?? recentRace.date, asOf)
    : Infinity;
  const completedRaceKm = recentRace
    ? (recentRace.feedback?.actualKm ??
      (recentRace.steps.reduce((n, s) => n + (s.metres ?? 0), 0) / 1000 ||
        recentRace.estimatedKm))
    : 0;
  const recoveryDays = recentRace
    ? completedRaceKm > FIFTY_MILES_KM
      ? LONG_ULTRA_POLICY.recoveryDays
      : completedRaceKm >= 42.195
        ? 14
        : completedRaceKm >= 21.0975
          ? 7
          : 3
    : 0;
  const ultraUntil = longUltraRecoveryUntil(plan, asOf);
  const remainingRecoveryDays = Math.max(
    0,
    recoveryDays - raceDays,
    ultraUntil ? dayDiff(asOf, ultraUntil) + 1 : 0,
  );
  // A race recording does not establish a higher sustainable baseline.
  const profile: Profile = {
    ...plan.profile,
    goal: patch.goal as Goal,
    raceName: patch.raceName,
    raceDate: patch.raceDate,
    raceDistanceKm: patch.raceDistanceKm,
    raceTerrain: patch.raceTerrain,
    stableWeeks: patch.stableWeeks ?? plan.profile.stableWeeks,
    ultraWeeklyMinutes:
      patch.ultraWeeklyMinutes ?? plan.profile.ultraWeeklyMinutes,
    ultraLongestMinutes:
      patch.ultraLongestMinutes ?? plan.profile.ultraLongestMinutes,
    startDate: asOf,
    weeklyKm: baseline.weeklyKm,
    longestKm: Math.min(baseline.longestKm, baseline.weeklyKm),
    volume: 'maintain',
  };
  if (profile.goal === 'base' || remainingRecoveryDays > 0)
    Object.assign(profile, {
      method: 'balanced',
      difficulty: 'gentle',
      qualitySessions: profile.goal === 'base' ? 0 : profile.qualitySessions,
      marathonApproach: 'balanced',
      doubleDays: [],
    });
  let next = makePlan(profile, asOf, false, {
    from: asOf,
    baseline,
    history: plan.workouts.filter((w) => w.status === 'completed'),
  });
  const prefix = `block:${asOf}:${patch.raceDate}:${patch.goal}`;
  const occupied = new Set(plan.workouts.map((w) => w.id));
  next.id = prefix;
  next.workouts = next.workouts.map((w) => {
    let id = `${prefix}:${w.id}`,
      n = 0;
    while (occupied.has(id)) id = `${prefix}:${w.id}:${++n}`;
    occupied.add(id);
    return { ...w, id, pairId: w.pairId ? `${prefix}:${w.pairId}` : undefined };
  });
  const retained = plan.workouts
    .filter((w) => w.date < asOf || w.status === 'completed')
    .map((w) => ({ ...structuredClone(w), week: -1 }));
  const completedDates = new Set([
    ...retained
      .filter((w) => w.status === 'completed')
      .map((w) => w.feedback?.actualDate ?? w.date),
    ...(plan.extraRuns ?? []).map((r) => r.date),
  ]);
  next.workouts = next.workouts.filter((w) => !completedDates.has(w.date));
  // Avoid demanding running within 48 hours of a recorded demanding session.
  const recentDemand = retained.filter(
    (w) =>
      w.status === 'completed' &&
      (w.hard || w.kind === 'long' || (w.feedback?.effort ?? 0) >= 7),
  );
  next.workouts = next.workouts.filter(
    (w) =>
      !recentDemand.some((old) => {
        const gap = dayDiff(old.feedback?.actualDate ?? old.date, w.date);
        return gap >= 0 && gap < 2 && (w.hard || w.kind === 'long');
      }),
  );
  next.workouts = next.workouts.filter(
    (w) =>
      !(w.hard || w.kind === 'long') ||
      (plan.extraRuns ?? []).every((r) => {
        const gap = dayDiff(r.date, w.date);
        return (
          gap < 0 ||
          gap >= 2 ||
          (r.effort < 7 &&
            r.minutes <
              Math.max(
                45,
                plan.profile.longestKm * schedulingEasyPace(plan.profile) * 0.9,
              ))
        );
      }),
  );
  next.workouts.push(...retained);
  next.extraRuns = structuredClone(plan.extraRuns ?? []);
  next.notes.push(
    baseline.explanation,
    'This block replaces future prescriptions. Past sessions and recorded facts remain in your journal; unknown sessions stay unknown. The initial volume holds the current baseline.',
  );
  if (remainingRecoveryDays > 0) {
    next = adjustPlan(
      next,
      asOf,
      addDays(asOf, remainingRecoveryDays - 1),
      'rest',
      asOf,
    );
    next.notes.push(
      `A provisional ${ultraUntil ? LONG_ULTRA_POLICY.recoveryDays : recoveryDays}-day post-race recovery window precedes a reviewed return. This is a conservative product policy, not a medical clearance or recovery prediction.`,
    );
  }
  refreshWeekTotals(next);
  rebalanceFutureQuality(next, asOf);
  if (isLongUltra(next.profile)) refreshFeasibility(next, asOf);
  const issues = validatePlan(next);
  if (issues.length) throw new PlanError(issues[0]);
  return next;
}

/** Shared by onboarding preview/activation: a new block cannot duplicate recorded days. */
export function avoidRecordedOverlap(
  candidate: Plan,
  previous: Plan | null,
  standaloneRuns: Plan['extraRuns'] = [],
  asOf = todayInZone(candidate.profile.timezone),
): Plan {
  if (!previous && !standaloneRuns?.length) return candidate;
  previous ??= { ...candidate, workouts: [], extraRuns: standaloneRuns };
  if (previous.returnState && previous.returnState.stage < 3)
    throw new PlanError(
      'Complete the current return review before starting another block. Rest can be extended in Adjust training.',
    );
  const dates = new Set([
    ...previous.workouts
      .filter((w) => w.status === 'completed')
      .map((w) => w.feedback?.actualDate ?? w.date),
    ...(previous.extraRuns ?? []).map((r) => r.date),
  ]);
  const demands = [
    ...previous.workouts
      .filter(
        (w) =>
          w.status === 'completed' &&
          (w.hard || w.kind === 'long' || (w.feedback?.effort ?? 0) >= 7),
      )
      .map((w) => w.feedback?.actualDate ?? w.date),
    ...(previous.extraRuns ?? [])
      .filter(
        (r) =>
          r.effort >= 7 ||
          r.minutes >=
            Math.max(
              45,
              previous.profile.longestKm *
                schedulingEasyPace(previous.profile) *
                0.9,
            ),
      )
      .map((r) => r.date),
  ];
  candidate.workouts = candidate.workouts.filter(
    (w) =>
      !dates.has(w.date) &&
      (!(w.hard || w.kind === 'long') ||
        !demands.some((d) => {
          const gap = dayDiff(d, w.date);
          return gap >= 0 && gap < 2;
        })),
  );
  candidate.notes.push(
    'Recorded days are retained in your journal and do not receive a second newly generated session.',
  );
  const recoveryUntil = longUltraRecoveryUntil(previous, asOf);
  const recoveryFrom =
    candidate.profile.startDate > asOf ? candidate.profile.startDate : asOf;
  if (
    recoveryUntil &&
    recoveryUntil >= recoveryFrom &&
    recoveryFrom <= candidate.profile.raceDate
  ) {
    candidate = adjustPlan(
      candidate,
      recoveryFrom,
      recoveryUntil,
      'rest',
      asOf,
    );
    candidate.notes.push(
      'A completed long ultra is followed by a provisional 21-day recovery window and a reviewed return. Starting a new plan does not bypass recovery.',
    );
  }
  refreshWeekTotals(candidate);
  rebalanceFutureQuality(candidate, candidate.profile.startDate);
  if (isLongUltra(candidate.profile)) refreshFeasibility(candidate, asOf);
  return candidate;
}

/** A fresh onboarding block must respect the same long-ultra recovery window. */
export function longUltraRecoveryUntil(
  plan: Plan,
  asOf: string,
): string | null {
  const races = plan.workouts.filter(
    (w) =>
      w.kind === 'race' &&
      w.status === 'completed' &&
      w.feedback &&
      (w.feedback.actualDate ?? w.date) <= asOf &&
      (w.feedback.actualKm ?? w.estimatedKm) > FIFTY_MILES_KM,
  );
  const ends = races
    .map((w) =>
      addDays(
        w.feedback!.actualDate ?? w.date,
        LONG_ULTRA_POLICY.recoveryDays - 1,
      ),
    )
    .filter((d) => d >= asOf)
    .sort();
  return ends.at(-1) ?? null;
}

import type { Profile, Workout } from './plan/types.ts';
import { schedulingEasyPace } from './fitness-pacing.ts';

export type RoadGoal = '5k' | '10k' | 'half';
export type RoadAbility = 'developing' | 'established' | 'advanced';

/** These rules apply to the three named events, never to custom or marathon plans. */
export function isRoadRaceProfile(
  p: Pick<Profile, 'goal'>,
): p is typeof p & { goal: RoadGoal } {
  return p.goal === '5k' || p.goal === '10k' || p.goal === 'half';
}

/** The supplied short-race reference keeps quality during mid-block consolidation. */
export function isShortRoadRaceProfile(p: Pick<Profile, 'goal'>): boolean {
  return p.goal === '5k' || p.goal === '10k';
}

/** Capacity is evidenced by the existing routine, not a predicted finishing time. */
export function roadAbility(p: Profile): RoadAbility {
  const half = p.goal === 'half';
  if (
    p.experience !== 'established' ||
    p.currentRuns < 4 ||
    p.weeklyKm < (half ? 35 : p.goal === '10k' ? 25 : 20)
  )
    return 'developing';
  if (
    p.currentRuns >= 5 &&
    p.weeklyKm >= (half ? 55 : 45) &&
    p.longestKm >= (half ? 16 : p.goal === '10k' ? 12 : 10)
  )
    return 'advanced';
  return 'established';
}

// Authored planning bands synthesised from the published plans in docs/research.
// They are bounded forecasts, not physiological safety thresholds or promises.
const BANDS = {
  '5k': {
    developing: {
      longKm: 6,
      longMinutes: 60,
      qualityMinutes: 50,
      weeklyStep: 1,
      preparationWeeks: 8,
    },
    established: {
      longKm: 10,
      longMinutes: 80,
      qualityMinutes: 65,
      weeklyStep: 1.5,
      preparationWeeks: 10,
    },
    advanced: {
      longKm: 14,
      longMinutes: 100,
      qualityMinutes: 80,
      weeklyStep: 2,
      preparationWeeks: 10,
    },
  },
  '10k': {
    developing: {
      longKm: 9,
      longMinutes: 80,
      qualityMinutes: 55,
      weeklyStep: 1.5,
      preparationWeeks: 10,
    },
    established: {
      longKm: 13,
      longMinutes: 100,
      qualityMinutes: 70,
      weeklyStep: 2,
      preparationWeeks: 10,
    },
    advanced: {
      longKm: 16,
      longMinutes: 110,
      qualityMinutes: 85,
      weeklyStep: 2.5,
      preparationWeeks: 12,
    },
  },
  half: {
    developing: {
      longKm: 16,
      longMinutes: 120,
      qualityMinutes: 60,
      weeklyStep: 2,
      preparationWeeks: 12,
    },
    established: {
      longKm: 19,
      longMinutes: 135,
      qualityMinutes: 80,
      weeklyStep: 2.5,
      preparationWeeks: 14,
    },
    advanced: {
      longKm: 23,
      longMinutes: 150,
      qualityMinutes: 95,
      weeklyStep: 3,
      preparationWeeks: 14,
    },
  },
} as const;

export function roadTrainingPolicy(p: Profile) {
  if (!isRoadRaceProfile(p))
    throw new Error('Road policy requires a 5K, 10K or half-marathon goal.');
  const ability = roadAbility(p);
  return {
    ...BANDS[p.goal][ability],
    ability,
    forecastFactor:
      ability === 'developing' ? 1.65 : ability === 'established' ? 1.45 : 1.3,
    growthFraction:
      ability === 'developing' ? 0.08 : ability === 'established' ? 0.06 : 0.04,
    longStepKm: p.goal === 'half' && p.longestKm >= 12 ? 2 : 1,
  };
}

export function roadTaperDays(p: Pick<Profile, 'goal'>) {
  return p.goal === 'half' ? 14 : 7;
}

export function roadTaperFraction(
  p: Pick<Profile, 'goal'>,
  daysBeforeRace: number,
) {
  if (daysBeforeRace > roadTaperDays(p)) return 1;
  if (p.goal === 'half') return daysBeforeRace > 7 ? 0.8 : 0.5;
  return 0.6;
}

export function roadPeakLongKm(
  p: Profile,
  baseline = p.longestKm,
  pace = schedulingEasyPace(p),
) {
  const band = roadTrainingPolicy(p);
  // A familiar longer outing is retained, but does not license further growth.
  return p.volume === 'maintain'
    ? baseline
    : Math.max(baseline, Math.min(band.longKm, band.longMinutes / pace));
}

export function roadQualitySessionCap(p: Profile) {
  return isRoadRaceProfile(p) ? roadTrainingPolicy(p).qualityMinutes : Infinity;
}

export function roadAerobicAllowanceMinutes(p: Profile) {
  return roadAbility(p) === 'developing'
    ? 10
    : roadAbility(p) === 'established'
      ? 15
      : 20;
}

/** Surplus weekly kilometres belong on easy days, not before a small main set. */
export function roadWorkoutMinutesCap(
  p: Profile,
  w: Pick<Workout, 'kind' | 'hard' | 'steps'>,
) {
  if (
    !isRoadRaceProfile(p) ||
    !w.hard ||
    w.kind === 'long' ||
    w.kind === 'race' ||
    (p.method && p.method !== 'balanced')
  )
    return Infinity;
  const essential = w.steps
    .filter((s) => s.kind !== 'aerobic')
    .reduce((n, s) => n + s.seconds / 60, 0);
  return Math.min(
    roadQualitySessionCap(p),
    essential + roadAerobicAllowanceMinutes(p),
  );
}

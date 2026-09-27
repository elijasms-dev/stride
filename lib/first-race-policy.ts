import { schedulingEasyPace } from './fitness-pacing.ts';
import { addDays, dayDiff, weekday } from './plan/calendar.ts';
import type { Plan, Profile } from './plan/types.ts';

export type FirstRaceGoal = '5k' | '10k' | 'half' | 'marathon';

/** Independently authored product policy, informed by the linked beginner
 * programmes. These are preparation screens, not proof of race readiness. */
export const FIRST_RACE_POLICY = {
  '5k': {
    minimumWeeklyKm: 7.5,
    minimumLongKm: 2.5,
    runs: [3],
    weeks: 8,
    taperDays: 7,
    targetLongKm: 5,
    minimumPeakKm: 5,
    longStepKm: 1,
    peakWeeklyKm: 18,
    supportWeeklyKm: 10,
    source:
      'https://www.halhigdon.com/training-programs/5k-training/novice-5k/',
  },
  '10k': {
    minimumWeeklyKm: 12,
    minimumLongKm: 5,
    runs: [3],
    weeks: 8,
    taperDays: 7,
    targetLongKm: 9,
    minimumPeakKm: 9,
    longStepKm: 1,
    peakWeeklyKm: 28,
    supportWeeklyKm: 16,
    source:
      'https://www.halhigdon.com/training-programs/10k-training/novice-10k/',
  },
  half: {
    minimumWeeklyKm: 18,
    minimumLongKm: 6,
    runs: [3, 4],
    weeks: 12,
    taperDays: 14,
    targetLongKm: 16,
    minimumPeakKm: 16,
    longStepKm: 2,
    peakWeeklyKm: 44,
    supportWeeklyKm: 28,
    source:
      'https://www.halhigdon.com/training-programs/half-marathon-training/novice-1-half-marathon/',
  },
  marathon: {
    minimumWeeklyKm: 24,
    minimumLongKm: 10,
    runs: [4],
    weeks: 18,
    taperDays: 21,
    targetLongKm: 32,
    minimumPeakKm: 28,
    longStepKm: 2,
    peakWeeklyKm: 64,
    supportWeeklyKm: 48,
    source:
      'https://www.halhigdon.com/training-programs/marathon-training/novice-1-marathon/',
  },
} as const;

export function isFirstRaceProfile(
  p: Profile,
): p is Profile & { goal: FirstRaceGoal } {
  return (
    p.planLevel === 'beginner' &&
    Object.hasOwn(FIRST_RACE_POLICY, p.goal) &&
    p.weeklyKm > 0 &&
    p.longestKm > 0 &&
    p.currentRuns > 0
  );
}

export function firstRaceProfileError(p: Profile): string | undefined {
  if (!isFirstRaceProfile(p)) return;
  const policy = FIRST_RACE_POLICY[p.goal];
  if (
    p.weeklyKm < policy.minimumWeeklyKm ||
    p.longestKm < policy.minimumLongKm ||
    p.currentRuns < 3
  )
    return `This first-race ${p.goal} block starts with an existing routine of at least ${policy.minimumWeeklyKm} km per week, a ${policy.minimumLongKm} km recent long run and three current running days. Build a foundation first; the opening mileage will not be invented.`;
  const runs = p.runsPerWeek ?? p.days.length;
  if (!(policy.runs as readonly number[]).includes(runs))
    return `The beginner ${p.goal} plan uses ${policy.runs.join(' or ')} running days per week. Choose that frequency or review a standard plan.`;
  if (p.qualityMode === 'custom' && (p.qualitySessions ?? 0) > 0)
    return 'The first-race plan has zero speed workouts: all training, including the long run, stays easy. Choose zero or review a standard plan for faster workouts.';
  if ((p.method && p.method !== 'balanced') || p.doubleDays?.length)
    return 'First-race plans use single easy runs. Specialist training methods and double sessions need a standard plan.';
  if (p.raceTerrain === 'mountain')
    return 'This first-race plan models runnable road or rolling events. A mountain event needs a course-specific preparation review.';
  if (p.longestKm >= p.weeklyKm)
    return 'Your first-race weekly baseline must include the long run and the other easy runs. Review both starting distances together.';
}

/** The longest normal outing can be exactly 7/14/21 days before the event.
 * Every subsequent calendar day tapers, irrespective of its week label. */
export function firstRaceTaperFactor(
  p: Pick<Profile, 'goal' | 'raceDate'>,
  date: string,
): number {
  const policy = FIRST_RACE_POLICY[p.goal as FirstRaceGoal];
  const left = dayDiff(date, p.raceDate);
  if (left >= policy.taperDays) return 1;
  if (left < 2) return 0;
  if (left < 7) return 0.4;
  if (left < 14) return 0.6;
  return 0.75;
}

export function firstRacePlanErrors(plan: Plan): string[] {
  if (!plan.firstRace)
    return isFirstRaceProfile(plan.profile)
      ? ['The first-race plan is missing its saved programme identity.']
      : [];
  if (
    plan.firstRace.program !== 'first-race-v1' ||
    plan.firstRace.goal !== plan.profile.goal ||
    !isFirstRaceProfile(plan.profile) ||
    plan.beginner
  )
    return [
      'The first-race plan has invalid programme identity or runner inputs.',
    ];
  const errors: string[] = [];
  const policy = FIRST_RACE_POLICY[plan.firstRace.goal];
  const active = plan.workouts.filter((w) => w.week >= 0 && w.kind !== 'race');
  if (
    active.some(
      (w) =>
        w.hard ||
        !['easy', 'long'].includes(w.kind) ||
        w.templateId ||
        (w.qualityMinutes ?? 0) > 0 ||
        w.steps.some((s) => s.intensity > 3),
    )
  )
    errors.push(
      'First-race training must remain easy, with no speed workouts or hard long-run finishes.',
    );
  const race = plan.workouts.filter((w) => w.week >= 0 && w.kind === 'race');
  const distance = { '5k': 5, '10k': 10, half: 21.0975, marathon: 42.195 }[
    plan.firstRace.goal
  ];
  if (
    race.length !== 1 ||
    race[0].date !== plan.profile.raceDate ||
    Math.abs(
      race[0].steps.reduce((n, s) => n + (s.metres ?? 0), 0) / 1000 - distance,
    ) > 0.00001
  )
    errors.push(
      'A first-race plan must retain one exact-distance event on its chosen date.',
    );
  // Logs, recovery and deliberate changes are evidence, not a pristine forecast.
  // Structural validation still checks them; adequacy is derived separately.
  const pristine =
    !plan.baselineEvidence &&
    !plan.returnState &&
    (!plan.constraintsFrom ||
      plan.constraintsFrom === plan.profile.startDate) &&
    plan.workouts.every(
      (w) => w.status === 'planned' && !w.changed && !w.returnRole,
    );
  if (!pristine) return errors;
  const pace = schedulingEasyPace(plan.profile);
  let priorWeekly = plan.profile.weeklyKm;
  let priorLong = plan.profile.longestKm;
  let opening = true;
  for (const week of plan.weeks) {
    const runs = active.filter((w) => w.week === week.index);
    const longest = runs.find((w) => w.kind === 'long');
    if (
      longest &&
      runs.some(
        (w) =>
          firstRaceTaperFactor(plan.profile, w.date) ===
            firstRaceTaperFactor(plan.profile, longest.date) &&
          w.estimatedKm > longest.estimatedKm + 0.0011,
      )
    )
      errors.push(
        'The first-race long run must be at least as long as its supporting easy runs.',
      );
    const complete =
      week.start >= plan.profile.startDate &&
      addDays(week.start, 6) < plan.profile.raceDate &&
      runs.length === plan.profile.days.length;
    const ordinary =
      complete &&
      week.phase !== 'Recovery' &&
      runs.every((w) => firstRaceTaperFactor(plan.profile, w.date) === 1);
    if (!ordinary) continue;
    const km = runs.reduce((n, w) => n + w.estimatedKm, 0);
    const long = runs.find((w) => w.kind === 'long');
    if (!long) {
      errors.push('A full first-race build week needs its easy long run.');
      continue;
    }
    if (
      opening &&
      (Math.abs(km - plan.profile.weeklyKm) > 0.0011 ||
        Math.abs(long.estimatedKm - plan.profile.longestKm) > 0.0011)
    )
      errors.push(
        'The first full first-race week must preserve the declared weekly and long-run distances.',
      );
    if (km + 0.0011 < priorWeekly || km > priorWeekly * 1.1 + 0.002)
      errors.push(
        'First-race build volume must hold or rise by at most ten percent from the preceding build anchor.',
      );
    const step =
      plan.firstRace.goal === 'marathon' && priorLong >= 20
        ? 3
        : policy.longStepKm;
    if (
      long.estimatedKm + 0.0011 < priorLong ||
      long.estimatedKm > priorLong + step + 0.0011
    )
      errors.push(
        'First-race long runs must retain their build anchor and use bounded whole-kilometre increases.',
      );
    if (
      Math.abs(long.estimatedKm - plan.profile.longestKm) > 0.0011 &&
      Math.abs(long.estimatedKm - Math.round(long.estimatedKm)) > 0.0011
    )
      errors.push(
        'First-race long-run increases must land on whole kilometres after the declared starting distance.',
      );
    if (long.minutes + 1 / 60 < long.estimatedKm * pace)
      errors.push(
        'The first-race long-run distance must fit its planning duration.',
      );
    if (weekday(long.date) !== plan.profile.longDay)
      errors.push(
        'The unchanged first-race long run must use the chosen long-run day.',
      );
    priorWeekly = km;
    priorLong = long.estimatedKm;
    opening = false;
  }
  return [...new Set(errors)];
}
